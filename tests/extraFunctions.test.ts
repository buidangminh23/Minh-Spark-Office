import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ArrayValueObject,
  NullValueObject,
  NumberValueObject,
  StringValueObject,
  type BaseFunction,
  type BaseValueObject,
} from '@univerjs/engine-formula';
import {
  EXTRA_FUNCTIONS,
  EXTRA_FUNCTION_DESCRIPTIONS,
  amordegrcCoefficient,
  euroConvert,
  infoText,
  toFullWidth,
  trimBounds,
} from '../src/editors/sheet/extraFunctions';
import { detectSeasonality, normSInv } from '../src/editors/sheet/forecastEts';

const EXPECTED_NAMES = [
  'AMORDEGRC',
  'EUROCONVERT',
  'FORECAST.ETS',
  'FORECAST.ETS.CONFINT',
  'FORECAST.ETS.SEASONALITY',
  'FORECAST.ETS.STAT',
  'INFO',
  'ISO.CEILING',
  'ISOMITTED',
  'JIS',
  'PHONETIC',
  'TRIMRANGE',
];

function fn(name: string): BaseFunction {
  const entry = EXTRA_FUNCTIONS.find(([, functionName]) => functionName === name);
  assert.ok(entry, `${name} is registered`);
  return new entry[0](name);
}

const num = (value: number) => NumberValueObject.create(value);
const column = (values: Array<number | null>) => ArrayValueObject.createByArray(values.map((value) => [value]));
const valueOf = (result: unknown) => (result as BaseValueObject).getValue();
const call = (name: string, ...args: unknown[]) => valueOf(fn(name).calculate(...(args as BaseValueObject[])));

test('all twelve missing Excel functions are registered with Vietnamese descriptions', () => {
  assert.deepEqual(EXTRA_FUNCTIONS.map(([, name]) => name), EXPECTED_NAMES);
  assert.deepEqual(EXTRA_FUNCTION_DESCRIPTIONS.map((item) => item.functionName), EXPECTED_NAMES);
  for (const item of EXTRA_FUNCTION_DESCRIPTIONS) {
    assert.ok(item.description.length > 20, `${item.functionName} has a description`);
    assert.ok(item.functionParameter.length > 0, `${item.functionName} lists its arguments`);
  }
});

test('AMORDEGRC matches the Microsoft example', () => {
  const args = [num(2400), num(39679), num(39813), num(300), num(1), num(0.15), num(1)];
  assert.equal(call('AMORDEGRC', ...args), 776);
  const firstPeriod = [...args];
  firstPeriod[4] = num(0);
  assert.equal(call('AMORDEGRC', ...firstPeriod), 330);
  assert.equal(call('AMORDEGRC', num(2400), StringValueObject.create('2008-08-19'), num(39813), num(300), num(1), num(0.15), num(1)), 776);
});

test('AMORDEGRC rejects asset lives Excel rejects and uses the coefficient table', () => {
  assert.equal(amordegrcCoefficient(1 / 0.4), null);
  assert.equal(amordegrcCoefficient(1 / 0.22), null);
  assert.equal(amordegrcCoefficient(4), 1.5);
  assert.equal(amordegrcCoefficient(5), 2);
  assert.equal(amordegrcCoefficient(1 / 0.15), 2.5);
  assert.equal(call('AMORDEGRC', num(2400), num(39679), num(39813), num(300), num(1), num(0.4), num(1)), '#NUM!');
  assert.equal(call('AMORDEGRC', num(2400), num(39679), num(39813), num(300), num(1), num(0.15), num(2)), '#NUM!');
});

test('ISO.CEILING matches the Microsoft examples', () => {
  const cases: Array<[number, number | null, number]> = [
    [4.3, null, 5],
    [-4.3, null, -4],
    [4.3, 2, 6],
    [4.3, -2, 6],
    [-4.3, 2, -4],
    [-4.3, -2, -4],
  ];
  for (const [value, significance, expected] of cases) {
    const args = significance === null ? [num(value)] : [num(value), num(significance)];
    assert.equal(call('ISO.CEILING', ...args), expected, `ISO.CEILING(${value}, ${significance})`);
  }
});

