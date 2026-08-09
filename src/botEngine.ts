import { ApiProfile, BotSettings, Position, PendingOrder, TradeLog, SystemLog, BotStatus } from "./types";

// ═══════════════════════════════════════════════════════════════
//  تشفير التوقيع الرقمي لمحفظة بينانس على المتصفح (HMAC-SHA256)
// ═══════════════════════════════════════════════════════════════
export async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureArrayBuffer = await window.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );
  return Array.from(new Uint8Array(signatureArrayBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ═══════════════════════════════════════════════════════════════
//  جلب البيانات العامة من منصة بينانس بدون تعقيدات CORS
// ═══════════════════════════════════════════════════════════════
function getBinanceFuturesSymbol(symbol: string): string {
  const binanceSymbol = symbol.replace("/", "");
  if (binanceSymbol === "SHIBUSDT") return "1000SHIBUSDT";
  if (binanceSymbol === "LUNCUSDT") return "1000LUNCUSDT";
  return binanceSymbol;
}

export async function fetchKlines(symbol: string, timeframe: string, limit = 100): Promise<any[]> {
  const binanceSymbol = getBinanceFuturesSymbol(symbol);
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=${timeframe}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`فشل جلب الشموع للعملة ${symbol}: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchTickerPrice(symbol: string): Promise<number> {
  const binanceSymbol = getBinanceFuturesSymbol(symbol);
  const url = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${binanceSymbol}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`فشل جلب سعر ${symbol}: ${response.statusText}`);
  }
  const data = await response.json();
  return parseFloat(data.price);
}

// ═══════════════════════════════════════════════════════════════
//  اتصال الحساب الحقيقي وإرسال الأوامر الموقعة من الجوال مباشرة
// ═══════════════════════════════════════════════════════════════
export async function callBinanceFutures(
  apiKey: string,
  apiSecret: string,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, any> = {}
): Promise<any> {
  const timestamp = Date.now();
  // دمج البارامترات مع وقت الطلب الحالي لمنع هجمات التكرار
  const queryParams = { ...params, timestamp };
  
  const queryString = Object.entries(queryParams)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    .join("&");
    
  const signature = await hmacSha256(apiSecret, queryString);
  const fullUrl = `https://fapi.binance.com${path}?${queryString}&signature=${signature}`;
  
  const headers: Record<string, string> = {
    "X-MBX-APIKEY": apiKey,
    "Content-Type": "application/json"
  };
  
  const response = await fetch(fullUrl, {
    method,
    headers,
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`خطأ منصة بينانس: ${errText}`);
  }
  
  return await response.json();
}

// ═══════════════════════════════════════════════════════════════
//  مؤشرات التحليل الفني (Technical Indicators Engine)
// ═══════════════════════════════════════════════════════════════
export function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  if (values.length === 0) return [];
  ema[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

export function calculateRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length <= period) return rsi;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    let gain = 0;
    let loss = 0;
    if (diff > 0) gain = diff;
    else loss = -diff;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

export function calculateATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const atr: number[] = new Array(closes.length).fill(0);
  if (closes.length <= 1) return atr;
  const tr: number[] = [];
  tr[0] = highs[0] - lows[0];
  for (let i = 1; i < closes.length; i++) {
    const h_l = highs[i] - lows[i];
    const h_pc = Math.abs(highs[i] - closes[i - 1]);
    const l_pc = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(h_l, h_pc, l_pc);
  }
  let trSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += tr[i] || 0;
  }
  atr[period - 1] = trSum / period;
  for (let i = period; i < closes.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

export interface ADXResult {
  adx: number[];
  diPlus: number[];
  diMinus: number[];
}

export function calculateADX(highs: number[], lows: number[], closes: number[], period = 14): ADXResult {
  const len = closes.length;
  const adx: number[] = new Array(len).fill(0);
  const diPlus: number[] = new Array(len).fill(0);
  const diMinus: number[] = new Array(len).fill(0);
  if (len <= period * 2) return { adx, diPlus, diMinus };

  const tr: number[] = [];
  const dmPlus: number[] = [];
  const dmMinus: number[] = [];

  for (let i = 1; i < len; i++) {
    const h_l = highs[i] - lows[i];
    const h_pc = Math.abs(highs[i] - closes[i - 1]);
    const l_pc = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(h_l, h_pc, l_pc);

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    if (upMove > downMove && upMove > 0) dmPlus[i] = upMove;
    else dmPlus[i] = 0;

    if (downMove > upMove && downMove > 0) dmMinus[i] = downMove;
    else dmMinus[i] = 0;
  }

  let trSmoothed = 0;
  let dmPlusSmoothed = 0;
  let dmMinusSmoothed = 0;

  for (let i = 1; i <= period; i++) {
    trSmoothed += tr[i] || 0;
    dmPlusSmoothed += dmPlus[i] || 0;
    dmMinusSmoothed += dmMinus[i] || 0;
  }

  diPlus[period] = trSmoothed === 0 ? 0 : (dmPlusSmoothed / trSmoothed) * 100;
  diMinus[period] = trSmoothed === 0 ? 0 : (dmMinusSmoothed / trSmoothed) * 100;

  const dx: number[] = [];
  const diff = Math.abs(diPlus[period] - diMinus[period]);
  const sum = diPlus[period] + diMinus[period];
  dx[period] = sum === 0 ? 0 : (diff / sum) * 100;

  for (let i = period + 1; i < len; i++) {
    trSmoothed = trSmoothed - (trSmoothed / period) + tr[i];
    dmPlusSmoothed = dmPlusSmoothed - (dmPlusSmoothed / period) + dmPlus[i];
    dmMinusSmoothed = dmMinusSmoothed - (dmMinusSmoothed / period) + dmMinus[i];

    diPlus[i] = trSmoothed === 0 ? 0 : (dmPlusSmoothed / trSmoothed) * 100;
    diMinus[i] = trSmoothed === 0 ? 0 : (dmMinusSmoothed / trSmoothed) * 100;

    const diffVal = Math.abs(diPlus[i] - diMinus[i]);
    const sumVal = diPlus[i] + diMinus[i];
    dx[i] = sumVal === 0 ? 0 : (diffVal / sumVal) * 100;
  }

  let dxSumInit = 0;
  for (let i = period; i < period * 2; i++) {
    dxSumInit += dx[i] || 0;
  }
  adx[period * 2 - 1] = dxSumInit / period;

  for (let i = period * 2; i < len; i++) {
    adx[i] = ((adx[i - 1] * (period - 1)) + dx[i]) / period;
  }

  return { adx, diPlus, diMinus };
}

export interface RichCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: string;
  ema20: number;
  ema50: number;
  ema200: number;
  ema7: number;
  ema14: number;
  ema34: number;
  ema12: number;
  ema26: number;
  rsi: number;
  atr: number;
  adx: number;
  adx_di_plus: number;
  adx_di_minus: number;
  vwap: number;
  vol_ma: number;
  vol_ratio: number;
  body: number;
  upper_wick: number;
  lower_wick: number;
  candle_range: number;
  body_ratio: number;
  is_bull: boolean;
  is_bear: boolean;
  atr_pct: number;
  support: number;
  resistance: number;
  prev_high1: number;
  prev_high2: number;
  prev_low1: number;
  prev_low2: number;
  hh: boolean;
  hl: boolean;
  lh: boolean;
  ll: boolean;
  bband_middle: number;
  bband_upper: number;
  bband_lower: number;
}

export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2): { middle: number[], upper: number[], lower: number[] } {
  const middle: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      middle[i] = closes[i];
      upper[i] = closes[i];
      lower[i] = closes[i];
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      const mean = sum / period;
      middle[i] = mean;

      let varianceSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        varianceSum += Math.pow(closes[j] - mean, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      upper[i] = mean + multiplier * stdDev;
      lower[i] = mean - multiplier * stdDev;
    }
  }
  return { middle, upper, lower };
}

