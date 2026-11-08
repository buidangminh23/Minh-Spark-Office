export type EtsErrorCode = '#N/A' | '#NUM!' | '#VALUE!' | '#DIV/0!';

export type EtsAggregation = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface EtsOptions {
  seasonality: number;
  dataCompletion: 0 | 1;
  aggregation: EtsAggregation;
}

export interface EtsSeries {
  values: number[];
  start: number;
  step: number;
  monthly: boolean;
  anchorDay: number;
  monthEnd: boolean;
}

export interface EtsModel {
  series: EtsSeries;
  season: number;
  alpha: number;
  beta: number;
  gamma: number;
  level: number;
  trend: number;
  seasonal: number[];
  errors: number[];
  fitted: number[];
  actual: number[];
}

export type EtsResult<T> = { ok: true; value: T } | { ok: false; error: EtsErrorCode };

export const MAX_ETS_SEASONALITY = 8760;

const EPSILON = 1e-9;
const MS_PER_DAY = 86400000;
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

const fail = <T>(error: EtsErrorCode): EtsResult<T> => ({ ok: false, error });
const done = <T>(value: T): EtsResult<T> => ({ ok: true, value });

function serialToDate(serial: number): Date {
  return new Date(EXCEL_EPOCH_MS + Math.floor(serial) * MS_PER_DAY);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function aggregate(values: number[], aggregation: EtsAggregation): number {
  switch (aggregation) {
    case 2:
    case 3:
      return values.length;
    case 4:
      return Math.max(...values);
    case 5: {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case 6:
      return Math.min(...values);
    case 7:
      return values.reduce((sum, value) => sum + value, 0);
    default:
      return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}

function isNearInteger(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 1e-6;
}

function constantStep(positions: number[]): number | null {
  let step = Infinity;
  for (let i = 1; i < positions.length; i++) step = Math.min(step, positions[i] - positions[i - 1]);
  if (!(step > EPSILON)) return null;
  for (let i = 1; i < positions.length; i++) {
    if (!isNearInteger((positions[i] - positions[i - 1]) / step)) return null;
  }
  return step;
}

function monthlyPositions(serials: number[]): { positions: number[]; anchorDay: number; monthEnd: boolean } | null {
  if (!serials.every((serial) => isNearInteger(serial) && serial >= 1)) return null;
  const dates = serials.map(serialToDate);
  const days = dates.map((date) => date.getUTCDate());
  const allMonthEnd = dates.every((date) => date.getUTCDate() === daysInMonth(date.getUTCFullYear(), date.getUTCMonth()));
  const sameDay = days.every((day) => day === days[0]);
  if (!allMonthEnd && !sameDay) return null;
  return {
    positions: dates.map((date) => date.getUTCFullYear() * 12 + date.getUTCMonth()),
    anchorDay: days[0],
    monthEnd: allMonthEnd && !sameDay,
  };
}

export function prepareEtsSeries(
  timeline: number[],
  values: Array<number | null>,
  options: Pick<EtsOptions, 'dataCompletion' | 'aggregation'>
): EtsResult<EtsSeries> {
  if (timeline.length !== values.length) return fail('#N/A');
  const groups = new Map<number, number[]>();
  for (let i = 0; i < timeline.length; i++) {
    const x = timeline[i];
    if (!Number.isFinite(x)) return fail('#VALUE!');
    const y = values[i];
    const key = Math.round(x * 1e9) / 1e9;
    const bucket = groups.get(key) ?? [];
    if (y !== null && Number.isFinite(y)) bucket.push(y);
    groups.set(key, bucket);
  }
  const points = [...groups.entries()]
    .filter(([, bucket]) => bucket.length > 0)
    .map(([x, bucket]) => ({ x, y: aggregate(bucket, options.aggregation) }))
    .sort((a, b) => a.x - b.x);
  if (points.length < 3) return fail('#NUM!');

  let positions = points.map((point) => point.x);
  let step = constantStep(positions);
  let monthly = false;
  let anchorDay = 0;
  let monthEnd = false;
  if (step === null) {
    const months = monthlyPositions(positions);
    if (!months) return fail('#NUM!');
    positions = months.positions;
    step = constantStep(positions);
    if (step === null) return fail('#NUM!');
    monthly = true;
    anchorDay = months.anchorDay;
    monthEnd = months.monthEnd;
  }

  const start = positions[0];
  const count = Math.round((positions[positions.length - 1] - start) / step) + 1;
  if (count > 1_000_000) return fail('#NUM!');
  const grid: Array<number | null> = new Array(count).fill(null);
  points.forEach((point, index) => {
    grid[Math.round((positions[index] - start) / step)] = point.y;
  });

  const filled = grid.map((value, index) => {
    if (value !== null) return value;
    if (options.dataCompletion === 0) return 0;
    let before = index - 1;
    while (before >= 0 && grid[before] === null) before--;
    let after = index + 1;
    while (after < count && grid[after] === null) after++;
    const left = grid[before] as number;
    const right = grid[after] as number;
    return left + ((right - left) * (index - before)) / (after - before);
  });

  return done({ values: filled, start, step, monthly, anchorDay, monthEnd });
}

export function positionOf(series: EtsSeries, target: number): number {
  if (!series.monthly) return (target - series.start) / series.step;
  const date = serialToDate(target);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const length = daysInMonth(year, month);
  const anchor = series.monthEnd ? length : Math.min(series.anchorDay, length);
  const fraction = (date.getUTCDate() - anchor + (target - Math.floor(target))) / length;
  return (year * 12 + month + fraction - series.start) / series.step;
}

export function detectSeasonality(values: number[]): number {
  const count = values.length;
  let best = 1;
  let bestError = Infinity;
  for (let period = Math.floor(count / 2); period >= 1; period--) {
    const periods = Math.floor(count / period);
    const first = count - periods * period + 1;
    const denominator = (periods - 1) * period - 1;
    if (denominator <= 0) continue;
    let total = 0;
    for (let i = first; i < count - period; i++) {
      total += Math.abs(values[i] - values[i - 1] - (values[i + period] - values[i + period - 1]));
    }
    const meanError = total / denominator;
    if (meanError <= bestError + EPSILON) {
      best = period;
      bestError = meanError;
    }
  }
  return Math.min(best, MAX_ETS_SEASONALITY);
}

interface FitState {
  sse: number;
  level: number;
  trend: number;
  seasonal: number[];
  errors: number[];
  fitted: number[];
  actual: number[];
}

function runSmoothing(values: number[], season: number, alpha: number, beta: number, gamma: number): FitState {
  const n = values.length;
  let level: number;
  let trend: number;
  let seasonal: number[];
  let first: number;
  if (season > 1) {
    const mean = (offset: number) => {
      let sum = 0;
      for (let i = 0; i < season; i++) sum += values[offset + i];
      return sum / season;
    };
    const firstMean = mean(0);
    trend = (mean(season) - firstMean) / season;
    level = firstMean + (trend * (season - 1)) / 2;
    seasonal = [];
    for (let i = 0; i < season; i++) seasonal.push(values[i] - (firstMean + trend * (i - (season - 1) / 2)));
    first = season;
  } else {
    level = values[0];
    trend = values[1] - values[0];
    seasonal = [0];
    first = 1;
  }
  const errors: number[] = [];
  const fitted: number[] = [];
  const actual: number[] = [];
  let sse = 0;
  for (let t = first; t < n; t++) {
    const slot = season > 1 ? t % season : 0;
    const forecast = level + trend + seasonal[slot];
    const error = values[t] - forecast;
    errors.push(error);
    fitted.push(forecast);
    actual.push(values[t]);
    sse += error * error;
    const previousLevel = level;
    level = alpha * (values[t] - seasonal[slot]) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    if (season > 1) seasonal[slot] = gamma * (values[t] - level) + (1 - gamma) * seasonal[slot];
  }
  return { sse, level, trend, seasonal, errors, fitted, actual };
}

function optimizeParameters(values: number[], season: number): [number, number, number] {
  const seasonalModel = season > 1;
  const grid = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  let best: [number, number, number] = [0.5, 0.1, seasonalModel ? 0.1 : 0];
  let bestSse = Infinity;
  for (const alpha of grid) {
    for (const beta of grid) {
      for (const gamma of seasonalModel ? grid : [0]) {
        const { sse } = runSmoothing(values, season, alpha, beta, gamma);
        if (sse < bestSse - EPSILON) {
          bestSse = sse;
          best = [alpha, beta, gamma];
        }
      }
    }
  }
  const dimensions = seasonalModel ? 3 : 2;
  let stepSize = 0.05;
  while (stepSize > 1e-5) {
    let improved = false;
    for (let d = 0; d < dimensions; d++) {
      for (const direction of [1, -1]) {
        const candidate: [number, number, number] = [...best];
        candidate[d] = Math.min(1, Math.max(0, candidate[d] + direction * stepSize));
        if (candidate[d] === best[d]) continue;
        const { sse } = runSmoothing(values, season, ...candidate);
        if (sse < bestSse - EPSILON) {
          bestSse = sse;
          best = candidate;
          improved = true;
        }
      }
    }
    if (!improved) stepSize /= 2;
  }
  return best;
}

export function fitEtsModel(series: EtsSeries, seasonality: number): EtsResult<EtsModel> {
  const values = series.values;
  let season = seasonality === 1 ? detectSeasonality(values) : seasonality === 0 ? 1 : seasonality;
  if (season > 1 && values.length < 2 * season) {
    if (seasonality !== 1) return fail('#NUM!');
    season = 1;
  }
  const [alpha, beta, gamma] = optimizeParameters(values, season);
  const state = runSmoothing(values, season, alpha, beta, gamma);
  return done({
    series,
    season,
    alpha,
    beta,
    gamma: season > 1 ? gamma : 0,
    level: state.level,
    trend: state.trend,
    seasonal: state.seasonal,
    errors: state.errors,
    fitted: state.fitted,
    actual: state.actual,
  });
}

function forecastSteps(model: EtsModel, steps: number): number {
  const last = model.series.values.length - 1;
  const slot = model.season > 1 ? (last + steps) % model.season : 0;
  return model.level + steps * model.trend + model.seasonal[slot];
}

function interpolate(horizon: number, at: (steps: number) => number): number {
  const lower = Math.floor(horizon + EPSILON);
  if (Math.abs(horizon - lower) < EPSILON) return at(lower);
  const upper = lower + 1;
  return at(lower) + (at(upper) - at(lower)) * (horizon - lower);
}

export function horizonOf(model: EtsModel, target: number): EtsResult<number> {
  const horizon = positionOf(model.series, target) - (model.series.values.length - 1);
  if (horizon < -EPSILON) return fail('#NUM!');
  return done(Math.max(0, horizon));
}

export function etsForecast(model: EtsModel, target: number): EtsResult<number> {
  const horizon = horizonOf(model, target);
  if (!horizon.ok) return horizon;
  return done(interpolate(horizon.value, (steps) => forecastSteps(model, steps)));
}

export function etsRmse(model: EtsModel): number {
  if (!model.errors.length) return 0;
  return Math.sqrt(model.errors.reduce((sum, error) => sum + error * error, 0) / model.errors.length);
}

export function normSInv(probability: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  let x: number;
  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (probability <= 1 - low) {
    const q = probability - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return x;
}

export function etsConfidenceInterval(model: EtsModel, target: number, confidence: number): EtsResult<number> {
  if (!(confidence > 0 && confidence < 1)) return fail('#NUM!');
  const horizon = horizonOf(model, target);
  if (!horizon.ok) return horizon;
  const z = normSInv((1 + confidence) / 2);
  const sigma = etsRmse(model);
  const levelGain = model.alpha;
  const trendGain = model.alpha * model.beta;
  const seasonGain = (1 - model.alpha) * model.gamma;
  const width = (steps: number) => {
    const h = Math.max(1, steps);
    let variance = 1;
    for (let j = 1; j < h; j++) {
      const seasonal = model.season > 1 && j % model.season === 0 ? seasonGain : 0;
      const gain = levelGain + j * trendGain + seasonal;
      variance += gain * gain;
    }
    return z * sigma * Math.sqrt(variance);
  };
  return done(interpolate(horizon.value, width));
}

export function etsStatistic(model: EtsModel, statisticType: number): EtsResult<number> {
  const { errors, fitted, actual } = model;
  const meanOf = (items: number[]) => (items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : 0);
  switch (statisticType) {
    case 1:
      return done(model.alpha);
    case 2:
      return done(model.beta);
    case 3:
      return done(model.gamma);
    case 4: {
      const naive: number[] = [];
      const values = model.series.values;
      for (let i = 1; i < values.length; i++) naive.push(Math.abs(values[i] - values[i - 1]));
      const scale = meanOf(naive);
      if (scale === 0) return fail('#DIV/0!');
      return done(meanOf(errors.map(Math.abs)) / scale);
    }
    case 5: {
      const terms: number[] = [];
      for (let i = 0; i < errors.length; i++) {
        const denominator = Math.abs(actual[i]) + Math.abs(fitted[i]);
        if (denominator > 0) terms.push((2 * Math.abs(errors[i])) / denominator);
      }
      return done(meanOf(terms));
    }
    case 6:
      return done(meanOf(errors.map(Math.abs)));
    case 7:
      return done(etsRmse(model));
    case 8:
      return done(model.series.step);
    default:
      return fail('#NUM!');
  }
}

export function validateEtsOptions(seasonality: number, dataCompletion: number, aggregation: number): EtsResult<EtsOptions> {
  if (!Number.isFinite(seasonality) || !Number.isFinite(dataCompletion) || !Number.isFinite(aggregation)) return fail('#VALUE!');
  const season = Math.trunc(seasonality);
  const completion = Math.trunc(dataCompletion);
  const aggregationCode = Math.trunc(aggregation);
  if (season < 0 || season > MAX_ETS_SEASONALITY) return fail('#NUM!');
  if (completion !== 0 && completion !== 1) return fail('#NUM!');
  if (aggregationCode < 1 || aggregationCode > 7) return fail('#NUM!');
  return done({ seasonality: season, dataCompletion: completion as 0 | 1, aggregation: aggregationCode as EtsAggregation });
}

export function buildEtsModel(
  timeline: number[],
  values: Array<number | null>,
  options: EtsOptions
): EtsResult<EtsModel> {
  const series = prepareEtsSeries(timeline, values, options);
  if (!series.ok) return series;
  return fitEtsModel(series.value, options.seasonality);
}
