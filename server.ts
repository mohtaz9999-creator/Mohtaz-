import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { BotStatus, BotSettings, Position, PendingOrder, TradeLog, SystemLog, ApiProfile } from "./src/types";
import { HUNDRED_COINS, BANNED_SYMBOLS } from "./src/constants";
import { processCandles, detectStrategies, calculateScore, classifyMarketState, shouldEnterTrade, check4HourMacroState, Macro4HAnalysis } from "./src/botEngine";

function cleanSymbols(syms: string[] | undefined): string[] {
  if (!Array.isArray(syms) || syms.length === 0) return HUNDRED_COINS;
  const hardBanned = BANNED_SYMBOLS.map(b => b.replace("/", "").toUpperCase());
  const dynamicBanned = (botStatus?.bannedSymbols || botStatus?.settings?.bannedSymbols || []).map(b => b.replace("/", "").toUpperCase());
  const allBanned = [...hardBanned, ...dynamicBanned];

  const filtered = syms.filter(sym => {
    if (!sym) return false;
    const norm = sym.replace("/", "").toUpperCase();
    return !allBanned.some(b => norm === b || norm === `${b}USDT` || `${norm}USDT` === b);
  });

  if (filtered.length < 5) {
    return HUNDRED_COINS.filter(sym => {
      const norm = sym.replace("/", "").toUpperCase();
      return !hardBanned.some(b => norm === b || norm === `${b}USDT` || `${norm}USDT` === b);
    });
  }

  return filtered;
}

function banSymbol(symbol: string, reason: string) {
  if (!symbol) return;
  const norm = symbol.replace("/", "").toUpperCase();
  const baseNorm = norm.endsWith("USDT") ? norm.slice(0, -4) : norm;
  const symWithSlash = `${baseNorm}/USDT`;
  const symWithoutSlash = `${baseNorm}USDT`;

  if (!botStatus.bannedSymbols) botStatus.bannedSymbols = [];
  if (!botStatus.settings) botStatus.settings = defaultSettings;
  if (!botStatus.settings.bannedSymbols) botStatus.settings.bannedSymbols = [];

  const existing = botStatus.bannedSymbols.map(s => s.replace("/", "").toUpperCase());
  if (!existing.includes(symWithoutSlash)) {
    botStatus.bannedSymbols.push(symWithSlash);
    botStatus.settings.bannedSymbols.push(symWithSlash);

    // Remove from selectedSymbols
    botStatus.settings.selectedSymbols = botStatus.settings.selectedSymbols.filter(s => {
      const n = s.replace("/", "").toUpperCase();
      return n !== symWithoutSlash && n !== `${symWithoutSlash}USDT`;
    });

    // Remove from apiProfiles selectedSymbols
    if (Array.isArray(botStatus.apiProfiles)) {
      botStatus.apiProfiles.forEach(p => {
        if (p.settings && p.settings.selectedSymbols) {
          p.settings.selectedSymbols = p.settings.selectedSymbols.filter(s => {
            const n = s.replace("/", "").toUpperCase();
            return n !== symWithoutSlash && n !== `${symWithoutSlash}USDT`;
          });
        }
      });
    }

    // Add log & AI correction rule
    const logMsg = `🚫 [حظر عملة خاسرة] تم حظر التداول نهائياً على عملة ${symbol} بسبب: ${reason}. لن يدخل البوت أي صفقة عليها مطلقاً.`;
    addLog('warn', logMsg);

    const aiRule = `🤖 [تعديل الذكاء الاصطناعي] حظر العملة الخاسرة ${symbol} تلقائياً للوقاية من الخسائر المكررة.`;
    if (!botStatus.aiSelfCorrectionRules) botStatus.aiSelfCorrectionRules = [];
    if (!botStatus.aiSelfCorrectionRules.includes(aiRule)) {
      botStatus.aiSelfCorrectionRules.unshift(aiRule);
      if (botStatus.aiSelfCorrectionRules.length > 25) botStatus.aiSelfCorrectionRules.pop();
    }

    saveState();
  }
}

const EXPLICIT_HEDGE_COINS = [
  "SUI/USDT", "TRX/USDT", "XLM/USDT", "PAXG/USDT", "INJ/USDT", "DOGE/USDT", "SHIB/USDT", "PEPE/USDT", "USDC/USDT"
];

function isHedgeCoin(symbol: string, correlation: number): boolean {
  if (!symbol) return false;
  const norm = symbol.replace("/", "").toUpperCase();
  const symWithSlash = norm.endsWith("USDT") ? `${norm.slice(0, -4)}/USDT` : `${norm}/USDT`;
  if (EXPLICIT_HEDGE_COINS.includes(symWithSlash)) return true;
  // إذا كان الارتباط ضعيفاً جداً أو سالباً مع البيتكوين (< 0.25)، تعتبر العملة من عملات التحوط
  return correlation < 0.25;
}

function banStrategyForSymbol(symbol: string, strategyName: string, reason: string) {
  if (!symbol || !strategyName) return;
  const norm = symbol.replace("/", "").toUpperCase();
  const baseNorm = norm.endsWith("USDT") ? norm.slice(0, -4) : norm;
  const symWithSlash = `${baseNorm}/USDT`;
  const key = `${symWithSlash}::${strategyName.trim()}`;

  if (!botStatus.bannedStrategySymbols) botStatus.bannedStrategySymbols = [];
  if (!botStatus.settings) botStatus.settings = defaultSettings;
  if (!botStatus.settings.bannedStrategySymbols) botStatus.settings.bannedStrategySymbols = [];

  if (!botStatus.bannedStrategySymbols.includes(key)) {
    botStatus.bannedStrategySymbols.push(key);
    if (!botStatus.settings.bannedStrategySymbols.includes(key)) {
      botStatus.settings.bannedStrategySymbols.push(key);
    }

    const logMsg = `🚫 [حظر استراتيجية عملة] تم حظر استراتيجية "${strategyName}" فقط على عملة ${symbol} بسبب الخسارة: ${reason}. العملة تظل متاحة للتداول باستراتيجيات أخرى!`;
    addLog('warn', logMsg);

    const aiRule = `🤖 [تعديل الذكاء الاصطناعي] حظر استراتيجية "${strategyName}" على ${symbol} لحمايتها من الخسارة المكررة مع إبقاء باقي الاستراتيجيات للعملة.`;
    if (!botStatus.aiSelfCorrectionRules) botStatus.aiSelfCorrectionRules = [];
    if (!botStatus.aiSelfCorrectionRules.includes(aiRule)) {
      botStatus.aiSelfCorrectionRules.unshift(aiRule);
      if (botStatus.aiSelfCorrectionRules.length > 25) botStatus.aiSelfCorrectionRules.pop();
    }

    saveState();
  }
}

function isStrategyBannedForSymbol(symbol: string, strategyName: string): boolean {
  if (!symbol || !strategyName) return false;
  const norm = symbol.replace("/", "").toUpperCase();
  const baseNorm = norm.endsWith("USDT") ? norm.slice(0, -4) : norm;
  const symWithSlash = `${baseNorm}/USDT`;
  const key = `${symWithSlash}::${strategyName.trim()}`;

  const bannedList = botStatus.bannedStrategySymbols || botStatus.settings?.bannedStrategySymbols || [];
  return bannedList.some(k => k.toLowerCase() === key.toLowerCase());
}

const app = express();
const PORT = 3000;

app.use(express.json());

// ═══════════════════════════════════════════════════════════════
//  حالة البوت وحفظ البيانات (State & Persistence)
// ═══════════════════════════════════════════════════════════════
const STATE_FILE = path.join(process.cwd(), "bot_state.json");

const DEFAULT_ALLOWED_STRATEGIES: Record<string, boolean> = {
  "Trend Pullback": true,
  "Bullish Engulfing": true,
  "Alpha Velocity Scalper AI": true,
  "Break Out": true,
  "Bottom Hunter AI (Bottom Sweep & BB Bounce)": true,
  "Top Hunter AI (Peak Sweep & BB Bounce)": true,
  "Momentum Breakout": true,
  "VWAP Bounce": true,
  "Retest": true
};

const defaultSettings: BotSettings = {
  leverage: 5,
  baseUsdt: 10.0,
  maxOpenPositions: 10,
  maxDailyLossPct: 15.0,
  maxDailyProfitPct: 100.0,
  timeframeSignal: "5m",
  timeframeTrend: "15m",
  timeframeAtr: "5m",
  minScore: 65,
  cooldownMinutes: 10,
  reversalOrderTimeoutMin: 30,
  limitPriceBufferPct: 0.001,
  selectedSymbols: HUNDRED_COINS,
  activeStrategies: { ...DEFAULT_ALLOWED_STRATEGIES },
  demoBalance: 1000.0,
  slTpMode: 'atr',
  atrTpMultiplier: 3.0,
  atrSlMultiplier: 1.0,
  manualTpPct: 2.5,
  manualSlPct: 1.0,
  telegramEnabled: false,
  telegramToken: "",
  telegramChatId: "",
  telegramSummaryToken: "",
  telegramSummaryChatId: "",
  telegramSignalsToken: "",
  telegramSignalsChatId: "",
  browserNotificationsEnabled: true,
  winRateEnhancer: true,
  autoTimeGuardEnabled: true,
  minTimeSlotWinRatePct: 40,
  hardLiquidationShieldEnabled: true,
  maxAllowedDrawdownPct: 20
};

const defaultDemoProfile: ApiProfile = {
  id: "demo",
  name: "الحساب التجريبي",
  apiKey: "demo_key",
  apiSecret: "demo_secret",
  isActive: true,
  isDemo: true,
  balance: 1000.0,
  initialBalance: 1000.0,
  settings: JSON.parse(JSON.stringify(defaultSettings))
};

const defaultStatus: BotStatus = {
  isRunning: false,
  apiProfiles: [defaultDemoProfile],
  settings: defaultSettings,
  positions: {},
  pendingOrders: {},
  tradeHistory: [],
  systemLogs: [
    {
      id: "init",
      time: new Date().toISOString(),
      type: "info",
      message: "🟢 تم تهيئة بوت التداول السحابي الحقيقي بنجاح وهو يعمل الآن 24/7."
    }
  ],
  currentBalance: 1000.0,
  initialBalance: 1000.0,
  dailyPnlPct: 0.0,
  scanCount: 0,
  lastScanTime: null,
  uptimeSeconds: 0
};

let botStatus: BotStatus = { ...defaultStatus };

let isScanning = false;
let isRealtimeChecking = false;

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(data) as BotStatus;
      
      let parsedStrategies = {
        ...DEFAULT_ALLOWED_STRATEGIES,
        ...(parsed.settings?.activeStrategies || {})
      };

      const rawSymbols = parsed.settings?.selectedSymbols && parsed.settings.selectedSymbols.length > 20 
        ? parsed.settings.selectedSymbols 
        : HUNDRED_COINS;

      const mergedSettings: BotSettings = {
        ...defaultSettings,
        ...(parsed.settings || {}),
        activeStrategies: parsedStrategies,
        selectedSymbols: cleanSymbols(rawSymbols)
      };
      mergedSettings.reversalOrderTimeoutMin = 30;

      // Restore API profiles and ensure demo profile exists if no profiles present
      let loadedProfiles: any[] = parsed.apiProfiles !== undefined ? parsed.apiProfiles : [];
      if (loadedProfiles.length === 0) {
        loadedProfiles = [JSON.parse(JSON.stringify(defaultDemoProfile))];
      }

      loadedProfiles.forEach((p: any) => {
        if (!p.settings) {
          p.settings = JSON.parse(JSON.stringify(mergedSettings));
        } else {
          p.settings = { ...mergedSettings, ...p.settings };
        }
        if (p.settings.selectedSymbols) {
          p.settings.selectedSymbols = cleanSymbols(p.settings.selectedSymbols);
        }
      });

      const activeProfiles = loadedProfiles.filter((p: any) => p.isActive);
      let totalBal = 0;
      let totalInitBal = 0;
      if (activeProfiles.length > 0) {
        activeProfiles.forEach((p: any) => {
          totalBal += p.balance || 0;
          totalInitBal += p.initialBalance || 0;
        });
      }

      botStatus = {
        ...defaultStatus,
        ...parsed,
        apiProfiles: loadedProfiles,
        settings: mergedSettings,
        positions: parsed.positions || {},
        pendingOrders: parsed.pendingOrders || {},
        tradeHistory: parsed.tradeHistory || [],
        systemLogs: parsed.systemLogs || [],
        currentBalance: totalBal,
        initialBalance: totalInitBal,
        dailyPnlPct: totalInitBal > 0 ? ((totalBal - totalInitBal) / totalInitBal) * 100 : 0.0,
        bannedSymbols: parsed.bannedSymbols || [],
        aiSelfCorrectionRules: parsed.aiSelfCorrectionRules || [
          "🤖 تم تفعيل محرك الذكاء الاصطناعي لتتبع الأخطاء والتصحيح الذاتي تلقائياً 24/7."
        ]
      };

      // فحص أوتوماتيكي لسجل الصفقات السابقة لحظر العملات الخاسرة بدون إغراق السجلات عند التشغيل
      if (Array.isArray(botStatus.tradeHistory)) {
        const bannedSet = new Set((botStatus.bannedSymbols || []).map(s => s.replace("/", "").toUpperCase()));
        botStatus.tradeHistory.forEach(t => {
          if (t.symbol && ((t.pnl_usdt && t.pnl_usdt < 0) || (t.pnl_pct_leveraged && t.pnl_pct_leveraged < 0))) {
            const norm = t.symbol.replace("/", "").toUpperCase();
            const baseNorm = norm.endsWith("USDT") ? norm.slice(0, -4) : norm;
            const symWithSlash = `${baseNorm}/USDT`;
            const symWithoutSlash = `${baseNorm}USDT`;
            if (!bannedSet.has(symWithoutSlash)) {
              bannedSet.add(symWithoutSlash);
              if (!botStatus.bannedSymbols.includes(symWithSlash)) {
                botStatus.bannedSymbols.push(symWithSlash);
              }
            }
          }
        });
      }
    } else {
      botStatus = { ...defaultStatus };
      saveState();
    }
  } catch (err) {
    console.error("Error loading state:", err);
    botStatus = { ...defaultStatus };
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(botStatus, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving state:", err);
  }
}

