export type MarketCategory = 'index' | 'stock' | 'crypto' | 'forex' | 'gold';

export type MarketQuote = {
  id: string;
  category: MarketCategory;
  symbol: string;
  name: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  unit: string;
  source: string;
  asOf: string | null;
};

export type MarketSnapshot = { updatedAt: string; quotes: MarketQuote[]; errors: { source: string; message: string }[] };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export const DEFAULT_STOCKS = ['FPT', 'VNM', 'VIC', 'HPG', 'MWG', 'SSI', 'VCB', 'TCB', 'ACB', 'MBB'];
const INDICES: [string, string][] = [['VNINDEX', 'VN-Index (HOSE)'], ['VN30', 'VN30'], ['HNXIndex', 'HNX-Index']];
const COINS: [string, string, string][] = [['bitcoin', 'BTC', 'Bitcoin'], ['ethereum', 'ETH', 'Ethereum'], ['solana', 'SOL', 'Solana'], ['binancecoin', 'BNB', 'BNB']];
const CURRENCIES: [string, string][] = [['USD', 'Đô la Mỹ'], ['EUR', 'Euro'], ['JPY', 'Yên Nhật'], ['GBP', 'Bảng Anh'], ['CNY', 'Nhân dân tệ'], ['AUD', 'Đô la Úc']];
const GOLD: [string, string][] = [['SJC', 'Vàng miếng SJC 999.9'], ['N24K', 'Nhẫn trơn 999.9 (PNJ)']];
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; MinhSparkOffice/1.0; +https://office.minhspark.com)', Accept: 'application/json, text/xml, */*' };
const TIMEOUT_MS = 8000;

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export function normalizeSymbols(raw: string | null): string[] {
  const list = (raw ?? '').split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9]{3,5}$/.test(s));
  return [...new Set(list.length ? list : DEFAULT_STOCKS)].slice(0, 20);
}

