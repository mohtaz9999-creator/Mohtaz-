import React, { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Key,
  RefreshCw,
  Play,
  Square,
  Plus,
  Trash,
  Check,
  AlertTriangle,
  Activity,
  DollarSign,
  Target,
  Percent,
  Award,
  Coins,
  Cpu,
  Zap,
  Sparkles,
  Search,
  CheckSquare,
  Clock,
  Briefcase,
  X,
  Server,
  Bell,
  PhoneCall,
  Crown,
  BarChart3,
  PieChart,
  Sliders,
  ChevronDown,
  ChevronUp,
  HelpCircle
} from "lucide-react";
import { motion } from "motion/react";
import { BotStatus, ApiProfile, BotSettings, Position, PendingOrder, TradeLog, SystemLog } from "./types";
import { HUNDRED_COINS } from "./constants";

// ═══════════════════════════════════════════════════════════════
//  لوحة ثلاثية الأبعاد متحركة للتطبيق (Interactive 3D Floating Panel)
// ═══════════════════════════════════════════════════════════════
function ThreeDCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, rotateX: 6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{
        y: -5,
        rotateX: 4,
        rotateY: -3,
        scale: 1.015,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.985 }}
      style={{ perspective: 1000, transformStyle: "preserve-3d" }}
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-orange-950/40 border border-orange-500/25 shadow-[0_12px_32px_-10px_rgba(234,88,12,0.25),inset_0_1px_1px_rgba(255,255,255,0.1)] transition-all duration-300 hover:border-orange-500/50 hover:shadow-[0_20px_45px_-5px_rgba(234,88,12,0.4),0_0_25px_rgba(249,115,22,0.25)] ${className}`}
    >
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-orange-500/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  تخزين آمن يدعم العمل داخل التطبيقات والهواتف لتجنب مشاكل الأمان والتوقف
// ═══════════════════════════════════════════════════════════════
const safeStorage = {
  getItem: (key: string): string => {
    try {
      return localStorage.getItem(key) || "";
    } catch (e) {
      console.warn("Storage access failed:", e);
      return "";
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Storage write failed:", e);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("Storage delete failed:", e);
    }
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "positions" | "analytics" | "settings" | "api" | "logs">("dashboard");
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("demo");
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCloudGuide, setShowCloudGuide] = useState(true); // Default open to guide the user immediately!

  // ═══════════════════════════════════════════════════════════════
  //  نظام قفل الحماية وتذكر الجلسة وتطبيق الـ APK والمحمول (Security & PWA/Capacitor)
  // ═══════════════════════════════════════════════════════════════
  const [appPin, setAppPin] = useState(() => safeStorage.getItem("BOT_ACCESS_PIN") || "");
  const [isLocked, setIsLocked] = useState(() => {
    const pin = safeStorage.getItem("BOT_ACCESS_PIN") || "";
    if (!pin) return false; // لا يوجد قفل مهيأ
    const sessionActive = safeStorage.getItem("BOT_SESSION_ACTIVE") === "true";
    const sessionExpires = parseInt(safeStorage.getItem("BOT_SESSION_EXPIRES") || "0", 10);
    if (sessionActive && sessionExpires > Date.now()) {
      return false; // الجلسة نشطة ومحفوظة (تذكرني مفعل)
    }
    return true; // يجب فك القفل بالـ PIN
  });
  const [pinDigits, setPinDigits] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [pinError, setPinError] = useState("");

  // لإعدادات القفل في لوحة التحكم
  const [tempPin, setTempPin] = useState("");

  // رابط الخادم السحابي للبوت لتسهيل ربط تطبيق الـ APK والهاتف
  const [serverUrl, setServerUrl] = useState(() => {
    return safeStorage.getItem("BOT_SERVER_URL") || "";
  });

  // تثبيت تطبيق PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) {
      alert("التطبيق مثبت بالفعل كـ تطبيق PWA أو أن متصفحك لا يدعم التثبيت المباشر. يمكنك استخدام خيار 'إضافة إلى الشاشة الرئيسية' (Add to Home Screen) من قائمة المتصفح لديك لتثبيت التطبيق فوراً والحفاظ عليه يعمل في الخلفية.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const getApiUrl = (endpoint: string) => {
    if (serverUrl) {
      const cleanUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
      return `${cleanUrl}${endpoint}`;
    }
    return endpoint;
  };

  // مؤثرات صوتية لصفقات الدخول والخروج حية
  const [soundsEnabled, setSoundsEnabled] = useState(() => safeStorage.getItem("BOT_SOUNDS_ENABLED") !== "false");

  const playTradeSound = (isExit = false) => {
    if (safeStorage.getItem("BOT_SOUNDS_ENABLED") === "false") return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      
      const now = ctx.currentTime;
      
      if (isExit) {
        // نغمة خروج من صفقة (تنازلية تصفيفية مريحة)
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.12);
        osc.frequency.setValueAtTime(440, now + 0.24);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // نغمة دخول صفقة (تصاعدية تصفيفية ممتازة)
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.12);
        osc.frequency.setValueAtTime(659, now + 0.24);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (error) {
      console.error("Web Audio playback failed:", error);
    }
  };

  const handleUnlockApp = (enteredPin: string) => {
    const correctPin = safeStorage.getItem("BOT_ACCESS_PIN") || "";
    if (enteredPin === correctPin) {
      setIsLocked(false);
      setPinError("");
      safeStorage.setItem("BOT_SESSION_ACTIVE", "true");
      // تمديد الصلاحية: 30 يوماً إذا اختار تذكرني، أو 24 ساعة إذا لم يخترها
      const duration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      safeStorage.setItem("BOT_SESSION_EXPIRES", (Date.now() + duration).toString());
    } else {
      setPinError("❌ رمز القفل غير صحيح! حاول مرة أخرى.");
      setPinDigits("");
    }
  };

  const handleLockApp = () => {
    safeStorage.removeItem("BOT_SESSION_ACTIVE");
    safeStorage.removeItem("BOT_SESSION_EXPIRES");
    setIsLocked(true);
    setPinDigits("");
    setPinError("");
  };

  // إعدادات الـ API المؤقتة لإضافة مفتاح جديد
  const [newApiName, setNewApiName] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [newApiSecret, setNewApiSecret] = useState("");
  const [showAddApi, setShowAddApi] = useState(false);

  // البحث في العملات
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTrades, setExpandedTrades] = useState<Record<number, boolean>>({});
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("all");

  // السجلات المفلترة
  const [logFilter, setLogFilter] = useState<"all" | "info" | "success" | "warn" | "error" | "trade">("all");
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // مراجع تتبع إشعارات الصفقات وعد خطأ الاتصال
  const seenLogsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef<boolean>(true);
  const failCountRef = useRef<number>(0);

  // حالات فحص وحقول التلغرام المحلية لتجربة مستخدم سلسة
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTelegramSection, setShowTelegramSection] = useState(true);
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgSummaryToken, setTgSummaryToken] = useState("");
  const [tgSummaryChatId, setTgSummaryChatId] = useState("");
  const [tgSignalsToken, setTgSignalsToken] = useState("");
  const [tgSignalsChatId, setTgSignalsChatId] = useState("");

  // ═══════════════════════════════════════════════════════════════
  //  مزامنة وجلب حالة البوت من الخادم السحابي (Cloud Sync Engine)
  // ═══════════════════════════════════════════════════════════════
  const fetchStatus = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/status"));
      if (response.ok) {
        const data = (await response.json()) as BotStatus;

        failCountRef.current = 0;
        setErrorMessage(null);

        // إذا كان الحساب المحدد غير موجود في القائمة (مثلاً بعد حذفه)، حدد أول حساب متاح تلقائياً
        if (data.apiProfiles && data.apiProfiles.length > 0) {
          const exists = data.apiProfiles.some((p) => p.id === selectedProfileId);
          if (!exists) {
            setSelectedProfileId(data.apiProfiles[0].id);
          }
        }

        // التحقق من الإشعارات الجديدة للصفقات
        if (data.systemLogs && data.systemLogs.length > 0) {
          if (isFirstFetchRef.current) {
            // أول جلب: نقوم فقط بحفظ معرفات السجلات الحالية لتفادي إرسال إشعارات قديمة متراكمة عند فتح الصفحة
            data.systemLogs.forEach((l) => seenLogsRef.current.add(l.id));
            isFirstFetchRef.current = false;
          } else {
            // جلب لاحق: مقارنة وفلترة السجلات الجديدة الخاصة بالصفقات
            const newTradeLogs = data.systemLogs.filter(
              (l) => l.type === 'trade' && !seenLogsRef.current.has(l.id)
            );

            if (newTradeLogs.length > 0) {
              newTradeLogs.forEach((log) => {
                seenLogsRef.current.add(log.id);

                // تشغيل النغمات الصوتية لصفقة دخول أو خروج فوراً
                const msg = log.message;
                const isExit = msg.includes("إغلاق") || msg.includes("خروج") || msg.includes("جني أرباح") || msg.includes("إيقاف خسارة") || msg.includes("Close") || msg.includes("Exit") || msg.includes("TP") || msg.includes("SL") || msg.includes("أرباح");
                playTradeSound(isExit);

                // إطلاق إشعار المتصفح إذا تم تفعيله ومنحه الصلاحية
                if (data.settings.browserNotificationsEnabled && Notification.permission === 'granted') {
                  try {
                    new Notification(isExit ? "خروج وجني أرباح الصفقة 💰" : "دخول صفقة جديدة الآلي 🚀", {
                      body: log.message,
                      icon: "/icon.jpg",
                      badge: "/icon.jpg",
                      vibrate: [200, 100, 200]
                    } as any);
                  } catch (err) {
                    console.error("Failed to show browser notification:", err);
                  }
                }
              });
            }
          }
        }

        setStatus(data);
      } else {
        failCountRef.current += 1;
        if (failCountRef.current >= 3) {
          setErrorMessage("جاري إعادة الاتصال بالخادم السحابي للبوت...");
        }
      }
    } catch (err: any) {
      failCountRef.current += 1;
      if (failCountRef.current >= 3) {
        setErrorMessage("تنبيه: ضعف مؤقت في الاتصال السحابي (البوت يعمل بالخلفية 24/7 دون انقطاع)");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // جلب دوري كل 3 ثوانٍ
  useEffect(() => {
    fetchStatus(true);
    const interval = setInterval(() => {
      fetchStatus(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // تمرير تلقائي لأسفل السجل عند تحديثه
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [status?.systemLogs]);

  // مزامنة أولية لحقول التلغرام عند تحميل البيانات
  const isTgInitializedRef = useRef(false);
  useEffect(() => {
    if (status?.settings && !isTgInitializedRef.current) {
      const s = status.settings;
      if (s.telegramToken) setTgToken(s.telegramToken);
      if (s.telegramChatId) setTgChatId(s.telegramChatId);
      if (s.telegramSummaryToken) setTgSummaryToken(s.telegramSummaryToken);
      if (s.telegramSummaryChatId) setTgSummaryChatId(s.telegramSummaryChatId);
      if (s.telegramSignalsToken) setTgSignalsToken(s.telegramSignalsToken);
      if (s.telegramSignalsChatId) setTgSignalsChatId(s.telegramSignalsChatId);
      isTgInitializedRef.current = true;
    }
  }, [status]);

  // ═══════════════════════════════════════════════════════════════
  //  إجراءات التحكم والربط مع الخادم (API REST Requests)
  // ═══════════════════════════════════════════════════════════════

  // إعادة ضبط التطبيق بالكامل كأول استخدام
  const handleResetApp = async () => {
    if (!window.confirm("⚠️ هل أنت متأكد من إعادة ضبط التطبيق كأول استخدام؟\n\nسيؤدي هذا إلى تصفير الأرصدة التجريبية، مسح سجل الصفقات، فك حظر العملات، وإعادة ضبط جميع الإعدادات للوضع الافتراضي.")) {
      return;
    }
    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/reset-all"), {
        method: "POST"
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
        alert("✅ تم إعادة ضبط التطبيق بنجاح كأول استخدام!");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء إعادة ضبط التطبيق");
    } finally {
      setIsUpdating(false);
    }
  };

  // فك حظر عملة محددة
  const handleUnbanSymbol = async (symbol: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/unban-symbol"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      }
    } catch (err) {
      alert("فشل فك حظر العملة");
    } finally {
      setIsUpdating(false);
    }
  };

  // تشغيل وإيقاف البوت سحابياً
  const handleToggleBot = async (run: boolean) => {
    if (!status) return;
    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/toggle"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء تبديل حالة البوت");
    } finally {
      setIsUpdating(false);
    }
  };

  // حفظ الإعدادات بالكامل
  const handleSaveSettings = async (updatedSettings: Partial<BotSettings>) => {
    if (!status) return;
    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updatedSettings, profileId: selectedProfileId })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      }
    } catch (err: any) {
      alert("فشل حفظ الإعدادات على الخادم");
    } finally {
      setIsUpdating(false);
    }
  };

  // تبديل إشعارات المتصفح وطلب الإذن
  const toggleBrowserNotifications = () => {
    if (!status) return;
    const currentVal = !status.settings.browserNotificationsEnabled;
    if (currentVal && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          handleSaveSettings({ browserNotificationsEnabled: true });
        } else {
          alert("يرجى تمكين أذونات الإشعارات في متصفحك أو إعدادات الهاتف لتلقي الإشعارات حياً.");
          handleSaveSettings({ browserNotificationsEnabled: false });
        }
      });
    } else if (currentVal && Notification.permission === 'denied') {
      alert("لقد قمت بحظر أذونات الإشعارات مسبقاً. يرجى تفعيلها من إعدادات موقعك الحالي في المتصفح أو الهاتف.");
      handleSaveSettings({ browserNotificationsEnabled: false });
    } else {
      handleSaveSettings({ browserNotificationsEnabled: currentVal });
    }
  };

  // حفظ إعدادات ربط التلغرام فوراً
  const handleSaveTelegramSettings = async (explicitEnable = true) => {
    const tokenToSave = tgToken.trim() || currentSettings?.telegramToken || "";
    const chatIdToSave = tgChatId.trim() || currentSettings?.telegramChatId || "";

    if (explicitEnable && (!tokenToSave || !chatIdToSave)) {
      alert("⚠️ يرجى كتابة توكن البوت ومعرف الشات (Chat ID) أولاً لربط التلغرام بنجاح.");
      return;
    }

    await handleSaveSettings({
      telegramEnabled: explicitEnable,
      telegramToken: tokenToSave,
      telegramChatId: chatIdToSave,
      telegramSummaryToken: tgSummaryToken.trim(),
      telegramSummaryChatId: tgSummaryChatId.trim(),
      telegramSignalsToken: tgSignalsToken.trim(),
      telegramSignalsChatId: tgSignalsChatId.trim()
    });
    setTelegramTestResult({
      success: true,
      message: "🟢 تم حفظ وإعادة ربط إعدادات التلغرام بنجاح!"
    });
  };

  // إرسال رسالة تلغرام تجريبية للفحص
  const handleSendTestTelegram = async () => {
    const tokenToTest = tgToken.trim() || currentSettings?.telegramToken || "";
    const chatIdToTest = tgChatId.trim() || currentSettings?.telegramChatId || "";

    if (!tokenToTest || !chatIdToTest) {
      setTelegramTestResult({
        success: false,
        message: "يرجى كتابة توكن البوت ومعرف الشات (Chat ID) أولاً لإجراء الفحص التجريبي."
      });
      return;
    }

    setIsTestingTelegram(true);
    setTelegramTestResult(null);

    // حفظ تلقائي فوري مسبقاً
    await handleSaveSettings({
      telegramEnabled: true,
      telegramToken: tokenToTest,
      telegramChatId: chatIdToTest,
      telegramSummaryToken: tgSummaryToken.trim(),
      telegramSummaryChatId: tgSummaryChatId.trim(),
      telegramSignalsToken: tgSignalsToken.trim(),
      telegramSignalsChatId: tgSignalsChatId.trim()
    });

    try {
      const response = await fetch(getApiUrl("/api/bot/test-telegram"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenToTest,
          chatId: chatIdToTest
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTelegramTestResult({
          success: true,
          message: "🟢 نجحت التجربة! تم حفظ الإعدادات ووصلت الرسالة لتطبيق التلغرام بنجاح."
        });
      } else {
        setTelegramTestResult({
          success: false,
          message: `❌ فشل الإرسال: ${data.error || "تأكد من صحة التوكن والـ Chat ID."}`
        });
      }
    } catch (err: any) {
      setTelegramTestResult({
        success: false,
        message: `❌ خطأ في الاتصال بالخادم: ${err.message}`
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const [dailyAnalyticsData, setDailyAnalyticsData] = useState<any>(null);

  const fetchDailyAnalytics = async () => {
    try {
      const res = await fetch(getApiUrl("/api/bot/daily-analytics"));
      if (res.ok) {
        const data = await res.json();
        setDailyAnalyticsData(data);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchDailyAnalytics();
  }, [status?.tradeHistory?.length, activeTab]);

  const handleSendDailyTelegramReport = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/send-daily-summary-telegram"), {
        method: "POST"
      });
      const data = await response.json();
      if (response.ok && data.success) {
        alert("📲 تم إرسال التقرير والملخص اليومي الشامل للعملات والاستراتيجيات إلى قناة التليجرام بنجاح!");
      } else {
        alert("❌ فشل إرسال التقرير: " + (data.error || "تأكد من إعدادات توكن ومعرف الشات لقناة التليجرام"));
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء التواصل مع خادم التليجرام");
    } finally {
      setIsUpdating(false);
    }
  };

  // تفعيل ملف API وتحديده للعرض
  const handleActivateApiProfile = async (id: string) => {
    if (!status) return;
    setIsUpdating(true);
    try {
      const updatedProfiles = status.apiProfiles.map((p) => {
        if (p.id === id) {
          return { ...p, isActive: true };
        }
        return p;
      });
      const response = await fetch(getApiUrl("/api/bot/api-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiProfiles: updatedProfiles })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
        setSelectedProfileId(id);
      }
    } catch (err: any) {
      alert("فشل تفعيل حساب التداول");
    } finally {
      setIsUpdating(false);
    }
  };

  // تبديل حالة تشغيل/إيقاف تداول الحساب بالخلفية بشكل مستقل مع ضمان تفعيل حساب نشط واحد فقط في كل مرة
  const handleToggleProfileActive = async (id: string) => {
    if (!status) return;
    setIsUpdating(true);
    try {
      const targetProfile = status.apiProfiles.find((p) => p.id === id);
      const isActivating = targetProfile ? !targetProfile.isActive : false;

      const updatedProfiles = status.apiProfiles.map((p) => {
        if (p.id === id) {
          return { ...p, isActive: isActivating };
        }
        // إذا كان الحساب يتم تفعيله، نقوم بإلغاء تفعيل كافة الحسابات الأخرى ليعمل البوت على حساب واحد نشط بالخلفية دائماً
        if (isActivating) {
          return { ...p, isActive: false };
        }
        return p;
      });
      const response = await fetch(getApiUrl("/api/bot/api-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiProfiles: updatedProfiles })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      }
    } catch (err: any) {
      alert("فشل تغيير حالة تشغيل الحساب");
    } finally {
      setIsUpdating(false);
    }
  };

  // إضافة ملف API جديد
  const handleAddApiProfile = async () => {
    if (!status || !newApiName.trim() || !newApiKey.trim() || !newApiSecret.trim()) {
      alert("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }

    const newProfile: ApiProfile = {
      id: "api_" + Math.random().toString(36).substring(2, 11),
      name: newApiName,
      apiKey: newApiKey,
      apiSecret: newApiSecret,
      isActive: false,
      isDemo: false,
    };

    const updatedProfiles = [...status.apiProfiles, newProfile];
    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/api-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiProfiles: updatedProfiles })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
        setNewApiName("");
        setNewApiKey("");
        setNewApiSecret("");
        setShowAddApi(false);
      }
    } catch (err: any) {
      alert("فشل إضافة ملف الـ API");
    } finally {
      setIsUpdating(false);
    }
  };

  // حذف ملف API (يشمل الحساب التجريبي والحسابات الحقيقية)
  const handleDeleteApiProfile = async (id: string) => {
    if (!status) return;
    const isDemoAcc = id === "demo";
    if (!confirm(isDemoAcc ? "هل أنت متأكد من رغبتك في حذف الحساب التجريبي بالكامل؟" : "هل أنت متأكد من رغبتك في حذف هذا الحساب؟")) return;

    const updatedProfiles = status.apiProfiles.filter((p) => p.id !== id);
    const wasActive = status.apiProfiles.find((p) => p.id === id)?.isActive;
    if (wasActive && updatedProfiles.length > 0) {
      updatedProfiles[0].isActive = true;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/api-keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiProfiles: updatedProfiles })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
        if (data.apiProfiles && data.apiProfiles.length > 0) {
          const nextProf = data.apiProfiles.find((p) => p.id !== id) || data.apiProfiles[0];
          setSelectedProfileId(nextProf.id);
        } else {
          setSelectedProfileId("");
        }
      }
    } catch (err: any) {
      alert("فشل حذف حساب التداول");
    } finally {
      setIsUpdating(false);
    }
  };

  // إغلاق صفقة معينة يدوياً
  const handleClosePosition = async (key: string, symbol: string) => {
    if (!status) return;
    if (!confirm(`هل أنت متأكد من رغبتك في إغلاق صفقة ${symbol} فوراً بسعر السوق الحالي؟`)) return;

    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/manual-close"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, symbol })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      } else {
        const errData = await response.json();
        alert(errData.error || "فشل إغلاق الصفقة");
      }
    } catch (err: any) {
      alert("فشل الاتصال بالخادم لإغلاق الصفقة");
    } finally {
      setIsUpdating(false);
    }
  };

  // زر الطوارئ لإغلاق كافة الصفقات وإلغاء الأوامر المعلقة
  const handleCloseAllPositions = async () => {
    if (!status) return;
    if (!confirm("🚨 تحذير طارئ! هل تريد حقاً تصفية وإغلاق كافة الصفقات المفتوحة وإلغاء جميع الأوامر المعلقة فوراً؟")) return;

    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/close-all"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: selectedProfileId })
      });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      }
    } catch (err: any) {
      alert("فشل تنفيذ زر الطوارئ");
    } finally {
      setIsUpdating(false);
    }
  };

  // إعادة تعيين الحساب التجريبي بالكامل
  const handleResetDemoBalance = async () => {
    if (!status) return;
    if (!confirm("هل ترغب في إعادة تعيين الرصيد التجريبي ومسح السجل التاريخي للصفقات لبدء اختبار جديد؟")) return;

    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/reset-demo"), { method: "POST" });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      }
    } catch (err) {
      alert("فشل إعادة التعيين");
    } finally {
      setIsUpdating(false);
    }
  };

  // إعادة تهيئة التطبيق بالكامل وتفريغ الإعدادات كأول مرة
  const handleResetAll = async () => {
    if (!status) return;
    if (!confirm("🚨 تحذير هام جداً! هل ترغب في إعادة تهيئة التطبيق بالكامل كأنك تستخدمه لأول مرة؟ سيتم حذف كافة مفاتيح الـ API المضافة، ومسح كافة الإعدادات والصفقات الحالية، وسيبدأ الحساب التجريبي برصيد 1000 USDT.")) return;

    setIsUpdating(true);
    try {
      const response = await fetch(getApiUrl("/api/bot/reset-all"), { method: "POST" });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);

        // مسح التخزين المحلي للعميل لضمان تصفير التطبيق بالكامل
        safeStorage.removeItem("BOT_ACCESS_PIN");
        safeStorage.removeItem("BOT_SESSION_ACTIVE");
        safeStorage.removeItem("BOT_SESSION_EXPIRES");
        safeStorage.removeItem("BOT_SERVER_URL");
        safeStorage.removeItem("BOT_SOUNDS_ENABLED");
        
        setAppPin("");
        setIsLocked(false);
        setServerUrl("");
        setSelectedProfileId("demo");

        alert("🟢 تم تصفير وإعادة تهيئة التطبيق بالكامل كأول مرة بنجاح! رصيد الحساب التجريبي الآن هو 1000 USDT.");
      } else {
        alert("فشل تنفيذ إعادة التهيئة من الخادم");
      }
    } catch (err: any) {
      alert("فشل إعادة التهيئة الكاملة: " + (err?.message || "خطأ في الاتصال"));
    } finally {
      setIsUpdating(false);
    }
  };

  // مسح السجلات
  const handleClearLogs = async () => {
    if (!status) return;
    try {
      const response = await fetch(getApiUrl("/api/bot/clear-logs"), { method: "POST" });
      if (response.ok) {
        const data = (await response.json()) as BotStatus;
        setStatus(data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  //  التحليل الإحصائي وواجهة المستخدم (Analytics & Views)
  // ═══════════════════════════════════════════════════════════════
  const activeProfile = status?.apiProfiles.find((p) => p.id === selectedProfileId);
  const currentSettings = activeProfile?.settings || status?.settings;
  const isCurrentlyDemo = selectedProfileId === "demo";

  const activeProfileBalance = isCurrentlyDemo
    ? (status?.currentBalance ?? 0)
    : (activeProfile?.balance ?? 0);
  const activeProfileInitialBalance = isCurrentlyDemo
    ? (status?.initialBalance ?? 0)
    : (activeProfile?.initialBalance ?? 0);
  const activeProfileDailyPnlPct = isCurrentlyDemo
    ? (status?.dailyPnlPct ?? 0)
    : (activeProfileInitialBalance > 0 
        ? ((activeProfileBalance - activeProfileInitialBalance) / activeProfileInitialBalance) * 100 
        : 0);

  const getConsecutiveLossesCount = (profileId: string) => {
    if (!status || !status.tradeHistory) return 0;
    const profileHistory = status.tradeHistory
      .filter((t) => t.profileId === profileId)
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
  };

  const calculateStats = () => {
    if (!status) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnlPercent: 0,
        avgProfitPercent: 0,
        avgLossPercent: 0,
        bestTrade: null as TradeLog | null,
        worstTrade: null as TradeLog | null,
        winsCount: 0,
        lossesCount: 0,
      };
    }

    const history = selectedProfileId === "demo"
      ? status.tradeHistory.filter((t) => t.profileId === "demo" || !t.profileId)
      : status.tradeHistory.filter((t) => t.profileId === selectedProfileId);

    if (history.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnlPercent: 0,
        avgProfitPercent: 0,
        avgLossPercent: 0,
        bestTrade: null as TradeLog | null,
        worstTrade: null as TradeLog | null,
        winsCount: 0,
        lossesCount: 0,
      };
    }

    const totalTrades = history.length;
    const wins = history.filter((t) => t.pnl_pct_leveraged > 0);
    const losses = history.filter((t) => t.pnl_pct_leveraged <= 0);
    const winsCount = wins.length;
    const lossesCount = losses.length;
    const winRate = (winsCount / totalTrades) * 100;

    const totalPnlPercent = history.reduce((sum, t) => sum + t.pnl_pct_leveraged, 0);
    const avgProfitPercent = winsCount > 0 ? wins.reduce((sum, t) => sum + t.pnl_pct_leveraged, 0) / winsCount : 0;
    const avgLossPercent = lossesCount > 0 ? losses.reduce((sum, t) => sum + t.pnl_pct_leveraged, 0) / lossesCount : 0;

    const sortedByPnl = [...history].sort((a, b) => b.pnl_pct_leveraged - a.pnl_pct_leveraged);
    const bestTrade = sortedByPnl[0];
    const worstTrade = sortedByPnl[sortedByPnl.length - 1];

    return {
      totalTrades,
      winRate,
      totalPnlPercent,
      avgProfitPercent,
      avgLossPercent,
      bestTrade,
      worstTrade,
      winsCount,
      lossesCount,
    };
  };

  const stats = calculateStats();

  const activeHistory = status
    ? (selectedProfileId === "demo"
      ? status.tradeHistory.filter((t) => t.profileId === "demo" || !t.profileId)
      : status.tradeHistory.filter((t) => t.profileId === selectedProfileId))
    : [];

  // تنسيق مدة التشغيل
  const formatUptime = (totalSeconds: number) => {
    const d = Math.floor(totalSeconds / (3600 * 24));
    const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;

    const parts = [];
    if (d > 0) parts.push(`${d} يوم`);
    if (h > 0) parts.push(`${h} ساعة`);
    if (m > 0 || h > 0) parts.push(`${m} دقيقة`);
    parts.push(`${s} ثانية`);

    return parts.join(" و ");
  };

  // تصفية العملات بناءً على البحث
  const ALL_AVAILABLE_COINS = HUNDRED_COINS;
  const filteredCoins = ALL_AVAILABLE_COINS.filter((coin) =>
    coin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFilteredLogs = () => {
    if (!status) return [];
    let logs = status.systemLogs;
    if (selectedProfileId === "demo") {
      const realNames = status.apiProfiles.map(p => p.name).filter(Boolean);
      logs = logs.filter((log) => {
        return !realNames.some(name => log.message.includes(`[${name}]`));
      });
    } else if (activeProfile) {
      logs = logs.filter((log) => {
        if (log.message.includes("[")) {
          return log.message.includes(`[${activeProfile.name}]`);
        }
        return true;
      });
    }
    if (logFilter === "all") return logs;
    return logs.filter((log) => log.type === logFilter);
  };

  const displayedLogs = getFilteredLogs();

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased flex flex-col max-w-md mx-auto relative border-x border-slate-900 shadow-2xl overflow-hidden px-6 py-12 select-none justify-between" dir="rtl" id="lock_screen">
        {/* تأثيرات خلفية ضوئية */}
        <div className="absolute top-0 left-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl"></div>

        {/* الشعار والعنوان */}
        <div className="flex flex-col items-center text-center mt-8 relative z-10">
          <div className="w-16 h-16 bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center mb-4 shadow-lg">
            <Cpu className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-lg font-black text-slate-100">البوت السحابي الآلي</h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">لوحة التحكم الآمنة لعقود Binance Futures</p>
          <span className="text-[10px] mt-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-sans flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            البوت يعمل بالخلفية 24/7
          </span>
        </div>

        {/* مؤشرات الأرقام */}
        <div className="flex flex-col items-center relative z-10">
          <span className="text-xs text-slate-400 mb-4 font-sans">أدخل رمز مرور حماية التطبيق:</span>
          
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border transition-all duration-200 ${
                  pinDigits.length > index
                    ? "bg-emerald-400 border-emerald-400 scale-110 shadow-[0_0_10px_#10b981]"
                    : "bg-slate-900 border-slate-700"
                }`}
              ></div>
            ))}
          </div>

          {pinError && (
            <p className="text-xs text-rose-400 font-sans text-center mb-4 animate-bounce">
              {pinError}
            </p>
          )}

          {/* خيار تذكرني */}
          <label className="flex items-center gap-2 cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800/40 rounded-xl px-4 py-2 transition-all select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
            />
            <span className="text-[10px] font-bold text-slate-300">تذكرني على هذا الجهاز (30 يوماً)</span>
          </label>
        </div>

        {/* لوحة الأرقام */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto w-full mb-8 relative z-10 font-sans" id="pin_pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => {
                if (pinDigits.length < 4) {
                  const newDigits = pinDigits + num;
                  setPinDigits(newDigits);
                  setPinError("");
                  if (newDigits.length === 4) {
                    setTimeout(() => handleUnlockApp(newDigits), 150);
                  }
                }
              }}
              className="aspect-square rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-750 border border-slate-800/60 text-slate-100 text-lg font-black transition-all duration-150 flex items-center justify-center shadow-sm cursor-pointer"
            >
              {num}
            </button>
          ))}
          
          <button
            onClick={() => {
              if (pinDigits.length > 0) {
                setPinDigits(pinDigits.slice(0, -1));
              }
              setPinError("");
            }}
            className="aspect-square rounded-2xl bg-slate-900/40 hover:bg-slate-900 active:bg-slate-800 text-slate-400 border border-transparent text-xs font-bold transition-all flex items-center justify-center cursor-pointer"
          >
            مسح
          </button>

          <button
            onClick={() => {
              if (pinDigits.length < 4) {
                const newDigits = pinDigits + "0";
                setPinDigits(newDigits);
                setPinError("");
                if (newDigits.length === 4) {
                  setTimeout(() => handleUnlockApp(newDigits), 150);
                }
              }
            }}
            className="aspect-square rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-750 border border-slate-800/60 text-slate-100 text-lg font-black transition-all duration-150 flex items-center justify-center shadow-sm cursor-pointer"
          >
            0
          </button>

          <button
            onClick={() => {
              if (confirm("هل نسيت رمز القفل؟ سيؤدي هذا إلى إعادة تعيين إعدادات القفل المحلية لتمكينك من الدخول.")) {
                safeStorage.removeItem("BOT_ACCESS_PIN");
                safeStorage.removeItem("BOT_SESSION_ACTIVE");
                safeStorage.removeItem("BOT_SESSION_EXPIRES");
                setAppPin("");
                setIsLocked(false);
                alert("تم إزالة رمز القفل بنجاح. يمكنك الدخول الآن وإعادة تعيين رمز مرور جديد من قسم الإعدادات.");
              }
            }}
            className="aspect-square rounded-2xl bg-slate-950/20 hover:bg-rose-500/10 active:bg-rose-500/20 text-rose-400 text-[10px] font-bold transition-all flex items-center justify-center leading-tight cursor-pointer"
          >
            نسيت الرمز؟
          </button>
        </div>

        <p className="text-[10px] text-slate-500 text-center font-sans">
          أمان فائق لوصلات تداول العقود الآجلة Binance Futures
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-orange-950/30 text-slate-100 font-sans antialiased flex flex-col max-w-md mx-auto relative border-x border-orange-900/30 shadow-2xl overflow-x-hidden pb-24 select-none" dir="rtl" id="app_root">
      
      {/* 👑 شريط المالِك الفاخر والدعم المباشر */}
      <div className="bg-gradient-to-r from-orange-500/25 via-amber-500/20 to-slate-950 border-b border-orange-500/40 px-4 py-2 flex items-center justify-between shadow-md relative overflow-hidden" id="owner_ribbon">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg border border-orange-300/50 text-slate-950 font-black text-sm shrink-0">
            <Crown className="w-4 h-4 text-slate-950 fill-current" />
          </div>
          <div>
            <span className="text-[9px] text-amber-300/90 font-bold block leading-none">المالِك والمدير العام</span>
            <h2 className="text-xs font-black text-slate-100 tracking-wide font-sans mt-0.5 flex items-center gap-1.5">
              معتز الداودية
              <span className="text-[8px] bg-orange-400/20 text-orange-300 border border-orange-400/30 px-1.5 py-0.2 rounded-full font-mono font-extrabold shadow-sm">VIP OWNER</span>
            </h2>
          </div>
        </div>

        <a
          href="tel:0781833111"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500/25 via-amber-500/20 to-orange-500/25 hover:from-orange-500/40 hover:to-amber-500/40 border border-orange-400/50 rounded-xl text-orange-300 hover:text-orange-100 transition-all shadow-md active:scale-95 cursor-pointer"
          title="اتصال مباشر بالمالك معتز الداودية"
        >
          <PhoneCall className="w-3.5 h-3.5 text-orange-400 animate-pulse shrink-0" />
          <span className="text-[10px] font-mono font-black tracking-wide dir-ltr text-orange-200">0781833111</span>
        </a>
      </div>

      {/* 🟠 الهيدر العلوي المطور للتطبيق (otaz plus) */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-orange-500/20 px-4 py-3 flex items-center justify-between" id="header">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-slate-900 rounded-2xl border border-orange-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(234,88,12,0.3)] relative">
            <Zap className={`w-5 h-5 ${status?.isRunning ? "text-orange-400 animate-pulse" : "text-slate-400"}`} />
            {status?.isRunning && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-400 rounded-full border-2 border-slate-950 animate-ping"></span>
            )}
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-100 flex items-center gap-1.5 font-sans tracking-wide">
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">otaz plus</span>
              <span className="text-[8px] bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-300 px-1.5 py-0.5 rounded-md font-mono border border-orange-500/30 font-extrabold">3D AI ENGINE</span>
            </h1>
            <p className="text-[9px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${status?.isRunning ? 'bg-orange-400 animate-pulse' : 'bg-rose-500'}`}></span>
              {status?.isRunning ? "حارس التداول السحابي نشط (otaz plus)" : "التداول معلق مؤقتاً"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 🤪🔥 مؤشر الزر المجنون إذا كان مفعلاً */}
          {currentSettings?.crazyMode && (
            <div className="flex items-center gap-1 bg-red-500/20 px-2.5 py-1 rounded-xl border border-red-500/40 animate-pulse" title="الزر المجنون نشط - أقصى رافعة مالية مفعّلة لكل عملة">
              <span className="text-xs">🤪</span>
              <span className="text-[9px] font-mono font-bold text-red-300 hidden sm:inline">الزر المجنون</span>
            </div>
          )}

          {/* مؤشر حالة الخادم */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800/80">
            <span className={`w-2 h-2 rounded-full ${errorMessage ? "bg-amber-500 animate-ping" : "bg-emerald-400"}`}></span>
            <span className="text-[9px] font-mono font-bold text-slate-300">
              {errorMessage ? "غير متصل" : "متصل السحابة"}
            </span>
          </div>

          {/* مفتاح تبديل البوت الكلي */}
          {status && (
            <button
              onClick={() => handleToggleBot(!status.isRunning)}
              disabled={isUpdating}
              className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                status.isRunning
                  ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }`}
            >
              {status.isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{status.isRunning ? "إيقاف" : "تشغيل"}</span>
            </button>
          )}
        </div>
      </header>

      {/* تنبيه حالة الأخطاء إن وجدت */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-2 text-amber-400 text-xs animate-fade-in" id="error_alert">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => fetchStatus(true)}
              className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
            >
              إعادة الاتصال 🔄
            </button>
            {serverUrl && (
              <button
                onClick={() => {
                  safeStorage.removeItem("BOT_SERVER_URL");
                  setServerUrl("");
                  fetchStatus(true);
                }}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
              >
                إعادة ضبط ⚙️
              </button>
            )}
          </div>
        </div>
      )}

      {/* المحتوى الرئيسي للتبويبات */}
      <main className="p-4 flex-1 overflow-y-auto space-y-4" id="main_content">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3" id="loading_spinner">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-xs text-slate-400">جاري الاتصال بقاعدة البيانات السحابية...</p>
          </div>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════════
                التبويب الأول: لوحة التحكم الإحصائية (Dashboard Tab)
                ═══════════════════════════════════════════════════════════════ */}
            {activeTab === "dashboard" && (
              <div className="space-y-4 animate-fade-in" id="dashboard_tab">
                
                {/* تنبيه حارس الساعات الخاسرة التلقائي */}
                {status?.timeGuardPaused && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-start gap-2.5 relative overflow-hidden animate-pulse" id="time_guard_banner">
                    <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-xs font-bold text-amber-200 block">⏸️ حارس الساعات الخاسرة نشط (تعليق تلقائي لحماية المحفظة)</span>
                      <p className="text-[10px] text-amber-300/80 leading-relaxed">
                        {status.timeGuardReason || "الساعة الحالية أظهرت نسبة نجاح ضعيفة في السجل التاريخي. تم تعليق دخول الصفقات مؤقتاً لحين الانتقال لساعة ذات زخم مربح."}
                      </p>
                    </div>
                  </div>
                )}

                {/* تنبيه التشغيل والدوام 24/7 والسماح بتثبيته كتطبيق */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-start gap-2.5 relative overflow-hidden" id="pwa_alert">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-xs font-bold text-slate-100 block">البوت يعمل في السحابة على مدار الساعة 24/7 🚀</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      سيرفر التداول مستقل تماماً ويقوم بفحص الأسواق وتنفيذ الصفقات في الخلفية حتى لو كانت شاشة هاتفك مغلقة أو كنت خارج الإنترنت. للتنقل السريع وتجنب الخروج المتكرر، ثبت التطبيق كـ تطبيق مستقل على هاتفك الآن!
                    </p>
                    <div className="flex gap-2 pt-1.5">
                      <button
                        onClick={handleInstallPwa}
                        className="p-1 px-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[9px] font-extrabold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        تثبيت التطبيق على الشاشة الرئيسية 📱
                      </button>
                    </div>
                  </div>
                </div>

                {/* كارت حالة السوق والبيتكوين وحارس الخسائر المتتالية */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="market_guardian_section">
                  {/* كارت حالة السوق */}
                  <div className="bg-slate-900 border border-slate-800/40 rounded-3xl p-4.5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl"></div>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl shrink-0">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">حالة السوق الحالية</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-sm font-black text-slate-200">
                            {status?.marketState === "EXTREME_UP" && "صعود قوي ومتسارع 🚀"}
                            {status?.marketState === "EXTREME_DOWN" && "هبوط حاد وعنيف ⚠️"}
                            {(status?.marketState === "NORMAL" || !status?.marketState) && "طبيعي ومستقر 📊"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* كارت حالة البيتكوين */}
                  <div className="bg-slate-900 border border-slate-800/40 rounded-3xl p-4.5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        status?.btcHealth === 'RED' ? "bg-rose-500/10 text-rose-400" :
                        status?.btcHealth === 'YELLOW' ? "bg-amber-500/10 text-amber-400" :
                        "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">مؤشر صحة البيتكوين (BTC)</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-sm font-black text-slate-200">
                            {status?.btcHealth === 'RED' ? "خطرة جداً - هبوط عنيف 🔴" :
                             status?.btcHealth === 'YELLOW' ? "حذرة ومتذبذبة 🟡" :
                             "مستقرة وآمنة 🟢"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* حارس الخسائر المتتالية للحساب الحالي (نظام حماية رأس المال) */}
                {activeProfile && (() => {
                  const losses = activeProfile.consecutiveLosses || 0;
                  const isPaused = activeProfile.consecutiveLossesPaused;
                  if (isPaused) {
                    return (
                      <ThreeDCard className="bg-gradient-to-br from-rose-950/60 via-slate-900 to-orange-950/40 border-rose-500/40 p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl shrink-0 mt-0.5">
                            <ShieldAlert className="w-5 h-5 animate-bounce" />
                          </div>
                          <div className="space-y-1 text-right">
                            <span className="text-xs font-bold text-rose-400 block">⚠️ تم تفعيل نظام حماية رأس المال للحساب [{activeProfile.name}]</span>
                            <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                              تعرض هذا الحساب لـ <b>صفقتين خاسرتين متتاليتين</b>. تم تفعيل الإيقاف المؤقت التلقائي لمدة <b>30 دقيقة</b> لحماية المحفظة.
                            </p>
                            <p className="text-[10px] text-orange-400 font-bold leading-relaxed mt-1 flex items-center gap-1">
                              🔥 سيتم استئناف التداول تلقائياً فور انقضاء المدة مع <b>مضاعفة قيمة الدخول بالصفقة التالية</b> لاستعادة الرصيد بحرفية عالية.
                            </p>
                          </div>
                        </div>
                      </ThreeDCard>
                    );
                  } else if (losses > 0) {
                    return (
                      <ThreeDCard className="p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-orange-500/20 text-orange-400 rounded-lg shrink-0">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] font-bold text-slate-200 block">نظام حماية رأس المال (otaz plus) نشط 🛡️</span>
                              <p className="text-[9px] text-slate-400 mt-0.5">البوت يراقب النتائج: عند خسارتين متتاليتين سيتوقف 30 دقيقة ويضاعف الدخول التالي.</p>
                            </div>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-xs bg-orange-500/20 text-orange-300 px-2.5 py-1 rounded-lg font-bold border border-orange-500/30">
                              الخسائر: {losses} / 2
                            </span>
                          </div>
                        </div>
                      </ThreeDCard>
                    );
                  }
                  return null;
                })()}

                {/* كارت المحفظة والرصيد المعزز */}
                <div className="bg-slate-900 border border-slate-900 rounded-3xl p-5 relative overflow-hidden" id="wallet_card">
                  {/* تأثيرات خلفية ضوئية */}
                  <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl"></div>

                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">الرصيد المتاح حالياً</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black font-mono text-slate-100">
                          {activeProfileBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-bold text-slate-400 font-mono">USDT</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-slate-400 block font-bold">الحساب المعروض</span>
                      <span className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1 bg-emerald-500/5 px-2 py-0.5 rounded-lg border border-emerald-500/10 font-mono">
                        <Server className="w-3 h-3" />
                        {activeProfile?.name}
                      </span>
                    </div>
                  </div>

                  {/* إحصائية الربح اليومي السريع */}
                  <div className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-slate-800/60 relative z-10">
                    <div>
                      <span className="text-[9px] text-slate-400 block">العائد اليومي PnL للحساب:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {activeProfileDailyPnlPct >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className={`text-xs font-bold font-mono ${activeProfileDailyPnlPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {activeProfileDailyPnlPct >= 0 ? "+" : ""}{activeProfileDailyPnlPct.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-[9px] text-slate-400 block">مدة التشغيل السحابي المستمر:</span>
                      <span className="text-xs font-bold text-slate-300 font-mono block mt-0.5">
                        {status ? formatUptime(status.uptimeSeconds) : "0 ثانية"}
                      </span>
                    </div>
                  </div>

                  {/* خط التقدم لنسبة وقف الخسارة والربح اليومي */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 relative z-10 space-y-1.5">
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>وقف خسارة يومي: -{currentSettings?.maxDailyLossPct}%</span>
                      <span>هدف ربح يومي: +{currentSettings?.maxDailyProfitPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${activeProfileDailyPnlPct >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} 
                        style={{ width: `${Math.min(100, Math.max(0, (activeProfileDailyPnlPct + (currentSettings?.maxDailyLossPct || 15)) / ((currentSettings?.maxDailyProfitPct || 100) + (currentSettings?.maxDailyLossPct || 15)) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* كروت bento السريعة للإحصائيات */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 border border-slate-900 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                      <Award className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">نسبة النجاح Win-Rate</span>
                      <span className="text-sm font-black font-mono text-slate-100">{stats.winRate.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-900 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">إجمالي الأرباح التراكمية</span>
                      <span className="text-sm font-black font-mono text-slate-100">{stats.totalPnlPercent >= 0 ? "+" : ""}{stats.totalPnlPercent.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-900 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-slate-800 text-slate-400 rounded-xl">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">إجمالي الصفقات</span>
                      <span className="text-sm font-black font-mono text-slate-100">{stats.totalTrades} صفقة</span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-900 p-3.5 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-bold">آخر فحص سحابي</span>
                      <span className="text-xs font-black font-mono text-slate-100">
                        {status?.lastScanTime ? new Date(status.lastScanTime).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "لا يوجد"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* كارت تفاصيل الصفقات المغلقة الرابحة والخاسرة */}
                <div className="bg-slate-900 border border-slate-900 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300">تفاصيل الصفقات المنفذة</h4>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">الصفقات الرابحة:</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">{stats.winsCount} صفقات</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">الصفقات الخاسرة:</span>
                      <span className="text-xs font-bold text-rose-400 font-mono">{stats.lossesCount} صفقات</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[9px] text-slate-400 block">متوسط ربح الرابحة:</span>
                      <span className="text-xs font-black text-emerald-400 font-mono block mt-0.5">+{stats.avgProfitPercent.toFixed(2)}%</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[9px] text-slate-400 block">متوسط خسارة الخاسرة:</span>
                      <span className="text-xs font-black text-rose-400 font-mono block mt-0.5">{stats.avgLossPercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                {/* كارت الأداء للأفضل والأسوأ */}
                {stats.totalTrades > 0 && (
                  <div className="bg-slate-900 border border-slate-900 rounded-2xl p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-300">أعلى صفقات أداءً وتأثيراً</h4>
                    
                    {stats.bestTrade && (
                      <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-emerald-400 font-mono bg-emerald-400/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">أفضل صفقة</span>
                          <span className="text-xs font-bold text-slate-200 font-mono">{stats.bestTrade.symbol}</span>
                        </div>
                        <span className="text-xs font-black text-emerald-400 font-mono">+{stats.bestTrade.pnl_pct_leveraged.toFixed(1)}%</span>
                      </div>
                    )}

                    {stats.worstTrade && (
                      <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-rose-400 font-mono bg-rose-400/5 border border-rose-500/10 px-1.5 py-0.5 rounded">أسوأ صفقة</span>
                          <span className="text-xs font-bold text-slate-200 font-mono">{stats.worstTrade.symbol}</span>
                        </div>
                        <span className="text-xs font-black text-rose-400 font-mono">{stats.worstTrade.pnl_pct_leveraged.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                )}

                {/* سجل الصفقات التاريخية المكتملة والمجتزأة */}
                <div className="bg-slate-900 border border-slate-900/40 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span>📝 سجل الصفقات المغلقة والمجزأة</span>
                    </h4>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                      الإجمالي: {activeHistory.length} صفقة
                    </span>
                  </div>

                  {activeHistory.length === 0 ? (
                    <div className="bg-slate-950/40 p-6 rounded-xl text-center text-slate-600 border border-slate-950">
                      <p className="text-[10px]">لا توجد صفقات مغلقة مسجلة حالياً.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1" id="trade_history_scroll">
                      {activeHistory.slice(0, 15).map((trade, idx) => {
                        const isWin = trade.pnl_pct_leveraged > 0;
                        const formattedTime = new Date(trade.timestamp).toLocaleString("ar-EG", {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        return (
                          <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-900 space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black font-mono text-slate-100">{trade.symbol}</span>
                                {trade.side === 'buy' ? (
                                  <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/5 px-1 py-0.2 rounded">LONG شراء ↗</span>
                                ) : (
                                  <span className="text-[8px] font-bold text-rose-400 bg-rose-400/5 px-1 py-0.2 rounded">SHORT بيع ↘</span>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${isWin ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'}`}>
                                {isWin ? '+' : ''}{trade.pnl_pct_leveraged.toFixed(1)}% 
                                {trade.pnl_usdt !== undefined && ` (${isWin ? '+' : ''}$${trade.pnl_usdt.toFixed(2)})`}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400 font-sans leading-relaxed border-t border-slate-900/60 pt-1.5 text-right">
                              <div>
                                <span className="text-slate-500 block">طريقة الدخول:</span>
                                <span className="font-semibold text-slate-300">{trade.strategy}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">سعر الدخول / الخروج:</span>
                                <span className="font-semibold text-slate-300 font-mono">{trade.entry.toFixed(3)} ← {trade.exit.toFixed(3)}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">سبب الإغلاق:</span>
                                <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.reason}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">التاريخ والوقت:</span>
                                <span className="font-mono text-slate-400">{formattedTime}</span>
                              </div>
                            </div>

                            {/* زر تفاصيل التحليل وبيئة السوق */}
                            <button
                              onClick={() => {
                                setExpandedTrades(prev => ({
                                  ...prev,
                                  [idx]: !prev[idx]
                                }));
                              }}
                              className="w-full mt-2 py-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[9px] text-slate-300 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <span>{expandedTrades[idx] ? "▲ إخفاء تفاصيل التحليل وحالة السوق" : "📊 عرض تفاصيل التحليل وحالة البتكوين والسوق"}</span>
                            </button>

                            {expandedTrades[idx] && (
                              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 text-right text-[9px] space-y-2 animate-fade-in">
                                <div className="grid grid-cols-2 gap-2 text-slate-400">
                                  {/* حالة الدخول */}
                                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-900/60 space-y-1">
                                    <span className="text-[10px] text-emerald-400 font-bold block border-b border-slate-850 pb-1">🚦 عند الفتح (Entry)</span>
                                    <div>سعر البتكوين: <span className="font-mono text-slate-200 font-semibold">{trade.btcPriceAtOpen ? `$${trade.btcPriceAtOpen.toLocaleString()}` : "غير معروف"}</span></div>
                                    <div>صحة البتكوين: <span className="font-semibold text-slate-200">{trade.btcHealthAtOpen || "GREEN"}</span></div>
                                    <div>حالة السوق: <span className="font-semibold text-slate-200">{trade.marketStateAtOpen || "NORMAL"}</span></div>
                                  </div>

                                  {/* حالة الإغلاق */}
                                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-900/60 space-y-1">
                                    <span className="text-[10px] text-rose-400 font-bold block border-b border-slate-850 pb-1">🏁 عند الإغلاق (Exit)</span>
                                    <div>سعر البتكوين: <span className="font-mono text-slate-200 font-semibold">{trade.btcPriceAtClose ? `$${trade.btcPriceAtClose.toLocaleString()}` : "غير معروف"}</span></div>
                                    <div>صحة البتكوين: <span className="font-semibold text-slate-200">{trade.btcHealthAtClose || "GREEN"}</span></div>
                                    <div>حالة السوق: <span className="font-semibold text-slate-200">{trade.marketStateAtClose || "NORMAL"}</span></div>
                                  </div>
                                </div>

                                {/* ملخص الاستراتيجية المكتوب */}
                                <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-900/60 space-y-1">
                                  <span className="text-[10px] text-slate-300 font-bold block border-b border-slate-850 pb-1">🧠 ملخص قرار الاستراتيجية وتفسير الصفقة:</span>
                                  <p className="text-slate-300 leading-relaxed font-sans text-right whitespace-pre-line">
                                    {trade.strategySummary || `تم اختيار هذه الصفقة بناءً على إشارة من استراتيجية ${trade.strategy} في ظل ظروف السوق الحالية.`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* دليل حل مشكلة توقف البوت عند إغلاق التطبيق */}
                <div className="bg-slate-900 border border-amber-500/15 rounded-2xl p-4 space-y-3 relative overflow-hidden text-right" id="cloud_247_guide">
                  <div className="flex justify-between items-start gap-2 cursor-pointer select-none" onClick={() => setShowCloudGuide(!showCloudGuide)}>
                    <div className="flex items-start gap-2.5 text-right w-full">
                      <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 mt-0.5">
                        <Server className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200 block">❓ كيف تجعل البوت يتداول 24 ساعة دون أي توقف عند إغلاق الهاتف؟</span>
                        <span className="text-[9px] text-slate-400 block leading-relaxed">
                          نظراً لأن سيرفر البوت مستضاف سحابياً، فهو يدخل تلقائياً في وضع "السكون" لتوفير الموارد بعد إغلاقك للتطبيق. اضغط هنا لقراءة الحلول الفورية لتشغيل دائم دون توقف.
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-amber-400 font-extrabold select-none shrink-0 mt-1">
                      {showCloudGuide ? "▲ إخفاء" : "▼ عرض الحل"}
                    </span>
                  </div>

                  {showCloudGuide && (
                    <div className="text-right text-[10px] text-slate-300 leading-relaxed space-y-3 pt-3 border-t border-slate-800/80 animate-fade-in">
                      <p className="text-amber-400/90 font-bold">
                        💡 السيرفر السحابي للبوت مستعد للعمل 24 ساعة، ولكنه ينعس ويقف مؤقتاً عند عدم وجود زوار نشطين. يمكنك منع السيرفر من النوم وجعله يتداول ويسجل الساعات بدون انقطاع باتباع إحدى الطريقتين التاليتين:
                      </p>

                      <div className="space-y-2">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 space-y-1.5">
                          <span className="text-[11px] font-bold text-emerald-400 block">🏆 الطريقة الأولى: استخدام أداة فحص دوري مجانية (موصى بها وسهلة جداً)</span>
                          <p className="text-slate-400 text-[9px]">
                            هذه الطريقة تضمن بقاء البوت مستيقظاً للتداول وتسجيل ساعات العمل حياً على مدار الساعة 24/7 دون أي توقف، وهي مجانية بالكامل ومثالية لتطبيقات الهاتف والـ APK:
                          </p>
                          <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[9.5px]">
                            <li>اذهب إلى موقع فحص مجاني شهير مثل <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">cron-job.org</a> أو <a href="https://uptimerobot.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">UptimeRobot</a>.</li>
                            <li>سجل حساباً مجانياً بخطوات بسيطة.</li>
                            <li>أنشئ مهمة فحص دورية جديدة (Create Cron Job / Monitor) وضع الرابط التالي الخاص بتطبيقك في خانة العنوان (URL):</li>
                            <div className="my-1.5 p-2 bg-slate-900 border border-slate-800 rounded font-mono text-[9px] text-emerald-400 select-all text-left overflow-x-auto">
                              {typeof window !== "undefined" ? window.location.origin : "https://ais-pre-vg7ixxaqom2fx2c3u4qinn-279303253836.europe-west2.run.app"}
                            </div>
                            <li>اضبط الفحص ليكون دورياً كل <strong className="text-slate-200">دقيقة واحدة</strong> أو <strong className="text-slate-200">دقيقتين</strong>.</li>
                          </ol>
                          <p className="text-[9px] text-amber-500 font-bold">
                            ✨ بمجرد تفعيل هذا الفحص، سيقوم الموقع بإرسال إشارات وتنبيهات للسيرفر دورياً، مما يبقيه يعمل 24 ساعة ويتداول في الأسواق حتى لو أغلقت هاتفك أو نمت بالكامل!
                          </p>
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 space-y-1">
                          <span className="text-[11px] font-bold text-sky-400 block">⚙️ الطريقة الثانية: من إعدادات جوجل سحابي (لمطوري Cloud Run)</span>
                          <p className="text-slate-400 text-[9.5px]">
                            إذا قمت بنشر البوت مباشرة إلى حساب Google Cloud Console الخاص بك، يمكنك تعديل إعدادات خدمة الـ Cloud Run كالتالي لضمان عدم نوم الحاوية:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-slate-400 text-[9px]">
                            <li>ادخل إلى لوحة تحكم Cloud Run وحدد الخدمة الحالية الخاصة بالبوت.</li>
                            <li>اضغط على زر <strong className="text-slate-200">Edit & Deploy New Revision</strong>.</li>
                            <li>في إعدادات الـ Autoscaling، اضبط <strong className="text-slate-200">Minimum instances</strong> على <strong className="text-slate-200">1</strong> على الأقل (بدلاً من 0).</li>
                            <li>في تبويب الـ Container CPU allocation، اختر الخيار <strong className="text-slate-200">CPU is always allocated</strong>.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                التبويب الثاني: الصفقات المفتوحة والمعلقة (Positions Tab)
                ═══════════════════════════════════════════════════════════════ */}
            {activeTab === "positions" && (
              <div className="space-y-4 animate-fade-in" id="positions_tab">
                
                {/* 💵 التحكم السريع والتحكم الفوري بالهامش المخصص لكل صفقة (Quick Margin Controller) */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3" id="quick_margin_adjuster">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      🪙 هامش دخول الصفقة الحالية: 
                      <span className="text-emerald-400 font-mono font-black text-sm">{(currentSettings?.baseUsdt || 1.0).toFixed(1)} USDT</span>
                    </span>
                    <span className="text-[9px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      الحساب النشط: {activeProfile?.name || "لا يوجد حساب"}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal text-right">
                    يمكنك تغيير وتعديل الهامش المخصص لكل صفقة يدخلها البوت <b>في أي وقت تشاء (ابتداءً من $1)</b>. سيتم تطبيق الهامش المحدث فوراً على كافة الصفقات والإشارات القادمة.
                  </p>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="500"
                      step="1"
                      value={currentSettings?.baseUsdt || 1.0}
                      onChange={(e) => handleSaveSettings({ baseUsdt: parseFloat(e.target.value) || 1.0 })}
                      className="flex-1 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                    <div className="relative w-24">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="0.5"
                        value={currentSettings?.baseUsdt || 1.0}
                        onChange={(e) => handleSaveSettings({ baseUsdt: parseFloat(e.target.value) || 1.0 })}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono font-bold rounded-lg p-1.5 pl-7 text-center focus:border-emerald-500 outline-none text-slate-100"
                      />
                      <span className="absolute left-2 top-1.5 text-[9px] text-slate-500">USDT</span>
                    </div>
                  </div>

                  {/* أزرار مسبقة الضبط للاختيار السريع من 1$ إلى 100$ */}
                  <div className="grid grid-cols-7 gap-1">
                    {[1, 2, 5, 10, 25, 50, 100].map((val) => (
                      <button
                        key={val}
                        onClick={() => handleSaveSettings({ baseUsdt: val })}
                        className={`py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                          (currentSettings?.baseUsdt || 1.0) === val
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-slate-950 text-slate-400 hover:text-slate-300 border border-slate-900"
                        }`}
                      >
                        {val}$
                      </button>
                    ))}
                  </div>
                </div>

                {/* الصفقات النشطة والحية */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-300">المراكز والصفقات المفتوحة حياً:</h3>
                    <span className="text-[10px] font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/10">
                      نشط: {status ? Object.keys(status.positions).filter(key => {
                        const pos = status.positions[key];
                        if (selectedAccountFilter === "all") return true;
                        if (selectedAccountFilter === "demo") return !pos.profileId || pos.profileId === "demo";
                        return pos.profileId === selectedAccountFilter;
                      }).length : 0} صفقة
                    </span>
                  </div>

                  {/* شريط فلترة الحسابات للتنقل السريع بين الحسابات أو عرض الجميع */}
                  {status && status.apiProfiles && status.apiProfiles.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        onClick={() => setSelectedAccountFilter("all")}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all shrink-0 border cursor-pointer ${
                          selectedAccountFilter === "all"
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md shadow-emerald-500/10"
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                        }`}
                      >
                        ⚡ كافة الحسابات ({Object.keys(status.positions).length})
                      </button>
                      {status.apiProfiles.map((prof) => {
                        const count = Object.keys(status.positions).filter(k => {
                          const p = status.positions[k];
                          return p.profileId === prof.id || (prof.isDemo && (!p.profileId || p.profileId === "demo"));
                        }).length;
                        return (
                          <button
                            key={prof.id}
                            onClick={() => setSelectedAccountFilter(prof.id)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all shrink-0 border cursor-pointer ${
                              selectedAccountFilter === prof.id
                                ? "bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md shadow-emerald-500/10"
                                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                            }`}
                          >
                            {prof.isDemo ? "🧪 تجريبي" : `🔑 ${prof.name}`} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {status && Object.keys(status.positions).filter(key => {
                    const pos = status.positions[key];
                    if (selectedAccountFilter === "all") return true;
                    if (selectedAccountFilter === "demo") return !pos.profileId || pos.profileId === "demo";
                    return pos.profileId === selectedAccountFilter;
                  }).length === 0 ? (
                    <div className="bg-slate-900/40 border border-slate-900 rounded-2xl py-12 text-center text-slate-500">
                      <TrendingUp className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="text-xs">لا توجد صفقات مفتوحة حالياً في هذا العرض.</p>
                      <p className="text-[10px] text-slate-600 mt-1">يقوم البوت بالبحث في السوق السحابي بشكل مستمر...</p>
                    </div>
                  ) : (
                    status && Object.keys(status.positions)
                      .filter(key => {
                        const pos = status.positions[key];
                        if (selectedAccountFilter === "all") return true;
                        if (selectedAccountFilter === "demo") return !pos.profileId || pos.profileId === "demo";
                        return pos.profileId === selectedAccountFilter;
                      })
                      .map((key) => {
                        const pos = status.positions[key];
                        const profile = status.apiProfiles.find((p) => p.id === pos.profileId);
                        
                        const side = pos.side || 'buy';
                        const isLong = side === 'buy';
                        const entry = pos.entry;
                        const tp = pos.tp;
                        const sl = pos.sl;
                        const currentVal = pos.currentPrice || entry;

                        // حساب المدى الكلي المانع للقسمة على الصفر
                        let totalRange = Math.abs(tp - sl);
                        if (totalRange === 0) totalRange = 1;

                        let currentProgress = 0;
                        let entryProgress = 0;

                        if (isLong) {
                          currentProgress = ((currentVal - sl) / totalRange) * 100;
                          entryProgress = ((entry - sl) / totalRange) * 100;
                        } else {
                          currentProgress = ((sl - currentVal) / totalRange) * 100;
                          entryProgress = ((sl - entry) / totalRange) * 100;
                        }

                        // الأمان والحدود للمؤشر المئوي (0% إلى 100%)
                        if (currentProgress < 0) currentProgress = 0;
                        if (currentProgress > 100) currentProgress = 100;
                        if (entryProgress < 0) entryProgress = 0;
                        if (entryProgress > 100) entryProgress = 100;

                        // حساب الأرباح الحالية حية ومباشرة بمطابقة 100% لـ ROE بينانس والعقود الآجلة
                        const pnlRaw = isLong ? (currentVal - entry) / entry : (entry - currentVal) / entry;
                        const activeLev = profile?.settings?.leverage || status.settings.leverage || 5;
                        
                        // نسبة الربح ROE % المطابقة لمنصة بينانس
                        const currentPnlPct = pos.unrealizedPnlPct !== undefined 
                          ? pos.unrealizedPnlPct 
                          : (pnlRaw * activeLev * 100);

                        // قيمة الربح بالدولار USDT المطابقة لصفقة المنصة
                        const currentPnlUsdt = pos.unrealizedPnlUsdt !== undefined 
                          ? pos.unrealizedPnlUsdt 
                          : (pos.qty * (currentVal - entry) * (isLong ? 1 : -1));

                        return (
                        <div key={key} className="bg-slate-900 border border-slate-900/60 rounded-2xl p-4 space-y-4 relative overflow-hidden" id={`pos_${key.replace("/", "_")}`}>
                          <div className={`absolute top-0 right-0 w-1.5 h-full ${profile?.isDemo ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                          
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-black font-mono text-slate-100">{pos.symbol}</span>
                                {isLong ? (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">LONG شراء ↗</span>
                                ) : (
                                  <span className="text-[9px] font-bold text-rose-400 bg-rose-400/5 border border-rose-500/10 px-1.5 py-0.5 rounded">SHORT بيع ↘</span>
                                )}
                                <span className="text-[8px] font-bold px-1 rounded text-emerald-400 bg-emerald-400/5 border border-emerald-500/10">
                                  {profile ? profile.name : "Binance API"}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">الاستراتيجية: {pos.strategy}</span>
                              
                              {/* شارات الأمان وإنجاز الأرباح */}
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {pos.partial_tp1_done && (
                                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                                    💰 تم جني 50% أرباح (كاش)
                                  </span>
                                )}
                                {pos.breakeven_done && (
                                  <span className="text-[8px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                                    🛡️ مؤمن بربح +5% صافي
                                  </span>
                                )}
                                {pos.trailing_sl && (
                                  <span className="text-[8px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                                    🚀 قفل الأرباح التصاعدي
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-black font-mono px-2 py-0.5 rounded border ${currentPnlPct >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                {currentPnlPct >= 0 ? '+' : ''}{currentPnlPct.toFixed(2)}% ({currentPnlPct >= 0 ? '+' : ''}${currentPnlUsdt.toFixed(2)})
                              </span>
                              
                              <button
                                onClick={() => handleClosePosition(key, pos.symbol)}
                                disabled={isUpdating}
                                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                              >
                                إغلاق الصفقة ⚡
                              </button>
                            </div>
                          </div>

                          {/* مؤشر المسافة والاتجاه الحي (المسافة للهدف والاستوب) */}
                          <div className="bg-slate-950 p-3 rounded-xl border border-slate-900/80 space-y-2">
                            <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                              <span>وقف الخسارة (SL)</span>
                              <span className="text-amber-400/70">سعر الدخول</span>
                              <span>الهدف الكامل (TP)</span>
                            </div>
                            
                            <div className="relative h-6 flex items-center">
                              {/* مسار النسبة ملون متدرج */}
                              <div className="absolute w-full h-1.5 bg-gradient-to-r from-rose-500/30 via-slate-800 to-emerald-500/30 rounded-full"></div>
                              
                              {/* مؤشر سعر الدخول */}
                              <div 
                                className="absolute h-3 w-1 bg-amber-400 rounded-full z-10"
                                style={{ left: `${entryProgress}%`, transform: 'translateX(-50%)' }}
                              >
                                <span className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 text-[8px] text-amber-300 font-bold font-mono">
                                  {entry.toFixed(3)}
                                </span>
                              </div>
                              
                              {/* مؤشر السعر الحالي المتحرك والنبّاض */}
                              <div 
                                className="absolute flex flex-col items-center z-20 transition-all duration-300"
                                style={{ left: `${currentProgress}%`, transform: 'translateX(-50%)' }}
                              >
                                <div className={`h-3 w-3 rounded-full border border-slate-950 shadow flex items-center justify-center ${currentPnlPct >= 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`}>
                                  <div className="h-1 w-1 bg-slate-950 rounded-full"></div>
                                </div>
                                <span className={`absolute top-3 text-[8px] font-black font-mono px-1 py-0.2 rounded shadow whitespace-nowrap ${currentPnlPct >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/20 text-rose-300 border border-rose-500/20'}`}>
                                  {currentVal.toFixed(3)}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex justify-between text-[8px] text-slate-500 font-mono pt-1">
                              <span className="text-rose-400/80">{sl.toFixed(3)}</span>
                              <span className="text-slate-400">{pos.qty.toFixed(3)} وحدة</span>
                              <span className="text-emerald-400/80">{tp.toFixed(3)}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[10px]">
                            <div className="flex gap-1.5">
                              <span className="bg-slate-800 border border-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded text-[8px] font-bold">🎯 مستهدف الإغلاق الكامل (100% حجم الصفقة)</span>
                              {pos.breakeven_done && (
                                <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded text-[8px] font-bold">✓ تأمين التعادل</span>
                              )}
                            </div>
                            <span className="text-slate-500 font-mono text-[9px]">تحديث: {new Date(pos.time).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* طلبات الحد المعلقة Limit Orders */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-300">طلبات الحد الموقوتة المعلقة (Pending Limit):</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                      معلق: {status ? Object.keys(status.pendingOrders).filter(key => {
                        const pend = status.pendingOrders[key];
                        if (selectedAccountFilter === "all") return true;
                        if (selectedAccountFilter === "demo") return !pend.profileId || pend.profileId === "demo";
                        return pend.profileId === selectedAccountFilter;
                      }).length : 0} طلب
                    </span>
                  </div>

                  {status && Object.keys(status.pendingOrders).filter(key => {
                    const pend = status.pendingOrders[key];
                    if (selectedAccountFilter === "all") return true;
                    if (selectedAccountFilter === "demo") return !pend.profileId || pend.profileId === "demo";
                    return pend.profileId === selectedAccountFilter;
                  }).length === 0 ? (
                    <div className="bg-slate-900/20 border border-slate-900 rounded-2xl py-8 text-center text-slate-600">
                      <p className="text-xs">لا توجد طلبات معلقة بانتظار تفعيل السعر حالياً.</p>
                    </div>
                  ) : (
                    status && Object.keys(status.pendingOrders)
                      .filter(key => {
                        const pend = status.pendingOrders[key];
                        if (selectedAccountFilter === "all") return true;
                        if (selectedAccountFilter === "demo") return !pend.profileId || pend.profileId === "demo";
                        return pend.profileId === selectedAccountFilter;
                      })
                      .map((key) => {
                        const pend = status.pendingOrders[key];
                        const profile = status.apiProfiles.find((p) => p.id === pend.profileId);
                        return (
                          <div key={key} className="bg-slate-900/60 border border-slate-900/80 rounded-2xl p-4 space-y-3" id={`pend_${key.replace("/", "_")}`}>
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-300 font-mono">{pend.symbol}</span>
                                  <span className={`text-[8px] font-bold px-1 rounded ${profile?.isDemo ? 'text-amber-400 bg-amber-400/5' : 'text-emerald-400 bg-emerald-400/5'}`}>
                                    {profile ? profile.name : "تجريبي"}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 leading-relaxed block mt-0.5">الاستراتيجية: {pend.strategy}</span>
                              </div>
                              <span className="text-[9px] font-bold text-sky-400 bg-sky-400/5 border border-sky-500/10 px-1.5 py-0.5 rounded font-mono">
                                انتظار التفعيل: {pend.limit_price.toFixed(4)}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                              <span>حجم الصفقة: {pend.qty.toFixed(3)} وحدة</span>
                              <span>أضيف قبل: {Math.round((Date.now() - new Date(pend.time).getTime()) / 60000)} دقيقة</span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* زر الطوارئ لتصفية الحساب بالكامل */}
                {status && (Object.keys(status.positions).length > 0 || Object.keys(status.pendingOrders).length > 0) && (
                  <button
                    onClick={handleCloseAllPositions}
                    disabled={isUpdating}
                    className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs py-3 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all mt-6 cursor-pointer"
                    id="emergency_close_btn"
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    زر الطوارئ: تصفية وإغلاق كافة المراكز النشطة والمعلقة لجميع الحسابات ⚠️
                  </button>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                التبويب المطور: تحليلات الربح والخسارة بالتوقيت والذكاء الاصطناعي (Analytics Tab)
                ═══════════════════════════════════════════════════════════════ */}
            {activeTab === "analytics" && (() => {
              const history = activeHistory || [];
              const totalTradesCount = history.length;
              const winningTrades = history.filter(t => (t.pnl_usdt || 0) > 0 || (t.pnl_pct_leveraged || 0) > 0);
              const losingTrades = history.filter(t => (t.pnl_usdt || 0) <= 0 && (t.pnl_pct_leveraged || 0) <= 0);
              const overallWinRate = totalTradesCount > 0 ? (winningTrades.length / totalTradesCount) * 100 : 0;
              const totalNetUsdt = history.reduce((acc, t) => acc + (t.pnl_usdt || 0), 0);

              // 1. حساب الإحصائيات حسب الساعات الـ 24 (00:00 - 23:00)
              const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
                const hourTrades = history.filter(t => {
                  if (t.hourOfDay !== undefined) return t.hourOfDay === hour;
                  if (!t.timestamp) return false;
                  return new Date(t.timestamp).getHours() === hour;
                });

                const wins = hourTrades.filter(t => (t.pnl_usdt || 0) > 0 || (t.pnl_pct_leveraged || 0) > 0).length;
                const count = hourTrades.length;
                const winRate = count > 0 ? (wins / count) * 100 : 0;
                const netUsdt = hourTrades.reduce((acc, t) => acc + (t.pnl_usdt || 0), 0);

                let statusText = "لا توجد صفقات";
                let statusColor = "text-slate-500 border-slate-800 bg-slate-900/40";

                if (count >= 1) {
                  if (winRate >= 65) {
                    statusText = "🔥 ذروة أرباح عالية";
                    statusColor = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
                  } else if (winRate < 40) {
                    statusText = "🔴 فترة هبوط خاسرة";
                    statusColor = "text-rose-400 border-rose-500/30 bg-rose-500/10";
                  } else {
                    statusText = "🟡 فترة متوازنة";
                    statusColor = "text-amber-400 border-amber-500/30 bg-amber-500/10";
                  }
                }

                return { hour, count, wins, winRate, netUsdt, statusText, statusColor };
              });

              // أفضل وأسوأ ساعة
              const activeHours = hourlyStats.filter(h => h.count > 0);
              const bestHour = activeHours.length > 0 
                ? [...activeHours].sort((a, b) => b.winRate - a.winRate || b.netUsdt - a.netUsdt)[0] 
                : null;
              const worstHour = activeHours.length > 0 
                ? [...activeHours].sort((a, b) => a.winRate - b.winRate || a.netUsdt - b.netUsdt)[0] 
                : null;

              // 2. تحليل الأداء حسب حالة البيتكوين عند الفتح
              const btcGreenTrades = history.filter(t => t.btcHealthAtOpen === 'GREEN');
              const btcYellowTrades = history.filter(t => t.btcHealthAtOpen === 'YELLOW');
              const btcRedTrades = history.filter(t => t.btcHealthAtOpen === 'RED');

              const getBtcStats = (list: typeof history) => {
                const count = list.length;
                const wins = list.filter(t => (t.pnl_usdt || 0) > 0 || (t.pnl_pct_leveraged || 0) > 0).length;
                const winRate = count > 0 ? (wins / count) * 100 : 0;
                const netUsdt = list.reduce((acc, t) => acc + (t.pnl_usdt || 0), 0);
                return { count, wins, winRate, netUsdt };
              };

              const btcGreenStats = getBtcStats(btcGreenTrades);
              const btcYellowStats = getBtcStats(btcYellowTrades);
              const btcRedStats = getBtcStats(btcRedTrades);

              // 3. تحليل الاستراتيجيات والعملات
              const stratSymbolMap: Record<string, { symbol: string; strategy: string; count: number; wins: number; netUsdt: number }> = {};
              history.forEach(t => {
                const cleanStrat = (t.strategy || "استراتيجية عامة").replace(/\s*\(جني أرباح جزئي\s*\d+%\)/, '').replace(/\s*\(متبقي\s*\d+%\)/, '');
                const key = `${t.symbol}_${cleanStrat}`;
                if (!stratSymbolMap[key]) {
                  stratSymbolMap[key] = { symbol: t.symbol, strategy: cleanStrat, count: 0, wins: 0, netUsdt: 0 };
                }
                stratSymbolMap[key].count += 1;
                if ((t.pnl_usdt || 0) > 0 || (t.pnl_pct_leveraged || 0) > 0) {
                  stratSymbolMap[key].wins += 1;
                }
                stratSymbolMap[key].netUsdt += (t.pnl_usdt || 0);
              });

              const stratMatrix = Object.values(stratSymbolMap).sort((a, b) => (b.wins / b.count) - (a.wins / a.count) || b.netUsdt - a.netUsdt);

              return (
                <div className="space-y-4 animate-fade-in" id="analytics_tab">
                  {/* هيدر قسم التحليلات الذكية */}
                  <div className="bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-slate-900 border border-emerald-500/20 rounded-3xl p-4 relative overflow-hidden">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <h2 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                          مركز تحليلات الأرباح والخسائر بالتوقيت ودرع التصفية
                          <span className="text-[8px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded-full font-mono">24/7 AI</span>
                        </h2>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                          يوضح لك هذا القسم بدقة متى تحقق الصفقات أرباحاً ومتى تخسر بالتوقيت والارتباط مع حركة البيتكوين وحالة السوق، مع تفعيل حراس الحماية التلقائيين.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* كروت المؤشرات الإحصائية المباشرة */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3 text-right space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold block">إجمالي الصفقات المغلقة</span>
                      <div className="flex items-baseline gap-1.5 dir-ltr justify-end">
                        <span className="text-base font-black text-slate-100">{totalTradesCount}</span>
                        <span className="text-[9px] text-emerald-400 font-bold">صفقة</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3 text-right space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold block">نسبة نجاح الصفقات الكلية</span>
                      <div className="flex items-baseline gap-1.5 dir-ltr justify-end">
                        <span className={`text-base font-black ${overallWinRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {overallWinRate.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">({winningTrades.length} رابحة)</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3 text-right space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold block">صافي الأرباح المحققة على المحفظة</span>
                      <div className="flex items-baseline gap-1 dir-ltr justify-end">
                        <span className={`text-base font-black ${totalNetUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {totalNetUsdt >= 0 ? `+$${totalNetUsdt.toFixed(2)}` : `-$${Math.abs(totalNetUsdt).toFixed(2)}`}
                        </span>
                        <span className="text-[9px] text-slate-400">USDT</span>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-3 text-right space-y-1">
                      <span className="text-[9px] text-slate-400 font-bold block">حالة حارس عدم التصفية</span>
                      <div className="flex items-center gap-1.5 justify-end mt-1">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-300">مفعل 100% (Zero Risk)</span>
                      </div>
                    </div>
                  </div>

                  {/* 📢 كارت الملخص والتقرير اليومي الشامل للتليجرام */}
                  <div className="bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-4 space-y-3.5" id="telegram_daily_summary_card">
                    <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                          <Bell className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="text-right">
                          <h3 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                            التقرير والملخص اليومي لقناة التليجرام 📢
                            <span className="text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">تحديث آلي</span>
                          </h3>
                          <p className="text-[9px] text-slate-400">ملخص الأداء اليومي لكل عملة، الاستراتيجيات المستخدمة، أكثر عملة رابحة، وأكثر استراتيجية بنسبة نجاح.</p>
                        </div>
                      </div>
                      <button
                        onClick={handleSendDailyTelegramReport}
                        disabled={isUpdating}
                        className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-xl text-[10px] font-black shadow-md shadow-indigo-500/20 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>إرسال للتليجرام الآن 📲</span>
                      </button>
                    </div>

                    {/* أبرز النتائج الرئيسية (Top Winner Symbol & Strategy) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-right">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 space-y-1">
                        <span className="text-[9px] font-bold text-emerald-400 block">🏆 أكثر عملة رابحة (Top Winning Coin)</span>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-100 font-mono">
                            {dailyAnalyticsData?.topWinningSymbol ? dailyAnalyticsData.topWinningSymbol.symbol : "في انتظار الصفقات"}
                          </span>
                          {dailyAnalyticsData?.topWinningSymbol && (
                            <span className="text-xs font-mono font-bold text-emerald-400 dir-ltr">
                              +{dailyAnalyticsData.topWinningSymbol.totalPnlUsdt.toFixed(2)} USDT (نجاح {dailyAnalyticsData.topWinningSymbol.winRatePct.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-3 space-y-1">
                        <span className="text-[9px] font-bold text-sky-400 block">🎯 أكثر استراتيجية بنسبة نجاح (Top Win-Rate Strategy)</span>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-100 font-mono">
                            {dailyAnalyticsData?.topStrategy ? dailyAnalyticsData.topStrategy.strategy : "في انتظار الصفقات"}
                          </span>
                          {dailyAnalyticsData?.topStrategy && (
                            <span className="text-xs font-mono font-bold text-sky-400 dir-ltr">
                              نسبة نجاح {dailyAnalyticsData.topStrategy.winRatePct.toFixed(1)}% ({dailyAnalyticsData.topStrategy.wins}/{dailyAnalyticsData.topStrategy.totalTrades})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* جدول تفاصيل العملات والاستراتيجيات المستخدمة لكل عملة وحالتها */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-300 block text-right">🪙 ملخص أداء العملات والاستراتيجيات المستخدمة لكل عملة:</span>
                      {(!dailyAnalyticsData?.symbolBreakdown || dailyAnalyticsData.symbolBreakdown.length === 0) ? (
                        <p className="text-[10px] text-slate-500 text-center py-3">سيتم عرض قائمة أداء جميع العملات والاستراتيجيات فور تنفيذ صفقات.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {dailyAnalyticsData.symbolBreakdown.map((item: any, idx: number) => (
                            <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-right gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-black text-slate-100 font-mono">{item.symbol}</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                                    {item.status}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 block mt-0.5">
                                  الاستراتيجيات: <code className="text-sky-300">{item.strategies.join(', ') || 'عامة'}</code>
                                </span>
                              </div>

                              <div className="text-left font-mono dir-ltr shrink-0">
                                <span className={`text-xs font-bold block ${item.totalPnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {item.totalPnlUsdt >= 0 ? `+$${item.totalPnlUsdt.toFixed(2)}` : `-$${Math.abs(item.totalPnlUsdt).toFixed(2)}`} USDT
                                </span>
                                <span className="text-[8px] text-slate-400 block">
                                  {item.wins}/{item.totalTrades} نجاح ({item.winRatePct.toFixed(0)}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* أفضل وأسوأ فترة زمنية للتداول */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-right flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-emerald-400 block">🔥 أفضل ساعة تحقق فيها أرباحاً</span>
                        <span className="text-xs font-black text-slate-100 mt-0.5 block">
                          {bestHour ? `الساعة ${bestHour.hour}:00 - ${(bestHour.hour + 1) % 24}:00` : "في انتظار صفقات كافية"}
                        </span>
                      </div>
                      {bestHour && (
                        <div className="text-left font-mono dir-ltr">
                          <span className="text-xs font-black text-emerald-400 block">نسبة النجاح {bestHour.winRate.toFixed(0)}%</span>
                          <span className="text-[9px] text-slate-300 block">+${bestHour.netUsdt.toFixed(2)} USDT</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 text-right flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-rose-400 block">🛑 أكثر ساعة تحدث فيها خسائر (سيتم تجنبها)</span>
                        <span className="text-xs font-black text-slate-100 mt-0.5 block">
                          {worstHour && worstHour.winRate < 50 ? `الساعة ${worstHour.hour}:00 - ${(worstHour.hour + 1) % 24}:00` : "لا توجد ساعات خسائر حرجة"}
                        </span>
                      </div>
                      {worstHour && worstHour.winRate < 50 && (
                        <div className="text-left font-mono dir-ltr">
                          <span className="text-xs font-black text-rose-400 block">نجاح {worstHour.winRate.toFixed(0)}%</span>
                          <span className="text-[9px] text-slate-300 block">${worstHour.netUsdt.toFixed(2)} USDT</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 🕒 شبكة التحليل الزمني لـ 24 ساعة (24-Hour Timing Breakdown Grid) */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-slate-100">سجل أداء الصفقات بالتوقيت المحلي (24 ساعة)</h3>
                      </div>
                      <span className="text-[9px] text-slate-400">تحديث ذكي تلقائي</span>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-relaxed text-right">
                      يبين هذا المخطط بالتفصيل أوقات الربح المتتالي وأوقات الخسارة. يمكنك مراقبة الساعات التي تتسم بسيولة عالية ومعدل ربح مرتفع.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                      {hourlyStats.map((h) => (
                        <div key={h.hour} className={`p-2.5 rounded-xl border space-y-1.5 text-right ${h.statusColor}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-slate-200">
                              {`${h.hour.toString().padStart(2, '0')}:00 - ${((h.hour + 1) % 24).toString().padStart(2, '0')}:00`}
                            </span>
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md border bg-slate-950/40">
                              {h.count} صفقات
                            </span>
                          </div>

                          {h.count > 0 ? (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[9px]">
                                <span className="text-slate-400">نسبة الفوز:</span>
                                <span className={`font-mono font-bold ${h.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {h.winRate.toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden flex">
                                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${h.winRate}%` }}></div>
                                <div className="bg-rose-500 h-full transition-all" style={{ width: `${100 - h.winRate}%` }}></div>
                              </div>
                              <div className="flex justify-between items-center text-[8px] font-mono dir-ltr">
                                <span className="text-slate-400">صافي المحفظة:</span>
                                <span className={h.netUsdt >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                  {h.netUsdt >= 0 ? `+$${h.netUsdt.toFixed(2)}` : `-$${Math.abs(h.netUsdt).toFixed(2)}`}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[9px] text-slate-500 font-sans pt-1">لا توجد صفقات في هذه الساعة</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ₿ تحليل الأداء حسب صحة وحركة البيتكوين (BTC Correlation Analysis) */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-sky-400" />
                        <h3 className="text-xs font-bold text-slate-100">ارتباط صفقات العملات مع صحة البيتكوين (BTC Health)</h3>
                      </div>
                      <span className="text-[9px] text-sky-400 font-bold">فحص السيولة</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-right space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-400">🟢 BTC GREEN (صعود/مستقر)</span>
                          <span className="text-[9px] font-mono text-slate-300">{btcGreenStats.count} صفقات</span>
                        </div>
                        <div className="text-xs font-black text-slate-100 dir-ltr text-right">
                          نجاح: {btcGreenStats.winRate.toFixed(0)}% | +${btcGreenStats.netUsdt.toFixed(2)} USDT
                        </div>
                        <p className="text-[8px] text-slate-400 leading-tight">
                          أفضل ظروف للتداول، حيث توفر سيولة البيتكوين صعوداً آمناً للعملات البديلة.
                        </p>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-right space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-400">🟡 BTC YELLOW (تذبذب/حذر)</span>
                          <span className="text-[9px] font-mono text-slate-300">{btcYellowStats.count} صفقات</span>
                        </div>
                        <div className="text-xs font-black text-slate-100 dir-ltr text-right">
                          نجاح: {btcYellowStats.winRate.toFixed(0)}% | ${btcYellowStats.netUsdt.toFixed(2)} USDT
                        </div>
                        <p className="text-[8px] text-slate-400 leading-tight">
                          حالة حذرة، تعتمد الصفقة فيها على القوة المستقلة للاستراتيجية والـ Volume.
                        </p>
                      </div>

                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 text-right space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-rose-400">🔴 BTC RED (هبوط ضاغط)</span>
                          <span className="text-[9px] font-mono text-slate-300">{btcRedStats.count} صفقات</span>
                        </div>
                        <div className="text-xs font-black text-slate-100 dir-ltr text-right">
                          نجاح: {btcRedStats.winRate.toFixed(0)}% | ${btcRedStats.netUsdt.toFixed(2)} USDT
                        </div>
                        <p className="text-[8px] text-slate-400 leading-tight">
                          عند هبوط البيتكوين الحاد، تفعل استراتيجيات القاع (Bottom Sweep) للتجميع الآمن بدون تصفية.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 📊 الاستراتيجيات والعملات الأكثر نجاحاً (Strategies & Coins Matrix) */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-slate-100">جدول أكثر الاستراتيجيات والعملات نجاحاً وأرباحاً</h3>
                      </div>
                    </div>

                    {stratMatrix.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-4">سيتم بناء الجدول تلقائياً فور تنفيذ صفقات كافية.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {stratMatrix.map((item, idx) => {
                          const winRate = item.count > 0 ? (item.wins / item.count) * 100 : 0;
                          return (
                            <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-2 text-right">
                              <div>
                                <span className="text-xs font-black text-slate-100 block">{item.symbol}</span>
                                <span className="text-[9px] text-slate-400 block">{item.strategy}</span>
                              </div>

                              <div className="text-left font-mono dir-ltr">
                                <span className={`text-xs font-bold block ${winRate >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  نجاح {winRate.toFixed(0)}% ({item.wins}/{item.count})
                                </span>
                                <span className={`text-[9px] block ${item.netUsdt >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`}>
                                  {item.netUsdt >= 0 ? `+$${item.netUsdt.toFixed(2)}` : `-$${Math.abs(item.netUsdt).toFixed(2)}`} USDT
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 🤖 محرك الذكاء الاصطناعي لمتابعة وتصحيح الأخطاء تلقائياً */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3" id="ai_self_correction_section">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                        <h3 className="text-xs font-bold text-slate-100">محرك الذكاء الاصطناعي لمتابعة وتصحيح الأخطاء تلقائياً</h3>
                      </div>
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">تعلم وتصحيح ذكي 24/7</span>
                    </div>

                    {(!status?.aiSelfCorrectionRules || status.aiSelfCorrectionRules.length === 0) ? (
                      <p className="text-[10px] text-slate-500 text-center py-3">محرك الذكاء الاصطناعي مراقب لصفقاتك بالكامل ويطبق التحسينات ذاتياً.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {status.aiSelfCorrectionRules.map((rule, idx) => (
                          <div key={idx} className="p-2.5 bg-slate-950 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-2 text-right">
                            <p className="text-xs font-bold text-emerald-300 font-sans">{rule}</p>
                            <span className="text-[8px] text-emerald-400/60 font-mono shrink-0">مستمر 🟢</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 🚫 قائمة العملات المحظورة أوتوماتيكياً بسبب الخسارة */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3" id="banned_symbols_section">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <h3 className="text-xs font-bold text-slate-100">العملات المحظورة تلقائياً من التداول (بسبب الخسارة)</h3>
                      </div>
                      <span className="text-[9px] text-rose-400 font-bold font-mono bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                        المحظورة: {status?.bannedSymbols?.length || 0} عملة
                      </span>
                    </div>

                    {(!status?.bannedSymbols || status.bannedSymbols.length === 0) ? (
                      <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-850 text-center">
                        <p className="text-[10px] text-slate-400">لا توجد أي عملة محظورة حالياً. أي عملة تتكبد خسارة يتم حظر التداول عليها فوراً تلقائياً.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {status.bannedSymbols.map((sym, idx) => (
                          <div key={idx} className="p-2 bg-slate-950 border border-rose-500/20 rounded-xl flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-rose-300 font-mono">{sym}</span>
                            <button
                              onClick={() => handleUnbanSymbol(sym)}
                              disabled={isUpdating}
                              className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer"
                              title="فك الحظر والسماح بالتداول مجدداً"
                            >
                              فك الحظر 🔓
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 🧠 سجل التحليل الذكي وأسباب أرباح وخسائر الصفقات (AI Diagnostic Feed) */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
                        <h3 className="text-xs font-bold text-slate-100">سجل الذكاء الاصطناعي لمعرفة أسباب أرباح وخسائر كل صفقة</h3>
                      </div>
                      <span className="text-[9px] text-emerald-400">تفسير دقيق 24/7</span>
                    </div>

                    {history.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-6">لا توجد صفقات مغلقة في السجل حالياً ليتم تحليل أسبابها.</p>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {history.slice(0, 20).map((trade, i) => {
                          const isWin = (trade.pnl_usdt || 0) > 0 || (trade.pnl_pct_leveraged || 0) > 0;
                          return (
                            <div key={i} className={`p-3 rounded-2xl border space-y-2 text-right ${isWin ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-black ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {trade.symbol} ({trade.side.toUpperCase()})
                                  </span>
                                  <span className="text-[9px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                                    {trade.strategy}
                                  </span>
                                </div>
                                <span className={`text-xs font-mono font-black dir-ltr ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isWin ? `+$${(trade.pnl_usdt || 0).toFixed(2)} (+${(trade.pnl_pct_leveraged || 0).toFixed(1)}%)` : `-$${Math.abs(trade.pnl_usdt || 0).toFixed(2)} (${(trade.pnl_pct_leveraged || 0).toFixed(1)}%)`}
                                </span>
                              </div>

                              {/* تفسير الذكاء الاصطناعي وتوصية الدخول */}
                              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5 text-[10px] leading-relaxed">
                                <p className="text-slate-300 font-sans">
                                  {trade.diagnosticReason || trade.strategySummary || `تم خروج الصفقة بسبب ${trade.reason}.`}
                                </p>
                                {trade.aiRecommendation && (
                                  <p className="text-emerald-300/90 font-sans font-bold border-t border-slate-800/60 pt-1">
                                    {trade.aiRecommendation}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between text-[8px] text-slate-500 font-mono">
                                <span>سبب الخروج: {trade.reason}</span>
                                <span>{trade.timestamp ? new Date(trade.timestamp).toLocaleString("ar-EG") : ''}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ⚙️ التحكم بحراس الأمان لحظر التصفية وحارس الساعات */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-slate-100">إعدادات حارس الساعات ودرع التصفية المطلق</h3>
                    </div>

                    <div className="space-y-3 text-right">
                      {/* حارس الساعات */}
                      <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">تفعيل 'حارس الساعات الخاسرة التلقائي'</span>
                          <button
                            type="button"
                            onClick={() => handleSaveSettings({ autoTimeGuardEnabled: !currentSettings?.autoTimeGuardEnabled })}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative ${
                              currentSettings?.autoTimeGuardEnabled !== false ? "bg-emerald-500" : "bg-slate-800"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${currentSettings?.autoTimeGuardEnabled !== false ? "translate-x-5" : "translate-x-0"}`} />
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-relaxed">
                          عند التفعيل، يحسب البوت نسبة الفوز التاريخية للساعة الحالية. إذا كانت نسبة الفوز أقل من الحد الأدنى (مثلاً 40%)، يعلق البوت الدخول في صفقات جديدة حتى الانتقال لساعة ذات زخم مربح.
                        </p>
                      </div>

                      {/* درع التصفية */}
                      <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">تفعيل 'درع عدم التصفية المطلق' (Zero Liquidation)</span>
                          <button
                            type="button"
                            onClick={() => handleSaveSettings({ hardLiquidationShieldEnabled: !currentSettings?.hardLiquidationShieldEnabled })}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative ${
                              currentSettings?.hardLiquidationShieldEnabled !== false ? "bg-emerald-500" : "bg-slate-800"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${currentSettings?.hardLiquidationShieldEnabled !== false ? "translate-x-5" : "translate-x-0"}`} />
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-relaxed">
                          يغلق هذا الدرع أي صفقة يدوياً أو آلياً فور وصول التراجع إلى -20% ROE لحظر التصفية 100% وحماية رأس مال المحفظة بالكامل دون أي استثناء.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ═══════════════════════════════════════════════════════════════
                التبويب الثالث: الإعدادات والتحكم بالاستراتيجيات (Settings Tab)
                ═══════════════════════════════════════════════════════════════ */}
            {activeTab === "settings" && (
              <div className="space-y-4 animate-fade-in" id="settings_tab">
                <h3 className="text-sm font-bold text-slate-200">إعدادات تحكم البوت والرافعة المالية</h3>

                <div className="bg-slate-900 border border-slate-900 rounded-2xl p-4 space-y-4">
                  {/* تعديل وتحديد الرافعة المالية مرن ودقيق */}
                  <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">الرافعة المالية (Leverage):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          max="125"
                          step="1"
                          value={currentSettings?.leverage || 20}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(125, parseInt(e.target.value) || 1));
                            handleSaveSettings({ leverage: val });
                          }}
                          className="w-16 bg-slate-900 border border-emerald-500/40 text-center font-bold text-emerald-400 font-mono text-xs rounded-lg py-1 px-1 outline-none focus:border-emerald-400"
                        />
                        <span className="font-bold text-emerald-400 font-mono text-xs">x</span>
                      </div>
                    </div>

                    {/* أزرار سريعة لاختيار الرافعة المالية */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[5, 10, 15, 20, 25, 50, 75, 100, 125].map((lev) => (
                        <button
                          key={lev}
                          type="button"
                          onClick={() => handleSaveSettings({ leverage: lev })}
                          className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border transition-all ${
                            (currentSettings?.leverage || 20) === lev
                              ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                              : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                          }`}
                        >
                          {lev}x
                        </button>
                      ))}
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="125"
                      value={currentSettings?.leverage || 20}
                      onChange={(e) => handleSaveSettings({ leverage: parseInt(e.target.value) || 1 })}
                      className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-emerald-400 mt-1"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>1x (آمن)</span>
                      <span>20x (متوازن)</span>
                      <span>50x (مخاطرة)</span>
                      <span>125x (أقصى)</span>
                    </div>
                  </div>

                  {/* حجم الصفقة الواحدة */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 block">الهامش المخصص لكل صفقة (USDT):</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={currentSettings?.baseUsdt || 10.0}
                        onChange={(e) => handleSaveSettings({ baseUsdt: parseFloat(e.target.value) || 10.0 })}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono font-bold rounded-lg p-2.5 pl-10 focus:border-emerald-500 outline-none"
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-slate-500">USDT</span>
                    </div>
                    <p className="text-[9px] text-slate-500 font-mono">حجم التداول الفعلي مع الرافعة المالية = {((currentSettings?.baseUsdt || 10) * (currentSettings?.leverage || 20)).toFixed(1)} USDT</p>
                  </div>

                  {/* أقصى صفقات مفتوحة */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 block">الحد الأقصى للصفقات المتزامنة:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={currentSettings?.maxOpenPositions || 5}
                      onChange={(e) => handleSaveSettings({ maxOpenPositions: parseInt(e.target.value) || 5 })}
                      className="w-full bg-slate-950 border border-slate-800 text-xs font-mono font-bold rounded-lg p-2.5 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  {/* مدة صلاحية الأوامر المعلقة */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-300 block">مدة صلاحية الأمر المعلق قبل الإلغاء تلقائياً:</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={currentSettings?.reversalOrderTimeoutMin || 30}
                        onChange={(e) => handleSaveSettings({ reversalOrderTimeoutMin: parseInt(e.target.value) || 30 })}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono font-bold rounded-lg p-2.5 pl-12 focus:border-emerald-500 outline-none"
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-slate-500">دقيقة</span>
                    </div>
                    <span className="text-[9px] text-slate-500">ملاحظة: يقوم البوت بإلغاء أمر الحد المعلق (Limit) من بينانس إن لم يتفعل خلال هذه المدة.</span>
                  </div>

                  {/* أهداف الربح والخسارة اليومية الكلية */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block">وقف الخسارة اليومي %:</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={currentSettings?.maxDailyLossPct || 15}
                        onChange={(e) => handleSaveSettings({ maxDailyLossPct: parseFloat(e.target.value) || 15 })}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block">هدف الربح اليومي %:</label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={currentSettings?.maxDailyProfitPct || 100}
                        onChange={(e) => handleSaveSettings({ maxDailyProfitPct: parseFloat(e.target.value) || 100 })}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* 🛡️ نظام جني الأرباح ووقف الخسارة الأوتوماتيكي المحسّن (Stepped Profit Lock Engine) */}
                  <div className="border-t border-slate-800/50 pt-4 space-y-3" id="sl_tp_settings">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span>نظام جني الأرباح ووقف الخسارة الذكي والمحسّن تلقائياً 🛡️</span>
                    </div>

                    <div className="p-3 bg-slate-950 border border-emerald-500/20 rounded-2xl space-y-2 text-right">
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        تم إلغاء التحديد اليدوي لوقف الخسارة لتفادي الأخطاء. يحسب البوت الآن أهدافه تلقائياً بدقة رياضية:
                      </p>

                      <div className="space-y-1.5 pt-1">
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/80 text-[9px] text-slate-300 flex items-center justify-between">
                          <span className="font-bold text-emerald-400">معدل المخاطرة للمكافأة (Risk-To-Reward):</span>
                          <span className="font-mono font-black text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">≥ 1 : 1.5 إيجابي</span>
                        </div>

                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/80 text-[9px] text-slate-300 flex items-center justify-between">
                          <span className="font-bold text-indigo-400">حماية الأرباح عند +30%:</span>
                          <span className="font-mono text-indigo-300">قفل +50% من الأرباح المحققة (+15% صافي على الأقل) 🛡️</span>
                        </div>

                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/80 text-[9px] text-slate-300 flex items-center justify-between">
                          <span className="font-bold text-emerald-400">حماية الأرباح عند +50%:</span>
                          <span className="font-mono text-emerald-300">قفل +25% ربح صافي على الأقل 🚀</span>
                        </div>

                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/80 text-[9px] text-slate-300 flex items-center justify-between">
                          <span className="font-bold text-sky-400">جني الأرباح الجزئي (Cash-out):</span>
                          <span className="font-mono text-sky-300">50% كاش فور الوصول للهدف 💰</span>
                        </div>
                      </div>

                      <p className="text-[8px] text-slate-500 leading-relaxed mt-1">
                        يتم حساب وقف الخسارة بناءً على تقلب العملة المباشر (1.25x ATR) مع قفل أرباح متصاعد يمنع الصفقات الرابحة من الارتداد نهائياً.
                      </p>
                    </div>
                  </div>

                  {/* ميزة التداول شراء فقط ومستقر */}
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      <span>نظام الشراء الفوري الصارم (Long Only)</span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      تم إلغاء صفقات البيع (Short) وعكس الإشارات بالكامل لتقليل مخاطر التقلبات. يعمل البوت الآن على صفقات الشراء الصاعدة فقط لضمان دقة التحليل واستقرار المحفظة.
                    </p>
                  </div>

                  {/* إلغاء نظام النقاط */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                      <CheckSquare className="w-4 h-4" />
                      <span>تم إلغاء نظام النقاط بالكامل 🎯</span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      يعتمد البوت الآن على التحقق الرياضي الصارم من شروط الاستراتيجيات الخمس المحددة. بمجرد تحقق كامل شروط الاستراتيجية بنسبة 100%، يتم دخول صفقة الشراء تلقائياً دون تصفية أو تداول عشوائي بالنقاط.
                    </p>
                  </div>

                  {/* نظام تعزيز الفوز ودقة الإشارات */}
                  <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                        <Cpu className="w-4 h-4 animate-pulse" />
                        <span>محسن نسبة النجاح الفائق (Win-Rate Enhancer)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveSettings({ winRateEnhancer: !currentSettings?.winRateEnhancer })}
                        className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative ${
                          currentSettings?.winRateEnhancer ? "bg-indigo-500" : "bg-slate-800"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                            currentSettings?.winRateEnhancer ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      عند التفعيل، يطبق البوت فلاتر صارمة إضافية: (1) عدم دخول صفقات عكس اتجاه البيتكوين العام، (2) إلغاء الصفقات إذا كان الـ RSI في منطقة التشبع القصوى، (3) شرط حجم تداول عالي (Volume Ratio &gt; 1.2) لضمان السيولة والزخم القوي، مما يرفع نسبة النجاح بنسبة كبيرة جداً.
                    </p>
                  </div>

                  {/* 🔔 نظام الإشعارات الفوري للهاتف والتلغرام */}
                  <div className="border-t border-slate-800/50 pt-4 space-y-3 animate-fade-in" id="notifications_settings">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Bell className="w-4 h-4" />
                      <span>نظام الإشعارات الفوري للهاتف (Telegram & Browser)</span>
                    </div>
                    
                    <p className="text-[9px] text-slate-400 leading-relaxed">
                      احصل على تحديثات حية وفورية مباشرة على هاتفك بمجرد فتح صفقة جديدة أو إغلاقها مع تفاصيل الأرباح والخسائر والاتجاه والعملة.
                    </p>

                    <div className="space-y-2.5">
                      {/* إشعارات المتصفح (PWA للهاتف) */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-900">
                        <div className="space-y-0.5 text-right">
                          <span className="text-xs font-bold text-slate-200 block">إشعارات المتصفح الفورية</span>
                          <span className="text-[8px] text-slate-500 block">تلقي إشعارات على هاتفك عند تشغيل التطبيق في الخلفية</span>
                        </div>
                        <button
                          type="button"
                          onClick={toggleBrowserNotifications}
                          className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative ${
                            currentSettings?.browserNotificationsEnabled ? "bg-emerald-500" : "bg-slate-800"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                              currentSettings?.browserNotificationsEnabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* نغمات صفقات الدخول والخروج للهاتف */}
                      <div className="flex flex-col gap-2.5 p-3 bg-slate-950 rounded-xl border border-slate-900 text-right">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-200 block">نغمات الصفقات المباشرة 🔊</span>
                            <span className="text-[8px] text-slate-500 block">تشغيل نغمات تنبيهية مميزة للهاتف بمجرد دخول البوت في صفقة أو خروجه منها</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = !soundsEnabled;
                              setSoundsEnabled(nextVal);
                              safeStorage.setItem("BOT_SOUNDS_ENABLED", nextVal ? "true" : "false");
                              if (nextVal) {
                                setTimeout(() => playTradeSound(false), 100); // نغمة تجريبية عند التفعيل
                              }
                            }}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative ${
                              soundsEnabled ? "bg-emerald-500" : "bg-slate-800"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                                soundsEnabled ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                        {soundsEnabled && (
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => playTradeSound(false)}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/15 rounded-md text-[9px] font-black flex items-center gap-1 cursor-pointer transition-all"
                            >
                              🔔 تجربة نغمة الدخول
                            </button>
                            <button
                              type="button"
                              onClick={() => playTradeSound(true)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/15 rounded-md text-[9px] font-black flex items-center gap-1 cursor-pointer transition-all"
                            >
                              💰 تجربة نغمة الخروج
                            </button>
                          </div>
                        )}
                      </div>

                      {/* إشعارات التلغرام لجميع الهواتف والقنوات */}
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowTelegramSection(!showTelegramSection)}>
                          <div className="space-y-0.5 text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-200 block">إرسال إشعارات وتنبيهات عبر Telegram Bot 💬</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${currentSettings?.telegramEnabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"}`}>
                                {currentSettings?.telegramEnabled ? "مفعل 🟢" : "غير مفعل 🔴"}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-400 block">ربط البوت بقناتك أو شات التلغرام لاستلام تنبيهات الصفقات والملخصات حياً 24/7</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveTelegramSettings(!currentSettings?.telegramEnabled);
                              }}
                              className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative ${
                                currentSettings?.telegramEnabled ? "bg-emerald-500" : "bg-slate-800"
                              }`}
                              title="تفعيل/إلغاء تفعيل إشعارات التلغرام"
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                                  currentSettings?.telegramEnabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTelegramSection(!showTelegramSection);
                              }}
                              className="p-1 text-slate-400 hover:text-white"
                            >
                              {showTelegramSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {showTelegramSection && (
                          <div className="space-y-3 border-t border-slate-900 pt-3 animate-fade-in text-right">
                            
                            {/* دليل سريع للربط */}
                            <div className="p-2.5 bg-slate-900/80 border border-slate-800/80 rounded-lg space-y-1 text-[10px] text-slate-300">
                              <span className="font-bold text-emerald-400 block">💡 كيف تربط تطبيقك بالتليجرام في 3 خطوات بسيطة:</span>
                              <ol className="list-decimal list-inside space-y-0.5 text-[9px] text-slate-400">
                                <li>ابحث في تلغرام عن <code className="text-amber-300">@BotFather</code> وأرسل <code className="text-amber-300">/newbot</code> لإنشاء بوتك الخاص والحصول على <b>Bot Token</b>.</li>
                                <li>ابحث عن <code className="text-amber-300">@userinfobot</code> في تلغرام وأرسل له أي رسالة ليصلك <b>Chat ID</b> الخاص بك.</li>
                                <li>لإرسال التنبيهات لقناة أو مجموعة: أضف البوت كـ Admin في القناة واستخدم معرف القناة (مثل <code className="text-amber-300">-100123456789</code>).</li>
                              </ol>
                            </div>

                            {/* الحقول الأساسية */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300 block">1. توكن البوت الأساسي (Bot Token):</label>
                                <input
                                  type="text"
                                  placeholder="مثال: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                                  value={tgToken}
                                  onChange={(e) => setTgToken(e.target.value)}
                                  onBlur={() => handleSaveSettings({ telegramToken: tgToken.trim() })}
                                  className="w-full bg-slate-900 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-left text-slate-200"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-300 block">2. معرف الشات الأساسي (Chat ID):</label>
                                <input
                                  type="text"
                                  placeholder="مثال: 987654321"
                                  value={tgChatId}
                                  onChange={(e) => setTgChatId(e.target.value)}
                                  onBlur={() => handleSaveSettings({ telegramChatId: tgChatId.trim() })}
                                  className="w-full bg-slate-900 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-left text-slate-200"
                                />
                              </div>
                            </div>

                            {/* ملخص الأداء بالساعة (قناة الملخص) */}
                            <div className="space-y-2 border-t border-slate-900/80 pt-2 mt-2">
                              <span className="text-[10px] font-bold text-amber-400 block">📢 إعدادات قناة ملخص الأداء اليومي والساعي (اختياري):</span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-slate-400 block">توكن قناة الملخص (إذا كانت بوت آخر):</label>
                                  <input
                                    type="text"
                                    placeholder="اتركه فارغاً لاستخدام توكن البوت الأساسي"
                                    value={tgSummaryToken}
                                    onChange={(e) => setTgSummaryToken(e.target.value)}
                                    onBlur={() => handleSaveSettings({ telegramSummaryToken: tgSummaryToken.trim() })}
                                    className="w-full bg-slate-900 border border-slate-800 text-[11px] font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-left text-slate-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-slate-400 block">معرف القناة/المجموعة (Summary Chat ID):</label>
                                  <input
                                    type="text"
                                    placeholder="مثال: -100123456789"
                                    value={tgSummaryChatId}
                                    onChange={(e) => setTgSummaryChatId(e.target.value)}
                                    onBlur={() => handleSaveSettings({ telegramSummaryChatId: tgSummaryChatId.trim() })}
                                    className="w-full bg-slate-900 border border-slate-800 text-[11px] font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-left text-slate-200"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* الإشارات الفورية (قناة الإشارات) */}
                            <div className="space-y-2 border-t border-slate-900/80 pt-2 mt-2">
                              <span className="text-[10px] font-bold text-cyan-400 block">📡 إعدادات قناة إشارات الصفقات الفورية (اختياري):</span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-slate-400 block">توكن قناة الإشارات (إذا كانت بوت آخر):</label>
                                  <input
                                    type="text"
                                    placeholder="اتركه فارغاً لاستخدام توكن البوت الأساسي"
                                    value={tgSignalsToken}
                                    onChange={(e) => setTgSignalsToken(e.target.value)}
                                    onBlur={() => handleSaveSettings({ telegramSignalsToken: tgSignalsToken.trim() })}
                                    className="w-full bg-slate-900 border border-slate-800 text-[11px] font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-left text-slate-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-slate-400 block">معرف قناة الإشارات (Signals Chat ID):</label>
                                  <input
                                    type="text"
                                    placeholder="مثال: -100987654321"
                                    value={tgSignalsChatId}
                                    onChange={(e) => setTgSignalsChatId(e.target.value)}
                                    onBlur={() => handleSaveSettings({ telegramSignalsChatId: tgSignalsChatId.trim() })}
                                    className="w-full bg-slate-900 border border-slate-800 text-[11px] font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-left text-slate-200"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* أزرار الإجراءات الفورية */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-900">
                              <button
                                type="button"
                                onClick={() => handleSaveTelegramSettings(true)}
                                className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                حفظ وتفعيل ربط التلغرام 💾
                              </button>

                              <button
                                type="button"
                                onClick={handleSendTestTelegram}
                                disabled={isTestingTelegram}
                                className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                              >
                                {isTestingTelegram ? "جاري الإرسال..." : "🚀 تجربة إرسال إشعار فوري"}
                              </button>
                            </div>

                            {telegramTestResult && (
                              <div className={`p-2.5 rounded-lg text-xs font-bold ${telegramTestResult.success ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                                {telegramTestResult.message}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* التحكم بالاستراتيجيات المفعلة */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-300">الاستراتيجيات النشطة للفحص والتحليل:</h3>
                  
                  <div className="bg-slate-900 border border-slate-900 rounded-2xl p-3 grid grid-cols-2 gap-2">
                    {Object.keys(currentSettings?.activeStrategies || {}).map((strat) => (
                      <button
                        key={strat}
                        onClick={() => {
                          const current = { ...currentSettings?.activeStrategies };
                          current[strat] = !current[strat];
                          handleSaveSettings({ activeStrategies: current });
                        }}
                        className={`p-2 rounded-xl border text-[10px] text-right font-bold transition-all duration-300 flex items-center justify-between ${
                          currentSettings?.activeStrategies[strat]
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-950 text-slate-500 border-slate-900"
                        }`}
                      >
                        <span>{strat}</span>
                        {currentSettings?.activeStrategies[strat] ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <span className="w-1.5 h-1.5 bg-slate-800 rounded-full"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* العملات المفعلة للفحص */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-300">العملات المستهدفة للمراقبة والفحص (١٠٠ عملة):</h3>
                    <span className="text-[9px] text-slate-400">محدد: {currentSettings?.selectedSymbols.length}</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-900 rounded-2xl p-3 space-y-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="ابحث عن رمز العملة..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg p-2 pr-9 outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto grid grid-cols-3 gap-2 pr-1" id="coins_scroller">
                      {filteredCoins.map((coin) => {
                        const isSelected = currentSettings?.selectedSymbols.includes(coin);
                        return (
                          <button
                            key={coin}
                            onClick={() => {
                              let updated = [...currentSettings!.selectedSymbols];
                              if (isSelected) {
                                updated = updated.filter((s) => s !== coin);
                              } else {
                                updated.push(coin);
                              }
                              handleSaveSettings({ selectedSymbols: updated });
                            }}
                            className={`p-1.5 rounded-lg border text-[10px] text-center font-mono font-bold transition-all duration-200 ${
                              isSelected
                                ? "bg-slate-50 text-slate-950 border-slate-50"
                                : "bg-slate-950 text-slate-400 border-slate-900"
                            }`}
                          >
                            {coin.split("/")[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 🔒 قسم أمان التطبيق والربط للهاتف والـ APK */}
                <div className="space-y-3 pt-3 border-t border-slate-800/40">
                  <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-emerald-400" />
                    أمان لوحة التحكم وربط تطبيق الهاتف والـ APK:
                  </h3>

                  <div className="bg-slate-900 border border-slate-900 rounded-2xl p-4 space-y-4">
                    {/* 1. رمز قفل الحماية للوحة التحكم */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-300 block font-bold">رمز مرور الحماية (PIN) للمتصفح والهاتف:</label>
                        {appPin ? (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md font-bold">مُفعل بنشاط 🛡️</span>
                        ) : (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md">غير مُفعل</span>
                        )}
                      </div>
                      
                      <p className="text-[9px] text-slate-400 leading-relaxed">
                        قم بتعيين رمز مرور مكون من 4 أرقام لمنع أي شخص ممسك بهاتفك من الوصول إلى لوحة التداول الخاصة بك أو تعديل إعدادات الـ API.
                      </p>

                      <div className="flex gap-2">
                        <input
                          type="password"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder={appPin ? "•••• (مفعل، اكتب رمزاً جديداً لتغييره)" : "أدخل رمز مرور جديد (4 أرقام)"}
                          value={tempPin}
                          onChange={(e) => setTempPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="w-full bg-slate-950 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-center"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (tempPin.length === 4) {
                              safeStorage.setItem("BOT_ACCESS_PIN", tempPin);
                              safeStorage.setItem("BOT_SESSION_ACTIVE", "true");
                              // 30 يوماً
                              safeStorage.setItem("BOT_SESSION_EXPIRES", (Date.now() + 30 * 24 * 60 * 60 * 1000).toString());
                              setAppPin(tempPin);
                              setTempPin("");
                              alert("🟢 تم تفعيل وحفظ رمز قفل الحماية بنجاح! سيتم مطالبتك به عند إغلاق الشاشة أو إعادة فتح التطبيق لضمان خصوصيتك وأمان حسابك.");
                            } else if (tempPin === "" && appPin) {
                              if (confirm("هل أنت متأكد من رغبتك في إلغاء تفعيل رمز قفل الحماية بالكامل؟")) {
                                safeStorage.removeItem("BOT_ACCESS_PIN");
                                safeStorage.removeItem("BOT_SESSION_ACTIVE");
                                safeStorage.removeItem("BOT_SESSION_EXPIRES");
                                setAppPin("");
                                alert("🔓 تم إلغاء تفعيل رمز قفل لوحة التحكم بنجاح.");
                              }
                            } else {
                              alert("يرجى كتابة 4 أرقام كاملة لتفعيل قفل الحماية.");
                            }
                          }}
                          className="px-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-[10px] font-black transition-all shrink-0 cursor-pointer"
                        >
                          {tempPin === "" && appPin ? "إلغاء القفل" : "حفظ الرمز"}
                        </button>
                      </div>
                    </div>

                    {/* 2. رابط السيرفر السحابي للبوت */}
                    <div className="space-y-2 border-t border-slate-800/40 pt-4">
                      <label className="text-[10px] text-slate-300 block font-bold">عنوان السيرفر السحابي (رابط البوت):</label>
                      <p className="text-[9px] text-slate-400 leading-relaxed">
                        تلقائياً، يتصل التطبيق بنفس خادم الويب الحالي. إذا قمت بتثبيت التطبيق كـ APK أو على هاتف آخر، يمكنك كتابة رابط السيرفر السحابي الخاص بك هنا للتحكم فيه عن بُعد على مدار 24 ساعة.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="مثال: https://my-trading-bot-app.run.app"
                          value={serverUrl}
                          onChange={(e) => setServerUrl(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none ltr text-left"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (serverUrl.trim()) {
                              safeStorage.setItem("BOT_SERVER_URL", serverUrl.trim());
                              alert("🟢 تم ربط وحفظ عنوان السيرفر السحابي بنجاح! سيقوم التطبيق والـ APK الآن بمزامنة البيانات وجلب الصفقات حياً من هذا الرابط.");
                              fetchStatus(true);
                            } else {
                              safeStorage.removeItem("BOT_SERVER_URL");
                              setServerUrl("");
                              alert("🔄 تم استعادة الإعدادات الافتراضية. يتصل التطبيق الآن بالسيرفر المحلي المباشر.");
                              fetchStatus(true);
                            }
                          }}
                          className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          ربط ومزامنة
                        </button>
                      </div>
                    </div>

                    {/* 3. تنزيل ودعم تطبيق الـ APK للأندرويد */}
                    <div className="space-y-2 border-t border-slate-800/40 pt-4">
                      <span className="text-[10px] text-slate-300 block font-bold">بناء وتصدير ملف تطبيق الأندرويد (APK):</span>
                      <p className="text-[9px] text-slate-400 leading-relaxed">
                        تمت تهيئة إعدادات ملف الأندرويد بنظام Capacitor بالكامل وتجهيز الحزم اللازمة. يمكنك استخدام المتصفح لتثبيت التطبيق فوراً كـ PWA عبر خيار "التثبيت" في الأعلى للحصول على تطبيق هاتف مستقل تماماً، خفيف وسريع ولا يحتاج لأي متطلبات تشغيل إضافية.
                      </p>
                      
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-xl text-[9px] text-slate-300 leading-normal flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>جاهز للتثبيت 📱:</strong> لقد قمنا بضبط الأكواد لدعم العمل الدائم 24 ساعة ومنع الخروج أو إغلاق الشاشة باستخدام آليات الحفظ التلقائي وحفظ الجلسة الآمنة.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* إعادة تعيين البيانات */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {isCurrentlyDemo && (
                    <button
                      onClick={handleResetDemoBalance}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800/80 text-xs py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      إعادة تعيين رصيد المحفظة الافتراضية
                    </button>
                  )}
                  <button
                    onClick={handleResetAll}
                    className="w-full bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-950/40 text-xs py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                    إعادة تهيئة التطبيق بالكامل كأول استخدام ⚙️
                  </button>
                </div>
              </div>
            )}



            {/* ═══════════════════════════════════════════════════════════════
                التبويب الرابع: ربط الحسابات ومفاتيح الـ API (API Keys Tab)
                ═══════════════════════════════════════════════════════════════ */}
            {activeTab === "api" && (
              <div className="space-y-4 animate-fade-in text-right" id="api_tab">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-200">إدارة ربط مفاتيح وحسابات التداول الحقيقية</h3>
                  <button
                    onClick={() => setShowAddApi(!showAddApi)}
                    className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/10 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة حساب حقيقي
                  </button>
                </div>

                {/* واجهة إضافة حساب API جديد */}
                {showAddApi && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 animate-fade-in" id="add_api_form">
                    <span className="text-xs font-bold text-slate-300 block">إضافة مفتاح تداول Binance Futures جديد</span>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400">اسم مستعار للحساب (اسم تعريفي):</label>
                      <input
                        type="text"
                        placeholder="مثال: حساب تداول فيوتشرز حقيقي رئيسي"
                        value={newApiName}
                        onChange={(e) => setNewApiName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs rounded-lg p-2 focus:border-emerald-500 outline-none text-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400">مفتاح الـ API Key الخاص بك:</label>
                      <input
                        type="text"
                        placeholder="أدخل الـ API Key من بينانس"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none text-slate-200 text-left"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-slate-400">مفتاح السر API Secret Key:</label>
                      <input
                        type="password"
                        placeholder="أدخل الـ Secret Key من بينانس"
                        value={newApiSecret}
                        onChange={(e) => setNewApiSecret(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-xs font-mono rounded-lg p-2 focus:border-emerald-500 outline-none text-slate-200 text-left"
                        dir="ltr"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleAddApiProfile}
                        disabled={isUpdating}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs py-2 rounded-xl font-bold transition-all cursor-pointer"
                      >
                        حفظ وتأمين الحساب 🔑
                      </button>
                      <button
                        onClick={() => setShowAddApi(false)}
                        className="px-4 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 text-xs py-2 rounded-xl font-bold transition-all cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {/* قائمة الحسابات المفعلة والمخزنة */}
                <div className="space-y-2.5">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-xs text-indigo-300 space-y-1 text-right">
                    <span className="font-bold flex items-center gap-1.5 justify-start text-indigo-200">
                      🛡️ تأكيد حماية العمل بالخلفية وحساب نشط موحد:
                    </span>
                    <p className="text-[11px] leading-relaxed text-indigo-400">
                      تم ضبط البوت ليتداول تلقائياً على <b>حساب واحد نشط فقط في كل مرة</b>. بمجرد تفعيل التداول على أي حساب، سيتم تلقائياً إيقاف تشغيل الحسابات الأخرى. البوت يعمل بشكل مستمر وآمن 24/7 على السيرفر السحابي المستقل بالخلفية، ولن يتأثر بإغلاقك لهذه الصفحة أو فصل هاتفك عن الإنترنت.
                    </p>
                  </div>

                  <div className="p-2 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-[10px] text-emerald-400 text-center font-bold">
                    💡 انقر على أي حساب لتحديده وعرض إعداداته، رصيده، صفقاته، وسجل تداوله الخاص به أدناه بشكل مستقل.
                  </div>

                  {status?.apiProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={`p-3.5 rounded-2xl border transition-all duration-300 relative overflow-hidden cursor-pointer ${
                        profile.id === selectedProfileId
                          ? "bg-slate-900 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.06)]"
                          : "bg-slate-900/60 border-slate-900 hover:border-slate-800"
                      }`}
                    >
                      {profile.id === selectedProfileId && (
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500"></div>
                      )}

                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl ${profile.id === selectedProfileId ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-950 text-slate-500"}`}>
                            {profile.isDemo ? <Cpu className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 justify-start">
                              <span className="text-xs font-bold text-slate-200">{profile.name}</span>
                              {profile.id === selectedProfileId && (
                                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">معروض حالياً 📍</span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                              {profile.isDemo ? "حساب افتراضي تداول تجريبي" : `مفتاح: ${profile.apiKey.substring(0, 10)}...`}
                            </span>
                            <div className="flex items-center gap-2 mt-1.5 justify-start">
                              <span className={`w-2 h-2 rounded-full ${profile.isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}></span>
                              <span className="text-[10px] text-slate-400">
                                {profile.isActive ? "التداول التلقائي: نشط بالخلفية 🟢" : "التداول التلقائي: متوقف بالخلفية 🔴"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleProfileActive(profile.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                              profile.isActive
                                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                                : "bg-slate-950 hover:bg-slate-900 text-slate-400 border-slate-800"
                            }`}
                          >
                            {profile.isActive ? "إيقاف التداول ⏸️" : "تفعيل التداول ▶️"}
                          </button>
                          <button
                            onClick={() => handleDeleteApiProfile(profile.id)}
                            title="حذف الحساب"
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/10 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}



            {/* ═══════════════════════════════════════════════════════════════
                التبويب الخامس: سجل عمليات البوت وحارس السحابة (Logs Tab)
                ═══════════════════════════════════════════════════════════════ */}
            {activeTab === "logs" && (
              <div className="space-y-4 animate-fade-in flex flex-col h-[75vh]" id="logs_tab">
                
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-200">سجل عمليات ومراقبة البوت الآلي</h3>
                  <button
                    onClick={handleClearLogs}
                    className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                  >
                    مسح السجل
                  </button>
                </div>

                {/* فلاتر السجلات السريعة */}
                <div className="flex gap-1.5 overflow-x-auto pb-1" id="logs_filter_scroller">
                  {(["all", "info", "success", "warn", "error", "trade"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLogFilter(filter)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 capitalize ${
                        logFilter === filter
                          ? "bg-slate-100 text-slate-950"
                          : "bg-slate-900 text-slate-400 border border-slate-900"
                      }`}
                    >
                      {filter === "all" ? "الكل" : filter === "trade" ? "الصفقات" : filter}
                    </button>
                  ))}
                </div>

                {/* تيرمينال الأكواد والعمليات اللحظي */}
                <div className="bg-slate-950 border border-slate-900 rounded-2xl p-3 flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-2 text-right relative" id="terminal_body">
                  {displayedLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600">
                      <Terminal className="w-6 h-6 mb-1 text-slate-700" />
                      <span>لا توجد سجلات مطابقة حالياً.</span>
                    </div>
                  ) : (
                    displayedLogs.map((log) => {
                      const colorMap = {
                        info: "text-slate-400",
                        success: "text-emerald-400 font-bold",
                        warn: "text-amber-400",
                        error: "text-rose-400 font-bold",
                        trade: "text-sky-400 font-bold"
                      };
                      return (
                        <div key={log.id} className="border-b border-slate-900/40 pb-1.5">
                          <span className="text-slate-600 block text-[8px] mb-0.5">
                            {new Date(log.time).toLocaleString("ar-EG", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <p className={colorMap[log.type] || "text-slate-300"}>{log.message}</p>
                        </div>
                      );
                    })
                  )}
                  <div ref={terminalEndRef}></div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* 🟧 الشريط السفلي للتنقل السريع - تصميم ثلاثي الأبعاد فاخر متحرك (otaz plus 3D Dock) */}
      <nav className="fixed bottom-3 left-3 right-3 max-w-[calc(28rem-1.5rem)] mx-auto bg-slate-950/95 backdrop-blur-2xl border border-orange-500/30 rounded-2xl flex justify-around py-2 z-50 px-1 shadow-[0_15px_35px_rgba(0,0,0,0.95),0_0_25px_rgba(234,88,12,0.25)]" id="navigation_bar">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === "dashboard"
              ? "bg-gradient-to-b from-orange-500/30 via-amber-600/20 to-slate-900 text-orange-300 border border-orange-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(234,88,12,0.35)] scale-105 font-black"
              : "text-slate-400 hover:text-orange-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[9px] font-bold">لوحة التحكم</span>
        </button>

        <button
          onClick={() => setActiveTab("positions")}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === "positions"
              ? "bg-gradient-to-b from-orange-500/30 via-amber-600/20 to-slate-900 text-orange-300 border border-orange-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(234,88,12,0.35)] scale-105 font-black"
              : "text-slate-400 hover:text-orange-200"
          }`}
        >
          <div className="relative">
            <Coins className="w-4 h-4" />
            {status && Object.keys(status.positions).filter(key => status.positions[key].profileId === selectedProfileId || (selectedProfileId === "demo" && (!status.positions[key].profileId || status.positions[key].profileId === "demo"))).length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full animate-ping"></span>
            )}
          </div>
          <span className="text-[9px] font-bold font-sans">الصفقات</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === "analytics"
              ? "bg-gradient-to-b from-orange-500/30 via-amber-600/20 to-slate-900 text-orange-300 border border-orange-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(234,88,12,0.35)] scale-105 font-black"
              : "text-slate-400 hover:text-orange-200"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-[9px] font-bold font-sans">التحليلات</span>
        </button>

        <button
          onClick={() => setActiveTab("api")}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === "api"
              ? "bg-gradient-to-b from-orange-500/30 via-amber-600/20 to-slate-900 text-orange-300 border border-orange-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(234,88,12,0.35)] scale-105 font-black"
              : "text-slate-400 hover:text-orange-200"
          }`}
        >
          <Key className="w-4 h-4" />
          <span className="text-[9px] font-bold">مفاتيح API</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === "settings"
              ? "bg-gradient-to-b from-orange-500/30 via-amber-600/20 to-slate-900 text-orange-300 border border-orange-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(234,88,12,0.35)] scale-105 font-black"
              : "text-slate-400 hover:text-orange-200"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[9px] font-bold">الإعدادات</span>
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer ${
            activeTab === "logs"
              ? "bg-gradient-to-b from-orange-500/30 via-amber-600/20 to-slate-900 text-orange-300 border border-orange-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_16px_rgba(234,88,12,0.35)] scale-105 font-black"
              : "text-slate-400 hover:text-orange-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span className="text-[9px] font-bold">السجلات</span>
        </button>
      </nav>
    </div>
  );
}