async function sendTelegramNotification(message: string, profileSettings?: any) {
  const settings = botStatus.settings;
  const token = profileSettings?.telegramToken?.trim() || settings.telegramToken?.trim();
  const chatId = profileSettings?.telegramChatId?.trim() || settings.telegramChatId?.trim();
  if (!token || !chatId) {
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `<b>🤖 OTAZ MAX (صفقات مغلقة ومجزئة):</b>\n\n${message}`,
        parse_mode: "HTML"
      })
    });
    if (!res.ok) {
      const plainText = message.replace(/<[^>]*>/g, "");
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🤖 OTAZ MAX (صفقات مغلقة ومجزئة):\n\n${plainText}`
        })
      });
    }
  } catch (err: any) {
    console.error("Failed to send Telegram message:", err.message);
  }
}

async function sendTelegramSummaryNotification(message: string, profileSettings?: any) {
  const settings = botStatus.settings;
  const token = profileSettings?.telegramSummaryToken?.trim() || profileSettings?.telegramToken?.trim() || settings.telegramSummaryToken?.trim() || settings.telegramToken?.trim();
  const chatId = profileSettings?.telegramSummaryChatId?.trim() || profileSettings?.telegramChatId?.trim() || settings.telegramSummaryChatId?.trim() || settings.telegramChatId?.trim();
  if (!token || !chatId) {
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML"
      })
    });
    if (!res.ok) {
      const plainText = message.replace(/<[^>]*>/g, "");
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText
        })
      });
    }
  } catch (err: any) {
    console.error("Failed to send Telegram Summary message:", err.message);
  }
}

async function sendTelegramSignalsNotification(message: string, profileSettings?: any) {
  const settings = botStatus.settings;
  const token = profileSettings?.telegramSignalsToken?.trim() || profileSettings?.telegramToken?.trim() || settings.telegramSignalsToken?.trim() || settings.telegramToken?.trim();
  const chatId = profileSettings?.telegramSignalsChatId?.trim() || profileSettings?.telegramChatId?.trim() || settings.telegramSignalsChatId?.trim() || settings.telegramChatId?.trim();
  if (!token || !chatId) {
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML"
      })
    });
    if (!res.ok) {
      const plainText = message.replace(/<[^>]*>/g, "");
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: plainText
        })
      });
    }
  } catch (err: any) {
    console.error("Failed to send Telegram Signals message:", err.message);
  }
}

async function processHourlySummary() {
  if (!botStatus.isRunning) return;
  try {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const activeProfiles = botStatus.apiProfiles.filter(p => p.isActive);

    if (activeProfiles.length === 0) {
      const msg = `<b>⏰ تقرير ملخص الأداء بالساعة (حارس السحاب)</b>\n📅 الوقت: <code>${new Date().toLocaleString("ar-EG")}</code>\n\n⚠️ <i>لا يوجد حساب مفعل حالياً.</i>`;
      await sendTelegramSummaryNotification(msg);
      return;
    }

    let accountRows = "";
    let overallHourlyTrades = 0;
    let overallHourlyWins = 0;
    let overallHourlyLosses = 0;
    let overallHourlyPnLUsdt = 0;

    let overallCumTrades = 0;
    let overallCumWins = 0;
    let overallCumLosses = 0;
    let overallCumPnLUsdt = 0;

    for (const p of activeProfiles) {
      const pBalance = p.balance || 0;
      const pInit = p.initialBalance || 0;
      const pGrowth = pInit > 0 ? ((pBalance - pInit) / pInit) * 100 : 0;

      // 1. الصفقات التراكمية الكلية لهذا الحساب المفعل
      const pCumTrades = botStatus.tradeHistory.filter(t => t.profileId === p.id);
      const cumTotal = pCumTrades.length;
      const cumWins = pCumTrades.filter(t => t.pnl_pct_leveraged > 0).length;
      const cumLosses = pCumTrades.filter(t => t.pnl_pct_leveraged <= 0).length;
      const cumWinRate = cumTotal > 0 ? (cumWins / cumTotal) * 100 : 0;
      const cumPnLUsdt = pCumTrades.reduce((sum, t) => sum + (t.pnl_usdt || 0), 0);

      // 2. صفقات الساعة الأخيرة فقط لهذا الحساب المفعل
      const pHourlyTrades = pCumTrades.filter(t => new Date(t.timestamp) >= oneHourAgo);
      const hourlyTotal = pHourlyTrades.length;
      const hourlyWins = pHourlyTrades.filter(t => t.pnl_pct_leveraged > 0).length;
      const hourlyLosses = pHourlyTrades.filter(t => t.pnl_pct_leveraged <= 0).length;
      const hourlyWinRate = hourlyTotal > 0 ? (hourlyWins / hourlyTotal) * 100 : 0;
      const hourlyPnLUsdt = pHourlyTrades.reduce((sum, t) => sum + (t.pnl_usdt || 0), 0);

      overallHourlyTrades += hourlyTotal;
      overallHourlyWins += hourlyWins;
      overallHourlyLosses += hourlyLosses;
      overallHourlyPnLUsdt += hourlyPnLUsdt;

      overallCumTrades += cumTotal;
      overallCumWins += cumWins;
      overallCumLosses += cumLosses;
      overallCumPnLUsdt += cumPnLUsdt;

      accountRows += `
👤 <b>الحساب المفعل:</b> <code>${p.name}</code> (${p.isDemo ? '🧪 تجريبي' : '🔑 حقيقي'})
💵 <b>الرصيد الحالي:</b> <code>$${pBalance.toFixed(2)}</code> (رأس المال الابتدائي: <code>$${pInit.toFixed(2)}</code>)
📈 <b>معدل نمو الحساب التراكمي:</b> <b>${pGrowth >= 0 ? '+' : ''}${pGrowth.toFixed(2)}%</b>

📊 <b>أولاً - النتائج التراكمية للحساب (منذ بدء التشغيل):</b>
- 🔹 إجمالي الصفقات المغلقة: <b>${cumTotal}</b>
- 🎯 صفقات رابحة: <b>${cumWins}</b> | 🛑 صفقات خاسرة: <b>${cumLosses}</b>
- 🏆 نسبة النجاح التراكمية (Win Rate): <b>${cumWinRate.toFixed(1)}%</b>
- 💵 صافي الأرباح التراكمية: <b>${cumPnLUsdt >= 0 ? '+' : ''}$${cumPnLUsdt.toFixed(2)}</b>

⏱️ <b>ثانياً - نتائج أداء الساعة الأخيرة فقط:</b>
- 🔹 عدد الصفقات بالساعة: <b>${hourlyTotal}</b>
- 🎯 صفقات رابحة: <b>${hourlyWins}</b> | 🛑 صفقات خاسرة: <b>${hourlyLosses}</b>
- 🏆 نسبة النجاح بالساعة: <b>${hourlyWinRate.toFixed(1)}%</b>
- 💵 صافي أرباح الساعة: <b>${hourlyPnLUsdt >= 0 ? '+' : ''}$${hourlyPnLUsdt.toFixed(2)}</b>
-----------------------------------`;
    }

    const overallHourlyWinRate = overallHourlyTrades > 0 ? (overallHourlyWins / overallHourlyTrades) * 100 : 0;
    const overallCumWinRate = overallCumTrades > 0 ? (overallCumWins / overallCumTrades) * 100 : 0;

    const msg = `<b>⏰ تقرير ملخص أداء الحسابات المفعلة بالساعة 📊</b>
📅 الوقت: <code>${new Date().toLocaleString("ar-EG")}</code>

🔥 <b>الملخص الإجمالي للحسابات المفعلة:</b>
• <b>النتائج التراكمية:</b> <b>${overallCumTrades}</b> صفقة | 🎯 ربح: <b>${overallCumWins}</b> | 🛑 خسارة: <b>${overallCumLosses}</b> | 🏆 نجاح: <b>${overallCumWinRate.toFixed(1)}%</b> | 💵 أرباح: <b>${overallCumPnLUsdt >= 0 ? '+' : ''}$${overallCumPnLUsdt.toFixed(2)}</b>
• <b>نتائج الساعة الأخيرة:</b> <b>${overallHourlyTrades}</b> صفقة | 🎯 ربح: <b>${overallHourlyWins}</b> | 🛑 خسارة: <b>${overallHourlyLosses}</b> | 🏆 نجاح: <b>${overallHourlyWinRate.toFixed(1)}%</b> | 💵 أرباح: <b>${overallHourlyPnLUsdt >= 0 ? '+' : ''}$${overallHourlyPnLUsdt.toFixed(2)}</b>

🔍 <b>تفاصيل أداء الحساب المفعل:</b>
${accountRows}

⚡ <i>تُرسل هذه النتائج التراكمية والدورية آلياً كل ساعة من البوت.</i>`;

    await sendTelegramSummaryNotification(msg, activeProfiles[0]?.settings);
  } catch (err: any) {
    console.error("Error in processHourlySummary:", err.message);
  }
}

async function processThreeHourlySignalsSummary() {
  if (!botStatus.isRunning) return;
  try {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000);
    const tradesLast3Hours = botStatus.tradeHistory.filter(t => new Date(t.timestamp) >= threeHoursAgo);

    const totalTrades = tradesLast3Hours.length;
    const wins = tradesLast3Hours.filter(t => t.pnl_pct_leveraged > 0).length;
    const losses = tradesLast3Hours.filter(t => t.pnl_pct_leveraged <= 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnLUsdt = tradesLast3Hours.reduce((sum, t) => sum + (t.pnl_usdt || 0), 0);
    const avgLeveragedPnL = totalTrades > 0 ? (tradesLast3Hours.reduce((sum, t) => sum + t.pnl_pct_leveraged, 0) / totalTrades) : 0;

    let qualityRating = "🟡 متوسطة (متذبذبة)";
    if (winRate >= 80) {
      qualityRating = "🟢 ممتازة جداً (دقة عالية جداً 🔥)";
    } else if (winRate >= 60) {
      qualityRating = "🟢 جيدة جداً (مربحة ومستقرة ✨)";
    } else if (winRate > 0 && winRate < 40) {
      qualityRating = "🔴 ضعيفة (سوق هابط/شديد التقلب ⚠️)";
    } else if (totalTrades === 0) {
      qualityRating = "⚪ لا توجد صفقات منفذة (انتظار إشارات ملائمة لتفادي الخسارة)";
    }

    const msg = `<b>🛡️ تقرير جودة إشارات التداول والصفقات (كل 3 ساعات)</b>
📅 الوقت: <code>${new Date().toLocaleString("ar-EG")}</code>

🎯 <b>إحصائيات إشارات التداول للـ 3 ساعات الماضية:</b>
📊 إجمالي الإشارات والصفقات المنفذة: <b>${totalTrades}</b>
✅ صفقات ناجحة (مضروب الهدف): <b>${wins}</b>
❌ صفقات خاسرة (مضروب الوقف): <b>${losses}</b>
🔥 نسبة دقة نجاح الإشارات: <b>${winRate.toFixed(1)}%</b>
💵 صافي الأرباح المحققة: <b>${totalPnLUsdt >= 0 ? '+' : ''}$${totalPnLUsdt.toFixed(2)}</b>
📈 متوسط ربح الإشارة الواحدة: <b>${avgLeveragedPnL >= 0 ? '+' : ''}${avgLeveragedPnL.toFixed(2)}%</b>

💡 <b>تقييم جودة الإشارات وحالة السوق:</b>
🛡️ درجة أمان السوق الحالي: <b>${qualityRating}</b>
⚠️ <i>توجيه تلقائي: في حالة تراجع دقة الإشارات عن 50%، يقوم البوت تلقائياً بتفعيل فلاتر أمان إضافية (أقوى) للحد من المخاطر وحماية رأس المال.</i>

📡 <i>قناة إرسال الإشارات والصفقات الحية الموثوقة.</i>`;

    await sendTelegramSignalsNotification(msg);
  } catch (err: any) {
    console.error("Error in processThreeHourlySignalsSummary:", err.message);
  }
}

function addLog(type: 'info' | 'success' | 'warn' | 'error' | 'trade', message: string) {
  const newLog: SystemLog = {
    id: Math.random().toString(36).substring(2, 11),
    time: new Date().toISOString(),
    type,
    message
  };
  botStatus.systemLogs = [newLog, ...botStatus.systemLogs].slice(0, 400);
  saveState();

  // إرسال الإشعارات إلى تلغرام عند حدوث صفقات أو أخطاء أو تشغيل/إيقاف البوت بنجاح
  if (type === 'trade' || type === 'error' || type === 'success') {
    sendTelegramNotification(message);
  }
}

// ═══════════════════════════════════════════════════════════════
//  توقيع واتصال بينانس (Binance Cryptography & HTTP Fetcher)
// ═══════════════════════════════════════════════════════════════
function hmacSha256(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function getBinanceFuturesSymbol(symbol: string): string {
  const binanceSymbol = symbol.replace("/", "");
  if (binanceSymbol === "SHIBUSDT") return "1000SHIBUSDT";
  if (binanceSymbol === "LUNCUSDT") return "1000LUNCUSDT";
  if (binanceSymbol === "PEPEUSDT") return "1000PEPEUSDT";
  if (binanceSymbol === "BONKUSDT") return "1000BONKUSDT";
  if (binanceSymbol === "FLOKIUSDT") return "1000FLOKIUSDT";
  return binanceSymbol;
}

function getSymbolFromBinanceSymbol(binanceSymbol: string): string {
  let upper = binanceSymbol.toUpperCase();
  if (upper === "1000SHIBUSDT") upper = "SHIBUSDT";
  if (upper === "1000LUNCUSDT") upper = "LUNCUSDT";
  if (upper === "1000PEPEUSDT") upper = "PEPEUSDT";
  if (upper === "1000BONKUSDT") upper = "BONKUSDT";
  if (upper === "1000FLOKIUSDT") upper = "FLOKIUSDT";
  if (upper.endsWith("USDT")) {
    const base = upper.substring(0, upper.length - 4);
    return `${base}/USDT`;
  }
  return binanceSymbol;
}

function calculateCorrelation(coinCloses: number[], btcCloses: number[]): number {
  const n = Math.min(coinCloses.length, btcCloses.length);
  if (n < 10) return 0.5; // fallback
  const coinReturns: number[] = [];
  const btcReturns: number[] = [];
  for (let i = 1; i < n; i++) {
    coinReturns.push((coinCloses[i] - coinCloses[i-1]) / coinCloses[i-1]);
    btcReturns.push((btcCloses[i] - btcCloses[i-1]) / btcCloses[i-1]);
  }
  const m = coinReturns.length;
  const meanCoin = coinReturns.reduce((a, b) => a + b, 0) / m;
  const meanBtc = btcReturns.reduce((a, b) => a + b, 0) / m;
  let num = 0;
  let denCoin = 0;
  let denBtc = 0;
  for (let i = 0; i < m; i++) {
    const dCoin = coinReturns[i] - meanCoin;
    const dBtc = btcReturns[i] - meanBtc;
    num += dCoin * dBtc;
    denCoin += dCoin * dCoin;
    denBtc += dBtc * dBtc;
  }
  if (denCoin === 0 || denBtc === 0) return 0.5;
  return num / Math.sqrt(denCoin * denBtc);
}

async function checkBTCHealth(): Promise<'GREEN' | 'YELLOW' | 'RED'> {
  try {
    const raw5m = await fetchKlines('BTC/USDT', '5m', 20);
    const raw15m = await fetchKlines('BTC/USDT', '15m', 20);
    if (!raw5m || raw5m.length < 5 || !raw15m || raw15m.length < 5) {
      botStatus.btcHealth = 'GREEN';
      botStatus.marketState = 'NORMAL';
      return 'GREEN'; // fallback
    }

    const candles5m = processCandles(raw5m);
    const candles15m = processCandles(raw15m);

    // Classify market state using BTC 5m candles
    const btcMarketState = classifyMarketState(candles5m);
    botStatus.marketState = btcMarketState;

    const r0_5m = candles5m[candles5m.length - 1];
    const r1_5m = candles5m[candles5m.length - 2];
    const r2_5m = candles5m[candles5m.length - 3];

    const r0_15m = candles15m[candles15m.length - 1];

    // Check for fast collapse on 5m (e.g. single candle drop > 1.8% or sum of 3 candles > 3.5%)
    const last3ChangePct = ((r0_5m.close - r2_5m.open) / r2_5m.open) * 100;
    const currentCandleChangePct = ((r0_5m.close - r0_5m.open) / r0_5m.open) * 100;
    const prevCandleChangePct = ((r1_5m.close - r1_5m.open) / r1_5m.open) * 100;

    // Fast collapse rules
    if (currentCandleChangePct < -1.8 || prevCandleChangePct < -1.8 || last3ChangePct < -3.5) {
      botStatus.btcHealth = 'RED';
      return 'RED';
    }

    // Heavy volume dump candle check: body > 2 * ATR and volume > 2.5 * Average Volume
    const isDump5m = r0_5m.is_bear && r0_5m.body > r0_5m.atr * 2.0 && r0_5m.vol_ratio > 2.5;
    if (isDump5m) {
      botStatus.btcHealth = 'RED';
      return 'RED';
    }

    // Heavy dump on 15m
    const current15mChangePct = ((r0_15m.close - r0_15m.open) / r0_15m.open) * 100;
    if (current15mChangePct < -2.5) {
      botStatus.btcHealth = 'RED';
      return 'RED';
    }

    // Yellow condition: BTC is in minor downtrend or weak but not collapsing
    const belowEma5m = r0_5m.close < r0_5m.ema50;
    const belowEma15m = r0_15m.close < r0_15m.ema50;
    if (belowEma5m || belowEma15m || currentCandleChangePct < -0.8) {
      botStatus.btcHealth = 'YELLOW';
      return 'YELLOW';
    }

    botStatus.btcHealth = 'GREEN';
    return 'GREEN';
  } catch (err) {
    console.error("Error in checkBTCHealth:", err);
    botStatus.btcHealth = 'GREEN';
    botStatus.marketState = 'NORMAL';
    return 'GREEN'; // fallback
  }
}

// حساب عدد الصفقات الخاسرة المتتالية للحساب
function getConsecutiveLossesCount(profileId: string): number {
  const profileHistory = botStatus.tradeHistory
    .filter(t => t.profileId === profileId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  let count = 0;
  for (const t of profileHistory) {
    const isLoss = (t.pnl_pct_leveraged || 0) < 0 || (t.pnl_usdt || 0) < 0;
    if (isLoss) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function generateTradeDiagnostics(
  sym: string,
  side: string,
  strategy: string,
  pnl_pct: number,
  pnl_usdt: number,
  reason: string,
  btcHealthOpen?: string,
  btcHealthClose?: string,
  hourOfDay?: number
): { diagnosticReason: string; aiRecommendation: string } {
  const isWin = pnl_pct >= 0;
  const hourStr = hourOfDay !== undefined ? `${hourOfDay.toString().padStart(2, '0')}:00` : 'التوقيت الحالي';
  const cleanStrat = strategy.replace(/\s*\(جني أرباح جزئي\s*\d+%\)/, '').replace(/\s*\(متبقي\s*\d+%\)/, '');

  let diagnosticReason = "";
  let aiRecommendation = "";

  if (isWin) {
    diagnosticReason = `✅ تحقق ربح ممتاز (+${pnl_pct.toFixed(2)}% | +$${pnl_usdt.toFixed(2)} USDT) عبر استراتيجية ${cleanStrat}. ` +
      `دخولت الصفقة في الساعة ${hourStr} بتوافق مع صحة البيتكوين (${btcHealthOpen === 'GREEN' ? '🟢 صعودي مستقر' : btcHealthOpen || 'عادية'})، مما منح الحركة سيولة قوية بدون تذبذب ضاغط.`;
    aiRecommendation = `💡 توصية الذكاء الاصطناعي: الاستمرار في التداول خلال الساعة ${hourStr} والاستفادة من زَخَم الحركة عند استقرار البيتكوين.`;
  } else {
    let cause = "التذبذب اللحظي المرتفع وانعكاس الحركة السعرية السريعة";
    if (btcHealthOpen === 'RED' || btcHealthClose === 'RED') {
      cause = "هبوط حاد ومفاجئ في اتجاه البيتكوين والسوق العام (BTC RED State)";
    } else if (reason.includes("تصفية") || pnl_pct <= -18) {
      cause = "تجاوز حد الخسارة الوقائي المباشر لتفادي الاقتراب من تصفية بينانس 100%";
    }

    diagnosticReason = `❌ تراجعت الصفقة لتسجل خسارة (${pnl_pct.toFixed(2)}% | -$${Math.abs(pnl_usdt).toFixed(2)} USDT) بسبب ${cause} خلال الساعة ${hourStr}. ` +
      `حالة البيتكوين كانت عند الفتح (${btcHealthOpen || 'عادية'}) وعند الإغلاق (${btcHealthClose || 'عادية'}).`;
    
    aiRecommendation = `🛡️ توصية الذكاء الاصطناعي: الاعتماد على 'حارس الساعات السلبية التلقائي' لمنع الدخول في هذه الساعة، مع إبقاء 'درع الوقاية القاطعة من التصفية' مفعلاً 24/7.`;
  }

  return { diagnosticReason, aiRecommendation };
}

function generateStrategySummary(
  symbol: string,
  side: string,
  strategy: string,
  entry: number,
  exit: number,
  pnl_pct: number,
  pnl_usdt: number,
  reason: string,
  stateOpen?: string,
  healthOpen?: string,
  btcPriceOpen?: number,
  stateClose?: string,
  healthClose?: string,
  btcPriceClose?: number
): string {
  const isWin = pnl_pct >= 0;
  const outcomeText = isWin ? "رابحة (ربح)" : "خاسرة (خسارة)";
  
  // Clean strategy name
  const cleanStrat = strategy.replace(/\s*\(جني أرباح جزئي\s*\d+%\)/, '').replace(/\s*\(متبقي\s*\d+%\)/, '');

  let stratRules = "";
  if (cleanStrat.includes("Bottom Hunter")) {
    stratRules = "تعتمد على تحديد القيعان السعرية المحلية عبر الجمع بين انحراف البولينجر باند (BB Bounce) ومستويات الدعم التاريخية للبحث عن الارتدادات الصعودية السريعة.";
  } else if (cleanStrat.includes("Alpha Velocity") || cleanStrat.includes("Scalper")) {
    stratRules = "استراتيجية سكالبينج فائقة السرعة تراقب قوة الزخم اللحظي وتدفق السيولة وحجم التداول لتنفيذ صفقات خاطفة تحقق أهدافاً متقاربة ونسبة نجاح مرتفعة.";
  } else if (cleanStrat.includes("VWAP Bounce")) {
    stratRules = "تعتمد على مراقبة متوسط السعر المرجح بحجم التداول (VWAP). يتم الدخول عند ارتداد السعر واختباره لهذا المستوى الحرج كدعم أو مقاومة ديناميكية.";
  } else if (cleanStrat.includes("Breakout")) {
    stratRules = "تراقب اختراقات خطوط الاتجاه أو القنوات السعرية الأفقية مصحوبة بزيادة ملحوظة في حجم التداول لتأكيد استمرارية الحركة السعرية القوية.";
  } else if (cleanStrat.includes("Retest")) {
    stratRules = "تقوم بالدخول بعد حدوث الاختراق وإعادة اختبار مستويات الدعم والمقاومة المخترقة لتأكيد الاستقرار السعري وتقليص نسبة المخاطرة.";
  } else if (cleanStrat.includes("Engulfing") || cleanStrat.includes("Pin Bar")) {
    stratRules = "استراتيجية كلاسيكية تعتمد على نماذج الشموع اليابانية الانعكاسية (كالابتلاعية أو البين بار) عند مناطق الطلب أو العرض الرئيسية.";
  } else {
    stratRules = "استراتيجية ذكاء اصطناعي متعددة المؤشرات تجمع بين الزخم، حجم التداول، ومستويات الدعم والمقاومة لتحديد أفضل نقاط الدخول الآمنة.";
  }

  const translateHealth = (h?: string) => {
    if (h === 'GREEN') return '🟢 مستقرة ونشطة (صعودي)';
    if (h === 'RED') return '🔴 هابطة وتحت ضغط بيعي كبير';
    if (h === 'YELLOW') return '🟡 حذرة وعرضية';
    return h || '🟢 مستقرة';
  };

  const translateState = (s?: string) => {
    if (s === 'BULLISH' || s === 'bullish') return '📈 صعودي قوي';
    if (s === 'BEARISH' || s === 'bearish') return '📉 هبوطي قوي';
    if (s === 'STABLE' || s === 'stable') return '↔️ مستقر وعرضي';
    return s || '↔️ مستقر';
  };

  return `📊 ملخص تفصيلي للصفقة المكتملة (${outcomeText}):\n` +
    `• العملة والاتجاه: ${symbol} | ${side.toUpperCase() === 'BUY' ? 'LONG (شراء)' : 'SHORT (بيع)'}\n` +
    `• الاستراتيجية المعتمدة: ${cleanStrat}\n` +
    `• قاعدة القرار الفني: ${stratRules}\n\n` +
    `• مستويات السعر:\n` +
    `  - سعر الدخول: ${entry.toFixed(4)}\n` +
    `  - سعر الإغلاق: ${exit.toFixed(4)}\n` +
    `  - النتيجة: ${pnl_pct > 0 ? '+' : ''}${pnl_pct.toFixed(2)}% (${pnl_usdt > 0 ? '+' : ''}$${pnl_usdt.toFixed(2)} USDT)\n` +
    `  - سبب الإغلاق: ${reason}\n\n` +
    `• حالة السوق والبيتكوين عند الفتح:\n` +
    `  - صحة البيتكوين: ${translateHealth(healthOpen)}\n` +
    `  - سعر البيتكوين: $${btcPriceOpen ? btcPriceOpen.toLocaleString() : '---'} USD\n` +
    `  - اتجاه السوق العام: ${translateState(stateOpen)}\n\n` +
    `• حالة السوق والبيتكوين عند الإغلاق:\n` +
    `  - صحة البيتكوين: ${translateHealth(healthClose)}\n` +
    `  - سعر البيتكوين: $${btcPriceClose ? btcPriceClose.toLocaleString() : '---'} USD\n` +
    `  - اتجاه السوق العام: ${translateState(stateClose)}`;
}

async function syncBinancePositionsAndBalances(
  profile: any,
  settings: BotSettings,
  updatedPositions: Record<string, Position>,
  updatedHistory: TradeLog[]
) {
  if (profile.isDemo) return;

  try {
    // 1. Fetch and Sync Real Balance from Binance Futures Account API
    try {
      const accData = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'GET', '/fapi/v2/account');
      if (accData) {
        const totalWallet = parseFloat(accData.totalWalletBalance || "0");
        const totalMargin = parseFloat(accData.totalMarginBalance || "0");
        if (!isNaN(totalMargin) && totalMargin > 0) {
          profile.balance = totalMargin;
          if (!profile.initialBalance || profile.initialBalance === 0) {
            profile.initialBalance = totalWallet > 0 ? totalWallet : totalMargin;
          }
        }
      }
    } catch (balErr: any) {
      console.error(`[Sync Balance] Failed for ${profile.name}:`, balErr.message);
    }

    // 2. Fetch Position Risk
    const positionsData = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'GET', '/fapi/v2/positionRisk');
    if (!Array.isArray(positionsData)) return;

    const activeBinancePositions: Record<string, any> = {};

    positionsData.forEach((p: any) => {
      const amt = parseFloat(p.positionAmt);
      if (amt !== 0) {
        const binanceSymbol = p.symbol.toUpperCase();
        const symbol = getSymbolFromBinanceSymbol(binanceSymbol);
        activeBinancePositions[symbol] = p;
      }
    });

    // A. Clean up positions in state that are NO LONGER open on Binance
    for (const key of Object.keys(updatedPositions)) {
      const pos = updatedPositions[key];
      if (pos.profileId === profile.id) {
        const sym = pos.symbol;
        if (!activeBinancePositions[sym]) {
          // The position was closed externally on Binance
          try {
            const currentPrice = await fetchTickerPrice(sym);
            const side = pos.side;
            const entry = pos.entry;
            const finalProfitRaw = side === 'buy' ? (currentPrice - entry) / entry : (entry - currentPrice) / entry;
            const leveragedProfitPct = finalProfitRaw * settings.leverage * 100;
            const profitUsdt = pos.qty * (currentPrice - entry) * (side === 'buy' ? 1 : -1);

            const newTrade: TradeLog = {
              timestamp: new Date().toISOString(),
              symbol: sym,
              side,
              strategy: pos.strategy,
              entry,
              exit: currentPrice,
              tp: pos.tp,
              sl: pos.init_sl,
              pnl_pct_leveraged: leveragedProfitPct,
              pnl_usdt: profitUsdt,
              score: pos.score,
              reason: "إغلاق خارجي من منصة بينانس 🔄",
              profileId: profile.id,
              profileName: profile.name
            };

            updatedHistory.unshift(newTrade);
            delete updatedPositions[key];
            addLog('trade', `🏁 [${profile.name}] تم إغلاق صفقة ${sym} خارجياً (تم تسويتها على بينانس - الربح: ${profitUsdt >= 0 ? '+' : ''}$${profitUsdt.toFixed(2)} USDT).`);
          } catch (err) {
            delete updatedPositions[key];
          }
        }
      }
    }

    // B. Import new active positions from Binance to be tracked and managed by the bot
    for (const [sym, p] of Object.entries(activeBinancePositions)) {
      const key = `${profile.id}_${sym}`;
      const amt = parseFloat(p.positionAmt);
      const side = amt > 0 ? 'buy' : 'sell';
      const entry = parseFloat(p.entryPrice);
      const markPrice = parseFloat(p.markPrice || entry.toString());
      const qty = Math.abs(amt);
      const unPnl = parseFloat(p.unRealizedProfit || "0");

      if (!updatedPositions[key]) {
        // Position exists on Binance but not in our bot state -> Import it!
        const atrValue = entry * 0.02; // 2% of price fallback
        let tpDist = 0;
        let slDist = 0;

        if (settings.slTpMode === 'atr') {
          tpDist = atrValue * (settings.atrTpMultiplier || 2.5);
          slDist = atrValue * (settings.atrSlMultiplier || 1.5);
        } else {
          tpDist = entry * ((settings.manualTpPct || 2.0) / 100);
          slDist = entry * ((settings.manualSlPct || 1.5) / 100);
        }

        const tpPrice = side === 'buy' ? entry + tpDist : entry - tpDist;
        const slPrice = side === 'buy' ? entry - slDist : entry + slDist;

        const newPos: Position = {
          symbol: sym,
          side,
          strategy: "مستوردة من بينانس 📥",
          score: 100,
          entry,
          qty,
          initial_qty: qty, // حفظ الكمية الأصلية 100%
          tp: tpPrice,
          sl: slPrice,
          init_sl: slPrice,
          trailing_sl: null,
          atr_value: atrValue,
          partial_tp1_done: false,
          partial_tp2_done: false,
          breakeven_done: false,
          time: new Date().toISOString(),
          profileId: profile.id
        };

        updatedPositions[key] = newPos;
        addLog('trade', `📥 [${profile.name}] تم جلب ومزامنة صفقة مفتوحة حية للعملة ${sym} بسعر دخول ${entry.toFixed(4)} وحجم ${qty}. تبدأ المراقبة الآلية وحماية الخروج الآن!`);
        
        // قفل أمر الوقف المباشر على سيرفرات بينانس فور المزامنة
        await syncExchangeStopLoss(profile, sym, newPos);
      } else {
        // If already exists, update current quantity
        if (Math.abs(updatedPositions[key].qty - qty) > 0.00001) {
          updatedPositions[key].qty = qty;
        }
        // التأكد من تزامن الوقف على بينانس
        await syncExchangeStopLoss(profile, sym, updatedPositions[key]);
      }
    }
  } catch (err: any) {
    console.error(`[Sync Engine] Error syncing for profile ${profile.name}:`, err.message);
  }
}

interface SymbolConfig {
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: number;
  stepSize: number;
}

let symbolConfigs: { [symbol: string]: SymbolConfig } = {};

async function fetchExchangeInfo() {
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo");
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const data = (await res.json()) as any;
    if (data && Array.isArray(data.symbols)) {
      const configs: { [symbol: string]: SymbolConfig } = {};
      data.symbols.forEach((s: any) => {
        let tickSize = 0.0001;
        let stepSize = 0.001;
        
        if (Array.isArray(s.filters)) {
          const priceFilter = s.filters.find((f: any) => f.filterType === "PRICE_FILTER");
          if (priceFilter && priceFilter.tickSize) {
            tickSize = parseFloat(priceFilter.tickSize);
          }
          const lotSizeFilter = s.filters.find((f: any) => f.filterType === "LOT_SIZE");
          if (lotSizeFilter && lotSizeFilter.stepSize) {
            stepSize = parseFloat(lotSizeFilter.stepSize);
          }
        }

        configs[s.symbol.toUpperCase()] = {
          pricePrecision: s.pricePrecision,
          quantityPrecision: s.quantityPrecision,
          tickSize,
          stepSize
        };
      });
      symbolConfigs = configs;
      console.log(`[Binance] Loaded ${Object.keys(symbolConfigs).length} symbol configurations with tick sizes successfully.`);
    }
  } catch (err: any) {
    console.error("Failed to load Binance exchange info, using fallback:", err.message);
  }
}

function formatPrice(symbol: string, price: number): string {
  const binanceSymbol = getBinanceFuturesSymbol(symbol).toUpperCase();
  const config = symbolConfigs[binanceSymbol];
  if (config && config.tickSize) {
    const rounded = Math.round(price / config.tickSize) * config.tickSize;
    return rounded.toFixed(config.pricePrecision);
  }
  // Fallback defaults
  if (price > 1000) return price.toFixed(2);
  if (price > 10) return price.toFixed(3);
  if (price > 1) return price.toFixed(4);
  return price.toFixed(5);
}

function formatQuantity(symbol: string, qty: number): string {
  const binanceSymbol = getBinanceFuturesSymbol(symbol).toUpperCase();
  const config = symbolConfigs[binanceSymbol];
  if (config && config.stepSize) {
    const rounded = Math.round(qty / config.stepSize) * config.stepSize;
    return rounded.toFixed(config.quantityPrecision);
  }
  // Fallback defaults: low priced assets like DOGE, SHIB, LUNC need low precision
  const upper = binanceSymbol.toUpperCase();
  if (upper.includes("SHIB") || upper.includes("LUNC") || upper.includes("DOGE") || upper.includes("PEPE") || upper.includes("XRP") || upper.includes("ADA") || upper.includes("TRX")) {
    return qty.toFixed(0);
  }
  return qty.toFixed(3);
}

async function fetchKlines(symbol: string, timeframe: string, limit = 100): Promise<any[]> {
  const binanceSymbol = getBinanceFuturesSymbol(symbol);
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=${timeframe}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`فشل جلب الشموع للعملة ${symbol}: ${response.statusText}`);
  }
  return await response.json() as any[];
}

async function fetchTickerPrice(symbol: string): Promise<number> {
  const binanceSymbol = getBinanceFuturesSymbol(symbol);
  const url = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${binanceSymbol}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`فشل جلب سعر ${symbol}: ${response.statusText}`);
  }
  const data = await response.json() as any;
  return parseFloat(data.price);
}

async function callBinanceFutures(
  apiKey: string,
  apiSecret: string,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, any> = {}
): Promise<any> {
  const timestamp = Date.now();
  const queryParams = { ...params, timestamp };
  
  const queryString = Object.entries(queryParams)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    .join("&");
    
  const signature = hmacSha256(apiSecret, queryString);
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
//  درع الوقف المباشر لمنع التصفية 100% على سيرفرات منصة بينانس
// ═══════════════════════════════════════════════════════════════
async function syncExchangeStopLoss(profile: any, symbol: string, pos: Position) {
  if (!profile || profile.isDemo || !pos || !pos.sl) return;
  try {
    const binanceSymbol = getBinanceFuturesSymbol(symbol);
    const slPriceStr = formatPrice(symbol, pos.sl);
    const slSide = pos.side === 'buy' ? 'SELL' : 'BUY';

    // 1. جلب السعر المباشر للتحقق من صحة شرط الوقف (يجب أن يكون الوقف أسفل السعر للشراء وأعلى للبيع)
    let currentPrice = 0;
    try {
      currentPrice = await fetchTickerPrice(symbol);
    } catch (e) {}

    if (currentPrice > 0) {
      if (pos.side === 'buy' && pos.sl >= currentPrice) {
        // سعر الوقف تم تجاوزه بالفعل، نفذ إغلاق بالسعر الحالي فوراً
        return;
      }
      if (pos.side === 'sell' && pos.sl <= currentPrice) {
        // سعر الوقف تم تجاوزه بالفعل، نفذ إغلاق بالسعر الحالي فوراً
        return;
      }
    }

    // 2. جلب الأوامر المعلقة من بينانس عبر Endpoint الرسمي القياسي
    const openOrders: any[] = [];
    try {
      const normalOrders = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'GET', '/fapi/v1/openOrders', { symbol: binanceSymbol });
      if (Array.isArray(normalOrders)) openOrders.push(...normalOrders);
    } catch (e) {}

    if (Array.isArray(openOrders)) {
      for (const ord of openOrders) {
        const ordType = String(ord.type || ord.orderType || "").toUpperCase();
        if (ordType.includes('STOP')) {
          const existingStopPrice = parseFloat(ord.stopPrice || ord.triggerPrice || "0");
          const targetStopPrice = parseFloat(slPriceStr);
          if (targetStopPrice > 0 && Math.abs(existingStopPrice - targetStopPrice) / targetStopPrice < 0.0001) {
            pos.exchangeSlOrderId = String(ord.orderId || "");
            return; // الوقف مودع ومقفل بالفعل بنفس السعر على المنصة
          }
          // إلغاء أمر الوقف القديم لإعادة إيداعه بالسعر المحدث
          if (ord.orderId) {
            try {
              await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
                symbol: binanceSymbol,
                orderId: ord.orderId
              });
            } catch (e) {}
          }
        }
      }
    }

    // 3. إيداع أمر الوقف المباشر المضمون عبر /fapi/v1/order Endpoint
    let stopOrder: any = null;

    // محاولة A: closePosition=true
    try {
      stopOrder = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
        symbol: binanceSymbol,
        side: slSide,
        type: 'STOP_MARKET',
        stopPrice: slPriceStr,
        closePosition: 'true',
        workingType: 'MARK_PRICE'
      });
    } catch (errA: any) {
      // محاولة B: تحديد الكمية بدقة + reduceOnly=true
      try {
        const formattedQty = formatQuantity(symbol, pos.qty);
        stopOrder = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
          symbol: binanceSymbol,
          side: slSide,
          type: 'STOP_MARKET',
          stopPrice: slPriceStr,
          quantity: formattedQty,
          reduceOnly: 'true',
          workingType: 'MARK_PRICE'
        });
      } catch (errB: any) {
        // إذا رفضت بينانس أمر الوقف على المنصة لأي سبب، تعتمد المحفظة على حماية المحرك السحابي اللحظية 24/7
        addLog('info', `🛡️ [${profile.name}] الوقف اللحظي السحابي نشط وحامي للعملة ${symbol} @ ${slPriceStr} (مراقبة لحظية كل 4 ثوانٍ).`);
        return;
      }
    }

    if (stopOrder && stopOrder.orderId) {
      pos.exchangeSlOrderId = String(stopOrder.orderId);
      addLog('info', `🛡️ [${profile.name}] تم قفل إيداع أمر وقف الخسارة المباشر (STOP_MARKET @ ${slPriceStr}) لسيرفرات بينانس للعملة ${symbol} لمنع التصفية 100%!`);
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (!errMsg.includes("<!DOCTYPE") && !errMsg.includes("404")) {
      console.warn(`[Exchange SL Shield] Note for ${symbol}:`, errMsg);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  دورة التحقق وإدارة الصفقات والمسح (Bot Loops)
// ═══════════════════════════════════════════════════════════════
async function runRealtimeCheck() {
  if (!botStatus.isRunning) return;
  if (isRealtimeChecking) return;
  isRealtimeChecking = true;

  try {
    const settings = botStatus.settings;

    // Fetch current BTC price and health for close-trade logging
    let btcPriceAtClose = 60000;
    try {
      btcPriceAtClose = await fetchTickerPrice("BTC/USDT");
    } catch (e) {
      console.warn("Failed to fetch BTC price inside realtime check:", e);
    }
    const btcHealthAtClose = botStatus.btcHealth || "GREEN";
    const marketStateAtClose = botStatus.marketState || "NORMAL";

    let updatedPositions = { ...botStatus.positions };
    let updatedPending = { ...botStatus.pendingOrders };
    let updatedHistory = [...botStatus.tradeHistory];
    let stateModified = false;

    // تهيئة وتأكيد الرصيد الافتراضي لكافة الحسابات إن لم يكن موجوداً
    botStatus.apiProfiles.forEach(p => {
      if (p.balance === undefined) p.balance = p.isDemo ? settings.demoBalance : 0.0;
      if (p.initialBalance === undefined) p.initialBalance = p.isDemo ? settings.demoBalance : 0.0;
    });

    // مزامنة الأرصدة والصفقات الحية مع حسابات بينانس الحقيقية النشطة
    for (const profile of botStatus.apiProfiles) {
      if (profile.isActive && !profile.isDemo) {
        await syncBinancePositionsAndBalances(profile, profile.settings || settings, updatedPositions, updatedHistory);
        stateModified = true;
      }
    }

  // 1. مراجعة الصفقات المفتوحة حياً لكافة الحسابات النشطة
  for (const key of Object.keys(updatedPositions)) {
    const pos = updatedPositions[key];
    const profileId = pos.profileId;
    let profile = botStatus.apiProfiles.find(p => p.id === profileId);
    
    if (!profile) continue; // تخطي الحساب إذا تم حذفه
    if (!profile.isActive) continue; // تخطي الحساب غير النشط حالياً

    const profileSettings = profile.settings || settings;
    const isDemo = profile.isDemo;
    const sym = pos.symbol;

    try {
      const currentPrice = await fetchTickerPrice(sym);
      pos.currentPrice = currentPrice;
      stateModified = true; // نضمن حفظ وتحديث السعر حياً
      const side = pos.side;
      const entry = pos.entry;
      const atr = pos.atr_value;

      let profitPctRaw = (currentPrice - entry) / entry;
      if (side === 'sell') profitPctRaw = (entry - currentPrice) / entry;

      const profitLeveragedPct = profitPctRaw * profileSettings.leverage * 100;
      const profitAtrUnits = atr && atr > 0 ? (profitPctRaw * entry) / atr : (profitPctRaw * entry) / (entry * 0.02);

      // حساب الربح الحقيقي بالدولار مباشرة بناءً على حجم العقود الفعلية المسجلة بالمنصة
      const realUnrealizedUsdt = pos.qty * (currentPrice - entry) * (side === 'buy' ? 1 : -1);
      pos.unrealizedPnlUsdt = realUnrealizedUsdt;
      pos.unrealizedPnlPct = profitLeveragedPct;

      // أ. جني الأرباح الجزئي (50% عند الوصول لـ +35% ربح مضاعف أو +1.2 ATR) وتأمين الوقف بربح صافي +18%
      if (!pos.partial_tp1_done && (profitLeveragedPct >= 35 || profitAtrUnits >= 1.2)) {
        const halfQty = pos.qty * 0.5;
        const partialUsdtPnl = halfQty * (currentPrice - entry) * (side === 'buy' ? 1 : -1);

        if (!isDemo) {
          try {
            const closeQtyStr = formatQuantity(sym, halfQty);
            if (parseFloat(closeQtyStr) > 0) {
              await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
                symbol: getBinanceFuturesSymbol(sym),
                side: side === 'buy' ? 'SELL' : 'BUY',
                type: 'MARKET',
                quantity: closeQtyStr,
                reduceOnly: 'true'
              });
            }
          } catch (err: any) {
            console.warn(`[${profile.name}] Partial close order failed:`, err.message);
          }
        } else {
          botStatus.currentBalance = (botStatus.currentBalance || 0) + partialUsdtPnl;
          profile.balance = botStatus.currentBalance;
        }

        pos.qty = pos.qty - halfQty;
        pos.partial_tp1_done = true;
        pos.breakeven_done = true;

        // قفل الوقف لضمان قفل 50% من الأرباح المحققة (+18% صافي بعد الرافعة)
        const lev = profileSettings.leverage || 20;
        const minProfitPriceDist = (0.18 / lev) * entry + (entry * 0.0022);
        const minProfitSl = side === 'buy' ? entry + minProfitPriceDist : entry - minProfitPriceDist;
        
        const isBetter = side === 'buy' ? minProfitSl > pos.sl : minProfitSl < pos.sl;
        if (isBetter) {
          pos.sl = minProfitSl;
          await syncExchangeStopLoss(profile, sym, pos);
        }

        // 📝 تسجيل الصفقة المجزئة في سجل الصفقات التاريخية للوحة التحكم
        const partialTradeLog: TradeLog = {
          timestamp: new Date().toISOString(),
          symbol: sym,
          side,
          strategy: `${pos.strategy} (جني 50% جزئي)`,
          entry,
          exit: currentPrice,
          tp: pos.tp,
          sl: pos.init_sl,
          pnl_pct_leveraged: profitLeveragedPct,
          pnl_usdt: partialUsdtPnl,
          score: pos.score,
          reason: "جني أرباح جزئي 50% عند +30% ربح 💰 (Partial TP1)",
          profileId: profile.id,
          profileName: profile.name,
          marketStateAtOpen: pos.marketStateAtOpen,
          btcHealthAtOpen: pos.btcHealthAtOpen,
          btcPriceAtOpen: pos.btcPriceAtOpen,
          marketStateAtClose: marketStateAtClose,
          btcHealthAtClose: btcHealthAtClose,
          btcPriceAtClose: btcPriceAtClose,
          strategySummary: generateStrategySummary(
            sym,
            side,
            `${pos.strategy} (جني 50% جزئي)`,
            entry,
            currentPrice,
            profitLeveragedPct,
            partialUsdtPnl,
            "جني أرباح جزئي 50% عند +30% ربح 💰 (Partial TP1)",
            pos.marketStateAtOpen,
            pos.btcHealthAtOpen,
            pos.btcPriceAtOpen,
            marketStateAtClose,
            btcHealthAtClose,
            btcPriceAtClose
          )
        };
        updatedHistory.unshift(partialTradeLog);

        // 📲 إرسال إشعار تلغرام خاص بالصفقة المجزئة على القناة الأساسية
        const partialTpMsg = `<b>💰 صفقة مجزئة: جني أرباح 50% عند +30% ربح</b>\n\n` +
          `👤 <b>الحساب:</b> <code>${profile.name}</code>\n` +
          `🪙 <b>العملة:</b> <code>${sym}</code> (<b>${side === 'buy' ? 'LONG 🟢' : 'SHORT 🔴'}</b>)\n` +
          `💵 <b>سعر الدخول:</b> <code>${entry.toFixed(4)}</code> | <b>سعر الجني:</b> <code>${currentPrice.toFixed(4)}</code>\n` +
          `📈 <b>الربح المحقق:</b> <b>+${profitLeveragedPct.toFixed(2)}%</b> (<code>+${partialUsdtPnl.toFixed(2)} USDT</code>)\n` +
          `🛡️ <b>الإجراء:</b> تم تأمين 50% كاش ونقل الوقف لـ @<code>${pos.sl.toFixed(4)}</code> لحماية المتبقي بربح صافي +15%.`;
        
        sendTelegramNotification(partialTpMsg, profile.settings).catch(err => console.error("Failed to send partial TP notification:", err));

        addLog('trade', `💰 [${profile.name}] تم جني 50% أرباح جزئية لـ ${sym} عند +${profitLeveragedPct.toFixed(1)}%! (+${partialUsdtPnl.toFixed(2)} USDT) تم حجز الأرباح ونقل الوقف لـ @${pos.sl.toFixed(4)} 🛡️`);
        stateModified = true;
      }

      // ب. تخفيض المخاطرة عند -20% خسارة (إغلاق جزئي 50% لحماية المحفظة)
      if (!pos.partial_sl1_done && profitLeveragedPct <= -20) {
        const halfQty = pos.qty * 0.5;
        const partialUsdtLoss = halfQty * (currentPrice - entry) * (side === 'buy' ? 1 : -1);

        if (!isDemo) {
          try {
            const closeQtyStr = formatQuantity(sym, halfQty);
            if (parseFloat(closeQtyStr) > 0) {
              await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
                symbol: getBinanceFuturesSymbol(sym),
                side: side === 'buy' ? 'SELL' : 'BUY',
                type: 'MARKET',
                quantity: closeQtyStr,
                reduceOnly: 'true'
              });
            }
          } catch (err: any) {
            console.warn(`[${profile.name}] Partial loss close order failed:`, err.message);
          }
        } else {
          botStatus.currentBalance = (botStatus.currentBalance || 0) + partialUsdtLoss;
          profile.balance = botStatus.currentBalance;
        }

        pos.qty = pos.qty - halfQty;
        pos.partial_sl1_done = true;

        // 📝 تسجيل إغلاق الخسارة الجزئي في سجل الصفقات التاريخية
        const partialSlTradeLog: TradeLog = {
          timestamp: new Date().toISOString(),
          symbol: sym,
          side,
          strategy: `${pos.strategy} (تخفيض مخاطرة 50%)`,
          entry,
          exit: currentPrice,
          tp: pos.tp,
          sl: pos.init_sl,
          pnl_pct_leveraged: profitLeveragedPct,
          pnl_usdt: partialUsdtLoss,
          score: pos.score,
          reason: "خروج جزئي 50% لحماية الحساب عند -20% خسارة 🛡️",
          profileId: profile.id,
          profileName: profile.name,
          marketStateAtOpen: pos.marketStateAtOpen,
          btcHealthAtOpen: pos.btcHealthAtOpen,
          btcPriceAtOpen: pos.btcPriceAtOpen,
          marketStateAtClose: marketStateAtClose,
          btcHealthAtClose: btcHealthAtClose,
          btcPriceAtClose: btcPriceAtClose,
          strategySummary: generateStrategySummary(
            sym,
            side,
            `${pos.strategy} (تخفيض مخاطرة 50%)`,
            entry,
            currentPrice,
            profitLeveragedPct,
            partialUsdtLoss,
            "خروج جزئي 50% لحماية الحساب عند -20% خسارة 🛡️",
            pos.marketStateAtOpen,
            pos.btcHealthAtOpen,
            pos.btcPriceAtOpen,
            marketStateAtClose,
            btcHealthAtClose,
            btcPriceAtClose
          )
        };
        updatedHistory.unshift(partialSlTradeLog);

        // 📲 إرسال إشعار تلغرام خاص بالخروج الجزئي لحماية الحساب على القناة الأساسية
        const partialSlMsg = `<b>🛡️ صفقة مجزئة: تخفيض مخاطرة جزئي 50%</b>\n\n` +
          `👤 <b>الحساب:</b> <code>${profile.name}</code>\n` +
          `🪙 <b>العملة:</b> <code>${sym}</code> (<b>${side === 'buy' ? 'LONG 🟢' : 'SHORT 🔴'}</b>)\n` +
          `💵 <b>سعر الدخول:</b> <code>${entry.toFixed(4)}</code> | <b>سعر التنفيذ:</b> <code>${currentPrice.toFixed(4)}</code>\n` +
          `📉 <b>الخسارة:</b> <b>${profitLeveragedPct.toFixed(2)}%</b> (<code>${partialUsdtLoss.toFixed(2)} USDT</code>)\n` +
          `⚠️ <b>الإجراء:</b> تم الخروج التلقائي من 50% من كمية الصفقة عند خسارة -20% لحماية المحفظة وتخفيف المخاطر.`;
        
        sendTelegramNotification(partialSlMsg, profile.settings).catch(err => console.error("Failed to send partial SL notification:", err));

        addLog('warn', `🛡️ [${profile.name}] إغلاق جزئي 50% لـ ${sym} عند خسارة -20% لحماية المحفظة (${partialUsdtLoss.toFixed(2)} USDT)`);
        stateModified = true;
      }

      // ج. نظام حماية الأرباح المتصاعد المخصص (Stepped Profit Lock Engine)
      const lev = profileSettings.leverage || 20;
      let lockedProfitTargetPct = 0; // النسبة المئوية للربح المحجوز صافياً بعد الرافعة

      if (profitLeveragedPct >= 100) {
        // عند ربح +100% ➔ يتم قفل ربح +70% صافي على الأقل
        lockedProfitTargetPct = Math.max(70, profitLeveragedPct * 0.70);
      } else if (profitLeveragedPct >= 70) {
        // عند ربح +70% ➔ يتم قفل ربح +45% صافي على الأقل
        lockedProfitTargetPct = Math.max(45, profitLeveragedPct * 0.60);
      } else if (profitLeveragedPct >= 50) {
        // عند ربح +50% ➔ يتم قفل ربح +28% صافي على الأقل
        lockedProfitTargetPct = Math.max(28, profitLeveragedPct * 0.50);
      } else if (profitLeveragedPct >= 30) {
        // عند ربح +30% ➔ يتم قفل +18% ربح صافي على الأقل
        lockedProfitTargetPct = Math.max(18, profitLeveragedPct * 0.50);
      }

      if (lockedProfitTargetPct > 0) {
        const feeMargin = entry * 0.0022; // هامش تغطية العمولات + ربح المحفظة الصافي
        const targetDistance = (lockedProfitTargetPct / 100 / lev) * entry + feeMargin;
        const targetSl = side === 'buy' ? entry + targetDistance : entry - targetDistance;
        const isBetter = side === 'buy' ? targetSl > pos.sl : targetSl < pos.sl;
        if (isBetter) {
          pos.sl = targetSl;
          pos.trailing_sl = targetSl;
          await syncExchangeStopLoss(profile, sym, pos);
          addLog('info', `🛡️ [${profile.name}] حماية أرباح متصاعدة لـ ${sym}: تم رفع الوقف إلى ${targetSl.toFixed(4)} لحجز أرباح +${lockedProfitTargetPct.toFixed(1)}% صافية ومودعة بسيرفر بينانس!`);
          stateModified = true;
        }
      }

      // د. تفعيل حماية التعادل المالي وتأمين العمولات والربح عند الوصول لـ +22% ربح مضاعف (قفل +10% ربح صافي)
      if (!pos.breakeven_done && (profitLeveragedPct >= 22 || profitAtrUnits >= 0.7)) {
        const minBreakevenDist = (0.10 / lev) * entry + (entry * 0.0022); // تغطية عمولات الدخول والخروج + قفل 10% ربح مضاعف صافي
        pos.sl = side === 'buy' ? entry + minBreakevenDist : entry - minBreakevenDist;
        pos.breakeven_done = true;
        await syncExchangeStopLoss(profile, sym, pos);
        addLog('info', `🛡️ [${profile.name}] تأمين التعادل والربح منشط لـ ${sym}! (ربح +${profitLeveragedPct.toFixed(1)}%) تم نقل الوقف لـ @${pos.sl.toFixed(4)} لحجز ربح مؤكد +10% صافي وحماية الصفقة 100%.`);
        stateModified = true;
      }

      // هـ. التحقق من الإغلاق الفعلي (ضرب الهدف TP أو ضرب الوقف SL أو درع الوقاية المطلقة من الخسارة)
      let isClosed = false;
      let closeReason = "";
      const maxDrawdownCap = Math.min(15, profileSettings.maxAllowedDrawdownPct || 15);

      if (side === 'buy') {
        if (currentPrice >= pos.tp) {
          isClosed = true;
          closeReason = "هدف الربح الكامل ✅ (TP)";
        } else if (currentPrice <= pos.sl || profitLeveragedPct <= -maxDrawdownCap) {
          isClosed = true;
          closeReason = profitLeveragedPct <= -maxDrawdownCap 
            ? `درع أقصى خسارة مشدد 🛡️ (إغلاق طارئ حامي عند -${maxDrawdownCap}% ROE)` 
            : "وقف الخسارة / حماية الأرباح 🛡️ (SL)";
        }
      } else {
        if (currentPrice <= pos.tp) {
          isClosed = true;
          closeReason = "هدف الربح الكامل ✅ (TP)";
        } else if (currentPrice >= pos.sl || profitLeveragedPct <= -maxDrawdownCap) {
          isClosed = true;
          closeReason = profitLeveragedPct <= -maxDrawdownCap 
            ? `درع أقصى خسارة مشدد 🛡️ (إغلاق طارئ حامي عند -${maxDrawdownCap}% ROE)` 
            : "وقف الخسارة / حماية الأرباح 🛡️ (SL)";
        }
      }

      if (isClosed) {
        const finalProfitRaw = side === 'buy' ? (currentPrice - entry) / entry : (entry - currentPrice) / entry;
        const leveragedProfitPct = finalProfitRaw * profileSettings.leverage * 100;
        
        // حساب الربح الحقيقي الدقيق بالـ USDT بناءً على المتبقي
        const profitUsdt = pos.qty * (currentPrice - entry) * (side === 'buy' ? 1 : -1);

        // 🚫 حظر الاستراتيجية المحددة للعملة فوراً إذا انتهت الصفقة بخسارة ومتابعة الخسائر المتتالية
        if (leveragedProfitPct < 0 || profitUsdt < 0) {
          banStrategyForSymbol(sym, pos.strategy || "Unknown Strategy", `خسارة صفقة بنسبة ${leveragedProfitPct.toFixed(2)}% (${profitUsdt.toFixed(2)} USDT) - إغلاق: ${closeReason}`);
          profile.consecutiveLosses = (profile.consecutiveLosses || 0) + 1;
          if (profile.consecutiveLosses >= 2) {
            const pauseEnd = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            profile.consecutiveLossesPausedUntil = pauseEnd;
            profile.consecutiveLossesPaused = true;
            profile.doubleNextTradeSize = true;
            addLog('warn', `🛡️ [${profile.name}] تم تسجيل خسارتين متتاليتين! تفعيل نظام حماية رأس المال: إيقاف التداول لمدة 30 دقيقة ومضاعفة قيمة الدخول بالصفقة التالية.`);
          }
        } else if (leveragedProfitPct > 0 || profitUsdt > 0) {
          profile.consecutiveLosses = 0;
        }

        if (isDemo) {
          botStatus.currentBalance = (botStatus.currentBalance || 0) + profitUsdt;
          profile.balance = botStatus.currentBalance;
        } else {
          try {
            const closeQtyStr = formatQuantity(sym, pos.qty);
            if (parseFloat(closeQtyStr) > 0) {
              await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
                symbol: getBinanceFuturesSymbol(sym),
                side: side === 'buy' ? 'SELL' : 'BUY',
                type: 'MARKET',
                quantity: closeQtyStr,
                reduceOnly: 'true'
              });
            } else {
              addLog('warn', `⚠️ [${profile.name}] كمية الإغلاق لـ ${sym} صغيرة جداً (${pos.qty})، تم تجاوز إغلاق الأمر الحقيقي.`);
            }
          } catch (err: any) {
            addLog('error', `❌ [${profile.name}] فشل إغلاق الصفقة الفعلي على بينانس لـ ${sym}: ${err.message}`);
          }
        }

        const tradeDate = new Date();
        const hourOfDay = tradeDate.getHours();
        const dayOfWeek = tradeDate.getDay();
        const diag = generateTradeDiagnostics(
          sym,
          side,
          pos.strategy,
          leveragedProfitPct,
          profitUsdt,
          closeReason,
          pos.btcHealthAtOpen,
          btcHealthAtClose,
          hourOfDay
        );

        const newTrade: TradeLog = {
          timestamp: tradeDate.toISOString(),
          symbol: sym,
          side,
          strategy: pos.partial_tp1_done ? `${pos.strategy} (متبقي 50%)` : pos.strategy,
          entry,
          exit: currentPrice,
          tp: pos.tp,
          sl: pos.init_sl,
          pnl_pct_leveraged: leveragedProfitPct,
          pnl_usdt: profitUsdt,
          score: pos.score,
          reason: closeReason,
          profileId: profile.id,
          profileName: profile.name,
          marketStateAtOpen: pos.marketStateAtOpen,
          btcHealthAtOpen: pos.btcHealthAtOpen,
          btcPriceAtOpen: pos.btcPriceAtOpen,
          marketStateAtClose: marketStateAtClose,
          btcHealthAtClose: btcHealthAtClose,
          btcPriceAtClose: btcPriceAtClose,
          hourOfDay,
          dayOfWeek,
          diagnosticReason: diag.diagnosticReason,
          aiRecommendation: diag.aiRecommendation,
          strategySummary: generateStrategySummary(
            sym,
            side,
            pos.partial_tp1_done ? `${pos.strategy} (متبقي 50%)` : pos.strategy,
            entry,
            currentPrice,
            leveragedProfitPct,
            profitUsdt,
            closeReason,
            pos.marketStateAtOpen,
            pos.btcHealthAtOpen,
            pos.btcPriceAtOpen,
            marketStateAtClose,
            btcHealthAtClose,
            btcPriceAtClose
          )
        };

        updatedHistory.unshift(newTrade);

        // 📲 إرسال إشعار التلغرام لصفقة مغلقة بالكامل على القناة الأساسية (المخصصة للمغلقة والمجزئة)
        const outcomeEmoji = leveragedProfitPct >= 0 ? "🎯" : "🛑";
        const outcomeHeader = leveragedProfitPct >= 0 ? `<b>🏁 صفقة مغلقة بنجاح (بربح) ${outcomeEmoji}</b>` : `<b>🏁 صفقة مغلقة (بوقف خسارة) ${outcomeEmoji}</b>`;
        const closeMsg = `${outcomeHeader}\n👤 <b>الحساب:</b> <code>${profile.name}</code>\n\n${newTrade.strategySummary}`;

        sendTelegramNotification(closeMsg, profile.settings).catch(err => console.error("Failed to send Telegram close notification:", err));

        delete updatedPositions[key];
        stateModified = true;
        addLog('trade', `🏁 [${profile.name}] صفقة مغلقة: ${sym} | الاتجاه: ${side === 'buy' ? 'LONG' : 'SHORT'} | الربح: ${leveragedProfitPct > 0 ? '+' : ''}${leveragedProfitPct.toFixed(2)}% | السبب: ${closeReason} | قيمة الربح: ${profitUsdt > 0 ? '+' : ''}$${profitUsdt.toFixed(2)}`);
      }
    } catch (err) {
      console.error("Error managing position:", err);
    }
  }

  // 2. مراجعة وتجربة ومتابعة الأوامر المعلقة Limit Orders وملاحقة السعر وإلغاؤها عند انعكاس السوق
  const btcHealthCurrent = botStatus.btcHealth || "GREEN";
  let btcTrendCurrent: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
  try {
    const btc5mK = await fetchKlines('BTC/USDT', '5m', 20);
    if (btc5mK && btc5mK.length >= 10) {
      const btcProcessed = processCandles(btc5mK);
      const btcLast = btcProcessed[btcProcessed.length - 1];
      if (btcLast.ema14 >= btcLast.ema34 && btcLast.rsi >= 48) btcTrendCurrent = 'UP';
      else if (btcLast.ema14 <= btcLast.ema34 && btcLast.rsi <= 52) btcTrendCurrent = 'DOWN';
    }
  } catch (e) {}

  for (const key of Object.keys(updatedPending)) {
    const pend = updatedPending[key];
    const profileId = pend.profileId || "demo";
    let profile = botStatus.apiProfiles.find(p => p.id === profileId);
    
    if (!profile && profileId === "demo") {
      profile = {
        id: "demo",
        name: "الحساب التجريبي الافتراضي",
        apiKey: "",
        apiSecret: "",
        isActive: true,
        isDemo: true,
        balance: botStatus.currentBalance,
        initialBalance: botStatus.initialBalance,
        settings: botStatus.settings
      };
    }
    
    if (!profile) continue;
    if (!profile.isActive) continue;

    const profileSettings = profile.settings || settings;
    const isDemo = profile.isDemo;
    const sym = pend.symbol;
    const ageMs = Date.now() - new Date(pend.time).getTime();
    const timeoutMs = profileSettings.reversalOrderTimeoutMin * 60 * 1000;

    // أ. إلغاء الأمر إذا تجاوز مهلة الانتظار المحددة
    if (ageMs > timeoutMs) {
      if (!isDemo) {
        try {
          await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
            symbol: getBinanceFuturesSymbol(sym),
            orderId: pend.order_id
          });
        } catch (err) {}
      }
      delete updatedPending[key];
      stateModified = true;
      addLog('info', `🗑️ [${profile.name}] تم إلغاء أمر الحد المعلق للعملة ${sym} بسبب انتهاء مهلة الانتظار (${profileSettings.reversalOrderTimeoutMin} دقيقة).`);
      continue;
    }

    try {
      // ب. فحص انعكاس اتجاه البيتكوين والسوق (حماية فورية وإلغاء تلقائي)
      if (btcHealthCurrent === 'RED') {
        if (!isDemo) {
          try {
            await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
              symbol: getBinanceFuturesSymbol(sym),
              orderId: pend.order_id
            });
          } catch (e) {}
        }
        delete updatedPending[key];
        stateModified = true;
        addLog('warn', `🚨 [${profile.name}] تم إلغاء أمر ${sym} المعلق فوراً بسبب هبوط حاد في البيتكوين والسوق (BTC RED) لحماية المحفظة.`);
        continue;
      }

      if (pend.entry_dir === 'buy' && btcTrendCurrent === 'DOWN') {
        if (!isDemo) {
          try {
            await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
              symbol: getBinanceFuturesSymbol(sym),
              orderId: pend.order_id
            });
          } catch (e) {}
        }
        delete updatedPending[key];
        stateModified = true;
        addLog('info', `🗑️ [${profile.name}] تم إلغاء أمر شراء ${sym} المعلق بسبب تحول اتجاه البيتكوين والسوق للهبوط (BTC Bear Trend).`);
        continue;
      }

      if (pend.entry_dir === 'sell' && btcTrendCurrent === 'UP') {
        if (!isDemo) {
          try {
            await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
              symbol: getBinanceFuturesSymbol(sym),
              orderId: pend.order_id
            });
          } catch (e) {}
        }
        delete updatedPending[key];
        stateModified = true;
        addLog('info', `🗑️ [${profile.name}] تم إلغاء أمر بيع ${sym} المعلق بسبب تحول اتجاه البيتكوين والسوق للصعود (BTC Bull Trend).`);
        continue;
      }

      const currentPrice = await fetchTickerPrice(sym);
      const entryDir = pend.entry_dir || 'buy';

      // ج. فحص الشموع اللحظية للعملة (إلغاء عند الشموع العنيفة المعاكسة catch falling knife)
      const klines5m = await fetchKlines(sym, "5m", 15);
      if (klines5m && klines5m.length >= 5) {
        const rich5m = processCandles(klines5m);
        const lastCandle = rich5m[rich5m.length - 1];
        if (entryDir === 'buy' && lastCandle.is_bear && lastCandle.body > lastCandle.atr * 1.5) {
          if (!isDemo) {
            try {
              await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
                symbol: getBinanceFuturesSymbol(sym),
                orderId: pend.order_id
              });
            } catch (e) {}
          }
          delete updatedPending[key];
          stateModified = true;
          addLog('warn', `🗑️ [${profile.name}] تم إلغاء أمر شراء ${sym} المعلق لتجنب هبوط عنيف مفاجئ للشمعة الحالية.`);
          continue;
        }
        if (entryDir === 'sell' && lastCandle.is_bull && lastCandle.body > lastCandle.atr * 1.5) {
          if (!isDemo) {
            try {
              await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
                symbol: getBinanceFuturesSymbol(sym),
                orderId: pend.order_id
              });
            } catch (e) {}
          }
          delete updatedPending[key];
          stateModified = true;
          addLog('warn', `🗑️ [${profile.name}] تم إلغاء أمر بيع ${sym} المعلق لتجنب صعود عنيف مفاجئ للشمعة الحالية.`);
          continue;
        }
      }

      // د. متابعة وملاحقة السعر (Price Chasing Engine)
      let idealLimitPrice = pend.limit_price;
      if (entryDir === 'buy') {
        if (currentPrice < pend.limit_price) {
          idealLimitPrice = Math.min(currentPrice, pend.limit_price);
        } else if (currentPrice > pend.limit_price * 1.002) {
          idealLimitPrice = Math.min(currentPrice * 0.9995, pend.limit_price * 1.0015);
        }
      } else {
        if (currentPrice > pend.limit_price) {
          idealLimitPrice = Math.max(currentPrice, pend.limit_price);
        } else if (currentPrice < pend.limit_price * 0.998) {
          idealLimitPrice = Math.max(currentPrice * 1.0005, pend.limit_price * 0.9985);
        }
      }

      const priceShiftPct = Math.abs(idealLimitPrice - pend.limit_price) / pend.limit_price;
      if (priceShiftPct >= 0.0015 && ageMs > 10000) {
        if (!isDemo && /^\d+$/.test(String(pend.order_id))) {
          try {
            await callBinanceFutures(profile.apiKey, profile.apiSecret, 'DELETE', '/fapi/v1/order', {
              symbol: getBinanceFuturesSymbol(sym),
              orderId: pend.order_id
            });

            const formattedPriceStr = formatPrice(sym, idealLimitPrice);
            const formattedQtyStr = formatQuantity(sym, pend.qty);

            const newBinanceOrder = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
              symbol: getBinanceFuturesSymbol(sym),
              side: entryDir === 'buy' ? 'BUY' : 'SELL',
              type: 'LIMIT',
              timeInForce: 'GTC',
              quantity: formattedQtyStr,
              price: formattedPriceStr
            });

            if (newBinanceOrder && newBinanceOrder.orderId) {
              const oldPrice = pend.limit_price;
              pend.limit_price = parseFloat(formattedPriceStr);
              pend.order_id = String(newBinanceOrder.orderId);
              pend.time = new Date().toISOString();
              stateModified = true;
              addLog('info', `🔄 [${profile.name}] تم تحديث وملاحقة أمر ${sym} المعلق من ${oldPrice.toFixed(4)} ➔ ${formattedPriceStr} لتحديث التنفيذ المباشر!`);
            }
          } catch (chaseErr: any) {
            console.warn(`[Order Chase] Failed to update order for ${sym}:`, chaseErr.message);
          }
        } else if (isDemo) {
          const oldPrice = pend.limit_price;
          pend.limit_price = idealLimitPrice;
          pend.time = new Date().toISOString();
          stateModified = true;
          addLog('info', `🔄 [${profile.name}] (تجريبي) تم تحديث سعر الدخول المعلق لـ ${sym} من ${oldPrice.toFixed(4)} ➔ ${idealLimitPrice.toFixed(4)}.`);
        }
      }

      // هـ. فحص التنفيذ (Fill Check)
      let isFilled = false;
      let actualEntryPrice = pend.limit_price;

      if (isDemo) {
        if (entryDir === 'buy') {
          if (currentPrice <= pend.limit_price * 1.001 || ageMs >= 5000) {
            isFilled = true;
            actualEntryPrice = currentPrice;
          }
        } else {
          if (currentPrice >= pend.limit_price * 0.999 || ageMs >= 5000) {
            isFilled = true;
            actualEntryPrice = currentPrice;
          }
        }
      } else {
        try {
          if (!/^\d+$/.test(String(pend.order_id))) {
            delete updatedPending[key];
            stateModified = true;
            continue;
          }

          const orderStatus = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'GET', '/fapi/v1/order', {
            symbol: getBinanceFuturesSymbol(sym),
            orderId: pend.order_id
          });
          if (orderStatus.status === 'FILLED' || orderStatus.status === 'filled') {
            isFilled = true;
            actualEntryPrice = parseFloat(orderStatus.avgPrice || orderStatus.price || pend.limit_price);
          } else if (
            orderStatus.status === 'CANCELED' ||
            orderStatus.status === 'canceled' ||
            orderStatus.status === 'EXPIRED' ||
            orderStatus.status === 'REJECTED' ||
            orderStatus.status === 'EXPIRED_IN_MATCH'
          ) {
            delete updatedPending[key];
            stateModified = true;
            continue;
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          if (errMsg.includes('-2013') || errMsg.includes('Order does not exist') || errMsg.includes('2013')) {
            delete updatedPending[key];
            stateModified = true;
            addLog('info', `🗑️ [${profile.name}] الأمر ${sym} غير موجود أو تم إلغاؤه على بينانس، تم تنظيفه تلقائياً.`);
            continue;
          } else {
            console.error(`[Order Check] Error checking order status for ${sym}:`, errMsg);
          }
        }
      }

      if (isFilled) {
        const atrValue = pend.atr_value;
        const leverage = profileSettings.leverage || 20;
        const atr = atrValue && atrValue > 0 ? atrValue : actualEntryPrice * 0.015;

        // 1. 🛡️ درع حماية التصفية (Liquidation Shield):
        // الوقف أقصاه -15% خسارة رافعة (ضبط خسارة الخاسرة)
        const hardLiquidationShieldMaxDist = actualEntryPrice * (0.15 / leverage);
        let slDist = Math.min(atr * 1.0, hardLiquidationShieldMaxDist);
        if (slDist <= 0) slDist = hardLiquidationShieldMaxDist;

        // 2. حساب هدف الربح المستهدف بضمان نسبة مخاطرة لمكافأة إيجابية لا تقل عن 1 : 2.2
        const minTpFromSl = slDist * 2.2;
        const tpFromAtr = atr * 3.0;
        const tpFromScalp = actualEntryPrice * (0.08 / leverage);

        let tpDist = Math.max(minTpFromSl, tpFromAtr, tpFromScalp);

        let tpPrice = actualEntryPrice + tpDist;
        let slPrice = actualEntryPrice - slDist;
        if (entryDir === 'sell') {
          tpPrice = actualEntryPrice - tpDist;
          slPrice = actualEntryPrice + slDist;
        }

        if (isDemo) {
          botStatus.currentBalance = (botStatus.currentBalance || 0) - profileSettings.baseUsdt * 0.0006;
          profile.balance = botStatus.currentBalance;
        }

        const newPos: Position = {
          symbol: sym,
          side: entryDir,
          strategy: pend.strategy,
          score: pend.score,
          entry: actualEntryPrice,
          qty: pend.qty,
          initial_qty: pend.qty,
          tp: tpPrice,
          sl: slPrice,
          init_sl: slPrice,
          trailing_sl: null,
          atr_value: atrValue,
          partial_tp1_done: false,
          partial_tp2_done: false,
          breakeven_done: false,
          time: new Date().toISOString(),
          profileId: profile.id,
          marketStateAtOpen: pend.marketStateAtOpen,
          btcHealthAtOpen: pend.btcHealthAtOpen,
          btcPriceAtOpen: pend.btcPriceAtOpen
        };

        updatedPositions[key] = newPos;
        delete updatedPending[key];
        stateModified = true;

        // 🔒 إيداع وقفل أمر وقف الخسارة المباشر فوراً على سيرفرات بينانس (STOP_MARKET) لمنع التصفية 100%!
        if (!isDemo) {
          await syncExchangeStopLoss(profile, sym, newPos);
        }

        addLog('trade', `🚀 [${profile.name}] تم تفعيل صفقة حية: ${sym} | دخول: ${actualEntryPrice.toFixed(4)} | هدف الربح: ${tpPrice.toFixed(4)} | وقف الخسارة: ${slPrice.toFixed(4)} (وقف محمي ومودع بسيرفر بينانس)`);

        // 📲 إرسال إشارة فورية لقناة التلغرام عند تفعيل الصفقة بنجاح
        const fillSignalMsg = `<b>🚀 تم تنفيذ وتفعيل صفقة فورية حية على المنصة! 🔥</b>
-----------------------------------
🪙 <b>العملة:</b> <code>${sym}</code>
📈 <b>الاتجاه:</b> <b>${entryDir === 'buy' ? '🟢 شراء (LONG)' : '🔴 بيع (SHORT)'}</b>
💵 <b>سعر التنفيذ المباشر:</b> <code>${actualEntryPrice.toFixed(4)}</code>
🎯 <b>هدف جني الأرباح (TP):</b> <code>${tpPrice.toFixed(4)}</code>
🛡️ <b>وقف الخسارة المباشر (SL):</b> <code>${slPrice.toFixed(4)}</code> (مودع ومحمي بسيرفر بينانس)
🔥 <b>الرافعة المالية:</b> <code>${leverage}x</code>
📦 <b>الكمية المفعلة:</b> <code>${pend.qty.toFixed(4)}</code>
💡 <b>الاستراتيجية:</b> <code>${pend.strategy}</code>
👤 <b>الحساب المفعل:</b> <code>${profile.name}</code>
-----------------------------------
⚡ <i>الصفقة قيد المتابعة الحية مع حماية الأرباح المتصاعدة وتفادي التصفية 100%.</i>`;

        sendTelegramSignalsNotification(fillSignalMsg, profile.settings).catch(err => console.error("Failed to send fill signal notification:", err));
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (stateModified) {
    botStatus.positions = updatedPositions;
    botStatus.pendingOrders = updatedPending;
    botStatus.tradeHistory = updatedHistory;

    // تحديث وتجميع الرصيد والربح الإجمالي عبر الحسابات النشطة
    const activeProfiles = botStatus.apiProfiles.filter(p => p.isActive);
    if (activeProfiles.length > 0) {
      let totalBal = 0;
      let totalInitBal = 0;
      activeProfiles.forEach(p => {
        totalBal += p.balance || 0;
        totalInitBal += p.initialBalance || 0;
      });
      botStatus.currentBalance = totalBal;
      botStatus.initialBalance = totalInitBal;
      botStatus.dailyPnlPct = totalInitBal > 0 ? ((totalBal - totalInitBal) / totalInitBal) * 100 : 0.0;
    }

    saveState();
  }
} catch (err: any) {
  console.error("Error in runRealtimeCheck:", err.message);
} finally {
  isRealtimeChecking = false;
}
}

async function runMarketScanningCycle() {
  if (!botStatus.isRunning) return;
  if (isScanning) return;
  isScanning = true;

  try {
    const activeProfiles = botStatus.apiProfiles.filter(p => p.isActive);
    if (activeProfiles.length === 0) return;

    const settings = botStatus.settings;

    // 1. جلب رصيد منصة بينانس الفعلي لكافة الحسابات الحقيقية النشطة
    for (const profile of activeProfiles) {
      if (!profile.isDemo) {
        try {
          const balData = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'GET', '/fapi/v2/balance');
          const usdtBal = balData.find((b: any) => b.asset === 'USDT');
          if (usdtBal) {
            const currentUsdt = parseFloat(usdtBal.balance);
            profile.balance = currentUsdt;
            if (profile.initialBalance === undefined || profile.initialBalance === 0) {
              profile.initialBalance = currentUsdt;
            }
          }
        } catch (err: any) {
          console.warn(`Real balance fetch failed for ${profile.name}:`, err);
        }
      }
    }

    // تحديث وتجميع الرصيد والربح الإجمالي
    let totalBal = 0;
    let totalInitBal = 0;
    activeProfiles.forEach(p => {
      if (p.balance === undefined) p.balance = p.isDemo ? settings.demoBalance : 0.0;
      if (p.initialBalance === undefined) p.initialBalance = p.isDemo ? settings.demoBalance : 0.0;
      totalBal += p.balance;
      totalInitBal += p.initialBalance;
    });
    botStatus.currentBalance = totalBal;
    botStatus.initialBalance = totalInitBal;
    botStatus.dailyPnlPct = totalInitBal > 0 ? ((totalBal - totalInitBal) / totalInitBal) * 100 : 0.0;
    saveState();

    // Check BTC Health before initiating new positions
    const btcHealth = await checkBTCHealth();
    let btcPrice = 60000;
    try {
      btcPrice = await fetchTickerPrice("BTC/USDT");
    } catch (err) {
      console.warn("Failed to fetch BTC price inside scanning cycle:", err);
    }
    if (btcHealth === 'RED') {
      addLog('warn', `🚨 [حارس السحابة] فحص صحة البيتكوين يظهر هبوطاً حاداً أو شمعة بيع عنيفة (RED state)، ولكن نتابع التداول التلقائي بناءً على رغبتك دون توقف.`);
    }

    addLog('info', `🔍 جاري بدء دورة فحص السوق لـ ${settings.selectedSymbols.length} عملة. حالة بيتكوين الحالية: ${btcHealth === 'GREEN' ? '🟢 مستقرة' : btcHealth === 'RED' ? '🔴 هابطة (مستمر بالتداول)' : '🟡 حذرة'}.`);

    // 🕒 حارس الساعات الخاسرة التلقائي (Auto Time-Window Guard)
    const autoTimeGuard = settings.autoTimeGuardEnabled !== false;
    if (autoTimeGuard && botStatus.tradeHistory.length >= 5) {
      const currentHour = new Date().getHours();
      const hourTrades = botStatus.tradeHistory.filter(t => {
        if (!t.timestamp) return false;
        const h = new Date(t.timestamp).getHours();
        return h === currentHour;
      }).slice(0, 30);

      if (hourTrades.length >= 3) {
        const winningTrades = hourTrades.filter(t => (t.pnl_usdt || 0) > 0 || (t.pnl_pct_leveraged || 0) > 0).length;
        const winRatePct = (winningTrades / hourTrades.length) * 100;
        const minWinRate = settings.minTimeSlotWinRatePct || 40;

        if (winRatePct < minWinRate) {
          botStatus.timeGuardPaused = true;
          botStatus.timeGuardReason = `الساعة الحالية (${currentHour}:00 - ${(currentHour + 1) % 24}:00) سجلت نسبة نجاح منخفضة (${winRatePct.toFixed(0)}%) في السجل التاريخي. تم تعليق التداول التلقائي حماية للأرباح.`;
          addLog('warn', `⏸️ [حارس الساعات السلبية] تعليق الدخول في صفقات جديدة خلال الساعة الحالية (${currentHour}:00) لأن نسبة النجاح التاريخية فيها هي ${winRatePct.toFixed(0)}% (أقل من ${minWinRate}%). سيستأنف البوت العمل تلقائياً فور الانتقال لساعة ذات عائد مرتفع.`);
          return;
        }
      }
    }
    botStatus.timeGuardPaused = false;
    botStatus.timeGuardReason = undefined;

    // فحص حالة التوقف المؤقت وإلغائها بعد انقضاء الـ 30 دقيقة لنظام حماية رأس المال
    for (const profile of activeProfiles) {
      if (profile.consecutiveLossesPausedUntil) {
        const pauseEnd = new Date(profile.consecutiveLossesPausedUntil).getTime();
        if (Date.now() < pauseEnd) {
          profile.consecutiveLossesPaused = true;
        } else {
          profile.consecutiveLossesPausedUntil = undefined;
          profile.consecutiveLossesPaused = false;
          profile.consecutiveLosses = 0;
          addLog('info', `✅ [${profile.name}] انقضت فترة التوقف المؤقت (30 دقيقة). تم استئناف التداول ومضاعفة قيمة الدخول بالصفقة التالية تلقائياً.`);
        }
      } else {
        profile.consecutiveLossesPaused = false;
      }
      profile.pausedMarketState = undefined;
    }

    let nextPending = { ...botStatus.pendingOrders };
    let stateChanged = false;

    // 🪙 تحليل اتجاه البيتكوين القيادي العام لمنع التداول عكس اتجاه السوق نهائياً
    let btcGlobalTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    try {
      const btc5mKlines = await fetchKlines('BTC/USDT', '5m', 50);
      const btc15mKlines = await fetchKlines('BTC/USDT', '15m', 50);
      if (btc5mKlines && btc15mKlines && btc5mKlines.length >= 20 && btc15mKlines.length >= 20) {
        const btc5m = processCandles(btc5mKlines);
        const btc15m = processCandles(btc15mKlines);
        const last5m = btc5m[btc5m.length - 1];
        const last15m = btc15m[btc15m.length - 1];

        const isBtcBull = (last5m.ema14 >= last5m.ema34 && last15m.close >= last15m.ema34 && last5m.rsi >= 46);
        const isBtcBear = (last5m.ema14 <= last5m.ema34 && last15m.close <= last15m.ema34 && last5m.rsi <= 54);

        if (isBtcBull) btcGlobalTrend = 'UP';
        else if (isBtcBear) btcGlobalTrend = 'DOWN';
      }
    } catch (btcErr) {
      // fallback sideways
    }

    // 🪙 تسجيل حالة البيتكوين العامة وإتاحة التداول بحسب أقسام العملات (القسم الأول للعملات العادية والقسم الثاني لعملات التحوط)
    addLog('info', `📊 [حالة اتجاه البيتكوين] اتجاه BTC الحالي: ${btcGlobalTrend === 'UP' ? 'صاعد (🟢)' : btcGlobalTrend === 'DOWN' ? 'هابط (🔴)' : 'حذر / مستقر (🟡)'}. يتم توجيه الدخول حسب تصنيف العملة (قسم 1 عادي | قسم 2 تحوط).`);

    const activeSymbolsToScan = cleanSymbols(settings.selectedSymbols);
    for (const symbol of activeSymbolsToScan) {
      try {
        // الفحص لكل حساب نشط على حدة
        for (const profile of activeProfiles) {
          // تخطي الحساب إذا كان في حالة إيقاف مؤقت بسبب الخسائر المتتالية
          if (profile.consecutiveLossesPaused) {
            continue;
          }

          const profileSettings = profile.settings || settings;
          const key = `${profile.id}_${symbol}`;
          
          // منع التكرار المطلق للعملة: إذا كانت هناك صفقة مفتوحة أو أمر معلق لنفس العملة في أي حساب، نتخطاه تماماً لتجنب التكرار
          const hasActivePosition = Object.values(botStatus.positions).some((p: any) => p.symbol === symbol);
          const hasPendingInState = Object.values(botStatus.pendingOrders).some((p: any) => p.symbol === symbol);
          const hasPendingInCurrentLoop = Object.values(nextPending).some((p: any) => p.symbol === symbol);

          if (hasActivePosition || hasPendingInState || hasPendingInCurrentLoop) {
            continue;
          }

          // التحقق من الحد الأقصى للصفقات المفتوحة لهذا الحساب
          const activePositions = Object.values(botStatus.positions).filter((p: any) => p.profileId === profile.id);
          const profilePositionsCount = activePositions.length;
          if (profilePositionsCount >= settings.maxOpenPositions) {
            continue; // هذا الحساب ممتلئ
          }

          // تجنب الدخول الفوري بعد الإغلاق لنفس العملة والحساب (Cooldown)
          const lastClose = botStatus.tradeHistory.find(t => t.symbol === symbol && t.profileId === profile.id);
          if (lastClose) {
            const minutesSinceClose = (Date.now() - new Date(lastClose.timestamp).getTime()) / 60000;
            if (minutesSinceClose < settings.cooldownMinutes) continue;
          }

          // 📊 التحليل الفني الثلاثي + الفريم الكبير 4H (1m ، 5m ، 15m ، 4h)
          const klines1m = await fetchKlines(symbol, "1m", 60);
          const klines5m = await fetchKlines(symbol, "5m", 60);
          const klines15m = await fetchKlines(symbol, "15m", 60);
          const klines4h = await fetchKlines(symbol, "4h", 40);

          if (!klines5m || klines5m.length < 30) continue;

          const rich1m = klines1m && klines1m.length >= 20 ? processCandles(klines1m) : null;
          const rich5m = processCandles(klines5m);
          const rich15m = klines15m && klines15m.length >= 20 ? processCandles(klines15m) : rich5m;
          const rich4h = klines4h && klines4h.length >= 10 ? processCandles(klines4h) : null;
          const macro4h = rich4h ? check4HourMacroState(rich4h) : undefined;

          // حساب الارتباط الديناميكي مع البيتكوين على شارت 5m
          let correlation = 0.50; // افتراضي للمجموعة ب
          let group: 'A' | 'B' | 'C' = 'B';
          let groupLeverage = profileSettings.leverage || settings.leverage || 20;

          try {
            const btc5mKlines = await fetchKlines('BTC/USDT', '5m', 50);
            const coin5mKlines = klines5m;
            if (btc5mKlines && coin5mKlines && btc5mKlines.length >= 20 && coin5mKlines.length >= 20) {
              const btcCloses = btc5mKlines.map((c: any) => parseFloat(c[4]));
              const coinCloses = coin5mKlines.map((c: any) => parseFloat(c[4]));
              correlation = calculateCorrelation(coinCloses, btcCloses);
            }
          } catch (corrErr) {
            // ignore, fallbacks to 0.50 Group B
          }

          // احترام قيمة الرافعة المالية المحددة بدقة من إعدادات الحساب أينما أُسندت (مثلاً 20x، 50x، إلخ)
          const configuredLeverage = profileSettings.leverage || settings.leverage || 20;
          groupLeverage = configuredLeverage;

          if (correlation > 0.75) {
            group = 'A';
          } else if (correlation >= 0.40 && correlation <= 0.75) {
            group = 'B';
          } else {
            group = 'C';
          }

          // التحقق من حدود مجموعات الارتباط لتجنب تكدس المخاطر
          const countGroupA = activePositions.filter((p: any) => p.strategy?.includes("Group A")).length;
          const countGroupB = activePositions.filter((p: any) => p.strategy?.includes("Group B")).length;
          const countGroupC = activePositions.filter((p: any) => p.strategy?.includes("Group C")).length;

          if (group === 'A' && countGroupA >= 2) continue;
          if (group === 'B' && countGroupB >= 3) continue;
          if (group === 'C' && countGroupC >= 5) continue;

          // 🪙 فحص تصنيف العملة وقواعد الدخول حسب حالة البيتكوين (القسم الأول vs القسم الثاني عملات التحوط)
          const isHedge = isHedgeCoin(symbol, correlation);

          if (!isHedge) {
            // القسم الأول (عملات ترتفع بارتفاع واستقرار البيتكوين):
            // شروط الصفقات: تُنفّذ الصفقات عندما تكون حالة البيتكوين صاعدة (🟢) أو حذرة/مستقرة (🟡).
            // الحظر: يُحظر فتح صفقات جديدة على هذه العملات فوراً عندما تكون حالة البيتكوين هابطة (🔴).
            if (btcGlobalTrend === 'DOWN') {
              addLog('info', `[BTC Filter - القسم الأول] ⛔ تم حظر دخول صفقات جديدة على ${symbol} لأن حالة البيتكوين هابطة (🔴). العملات العادية تتطلب صعود 🟢 أو استقرار 🟡 البيتكوين.`);
              continue;
            }
          } else {
            // القسم الثاني (عملات التحوط التي ترتفع مع هبوط وتذبذب البيتكوين):
            // شروط الصفقات: تُنفّذ الصفقات عندما تكون حالة البيتكوين في تذبذب/استقرار (🟡) أو هابطة (🔴).
            // الحظر: يُحظر فتح صفقات جديدة على هذه العملات فوراً عندما تكون حالة البيتكوين في صعود حاد (🟢).
            if (btcGlobalTrend === 'UP') {
              addLog('info', `[BTC Filter - القسم الثاني (تحوط)] ⛔ تم حظر دخول صفقات جديدة على عملة التحوط ${symbol} لأن حالة البيتكوين في صعود حاد (🟢). عملات التحوط تتداول فقط عند تذبذب 🟡 أو هبوط 🔴 البيتكوين.`);
              continue;
            }
          }

          const marketState = classifyMarketState(rich5m);

          // 1. الكشف عن الإشارات على فريم 5 دقائق الرئيسي وفريم 1 دقيقة السريع مخصصاً حسب العملة
          const signals5m = detectStrategies(rich5m, settings, symbol);
          const signals1m = rich1m ? detectStrategies(rich1m, settings, symbol) : [];
          const combinedSignals = [...signals5m, ...signals1m];

          if (combinedSignals.length === 0) continue;

          for (const sig of combinedSignals) {
            // 🚫 فحص حظر الاستراتيجية المحددة للعملة عند وجود خسارة سابقة
            if (isStrategyBannedForSymbol(symbol, sig.name)) {
              addLog('info', `[Strategy Ban Filter] ⛔ تم استبعاد الإشارة ${sig.name} للعملة ${symbol} لأن هذه الاستراتيجية محظورة على هذه العملة بسبب خسارة صفقة سابقة.`);
              continue;
            }

            const { shouldEnter, reason: enterReason } = shouldEnterTrade(rich5m, rich15m, sig, marketState, profileSettings || settings, macro4h);
            if (!shouldEnter) {
              continue; // تم استبعاد الإشارة بناءً على فلاتر السيولة والاتجاه والتقلبات لضمان عدم الخسارة
            }

            // تأكيد المايكرو-زخم على فريم الـ 1m للفلترة الدقيقة
            if (rich1m && rich1m.length > 0) {
              const last1m = rich1m[rich1m.length - 1];
              if (sig.dir === 'buy' && last1m.is_bear && last1m.body > last1m.atr * 1.5) {
                // شمعة هبوطية قوية جداً على 1m، نتأنى دخول الشراء لحظياً
                continue;
              }
              if (sig.dir === 'sell' && last1m.is_bull && last1m.body > last1m.atr * 1.5) {
                // شمعة صعودية قوية جداً على 1m، نتأنى دخول البيع لحظياً
                continue;
              }
            }

            const origDir = sig.dir;
            const { score, breakdown } = calculateScore(rich5m, origDir, sig.name);

            const entryDir: 'buy' | 'sell' = origDir;

            let limitPrice = entryDir === 'buy' ? sig.low : sig.high;
            if (rich5m && rich5m.length > 0) {
              const currentClosePrice = rich5m[rich5m.length - 1].close;
              if (entryDir === 'buy') {
                limitPrice = Math.min(currentClosePrice, Math.max(sig.low, currentClosePrice * 0.9995));
              } else {
                limitPrice = Math.max(currentClosePrice, Math.min(sig.high, currentClosePrice * 1.0005));
              }
            }

            if (settings.limitPriceBufferPct > 0) {
              if (entryDir === 'buy') {
                limitPrice = limitPrice * (1 - settings.limitPriceBufferPct);
              } else {
                limitPrice = limitPrice * (1 + settings.limitPriceBufferPct);
              }
            }

            // جلب قيمة ATR للفريم المخصص لحساب أدق لوقف الخسارة
            const lastAtrValue = rich5m.length > 0 ? rich5m[rich5m.length - 1].atr : limitPrice * 0.02;

            // 🛡️ درع حماية التصفية والحد الأقصى المطلق للخسارة (Max 15% ROE)
            const configuredLev = profileSettings.leverage || settings.leverage || 20;
            const hardMaxLossDist = limitPrice * (0.15 / configuredLev); // حد أقصى 15% خسارة رافعة
            const shieldMaxDist = limitPrice * (0.25 / configuredLev);
            const initialSlDist = Math.min(1.0 * lastAtrValue, hardMaxLossDist, shieldMaxDist);

            const slPrice = entryDir === 'buy' ? limitPrice - initialSlDist : limitPrice + initialSlDist;

            const isCrazyMode = false;

            let maxLeverageForSymbol = 125;
            if (isCrazyMode) {
              if (!profile.isDemo) {
                try {
                  const brackets = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'GET', '/fapi/v1/leverageBracket', {
                    symbol: getBinanceFuturesSymbol(symbol)
                  });
                  if (Array.isArray(brackets) && brackets.length > 0) {
                    const symInfo = brackets.find((b: any) => b.symbol === getBinanceFuturesSymbol(symbol)) || brackets[0];
                    if (symInfo && symInfo.brackets && symInfo.brackets.length > 0) {
                      const highestBracket = symInfo.brackets.reduce((max: number, br: any) => {
                        const initLev = parseInt(br.initialLeverage || "0");
                        return initLev > max ? initLev : max;
                      }, 1);
                      if (highestBracket > 1) {
                        maxLeverageForSymbol = highestBracket;
                      }
                    }
                  }
                } catch (bracketErr) {
                  if (symbol.includes("BTC") || symbol.includes("ETH")) maxLeverageForSymbol = 125;
                  else if (symbol.includes("SOL") || symbol.includes("BNB") || symbol.includes("XRP") || symbol.includes("DOGE") || symbol.includes("ADA")) maxLeverageForSymbol = 75;
                  else maxLeverageForSymbol = 50;
                }
              } else {
                if (symbol.includes("BTC") || symbol.includes("ETH")) maxLeverageForSymbol = 125;
                else if (symbol.includes("SOL") || symbol.includes("BNB") || symbol.includes("XRP") || symbol.includes("DOGE") || symbol.includes("ADA")) maxLeverageForSymbol = 75;
                else maxLeverageForSymbol = 50;
              }
            }

            // حساب حجم الصفقة والكمية المبدئية بناءً على الهامش المستهدف والرافعة المالية المطلوبة
            let targetMarginUsdt = profileSettings.baseUsdt || 10.0;
            if (profile.doubleNextTradeSize) {
              targetMarginUsdt = targetMarginUsdt * 2;
              profile.doubleNextTradeSize = false;
              addLog('info', `🔥 [${profile.name}] تم مضاعفة حجم الدخول بالصفقة (${targetMarginUsdt} USDT) استجابة لنظام حماية رأس المال بعد الخسارتين المتتاليتين.`);
            }
            const desiredLeverage = isCrazyMode ? maxLeverageForSymbol : configuredLev;
            let finalQty = (targetMarginUsdt * desiredLeverage) / limitPrice;

            const displayStrategyName = sig.name;
            const crazyNotice = isCrazyMode ? ` [🤪🔥 الزر المجنون: أقصى رافعة ${desiredLeverage}x]` : '';

            addLog('success', `🚨 [${profile.name}] إشارة ثلاثية مكتشفة (1m/5m/15m)!${crazyNotice} 🕯️ ${symbol} | الاستراتيجية: ${displayStrategyName} | الرافعة: ${desiredLeverage}x | الارتباط: ${correlation.toFixed(2)} (Group ${group}) | التفاصيل: ${breakdown}`);

            const orderId = "order_" + Math.random().toString(36).substring(2, 11);
            const newPending: PendingOrder = {
              order_id: orderId,
              symbol,
              entry_dir: entryDir,
              strategy: `${displayStrategyName} (Group ${group})`,
              score,
              limit_price: limitPrice,
              qty: finalQty,
              atr_value: lastAtrValue,
              time: new Date().toISOString(),
              profileId: profile.id,
              marketStateAtOpen: botStatus.marketState || "NORMAL",
              btcHealthAtOpen: btcHealth,
              btcPriceAtOpen: btcPrice
            };

            let skipExecution = false;
            let executionNote = `🤖 <i>تم إرسال الأمر بنجاح للتنفيذ الآلي على حساب [${profile.name}].</i>`;

            if (!profile.isDemo) {
              // 1. جلب الهامش المتاح الحقيقي المباشر من بينانس (Available Balance)
              let availableMarginUsdt = profile.balance ?? 0;
              try {
                const accData = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'GET', '/fapi/v2/account');
                if (accData && accData.availableBalance !== undefined) {
                  availableMarginUsdt = parseFloat(accData.availableBalance);
                }
              } catch (accErr) {
                // fallback to balance
              }

              if (availableMarginUsdt < 1.0 && !isCrazyMode) {
                skipExecution = true;
                executionNote = `📢 <i>توصية وإشارة مراقبة نشطة (لم يتم الدخول آلياً لعدم كفاية الهامش المتاح المباشر على بينانس - المتاح حالياً: ${availableMarginUsdt.toFixed(2)} USDT).</i>`;
                addLog('info', `⚠️ [${profile.name}] الهامش المتاح حالياً على منصة بينانس (${availableMarginUsdt.toFixed(2)} USDT) غير كافٍ لتداول ${symbol}. تم تخطي الدخول الآلي وإرسال الإشارة للتليجرام.`);
              } else {
                try {
                  // 2. ضبط الرافعة المالية على منصة بينانس والتحقق من القيمة المقبولة حقيقياً
                  let actualLeverageOnBinance = desiredLeverage;
                  try {
                    const levResponse = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/leverage', {
                      symbol: getBinanceFuturesSymbol(symbol),
                      leverage: desiredLeverage.toString()
                    });
                    if (levResponse && levResponse.leverage) {
                      actualLeverageOnBinance = parseInt(levResponse.leverage);
                    }
                  } catch (levErr: any) {
                    if (isCrazyMode) {
                      const fallbacks = [100, 75, 50, 25, 20];
                      for (const fb of fallbacks) {
                        if (fb < desiredLeverage) {
                          try {
                            const levRes = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/leverage', {
                              symbol: getBinanceFuturesSymbol(symbol),
                              leverage: fb.toString()
                            });
                            if (levRes && levRes.leverage) {
                              actualLeverageOnBinance = parseInt(levRes.leverage);
                              break;
                            }
                          } catch (e) {}
                        }
                      }
                    } else {
                      addLog('warn', `⚠️ [${profile.name}] تنبيه الرافعة المالية لـ ${symbol}: ${levErr.message}`);
                    }
                  }

                  // 3. حساب الهامش المستخدم
                  // في الوضع المجنون (الزر المجنون): يتجاوز حدود تقييد الهامش الآمن ويستخدم الهامش المخصص برافعة نارية
                  const safeMarginUsdt = isCrazyMode
                    ? Math.max(targetMarginUsdt, Math.min(targetMarginUsdt, availableMarginUsdt))
                    : Math.min(targetMarginUsdt, Math.max(1.0, availableMarginUsdt * 0.90));

                  const safePosSizeUsdt = safeMarginUsdt * actualLeverageOnBinance;

                  let calculatedQty = safePosSizeUsdt / limitPrice;

                  // ضمان تحقيق الحد الأدنى لقيمة الصفقة على بينانس (Min Notional ~ 5.1 USDT)
                  const minNotionalUsdt = 5.1;
                  if (calculatedQty * limitPrice < minNotionalUsdt) {
                    calculatedQty = minNotionalUsdt / limitPrice;
                  }

                  const formattedPriceStr = formatPrice(symbol, limitPrice);
                  const formattedQtyStr = formatQuantity(symbol, calculatedQty);

                  const parsedQty = parseFloat(formattedQtyStr);
                  if (isNaN(parsedQty) || parsedQty <= 0) {
                    addLog('error', `⚠️ [${profile.name}] الكمية المحتسبة لـ ${symbol} أصغر من الحد الأدنى للشبكة.`);
                    continue;
                  }

                  if (isCrazyMode) {
                    addLog('warn', `🤪🔥 [الزر المجنون مفعّل] [${profile.name}] تم إرسال أمر لـ ${symbol} بأقصى رافعة مالية (${actualLeverageOnBinance}x) وبدون قيود الهامش الآمن! (حجم الصفقة: $${safePosSizeUsdt.toFixed(2)})`);
                  } else {
                    addLog('info', `⚙️ [${profile.name}] ضبط الرافعة إلى ${actualLeverageOnBinance}x وإرسال أمر شراء ليميت لـ ${symbol} بسعر ${formattedPriceStr} (الهامش المستخدم: $${safeMarginUsdt.toFixed(2)})`);
                  }

                  const realOrder = await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
                    symbol: getBinanceFuturesSymbol(symbol),
                    side: entryDir.toUpperCase(),
                    type: 'LIMIT',
                    quantity: formattedQtyStr,
                    price: formattedPriceStr,
                    timeInForce: 'GTC'
                  });

                  if (realOrder && realOrder.orderId) {
                    newPending.order_id = realOrder.orderId;
                    newPending.qty = parsedQty;
                  }
                } catch (err: any) {
                  addLog('error', `❌ [${profile.name}] فشل إرسال أمر الشراء الحقيقي لـ بينانس لـ ${symbol}: ${err.message}`);
                  skipExecution = true;
                  executionNote = `📢 <i>توصية وإشارة مراقبة نشطة (فشل التنفيذ الآلي بسبب خطأ بالمنصة: ${err.message}).</i>`;
                }
              }
            }

            if (!skipExecution) {
              nextPending[key] = newPending;
              stateChanged = true;
              addLog('trade', `🔔 [${profile.name}] تم إدراج أمر ليميت معلق للعملة ${symbol} بسعر ${limitPrice.toFixed(4)} (صلاحية 30 دقيقة).`);
            }

            // حساب أهداف جني الأرباح ووقف الخسارة للإشارة لإرسالها تليغرام
            let alertTpDist = 0;
            if (displayStrategyName.includes("Alpha Velocity")) {
              const targetLeveragedPct = 5.0; // 5%
              const leverage = groupLeverage || 5;
              const rawTpPct = (targetLeveragedPct / leverage) / 100;
              alertTpDist = limitPrice * rawTpPct;
            } else if (profileSettings.slTpMode === 'atr') {
              alertTpDist = lastAtrValue * (profileSettings.atrTpMultiplier || 2.5);
            } else {
              alertTpDist = limitPrice * ((profileSettings.manualTpPct || 2.0) / 100);
            }
            const alertTpPrice = entryDir === 'buy' ? limitPrice + alertTpDist : limitPrice - alertTpDist;

            const directionText = entryDir === 'buy' ? "🟢 شراء (LONG)" : "🔴 بيع (SHORT)";
            const signalMsg = `<b>📊 إشارة تداول فورية جديدة مكتشفة حياً ⚡</b>
-----------------------------------
🪙 <b>العملة:</b> <code>${symbol}</code>
📈 <b>الاتجاه:</b> <b>${directionText}</b>
🎯 <b>سعر الدخول المستهدف (LIMIT):</b> <code>${limitPrice.toFixed(4)}</code>
🛡️ <b>وقف الخسارة (SL):</b> <code>${slPrice.toFixed(4)}</code>
💵 <b>هدف جني الأرباح (TP):</b> <code>${alertTpPrice.toFixed(4)}</code>
🔥 <b>الرافعة المالية:</b> <code>${groupLeverage}x</code>
📦 <b>الكمية المحتسبة:</b> <code>${finalQty.toFixed(4)}</code>
💡 <b>الاستراتيجية المشغلة:</b> <code>${displayStrategyName}</code>
🛡️ <b>قوة الإشارة الفنية:</b> <b>${score}%</b>
🔍 <b>حالة السوق والبيتكوين:</b> <code>${marketState} (${btcHealth === 'GREEN' ? 'مستقرة 🟢' : 'حذرة 🟡'})</code>
-----------------------------------
${executionNote}`;
            
            sendTelegramSignalsNotification(signalMsg).catch(err => console.error("Failed to send Telegram signal alert:", err));
            break; // صفقة واحدة لكل دورة فحص للعملة الواحدة
          }
        }
      } catch (err: any) {
        console.error(`Error scanning ${symbol}:`, err);
      }
    }

    if (stateChanged) {
      botStatus.pendingOrders = nextPending;
    }

    botStatus.scanCount += 1;
    botStatus.lastScanTime = new Date().toISOString();
    saveState();
  } catch (err: any) {
    console.error("Error in runMarketScanningCycle:", err.message);
  } finally {
    isScanning = false;
  }
}

let realtimeTimer: NodeJS.Timeout | null = null;
let scanningTimer: NodeJS.Timeout | null = null;
let uptimeTimer: NodeJS.Timeout | null = null;
let hourlySummaryTimer: NodeJS.Timeout | null = null;
let threeHourlyTimer: NodeJS.Timeout | null = null;

function startTradingLoops() {
  if (realtimeTimer) clearInterval(realtimeTimer);
  realtimeTimer = setInterval(() => {
    runRealtimeCheck().catch(err => console.error("Error in realtime check:", err));
  }, 4000);

  if (scanningTimer) clearInterval(scanningTimer);
  scanningTimer = setInterval(() => {
    runMarketScanningCycle().catch(err => console.error("Error in scanning cycle:", err));
  }, 12000);

  if (uptimeTimer) clearInterval(uptimeTimer);
  uptimeTimer = setInterval(() => {
    if (botStatus.isRunning) {
      botStatus.uptimeSeconds += 1;
      
      // فحص ملخص الأداء بالساعة وإرساله بشكل مستمر ومحمي من إعادة تشغيل الخادم
      const now = Date.now();
      const lastSummary = botStatus.lastHourlySummaryTime ? new Date(botStatus.lastHourlySummaryTime).getTime() : 0;
      if (now - lastSummary >= 3600000) {
        botStatus.lastHourlySummaryTime = new Date().toISOString();
        saveState();
        processHourlySummary().catch(err => console.error("Error sending hourly summary:", err));
      }

      if (botStatus.uptimeSeconds % 30 === 0) {
        saveState();
      }
    }
  }, 1000);

  if (hourlySummaryTimer) clearInterval(hourlySummaryTimer);
  hourlySummaryTimer = setInterval(() => {
    // تم تحسين الفحص ليكون ديناميكياً داخل عداد الثواني حمايةً للتقارير من انقطاع الخدمة
  }, 3600000);

  if (threeHourlyTimer) clearInterval(threeHourlyTimer);
  threeHourlyTimer = setInterval(() => {
    processThreeHourlySignalsSummary().catch(err => console.error("Error in 3-hourly quality timer:", err));
  }, 10800000);
}

// ═══════════════════════════════════════════════════════════════
//  مسارات الـ API للتحكم ومشاركة البيانات (REST APIs)
// ═══════════════════════════════════════════════════════════════
app.get("/api/bot/status", (req, res) => {
  res.json(botStatus);
});

app.post("/api/bot/toggle", (req, res) => {
  const { run } = req.body;
  botStatus.isRunning = !!run;
  if (run) {
    addLog('success', '🟢 تم تشغيل البوت بنجاح! بدأ فحص السوق التلقائي وتأمين الصفقات حياً على السحابة 24/7.');
  } else {
    addLog('warn', '🔴 تم إيقاف البوت مؤقتاً. تم حفظ كافة الصفقات النشطة والأوامر المعلقة.');
  }
  saveState();
  res.json(botStatus);
});

app.post("/api/bot/settings", (req, res) => {
  const { settings, profileId } = req.body;
  if (settings) {
    if (settings.selectedSymbols) {
      settings.selectedSymbols = cleanSymbols(settings.selectedSymbols);
    }
    botStatus.settings = { ...botStatus.settings, ...settings };
    botStatus.settings.selectedSymbols = cleanSymbols(botStatus.settings.selectedSymbols);
    
    // المزامنة التلقائية للرافعة المالية والهامش والزر المجنون وإعدادات التليجرام عبر كافة حسابات التداول
    botStatus.apiProfiles.forEach((p: any) => {
      if (!p.settings) {
        p.settings = JSON.parse(JSON.stringify(botStatus.settings));
      } else {
        if (settings.leverage !== undefined) p.settings.leverage = settings.leverage;
        if (settings.baseUsdt !== undefined) p.settings.baseUsdt = settings.baseUsdt;
        if (settings.crazyMode !== undefined) p.settings.crazyMode = settings.crazyMode;
        if (settings.reverseSignals !== undefined) p.settings.reverseSignals = settings.reverseSignals;
        if (settings.reversalOrderTimeoutMin !== undefined) p.settings.reversalOrderTimeoutMin = settings.reversalOrderTimeoutMin;
        if (settings.maxOpenPositions !== undefined) p.settings.maxOpenPositions = settings.maxOpenPositions;
        if (settings.telegramEnabled !== undefined) p.settings.telegramEnabled = settings.telegramEnabled;
        if (settings.telegramToken !== undefined) p.settings.telegramToken = settings.telegramToken;
        if (settings.telegramChatId !== undefined) p.settings.telegramChatId = settings.telegramChatId;
        if (settings.telegramSummaryToken !== undefined) p.settings.telegramSummaryToken = settings.telegramSummaryToken;
        if (settings.telegramSummaryChatId !== undefined) p.settings.telegramSummaryChatId = settings.telegramSummaryChatId;
        if (settings.telegramSignalsToken !== undefined) p.settings.telegramSignalsToken = settings.telegramSignalsToken;
        if (settings.telegramSignalsChatId !== undefined) p.settings.telegramSignalsChatId = settings.telegramSignalsChatId;
        if (settings.browserNotificationsEnabled !== undefined) p.settings.browserNotificationsEnabled = settings.browserNotificationsEnabled;
      }
    });

    if (profileId && profileId !== "demo") {
      const prof = botStatus.apiProfiles.find((p: any) => p.id === profileId);
      if (prof) {
        prof.settings = { ...(prof.settings || botStatus.settings), ...settings };
        addLog('success', `⚙️ تم تحديث إعدادات التحكم للحساب [${prof.name}] والرافعة المالية (${settings.leverage || prof.settings.leverage}x) بنجاح.`);
      }
    } else {
      addLog('success', `⚙️ تم تحديث الإعدادات الافتراضية للتحكم بالبوت والرافعة المالية (${botStatus.settings.leverage}x) بنجاح.`);
    }
    saveState();
  }
  res.json(botStatus);
});

app.post("/api/bot/test-telegram", async (req, res) => {
  const { token, chatId } = req.body;
  if (!token || !chatId) {
    return res.status(400).json({ success: false, error: "يرجى توفير التوكن ومعرف الشات للتلغرام." });
  }
  try {
    const url = `https://api.telegram.org/bot${token.trim()}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: `<b>🔔 رسالة تجريبية من بوت التداول الآلي!</b>\n\nلقد تم إعداد نظام الإشعارات بشكل صحيح على هاتفك بنجاح. سنقوم بإرسال إشعارات فتح وإغلاق الصفقات والأرباح هنا فوراً.`,
        parse_mode: "HTML"
      })
    });
    const data = await response.json() as any;
    if (response.ok && data.ok) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: data.description || `خطأ من تلغرام: ${response.statusText}` });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bot/api-keys", (req, res) => {
  const { apiProfiles } = req.body;
  if (apiProfiles) {
    botStatus.apiProfiles = apiProfiles;
    
    // تهيئة حقول الرصيد والإعدادات لكل حساب إذا لم تكن موجودة
    botStatus.apiProfiles.forEach((p: any) => {
      if (p.balance === undefined) {
        p.balance = p.isDemo ? botStatus.settings.demoBalance : 0.0;
      }
      if (p.initialBalance === undefined) {
        p.initialBalance = p.isDemo ? botStatus.settings.demoBalance : 0.0;
      }
      if (!p.settings) {
        p.settings = JSON.parse(JSON.stringify(botStatus.settings));
      } else {
        p.settings = { ...botStatus.settings, ...p.settings };
      }
    });

    // إعادة حساب الرصيد الإجمالي عبر كافة الحسابات النشطة
    const activeProfiles = botStatus.apiProfiles.filter(p => p.isActive);
    if (activeProfiles.length > 0) {
      let totalBal = 0;
      let totalInitBal = 0;
      activeProfiles.forEach(p => {
        totalBal += p.balance || 0;
        totalInitBal += p.initialBalance || 0;
      });
      botStatus.currentBalance = totalBal;
      botStatus.initialBalance = totalInitBal;
      botStatus.dailyPnlPct = totalInitBal > 0 ? ((totalBal - totalInitBal) / totalInitBal) * 100 : 0.0;
    } else {
      botStatus.currentBalance = botStatus.settings.demoBalance;
      botStatus.initialBalance = botStatus.settings.demoBalance;
      botStatus.dailyPnlPct = 0.0;
    }

    addLog('success', `🔑 تم تحديث حسابات وإعدادات مفاتيح الـ API للتداول وتفعيل نظام التداول المتعدد النشط.`);
    saveState();
  }
  res.json(botStatus);
});