test('JIS converts half-width letters, digits, spaces and katakana to full width', () => {
  assert.equal(toFullWidth('Excel 365'), 'Ｅｘｃｅｌ　３６５');
  assert.equal(toFullWidth('ｶﾞｷﾞｸﾞ ﾊﾟﾝ'), 'ガギグ　パン');
  assert.equal(toFullWidth('Tiếng Việt'), 'Ｔｉếｎｇ　Ｖｉệｔ');
  assert.equal(call('JIS', StringValueObject.create('abc')), 'ａｂｃ');
  assert.equal(call('JIS', num(123)), '１２３');
});

test('INFO returns the documented values and errors', () => {
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)';
  assert.equal(infoText('numfile', 3, windows), '3');
  assert.equal(infoText('SYSTEM', 1, windows), 'pcdos');
  assert.equal(infoText('system', 1, mac), 'mac');
  assert.equal(infoText('recalc', 1, windows), 'Automatic');
  assert.equal(infoText('release', 1, windows), '16.0');
  assert.equal(infoText('origin', 1, windows), '$A:$A$1');
  assert.equal(infoText('memavail', 1, windows), '#N/A');
  assert.equal(infoText('nonsense', 1, windows), '#VALUE!');
});

test('ISOMITTED is true only for a missing argument', () => {
  assert.equal(call('ISOMITTED', NullValueObject.create()), true);
  assert.equal(call('ISOMITTED', num(0)), false);
  assert.equal(call('ISOMITTED', StringValueObject.create('')), false);
});

test('PHONETIC returns the text of a value when no furigana exists', () => {
  assert.equal(call('PHONETIC', StringValueObject.create('東京都')), '東京都');
  assert.equal(call('PHONETIC', NullValueObject.create()), '');
});

test('TRIMRANGE bounds drop only blank outer rows and columns', () => {
  const filled = [
    [false, false, false, false],
    [false, true, false, false],
    [false, false, true, false],
    [false, false, false, false],
  ];
  assert.deepEqual(trimBounds(filled, 3, 3), { startRow: 1, endRow: 2, startColumn: 1, endColumn: 2 });
  assert.deepEqual(trimBounds(filled, 1, 0), { startRow: 1, endRow: 3, startColumn: 0, endColumn: 3 });
  assert.deepEqual(trimBounds(filled, 2, 2), { startRow: 0, endRow: 2, startColumn: 0, endColumn: 2 });
  assert.equal(trimBounds([[false, false]], 3, 3), null);
});

const SEASON = [5, -3, 8, -10];
const seasonalValues = (count: number) => Array.from({ length: count }, (_, t) => 50 + 3 * t + SEASON[t % 4]);
const days = (count: number, start = 45000) => Array.from({ length: count }, (_, i) => start + i);

test('FORECAST.ETS finds a 4-step season and forecasts a clean seasonal series exactly', () => {
  const values = seasonalValues(24);
  assert.equal(detectSeasonality(values), 4);
  assert.equal(call('FORECAST.ETS.SEASONALITY', column(values), column(days(24))), 4);
  const forecast = call('FORECAST.ETS', num(45000 + 25), column(values), column(days(24))) as number;
  assert.ok(Math.abs(forecast - (50 + 3 * 25 + SEASON[25 % 4])) < 1e-6, `forecast ${forecast}`);
  const targets = column([45024, 45026]);
  const spilled = fn('FORECAST.ETS').calculate(targets, column(values), column(days(24))) as ArrayValueObject;
  assert.ok(Math.abs(Number(spilled.get(1, 0)?.getValue()) - (50 + 3 * 26 + SEASON[26 % 4])) < 1e-6);
});

