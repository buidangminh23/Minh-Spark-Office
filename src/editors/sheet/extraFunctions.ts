import {
  ArrayValueObject,
  BaseFunction,
  BooleanValueObject,
  ErrorType,
  ErrorValueObject,
  FunctionType,
  NumberValueObject,
  StringValueObject,
  functionDate,
  functionMath,
  type BaseReferenceObject,
  type BaseValueObject,
  type IFunctionInfo,
  type IFunctionNames,
} from '@univerjs/engine-formula';
import {
  buildEtsModel,
  etsConfidenceInterval,
  etsForecast,
  etsStatistic,
  validateEtsOptions,
  type EtsErrorCode,
  type EtsModel,
  type EtsOptions,
  type EtsResult,
} from './forecastEts';

type Variant = BaseValueObject | BaseReferenceObject | undefined | null;
type FunctionCtor = new (name: IFunctionNames) => BaseFunction;

const ERROR_BY_CODE: Record<EtsErrorCode, ErrorType> = {
  '#N/A': ErrorType.NA,
  '#NUM!': ErrorType.NUM,
  '#VALUE!': ErrorType.VALUE,
  '#DIV/0!': ErrorType.DIV_BY_ZERO,
};

const errorOf = (type: ErrorType) => ErrorValueObject.create(type);

function isReference(variant: Variant): variant is BaseReferenceObject {
  return !!variant && (variant as { isReferenceObject?: () => boolean }).isReferenceObject?.() === true;
}

function toValue(variant: Variant): BaseValueObject | ArrayValueObject | null {
  if (variant == null) return null;
  if (isReference(variant)) return variant.toArrayValueObject();
  return variant as BaseValueObject;
}

function firstCell(variant: Variant): BaseValueObject | null {
  const value = toValue(variant);
  if (value == null) return null;
  if (value.isArray()) return (value as ArrayValueObject).get(0, 0) ?? null;
  return value;
}

function scalarNumber(variant: Variant, fallback: number): number | ErrorValueObject {
  const cell = firstCell(variant);
  if (cell == null || cell.isNull()) return fallback;
  if (cell.isError()) return cell as ErrorValueObject;
  const number = cell.isString() ? cell.convertToNumberObjectValue() : cell;
  if (number.isError()) return number as ErrorValueObject;
  const parsed = Number(number.getValue());
  return Number.isFinite(parsed) ? parsed : errorOf(ErrorType.VALUE);
}

function cellList(variant: Variant): Array<BaseValueObject | null> | ErrorValueObject {
  const value = toValue(variant);
  if (value == null) return errorOf(ErrorType.VALUE);
  if (value.isError()) return value as ErrorValueObject;
  if (!value.isArray()) return [value];
  const cells: Array<BaseValueObject | null> = [];
  (value as ArrayValueObject).iterator((cell) => {
    cells.push(cell ?? null);
  });
  return cells;
}

function numberList(variant: Variant, allowBlank: boolean): Array<number | null> | ErrorValueObject {
  const cells = cellList(variant);
  if (cells instanceof ErrorValueObject) return cells;
  const numbers: Array<number | null> = [];
  for (const cell of cells) {
    if (cell == null || cell.isNull()) {
      if (!allowBlank) return errorOf(ErrorType.VALUE);
      numbers.push(null);
      continue;
    }
    if (cell.isError()) return cell as ErrorValueObject;
    if (!cell.isNumber()) {
      if (!allowBlank) return errorOf(ErrorType.VALUE);
      numbers.push(null);
      continue;
    }
    numbers.push(Number(cell.getValue()));
  }
  return numbers;
}

function resultValue(result: EtsResult<number>): BaseValueObject {
  return result.ok ? NumberValueObject.create(result.value) : errorOf(ERROR_BY_CODE[result.error]);
}

function readEtsOptions(seasonality: Variant, completion: Variant, aggregation: Variant): EtsOptions | ErrorValueObject {
  const season = scalarNumber(seasonality, 1);
  if (season instanceof ErrorValueObject) return season;
  const fill = scalarNumber(completion, 1);
  if (fill instanceof ErrorValueObject) return fill;
  const aggregate = scalarNumber(aggregation, 1);
  if (aggregate instanceof ErrorValueObject) return aggregate;
  const options = validateEtsOptions(season, fill, aggregate);
  return options.ok ? options.value : errorOf(ERROR_BY_CODE[options.error]);
}