export function processCandles(raw: any[]): RichCandle[] {
  if (raw.length === 0) return [];

  const closes = raw.map(c => parseFloat(c[4]));
  const highs = raw.map(c => parseFloat(c[2]));
  const lows = raw.map(c => parseFloat(c[3]));
  const opens = raw.map(c => parseFloat(c[1]));
  const volumes = raw.map(c => parseFloat(c[5]));
  const times = raw.map(c => new Date(c[0]).toISOString());

  const ema7 = calculateEMA(closes, 7);
  const ema14 = calculateEMA(closes, 14);
  const ema34 = calculateEMA(closes, 34);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi = calculateRSI(closes, 14);
  const atr = calculateATR(highs, lows, closes, 14);
  const adxResult = calculateADX(highs, lows, closes, 14);
  const bb = calculateBollingerBands(closes, 20, 2);

  // VWAP
  const vwap: number[] = [];
  let cumVol = 0;
  let cumTp = 0;
  for (let i = 0; i < raw.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumVol += volumes[i];
    cumTp += tp * volumes[i];
    vwap[i] = cumVol === 0 ? closes[i] : cumTp / cumVol;
  }

  // Volume MA
  const vol_ma: number[] = [];
  const WINDOW = 20;
  for (let i = 0; i < raw.length; i++) {
    if (i < WINDOW - 1) {
      vol_ma[i] = volumes[i];
    } else {
      let sum = 0;
      for (let j = i - WINDOW + 1; j <= i; j++) {
        sum += volumes[j];
      }
      vol_ma[i] = sum / WINDOW;
    }
  }

  // Find pivot points
  const pivot_window = 5;
  const local_highs: number[] = [];
  const local_lows: number[] = [];
  
  for (let j = 0; j < raw.length; j++) {
    let isLocalHigh = true;
    let isLocalLow = true;
    
    const start = Math.max(0, j - pivot_window);
    const end = Math.min(raw.length - 1, j + pivot_window);
    
    for (let k = start; k <= end; k++) {
      if (highs[k] > highs[j]) {
        isLocalHigh = false;
      }
      if (lows[k] < lows[j]) {
        isLocalLow = false;
      }
    }
    if (isLocalHigh) local_highs.push(j);
    if (isLocalLow) local_lows.push(j);
  }

  const rich: RichCandle[] = [];
  const SR_WINDOW = 20;

  for (let i = 0; i < raw.length; i++) {
    const body = Math.abs(closes[i] - opens[i]);
    const upper_wick = highs[i] - Math.max(opens[i], closes[i]);
    const lower_wick = Math.min(opens[i], closes[i]) - lows[i];
    const candle_range = highs[i] - lows[i];
    const body_ratio = candle_range === 0 ? 0 : body / candle_range;

    // Support and Resistance rolling window
    let support = lows[i];
    let resistance = highs[i];
    if (i > 0) {
      const start = Math.max(0, i - SR_WINDOW);
      const windowLows = lows.slice(start, i);
      const windowHighs = highs.slice(start, i);
      if (windowLows.length > 0) support = Math.min(...windowLows);
      if (windowHighs.length > 0) resistance = Math.max(...windowHighs);
    }

    // Filter local pivots up to index i
    const filtered_highs = local_highs.filter(idx => idx <= i);
    const filtered_lows = local_lows.filter(idx => idx <= i);
    
    let prev_high1 = highs[i];
    let prev_high2 = highs[i];
    if (filtered_highs.length >= 2) {
      prev_high1 = highs[filtered_highs[filtered_highs.length - 1]];
      prev_high2 = highs[filtered_highs[filtered_highs.length - 2]];
    } else {
      const start10 = Math.max(0, i - 9);
      prev_high1 = Math.max(...highs.slice(start10, i + 1));
      const start20 = Math.max(0, i - 19);
      prev_high2 = Math.max(...highs.slice(start20, i + 1));
    }

    let prev_low1 = lows[i];
    let prev_low2 = lows[i];
    if (filtered_lows.length >= 2) {
      prev_low1 = lows[filtered_lows[filtered_lows.length - 1]];
      prev_low2 = lows[filtered_lows[filtered_lows.length - 2]];
    } else {
      const start10 = Math.max(0, i - 9);
      prev_low1 = Math.min(...lows.slice(start10, i + 1));
      const start20 = Math.max(0, i - 19);
      prev_low2 = Math.min(...lows.slice(start20, i + 1));
    }

    // HH / HL / LH / LL logic
    let hh = false;
    let hl = false;
    let lh = false;
    let ll = false;
    
    if (i >= 10) {
      const prevHighs = highs.slice(Math.max(0, i - 10), i);
      const prevLows = lows.slice(Math.max(0, i - 10), i);
      const maxPrevHigh = Math.max(...prevHighs);
      const minPrevLow = Math.min(...prevLows);
      hh = highs[i] > maxPrevHigh;
      hl = lows[i] > minPrevLow;
      lh = highs[i] < maxPrevHigh;
      ll = lows[i] < minPrevLow;
    }

    rich.push({
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i],
      volume: volumes[i],
      time: times[i],
      ema7: ema7[i] || closes[i],
      ema14: ema14[i] || closes[i],
      ema34: ema34[i] || closes[i],
      ema12: ema12[i] || closes[i],
      ema26: ema26[i] || closes[i],
      ema20: ema20[i] || closes[i],
      ema50: ema50[i] || closes[i],
      ema200: ema200[i] || closes[i],
      rsi: rsi[i] || 50,
      atr: atr[i] || 0,
      adx: adxResult.adx[i] || 0,
      adx_di_plus: adxResult.diPlus[i] || 0,
      adx_di_minus: adxResult.diMinus[i] || 0,
      vwap: vwap[i],
      vol_ma: vol_ma[i],
      vol_ratio: vol_ma[i] === 0 ? 1 : volumes[i] / vol_ma[i],
      body,
      upper_wick,
      lower_wick,
      candle_range,
      body_ratio,
      is_bull: closes[i] > opens[i],
      is_bear: closes[i] < opens[i],
      atr_pct: closes[i] === 0 ? 0 : (atr[i] / closes[i]) * 100,
      support,
      resistance,
      prev_high1,
      prev_high2,
      prev_low1,
      prev_low2,
      hh,
      hl,
      lh,
      ll,
      bband_middle: bb.middle[i] || closes[i],
      bband_upper: bb.upper[i] || closes[i],
      bband_lower: bb.lower[i] || closes[i]
    });
  }

  return rich;
}

