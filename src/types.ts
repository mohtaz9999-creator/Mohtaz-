export interface ApiProfile {
  id: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  isActive: boolean;
  isDemo: boolean;
  balance?: number;
  initialBalance?: number;
  settings?: BotSettings;
  consecutiveLossesPaused?: boolean;
  consecutiveLosses?: number;
  consecutiveLossesPausedUntil?: string;
  doubleNextTradeSize?: boolean;
  pausedMarketState?: string;
}

export interface BotSettings {
  leverage: number;
  baseUsdt: number;
  maxOpenPositions: number;
  maxDailyLossPct: number;
  maxDailyProfitPct: number;
  timeframeSignal: string;
  timeframeTrend: string;
  timeframeAtr: string;
  minScore: number;
  cooldownMinutes: number;
  reversalOrderTimeoutMin: number;
  limitPriceBufferPct: number;
  selectedSymbols: string[];
  activeStrategies: Record<string, boolean>;
  demoBalance: number;
  slTpMode: 'atr' | 'manual';
  atrTpMultiplier: number;
  atrSlMultiplier: number;
  manualTpPct: number;
  manualSlPct: number;
  telegramEnabled?: boolean;
  telegramToken?: string;
  telegramChatId?: string;
  telegramSummaryToken?: string;
  telegramSummaryChatId?: string;
  telegramSignalsToken?: string;
  telegramSignalsChatId?: string;
  browserNotificationsEnabled?: boolean;
  winRateEnhancer?: boolean;
  autoTimeGuardEnabled?: boolean;
  minTimeSlotWinRatePct?: number;
  hardLiquidationShieldEnabled?: boolean;
  maxAllowedDrawdownPct?: number;
  bannedSymbols?: string[];
  bannedStrategySymbols?: string[];
  timeframeMacro?: string;
  autoBlacklistOnLoss?: boolean;
}

export interface Position {
  symbol: string;
  side: 'buy' | 'sell';
  strategy: string;
  score: number;
  entry: number;
  qty: number;
  initial_qty?: number; // الكمية الأصلية عند بدء الصفقة
  currentPrice?: number; // السعر المباشر الأخير لتمثيل المؤشرات الحية
  unrealizedPnlUsdt?: number;
  unrealizedPnlPct?: number;
  tp: number;
  sl: number;
  init_sl: number;
  trailing_sl: number | null;
  atr_value: number;
  partial_tp1_done: boolean;
  partial_tp2_done: boolean;
  partial_sl1_done?: boolean;
  breakeven_done: boolean;
  time: string; // ISO string
  profileId: string;
  marketStateAtOpen?: string;
  btcHealthAtOpen?: string;
  btcPriceAtOpen?: number;
  macro4hStateAtOpen?: string;
  exchangeSlOrderId?: string;
}

export interface PendingOrder {
  order_id: string;
  symbol: string;
  entry_dir: 'buy' | 'sell';
  strategy: string;
  score: number;
  limit_price: number;
  qty: number;
  atr_value: number;
  time: string; // ISO string
  profileId: string;
  marketStateAtOpen?: string;
  btcHealthAtOpen?: string;
  btcPriceAtOpen?: number;
}

export interface TradeLog {
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  strategy: string;
  entry: number;
  exit: number;
  tp: number;
  sl: number;
  pnl_pct_leveraged: number;
  pnl_usdt?: number; // مقدار الربح/الخسارة بالدولار الفعلي
  score: number;
  reason: string;
  profileId?: string;
  profileName?: string;
  marketStateAtOpen?: string;
  btcHealthAtOpen?: string;
  btcPriceAtOpen?: number;
  marketStateAtClose?: string;
  btcHealthAtClose?: string;
  btcPriceAtClose?: number;
  strategySummary?: string;
  hourOfDay?: number;
  dayOfWeek?: number;
  diagnosticReason?: string;
  aiRecommendation?: string;
}

export interface SystemLog {
  id: string;
  time: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'trade';
  message: string;
}

export interface BotStatus {
  isRunning: boolean;
  apiProfiles: ApiProfile[];
  settings: BotSettings;
  positions: Record<string, Position>;
  pendingOrders: Record<string, PendingOrder>;
  tradeHistory: TradeLog[];
  systemLogs: SystemLog[];
  currentBalance: number;
  initialBalance: number;
  dailyPnlPct: number;
  scanCount: number;
  lastScanTime: string | null;
  uptimeSeconds: number;
  marketState?: string;
  btcHealth?: 'GREEN' | 'YELLOW' | 'RED';
  lastHourlySummaryTime?: string;
  timeGuardPaused?: boolean;
  timeGuardReason?: string;
  bannedSymbols?: string[];
  bannedStrategySymbols?: string[];
  aiSelfCorrectionRules?: string[];
}