function readEtsModel(values: Variant, timeline: Variant, options: EtsOptions): EtsModel | ErrorValueObject {
  const ys = numberList(values, true);
  if (ys instanceof ErrorValueObject) return ys;
  const xs = numberList(timeline, false);
  if (xs instanceof ErrorValueObject) return xs;
  const model = buildEtsModel(xs as number[], ys, options);
  return model.ok ? model.value : errorOf(ERROR_BY_CODE[model.error]);
}

function mapTargets(target: Variant, compute: (serial: number) => BaseValueObject): BaseValueObject {
  const value = toValue(target);
  if (value == null) return errorOf(ErrorType.VALUE);
  const single = (cell: BaseValueObject | null) => {
    if (cell == null || cell.isNull()) return compute(0);
    if (cell.isError()) return cell;
    const number = cell.isString() ? cell.convertToNumberObjectValue() : cell;
    if (number.isError() || !number.isNumber()) return errorOf(ErrorType.VALUE);
    return compute(Number(number.getValue()));
  };
  if (!value.isArray()) return single(value);
  const array = value as ArrayValueObject;
  if (array.getRowCount() === 1 && array.getColumnCount() === 1) return single(array.get(0, 0) ?? null);
  return array.mapValue((cell) => single(cell));
}

class ForecastEts extends BaseFunction {
  minParams = 3;
  maxParams = 6;

  calculate(target: Variant, values: Variant, timeline: Variant, seasonality?: Variant, completion?: Variant, aggregation?: Variant) {
    const options = readEtsOptions(seasonality, completion, aggregation);
    if (options instanceof ErrorValueObject) return options;
    const model = readEtsModel(values, timeline, options);
    if (model instanceof ErrorValueObject) return model;
    return mapTargets(target, (serial) => resultValue(etsForecast(model, serial)));
  }
}

class ForecastEtsConfint extends BaseFunction {
  minParams = 3;
  maxParams = 7;

  calculate(
    target: Variant,
    values: Variant,
    timeline: Variant,
    confidence?: Variant,
    seasonality?: Variant,
    completion?: Variant,
    aggregation?: Variant
  ) {
    const level = scalarNumber(confidence, 0.95);
    if (level instanceof ErrorValueObject) return level;
    const options = readEtsOptions(seasonality, completion, aggregation);
    if (options instanceof ErrorValueObject) return options;
    const model = readEtsModel(values, timeline, options);
    if (model instanceof ErrorValueObject) return model;
    return mapTargets(target, (serial) => resultValue(etsConfidenceInterval(model, serial, level)));
  }
}

class ForecastEtsSeasonality extends BaseFunction {
  minParams = 2;
  maxParams = 4;

  calculate(values: Variant, timeline: Variant, completion?: Variant, aggregation?: Variant) {
    const options = readEtsOptions(null, completion, aggregation);
    if (options instanceof ErrorValueObject) return options;
    const model = readEtsModel(values, timeline, options);
    if (model instanceof ErrorValueObject) return model;
    return NumberValueObject.create(model.season > 1 ? model.season : 0);
  }
}

class ForecastEtsStat extends BaseFunction {
  minParams = 3;
  maxParams = 6;

  calculate(values: Variant, timeline: Variant, statistic: Variant, seasonality?: Variant, completion?: Variant, aggregation?: Variant) {
    const type = scalarNumber(statistic, Number.NaN);
    if (type instanceof ErrorValueObject) return type;
    if (!Number.isInteger(type) || type < 1 || type > 8) return errorOf(ErrorType.NUM);
    const options = readEtsOptions(seasonality, completion, aggregation);
    if (options instanceof ErrorValueObject) return options;
    const model = readEtsModel(values, timeline, options);
    if (model instanceof ErrorValueObject) return model;
    return resultValue(etsStatistic(model, type));
  }
}

const findFunction = (list: unknown, name: string): FunctionCtor => {
  const entry = (list as Array<[FunctionCtor, IFunctionNames]>).find(([, functionName]) => functionName === name);
  if (!entry) throw new Error(`Univer function ${name} is missing`);
  return entry[0];
};