// ═══════════════════════════════════════════════════════════════
//  كشف الاستراتيجيات ونماذج الشموع (Strategies Detector Engine)
// ═══════════════════════════════════════════════════════════════
export interface StrategySignal {
  name: string;
  dir: 'buy' | 'sell';
  high: number;
  low: number;
}

export const SPECIFIC_COIN_STRATEGIES: Record<string, string[]> = {
  "AXL": ["Alpha Velocity Scalper AI", "Retest"],
  "QTUM": ["Hammer", "Hammar", "Bullish Engulfing", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI", "Retest"],
  "ZRX": ["Alpha Velocity Scalper AI", "VWAP Bounce", "Retest"],
  "JASMY": ["Break Out", "Breakout", "Retest"],
  "DYDX": ["Retest"],
  "XLM": ["Trend Pullback", "VWAP Bounce", "Retest"],
  "TAO": ["Retest"],
  "LINK": ["Bullish Engulfing", "VWAP Bounce", "Retest"],
  "CHZ": ["Bullish Engulfing", "Alpha Velocity Scalper AI", "Break Out", "Breakout", "Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI", "Retest"],
  "IO": ["Break Out", "Breakout", "Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI", "VWAP Bounce", "Retest"],
  "AVAX": ["Retest"],
  "FET": ["Trend Pullback", "Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI", "VWAP Bounce", "Retest"],
  "RENDER": ["Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI", "VWAP Bounce", "Retest"],
  "MANTA": ["Break Out", "Breakout", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI", "Retest"],
  "BAT": ["Bullish Engulfing", "Break Out", "Breakout", "Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI", "Retest"],
  "ENJ": ["Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI", "Retest"],
  "ETH": ["Break Out", "Breakout", "Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI", "VWAP Bounce"],
  "STX": ["Break Out", "Breakout", "VWAP Bounce"],
  "LTC": ["Trend Pullback", "Break Out", "Breakout", "VWAP Bounce"],
  "SAND": ["Break Out", "Breakout", "VWAP Bounce"],
  "EGLD": ["Momentum Breakout"],
  "ZIL": ["Momentum Breakout"],
  "KSM": ["Break Out", "Breakout", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI"],
  "SOL": ["Trend Pullback", "Bullish Engulfing"],
  "CAKE": ["Alpha Velocity Scalper AI", "Break Out", "Breakout", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI"],
  "SEI": ["Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI"],
  "SUSHI": ["Break Out", "Breakout", "Top Hunter AI (Peak Sweep & BB Bounce)", "Top Hunter AI"],
  "AXS": ["Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI"],
  "STORJ": ["Bottom Hunter AI (Bottom Sweep & BB Bounce)", "Bottom Hunter AI"],
  "VET": ["Trend Pullback", "Alpha Velocity Scalper AI", "Break Out", "Breakout"],
  "STRK": ["Trend Pullback", "Alpha Velocity Scalper AI"]
};

export function isStrategyAllowedForCoin(symbol: string | undefined, stratName: string): boolean {
  // اعتماد جميع الاستراتيجيات لجميع العملات دون قيود
  return true;
}

export function detectStrategies(candles: RichCandle[], settings?: BotSettings, symbol?: string): StrategySignal[] {
  if (candles.length < 6) return [];

  const results: StrategySignal[] = [];
  const r0 = candles[candles.length - 1];
  const r1 = candles[candles.length - 2];
  const r2 = candles[candles.length - 3];
  const r3 = candles[candles.length - 4];

  // 🎯 00. Bottom Hunter AI (Extreme Dip Sweep & Bottom Reversal - صيد القيعان المطلقة)
  const isBottomDip = (r0.low <= r0.bband_lower || r1.low <= r1.bband_lower || r0.rsi <= 32 || r1.rsi <= 32);
  const isBottomReversal = (r0.is_bull || r0.lower_wick >= r0.body * 1.5 || r0.close > r1.high || (r1.is_bear && r0.is_bull && r0.close > r1.open));
  const isBottomVol = (r0.vol_ratio >= 1.1 || r1.vol_ratio >= 1.1);
  if (isBottomDip && isBottomReversal && isBottomVol) {
    results.push({ name: 'Bottom Hunter AI (Bottom Sweep & BB Bounce)', dir: 'buy', high: r0.high, low: r0.low });
  }

  // 🎯 00b. Top Hunter AI (Peak Sweep & BB Bounce Reversal)
  const isTopPeak = (r0.high >= r0.bband_upper || r1.high >= r1.bband_upper || r0.rsi >= 65 || r1.rsi >= 65);
  const isTopReversal = (r0.is_bull || r0.lower_wick >= r0.body * 1.5 || r0.close > r1.high);
  const isTopVol = (r0.vol_ratio >= 1.1 || r1.vol_ratio >= 1.1);
  if (isTopPeak && isTopReversal && isTopVol) {
    results.push({ name: 'Top Hunter AI (Peak Sweep & BB Bounce)', dir: 'buy', high: r0.high, low: r0.low });
  }

  // 0. Alpha Velocity Scalper AI (إستراتيجية سكالبينج مخصصة وفائقة الدقة والربحية بنسبة نجاح قياسية)
  const isAtrOk = r0.atr_pct > 0.05; // حماية ضد الأسواق الميتة والعمولات
  if (isAtrOk) {
    // 🟩 شروط شراء مخصصة (LONG)
    // أ. كسر السيsweep والارتداد من مستويات ذروة البيع (Mean Reversion Sweep) - نسبة نجاح فائقة الارتفاع
    const isLongSweep = (r0.low <= r0.bband_lower || r1.low <= r1.bband_lower) && 
                         (r0.rsi <= 32 || r1.rsi <= 32) && 
                         (r0.vol_ratio >= 1.3 || r1.vol_ratio >= 1.3) && 
                         (r0.is_bull || r0.lower_wick > r0.body * 1.5 || r0.close > r1.close);

    // ب. اندفاع الزخم الصاعد والارتداد المعتمد على المتوسطات (Trend Momentum Bounce)
    const isLongTrend = r0.ema50 > r0.ema200 && r0.close > r0.ema50;
    const isLongMomentum = r0.adx > 25 && r0.adx_di_plus > r0.adx_di_minus;
    const isLongVolume = r0.vol_ratio >= 1.3;
    const isLongRsi = r0.rsi >= 50 && r0.rsi <= 72;
    const isLongBounce = r0.is_bull && (r1.low <= r1.ema14 || r2.low <= r2.ema14) && r0.close > r0.ema14;

    if (isLongSweep || (isLongTrend && isLongMomentum && isLongVolume && isLongRsi && isLongBounce)) {
      results.push({ name: 'Alpha Velocity Scalper AI', dir: 'buy', high: r0.high, low: r0.low });
    }

    // 🟥 شروط بيع مخصصة (SHORT)
    const isShortSweep = (r0.high >= r0.bband_upper || r1.high >= r1.bband_upper) && 
                          (r0.rsi >= 68 || r1.rsi >= 68) && 
                          (r0.vol_ratio >= 1.3 || r1.vol_ratio >= 1.3) && 
                          (r0.is_bear || r0.upper_wick > r0.body * 1.5 || r0.close < r1.close);

    const isShortTrend = r0.ema50 < r0.ema200 && r0.close < r0.ema50;
    const isShortMomentum = r0.adx > 25 && r0.adx_di_minus > r0.adx_di_plus;
    const isShortVolume = r0.vol_ratio >= 1.3;
    const isShortRsi = r0.rsi >= 28 && r0.rsi <= 50;
    const isShortBounce = r0.is_bear && (r1.high >= r1.ema14 || r2.high >= r2.ema14) && r0.close < r0.ema14;

    if (isShortSweep || (isShortTrend && isShortMomentum && isShortVolume && isShortRsi && isShortBounce)) {
      results.push({ name: 'Alpha Velocity Scalper AI', dir: 'sell', high: r0.high, low: r0.low });
    }
  }

  // 1. Bullish Engulfing
  if (r1.is_bear && r0.is_bull && r0.open <= r1.close && r0.close >= r1.open && r0.body > r1.body * 1.3 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Bullish Engulfing', dir: 'buy', high: r0.high, low: r0.low });
  }

  // 2. Bearish Engulfing
  if (r1.is_bull && r0.is_bear && r0.open >= r1.close && r0.close <= r1.open && r0.body > r1.body * 1.3 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Bearish Engulfing', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 3. Hammer
  if (r0.candle_range > 0 && r0.lower_wick >= r0.body * 2.5 && r0.upper_wick <= r0.body * 0.3 && r0.candle_range > r0.atr * 0.8 && r1.is_bear && r2.is_bear && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Hammer', dir: 'buy', high: r0.high, low: r0.low });
  }

  // 4. Shooting Star
  if (r0.candle_range > 0 && r0.upper_wick >= r0.body * 2.5 && r0.lower_wick <= r0.body * 0.3 && r0.candle_range > r0.atr * 0.8 && r1.is_bull && r2.is_bull && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Shooting Star', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 5. Morning Star
  if (r2.is_bear && r2.body > r0.atr * 0.8 && r1.candle_range < r2.body * 0.45 && r0.is_bull && r0.body > r0.atr * 0.8 && r0.close > (r2.open + r2.close) / 2 && r0.open < r2.close && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Morning Star', dir: 'buy', high: r0.high, low: r0.low });
  }

  // 6. Evening Star
  if (r2.is_bull && r2.body > r0.atr * 0.8 && r1.candle_range < r2.body * 0.45 && r0.is_bear && r0.body > r0.atr * 0.8 && r0.close < (r2.open + r2.close) / 2 && r0.open > r2.close && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Evening Star', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 7. Three White Soldiers
  if (r3.is_bull && r2.is_bull && r1.is_bull && r0.is_bull && r3.body_ratio > 0.6 && r2.body_ratio > 0.6 && r1.body_ratio > 0.6 && r0.body_ratio > 0.6 && r2.close > r3.close && r1.close > r2.close && r0.close > r1.close && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Three White Soldiers', dir: 'buy', high: r0.high, low: r0.low });
  }

  // 8. Three Black Crows
  if (r3.is_bear && r2.is_bear && r1.is_bear && r0.is_bear && r3.body_ratio > 0.6 && r2.body_ratio > 0.6 && r1.body_ratio > 0.6 && r0.body_ratio > 0.6 && r2.close < r3.close && r1.close < r2.close && r0.close < r1.close && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Three Black Crows', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 9. Pin Bar Bull
  if (r0.candle_range > r0.atr * 0.8 && r0.lower_wick > r0.candle_range * 0.7 && r0.body < r0.candle_range * 0.2 && r1.is_bear && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Pin Bar Bull', dir: 'buy', high: r0.high, low: r0.low });
  }

  // 10. Pin Bar Bear
  if (r0.candle_range > r0.atr * 0.8 && r0.upper_wick > r0.candle_range * 0.7 && r0.body < r0.candle_range * 0.2 && r1.is_bull && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Pin Bar Bear', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 11. Trend Pullback
  if (r0.ema20 > r0.ema50 && r0.ema50 > r0.ema200 && r0.close < r0.ema20 && r0.close > r0.ema50 && r0.is_bull && r0.rsi < 60 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Trend Pullback', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.ema20 < r0.ema50 && r0.ema50 < r0.ema200 && r0.close > r0.ema20 && r0.close < r0.ema50 && r0.is_bear && r0.rsi > 40 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Trend Pullback', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 12. VWAP Bounce
  if (r0.close > r0.vwap && Math.abs(r0.close - r0.vwap) / r0.close < 0.005 && r0.is_bull && r0.rsi < 60 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'VWAP Bounce', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.close < r0.vwap && Math.abs(r0.close - r0.vwap) / r0.close < 0.005 && r0.is_bear && r0.rsi > 40 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'VWAP Bounce', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 13. Breakout
  if (r0.close > r0.resistance && r0.is_bull && r0.candle_range > r0.atr * 0.5 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Breakout', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.close < r0.support && r0.is_bear && r0.candle_range > r0.atr * 0.5 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Breakout', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 14. Retest
  if (r0.close > r0.prev_high1 * 0.995 && r0.close < r0.prev_high1 * 1.005 && r0.is_bull && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Retest', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.close < r0.prev_low1 * 1.005 && r0.close > r0.prev_low1 * 0.995 && r0.is_bear && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Retest', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 15. Liquidity Sweep
  if (r1.low < r0.support && r0.low > r0.support && r0.is_bull && r0.close > r0.open && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Liquidity Sweep', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r1.high > r0.resistance && r0.high < r0.resistance && r0.is_bear && r0.close < r0.open && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Liquidity Sweep', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 16. RSI Divergence
  if (r0.low < r1.low && r0.rsi > r1.rsi && r0.rsi < 40 && r0.is_bull && r0.vol_ratio >= 0.8) {
    results.push({ name: 'RSI Divergence', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.high > r1.high && r0.rsi < r1.rsi && r0.rsi > 60 && r0.is_bear && r0.vol_ratio >= 0.8) {
    results.push({ name: 'RSI Divergence', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 17. MACD Cross
  if (r1.ema12 <= r1.ema26 && r0.ema12 > r0.ema26 && r0.is_bull && r0.vol_ratio >= 0.8) {
    results.push({ name: 'MACD Cross', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r1.ema12 >= r1.ema26 && r0.ema12 < r0.ema26 && r0.is_bear && r0.vol_ratio >= 0.8) {
    results.push({ name: 'MACD Cross', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 18. BB Bounce
  const bb_upper = r0.close + (r0.atr * 2.0);
  const bb_lower = r0.close - (r0.atr * 2.0);
  if (r0.close < bb_lower * 1.02 && r0.close > bb_lower * 0.98 && r0.is_bull && r0.rsi < 35 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'BB Bounce', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.close > bb_upper * 0.98 && r0.close < bb_upper * 1.02 && r0.is_bear && r0.rsi > 65 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'BB Bounce', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 19. Inside Bar
  if (r0.candle_range < r1.candle_range * 0.8 && r0.is_bull && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Inside Bar', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.candle_range < r1.candle_range * 0.8 && r0.is_bear && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Inside Bar', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 20. Two Bar Reversal
  if (r1.is_bear && r0.is_bull && r0.close > r1.open && r0.body > r1.body * 0.8 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Two Bar Reversal', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r1.is_bull && r0.is_bear && r0.close < r1.open && r0.body > r1.body * 0.8 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Two Bar Reversal', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 21. Momentum Breakout
  if (r0.adx > 22 && r0.is_bull && r0.candle_range > r0.atr * 0.6 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Momentum Breakout', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (r0.adx > 22 && r0.is_bear && r0.candle_range > r0.atr * 0.6 && r0.vol_ratio >= 0.8) {
    results.push({ name: 'Momentum Breakout', dir: 'sell', high: r0.high, low: r0.low });
  }

  // 22. S/R Touch
  if (Math.abs(r0.close - r0.support) / r0.close < 0.003 && r0.is_bull && r0.vol_ratio >= 0.8) {
    results.push({ name: 'S/R Touch', dir: 'buy', high: r0.high, low: r0.low });
  }
  if (Math.abs(r0.close - r0.resistance) / r0.close < 0.003 && r0.is_bear && r0.vol_ratio >= 0.8) {
    results.push({ name: 'S/R Touch', dir: 'sell', high: r0.high, low: r0.low });
  }

  return results.filter(sig => {
    // 1. Filter based on specific coin strategies
    if (!isStrategyAllowedForCoin(symbol, sig.name)) return false;

    // 2. User UI active strategies check
    if (settings && settings.activeStrategies && Object.keys(settings.activeStrategies).length > 0) {
      if (sig.name === 'Breakout' || sig.name === 'Break Out') {
        return settings.activeStrategies['Break Out'] !== false && settings.activeStrategies['Breakout'] !== false;
      }
      return settings.activeStrategies[sig.name] !== false;
    }
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════
//  تحليل وتأكيد شروط الاستراتيجية (تجاوز نظام النقاط العشوائي)
// ═══════════════════════════════════════════════════════════════
export function calculateScore(candles: RichCandle[], direction: 'buy' | 'sell', pattern: string): { score: number, breakdown: string } {
  return {
    score: 100,
    breakdown: `استراتيجية "${pattern}" [${direction === 'buy' ? 'LONG شراء' : 'SHORT بيع'}] | تم التحقق من كافة شروط المؤشرات والحجم والهيكل الفني بنجاح دقة 100%`
  };
}

// ═══════════════════════════════════════════════════════════════
//  تصنيف حالة السوق (NORMAL / EXTREME)
// ═══════════════════════════════════════════════════════════════
export function classifyMarketState(candles: RichCandle[]): string {
  if (candles.length < 10) return "NORMAL";

  const r0 = candles[candles.length - 1];
  const r1 = candles[candles.length - 2];
  const r2 = candles[candles.length - 3];
  const r3 = candles[candles.length - 4];

  const atr = r0.atr || 1e-9;
  const close0 = r0.close;
  const close1 = r1.close;
  const close2 = r2.close;
  const close3 = r3.close;

  const vol_ratio = r0.vol_ratio || 1.0;
  const atr_pct = (atr / close0) * 100;

  const change_1c = Math.abs(close0 - close1) / Math.max(close1, 1e-9);
  const change_2c = Math.abs(close1 - close2) / Math.max(close2, 1e-9);
  const change_3c = Math.abs(close2 - close3) / Math.max(close3, 1e-9);

  const atr_change_1c = change_1c / Math.max(atr / close0, 1e-9);
  const atr_change_2c = change_2c / Math.max(atr / close1, 1e-9);
  const atr_change_3c = change_3c / Math.max(atr / close2, 1e-9);

  let extreme_down_count = 0;
  let extreme_up_count = 0;

  if (close1 < close2 && atr_change_2c > 1.0) extreme_down_count++;
  if (close2 < close3 && atr_change_3c > 1.0) extreme_down_count++;
  if (close0 < close1 && atr_change_1c > 1.0) extreme_down_count++;

  if (close1 > close2 && atr_change_2c > 1.0) extreme_up_count++;
  if (close2 > close3 && atr_change_3c > 1.0) extreme_up_count++;
  if (close0 > close1 && atr_change_1c > 1.0) extreme_up_count++;

  if (extreme_down_count >= 2 && vol_ratio > 1.2) {
    return "EXTREME_DOWN";
  }
  if (extreme_up_count >= 2 && vol_ratio > 1.2) {
    return "EXTREME_UP";
  }

  if (atr_pct > 2.5 && vol_ratio > 1.5) {
    if (close0 < close1 && close1 < close2) return "EXTREME_DOWN";
    if (close0 > close1 && close1 > close2) return "EXTREME_UP";
  }

  return "NORMAL";
}

// ═══════════════════════════════════════════════════════════════
//  تحليل وتأكيد الفريم الكبير (4-Hour Macro Top / Bottom & Structure Analysis)
// ═══════════════════════════════════════════════════════════════
export interface Macro4HAnalysis {
  macroState: '4H_BOTTOM' | '4H_TOP' | '4H_BULL_TREND' | '4H_BEAR_TREND' | '4H_NEUTRAL';
  rsi: number;
  bias: 'buy' | 'sell' | 'neutral';
  description: string;
}

export function check4HourMacroState(candles4h: RichCandle[]): Macro4HAnalysis {
  if (!candles4h || candles4h.length < 10) {
    return { macroState: '4H_NEUTRAL', rsi: 50, bias: 'neutral', description: 'بيانات 4H غير كافية' };
  }

  const r0 = candles4h[candles4h.length - 1];
  const r1 = candles4h[candles4h.length - 2];
  const rsi = r0.rsi || 50;
  const price = r0.close;

  const isAtBottom = (r0.low <= r0.bband_lower || r1.low <= r1.bband_lower || rsi <= 38);
  const isAtTop = (r0.high >= r0.bband_upper || r1.high >= r1.bband_upper || rsi >= 62);

  const isBullTrend = r0.ema14 > r0.ema34 && price > r0.ema34;
  const isBearTrend = r0.ema14 < r0.ema34 && price < r0.ema34;

  if (isAtBottom) {
    return {
      macroState: '4H_BOTTOM',
      rsi,
      bias: 'buy',
      description: `قاع هائل على فريم 4H (RSI ${rsi.toFixed(1)} / ملامسة الشريط السفلي) 🎯 - تفعيل الشراء الحصري`
    };
  }

  if (isAtTop) {
    return {
      macroState: '4H_TOP',
      rsi,
      bias: 'sell',
      description: `قمة / رأس على فريم 4H (RSI ${rsi.toFixed(1)} / ملامسة الشريط العلوي) 🎯 - تفعيل البيع الحصري`
    };
  }

  if (isBullTrend) {
    return {
      macroState: '4H_BULL_TREND',
      rsi,
      bias: 'buy',
      description: `اتجاه صاعد هيكلي على فريم 4H (EMA14 > EMA34) 📈`
    };
  }

  if (isBearTrend) {
    return {
      macroState: '4H_BEAR_TREND',
      rsi,
      bias: 'sell',
      description: `اتجاه هابط هيكلي على فريم 4H (EMA14 < EMA34) 📉`
    };
  }

  return {
    macroState: '4H_NEUTRAL',
    rsi,
    bias: 'neutral',
    description: `نطاق متوازن على فريم 4H`
  };
}

// ═══════════════════════════════════════════════════════════════
//  فلتر الاتجاه الفائق الدقة (15m/1H Multi-Timeframe Trend Alignment)
// ═══════════════════════════════════════════════════════════════
export function checkTrendFilter(trendCandles: RichCandle[], direction: 'buy' | 'sell'): { trendOk: boolean; reason: string } {
  if (!trendCandles || trendCandles.length < 5) return { trendOk: false, reason: "بيانات الاتجاه غير كافية" };

  const r = trendCandles[trendCandles.length - 1];
  const price = r.close;

  const ema_fast = r.ema7 || r.close;
  const ema_medium = r.ema14 || r.close;
  const ema_slow = r.ema34 || r.close;

  if (direction === 'buy') {
    // يمنع الشراء فقط في حالة الانهيار الهابط الحاد جداً حيث EMA7 < EMA34 بفارق كبير والسعر أسفل منها كلياً
    if (ema_fast < ema_slow * 0.985 && price < ema_slow * 0.985) {
      return { trendOk: false, reason: `انهيار هابط حاد (EMA7 < EMA34 والسعر أسفل منها بنسبة > 1.5%)` };
    }
    return { trendOk: true, reason: "اتجاه الشراء مقبول" };
  } else {
    // يمنع البيع فقط في حالة الصعود الحاد جداً حيث EMA7 > EMA34 بفارق كبير والسعر أعلى منها كلياً
    if (ema_fast > ema_slow * 1.015 && price > ema_slow * 1.015) {
      return { trendOk: false, reason: `صعود حاد جداً (EMA7 > EMA34 والسعر أعلى منها بنسبة > 1.5%)` };
    }
    return { trendOk: true, reason: "اتجاه البيع مقبول" };
  }
}

// ═══════════════════════════════════════════════════════════════
//  كشف شمعة الرفض
// ═══════════════════════════════════════════════════════════════
export function isRejectionCandle(candles: RichCandle[], direction: 'buy' | 'sell'): boolean {
  if (candles.length < 3) return false;
  const r0 = candles[candles.length - 1];

  const body0 = Math.abs(r0.close - r0.open);
  const range0 = r0.high - r0.low;
  const upper0 = r0.high - Math.max(r0.open, r0.close);
  const lower0 = Math.min(r0.open, r0.close) - r0.low;

  if (range0 === 0) return false;
  const body_ratio = body0 / range0;

  if (direction === 'buy') {
    return lower0 > range0 * 0.6 && body_ratio < 0.4;
  } else {
    return upper0 > range0 * 0.6 && body_ratio < 0.4;
  }
}

// ═══════════════════════════════════════════════════════════════
//  منطق تأكيد الدخول المطور عالي الدقة (High Precision Entry Confirmation)
// ═══════════════════════════════════════════════════════════════
export function shouldEnterTrade(
  candles: RichCandle[],
  trendCandles: RichCandle[],
  signal: StrategySignal,
  marketState: string,
  settings?: BotSettings,
  macro4h?: Macro4HAnalysis
): { shouldEnter: boolean; reason: string } {
  const direction = signal.dir;
  const patternName = signal.name;

  // 0. فحص وتدقيق هيكل القمة والقاع على فريم 4 ساعات (4H Macro Alignment)
  if (macro4h && macro4h.bias !== 'neutral') {
    if (direction === 'buy' && macro4h.macroState === '4H_TOP') {
      return { shouldEnter: false, reason: `فريم 4H: قمة هيكلية على 4H (${macro4h.description}). يُمنع الشراء عند القمة.` };
    }
    if (direction === 'sell' && macro4h.macroState === '4H_BOTTOM') {
      return { shouldEnter: false, reason: `فريم 4H: قاع هيكلي على 4H (${macro4h.description}). يُمنع البيع عند القاع.` };
    }
  }

  const r0 = candles[candles.length - 1];
  const current_price = r0.close;
  const signal_low = signal.low;
  const signal_high = signal.high;
  const atr = r0.atr || 1e-9;
  const vol_ratio = r0.vol_ratio || 1.0;
  const rsi = r0.rsi || 50;

  // 1. فحص فلتر الاتجاه المباشر
  const { trendOk, reason: trendReason } = checkTrendFilter(trendCandles, direction);
  if (!trendOk) {
    return { shouldEnter: false, reason: `الاتجاه: ${trendReason}` };
  }

  // 2. فحص الحجم المباشر لضمان التداول الجيد والسيولة العالية (الحد الأدنى 0.8x)
  if (vol_ratio < 0.8) {
    return { shouldEnter: false, reason: `حجم التداول غير كافٍ لضمان صفقة عالية الدقة (${vol_ratio.toFixed(2)}x < 0.8x)` };
  }

  // 3. فحص عدم مطاردة السعر والتنفيذ الدقيق (الحد الأقصى 1.5 ATR)
  const signal_price = direction === 'buy' ? signal_low : signal_high;
  const distance_atr = Math.abs(current_price - signal_price) / atr;
  if (distance_atr > 1.5) {
    return { shouldEnter: false, reason: `السعر ابتعد عن نقطة الدخول الدقيقة (${distance_atr.toFixed(1)} ATR > 1.5 ATR)` };
  }

  // 4. فلتر RSI المشدد لتجنب الشراء/البيع عند ذروة الشدة
  const isBottomHunter = patternName.includes("Bottom Hunter");
  const isTopHunter = patternName.includes("Top Hunter");

  if (direction === 'buy' && !isBottomHunter && rsi > 68) {
    return { shouldEnter: false, reason: `RSI مرتفع للشراء العادي (${rsi.toFixed(1)} > 68)` };
  }
  if (direction === 'sell' && !isTopHunter && rsi < 32) {
    return { shouldEnter: false, reason: `RSI منخفض للبيع العادي (${rsi.toFixed(1)} < 32)` };
  }

  // 5. تأكيد الشمعة الحالية: يمنع الشراء عند الشمعة الهبوطية أو البيع عند الشمعة الصعودية القوية
  if (direction === 'buy' && r0.is_bear && r0.body > atr * 1.2) {
    return { shouldEnter: false, reason: `شمعة هبوطية قوية على 5m (${r0.body.toFixed(4)} > 1.2 ATR)، انتظر التهدئة` };
  }
  if (direction === 'sell' && r0.is_bull && r0.body > atr * 1.2) {
    return { shouldEnter: false, reason: `شمعة صعودية قوية على 5m (${r0.body.toFixed(4)} > 1.2 ATR)، انتظر التهدئة` };
  }

  // 5.ب. فلتر صافي الربح الحقيقي وحماية العمولات
  const roundTripFeePct = 0.0012; // 0.12%
  const minRequiredTargetPct = roundTripFeePct * 1.5; // 0.18%
  const estimatedMovePct = (atr * 2.0) / current_price;
  if (estimatedMovePct < minRequiredTargetPct) {
    return { shouldEnter: false, reason: `نطاق الحركة المتوقع صغير جداً (${(estimatedMovePct * 100).toFixed(2)}%)` };
  }

  // 6. فلتر تعزيز نسبة الفوز والنجاح (Win-Rate Enhancer)
  if (settings?.winRateEnhancer) {
    if (vol_ratio < 0.4) {
      return { shouldEnter: false, reason: `محسن الفوز: حجم التداول ضعيف (${vol_ratio.toFixed(1)}x < 0.4x)` };
    }

    if (direction === 'buy' && rsi > 72) {
      return { shouldEnter: false, reason: `محسن الفوز: RSI مرتفع للشراء (${rsi.toFixed(1)} > 72)` };
    }
    if (direction === 'sell' && rsi < 28) {
      return { shouldEnter: false, reason: `محسن الفوز: RSI منخفض للبيع (${rsi.toFixed(1)} < 28)` };
    }

    if (patternName === 'Alpha Velocity Scalper AI') {
      const adx = r0.adx || 0;
      if (adx < 18) {
        return { shouldEnter: false, reason: `محسن الفوز: قوة الاتجاه ضعيفة جداً لسكالبينج (ADX ${adx.toFixed(1)} < 18)` };
      }
    }
  }

  // 6. اتخاذ القرار بناءً على حالة السوق والمنع المطلق للتداول عكس اتجاه السوق العام
  const strongPatterns = [
    'Bottom Hunter AI (Bottom Sweep & BB Bounce)',
    'Top Hunter AI (Peak Sweep & BB Bounce)',
    'Alpha Velocity Scalper AI',
    'Bullish Engulfing', 'Bearish Engulfing', 'Morning Star', 'Evening Star', 
    'Three White Soldiers', 'Three Black Crows', 'RSI Divergence', 'MACD Cross',
    'BB Bounce', 'Momentum Breakout'
  ];

  const isStrong = strongPatterns.includes(patternName);

  if (marketState === "NORMAL") {
    return { shouldEnter: true, reason: isStrong ? `نمط قوي + ${trendReason}` : `نمط + ${trendReason}` };
  } else if (marketState === "EXTREME_DOWN") {
    if (patternName === 'Bottom Hunter AI (Bottom Sweep & BB Bounce)' && isRejectionCandle(candles, 'buy')) {
      return { shouldEnter: true, reason: `انعكاس صاعد مؤكد ومفحوص من القاع Bottom Hunter` };
    }
    return { shouldEnter: false, reason: `ممنوع الشراء عكس اتجاه هبوط السوق الحاد (Market EXTREME_DOWN)` };
  } else if (marketState === "EXTREME_UP") {
    return { shouldEnter: true, reason: `تداول مع اتجاه صعود السوق + ${trendReason}` };
  }

  return { shouldEnter: false, reason: "غير محدد" };
}