app.post("/api/bot/clear-logs", (req, res) => {
  botStatus.systemLogs = [
    {
      id: "clear",
      time: new Date().toISOString(),
      type: "info",
      message: "🧹 تم مسح سجلات التحكم والمراقبة بنجاح."
    }
  ];
  saveState();
  res.json(botStatus);
});

app.post("/api/bot/manual-close", async (req, res) => {
  const { key, symbol } = req.body;
  const lookupKey = key || symbol;
  const pos = botStatus.positions[lookupKey];
  if (!pos) {
    return res.status(400).json({ error: "لا توجد صفقة نشطة لهذه العملة" });
  }

  try {
    const symbolOnly = pos.symbol;
    const currentPrice = await fetchTickerPrice(symbolOnly);
    const side = pos.side;
    const entry = pos.entry;

    const finalProfitRaw = side === 'buy' ? (currentPrice - entry) / entry : (entry - currentPrice) / entry;
    const leveragedProfitPct = finalProfitRaw * botStatus.settings.leverage * 100;
    
    // إذا تم تفعيل جني الأرباح الجزئي للـ 75% سابقاً، فالمتبقي 25% من حجم الهامش الأساسي، وإلا فهو كامل الهامش
    const baseUsdtFraction = pos.partial_tp1_done ? 0.25 : 1.0;
    const profitUsdt = (botStatus.settings.baseUsdt * baseUsdtFraction) * (finalProfitRaw * botStatus.settings.leverage);

    const profileId = pos.profileId || "demo";
    let profile = botStatus.apiProfiles.find(p => p.id === profileId);
    if (!profile && profileId === "demo") {
      profile = {
        id: "demo",
        name: "الحساب التجريبي",
        apiKey: "",
        apiSecret: "",
        isActive: true,
        isDemo: true,
        balance: botStatus.currentBalance,
        initialBalance: botStatus.initialBalance,
        settings: botStatus.settings
      };
    }

    if (!profile) {
      return res.status(400).json({ error: "لم يتم العثور على حساب التداول المرتبط" });
    }

    if (profile.isDemo) {
      botStatus.currentBalance = (botStatus.currentBalance || 0) + profitUsdt;
      profile.balance = botStatus.currentBalance;
    } else {
      try {
        const manualQtyStr = formatQuantity(symbolOnly, pos.qty);
        await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
          symbol: getBinanceFuturesSymbol(symbolOnly),
          side: side === 'buy' ? 'SELL' : 'BUY',
          type: 'MARKET',
          quantity: manualQtyStr,
          reduceOnly: 'true'
        });
      } catch (err: any) {
        addLog('error', `❌ [${profile.name}] فشل إغلاق الصفقة اليدوية على بينانس لـ ${symbolOnly}: ${err.message}`);
        return res.status(500).json({ error: `فشل الإغلاق الحقيقي: ${err.message}` });
      }
    }

    let btcPriceAtClose = 60000;
    try {
      btcPriceAtClose = await fetchTickerPrice("BTC/USDT");
    } catch (e) {
      console.warn("Failed to fetch BTC price inside manual close:", e);
    }
    const btcHealthAtClose = botStatus.btcHealth || "GREEN";
    const marketStateAtClose = botStatus.marketState || "NORMAL";

    const newTrade: TradeLog = {
      timestamp: new Date().toISOString(),
      symbol: symbolOnly,
      side,
      strategy: pos.partial_tp1_done ? `${pos.strategy} (متبقي 25%)` : pos.strategy,
      entry,
      exit: currentPrice,
      tp: pos.tp,
      sl: pos.init_sl,
      pnl_pct_leveraged: leveragedProfitPct,
      pnl_usdt: profitUsdt,
      score: pos.score,
      reason: "إغلاق يدوي للمركز ⚡",
      profileId: profile.id,
      profileName: profile.name,
      marketStateAtOpen: pos.marketStateAtOpen,
      btcHealthAtOpen: pos.btcHealthAtOpen,
      btcPriceAtOpen: pos.btcPriceAtOpen,
      marketStateAtClose: marketStateAtClose,
      btcHealthAtClose: btcHealthAtClose,
      btcPriceAtClose: btcPriceAtClose,
      strategySummary: generateStrategySummary(
        symbolOnly,
        side,
        pos.partial_tp1_done ? `${pos.strategy} (متبقي 25%)` : pos.strategy,
        entry,
        currentPrice,
        leveragedProfitPct,
        profitUsdt,
        "إغلاق يدوي للمركز ⚡",
        pos.marketStateAtOpen,
        pos.btcHealthAtOpen,
        pos.btcPriceAtOpen,
        marketStateAtClose,
        btcHealthAtClose,
        btcPriceAtClose
      )
    };

    botStatus.tradeHistory.unshift(newTrade);

    // إرسال إشعار تلغرام عند الإغلاق اليدوي
    const manualCloseMsg = `<b>🏁 صفقة مغلقة يدوياً ⚡</b>\n\n` +
      `🪙 <b>العملة:</b> <code>${symbolOnly}</code>\n` +
      `📈 <b>الاتجاه:</b> <b>${side.toUpperCase() === 'BUY' ? 'LONG (شراء) 🟢' : 'SHORT (بيع) 🔴'}</b>\n` +
      `💵 <b>سعر الدخول:</b> <code>${entry.toFixed(4)}</code>\n` +
      `🏁 <b>سعر الإغلاق:</b> <code>${currentPrice.toFixed(4)}</code>\n` +
      `💵 <b>الربح/الخسارة:</b> <b>${leveragedProfitPct >= 0 ? '+' : ''}${leveragedProfitPct.toFixed(2)}%</b> (<code>${profitUsdt >= 0 ? '+' : ''}$${profitUsdt.toFixed(2)} USDT</code>)\n` +
      `💡 <b>الاستراتيجية:</b> <code>${pos.strategy}${pos.partial_tp1_done ? ' (متبقي 25%)' : ''}</code>\n` +
      `👤 <b>الحساب:</b> <code>${profile.name}</code>\n\n` +
      `📊 <b>حالة البيتكوين عند الإغلاق:</b> <code>${btcHealthAtClose === 'GREEN' ? 'مستقرة 🟢' : btcHealthAtClose === 'RED' ? 'هابطة 🔴' : 'حذرة 🟡'}</code> | <code>$${btcPriceAtClose ? btcPriceAtClose.toLocaleString() : '---'}</code>`;

    sendTelegramNotification(manualCloseMsg).catch(err => console.error("Failed to send Telegram manual close notification:", err));
    sendTelegramSignalsNotification(manualCloseMsg).catch(err => console.error("Failed to send Telegram manual close signals notification:", err));

    delete botStatus.positions[lookupKey];
    
    // تحديث وتجميع الأرصدة
    const activeProfiles = botStatus.apiProfiles.filter(p => p.isActive);
    if (activeProfiles.length > 0) {
      let totalBal = 0;
      let totalInitBal = 0;
      activeProfiles.forEach(p => {
        totalBal += p.balance || 0;
        totalInitBal += p.initialBalance || 0;
      });
      botStatus.currentBalance = totalBal;
      botStatus.initialBalance = totalInitBal;
      botStatus.dailyPnlPct = totalInitBal > 0 ? ((totalBal - totalInitBal) / totalInitBal) * 100 : 0.0;
    }

    addLog('trade', `⚡ [${profile.name}] تم إغلاق صفقة ${symbolOnly} يدوياً بواسطة المستخدم بسعر ${currentPrice.toFixed(4)}.`);
    saveState();
    res.json(botStatus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// مسار إعادة تعيين الحساب التجريبي
app.post("/api/bot/reset-demo", (req, res) => {
  let demoProf = botStatus.apiProfiles.find((p: any) => p.id === "demo" || p.isDemo);
  if (!demoProf) {
    demoProf = {
      id: "demo",
      name: "الحساب التجريبي",
      apiKey: "demo_key",
      apiSecret: "demo_secret",
      isActive: true,
      isDemo: true,
      balance: botStatus.settings.demoBalance || 1000.0,
      initialBalance: botStatus.settings.demoBalance || 1000.0,
      settings: JSON.parse(JSON.stringify(botStatus.settings))
    };
    botStatus.apiProfiles.unshift(demoProf);
  } else {
    demoProf.balance = botStatus.settings.demoBalance || 1000.0;
    demoProf.initialBalance = botStatus.settings.demoBalance || 1000.0;
  }

  botStatus.currentBalance = botStatus.settings.demoBalance || 1000.0;
  botStatus.initialBalance = botStatus.settings.demoBalance || 1000.0;
  botStatus.dailyPnlPct = 0.0;
  botStatus.tradeHistory = [];
  botStatus.positions = {};
  botStatus.pendingOrders = {};
  addLog('success', "🔄 تم إعادة تعيين رصيد المحفظة التجريبية بنجاح ومسح السجلات التاريخية.");
  saveState();
  res.json(botStatus);
});

// مسار إعادة تهيئة التطبيق بالكامل وتفريغ الإعدادات والحسابات كأول مرة
app.post("/api/bot/reset-all", (req, res) => {
  const freshDemo: ApiProfile = {
    id: "demo",
    name: "الحساب التجريبي",
    apiKey: "demo_key",
    apiSecret: "demo_secret",
    isActive: true,
    isDemo: true,
    balance: 1000.0,
    initialBalance: 1000.0,
    settings: JSON.parse(JSON.stringify(defaultSettings))
  };

  botStatus = {
    isRunning: false,
    apiProfiles: [freshDemo],
    settings: JSON.parse(JSON.stringify(defaultSettings)),
    positions: {},
    pendingOrders: {},
    tradeHistory: [],
    systemLogs: [
      {
        id: "init_" + Date.now(),
        time: new Date().toISOString(),
        type: "info",
        message: "🟢 تم إعادة ضبط التطبيق بالكامل كأول استخدام بنجاح. تم مسح كافة السجلات وعاد الرصيد التجريبي لـ 1000 USDT."
      }
    ],
    currentBalance: 1000.0,
    initialBalance: 1000.0,
    dailyPnlPct: 0.0,
    scanCount: 0,
    lastScanTime: null,
    uptimeSeconds: 0,
    bannedSymbols: [],
    aiSelfCorrectionRules: [
      "🤖 تم إعادة ضبط وتنشيط محرك الذكاء الاصطناعي الذاتي لتتبع الأخطاء بدقة."
    ]
  };
  saveState();
  res.json(botStatus);
});

// مسار جلب قائمة العملات المحظورة
app.get("/api/bot/banned-symbols", (req, res) => {
  res.json({
    bannedSymbols: botStatus.bannedSymbols || [],
    aiSelfCorrectionRules: botStatus.aiSelfCorrectionRules || []
  });
});

// مسار فك حظر عملة محددة يدوياً
app.post("/api/bot/unban-symbol", (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: "اسم العملة مطلوب" });
  
  const norm = symbol.replace("/", "").toUpperCase();
  const symWithoutSlash = norm.endsWith("USDT") ? norm : `${norm}USDT`;
  const baseNorm = norm.endsWith("USDT") ? norm.slice(0, -4) : norm;
  const symWithSlash = `${baseNorm}/USDT`;

  if (Array.isArray(botStatus.bannedSymbols)) {
    botStatus.bannedSymbols = botStatus.bannedSymbols.filter(s => {
      const n = s.replace("/", "").toUpperCase();
      return n !== symWithoutSlash;
    });
  }
  if (botStatus.settings && Array.isArray(botStatus.settings.bannedSymbols)) {
    botStatus.settings.bannedSymbols = botStatus.settings.bannedSymbols.filter(s => {
      const n = s.replace("/", "").toUpperCase();
      return n !== symWithoutSlash;
    });
  }

  // إعادة إضافة العملة إلى القائمة المحددة لتتيح التداول مجدداً
  if (!botStatus.settings.selectedSymbols.includes(symWithSlash) && !botStatus.settings.selectedSymbols.includes(symWithoutSlash)) {
    botStatus.settings.selectedSymbols.push(symWithSlash);
  }

  addLog('info', `🔓 [فك حظر] تم فك حظر التداول عن عملة ${symbol} بنجاح بطلب من المستخدم.`);
  saveState();
  res.json(botStatus);
});