const YearfracCtor = findFunction(functionDate, 'YEARFRAC');
const DatevalueCtor = findFunction(functionDate, 'DATEVALUE');
const CeilingPreciseCtor = findFunction(functionMath, 'CEILING.PRECISE');

export function amordegrcCoefficient(life: number): number | null {
  const between = (low: number, high: number) => life > low && life < high;
  if (between(0, 1) || between(1, 2) || between(2, 3) || between(4, 5)) return null;
  if (life < 3) return 1;
  if (life <= 4) return 1.5;
  if (life <= 6) return 2;
  return 2.5;
}

export function amordegrcValue(cost: number, firstFraction: number, salvage: number, period: number, rate: number): number | null {
  const coefficient = amordegrcCoefficient(1 / rate);
  if (coefficient === null) return null;
  const adjustedRate = rate * coefficient;
  let depreciation = Math.round(firstFraction * adjustedRate * cost);
  let remaining = cost - depreciation;
  let rest = remaining - salvage;
  for (let n = 0; n < period; n++) {
    depreciation = Math.round(adjustedRate * remaining);
    rest -= depreciation;
    if (rest < 0) return period - n <= 1 ? Math.round(remaining * 0.5) : 0;
    remaining -= depreciation;
  }
  return depreciation;
}

class Amordegrc extends BaseFunction {
  minParams = 6;
  maxParams = 7;

  private serialOf(variant: Variant): number | ErrorValueObject {
    const cell = firstCell(variant);
    if (cell == null || cell.isNull()) return 0;
    if (cell.isError()) return cell as ErrorValueObject;
    if (cell.isBoolean()) return errorOf(ErrorType.VALUE);
    if (cell.isNumber()) return Number(cell.getValue());
    const parser = new DatevalueCtor('DATEVALUE');
    parser.setDateSystem(this.getDateSystem());
    const parsed = parser.calculate(cell) as BaseValueObject;
    return parsed.isError() ? (parsed as ErrorValueObject) : Number(parsed.getValue());
  }

  calculate(cost: Variant, purchased: Variant, firstPeriod: Variant, salvage: Variant, period: Variant, rate: Variant, basis?: Variant) {
    const numbers = [cost, salvage, period, rate].map((item) => scalarNumber(item, 0));
    const basisValue = scalarNumber(basis, 0);
    const purchasedSerial = this.serialOf(purchased);
    const firstSerial = this.serialOf(firstPeriod);
    for (const item of [...numbers, basisValue, purchasedSerial, firstSerial]) {
      if (item instanceof ErrorValueObject) return item;
    }
    const [costValue, salvageValue, periodValue, rateValue] = numbers as number[];
    const basisCode = Math.floor(basisValue as number);
    if (costValue <= 0 || salvageValue < 0 || salvageValue > costValue || periodValue < 0 || rateValue <= 0) return errorOf(ErrorType.NUM);
    if (![0, 1, 3, 4].includes(basisCode) || Math.floor(purchasedSerial as number) > Math.floor(firstSerial as number)) return errorOf(ErrorType.NUM);
    const yearfrac = new YearfracCtor('YEARFRAC');
    yearfrac.setDateSystem(this.getDateSystem());
    const fraction = yearfrac.calculate(
      NumberValueObject.create(purchasedSerial as number),
      NumberValueObject.create(firstSerial as number),
      NumberValueObject.create(basisCode)
    ) as BaseValueObject;
    if (fraction.isError()) return fraction;
    const result = amordegrcValue(costValue, Number(fraction.getValue()), salvageValue, Math.trunc(periodValue), rateValue);
    return result === null ? errorOf(ErrorType.NUM) : NumberValueObject.create(result);
  }
}

const EURO_RATES: Record<string, { rate: number; decimals: number }> = {
  BEF: { rate: 40.3399, decimals: 0 },
  LUF: { rate: 40.3399, decimals: 0 },
  DEM: { rate: 1.95583, decimals: 2 },
  ESP: { rate: 166.386, decimals: 0 },
  FRF: { rate: 6.55957, decimals: 2 },
  IEP: { rate: 0.787564, decimals: 2 },
  ITL: { rate: 1936.27, decimals: 0 },
  NLG: { rate: 2.20371, decimals: 2 },
  ATS: { rate: 13.7603, decimals: 2 },
  PTE: { rate: 200.482, decimals: 0 },
  FIM: { rate: 5.94573, decimals: 2 },
  GRD: { rate: 340.75, decimals: 0 },
  SIT: { rate: 239.64, decimals: 2 },
  EUR: { rate: 1, decimals: 2 },
};
const MIN_TRIANGULATION_PRECISION = 3;

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
};

