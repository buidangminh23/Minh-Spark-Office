export type FunctionCategory = { id: string; label: string; functions: string[] };

export const FUNCTION_CATEGORIES: FunctionCategory[] = [
  { id: 'financial', label: 'Tài chính', functions: ['FV', 'PV', 'NPV', 'XNPV', 'PMT', 'IPMT', 'PPMT', 'RATE', 'NPER', 'IRR', 'XIRR', 'MIRR', 'SLN', 'DB', 'DDB', 'SYD', 'VDB', 'EFFECT', 'NOMINAL', 'CUMIPMT', 'CUMPRINC', 'FVSCHEDULE', 'PRICE', 'YIELD', 'ACCRINT'] },
  { id: 'logical', label: 'Logic', functions: ['IF', 'IFS', 'IFERROR', 'IFNA', 'AND', 'OR', 'NOT', 'XOR', 'SWITCH', 'TRUE', 'FALSE', 'LET', 'LAMBDA'] },
  { id: 'text', label: 'Văn bản', functions: ['CONCAT', 'CONCATENATE', 'TEXTJOIN', 'LEFT', 'RIGHT', 'MID', 'LEN', 'FIND', 'SEARCH', 'REPLACE', 'SUBSTITUTE', 'TRIM', 'CLEAN', 'UPPER', 'LOWER', 'PROPER', 'TEXT', 'VALUE', 'REPT', 'EXACT', 'CHAR', 'CODE', 'TEXTBEFORE', 'TEXTAFTER', 'TEXTSPLIT', 'NUMBERVALUE', 'FIXED', 'DOLLAR'] },
  { id: 'datetime', label: 'Ngày & Giờ', functions: ['TODAY', 'NOW', 'DATE', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEKDAY', 'WEEKNUM', 'ISOWEEKNUM', 'EDATE', 'EOMONTH', 'DATEDIF', 'DAYS', 'DAYS360', 'NETWORKDAYS', 'NETWORKDAYS.INTL', 'WORKDAY', 'WORKDAY.INTL', 'YEARFRAC', 'DATEVALUE', 'TIMEVALUE'] },
  { id: 'lookup', label: 'Tra cứu & Tham chiếu', functions: ['XLOOKUP', 'VLOOKUP', 'HLOOKUP', 'LOOKUP', 'INDEX', 'MATCH', 'XMATCH', 'CHOOSE', 'OFFSET', 'INDIRECT', 'ADDRESS', 'ROW', 'ROWS', 'COLUMN', 'COLUMNS', 'TRANSPOSE', 'FILTER', 'SORT', 'SORTBY', 'UNIQUE', 'HYPERLINK', 'VSTACK', 'HSTACK', 'TAKE', 'DROP', 'CHOOSECOLS', 'CHOOSEROWS'] },
  { id: 'math', label: 'Toán & Lượng giác', functions: ['SUM', 'SUMIF', 'SUMIFS', 'SUMPRODUCT', 'SUBTOTAL', 'AGGREGATE', 'PRODUCT', 'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'MROUND', 'CEILING.MATH', 'FLOOR.MATH', 'INT', 'TRUNC', 'MOD', 'ABS', 'SQRT', 'POWER', 'EXP', 'LN', 'LOG', 'LOG10', 'PI', 'RAND', 'RANDBETWEEN', 'RANDARRAY', 'SEQUENCE', 'SIN', 'COS', 'TAN', 'DEGREES', 'RADIANS', 'GCD', 'LCM', 'FACT', 'COMBIN', 'MMULT', 'ROMAN', 'SIGN'] },
  { id: 'statistical', label: 'Thống kê', functions: ['AVERAGE', 'AVERAGEIF', 'AVERAGEIFS', 'COUNT', 'COUNTA', 'COUNTBLANK', 'COUNTIF', 'COUNTIFS', 'MAX', 'MAXIFS', 'MIN', 'MINIFS', 'MEDIAN', 'MODE.SNGL', 'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'LARGE', 'SMALL', 'RANK.EQ', 'PERCENTILE.INC', 'QUARTILE.INC', 'CORREL', 'FORECAST.LINEAR', 'FORECAST.ETS', 'TREND', 'SLOPE', 'INTERCEPT', 'NORM.DIST', 'NORM.INV', 'FREQUENCY'] },
  { id: 'engineering', label: 'Kỹ thuật', functions: ['CONVERT', 'DEC2BIN', 'BIN2DEC', 'DEC2HEX', 'HEX2DEC', 'DEC2OCT', 'OCT2DEC', 'DELTA', 'GESTEP', 'BITAND', 'BITOR', 'BITXOR', 'COMPLEX', 'IMABS', 'IMSUM'] },
  { id: 'information', label: 'Thông tin', functions: ['ISBLANK', 'ISNUMBER', 'ISTEXT', 'ISERROR', 'ISERR', 'ISNA', 'ISLOGICAL', 'ISFORMULA', 'ISEVEN', 'ISODD', 'ISREF', 'N', 'NA', 'TYPE', 'CELL', 'SHEET', 'SHEETS', 'ERROR.TYPE'] },
  { id: 'database', label: 'Cơ sở dữ liệu', functions: ['DSUM', 'DAVERAGE', 'DCOUNT', 'DCOUNTA', 'DMAX', 'DMIN', 'DGET', 'DPRODUCT', 'DSTDEV', 'DVAR'] },
];

export const PRIMARY_CATEGORY_IDS = ['financial', 'logical', 'text', 'datetime', 'lookup', 'math'] as const;
export const MORE_CATEGORY_IDS = ['statistical', 'engineering', 'information', 'database'] as const;

const RECENT_KEY = 'minh-sheets-recent-functions';
const RECENT_LIMIT = 10;

export function readRecentFunctions(storage: Pick<Storage, 'getItem'> = localStorage): string[] {
  try {
    const parsed = JSON.parse(storage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export function rememberFunction(name: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): string[] {
  const next = [name, ...readRecentFunctions(storage).filter((item) => item !== name)].slice(0, RECENT_LIMIT);
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    void 0;
  }
  return next;
}

export function functionsInFormula(formula: string): string[] {
  return [...new Set((formula.toUpperCase().match(/[A-Z][A-Z0-9.]*(?=\()/g) ?? []))];
}