// مسار إغلاق جميع الصفقات في حالات الطوارئ لكل الحسابات
app.post("/api/bot/close-all", async (req, res) => {
  const { profileId } = req.body;
  const targetId = profileId || "demo";
  
  const lookupKeys = Object.keys(botStatus.positions);
  for (const lookupKey of lookupKeys) {
    const pos = botStatus.positions[lookupKey];
    const posProfileId = pos.profileId || "demo";
    if (posProfileId !== targetId) {
      continue;
    }
    const profile = botStatus.apiProfiles.find(p => p.id === posProfileId);
    
    if (profile && !profile.isDemo) {
      try {
        const emergencyQtyStr = formatQuantity(pos.symbol, pos.qty);
        await callBinanceFutures(profile.apiKey, profile.apiSecret, 'POST', '/fapi/v1/order', {
          symbol: getBinanceFuturesSymbol(pos.symbol),
          side: pos.side === 'buy' ? 'SELL' : 'BUY',
          type: 'MARKET',
          quantity: emergencyQtyStr,
          reduceOnly: 'true'
        });
      } catch (err) {}
    }
    delete botStatus.positions[lookupKey];
  }

  // إزالة الأوامر المعلقة للحساب المستهدف فقط
  const pendKeys = Object.keys(botStatus.pendingOrders);
  for (const pendKey of pendKeys) {
    const pend = botStatus.pendingOrders[pendKey];
    const pendProfileId = pend.profileId || "demo";
    if (pendProfileId === targetId) {
      delete botStatus.pendingOrders[pendKey];
    }
  }

  const profileName = targetId === "demo" ? "الحساب التجريبي" : (botStatus.apiProfiles.find(p => p.id === targetId)?.name || targetId);
  addLog('error', `🚨 زر الإغلاق الطارئ: تم تصفية كافة الصفقات النشطة وإلغاء جميع الأوامر المعلقة لحساب [${profileName}].`);
  saveState();
  res.json(botStatus);
});