export function euroConvert(amount: number, source: string, target: string, fullPrecision: boolean, triangulationPrecision: number | null): number | null {
  const from = EURO_RATES[source.toUpperCase()];
  const to = EURO_RATES[target.toUpperCase()];
  if (!from || !to) return null;
  if (triangulationPrecision !== null && triangulationPrecision < MIN_TRIANGULATION_PRECISION) return null;
  if (from === to) return amount;
  const euros = amount / from.rate;
  const intermediate = triangulationPrecision === null ? euros : roundTo(euros, Math.trunc(triangulationPrecision));
  const converted = intermediate * to.rate;
  return fullPrecision ? converted : roundTo(converted, to.decimals);
}

class Euroconvert extends BaseFunction {
  minParams = 3;
  maxParams = 5;

  calculate(amount: Variant, source: Variant, target: Variant, fullPrecision?: Variant, triangulationPrecision?: Variant) {
    const amountValue = scalarNumber(amount, 0);
    const fullValue = scalarNumber(fullPrecision, 0);
    const triangulationCell = firstCell(triangulationPrecision);
    const triangulationValue = triangulationCell == null || triangulationCell.isNull() ? null : scalarNumber(triangulationPrecision, 0);
    for (const item of [amountValue, fullValue, triangulationValue]) {
      if (item instanceof ErrorValueObject) return item;
    }
    const sourceCell = firstCell(source);
    const targetCell = firstCell(target);
    if (!sourceCell || !targetCell || sourceCell.isError() || targetCell.isError()) return errorOf(ErrorType.VALUE);
    const result = euroConvert(
      amountValue as number,
      String(sourceCell.getValue()),
      String(targetCell.getValue()),
      (fullValue as number) !== 0,
      triangulationValue as number | null
    );
    return result === null ? errorOf(ErrorType.VALUE) : NumberValueObject.create(result);
  }
}

export function toFullWidth(text: string): string {
  const katakana = text.replace(/[｡-ﾟ]+/g, (run) => run.normalize('NFKC'));
  let result = '';
  for (const char of katakana) {
    const code = char.charCodeAt(0);
    if (code === 0x20) result += '　';
    else if (code >= 0x21 && code <= 0x7e) result += String.fromCharCode(code + 0xfee0);
    else result += char;
  }
  return result;
}

class Jis extends BaseFunction {
  minParams = 1;
  maxParams = 1;

  private convert(cell: BaseValueObject | null): BaseValueObject {
    if (cell == null || cell.isNull()) return StringValueObject.create('');
    if (cell.isError()) return cell;
    if (cell.isBoolean()) return StringValueObject.create(toFullWidth(cell.getValue() ? 'TRUE' : 'FALSE'));
    return StringValueObject.create(toFullWidth(String(cell.getValue())));
  }

  calculate(text: Variant) {
    const value = toValue(text);
    if (value == null) return errorOf(ErrorType.VALUE);
    if (!value.isArray()) return this.convert(value);
    const array = value as ArrayValueObject;
    if (array.getRowCount() === 1 && array.getColumnCount() === 1) return this.convert(array.get(0, 0) ?? null);
    return array.mapValue((cell) => this.convert(cell));
  }
}

class Phonetic extends BaseFunction {
  minParams = 1;
  maxParams = 1;
  needsReferenceObject = true;

  calculate(reference: Variant) {
    const cell = firstCell(reference);
    if (cell == null || cell.isNull()) return StringValueObject.create('');
    if (cell.isError()) return cell;
    if (cell.isBoolean()) return StringValueObject.create(cell.getValue() ? 'TRUE' : 'FALSE');
    return StringValueObject.create(String(cell.getValue()));
  }
}

class IsOmitted extends BaseFunction {
  minParams = 1;
  maxParams = 1;
  needsReferenceObject = true;

  calculate(argument: Variant) {
    if (argument == null) return BooleanValueObject.create(true);
    if (isReference(argument)) return BooleanValueObject.create(false);
    return BooleanValueObject.create(argument.isNull());
  }
}