test('FORECAST.ETS handles a linear trend without seasonality and fills missing points', () => {
  const values: Array<number | null> = Array.from({ length: 12 }, (_, i) => 10 + 2 * i);
  assert.equal(call('FORECAST.ETS.SEASONALITY', column(values), column(days(12))), 0);
  values[5] = null;
  const forecast = call('FORECAST.ETS', num(45000 + 14), column(values), column(days(12)), num(0)) as number;
  assert.ok(Math.abs(forecast - (10 + 2 * 14)) < 1e-6, `forecast ${forecast}`);
  assert.equal(call('FORECAST.ETS.STAT', column(values), column(days(12)), num(8), num(0)), 1);
});

test('FORECAST.ETS understands monthly timelines', () => {
  const months = Array.from({ length: 18 }, (_, i) => Date.UTC(2025, i, 1) / 86400000 + 25569);
  const values = months.map((_, i) => 100 + 5 * i);
  const target = Date.UTC(2025, 18, 1) / 86400000 + 25569;
  const forecast = call('FORECAST.ETS', num(target), column(values), column(months), num(0)) as number;
  assert.ok(Math.abs(forecast - (100 + 5 * 18)) < 1e-6, `forecast ${forecast}`);
});

test('FORECAST.ETS reports Excel errors', () => {
  const values = seasonalValues(12);
  assert.equal(call('FORECAST.ETS', num(45000 + 5), column(values), column(days(12))), '#NUM!');
  assert.equal(call('FORECAST.ETS', num(45020), column(values), column(days(11))), '#N/A');
  assert.equal(call('FORECAST.ETS', num(45020), column(values), column(days(12)), num(9000)), '#NUM!');
  assert.equal(call('FORECAST.ETS', num(45020), column(values), column(days(12)), num(1), num(3)), '#NUM!');
  assert.equal(call('FORECAST.ETS', num(45020), column(values), column(days(12)), num(1), num(1), num(8)), '#NUM!');
  assert.equal(call('FORECAST.ETS.STAT', column(values), column(days(12)), num(9)), '#NUM!');
  assert.equal(call('FORECAST.ETS.CONFINT', num(45020), column(values), column(days(12)), num(1.5)), '#NUM!');
});

test('FORECAST.ETS.CONFINT widens with the horizon on noisy data', () => {
  const noise = [3, -2, 4, -1, 2, -4, 1, 0, -3, 2, -1, 3, -2, 1, 4, -3, 0, 2, -1, -2];
  const values = noise.map((value, i) => 40 + 1.5 * i + value);
  const near = call('FORECAST.ETS.CONFINT', num(45020), column(values), column(days(20)), num(0.95), num(0)) as number;
  const far = call('FORECAST.ETS.CONFINT', num(45030), column(values), column(days(20)), num(0.95), num(0)) as number;
  assert.ok(near > 0, `near ${near}`);
  assert.ok(far > near, `far ${far} > near ${near}`);
  const alpha = call('FORECAST.ETS.STAT', column(values), column(days(20)), num(1), num(0)) as number;
  assert.ok(alpha >= 0 && alpha <= 1);
});

test('normSInv matches known quantiles', () => {
  assert.ok(Math.abs(normSInv(0.975) - 1.959963984540054) < 1e-8);
  assert.ok(Math.abs(normSInv(0.5)) < 1e-12);
  assert.ok(Math.abs(normSInv(0.01) + 2.3263478740408408) < 1e-8);
});

test('EUROCONVERT matches the Microsoft examples', () => {
  assert.equal(euroConvert(1.2, 'DEM', 'EUR', false, null), 0.61);
  assert.equal(euroConvert(1, 'FRF', 'EUR', true, 3), 0.152);
  assert.equal(euroConvert(1, 'FRF', 'DEM', false, 3), 0.3);
  assert.ok(Math.abs((euroConvert(1, 'FRF', 'DEM', true, 3) as number) - 0.29728616) < 1e-8);
  assert.equal(euroConvert(5, 'EUR', 'eur', false, null), 5);
  assert.equal(euroConvert(1, 'USD', 'EUR', false, null), null);
  assert.equal(euroConvert(1, 'FRF', 'DEM', false, 2), null);
  assert.equal(call('EUROCONVERT', num(1.2), StringValueObject.create('DEM'), StringValueObject.create('EUR')), 0.61);
});