async function getJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const response = await fetcher(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

type SsiIndex = { data?: { indexValue?: number; prevIndexValue?: number; change?: number; changePercent?: number; time?: number } };
type SsiStock = { data?: { stockSymbol?: string; companyNameVi?: string; matchedPrice?: number; refPrice?: number; priceChange?: number; priceChangePercent?: number; tradingDate?: string } };

export async function fetchIndices(fetcher: Fetcher): Promise<MarketQuote[]> {
  const rows = await Promise.all(INDICES.map(async ([code, name]): Promise<MarketQuote | null> => {
    const { data } = await getJson<SsiIndex>(fetcher, `https://iboard-query.ssi.com.vn/exchange-index/${code}`);
    if (!data || typeof data.indexValue !== 'number') return null;
    return { id: `idx-${code}`, category: 'index' as const, symbol: code === 'HNXIndex' ? 'HNX-INDEX' : code === 'VNINDEX' ? 'VN-INDEX' : code, name, price: data.indexValue, change: data.change ?? null, changePercent: data.changePercent ?? null, unit: 'Điểm', source: 'SSI iBoard', asOf: data.time ? new Date(data.time).toISOString() : null };
  }));
  return rows.filter((r): r is MarketQuote => r !== null);
}

export async function fetchStocks(fetcher: Fetcher, symbols: string[]): Promise<MarketQuote[]> {
  const rows = await Promise.allSettled(symbols.map(async (sym): Promise<MarketQuote | null> => {
    const { data } = await getJson<SsiStock>(fetcher, `https://iboard-query.ssi.com.vn/stock/${sym}`);
    if (!data?.stockSymbol) return null;
    const price = data.matchedPrice || data.refPrice || 0;
    if (!price) return null;
    const date = data.tradingDate && /^\d{8}$/.test(data.tradingDate) ? `${data.tradingDate.slice(0, 4)}-${data.tradingDate.slice(4, 6)}-${data.tradingDate.slice(6, 8)}` : null;
    return { id: `stk-${sym}`, category: 'stock' as const, symbol: data.stockSymbol, name: data.companyNameVi ?? sym, price, change: data.priceChange ?? (data.refPrice ? price - data.refPrice : null), changePercent: data.priceChangePercent ?? null, unit: 'VND', source: 'SSI iBoard', asOf: date };
  }));
  const quotes = rows.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
  if (!quotes.length) throw new Error('Không lấy được mã cổ phiếu nào');
  return quotes;
}

type Gecko = Record<string, { usd?: number; usd_24h_change?: number; last_updated_at?: number }>;

export async function fetchCrypto(fetcher: Fetcher): Promise<MarketQuote[]> {
  const ids = COINS.map(([id]) => id).join(',');
  const data = await getJson<Gecko>(fetcher, `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`);
  return COINS.flatMap(([id, symbol, name]) => {
    const row = data[id];
    if (!row || typeof row.usd !== 'number') return [];
    const pctChange = row.usd_24h_change ?? null;
    const change = pctChange === null ? null : row.usd - row.usd / (1 + pctChange / 100);
    return [{ id: `cry-${symbol}`, category: 'crypto' as const, symbol: `${symbol}/USD`, name, price: row.usd, change: change === null ? null : round(change), changePercent: pctChange === null ? null : round(pctChange), unit: 'USD', source: 'CoinGecko', asOf: row.last_updated_at ? new Date(row.last_updated_at * 1000).toISOString() : null }];
  });
}

export function parseVcbRates(xml: string): { code: string; buy: number | null; transfer: number | null; sell: number | null }[] {
  const toNum = (v: string | undefined) => {
    const n = Number((v ?? '').replace(/,/g, '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return [...xml.matchAll(/<Exrate\s+([^>]+?)\/>/g)].map((m) => {
    const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(m[1])?.[1];
    return { code: (attr('CurrencyCode') ?? '').trim(), buy: toNum(attr('Buy')), transfer: toNum(attr('Transfer')), sell: toNum(attr('Sell')) };
  });
}

export async function fetchForex(fetcher: Fetcher): Promise<MarketQuote[]> {
  try {
    const response = await fetcher('https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx', { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    const stamp = /<DateTime>([^<]+)<\/DateTime>/.exec(xml)?.[1] ?? null;
    const rates = parseVcbRates(xml);
    const quotes = CURRENCIES.flatMap(([code, name]) => {
      const r = rates.find((x) => x.code === code);
      const price = r?.sell ?? r?.transfer;
      return price ? [{ id: `fx-${code}`, category: 'forex' as const, symbol: `${code}/VND`, name: `${name} (bán ra, mua CK ${r?.transfer?.toLocaleString('vi-VN') ?? '-'})`, price, change: null, changePercent: null, unit: 'VND', source: 'Vietcombank', asOf: stamp }] : [];
    });
    if (quotes.length) return quotes;
    throw new Error('Không đọc được bảng tỷ giá');
  } catch {
    const data = await getJson<{ rates?: Record<string, number>; time_last_update_utc?: string }>(fetcher, 'https://open.er-api.com/v6/latest/USD');
    const vnd = data.rates?.VND;
    if (!vnd) throw new Error('Không lấy được tỷ giá');
    return CURRENCIES.flatMap(([code, name]) => {
      const perUsd = data.rates?.[code];
      return perUsd ? [{ id: `fx-${code}`, category: 'forex' as const, symbol: `${code}/VND`, name: `${name} (tỷ giá trung bình)`, price: round(vnd / perUsd, 2), change: null, changePercent: null, unit: 'VND', source: 'ExchangeRate-API', asOf: data.time_last_update_utc ?? null }] : [];
    });
  }
}

type PnjGold = { data?: { masp?: string; tensp?: string; giaban?: number; giamua?: number }[]; chinhanh?: unknown; updateDate?: string };

export async function fetchGold(fetcher: Fetcher): Promise<MarketQuote[]> {
  const data = await getJson<PnjGold>(fetcher, 'https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00');
  return GOLD.flatMap(([code, name]) => {
    const row = data.data?.find((x) => x.masp === code);
    if (!row?.giaban) return [];
    const perTael = row.giaban * 1000 * 10;
    const buy = row.giamua ? row.giamua * 1000 * 10 : null;
    return [{ id: `gold-${code}`, category: 'gold' as const, symbol: code === 'SJC' ? 'VÀNG SJC' : 'NHẪN 999.9', name: `${name}, mua vào ${buy ? buy.toLocaleString('vi-VN') : '-'}`, price: perTael, change: null, changePercent: null, unit: 'VND/lượng (bán ra)', source: 'PNJ', asOf: data.updateDate ?? null }];
  });
}

export async function collectMarket(fetcher: Fetcher, symbols: string[]): Promise<MarketSnapshot> {
  const jobs: [string, Promise<MarketQuote[]>][] = [
    ['Chỉ số (SSI)', fetchIndices(fetcher)],
    ['Cổ phiếu (SSI)', fetchStocks(fetcher, symbols)],
    ['Tiền mã hoá (CoinGecko)', fetchCrypto(fetcher)],
    ['Tỷ giá (Vietcombank)', fetchForex(fetcher)],
    ['Giá vàng (PNJ)', fetchGold(fetcher)],
  ];
  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const quotes: MarketQuote[] = [];
  const errors: MarketSnapshot['errors'] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') quotes.push(...result.value);
    else errors.push({ source: jobs[i][0], message: result.reason instanceof Error ? result.reason.message : 'Lỗi không rõ' });
  });
  return { updatedAt: new Date().toISOString(), quotes, errors };
}