export function infoText(type: string, sheetCount: number, userAgent: string): string | ErrorType {
  const isMac = /Mac|iPhone|iPad/i.test(userAgent);
  switch (type.trim().toLowerCase()) {
    case 'numfile':
      return String(sheetCount);
    case 'origin':
      return '$A:$A$1';
    case 'osversion':
      return isMac ? 'Macintosh' : /Windows/i.test(userAgent) ? 'Windows (64-bit) NT 10.00' : 'Web';
    case 'recalc':
      return 'Automatic';
    case 'release':
      return '16.0';
    case 'system':
      return isMac ? 'mac' : 'pcdos';
    case 'directory':
    case 'memavail':
    case 'memused':
    case 'totmem':
      return ErrorType.NA;
    default:
      return ErrorType.VALUE;
  }
}

class Info extends BaseFunction {
  minParams = 1;
  maxParams = 1;
  needsSheetsInfo = true;

  calculate(typeText: Variant) {
    const cell = firstCell(typeText);
    if (cell == null || cell.isNull()) return errorOf(ErrorType.VALUE);
    if (cell.isError()) return cell;
    if (!cell.isString()) return errorOf(ErrorType.VALUE);
    const sheetCount = this.getSheetsInfo().sheetOrder?.length ?? 1;
    const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const result = infoText(String(cell.getValue()), sheetCount, agent);
    if (result === ErrorType.NA || result === ErrorType.VALUE) return errorOf(result);
    const numeric = Number(result);
    return Number.isFinite(numeric) && result === String(numeric) ? NumberValueObject.create(numeric) : StringValueObject.create(result);
  }
}

export interface TrimBounds {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export function trimBounds(filled: boolean[][], trimRows: number, trimColumns: number): TrimBounds | null {
  const rowsUsed = filled.map((row) => row.some(Boolean));
  const columnCount = filled[0]?.length ?? 0;
  const columnsUsed = Array.from({ length: columnCount }, (_, column) => filled.some((row) => row[column]));
  if (!rowsUsed.some(Boolean)) return null;
  const leading = (flags: boolean[], mode: number) => (mode === 1 || mode === 3 ? flags.indexOf(true) : 0);
  const trailing = (flags: boolean[], mode: number) => (mode === 2 || mode === 3 ? flags.lastIndexOf(true) : flags.length - 1);
  return {
    startRow: leading(rowsUsed, trimRows),
    endRow: trailing(rowsUsed, trimRows),
    startColumn: leading(columnsUsed, trimColumns),
    endColumn: trailing(columnsUsed, trimColumns),
  };
}

class Trimrange extends BaseFunction {
  minParams = 1;
  maxParams = 3;
  needsReferenceObject = true;

  isAddress() {
    return true;
  }