// 📊 دالة حساب التحليلات والملخص اليومي لكل عملة واستراتيجية
function getDailyAnalyticsData() {
  const history = botStatus.tradeHistory || [];
  
  // تجميع الصفقات حسب العملة
  const symbolMap: Record<string, {
    symbol: string;
    strategies: Set<string>;
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnlUsdt: number;
    totalPnlPct: number;
  }> = {};

  // تجميع الصفقات حسب الاستراتيجية
  const strategyMap: Record<string, {
    strategy: string;
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnlUsdt: number;
    totalPnlPct: number;
  }> = {};

  history.forEach(t => {
    const sym = t.symbol;
    if (!symbolMap[sym]) {
      symbolMap[sym] = {
        symbol: sym,
        strategies: new Set(),
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnlUsdt: 0,
        totalPnlPct: 0
      };
    }
    const cleanStratName = t.strategy ? t.strategy.replace(/\s*\(.*\)/, '').trim() : 'عامة';
    symbolMap[sym].strategies.add(cleanStratName);
    symbolMap[sym].totalTrades += 1;
    const pnlUsdt = t.pnl_usdt || 0;
    const pnlPct = t.pnl_pct_leveraged || 0;
    symbolMap[sym].totalPnlUsdt += pnlUsdt;
    symbolMap[sym].totalPnlPct += pnlPct;
    if (pnlUsdt > 0 || pnlPct > 0) {
      symbolMap[sym].wins += 1;
    } else if (pnlUsdt < 0 || pnlPct < 0) {
      symbolMap[sym].losses += 1;
    }

    if (!strategyMap[cleanStratName]) {
      strategyMap[cleanStratName] = {
        strategy: cleanStratName,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnlUsdt: 0,
        totalPnlPct: 0
      };
    }
    strategyMap[cleanStratName].totalTrades += 1;
    strategyMap[cleanStratName].totalPnlUsdt += pnlUsdt;
    strategyMap[cleanStratName].totalPnlPct += pnlPct;
    if (pnlUsdt > 0 || pnlPct > 0) {
      strategyMap[cleanStratName].wins += 1;
    } else if (pnlUsdt < 0 || pnlPct < 0) {
      strategyMap[cleanStratName].losses += 1;
    }
  });

  const symbolBreakdown = Object.values(symbolMap).map(s => {
    const winRatePct = s.totalTrades > 0 ? (s.wins / s.totalTrades) * 100 : 0;
    const isProfitable = s.totalPnlUsdt > 0 ? "رابحة 🟩" : s.totalPnlUsdt < 0 ? "خاسرة 🟥" : "تعادل ⬜";
    return {
      symbol: s.symbol,
      strategies: Array.from(s.strategies),
      totalTrades: s.totalTrades,
      wins: s.wins,
      losses: s.losses,
      winRatePct,
      totalPnlUsdt: s.totalPnlUsdt,
      totalPnlPct: s.totalPnlPct,
      status: isProfitable
    };
  }).sort((a, b) => b.totalPnlUsdt - a.totalPnlUsdt);

  const strategyBreakdown = Object.values(strategyMap).map(st => {
    const winRatePct = st.totalTrades > 0 ? (st.wins / st.totalTrades) * 100 : 0;
    return {
      strategy: st.strategy,
      totalTrades: st.totalTrades,
      wins: st.wins,
      losses: st.losses,
      winRatePct,
      totalPnlUsdt: st.totalPnlUsdt
    };
  }).sort((a, b) => b.winRatePct - a.winRatePct || b.totalPnlUsdt - a.totalPnlUsdt);

  // حساب أكثر عملة رابحة
  const topWinningSymbol = symbolBreakdown.length > 0 && symbolBreakdown[0].totalPnlUsdt > 0 
    ? symbolBreakdown[0] 
    : (symbolBreakdown[0] || null);

  // حساب أكثر استراتيجية بنسبة نجاح
  const topStrategy = strategyBreakdown.length > 0 ? strategyBreakdown[0] : null;

  // بناء التقرير النصي لإرساله للتلغرام
  let summaryText = `<b>📊 [التقرير الإحصائي والتحليلي للعملات والاستراتيجيات] 📊</b>\n`;
  summaryText += `-----------------------------------\n`;
  summaryText += `🗓️ <b>التاريخ:</b> ${new Date().toLocaleDateString('ar-EG')}\n`;
  summaryText += `💰 <b>إجمالي أرباح البوت:</b> <b>${botStatus.dailyPnlPct >= 0 ? '+' : ''}${botStatus.dailyPnlPct.toFixed(2)}%</b> (${(botStatus.currentBalance - botStatus.initialBalance).toFixed(2)} USDT)\n`;
  summaryText += `📈 <b>إجمالي الصفقات المنفذة:</b> ${history.length} صفقة (LONG فقط)\n\n`;

  if (topWinningSymbol) {
    summaryText += `🏆 <b>أكثر عملة رابحة:</b> <code>${topWinningSymbol.symbol}</code> (${topWinningSymbol.totalPnlUsdt >= 0 ? '+' : ''}${topWinningSymbol.totalPnlUsdt.toFixed(2)} USDT | نسبة نجاح: ${topWinningSymbol.winRatePct.toFixed(0)}%)\n`;
  }
  if (topStrategy) {
    summaryText += `🎯 <b>أكثر استراتيجية نجاحاً:</b> <code>${topStrategy.strategy}</code> (نسبة النجاح: ${topStrategy.winRatePct.toFixed(1)}% | ${topStrategy.wins}/${topStrategy.totalTrades} صفقات ناجحة)\n`;
  }

  summaryText += `\n--- 🪙 <b>تفاصيل الأداء حسب العملات والاستراتيجيات:</b> ---\n`;
  if (symbolBreakdown.length === 0) {
    summaryText += `لا توجد صفقات منفذة حتى الآن.\n`;
  } else {
    symbolBreakdown.slice(0, 15).forEach((item, idx) => {
      summaryText += `<b>${idx + 1}. ${item.symbol}:</b> ${item.status}\n`;
      summaryText += `   • <b>الاستراتيجيات:</b> <code>${item.strategies.join(', ') || 'عامة'}</code>\n`;
      summaryText += `   • <b>النتيجة:</b> ${item.totalPnlUsdt >= 0 ? '+' : ''}${item.totalPnlUsdt.toFixed(2)} USDT (${item.wins}/${item.totalTrades} نجاح)\n`;
    });
  }

  summaryText += `\n-----------------------------------\n⚡ <i>OTAZ MAX - البوت السحابي الذكي (شراء LONG فقط)</i>`;

  return {
    topWinningSymbol,
    topStrategy,
    symbolBreakdown,
    strategyBreakdown,
    summaryText
  };
}

// مسار جلب بيانات التحليل والملخص اليومي
app.get("/api/bot/daily-analytics", (req, res) => {
  try {
    const analytics = getDailyAnalyticsData();
    res.json(analytics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// مسار إرسال التقرير اليومي الشامل إلى قناة التليجرام
app.post("/api/bot/send-daily-summary-telegram", async (req, res) => {
  try {
    const analytics = getDailyAnalyticsData();
    await sendTelegramSummaryNotification(analytics.summaryText);
    addLog('success', '📲 تم إرسال التقرير والملخص اليومي الشامل للعملات والاستراتيجيات إلى قناة التليجرام بنجاح!');
    res.json({ success: true, message: 'تم إرسال التقرير للتليجرام بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// مسار اختبار إشعار التليجرام
app.post("/api/telegram/test", async (req, res) => {
  try {
    const { token, chatId } = req.body;
    const testMsg = `<b>🤖 تجربة إشعار التليجرام - OTAZ MAX</b>\n\n` +
      `✅ تم ربط البوت بقناة التليجرام بنجاح!\n` +
      `📌 سيقوم البوت بإرسال إشعارات الصفقات الفورية والملخصات اليومية للعملات والاستراتيجيات تلقائياً 24/7.`;
    
    const settings = {
      telegramSummaryToken: token || botStatus.settings.telegramSummaryToken || botStatus.settings.telegramToken,
      telegramSummaryChatId: chatId || botStatus.settings.telegramSummaryChatId || botStatus.settings.telegramChatId
    };

    await sendTelegramSummaryNotification(testMsg, settings);
    res.json({ success: true, message: 'تم إرسال الرسالة التجريبية للتليجرام' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// مسار إلغاء حظر استراتيجية لعملة معينة
app.post("/api/unban-strategy", (req, res) => {
  try {
    const { key } = req.body;
    if (key) {
      if (botStatus.bannedStrategySymbols) {
        botStatus.bannedStrategySymbols = botStatus.bannedStrategySymbols.filter(k => k !== key && !k.startsWith(`${key}::`));
      }
      if (botStatus.settings?.bannedStrategySymbols) {
        botStatus.settings.bannedStrategySymbols = botStatus.settings.bannedStrategySymbols.filter(k => k !== key && !k.startsWith(`${key}::`));
      }
      saveState();
      addLog('info', `🔓 [إلغاء حظر الاستراتيجية] تم إلغاء حظر الاستراتيجية: ${key}`);
    }
    res.json({ success: true, bannedStrategySymbols: botStatus.bannedStrategySymbols || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// مسار فحص جاهزية الخادم
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ═══════════════════════════════════════════════════════════════
//  بدء تشغيل الخادم والبيئة (Vite & Express Server Setup)
// ═══════════════════════════════════════════════════════════════
async function startServer() {
  loadState();
  await fetchExchangeInfo();
  startTradingLoops();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Cloud 24/7 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