  calculate(range: Variant, trimRows?: Variant, trimColumns?: Variant) {
    if (range == null) return errorOf(ErrorType.VALUE);
    if (!isReference(range)) return range.isError() ? range : errorOf(ErrorType.VALUE);
    const rowsMode = scalarNumber(trimRows, 3);
    if (rowsMode instanceof ErrorValueObject) return rowsMode;
    const columnsMode = scalarNumber(trimColumns, 3);
    if (columnsMode instanceof ErrorValueObject) return columnsMode;
    if (![0, 1, 2, 3].includes(rowsMode) || ![0, 1, 2, 3].includes(columnsMode)) return errorOf(ErrorType.VALUE);
    const position = range.getRangePosition();
    const filled: boolean[][] = [];
    const broken: { error: BaseValueObject | null } = { error: null };
    range.iterator((cell, row, column) => {
      if (cell?.isError() && cell.getValue() === ErrorType.REF) broken.error = cell;
      const r = row - position.startRow;
      filled[r] = filled[r] ?? new Array(position.endColumn - position.startColumn + 1).fill(false);
      filled[r][column - position.startColumn] = cell != null && !cell.isNull();
      return true;
    });
    if (broken.error) return broken.error;
    const bounds = trimBounds(filled, rowsMode, columnsMode);
    if (!bounds) return errorOf(ErrorType.REF);
    return this.createReferenceObject(range, {
      startRow: position.startRow + bounds.startRow,
      endRow: position.startRow + bounds.endRow,
      startColumn: position.startColumn + bounds.startColumn,
      endColumn: position.startColumn + bounds.endColumn,
    });
  }
}

export const EXTRA_FUNCTIONS: Array<[FunctionCtor, IFunctionNames]> = [
  [Amordegrc, 'AMORDEGRC'],
  [Euroconvert, 'EUROCONVERT'],
  [ForecastEts, 'FORECAST.ETS'],
  [ForecastEtsConfint, 'FORECAST.ETS.CONFINT'],
  [ForecastEtsSeasonality, 'FORECAST.ETS.SEASONALITY'],
  [ForecastEtsStat, 'FORECAST.ETS.STAT'],
  [Info, 'INFO'],
  [CeilingPreciseCtor, 'ISO.CEILING'],
  [IsOmitted, 'ISOMITTED'],
  [Jis, 'JIS'],
  [Phonetic, 'PHONETIC'],
  [Trimrange, 'TRIMRANGE'],
];

type Param = [name: string, detail: string, example: string, required: boolean];

function describe(functionName: string, functionType: FunctionType, description: string, params: Param[]): IFunctionInfo {
  return {
    functionName,
    functionType,
    description,
    abstract: description,
    functionParameter: params.map(([name, detail, example, required]) => ({
      name,
      detail,
      example,
      require: required ? 1 : 0,
      repeat: 0,
    })),
  };
}

const ETS_VALUES: Param = ['giá_trị', 'Dãy số liệu lịch sử cần dự báo.', 'B2:B25', true];
const ETS_TIMELINE: Param = ['dòng_thời_gian', 'Dãy ngày hoặc số có bước đều, cùng kích thước với giá_trị.', 'A2:A25', true];
const ETS_SEASONALITY: Param = ['mùa_vụ', '1 hoặc bỏ trống: tự phát hiện; 0: không có mùa vụ; số khác: độ dài một chu kỳ (tối đa 8760).', '1', false];
const ETS_COMPLETION: Param = ['bù_dữ_liệu', '1 hoặc bỏ trống: điểm thiếu lấy trung bình hai điểm lân cận; 0: coi điểm thiếu là 0.', '1', false];
const ETS_AGGREGATION: Param = ['gộp', 'Cách gộp các điểm trùng ngày: 1 TB, 2 COUNT, 3 COUNTA, 4 MAX, 5 MEDIAN, 6 MIN, 7 SUM.', '1', false];
const ETS_TARGET: Param = ['ngày_dự_báo', 'Ngày hoặc mốc thời gian cần dự báo, không được trước điểm cuối của dòng thời gian.', 'A26', true];

export const EXTRA_FUNCTION_DESCRIPTIONS: IFunctionInfo[] = [
  describe('AMORDEGRC', FunctionType.Financial, 'Khấu hao của tài sản trong từng kỳ kế toán theo phương pháp giảm dần có hệ số (kế toán Pháp).', [
    ['chi_phí', 'Nguyên giá tài sản.', '2400', true],
    ['ngày_mua', 'Ngày mua tài sản.', 'DATE(2008,8,19)', true],
    ['kỳ_đầu', 'Ngày kết thúc kỳ đầu tiên.', 'DATE(2008,12,31)', true],
    ['giá_trị_thu_hồi', 'Giá trị còn lại khi hết đời sử dụng.', '300', true],
    ['kỳ', 'Kỳ cần tính khấu hao.', '1', true],
    ['tỷ_lệ', 'Tỷ lệ khấu hao.', '15%', true],
    ['cơ_sở', '0 hoặc bỏ trống: 360 ngày (NASD); 1: thực tế; 3: 365 ngày; 4: 360 ngày (châu Âu).', '1', false],
  ]),
  describe('EUROCONVERT', FunctionType.Financial, 'Đổi một số tiền giữa đồng euro và đồng tiền cũ của các nước khu vực euro theo tỷ giá cố định của EU.', [
    ['số', 'Số tiền cần đổi.', '1.20', true],
    ['nguồn', 'Mã ISO ba chữ của đồng tiền gốc, ví dụ DEM, FRF, ITL, EUR.', '"DEM"', true],
    ['đích', 'Mã ISO ba chữ của đồng tiền cần đổi sang.', '"EUR"', true],
    ['đủ_độ_chính_xác', 'TRUE: giữ mọi chữ số; FALSE hoặc bỏ trống: làm tròn theo quy định của đồng tiền đích.', 'FALSE', false],
    ['độ_chính_xác_tam_giác', 'Số chữ số thập phân (từ 3 trở lên) của giá trị euro trung gian khi đổi giữa hai đồng tiền thành viên.', '3', false],
  ]),
  describe('FORECAST.ETS', FunctionType.Statistical, 'Dự báo giá trị tương lai bằng làm trơn hàm mũ ba lần (AAA), có xét xu hướng và mùa vụ.', [
    ETS_TARGET,
    ETS_VALUES,
    ETS_TIMELINE,
    ETS_SEASONALITY,
    ETS_COMPLETION,
    ETS_AGGREGATION,
  ]),
  describe('FORECAST.ETS.CONFINT', FunctionType.Statistical, 'Bán kính khoảng tin cậy quanh giá trị FORECAST.ETS tại ngày dự báo.', [
    ETS_TARGET,
    ETS_VALUES,
    ETS_TIMELINE,
    ['độ_tin_cậy', 'Mức tin cậy từ 0 đến 1, mặc định 0,95.', '0.95', false],
    ETS_SEASONALITY,
    ETS_COMPLETION,
    ETS_AGGREGATION,
  ]),
  describe('FORECAST.ETS.SEASONALITY', FunctionType.Statistical, 'Độ dài chu kỳ mùa vụ mà FORECAST.ETS tự phát hiện; 0 nếu không có mùa vụ.', [
    ETS_VALUES,
    ETS_TIMELINE,
    ETS_COMPLETION,
    ETS_AGGREGATION,
  ]),
  describe('FORECAST.ETS.STAT', FunctionType.Statistical, 'Chỉ số thống kê của mô hình FORECAST.ETS.', [
    ETS_VALUES,
    ETS_TIMELINE,
    ['loại_chỉ_số', '1 alpha, 2 beta, 3 gamma, 4 MASE, 5 SMAPE, 6 MAE, 7 RMSE, 8 bước thời gian.', '1', true],
    ETS_SEASONALITY,
    ETS_COMPLETION,
    ETS_AGGREGATION,
  ]),
  describe('INFO', FunctionType.Information, 'Thông tin về môi trường làm việc: numfile, origin, osversion, recalc, release, system.', [
    ['loại_thông_tin', 'Văn bản chỉ loại thông tin cần lấy.', '"numfile"', true],
  ]),
  describe('ISO.CEILING', FunctionType.Math, 'Làm tròn lên tới số nguyên hoặc bội số gần nhất, không phụ thuộc dấu của số.', [
    ['số', 'Giá trị cần làm tròn.', '4.3', true],
    ['bội_số', 'Bội số dùng để làm tròn, mặc định 1.', '2', false],
  ]),
  describe('ISOMITTED', FunctionType.Information, 'Kiểm tra tham số của LAMBDA có bị bỏ trống không; trả về TRUE hoặc FALSE.', [
    ['tham_số', 'Tham số LAMBDA cần kiểm tra.', 'y', true],
  ]),
  describe('JIS', FunctionType.Text, 'Đổi chữ cái, chữ số và katakana nửa độ rộng thành ký tự toàn độ rộng.', [
    ['văn_bản', 'Văn bản hoặc ô cần đổi.', '"Excel 365"', true],
  ]),
  describe('PHONETIC', FunctionType.Text, 'Lấy chuỗi phiên âm (furigana) của ô; ô không có phiên âm thì trả về nội dung chữ của ô.', [
    ['tham_chiếu', 'Ô hoặc vùng; với vùng, lấy ô góc trên bên trái.', 'A1', true],
  ]),
  describe('TRIMRANGE', FunctionType.Lookup, 'Cắt bỏ các hàng và cột trống ở mép ngoài của vùng, trả về vùng chỉ chứa dữ liệu.', [
    ['vùng', 'Vùng cần cắt.', 'A:C', true],
    ['cắt_hàng', '0 không cắt; 1 cắt hàng trống đầu; 2 cắt hàng trống cuối; 3 hoặc bỏ trống: cắt cả hai.', '3', false],
    ['cắt_cột', '0 không cắt; 1 cắt cột trống đầu; 2 cắt cột trống cuối; 3 hoặc bỏ trống: cắt cả hai.', '3', false],
  ]),
];
