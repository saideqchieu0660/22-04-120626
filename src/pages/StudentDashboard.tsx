import React, { useState, useEffect, useRef } from "react";
import { store, Deck } from "../lib/store";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Plus, X, Play, TrendingUp, Users, Target, BookOpen, BrainCircuit, Activity, Flame, ArrowLeft, CheckCircle2, XCircle, ArrowRight, Loader2, Trophy, Sparkles, Maximize2, Minimize2, Bell, BellOff, BellRing, Settings, AlertTriangle, Trash2, Snowflake, Volume2, VolumeX, Clock, Network, Award, Bot, User, Crown, ChevronUp, ChevronDown, Minus, Shield, RefreshCw, Heart, LogOut, Bug, Type, Library, Camera, Edit3, HelpCircle } from "lucide-react";
import { MarcusAureliusIcon } from "../components/MarcusAureliusIcon";
import { cn } from "../lib/utils";
import { safeRequest } from "../utils/apiClient";
import { db, auth, handleFirestoreError, OperationType, FirebaseListenerManager } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { collection, doc, onSnapshot, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, limit, orderBy } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { getIsMuted, setMutedStatus } from "../lib/audio";
import { MasteryBubbleChart } from "../components/MasteryBubbleChart";
import { MasteryHeatmap } from "../components/MasteryHeatmap";
import { SkillTreeGraph } from "../components/SkillTreeGraph";
import { StudentBadges } from "../components/StudentBadges";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { GlobalActivityFeed } from "../components/GlobalActivityFeed";
import { OnboardingTour } from "../components/OnboardingTour";
import DocumentConverter from "../components/DocumentConverter";
import ManualFlashcardImporter from "../components/ManualFlashcardImporter";
import WeeklyStudyAnalyticsModal from "../components/WeeklyStudyAnalyticsModal";
import { useTheme } from "../components/ThemeProvider";
import { CyberCard } from "../components/CyberCard";
import { CinematicContainer } from "../components/CinematicContainer";
import { InteractiveTutorial } from "../components/InteractiveTutorial";
import { ServiceMonitor } from "./AdminKeysDashboard";

import { DeckList } from "../components/DeckList";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ExportStudyReport } from "../components/ExportStudyReport";
import { useAICooldown, triggerAICooldown } from "../lib/cooldown";
import { getLevelInfo } from "../utils/xp";
import { getEnvDiagnostics } from "../utils/envDiagnostics";

export function parseRobustJsonArray(rawText: string): any[] {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          return parsed[key];
        }
      }
    }
  } catch (e) {
    console.warn("JSON.parse direct failed, trying robust regex extraction...", e);
  }

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonCandidate = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (Array.isArray(parsed)) return parsed;
    } catch (e2) {
      console.error("Failed to parse extracted bracket region as JSON array", e2);
    }
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate);
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          return parsed[key];
        }
      }
    } catch (e3) {
      console.error("Failed to parse extracted brace region", e3);
    }
  }

  throw new Error("Không thể trích xuất cấu trúc mảng JSON hợp lệ từ phản hồi của AI.");
}

const MockExamButton = ({ user, onClick }: any) => {
  const { cooldownRemaining } = useAICooldown(user);
  return (
    <button 
      onClick={onClick} 
      disabled={cooldownRemaining > 0} 
      className={cn("px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition transform", cooldownRemaining > 0 ? "bg-stone-300/60 dark:bg-zinc-800/80 text-black/50 dark:text-white/50 cursor-not-allowed" : "relative overflow-hidden group bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg hover:scale-[1.02] transition-all duration-500 font-bold before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/50 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700")}
    >
      <BrainCircuit className="w-5 h-5" />
      {cooldownRemaining > 0 ? `Đang hồi chiêu (${cooldownRemaining}s)` : "Sinh Bài Thi (Mock Exam)"}
    </button>
  );
};

const QuizCooldownTimer = ({ user }: any) => {
  const { cooldownRemaining } = useAICooldown(user);
  if (cooldownRemaining <= 0) return null;
  return <span>Cooldown: {cooldownRemaining}s</span>;
};

const UserRoleBadge = React.memo(({ role, isSchoolLover, isPro }: { role: string; isSchoolLover?: boolean; isPro?: boolean }) => {
  if (role === "Admin" || role === "admin" || role === "teacher") {
    return (
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5 shadow-sm">
        <Shield className="w-3.5 h-3.5 text-rose-500" /> Admin
      </span>
    );
  }
  if (isSchoolLover && isPro) {
    return (
      <span className="text-xs font-bold px-3 py-1 rounded-full bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center gap-1.5 shadow-sm">
        <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500 animate-pulse" /> Em yêu trường em [VIP]
      </span>
    );
  }
  return (
    <span className="text-xs font-bold px-3 py-1 rounded-full bg-stone-100 dark:bg-zinc-900 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-zinc-800 flex items-center gap-1.5">
      <Activity className="w-3.5 h-3.5" /> Học viên
    </span>
  );
});
UserRoleBadge.displayName = "UserRoleBadge";

import { useSound } from "../hooks/useSound";
import { TopPerformersWidget, getTier } from "../components/TopPerformersWidget";
import { triggerCelebration } from "../lib/celebration";

function AnimatedCounter({ value }: { value: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    const animation = animate(count, value, { duration: 1, ease: "easeOut" });
    return animation.stop;
  }, [value]);

  return <motion.span>{rounded}</motion.span>;
}

// Confetti component removed

type QuizQuestion = {
  cardId?: string;
  deckId?: string;
  question: string;
  options: string[];
  correctAnswerIndex?: number;
  correctIndex?: number;
  correctAnswer?: string;
  explanation?: string;
};

const MOTIVATION_QUOTES = [
  "Virtue is nothing else than right reason. - Seneca",
  "We suffer more often in imagination than in reality. - Seneca",
  "Waste no more time arguing what a good man should be. Be one. - Marcus Aurelius",
  "He who fears death will never do anything worth of a man who is alive. - Seneca",
  "The impediment to action advances action. What stands in the way becomes the way. - Marcus Aurelius",
  "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult. - Seneca",
  "Well begun is half done. - Aristotle",
  "Discipline is the bridge between goals and accomplishment. - Jim Rohn",
  "The struggle you’re in today is developing the strength you need for tomorrow. - Robert Tew",
  "If you want to live a happy life, tie it to a goal, not to people or things. - Albert Einstein",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
  "It is better to conquer yourself than to win a thousand battles. - Buddha",
  "Mastery is not a destination, but a journey of continuous improvement. - Unknown",
  "Growth is painful. Change is painful. But nothing is as painful as staying stuck where you don't belong. - Mandy Hale",
  "Your potential is endless. Go do what you were created to do. - Dharma Mittra",
  "The secret of getting ahead is getting started. - Mark Twain",
  "Persistence guarantees that results are inevitable. - Paramahansa Yogananda",
  "Do what you can, with what you have, where you are. - Theodore Roosevelt",
  "The master has failed more times than the beginner has even tried. - Stephen McCranie",
  "Quality is not an act, it is a habit. - Aristotle"
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="card-3d p-4 rounded-2xl">
        <p className="font-medium text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="font-display font-bold text-2xl text-yellow-600 dark:text-yellow-500 leading-none">
            {payload[0].value}
          </p>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">pts</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function StudentDashboard() {
  useEffect(() => {
    document.title = "Henosis - Student Dashboard";
  }, []);

  const { isEcoMode, toggleEcoMode } = useTheme();
  const { click, success, error } = useSound();
  const user = store.getCurrentUser();
  const prevLevelRef = useRef<number | null>(null);

  useEffect(() => {
    if (user) {
      const xpInfo = getLevelInfo(user.points || 0);
      const currentLevel = user.level || xpInfo.currentLevel;
      
      if (prevLevelRef.current !== null && currentLevel > prevLevelRef.current) {
         triggerCelebration();
         // Could also show a toast or custom modal, but triggerCelebration already provides a nice effect.
      }
      prevLevelRef.current = currentLevel;
    }
  }, [user?.points, user?.level]);

  const [quote] = useState(() => MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)]);
  const [showTutorial, setShowTutorial] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"study" | "ranking" | "quiz" | "mock_exam_setup" | "settings" | "history" | "skill_tree" | "all_sets" | "groups" | "achievements" | "profile" | "create_deck" | "cyberpunk">("study");
  const [profileNameInput, setProfileNameInput] = useState("");
  const [isEditingProfileName, setIsEditingProfileName] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !isEditingProfileName) {
      setProfileNameInput(user.name || "");
    }
  }, [user?.name]);

  const resizeImageAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 96;
          let width = img.width;
          let height = img.height;

          const size = Math.min(width, height);
          const xOffset = (width - size) / 2;
          const yOffset = (height - size) / 2;

          canvas.width = max_size;
          canvas.height = max_size;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, max_size, max_size);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            resolve(dataUrl);
          } else {
            reject(new Error("Không thể khởi tạo canvas context"));
          }
        };
        img.onerror = () => reject(new Error("Lỗi tải ảnh"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Lỗi đọc file"));
      reader.readAsDataURL(file);
    });
  };

  const [viewMode, setViewMode] = useState<"recent" | "all">("recent");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
// Removed unused state
  const [muteAll, setMuteAll] = useState(() => getIsMuted());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("henosis_notifications");
      return saved === "true";
    }
    return false;
  });
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"7_days" | "30_days" | "all_time">("7_days");
  const [isWeeklyStudyModalOpen, setIsWeeklyStudyModalOpen] = useState(false);
  const [showEnvDebug, setShowEnvDebug] = useState(false);
  const [localFontSize, setLocalFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("henosis-font-size");
    return saved ? parseInt(saved, 10) : 16;
  });

  const [localUiDensity, setLocalUiDensity] = useState<"comfortable" | "compact">(() => {
    const saved = localStorage.getItem("henosis-ui-density");
    return (saved === "compact" || saved === "comfortable") ? saved : "comfortable";
  });

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.size === 'number') {
        setLocalFontSize(customEvent.detail.size);
      }
    };
    const handleDensityChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && (customEvent.detail.density === 'comfortable' || customEvent.detail.density === 'compact')) {
        setLocalUiDensity(customEvent.detail.density);
      }
    };
    window.addEventListener("henosis-font-size-changed", handleCustomChange as EventListener);
    window.addEventListener("henosis-ui-density-changed", handleDensityChange as EventListener);
    return () => {
      window.removeEventListener("henosis-font-size-changed", handleCustomChange as EventListener);
      window.removeEventListener("henosis-ui-density-changed", handleDensityChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleNotifChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setNotificationsEnabled(customEvent.detail.enabled);
      } else {
        const saved = localStorage.getItem("henosis_notifications") === "true";
        setNotificationsEnabled(saved);
      }
    };
    window.addEventListener("henosis_notifications_changed", handleNotifChange);
    return () => {
      window.removeEventListener("henosis_notifications_changed", handleNotifChange);
    };
  }, []);

  const [rawDecks, setRawDecks] = useState<Deck[]>([]);
  const [personalCardStates, setPersonalCardStates] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "global_activity_feed"),
      orderBy("timestamp", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeBroadcasts: any[] = [];
      const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;

      snapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        if (data.isGlobalBroadcast === true && data.timestamp && data.timestamp >= fortyEightHoursAgo) {
          activeBroadcasts.push({
            id: snapshotDoc.id,
            userId: data.userId || '',
            userName: data.userName || 'Anonymous',
            content: data.content || '',
            timestamp: typeof data.timestamp === 'number' ? data.timestamp : (data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now()),
            userRole: data.userRole || 'student'
          });
        }
      });
      setBroadcasts(activeBroadcasts);
    }, (err) => {
      console.warn("Could not load broadcasts on homepage:", err);
      try {
        const localFeedStr = localStorage.getItem('local_global_activity_feed') || '[]';
        const localFeed = JSON.parse(localFeedStr);
        const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
        const active = localFeed.filter((item: any) => item.isGlobalBroadcast && item.timestamp >= fortyEightHoursAgo);
        setBroadcasts(active);
      } catch (e) {}
    });

    return () => unsubscribe();
  }, []);
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Manual creation states & logic
  const [manualTitle, setManualTitle] = useState("");
  const [manualSubject, setManualSubject] = useState("");
  const [isCreatingNewSubject, setIsCreatingNewSubject] = useState(false);
  const [manualCards, setManualCards] = useState<{ front: string; back: string }[]>([]);

  const existingSubjects = React.useMemo(() => {
    const subjectsSet = new Set<string>();
    rawDecks.forEach((d) => {
      const s =
        (typeof d.subject === "string"
          ? d.subject
          : JSON.stringify(d.subject)) || "Tự chọn";
      if (s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
    // Add default core subjects in Vietnamese
    const defaults = [
      "Tiếng Anh",
      "Toán học",
      "Vật lý",
      "Hóa học",
      "Sinh học",
      "Lịch sử",
      "Địa lý",
      "Triết học",
      "Tin học / Lập trình",
      "Tự chọn"
    ];
    defaults.forEach((def) => subjectsSet.add(def));
    return Array.from(subjectsSet);
  }, [rawDecks]);
  const [currentFront, setCurrentFront] = useState("");
  const [currentBack, setCurrentBack] = useState("");
  const [creationMethod, setCreationMethod] = useState<"ai" | "manual">("ai");

  const handleAddManualCard = () => {
    if (!currentFront.trim() || !currentBack.trim()) return;
    setManualCards([...manualCards, { front: currentFront.trim(), back: currentBack.trim() }]);
    setCurrentFront("");
    setCurrentBack("");
  };

  const handleRemoveManualCard = (index: number) => {
    setManualCards(manualCards.filter((_, idx) => idx !== index));
  };

  const handleSaveManualDeck = async () => {
    if (!manualTitle.trim()) {
      alert("Vui lòng nhập tiêu đề bộ thẻ!");
      return;
    }
    if (manualCards.length === 0) {
      alert("Bộ thẻ cần có ít nhất 1 thẻ!");
      return;
    }
    const deckId = `deck_user_${Date.now()}`;
    const newDeck: Deck = {
      id: deckId,
      title: manualTitle.trim(),
      subject: manualSubject.trim() || "Tự chọn",
      cards: manualCards.map((c, idx) => ({
        id: `card_user_${Date.now()}_${idx}`,
        front: c.front,
        back: c.back,
        subject: manualSubject.trim() || "Tự chọn",
        mastery: 0,
        nextReview: Date.now(),
        isHard: false
      }))
    };

    await store.addDeck(newDeck);
    
    setManualTitle("");
    setManualSubject("");
    setIsCreatingNewSubject(false);
    setManualCards([]);
    alert(`Chúc mừng! Bộ thẻ "${newDeck.title}" đã được tạo thành công! Bạn có thể xem ngay tại tab "Bộ Học".`);
    setActiveTab("all_sets");
  };

  const navigate = useNavigate();
  const [isStartingQuest, setIsStartingQuest] = useState(false);

  const handleStartDailyQuest = React.useCallback(async () => {
    setIsStartingQuest(true);
    try {
      const allDecks = store.getDecks();
      let allCards: any[] = [];
      allDecks.forEach(d => {
         d.cards.forEach((c: any) => {
            allCards.push({ ...c, originDeckId: d.id, originDeckTitle: d.title });
         });
      });

      if (allCards.length === 0) {
        alert("Không có thẻ nào để tạo nhiệm vụ!");
        setIsStartingQuest(false);
        return;
      }

      const res = await safeRequest("/api/daily-quest", {
         headers: { "Content-Type": "application/json" },
         method: "POST",
         body: JSON.stringify({ allCards })
      });

      const data = await res.json();

      if (!data.cards || data.cards.length === 0) {
        alert("Chưa có thẻ nào cần ôn hôm nay!");
        setIsStartingQuest(false);
        return;
      }

      const dailyDeck = {
         id: "daily-quest",
         title: "Nhiệm vụ hôm nay (Daily Quest)",
         subject: "Spaced Repetition",
         description: "Được tự động tạo bởi SM-2 bằng Thuật toán phân cực.",
         cards: data.cards,
         createdAt: new Date().toISOString(),
         ownerId: "system"
      };

      store.setTempDeck(dailyDeck);
      navigate("/study/daily-quest");
    } catch(err) {
       console.error("Daily quest start error:", err);
       alert("Có lỗi khi tạo lộ trình hôm nay. Vui lòng thử lại.");
       setIsStartingQuest(false);
    }
  }, [navigate]);

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // 1. Listen to raw decks in real-time
  const unsubDecksRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!user) return;
    if (unsubDecksRef.current) unsubDecksRef.current();
    try {
      const unsub = onSnapshot(collection(db, "sets"), (snapshot) => {
        const list: Deck[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data && Array.isArray(data.cards)) {
             data.cards = data.cards.map((c: any) => ({
                ...c,
                mastery: (typeof c.mastery === 'number' && !isNaN(c.mastery)) ? c.mastery : 0
             }));
          }
          
          const systemDecks = [
            "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2"
          ];
          const isSystem = systemDecks.includes(data.id);
          const isCreatedBySelf = data.createdBy === user.id;
          const isCreatedByTeacher = data.creatorRole === "teacher" || data.creatorRole === "Admin" || data.creatorRole === "admin";
          
          const isUserTeacher = user.role === "teacher" || user.role === "Admin" || user.role === "admin";

          if (isSystem || isCreatedBySelf || isUserTeacher || isCreatedByTeacher) {
            list.push(data as Deck);
          }
        });
        setRawDecks(list);
        setIsInitialLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, "sets");
        setIsInitialLoading(false);
      });
      unsubDecksRef.current = unsub;
      FirebaseListenerManager.add("StudentDashboard_decks", unsub);
      
      // Fallback timeout in case onSnapshot hangs due to offline/permission issues
      setTimeout(() => {
         setIsInitialLoading(prev => {
            if (prev) {
               console.warn("onSnapshot sets timeout - forcing initial loading to false");
               return false;
            }
            return prev;
         });
      }, 3000);
    } catch (e) {
      console.error("Failed to sync sets in real-time:", e);
      setIsInitialLoading(false);
    }
    return () => {
      if (unsubDecksRef.current) {
         unsubDecksRef.current();
         unsubDecksRef.current = null;
      }
      FirebaseListenerManager.remove("StudentDashboard_decks");
    };
  }, [user?.id]);

  // 2. Listen to personal card states in real-time
  const unsubCardStatesRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!user) return;
    if (unsubCardStatesRef.current) unsubCardStatesRef.current();
    try {
      const unsub = onSnapshot(collection(db, "users", user.id, "cardsState"), (snapshot) => {
        const states: any[] = [];
        snapshot.forEach((docSnap) => {
          states.push({ id: docSnap.id, ...docSnap.data() });
        });
        setPersonalCardStates(states);
      }, (err) => {
        console.error("Personal cardsState sync error:", err);
      });
      unsubCardStatesRef.current = unsub;
      FirebaseListenerManager.add("StudentDashboard_cards_states", unsub);
    } catch (e) {
      console.error("Failed to sync card states in real-time:", e);
    }
    return () => {
      if (unsubCardStatesRef.current) {
        unsubCardStatesRef.current();
        unsubCardStatesRef.current = null;
      }
      FirebaseListenerManager.remove("StudentDashboard_cards_states");
    };
  }, [user?.id]);

  // 3. Merge raw decks and personal card states to form localDecks and store
  const localDecks = React.useMemo(() => {
    if (rawDecks.length === 0) return store.getDecks();

    const stateMap = new Map();
    if (personalCardStates && personalCardStates.length > 0) {
      personalCardStates.forEach((s) => stateMap.set(s.id, s));
    }

    return rawDecks.map((deck) => {
      const clonedDeck = { ...deck };
      if (clonedDeck.cards) {
        clonedDeck.cards = clonedDeck.cards.map((card) => {
          const savedState = stateMap.get(card.id);
          if (savedState) {
            return {
              ...card,
              mastery: typeof savedState.mastery === 'number' && !isNaN(savedState.mastery) ? savedState.mastery : (Number(card.mastery) || 0),
              nextReviewDate: typeof savedState.nextReviewDate === 'number' ? savedState.nextReviewDate : card.nextReviewDate,
              nextReview: typeof savedState.nextReview === 'number' ? savedState.nextReview : card.nextReview,
              interval: typeof savedState.interval === 'number' ? savedState.interval : card.interval,
              repetitionCount: typeof savedState.repetitionCount === 'number' ? savedState.repetitionCount : card.repetitionCount,
              easeFactor: typeof savedState.easeFactor === 'number' ? savedState.easeFactor : card.easeFactor,
              isNewCard: typeof savedState.isNewCard === 'boolean' ? savedState.isNewCard : false,
              isHard: typeof savedState.isWeakCard !== 'undefined' ? savedState.isWeakCard : card.isHard
            };
          }
          return card;
        });
      }
      return clonedDeck;
    });
  }, [rawDecks, personalCardStates]);

  // Sync to global store transparently
  useEffect(() => {
    const updateStore = async () => {
      const { store: globalStore } = await import("../lib/store");
      if (globalStore && typeof (globalStore as any).setDecksLocally === 'function') {
         (globalStore as any).setDecksLocally(localDecks);
      }
    };
    updateStore();
  }, [localDecks]);

  // Sync overall average mastery progress to Firestore
  useEffect(() => {
    if (!user || localDecks.length === 0) return;

    const allCards = localDecks.flatMap(d => Array.isArray(d.cards) ? d.cards : []);
    const avgMastery = allCards.length > 0
      ? Math.round((allCards.reduce((sum, c) => sum + (Number(c.mastery) || 0), 0) / allCards.length))
      : 0;

    if (user.averageMastery !== avgMastery) {
      const syncMastery = async () => {
        try {
          const { dbService } = await import("../lib/firebase");
          // Update in Firebase User Profile
          await dbService.updateUserProfile(user.id, { averageMastery: avgMastery });
          // Update locally in store
          store.updateCurrentUser({ averageMastery: avgMastery }, true);
        } catch (err) {
          console.error("Failed to sync overall averageMastery:", err);
        }
      };
      syncMastery();
    }
  }, [localDecks, user?.id, user?.averageMastery]);

  const decks = localDecks;

  const [dbUsers, setDbUsers] = useState<any[]>([]);

  // Listen for real-time changes to the users collection (leaderboard & points sync)
  const unsubUsersRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!user) return;
    if (unsubUsersRef.current) unsubUsersRef.current();
    try {
      const q = query(collection(db, "users"), where("points", ">", 0), limit(100));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setDbUsers(list);
        
        // Dynamic synchronization with the global store
        const currentUserData = store.getCurrentUser();
        if (currentUserData) {
          const matched = list.find((u) => u.id === currentUserData.id);
          if (matched) {
            // Guard to block infinite cascading re-renders
            if (currentUserData.points !== matched.points || currentUserData.streak !== matched.streak || currentUserData.level !== matched.level || currentUserData.title !== matched.title || currentUserData.avatarBorder !== matched.avatarBorder || currentUserData.isSchoolLover !== matched.isSchoolLover) {
                store.updateCurrentUser({ 
                   points: matched.points, 
                   streak: matched.streak, 
                   level: matched.level,
                   title: matched.title,
                   avatarBorder: matched.avatarBorder,
                   isSchoolLover: matched.isSchoolLover
                }, true);
            }
          }
        }
      }, (err) => {
        console.error("Leaderboard query error:", err);
      });
      unsubUsersRef.current = unsub;
      FirebaseListenerManager.add("StudentDashboard_users", unsub);
    } catch (e) {
      console.error(e);
    }
    return () => {
      if (unsubUsersRef.current) {
        unsubUsersRef.current();
        unsubUsersRef.current = null;
      }
      FirebaseListenerManager.remove("StudentDashboard_users");
    };
  }, [user?.id]);

  // Listen for real-time changes to the active group, fetching and sorting member profiles dynamically
  useEffect(() => {
    // Group functionality removed
    return () => {};
  }, [user?.id]);

  const sortedUsers = React.useMemo(() => {
    const currentWeekId = store.getISOWeekId();
    return dbUsers.length > 0
      ? dbUsers.map(u => {
          const isStale = u.lastWeeklyResetWeek && u.lastWeeklyResetWeek !== currentWeekId;
          return {
            ...u,
            points: isStale ? 0 : (u.points || 0)
          };
        }).filter(u => {
          const roleLower = (u.role || "").toLowerCase();
          const isTargetRole = ["student", "admin", "teacher"].includes(roleLower);
          const isValidUser = u.status !== "disabled" && u.isAnonymous !== true && u.name !== "Guest Student";
          const hasPoints = (u.points || 0) > 0;
          // Admins/Teachers can be shown always, students must have > 0 points
          return isTargetRole && isValidUser && (roleLower === "admin" || roleLower === "teacher" || hasPoints);
        }).sort((a, b) => (b.points || 0) - (a.points || 0))
      : (auth.currentUser && !auth.currentUser.isAnonymous)
        ? []
        : [...store.getUsers()].map(u => {
            const isStale = u.lastWeeklyResetWeek && u.lastWeeklyResetWeek !== currentWeekId;
            return {
              ...u,
              points: isStale ? 0 : (u.points || 0)
            };
          }).filter(u => {
            const roleLower = (u.role || "").toLowerCase();
            const isTargetRole = ["student", "admin", "teacher"].includes(roleLower);
            const isValidUser = u.isAnonymous !== true && u.name !== "Guest Student";
            const hasPoints = (u.points || 0) > 0;
            return isTargetRole && isValidUser && (roleLower === "admin" || roleLower === "teacher" || hasPoints);
          }).sort((a, b) => b.points - a.points);
  }, [dbUsers]);
  
  const prevRanksRef = useRef<Record<string, number>>({});
  const [rankTrends, setRankTrends] = useState<Record<string, 'up' | 'down' | 'same'>>({});
  const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);

  const rankCelebratedRef = useRef(false);

  useEffect(() => {
     if (sortedUsers.length === 0) return;
     
     const currentRanks: Record<string, number> = {};
     let hasChanges = false;
     let userClimbed = false;
     
     sortedUsers.forEach((u, index) => {
         currentRanks[u.id] = index;
         const prevRank = prevRanksRef.current[u.id];
         
         if (prevRank !== undefined && prevRank !== index) {
             hasChanges = true;
         }
         
         if (prevRank !== undefined && index < prevRank && u.id === user?.id) {
             userClimbed = true;
         }
     });
     
     if (Object.keys(prevRanksRef.current).length === 0) {
        prevRanksRef.current = currentRanks;
        return;
     }

     if (!hasChanges) {
         return;
     }

     setRankTrends(prevTrends => {
         const newTrends = { ...prevTrends };
         sortedUsers.forEach((u, index) => {
             const prevRank = prevRanksRef.current[u.id];
             if (prevRank !== undefined) {
                 if (index < prevRank) {
                     newTrends[u.id] = 'up';
                 } else if (index > prevRank) {
                     newTrends[u.id] = 'down';
                 } else {
                     newTrends[u.id] = newTrends[u.id] || 'same'; 
                 }
             } else {
                 newTrends[u.id] = 'same';
             }
         });
         return newTrends;
     });

     prevRanksRef.current = currentRanks;

     if (userClimbed) {
         if (!rankCelebratedRef.current) {
             triggerCelebration();
             rankCelebratedRef.current = true;
         }
     } else {
         rankCelebratedRef.current = false;
     }
  }, [sortedUsers, user?.id]);

  
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [activeGroup, setActiveGroup] = useState<any>(null);
  
  const handleCreateGroup = () => {
    if (groupName.trim()) {
        const g = store.createGroup(groupName);
        setActiveGroup(g);
        setGroupName("");
    }
  };
  
  const handleJoinGroup = () => {
    if (groupId.trim()) {
        const g = store.joinGroup(groupId);
        if (g) setActiveGroup(g);
    }
  };
  
  const handleLeaveGroup = () => {
     setActiveGroup(null);
  };
  
  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"hard" | "soft">("hard");

  const handleDeleteStudentSubmit = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      const { dbService } = await import("../lib/firebase");
      if (deleteMode === "hard") {
        await dbService.deleteUserProfile(studentToDelete.id);
        setDbUsers(prev => prev.filter(u => u.id !== studentToDelete.id));
      } else {
        await dbService.updateUserProfile(studentToDelete.id, { status: "disabled" });
        setDbUsers(prev => prev.map(u => u.id === studentToDelete.id ? { ...u, status: "disabled" } : u));
      }
      setStudentToDelete(null);
    } catch (e: any) {
      console.error("Error deleting student:", e);
    } finally {
      setIsDeletingStudent(false);
    }
  };
  
  // --- Weekly Study Time Calculation ---
  const calculateWeeklyStudyHours = React.useCallback(() => {
    if (!user) return { hours: 0, minutes: 0 };
    const history = store.getReviewHistory(user.id);
    if (!history || history.length === 0) return { hours: 0, minutes: 0 };

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyHistory = history.filter(r => r.timestamp >= oneWeekAgo).sort((a, b) => a.timestamp - b.timestamp);

    let totalMilliseconds = 0;
    const NEW_SESSION_THRESHOLD = 5 * 60 * 1000; // 5 minutes break = new session
    const DEFAULT_CARD_TIME = 15 * 1000; // 15 seconds for the first card of a session

    for (let i = 0; i < weeklyHistory.length; i++) {
        if (i === 0) {
            totalMilliseconds += DEFAULT_CARD_TIME;
        } else {
            const diff = weeklyHistory[i].timestamp - weeklyHistory[i - 1].timestamp;
            if (diff <= NEW_SESSION_THRESHOLD) {
                totalMilliseconds += diff;
            } else {
                totalMilliseconds += DEFAULT_CARD_TIME;
            }
        }
    }

    const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
    return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60
    };
  }, [user?.id]);

  const { hours: studyHours, minutes: studyMinutes } = React.useMemo(() => calculateWeeklyStudyHours(), [calculateWeeklyStudyHours]);
  // -------------------------------------
  
  const [showRemindLaterModal, setShowRemindLaterModal] = useState(false);
  const [remindLaterCardIds, setRemindLaterCardIds] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchReminders = () => {
       try {
         setRemindLaterCardIds(JSON.parse(localStorage.getItem("remind_later_items") || "[]") as string[]);
       } catch {
         setRemindLaterCardIds([]);
       }
    };
    fetchReminders();
    window.addEventListener("focus", fetchReminders);
    return () => window.removeEventListener("focus", fetchReminders);
  }, []);
  
  const remindLaterCards = React.useMemo(() => {
    if (remindLaterCardIds.length === 0) return [];
    const allCards = decks.flatMap(d => d.cards || []);
    return allCards.filter(c => remindLaterCardIds.includes(c.id));
  }, [decks, remindLaterCardIds]);

  const remindLaterCount = remindLaterCards.length;

  const startRemindLaterStudy = (specificCardId?: string) => {
    let cardsToStudy = remindLaterCards;
    if (specificCardId) {
      cardsToStudy = remindLaterCards.filter(c => c.id === specificCardId);
    }
    if (cardsToStudy.length === 0) return;

    const remindDeck = {
       id: "remind-later-deck",
       title: "Thẻ nhắc nhở",
       subject: "Quick Study",
       description: "Bộ thẻ gồm các từ vựng bạn đã đánh dấu nhắc nhở lại.",
       cards: cardsToStudy,
       createdAt: new Date().toISOString(),
       ownerId: "system"
    };
    
    store.setTempDeck(remindDeck);
    setShowRemindLaterModal(false);
    navigate("/study/remind-later-deck");
  };
  
  const streakCelebratedRef = useRef(false);

  useEffect(() => {
    if (user?.id) {
       const key = `last_streak_${user.id}`;
       const oldStreak = parseInt(sessionStorage.getItem(key) || "0", 10);
       if (user.streak && user.streak > oldStreak) {
          if (!streakCelebratedRef.current) {
             triggerCelebration();
             streakCelebratedRef.current = true;
          }
       } else if (user.streak === undefined || user.streak <= oldStreak) {
          streakCelebratedRef.current = false;
       }
       sessionStorage.setItem(key, (user.streak || 0).toString());
    }
  }, [user?.streak, user?.id]);
  
  const todayString = new Date().toISOString().split('T')[0];
  const [dailyGoal, setDailyGoal] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`daily_goal_${user?.id}`);
      return saved ? parseInt(saved, 10) : 20;
    }
    return 20;
  });
  
  const [, setForceRender] = useState(0);

  useEffect(() => {
    const handleSyncEvent = () => {
       setForceRender(prev => prev + 1);
    };
    window.addEventListener("henosis-data-synced", handleSyncEvent);
    return () => window.removeEventListener("henosis-data-synced", handleSyncEvent);
  }, []);

  const handleBuyFreeze = () => {
    if (store.buyStreakFreeze()) {
       setForceRender(prev => prev + 1);
    }
  };

  // Note: we fetch this statically on dashboard load/render since we don't dispatch events on localstorage
  const dailyReviewed = typeof window !== "undefined" ? parseInt(localStorage.getItem(`daily_reviewed_${user?.id}_${todayString}`) || "0", 10) : 0;
  
  const handleDailyGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 0;
    setDailyGoal(val);
    if (user?.id) localStorage.setItem(`daily_goal_${user.id}`, val.toString());
  };

  const pendingCardsCount = decks.reduce((acc, deck) => {
    return acc + (deck.cards || []).filter(c => c.nextReview && c.nextReview <= Date.now()).length;
  }, 0);

  const deckWithLowestMastery = React.useMemo(() => {
    const decksWithCards = decks.filter(d => d.cards && d.cards.length > 0);
    if (decksWithCards.length === 0) return null;
    
    return decksWithCards.reduce((lowest, current) => {
      const currentAvg = current.cards.reduce((sum: number, c: any) => sum + (c.mastery || 0), 0) / current.cards.length;
      const lowestAvg = lowest.cards.reduce((sum: number, c: any) => sum + (c.mastery || 0), 0) / lowest.cards.length;

      return currentAvg < lowestAvg ? current : lowest;
    }, decksWithCards[0]);
  }, [decks]);

  const toggleNotifications = async () => {
    const newVal = !notificationsEnabled;
    if (newVal) {
      if (!("Notification" in window)) {
        alert("Trình duyệt của mày không hỗ trợ Browser Notifications API rồi!");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("Mày cần bật quyền thông báo đẩy trên trình duyệt thì tao mới gửi nhắc nhở được!");
        return;
      }
    }
    setNotificationsEnabled(newVal);
    localStorage.setItem("henosis_notifications", newVal.toString());
    window.dispatchEvent(new CustomEvent("henosis_notifications_changed", { detail: { enabled: newVal } }));
    
    if (newVal) {
      try {
        new Notification("Henosis Web 🔔", {
          body: "Đã kích hoạt nhắc nhở học tập hàng ngày thành công! Học bài giữ streak nhé mày! 💪🔥",
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearOldData = () => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('weak_cards_') || key.includes('draft') || key.includes('agent'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    setShowClearConfirm(false);
    // Optionally trigger a page reload or force an update here if needed.
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      if (auth.currentUser?.uid) {
         try {
             // Clean up co-study room presence before losing auth context
             const { doc, deleteDoc } = await import("firebase/firestore");
             const { db } = await import("../lib/firebase");
             await deleteDoc(doc(db, "costudy_room", auth.currentUser.uid));
         } catch (roomErr) {
             console.error("Cleanup room error:", roomErr);
         }
      }
      
      await signOut(auth);
      store.logout();
      FirebaseListenerManager.clearAll();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  
  // Quiz states
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizQuote] = useState(MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)]);

  // Mock Exam specific states
  const [selectedExamDecks, setSelectedExamDecks] = useState<string[]>([]);
  const [examQuestionCount, setExamQuestionCount] = useState<number>(10);

  // AI MCQ Quiz dynamic setups
  const [activeQuizSetup, setActiveQuizSetup] = useState<{ subject: string; decks: Deck[] } | null>(null);
  const [quizQuestionCount, setQuizQuestionCount] = useState<number>(15);

  const triggerQuiz = async (categoryName?: string, categoryDecks?: Deck[], customQuestionCount: number = 15) => {
      let cardsToUse: any[] = [];
      if (categoryName && categoryDecks) {
        // Collect ALL cards from the decks in this category!
        for (const d of categoryDecks) {
          const cards = d.cards || [];
          cardsToUse.push(...cards.map(c => ({ front: c.front, back: c.back, subject: c.subject || categoryName })));
        }
        // Shuffle and limit to a larger count so the AI has enough pool to select the exact number of questions
        cardsToUse = cardsToUse.sort(() => 0.5 - Math.random()).slice(0, Math.max(customQuestionCount * 2, 40));
      } else {
        const allDecks = store.getDecks();
        let weakCards: any[] = [];
        for (const deck of allDecks) {
          const storageKey = `weak_cards_${deck.id}`;
          const weakIds = JSON.parse(localStorage.getItem(storageKey) || "[]");
          let cards = (deck.cards || []).filter(c => {
             if (weakIds.includes(c.id)) return true;
             // Exclude new unstudied cards mapping to low mastery
             if (c.isNewCard === true || c.isNewCard === undefined && c.mastery === 0 && (c.repetitionCount === undefined || c.repetitionCount === 0)) return false;
             return c.mastery < 50;
          });
          weakCards.push(...cards.map(c => ({ front: c.front, back: c.back, subject: c.subject })));
        }
        
        weakCards = weakCards.sort(() => 0.5 - Math.random()).slice(0, Math.max(customQuestionCount, 15));
        cardsToUse = weakCards;
      }
      
      if (cardsToUse.length === 0) {
        setQuizError(categoryName ? `Phân mục "${categoryName}" chưa có thẻ học nào để kiểm tra!` : "Bạn chưa có thẻ yếu nào để thực hiện kiểm tra AI. Hãy học thêm một số Flashcard nha!");
        setTimeout(() => setQuizError(null), 3000);
        return;
      }

      if (user && user.role === "student") {
        triggerAICooldown(user);
      }
      setIsQuizLoading(true);
      setActiveTab("quiz");
      setQuizError(null);
      setQuizFinished(false);
      setQuizScore(0);
      setQuizCurrentIndex(0);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
      
      try {
        const idToken = await auth.currentUser?.getIdToken() || "";
        const res = await safeRequest("/api/agent3/chat", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
              "x-user-id": user?.id || "",
              "x-user-role": user?.role || "",
              "x-user-is-pro": user?.isPro ? "true" : "false"
            },
            body: JSON.stringify({
                mode: "quiz",
                message: categoryName 
                  ? `Sinh đề kiểm tra MCQ cho mục học "${categoryName}"` 
                  : "Sinh đề kiểm tra MCQ theo format chuẩn json.",
                mcqData: cardsToUse,
                questionCount: customQuestionCount,
                difficulty: "medium",
                category_context: categoryName ? {
                  id: categoryName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                  name: categoryName,
                  items_count: cardsToUse.length
                } : undefined
            })
        });
        
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429) {
            throw new Error(data.error || "Bạn đang gọi AI quá nhanh. Hãy chờ 20s nạp năng lượng!");
          }
          throw new Error(data.error?.message || "Lỗi kết nối từ Hệ thống Gemini");
        }
        if (data.result) {
            let questions = parseRobustJsonArray(data.result);

            // Tầng xử lý tráo bài bằng thuật toán Fisher-Yates (Frontend Guardrail)
            questions = questions.map((q: any) => {
               if (q.options && Array.isArray(q.options) && typeof q.correctAnswerIndex === 'number') {
                   const correctOption = q.options[q.correctAnswerIndex];
                   if (correctOption) {
                       const arr = [...q.options];
                       for (let i = arr.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [arr[i], arr[j]] = [arr[j], arr[i]];
                       }
                       q.options = arr;
                       q.correctAnswerIndex = arr.indexOf(correctOption);
                   }
               }
               return q;
            });

            // Guardrail triệt để: Giới hạn chính xác số câu hỏi theo mong muốn của người dùng
            if (questions.length > customQuestionCount) {
                questions = questions.slice(0, customQuestionCount);
            }

            setQuizQuestions(questions);
            setIsQuizLoading(false);
        } else {
            throw new Error("Dữ liệu rỗng bất thường");
        }
      } catch (err: any) {
        console.error("Quiz Error", err);
        setQuizError("Lỗi Hệ Thống Sinh Đề AI: " + (err.message || "Vui lòng thử lại"));
        setActiveTab("study");
        setIsQuizLoading(false);
        setTimeout(() => setQuizError(null), 4000);
      }
  };

  const generateMockExam = async () => {
      if (selectedExamDecks.length === 0) {
        setQuizError("Vui lòng chọn ít nhất 1 bộ thẻ để thi!");
        setTimeout(() => setQuizError(null), 3000);
        return;
      }
      
      const allDecks = store.getDecks();
      const targetDecks = allDecks.filter(d => selectedExamDecks.includes(d.id));
      
      if (user && user.role === "student") {
        triggerAICooldown(user);
      }
      setIsQuizLoading(true);
      setActiveTab("quiz");
      setQuizError(null);
      setQuizFinished(false);
      setQuizScore(0);
      setQuizCurrentIndex(0);
      setSelectedOption(null);
      setIsAnswerRevealed(false);
      
      try {
        const idToken = await auth.currentUser?.getIdToken() || "";
        const res = await safeRequest("/api/exam/generate", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
              "x-user-id": user?.id || "",
              "x-user-role": user?.role || "",
              "x-user-is-pro": user?.isPro ? "true" : "false"
            },
            body: JSON.stringify({
                decks: targetDecks,
                examType: "multiple_choice",
                count: examQuestionCount
            })
        });
        
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 429) {
            throw new Error(data.error || "Bạn đang gọi AI quá nhanh. Hãy chờ 20s nạp năng lượng!");
          }
          throw new Error(data.error || "Lỗi kết nối từ Hệ thống Gemini");
        }
        if (data.result) {
            let questions = parseRobustJsonArray(data.result);

            // Tầng xử lý tráo bài bằng thuật toán Fisher-Yates (Frontend Guardrail)
            questions = questions.map((q: any) => {
               if (q.options && Array.isArray(q.options) && typeof q.correctAnswerIndex === 'number') {
                   const correctOption = q.options[q.correctAnswerIndex];
                   if (correctOption) {
                       const arr = [...q.options];
                       for (let i = arr.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [arr[i], arr[j]] = [arr[j], arr[i]];
                       }
                       q.options = arr;
                       q.correctAnswerIndex = arr.indexOf(correctOption);
                   }
               }
               return q;
            });

            // Guardrail triệt để cho Mock Exam
            if (questions.length > examQuestionCount) {
                questions = questions.slice(0, examQuestionCount);
            }

            setQuizQuestions(questions);
            setIsQuizLoading(false);
        } else {
            throw new Error("Dữ liệu rỗng bất thường");
        }
      } catch (err: any) {
        console.error("Exam Generate Error", err);
        setQuizError("Lỗi Hệ Thống Sinh Đề AI: " + (err.message || "Vui lòng thử lại"));
        setActiveTab("mock_exam_setup");
        setIsQuizLoading(false);
        setTimeout(() => setQuizError(null), 4000);
      }
  };

  const currentQ = quizQuestions[quizCurrentIndex];

  const getCorrectIndex = (q: QuizQuestion) => {
    if (q.correctAnswerIndex !== undefined) return q.correctAnswerIndex;
    if (q.correctIndex !== undefined) return q.correctIndex;
    if (q.correctAnswer) {
        const charCode = q.correctAnswer.charCodeAt(0);
        if (charCode >= 65 && charCode <= 68) return charCode - 65; // A=0, B=1...
    }
    return 0; // fallback
  };

  const handleOptionClick = (idx: number) => {
    if (isAnswerRevealed) return;
    setSelectedOption(idx);
    setIsAnswerRevealed(true);
    
    const isCorrect = idx === getCorrectIndex(currentQ);
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }

    if (currentQ.cardId && currentQ.deckId) {
       store.updateCardMastery(currentQ.deckId, currentQ.cardId, isCorrect);
       // Phân tán ra UI reload state
       setForceRender(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
      if (quizCurrentIndex + 1 < quizQuestions.length) {
          setQuizCurrentIndex(prev => prev + 1);
          setSelectedOption(null);
          setIsAnswerRevealed(false);
      } else {
          setQuizFinished(true);
      }
  };

  // Mock trend data
  const basePoints = user?.points || 0;
  
  const getTrendData = () => {
    if (chartPeriod === "30_days") {
       return Array.from({length: 15}).map((_, i) => ({
           day: `Day ${i * 2 + 1}`,
           points: Math.max(0, basePoints - (15 - i) * 12)
       })).concat([{ day: 'Today', points: basePoints }]);
    } else if (chartPeriod === "all_time") {
       return Array.from({length: 10}).map((_, i) => ({
           day: `Month ${i + 1}`,
           points: Math.max(0, basePoints - (10 - i) * 30)
       })).concat([{ day: 'Today', points: basePoints }]);
    } else { // 7 days
       return [
        { day: 'Day 1', points: Math.max(0, basePoints - 45) },
        { day: 'Day 2', points: Math.max(0, basePoints - 38) },
        { day: 'Day 3', points: Math.max(0, basePoints - 29) },
        { day: 'Day 4', points: Math.max(0, basePoints - 15) },
        { day: 'Day 5', points: Math.max(0, basePoints - 8) },
        { day: 'Day 6', points: Math.max(0, basePoints - 3) },
        { day: 'Today', points: basePoints },
      ];
    }
  };
  const trendData = React.useMemo(() => getTrendData(), [chartPeriod, basePoints]);
  // Streak Data for the last 30 days
  const getStreakData = React.useCallback(() => {
     return Array.from({length: 30}).map((_, i) => ({
         day: `Day ${i + 1}`,
         streak: Math.max(0, (user?.streak || 0) - (29 - i))
     }));
  }, [user?.streak]);
  const streakData = React.useMemo(() => getStreakData(), [getStreakData]);

  const CustomStreakTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="card-3d p-4 rounded-2xl">
          <p className="font-medium text-xs tracking-widest uppercase text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <p className="font-display font-bold text-2xl text-orange-600 dark:text-orange-500 leading-none">
              {payload[0].value}
            </p>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">days</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calendar Days Calculation for tracking active study days
  const calendarYear = currentMonth.getFullYear();
  const calendarMonth = currentMonth.getMonth(); // 0-indexed month
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sunday, 1 is Monday ...
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Translate month names for visual display
  const monthNamesVi = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
  ];
  const calendarMonthLabel = `${monthNamesVi[calendarMonth]} ${calendarYear}`;

  // Build active study days mapping
  const activeStudyDaysSet = new Set<string>();
  if (user) {
    // Collect from actual reviewed items
    store.getReviewHistory(user.id).forEach(record => {
      const d = new Date(record.timestamp);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      activeStudyDaysSet.add(dateStr);
    });

    // We also map streak backward so the student sees their streak beautifully mapped on the calendar!
    const userStreak = user.streak || 0;
    for (let s = 0; s < userStreak; s++) {
      const d = new Date();
      d.setDate(d.getDate() - s);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      activeStudyDaysSet.add(dateStr);
    }
  }

  const navigatePrevMonth = () => {
    setCurrentMonth(new Date(calendarYear, calendarMonth - 1, 1));
  };
  const navigateNextMonth = () => {
    setCurrentMonth(new Date(calendarYear, calendarMonth + 1, 1));
  };


  if (!user) return <DashboardSkeleton />;
  if (isInitialLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-in fade-in pb-12 relative w-full max-w-full overflow-x-hidden">
      <OnboardingTour onComplete={() => {
        const hasRun = localStorage.getItem("hasRunTutorial");
        if (hasRun !== "true") {
          setShowTutorial(true);
        }
      }} />
      {/* Thêm Toast Thông báo Toast Thành Công */}
      {joinStatus && (
          <div className="fixed top-20 right-4 z-50 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right-8 font-bold flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" />
              {joinStatus}
          </div>
      )}

      {/* Thêm Toast Thông báo lỗi AI */}
      {quizError && (
          <div className="fixed top-20 right-4 z-50 bg-red-500 text-white px-6 py-4 rounded-xl shadow-2xl animate-in slide-in-from-right-8 font-bold flex items-center gap-3">
              <XCircle className="w-6 h-6" />
              {quizError}
          </div>
      )}

      {/* Banner chế độ xem Admin */}
      {user && (user.role === "admin" || user.role === "Admin" || user.role === "teacher") && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Bạn đang ở Student View (Học Viên)</span>. Các thay đổi và học tập thử nghiệm sẽ mô phỏng giống học sinh để bạn dễ kiểm thử.
            </div>
          </div>
          <button 
            onClick={() => {
              sessionStorage.setItem('isAdminMode', 'true');
              window.location.href = '/teacher';
            }}
            className="px-4 py-2 bg-amber-500 hover:bg-yellow-500 text-black font-extrabold text-xs rounded-lg transition-all duration-300 shadow-md whitespace-nowrap cursor-pointer animate-pulse"
          >
            Quay lại Admin View ⚡
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
      {activeTab !== "quiz" && (
      <motion.section 
        key="header-stats"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
        transition={{ duration: 0.3 }}
        className="glass p-4 sm:p-8 rounded-2xl relative overflow-hidden"
        data-tour="step-1"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Target className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 mb-2">Salve, {user?.name}</h2>
          <p className="font-roman text-lg italic opacity-80 mb-6 min-h-[3.5rem]">{quote}</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-4 py-2 rounded-lg font-bold flex items-center gap-2 relative">
              <TrendingUp className="w-5 h-5" />
              Weekly Points: <AnimatedCounter value={user?.points || 0} />
            </div>
            
            <div className={cn("px-4 py-2 rounded-lg font-bold flex items-center gap-2", user?.streak && user.streak > 0 ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 animate-pulse" : "bg-orange-500/20 text-orange-700 dark:text-orange-400")}>
              <Flame className={cn("w-5 h-5", user?.streak && user.streak > 0 ? "fill-current" : "")} />
              {user?.streak || 0} Day Streak 🔥
            </div>

            <button
               onClick={handleBuyFreeze}
               disabled={user?.streakFreeze || (user ? user.points < 50 : true)}
               title="Streak Freeze (Bảo vệ chuỗi ngày học) - Tốn 50 pts"
               className={cn("px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition hover:scale-105", user?.streakFreeze ? "bg-blue-500 text-white" : "bg-blue-500/20 text-blue-700 dark:text-blue-400 opacity-60 hover:opacity-100 disabled:opacity-30 disabled:hover:scale-100")}
            >
              <Snowflake className={cn("w-5 h-5", user?.streakFreeze ? "animate-pulse" : "")} />
              {user?.streakFreeze ? "Đã Kích Hoạt" : "Trang Bị (50 pts)"}
            </button>

            <div id="trigger-quiz-from-dashboard">
              <MockExamButton user={user} onClick={() => setActiveTab("mock_exam_setup")} />
            </div>
          </div>
        </div>
      </motion.section>
      )}


      {activeTab !== "quiz" && (
      <motion.div 
        key="tab-nav"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex gap-2 md:gap-4 mb-8 p-1.5 md:p-2 bg-stone-200/50 dark:bg-black/30 backdrop-blur-xl rounded-[2rem] md:rounded-full overflow-x-auto hide-scrollbar ring-1 ring-white/20 dark:ring-white/5"
      >
        {[
          { id: "study", label: "Góc Học Tập", icon: BookOpen, bubble: remindLaterCount > 0 },
          { id: "all_sets", label: "Bộ Học", icon: Library },
          { id: "create_deck", label: "Tạo Bộ Thẻ", icon: Plus },
          { id: "ranking", label: "Xếp Hạng", icon: MarcusAureliusIcon },
          { id: "skill_tree", label: "Lộ Trình", icon: Network },
          { id: "cyberpunk", label: "Cinematic Room", icon: Sparkles },
          { id: "achievements", label: "Thành Tựu", icon: Award },
          { id: "history", label: "Lịch Sử", icon: Activity },
          { id: "profile", label: "Hồ Sơ", icon: User },
          { id: "settings", label: "Cài Đặt", icon: Settings },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "relative px-4 py-2 font-bold text-sm md:text-base rounded-full transition-colors flex items-center justify-center gap-2 whitespace-nowrap outline-none flex-shrink-0",
                isActive ? "text-stone-900 dark:text-stone-100" : "text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
              )}
            >
              {isActive && (
                <div
                  className="absolute inset-0 bg-white/80 dark:bg-white/10 backdrop-blur-md rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_15px_rgba(255,255,255,0.05)] border border-white/50 dark:border-white/5 animate-in fade-in zoom-in-95 duration-200"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className={cn("w-4 h-4 md:w-5 md:h-5", isActive ? "text-amber-500" : "opacity-70")} />
                {tab.label}
                {tab.bubble && (
                  <span className="absolute -top-2 -right-3 w-2.5 h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
                )}
              </span>
            </button>
          );
        })}
      </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
      {activeTab === "achievements" && (
        <motion.div 
            key="achievements-tab"
            id="achievements-showcase"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
         >
             <StudentBadges points={user?.points || 0} streak={user?.streak || 0} />
         </motion.div>
       )}


      {activeTab === "quiz" && (
          <ErrorBoundary fallback={<div className="p-8 bg-red-100/50 rounded-lg text-center dark:bg-red-900/10">Bài thi tạm thời không khả dụng do lỗi hệ thống AI. Vui lòng quay lại sau.</div>}>
          <motion.div 
            key="quiz-tab"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            transition={{ duration: 0.4 }}
          >
             {isQuizLoading ? (
                 <div className="glass p-16 rounded-2xl flex flex-col items-center justify-center text-center space-y-6">
                     <Loader2 className="w-16 h-16 animate-spin text-yellow-500" />
                     <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-yellow-600 dark:text-yellow-400">Đang khởi tạo bài kiểm tra năng lực...</h2>
                     <p className="opacity-70 max-w-lg italic font-serif">Chuyên gia khảo thí AI đang phân tích dữ liệu hổng kiến thức của bạn để tạo 15 câu trắc nghiệm thực chiến.</p>
                     <div className="font-mono text-xl bg-stone-200/60 dark:bg-zinc-800/50 px-6 py-2 rounded-full border border-amber-600/20 dark:border-amber-500/30 font-bold text-yellow-600">
                         <QuizCooldownTimer user={user} />
                     </div>
                 </div>
             ) : quizFinished ? (
                 <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center text-center space-y-6">
                     <Trophy className="w-24 h-24 text-yellow-500 mb-4" />
                     <h2 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Tổng kết Bài Test</h2>
                     <div className="text-6xl font-mono font-bold text-yellow-600 dark:text-yellow-400 my-4">
                         {quizScore} <span className="opacity-40 text-4xl">/ {quizQuestions.length}</span>
                     </div>
                     <p className="font-roman text-xl italic opacity-80 border-l-4 border-yellow-500 pl-4 py-2">"{quizQuote}"</p>
                     
                     <div className="pt-8">
                         <button onClick={() => { setActiveTab("study"); setQuizQuestions([]); }} className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition flex items-center gap-2">
                             <ArrowLeft className="w-5 h-5" />
                             Về trang chủ Dashboard
                         </button>
                     </div>
                 </div>
             ) : (
                 <div className="glass p-8 md:p-12 rounded-2xl space-y-8 max-w-4xl mx-auto">
                     <div className="flex justify-between items-center border-b border-amber-600/20 dark:border-amber-500/30 pb-4">
                        <button onClick={() => { setActiveTab("study"); setQuizQuestions([]); }} className="opacity-60 hover:opacity-100 transition flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" /> Thoát Bài Test
                        </button>
                        <div className="font-mono bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 px-4 py-1.5 rounded-full font-bold">
                            Câu hỏi {quizCurrentIndex + 1} / {quizQuestions.length}
                        </div>
                     </div>
                     
                     <div className="min-h-[120px] flex items-center justify-center py-6">
                         <h3 className="text-2xl md:text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 leading-relaxed text-center">
                             <div className="markdown-body inline-block"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{currentQ?.question || ""}</ReactMarkdown></div>
                         </h3>
                     </div>

                     <div className="grid md:grid-cols-2 gap-4">
                         {currentQ?.options.map((opt, i) => {
                             let optClass = "border border-amber-600/20 dark:border-amber-500/30 hover:border-yellow-500 hover:bg-yellow-500/5 bg-stone-200/60 dark:bg-zinc-800/50 opacity-90 hover:opacity-100";
                             let OptIcon = null;
                             
                             if (isAnswerRevealed) {
                                 const cIdx = getCorrectIndex(currentQ);
                                 if (i === cIdx) {
                                     optClass = "bg-green-500/20 border-green-500 text-green-900 dark:text-green-300 font-bold shadow-md ring-2 ring-green-500 scale-[1.02] transition-transform";
                                     OptIcon = <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 absolute right-4" />;
                                 } else if (i === selectedOption) {
                                     optClass = "bg-red-500/10 border-red-500/50 text-red-700 dark:text-red-400 opacity-60";
                                     OptIcon = <XCircle className="w-6 h-6 text-red-500/50 absolute right-4" />;
                                 } else {
                                     optClass = "border-amber-600/20 dark:border-amber-500/30 opacity-40 grayscale";
                                 }
                             } else if (i === selectedOption) {
                                 optClass = "ring-2 ring-yellow-500 bg-yellow-500/10 scale-[1.02] transition-transform font-bold";
                             }

                             return (
                                 <button 
                                    key={i}
                                    disabled={isAnswerRevealed}
                                    onClick={() => handleOptionClick(i)}
                                    className={cn("relative p-6 rounded-xl text-left transition-all duration-300 flex items-center md:text-lg", optClass, isAnswerRevealed ? "cursor-default" : "cursor-pointer")}
                                 >
                                    <span className="font-bold opacity-50 mr-4 font-mono">{String.fromCharCode(65 + i)}.</span>
                                    <div className="markdown-body pr-8"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{opt}</ReactMarkdown></div>
                                    {OptIcon}
                                 </button>
                             );
                         })}
                     </div>
                     
                     {isAnswerRevealed && (
                         <div className="pt-8 border-t border-amber-600/20 dark:border-amber-500/30 animate-in fade-in slide-in-from-bottom-4 flex flex-col md:flex-row items-center justify-between gap-6">
                             <div className="flex-1 bg-stone-200/60 dark:bg-zinc-800/50 p-4 rounded-xl border border-amber-600/20 dark:border-amber-500/30">
                                 <div className="flex items-center justify-between mb-2 gap-4">
                                     <span className="font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                                         <Sparkles className="w-4 h-4" /> AI Giải Thích:
                                     </span>
                                     <button 
                                         onClick={() => {
                                             const explanationText = currentQ?.explanation || "Đáp án đúng là " + String.fromCharCode(65 + getCorrectIndex(currentQ));
                                             window.dispatchEvent(new CustomEvent('trigger-agent3', { 
                                                 detail: { 
                                                     message: `Hãy phân tích, giải thích chi tiết, đưa ra ví dụ và các thông tin mở rộng sâu hơn cho khái niệm sau: "${explanationText}"`, 
                                                     context: `Bài thi trắc nghiệm:\nCâu hỏi: ${currentQ?.question || ''}\nĐáp án: ${currentQ?.options?.join(' | ') || ''}\nGiải thích gốc: ${explanationText}`
                                                 } 
                                             }));
                                         }}
                                         className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                         title="Agent 3 sẽ giúp bạn đào sâu kiến thức này"
                                     >
                                         <Bot className="w-3.5 h-3.5" />
                                         Tìm hiểu chuyên sâu với Agent 3
                                         <span className="absolute inset-0 rounded-full bg-blue-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                                     </button>
                                 </div>
                                 <p className="font-serif italic opacity-90">{currentQ?.explanation || "Đáp án đúng là " + String.fromCharCode(65 + getCorrectIndex(currentQ))}</p>
                             </div>
                             
                             <button onClick={handleNextQuestion} className="relative overflow-hidden group bg-yellow-500 hover:bg-yellow-600 text-black px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 shrink-0 w-full md:w-auto before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700">
                                 {quizCurrentIndex + 1 < quizQuestions.length ? "Câu tiếp theo" : "Xem kết quả"}
                                 <ArrowRight className="w-5 h-5" />
                             </button>
                         </div>
                     )}
                 </div>
             )}
          </motion.div>
          </ErrorBoundary>
      )}
      </AnimatePresence>

      {activeTab === "mock_exam_setup" && (
          <ErrorBoundary fallback={<div className="p-8 bg-red-100/50 rounded-lg text-center dark:bg-red-900/10">Trình tạo bài thi phụ tạm thời không khả dụng.</div>}>
          <motion.div 
            key="mock-exam-setup-tab"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="glass p-8 md:p-12 rounded-2xl max-w-4xl mx-auto space-y-8"
          >
              <div className="text-center space-y-4">
                  <BrainCircuit className="w-16 h-16 text-yellow-500 mx-auto" />
                  <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Tạo Mock Exam với AI</h2>
                  <p className="opacity-70 max-w-lg mx-auto italic font-serif">Chọn 1-3 bộ thẻ (Decks) để AI tự động cấu trúc bài kiểm tra đánh giá năng lực của bạn.</p>
              </div>

              <div className="space-y-4">
                  <h3 className="font-bold text-lg">1. Chọn bộ thẻ (Tối đa 3)</h3>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {decks.map(deck => {
                          const isSelected = selectedExamDecks.includes(deck.id);
                          return (
                              <button 
                                key={deck.id}
                                onClick={() => {
                                    if (isSelected) {
                                        setSelectedExamDecks(prev => prev.filter(id => id !== deck.id));
                                    } else {
                                        if (selectedExamDecks.length < 3) {
                                            setSelectedExamDecks(prev => [...prev, deck.id]);
                                        }
                                    }
                                }}
                                className={cn("p-4 rounded-xl text-left border transition-all text-sm font-bold flex items-center justify-between", isSelected ? "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : "border-amber-600/20 dark:border-amber-500/30 opacity-60 hover:opacity-100 hover:border-yellow-500/50 bg-stone-200/60 dark:bg-zinc-800/50")}
                              >
                                  <span className="truncate pr-2">{deck.title}</span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-yellow-500" />}
                              </button>
                          );
                      })}
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="font-bold text-lg">2. Số lượng câu hỏi</h3>
                  <div className="flex gap-4">
                      {[5, 10, 15, 20].map(count => (
                          <button
                            key={count}
                            onClick={() => setExamQuestionCount(count)}
                            className={cn("px-6 py-2 rounded-xl font-bold border transition-all", examQuestionCount === count ? "border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" : "border-amber-600/20 dark:border-amber-500/30 opacity-60 hover:opacity-100 bg-stone-200/60 dark:bg-zinc-800/50")}
                          >
                              {count} câu
                          </button>
                      ))}
                  </div>
              </div>

              <div className="pt-8 flex justify-between items-center border-t border-amber-600/20 dark:border-amber-500/30">
                  <button onClick={() => setActiveTab("study")} className="font-bold opacity-60 hover:opacity-100 transition flex items-center gap-2">
                       <ArrowLeft className="w-4 h-4" /> Quay lại
                  </button>
                  <button 
                      onClick={generateMockExam}
                      disabled={selectedExamDecks.length === 0}
                      className="px-8 py-3 rounded-xl bg-yellow-500 text-black font-bold flex items-center gap-2 shadow-lg hover:bg-yellow-600 disabled:opacity-50 transition transform hover:scale-105"
                  >
                      <Sparkles className="w-5 h-5" />
                      Sinh Bài Thi (Mock Exam)
                  </button>
              </div>
          </motion.div>
          </ErrorBoundary>
      )}

      {activeTab === "skill_tree" && (
          <motion.div 
            key="skill-tree-tab"
            id="skill-tree-viewport"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
              <div className="text-center space-y-4 mb-8">
                  <Network className="w-16 h-16 text-yellow-500 mx-auto" />
                  <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Cây Kỹ Năng & Lộ Trình</h2>
                  <p className="opacity-70 max-w-lg mx-auto italic font-serif">Khám phá vũ trụ kiến thức. Mở khóa và vươn tới sự thông tuệ đỉnh cao (Eudaimonia).</p>
              </div>

              <ErrorBoundary fallback={<div className="p-8 bg-red-100/50 rounded-lg text-center dark:bg-red-900/10">Bản đồ kỹ năng tạm thời không khả dụng.</div>}>
                  <SkillTreeGraph decks={decks} />
              </ErrorBoundary>
          </motion.div>
      )}

      {activeTab === "study" && (
        <motion.div 
          key="study-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 xl:grid-cols-3 gap-8"
        >
          <section className="xl:col-span-2 space-y-6">
            
            {/* GLOBAL SERVER BROADCAST BANNERS (48 HOURS PERSISTENT) */}
            {broadcasts.length > 0 && (
              <div className="space-y-4">
                {broadcasts.map((b) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: -15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="relative overflow-hidden rounded-2xl p-5 md:p-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 dark:from-red-950/70 dark:via-rose-950/70 dark:to-yellow-950/40 border border-red-500/40 shadow-xl shadow-red-500/5"
                  >
                    {/* Animated glowing bg pulse */}
                    <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                    <div className="absolute -top-12 -right-12 p-4 opacity-15 pointer-events-none text-white">
                      <Bell className="w-48 h-48 animate-bounce text-white/50" />
                    </div>
                    
                    <div className="relative z-10 flex flex-col gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 dark:bg-red-500/30 text-white border border-white/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping inline-block" />
                          📢 THÔNG BÁO TOÀN SERVER
                        </span>
                        <span className="text-[10px] font-bold text-white/95">
                          Gửi bởi <strong className="font-extrabold text-yellow-350">{b.userName}</strong> (Admin)
                        </span>
                        <span className="text-[9px] font-mono text-white/80 shrink-0">
                          {new Date(b.timestamp).toLocaleString('vi-VN', { 
                            month: 'numeric', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      
                      <div className="text-white text-xs leading-relaxed overflow-hidden markdown-body pr-4 font-medium max-w-full drop-shadow-xs">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {b.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* DAILY QUEST BANNER */}
            <motion.div 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               className="relative overflow-hidden rounded-2xl p-6 md:p-8 bg-gradient-to-r from-blue-700 to-indigo-600 shadow-xl"
            >
               <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                  <Flame className="w-40 h-40" />
               </div>
               <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-white flex-1 min-w-0">
                     <h3 className="text-2xl font-display font-bold flex items-center flex-wrap gap-2">
                        <Flame className="w-6 h-6 shrink-0" /> Nhiệm vụ hôm nay (Daily Quest)
                     </h3>
                     <p className="opacity-90 max-w-md">
                        Lộ trình thông minh tự động trộn 20% thẻ mới và 80% thẻ ôn tập được gợi ý bằng thuật toán Spaced Repetition.
                     </p>
                  </div>
                  <button 
                     disabled={isStartingQuest}
                     onClick={handleStartDailyQuest}
                     className="shrink-0 bg-white text-indigo-700 hover:bg-stone-100 font-bold px-6 py-3 rounded-xl shadow-lg transition hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                     {isStartingQuest ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />} 
                     Bắt đầu Quests
                  </button>
               </div>
            </motion.div>

            {/* CO-STUDY ROOM BANNER CTA */}
            <motion.div 
               id="costudy-portal-link"
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               className="relative overflow-hidden rounded-2xl p-6 md:p-8 bg-gradient-to-r from-amber-600 to-yellow-500 shadow-xl"
            >
               <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                  <Users className="w-40 h-40" />
               </div>
               <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-white flex-1 min-w-0">
                     <h3 className="text-2xl font-display font-bold flex items-center flex-wrap gap-2">
                        <Users className="w-6 h-6 shrink-0" /> Phòng Tự Học Chung
                     </h3>
                     <p className="opacity-90 max-w-md">
                        Cùng tập trung Pomodoro với các bạn học khác trong không gian trực tuyến.
                     </p>
                  </div>
                  <Link 
                     to="/co-study"
                     className="shrink-0 bg-white text-amber-700 hover:bg-stone-100 font-bold px-6 py-3 rounded-xl shadow-lg transition hover:scale-105 active:scale-95 text-center flex items-center justify-center gap-2"
                  >
                     <Play className="w-5 h-5 fill-current" /> Tham Gia Ngay
                  </Link>
               </div>
            </motion.div>

            <div className="flex justify-between items-center flex-wrap gap-4">
              <h3 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 flex items-center flex-wrap gap-2">
                <BookOpen className="w-6 h-6 text-yellow-500 shrink-0" /> Your Studies
                {remindLaterCount > 0 && (
                  <button 
                    onClick={() => setShowRemindLaterModal(true)}
                    className="ml-2 text-xs font-bold text-white bg-blue-500 px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 cursor-pointer border-none hover:bg-blue-600 hover:shadow-lg focus:outline-none"
                  >
                    <Bell className="w-3.5 h-3.5 animate-pulse" />
                    {remindLaterCount} Thẻ nhắc nhở
                  </button>
                )}
              </h3>
              
              <button 
                onClick={toggleNotifications}
                className={cn("flex flex-1 md:flex-none justify-between items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition", notificationsEnabled ? "bg-stone-200/80 dark:bg-zinc-800/80 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30" : "bg-stone-200/40 dark:bg-zinc-800/40 opacity-70 hover:opacity-100 border border-transparent")}
              >
                <div className="flex items-center gap-2">
                  {notificationsEnabled ? <BellRing className="w-4 h-4 animate-pulse" /> : <BellOff className="w-4 h-4" />}
                  <span>{notificationsEnabled ? "Nhắc nhở đang bật" : "Nhắc nhở đang tắt"}</span>
                </div>
                {notificationsEnabled && pendingCardsCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-md animate-in zoom-in-95">{pendingCardsCount} pending</span>
                )}
              </button>
            </div>

            {deckWithLowestMastery && (() => {
              const totalCards = deckWithLowestMastery.cards?.length || 0;
              const avgMastery = totalCards > 0 ? Math.round(
                deckWithLowestMastery.cards.reduce((sum: number, c: any) => sum + (c.mastery || 0), 0) / totalCards
              ) : 0;
              
              const weakCardsCount = deckWithLowestMastery.cards?.filter(
                (c: any) => {
                    if (c.isHard) return true;
                    if (c.isNewCard === true || c.isNewCard === undefined && c.mastery === 0 && (c.repetitionCount === undefined || c.repetitionCount === 0)) return false;
                    return (c.mastery || 0) < 50;
                }
              ).length || 0;

              // Stoic quote adaptive advice
              let stoicAdvice = "The impediment to action advances action. What stands in the way becomes the way. - Marcus Aurelius";
              if (avgMastery < 30) {
                stoicAdvice = "Hãy can đảm đối diện với phần kiến thức thử thách nhất. Khó khăn chính là con đường tôi luyện trí tuệ vững vàng. - Marcus Aurelius";
              } else if (avgMastery < 60) {
                stoicAdvice = "Sự tiến bộ bền bỉ mỗi ngày vượt trội hơn sự bộc phát nhất thời. Một chút nỗ lực hôm nay sẽ định hình khả năng ngày mai. - Seneca";
              } else {
                stoicAdvice = "Bạn đã có nền tảng khá tốt ở bộ thẻ này. Hãy thực hiện bước chuyển hóa tiếp theo để đạt đến mức độ thông thạo tuyệt đối. - Epictetus";
              }

              return (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50/90 via-stone-100/40 to-stone-200/20 dark:from-zinc-900/60 dark:via-zinc-900/30 dark:to-zinc-950/20 border-2 border-amber-500/20 dark:border-amber-500/25 p-6 shadow-xl backdrop-blur-md mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  {/* Subtle background glow */}
                  <div className="absolute -right-16 -top-16 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
                  <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-yellow-500/5 blur-3xl rounded-full pointer-events-none" />

                  <div className="space-y-4 flex-1 min-w-0">
                    {/* Header line with badge */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/15 dark:from-amber-400/15 dark:to-yellow-400/5 text-amber-800 dark:text-amber-400 text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm border border-amber-500/20 animate-pulse">
                        <BrainCircuit className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        Smart Study Suggestion
                      </span>
                      <span className="text-[11px] opacity-70 font-medium font-mono text-stone-600 dark:text-stone-400 bg-stone-300/40 dark:bg-zinc-800/40 px-2.5 py-0.5 rounded-md">
                        CẦN ÔN TẬP NHẤT LÚC NÀY
                      </span>
                    </div>

                    {/* Content body */}
                    <div className="space-y-2">
                      <h4 className="text-xl sm:text-2xl font-display font-black text-stone-900 dark:text-stone-50 tracking-tight break-all sm:break-words">
                        {deckWithLowestMastery.title}
                      </h4>
                      
                      {/* Stoic adaptive quote block */}
                      <p className="text-sm italic text-stone-600 dark:text-stone-400 font-serif border-l-2 border-amber-500/50 pl-3 py-0.5 opacity-90 max-w-2xl leading-relaxed">
                        "{stoicAdvice}"
                      </p>
                    </div>

                    {/* Info Metrics dashboard row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-amber-500/10 dark:border-amber-500/15 max-w-xl">
                      {/* Metric 1 */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-mono tracking-wider opacity-50 block truncate">Mức thông thạo</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-mono text-yellow-600 dark:text-yellow-400">
                            {avgMastery}%
                          </span>
                          <span className="text-[10px] opacity-60">/ 100</span>
                        </div>
                      </div>

                      {/* Metric 2 */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-mono tracking-wider opacity-50 block truncate">Tổng số thẻ</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-mono text-stone-800 dark:text-stone-200">
                            {totalCards}
                          </span>
                          <span className="text-[10px] opacity-60">thẻ</span>
                        </div>
                      </div>

                      {/* Metric 3 */}
                      <div className="space-y-0.5 col-span-2 sm:col-span-1 min-w-0">
                        <span className="text-[10px] uppercase font-mono tracking-wider opacity-50 block truncate">Thẻ yếu cần cải thiện</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold font-mono text-red-500 dark:text-red-400">
                            {weakCardsCount}
                          </span>
                          <span className="text-[10px] opacity-60">thẻ học</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* One-Click CTA Area */}
                  <div className="flex flex-col items-stretch sm:items-end justify-center shrink-0 w-full md:w-auto">
                    <Link
                      to={`/study/${deckWithLowestMastery.id}`}
                      className="group relative overflow-hidden bg-black dark:bg-white text-white dark:text-black font-extrabold py-4 px-8 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-amber-500/10 dark:hover:shadow-white/5 hover:scale-[1.03] active:scale-95 text-base shrink-0 border border-black/10 dark:border-white/10"
                    >
                      {/* Animated gradient strip */}
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                      
                      <Play className="w-5 h-5 fill-current ml-0.5 animate-pulse text-amber-500 dark:text-amber-500 group-hover:scale-110 transition-transform" />
                      <span>Học ngay 🚀</span>
                    </Link>
                  </div>
                </motion.div>
              );
            })()}

            <div className="flex items-center justify-between mt-6 mb-3">
               <h4 className="font-display font-black text-lg text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
                  <BookOpen className="w-5 h-5 text-yellow-500" /> Bộ Học Tập Của Bạn
               </h4>
               <div className="flex gap-1 p-0.5 bg-stone-200/60 dark:bg-zinc-900 rounded-xl border border-stone-300/40 dark:border-zinc-800/45 shrink-0">
                 <button
                   onClick={() => setViewMode("recent")}
                   className={cn(
                     "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-none focus:outline-none transition-all cursor-pointer",
                     viewMode === "recent"
                       ? "bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-sm font-black"
                       : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-250 bg-transparent"
                   )}
                 >
                   Gần đây
                 </button>
                 <button
                   onClick={() => setViewMode("all")}
                   className={cn(
                     "px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border-none focus:outline-none transition-all cursor-pointer",
                     viewMode === "all"
                       ? "bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-sm font-black"
                       : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-250 bg-transparent"
                   )}
                 >
                   Tất cả ({decks.length})
                 </button>
               </div>
            </div>

            {viewMode === "recent" ? (
               <DeckList decks={decks.slice(0, 4)} showSearch={false} />
            ) : (
               <div className="glass p-4 rounded-2xl border border-stone-200/50 dark:border-zinc-800/50 animate-in fade-in duration-300">
                  <DeckList decks={decks} showSearch={true} groupBySubject={true} onCategoryQuiz={(subject, subjectDecks) => setActiveQuizSetup({ subject, decks: subjectDecks })} />
               </div>
            )}

            <div className="mt-8 pt-8 border-t border-amber-600/20 dark:border-amber-500/30">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h3 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-yellow-500" /> Weekly Mastery Trend
                </h3>
                <div className="flex items-center gap-2">
                  <select 
                    value={chartPeriod} 
                    onChange={(e) => setChartPeriod(e.target.value as any)}
                    className="bg-stone-200/60 dark:bg-zinc-800/50 border border-amber-600/20 dark:border-amber-500/30 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none cursor-pointer"
                  >
                    <option value="7_days">Last 7 Days</option>
                    <option value="30_days">Last 30 Days</option>
                    <option value="all_time">All Time</option>
                  </select>
                  <button 
                    onClick={() => setIsChartExpanded(true)}
                    className="p-2 bg-stone-200/60 dark:bg-zinc-800/50 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium opacity-80 hover:opacity-100"
                    title="Phóng to biểu đồ"
                  >
                    <Maximize2 className="w-4 h-4" /> Phóng to
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-8">
                {/* Trend Chart */}
                <div className="glass p-6 rounded-xl w-full h-[28rem] md:h-[32rem] relative">
                  <div className="mb-2 text-center text-sm font-bold opacity-70">
                    Mastery Points Trend
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke="currentColor" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        opacity={0.7}
                      />
                      <YAxis 
                        stroke="currentColor"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        opacity={0.7}
                        width={40}
                      />
                      <Tooltip 
                        content={<CustomTooltip />}
                        cursor={{ stroke: 'rgba(234,179,8,0.2)', strokeWidth: 2 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="points" 
                        stroke="#eab308" 
                        strokeWidth={3}
                        dot={{ fill: '#eab308', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Streak Chart */}
                <div className="glass p-6 rounded-xl w-full h-[28rem] md:h-[32rem] relative">
                  <div className="mb-2 text-center text-sm font-bold opacity-70">
                    30-Day Streak Progress
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={streakData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="day" 
                        stroke="currentColor" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        opacity={0.7}
                        hide={true} // Cleaner look since it's 30 days
                      />
                      <YAxis 
                        stroke="currentColor"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        opacity={0.7}
                        width={40}
                      />
                      <Tooltip 
                        content={<CustomStreakTooltip />}
                        cursor={{ stroke: 'rgba(249,115,22,0.2)', strokeWidth: 2 }}
                      />
                      <Line 
                        type="stepAfter" 
                        dataKey="streak" 
                        stroke="#f97316" 
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, stroke: 'white', strokeWidth: 2, fill: '#f97316' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>
                



          <aside className="space-y-8">
            <div id="export-actions-card">
              <ExportStudyReport 
                user={user}
                decks={decks}
                studyHours={studyHours}
                studyMinutes={studyMinutes}
                dailyGoal={dailyGoal}
                dailyReviewed={dailyReviewed}
              />
            </div>

            <section className="glass p-6 rounded-xl">
              <h3 className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" /> Mục tiêu Ngày
              </h3>
              <div className="flex flex-col items-center">
                 <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                       <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="opacity-10 text-blue-500" />
                       <circle 
                         cx="50" cy="50" r="40" 
                         fill="transparent" 
                         stroke="#3b82f6" 
                         strokeWidth="8" 
                         strokeDasharray={251.2} 
                         strokeDashoffset={251.2 - (Math.min(dailyReviewed / dailyGoal, 1) * 251.2)} 
                         strokeLinecap="round" 
                         className="transition-all duration-1000 ease-out"
                       />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                       <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">{dailyReviewed}</span>
                       <span className="text-xs opacity-60">/ {dailyGoal} thẻ</span>
                    </div>
                 </div>
                 
                 <div className="mt-6 w-full space-y-2">
                    <label className="text-sm opacity-80 font-medium">Cài đặt mục tiêu (thẻ):</label>
                    <input 
                       type="number" 
                       min="1" max="1000"
                       value={dailyGoal}
                       onChange={handleDailyGoalChange}
                       className="w-full bg-black/5 dark:bg-white/5 border border-amber-600/20 dark:border-amber-500/30 rounded-lg px-3 py-2 text-stone-900 dark:text-stone-100 text-center font-bold focus:outline-none focus:border-blue-500 transition"
                    />
                 </div>
              </div>
            </section>

            <section 
              onClick={() => setIsWeeklyStudyModalOpen(true)}
              className="glass p-6 rounded-xl cursor-pointer hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 relative group overflow-hidden"
              id="weekly-study-card"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <h3 className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 mb-4 flex items-center gap-2 relative z-10">
                <Clock className="w-5 h-5 text-amber-500 group-hover:rotate-12 transition-transform duration-300" /> Tổng kết Giờ Học (7 ngày)
              </h3>
              <div className="flex flex-col items-center justify-center p-4 bg-stone-200/60 dark:bg-zinc-800/50 rounded-xl border border-amber-600/20 dark:border-amber-500/30 shadow-inner relative z-10">
                 <div className="text-4xl font-mono font-bold text-amber-600 dark:text-amber-400 mb-2 mt-2">
                    {studyHours}h {studyMinutes}m
                 </div>
                 <p className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 mt-1 opacity-80 group-hover:underline">Xem biểu đồ chi tiết &gt;</p>
              </div>
            </section>

            <TopPerformersWidget 
              users={sortedUsers.slice(0, 10)} 
              currentUserId={user?.id} 
              rankTrends={rankTrends} 
              onUserClick={setSelectedUserProfile} 
            />
            
            <GlobalActivityFeed />
          </aside>
        </motion.div>
      )}

      {activeTab === "all_sets" && (
        <motion.div 
          key="all_sets-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 animate-in fade-in duration-300"
        >
          <div className="flex flex-col gap-2">
            <h3 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 flex items-center gap-3">
              <Library className="w-8 h-8 text-yellow-500 shrink-0" /> Bộ Học Tập Toàn Diện
            </h3>
            <p className="text-stone-500 dark:text-stone-400 text-sm">
              Xem toàn bộ danh sách các bộ thẻ học của bạn, được phân loại tự động và khoa học theo từng chủ đề.
            </p>
          </div>

          <div className="glass p-6 md:p-8 rounded-3xl border border-stone-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-black/40 backdrop-blur-xl shadow-xl">
            <DeckList decks={decks} showSearch={true} groupBySubject={true} onCategoryQuiz={(subject, subjectDecks) => setActiveQuizSetup({ subject, decks: subjectDecks })} />
          </div>
        </motion.div>
      )}

      {activeTab === "create_deck" && (
        <motion.div
           key="create_deck-tab"
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.98 }}
           transition={{ duration: 0.2 }}
           className="w-full max-w-5xl mx-auto space-y-6"
        >
          <div className="space-y-4">
             <div className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-4 rounded-xl text-xs font-bold ring-1 ring-yellow-500/20 text-center">
               💡 Kỷ lục trích xuất 1000 thẻ học siêu tốc nhờ Concurrency Pool 8 Keys xoay vòng cực mượt!
             </div>
             <DocumentConverter />

             <div data-tour="step-2" className="mt-8 pt-8 border-t border-stone-200 dark:border-zinc-800/80 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-4 rounded-2xl">
                   <div>
                      <h3 className="text-sm font-extrabold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                         <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                         Cổng Giám Sát API Sức Khỏe Thực (Real-time Key Telemetry)
                      </h3>
                      <p className="text-xs text-stone-500 mt-1">
                         Hiển thị chi tiết trạng thái hoạt động, tỷ lệ xoay vòng và hệ số tải của từng cụm provider (Gemini, OpenRouter, DeepInfra).
                      </p>
                   </div>
                   <div className="flex items-center gap-1.5 self-end md:self-auto uppercase tracking-wider font-mono text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-2.5 py-1 rounded-full border border-emerald-500/20 shadow-sm animate-pulse">
                      Status: Live Monitor
                   </div>
                </div>
                <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/20 p-4 md:p-6 shadow-sm">
                   <ServiceMonitor adminKey={(import.meta as any).env?.VITE_ADMIN_KEY || "seneca"} />
                </div>
             </div>
          </div>
        </motion.div>
      )}

      {activeTab === "groups" && (
        <motion.div 
          key="groups-tab"
        initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-8 md:p-12 rounded-2xl relative overflow-hidden max-w-4xl mx-auto"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Users className="w-64 h-64" />
          </div>
          <div className="relative z-10 space-y-12">
            {activeGroup ? (
              <div className="space-y-8 animate-in zoom-in-95 duration-500">
                 <div className="text-center mb-10">
                   <h3 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 mb-2 flex justify-center items-center gap-3">
                      <Users className="w-8 h-8 text-blue-500" />
                      {activeGroup.name}
                   </h3>
                   <div className="flex items-center justify-center gap-4 mt-4">
                       <span className="font-mono bg-stone-200/60 dark:bg-zinc-800/50 border border-amber-600/20 dark:border-amber-500/30 text-lg font-bold py-2 px-6 rounded-lg select-all cursor-pointer" title="Copy to clipboard">
                           ID: {activeGroup.id}
                       </span>
                       <button onClick={handleLeaveGroup} className="text-red-500 hover:text-red-600 bg-red-500/10 px-4 py-2 rounded-lg font-bold transition hover:bg-red-500/20">
                          Rời Nhóm
                       </button>
                   </div>
                 </div>

                 <div className="bg-background/40 backdrop-blur border border-amber-600/20 dark:border-amber-500/30 p-8 rounded-2xl max-w-2xl mx-auto space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 border-b border-amber-600/20 dark:border-amber-500/30 pb-4">
                       <MarcusAureliusIcon className="w-6 h-6 text-yellow-500" />
                       <h4 className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Xếp Hạng Thành Viên</h4>
                    </div>
                    
                    <ul className="space-y-4">
                       {activeGroup.members.map((member, i) => (
                          <li key={member.id} className={cn("flex items-center justify-between p-4 rounded-xl border transition-all", 
                             member.isCurrent ? "bg-yellow-500/10 border-yellow-500 text-yellow-900 dark:text-yellow-100 shadow-md transform scale-[1.02]" : "bg-stone-200/60 dark:bg-zinc-800/50 border-transparent")}
                          >
                             <div className="flex items-center gap-4">
                               <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-lg shrink-0",
                                 i === 0 ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20" : 
                                 i === 1 ? "bg-gray-300 text-black shadow-lg" : 
                                 i === 2 ? "bg-orange-400 text-black shadow-lg" : 
                                 "bg-stone-300/60 dark:bg-zinc-800/80"
                               )}>
                                 #{i + 1}
                               </div>
                               <div>
                                 <p className="font-bold flex items-center gap-2">
                                    {member.name}
                                    {member.isCurrent && <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">(Bạn)</span>}
                                 </p>
                               </div>
                             </div>
                             <div className="font-mono font-bold text-lg opacity-80">
                               {member.points} pts
                             </div>
                          </li>
                       ))}
                    </ul>
                 </div>
              </div>
            ) : (
            <>
              <div className="text-center mb-10">
                <h3 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 mb-2">Nhóm Học Tập</h3>
                <p className="opacity-70 font-serif italic text-lg max-w-xl mx-auto">Tham gia hoặc tạo nhóm để cùng nhau tiến bộ. Hành trình tri thức sẽ bớt gian nan hơn khi có bạn đồng hành.</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-12">
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-amber-600/20 dark:border-amber-500/30 pb-4">
                       <span className="bg-blue-500 text-white p-2 rounded-lg"><Users className="w-6 h-6" /></span>
                       <h3 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Tham gia nhóm</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="text-base font-bold opacity-80 block">Nhập ID nhóm của bạn:</label>
                      <div className="flex gap-2">
                        <input 
                           className="flex-1 bg-stone-200/60 dark:bg-zinc-800/50 border-2 border-amber-600/20 dark:border-amber-500/30 rounded-xl px-4 py-3 text-stone-900 dark:text-stone-100 text-lg focus:outline-none focus:border-blue-500 font-mono transition-colors"
                           placeholder="Ví dụ: A7B9F2" 
                           value={groupId}
                           onChange={e => setGroupId(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && handleJoinGroup()}
                        />
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { click(); handleJoinGroup(); }} 
                        className="bg-blue-600 text-white w-full py-3 rounded-xl text-lg font-bold hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 transition shadow-blue-500/10">
                          Tham Gia Ngay
                      </motion.button>
                    </div>
                  </section>
      
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-amber-600/20 dark:border-amber-500/30 pb-4">
                       <span className="bg-yellow-500 text-black p-2 rounded-lg"><MarcusAureliusIcon className="w-6 h-6" /></span>
                       <h3 className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Tạo nhóm học tập</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="text-base font-bold opacity-80 block">Tên nhóm mới:</label>
                      <div className="flex gap-2">
                        <input 
                           className="flex-1 bg-stone-200/60 dark:bg-zinc-800/50 border-2 border-amber-600/20 dark:border-amber-500/30 rounded-xl px-4 py-3 text-stone-900 dark:text-stone-100 text-lg focus:outline-none focus:border-yellow-500 transition-colors"
                           placeholder="Nhóm vượt vũ môn..." 
                           value={newGroupName}
                           onChange={e => setNewGroupName(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                           disabled={isCreating}
                        />
                      </div>
                      <button onClick={handleCreateGroup} disabled={isCreating} className="relative overflow-hidden group bg-yellow-500 text-black w-full py-3 rounded-xl text-lg font-bold hover:bg-yellow-600 shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all duration-500 transform hover:-translate-y-1 hover:scale-[1.02] disabled:opacity-50 disabled:transform-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:-translate-x-full hover:before:translate-x-full before:transition-transform before:duration-700">
                        {isCreating ? (
                          <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Đang thiết lập...</span>
                        ) : "Khởi Tạo Nhóm"}
                      </button>
                    </div>
                  </section>
              </div>
            </>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === "ranking" && (
        <motion.div 
          key="ranking-tab"
          id="leaderboard-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-4 md:p-8 rounded-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <MarcusAureliusIcon className="w-64 h-64" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto space-y-10">
            <div className="text-center">
              <h3 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 mb-2">Bảng Xếp Hạng Tuần</h3>
              <p className="opacity-70">Top học sinh có điểm tích lũy phong độ học tập cao nhất. Cập nhật real-time. Tự động reset sau tuần.</p>
            </div>
            
            {sortedUsers.length > 0 ? (
              <div className="space-y-12">
                {/* PODIUM FOR TOP 3 */}
                <div className="flex flex-wrap justify-center items-end gap-4 sm:gap-6 md:gap-8 pt-8 relative">
                  {[1, 0, 2].map(pos => {
                    const u = sortedUsers[pos];
                    if (!u) return null;
                    const tier = getTier(u.points || 0);
                    const isFirst = pos === 0;
                    const isSecond = pos === 1;
                    const isThird = pos === 2;
                    const trend = rankTrends[u.id] || 'same';

                    return (
                      <motion.div 
                        key={u.id}
                        layoutId={`rank-${u.id}`}
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: pos * 0.1 }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        onClick={() => setSelectedUserProfile(u)}
                        className={cn(
                          "relative flex flex-col items-center p-4 sm:p-6 rounded-2xl cursor-pointer transition-all duration-300",
                          "bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10",
                          isFirst ? "order-1 sm:order-2 w-full sm:w-56 shadow-[0_0_40px_-10px_rgba(234,179,8,0.5)] z-20" : 
                          isSecond ? "order-2 sm:order-1 w-full sm:w-44 z-10" : 
                          "order-3 sm:order-3 w-full sm:w-44 z-10",
                          u.id === user?.id ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-black" : ""
                        )}
                      >
                        {isFirst && <Crown className="absolute -top-7 w-12 h-12 text-yellow-500 drop-shadow-xl animate-pulse" />}
                        {trend === 'up' && <ChevronUp className="absolute top-3 right-3 w-6 h-6 text-green-500 animate-bounce" />}
                        {trend === 'down' && <ChevronDown className="absolute top-3 right-3 w-6 h-6 text-red-500" />}

                        <div className="relative mb-4 shrink-0">
                          <div className={cn(
                            "flex items-center justify-center font-display font-bold shrink-0 rounded-full shadow-xl overflow-hidden relative",
                            isFirst ? "w-24 h-24 border-4 border-yellow-500/50 shadow-yellow-500/30" : 
                            isSecond ? "w-20 h-20 border-4 border-zinc-400/50 shadow-zinc-400/30" : 
                            "w-20 h-20 border-4 border-amber-600/50 shadow-amber-600/30",
                            u.avatarBorder === "bronze" ? "ring-4 ring-[#cd7f32] ring-offset-2 ring-offset-white dark:ring-offset-black" :
                            u.avatarBorder === "silver" ? "ring-4 ring-[#c0c0c0] ring-offset-2 ring-offset-white dark:ring-offset-black" :
                            u.avatarBorder === "gold" ? "ring-4 ring-[#ffd700] ring-offset-2 ring-offset-white dark:ring-offset-black" :
                            u.avatarBorder === "diamond" ? "ring-4 ring-[#00ffff] ring-offset-2 ring-offset-white dark:ring-offset-black animate-pulse" : ""
                          )}>
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300">
                                <span className="uppercase text-xl font-bold font-mono">{u.name.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Small rank badge on top-right of the avatar */}
                          <div className={cn(
                            "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ring-2 ring-white dark:ring-zinc-950 shadow-md",
                            isFirst ? "bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600 text-black" :
                            isSecond ? "bg-gradient-to-r from-gray-100 via-gray-300 to-gray-500 text-black" :
                            "bg-gradient-to-r from-orange-200 via-orange-400 to-orange-600 text-black"
                          )}>
                            {pos + 1}
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-center text-lg sm:text-xl mb-1 line-clamp-1 break-all px-2">{u.name}</h4>
                        {u.id === user?.id && <span className="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 font-bold">You</span>}
                        <div className="text-xs font-mono font-bold text-stone-500 dark:text-stone-400 mb-2">Lv.{u.level || getLevelInfo(u.points || 0).currentLevel}</div>
                        
                        {u.streak ? (
                          <div className="flex items-center gap-1 text-xs font-bold text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full mb-3 border border-orange-500/20">
                             <Flame className="w-3 h-3" /> {u.streak} Days
                          </div>
                        ) : <div className="h-7 mb-3"></div>}
                        
                        <div className={cn("text-[11px] sm:text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 mb-4 border shadow-sm", tier.color)}>
                          {tier.icon} {tier.name}
                        </div>
                        
                        <div className="font-mono text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-stone-700 to-black dark:from-stone-300 dark:to-white drop-shadow-sm">
                          {u.points || 0} <span className="text-sm opacity-50 font-sans">pts</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* LIST FOR THE REST */}
                {sortedUsers.length > 3 && (
                  <div className="space-y-3 pt-6 max-w-2xl mx-auto">
                    {sortedUsers.slice(3).map((u, index) => {
                      const actualRank = index + 4;
                      const tier = getTier(u.points || 0);
                      const trend = rankTrends[u.id] || 'same';

                      return (
                        <motion.div 
                          layoutId={`rank-${u.id}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25, delay: index * 0.05 }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedUserProfile(u)}
                          key={u.id} className={cn(
                            "group flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all cursor-pointer backdrop-blur-md", 
                            u.id === user?.id 
                              ? "bg-amber-500/15 border-amber-500 shadow-lg ring-1 ring-amber-500/50" 
                              : "bg-white/40 dark:bg-black/20 border-stone-200 dark:border-stone-800 hover:border-amber-500/30 hover:bg-white/60 dark:hover:bg-black/40"
                          )}>
                          <div className="flex items-center gap-4 sm:gap-6 overflow-hidden">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-display font-bold text-lg sm:text-xl shrink-0 bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 border-2 border-transparent group-hover:border-amber-500/50 transition-colors">
                              {actualRank}
                            </div>
                            
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg truncate max-w-[120px] sm:max-w-[200px]">{u.name}</span>
                                {u.id === user?.id && <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">You</span>}
                                {trend === 'up' && <ChevronUp className="w-5 h-5 text-green-500" />}
                                {trend === 'down' && <ChevronDown className="w-5 h-5 text-red-500" />}
                                {trend === 'same' && <Minus className="w-4 h-4 text-stone-400 opacity-50" />}
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 w-fit", tier.color)}>
                                  {tier.name}
                                </span>
                                <span className="text-[10px] font-mono font-bold bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 rounded border border-stone-300 dark:border-stone-700">
                                  Lv.{u.level || getLevelInfo(u.points || 0).currentLevel}
                                </span>
                                {u.streak && (
                                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                                    <Flame className="w-3 h-3" /> {u.streak}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="flex flex-col items-end font-mono">
                              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-stone-700 to-black dark:from-stone-300 dark:to-white group-hover:scale-110 transition-transform origin-right">
                                {u.points || 0}
                              </span>
                            </div>
                            {(user?.role === "teacher" || user?.role === "admin" || user?.role === "Admin") && u.id !== user?.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStudentToDelete(u);
                                }}
                                className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Xóa học sinh"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 opacity-50 font-bold border-2 border-dashed border-amber-600/20 dark:border-amber-500/30 rounded-xl mt-8 max-w-2xl mx-auto">
                Chưa có học sinh nào trên bảng xếp hạng tuần này.
              </div>
            )}
          </div>
        </motion.div>
      )}

      {activeTab === "profile" && (
        <motion.div 
          key="profile-tab"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-4 sm:p-8 rounded-2xl relative overflow-hidden max-w-4xl mx-auto"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 border-b border-amber-600/20 dark:border-amber-500/30 pb-4 mb-8">
              <h3 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 flex items-center gap-3">
                 Cá Nhân Hóa Hồ Sơ
              </h3>
              <button 
                onClick={() => setShowEnvDebug(!showEnvDebug)}
                className="opacity-10 hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                title="Toggle Environment Diagnostics"
              >
                <Bug className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            
            {user && (() => {
              const xpInfo = getLevelInfo(user.points || 0);
              const userLevel = user.level || xpInfo.currentLevel;
              const equippedTitle = user.title || xpInfo.title;
              const equippedBorder = user.avatarBorder || "none";
              
              const BORDERS = [
                { id: "none", label: "Mặc định (Không viền)", color: "" },
                { id: "bronze", label: "Huy hiệu Đồng", color: "ring-4 ring-[#cd7f32] shadow-[0_0_15px_rgba(205,127,50,0.5)]" },
                { id: "silver", label: "Huy hiệu Bạc", color: "ring-4 ring-[#c0c0c0] shadow-[0_0_15px_rgba(192,192,192,0.5)]" },
                { id: "gold", label: "Huy hiệu Vàng", color: "ring-4 ring-[#ffd700] shadow-[0_0_15px_rgba(255,215,0,0.5)]" },
                { id: "diamond", label: "Huy hiệu Kim Cương", color: "ring-4 ring-[#00ffff] shadow-[0_0_20px_rgba(0,255,255,0.6)] animate-pulse" }
              ];
              
              const TITLES = [
                "Tân binh", "Chăm chỉ", "Học giả", "Kẻ Hủy Diệt", "Bậc Thầy", "Huyền Thoại Trí Tuệ",
                xpInfo.title
              ].filter((v, i, a) => a.indexOf(v) === i);

              const updateProfileField = async (field: "title" | "avatarBorder", value: string) => {
                try {
                  const { dbService } = await import("../lib/firebase");
                  await dbService.updateUserProfile(user.id, { [field]: value });
                } catch (e) {
                  console.error("Lỗi cập nhật profile:", e);
                }
              };

              const avatarClass = BORDERS.find(b => b.id === equippedBorder)?.color || "";

              return (
                <div className="space-y-12">
                  <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left card-3d p-8 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                       <Award className="w-32 h-32" />
                    </div>
                    <div className="relative group">
                      <div className={cn("w-32 h-32 rounded-full bg-stone-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 object-cover relative z-10 overflow-hidden", avatarClass)}>
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="Avatar profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-4xl font-bold font-mono opacity-50 uppercase">{user.name.charAt(0)}</span>
                        )}
                        <button
                          onClick={() => profileFileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-bold transition-opacity cursor-pointer z-25 rounded-full"
                          title="Thay đổi ảnh đại diện"
                        >
                          <Camera className="w-6 h-6 mb-1 text-amber-400 animate-bounce" />
                          <span>Tải ảnh</span>
                        </button>
                      </div>
                      
                      {isUploadingPhoto && (
                        <div className="absolute inset-x-0 bottom-4 flex justify-center z-30">
                          <span className="bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse">Đang nén...</span>
                        </div>
                      )}

                      <div className={cn("absolute -bottom-2 -right-4 font-bold font-mono px-4 py-1.5 rounded-full text-sm border-2 border-white dark:border-zinc-900 shadow-xl z-25 bg-gradient-to-r", xpInfo.badgeColors)}>
                        Lv.{userLevel}
                      </div>

                      <input 
                        type="file"
                        ref={profileFileInputRef}
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            setIsUploadingPhoto(true);
                            const base64 = await resizeImageAndGetBase64(file);
                            const { dbService } = await import("../lib/firebase");
                            await dbService.updateUserProfile(user.id, { photoURL: base64 });
                            store.updateCurrentUser({ photoURL: base64 }, true);
                          } catch (err: any) {
                            console.error("Lỗi upload avatar:", err);
                            alert("Không thể tải ảnh: " + err.message);
                          } finally {
                            setIsUploadingPhoto(false);
                          }
                        }}
                        className="hidden"
                      />
                    </div>
                    
                    <div className="space-y-4 flex-1 w-full relative z-10">
                       <div className="space-y-1">
                          {isEditingProfileName ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-sm justify-center md:justify-start">
                              <input 
                                type="text"
                                value={profileNameInput}
                                onChange={(e) => setProfileNameInput(e.target.value)}
                                className="px-3 py-1.5 text-base bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                                placeholder="..."
                                maxLength={25}
                              />
                              <div className="flex gap-1.5">
                                <button 
                                  onClick={async () => {
                                    if (!profileNameInput.trim()) return;
                                    try {
                                      const { dbService } = await import("../lib/firebase");
                                      await dbService.updateUserProfile(user.id, { name: profileNameInput.trim() });
                                      store.updateCurrentUser({ name: profileNameInput.trim() }, true);
                                      setIsEditingProfileName(false);
                                    } catch (err: any) {
                                      alert("Lỗi đổi tên: " + err.message);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                                >
                                  Lưu
                                </button>
                                <button 
                                  onClick={() => {
                                    setProfileNameInput(user.name);
                                    setIsEditingProfileName(false);
                                  }}
                                  className="px-3 py-1.5 bg-stone-200 dark:bg-zinc-700 hover:bg-stone-300 dark:hover:bg-zinc-600 text-stone-700 dark:text-stone-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-center md:justify-start">
                              <h4 className="text-3xl font-bold font-display">{user.name}</h4>
                              <button 
                                onClick={() => {
                                  setProfileNameInput(user.name);
                                  setIsEditingProfileName(true);
                                }}
                                className="p-1 px-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-stone-500 dark:text-stone-400 hover:text-amber-500 flex items-center gap-1 text-xs font-bold transition-all cursor-pointer"
                                title="Đổi tên hiển thị"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Sửa tên
                              </button>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start mt-1">
                            <p className={cn("font-bold tracking-wide italic", user.title ? "text-amber-600 dark:text-amber-400" : xpInfo.titleColor)}>"{equippedTitle}"</p>
                            <UserRoleBadge role={user.role} isSchoolLover={user.isSchoolLover} isPro={user.isPro} />
                          </div>
                       </div>
                       
                       <div className="pt-2">
                         <div className="flex justify-between text-xs font-mono mb-1.5 opacity-80">
                            <span>{Math.floor(xpInfo.xpIntoCurrentLevel)} XP</span>
                            <span>{Math.floor(xpInfo.xpNeededForNextLevel)} XP đến Lv.{userLevel + 1}</span>
                         </div>
                         <div className="h-3 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden shadow-inner">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${xpInfo.progressPercentage}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 dark:from-amber-600 dark:to-yellow-500 rounded-full relative"
                            >
                               <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', backgroundSize: '200% 100%' }} />
                            </motion.div>
                         </div>
                         <p className="text-[10px] mt-2 opacity-50 text-right">Tổng XP: {user.points || 0}</p>
                       </div>
                       
                       <div className="flex flex-wrap gap-4 items-center justify-center md:justify-start">
                          <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wider opacity-60">Cấp độ hiện tại</span>
                            <span className="font-mono font-bold text-xl">{xpInfo.currentLevel}</span>
                          </div>
                          <div className="w-px h-8 bg-black/10 dark:bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wider opacity-60">Chuỗi ngày</span>
                            <span className="font-mono font-bold text-xl flex items-center center gap-1"><Flame className="w-4 h-4 text-orange-500" /> {user.streak || 0}</span>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="font-bold text-xl border-b border-black/10 dark:border-white/10 pb-2">Đeo Khung Avatar</h4>
                      <div className="grid grid-cols-1 gap-3">
                        {BORDERS.map(border => (
                          <button
                            key={border.id}
                            onClick={() => updateProfileField("avatarBorder", border.id)}
                            className={cn(
                              "p-4 rounded-xl border text-left flex items-center justify-between transition-all duration-300",
                              equippedBorder === border.id 
                                ? "bg-amber-500/10 border-amber-500 dark:bg-amber-500/20 dark:border-amber-400 ring-1 ring-amber-500 shadow-md" 
                                : "bg-white/50 border-stone-200 dark:bg-zinc-800/50 dark:border-zinc-700 hover:border-amber-500/50"
                            )}
                          >
                            <div className="flex items-center gap-4">
                               <div className={cn("w-10 h-10 rounded-full bg-stone-300 dark:bg-zinc-600 transition-all", border.color)} />
                               <span className="font-bold">{border.label}</span>
                            </div>
                            {equippedBorder === border.id && <CheckCircle2 className="w-5 h-5 text-amber-500" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-bold text-xl border-b border-black/10 dark:border-white/10 pb-2">Danh Hiệu Hiển Thị</h4>
                      <div className="flex flex-wrap gap-3">
                        {TITLES.map(title => (
                          <button
                            key={title}
                            onClick={() => updateProfileField("title", title)}
                            className={cn(
                              "px-5 py-3 rounded-xl border font-bold transition-all duration-300",
                              equippedTitle === title
                                ? "bg-amber-500 text-white border-amber-600 shadow-md transform scale-105" 
                                : "bg-white/50 border-stone-200 text-stone-600 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-stone-300 hover:border-amber-500/50"
                            )}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                      <h4 className="font-bold text-xl border-b border-black/10 dark:border-white/10 pb-2 mt-6">Tag Thành Viên Hồ Sơ</h4>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <button
                          key="default-tag"
                          onClick={async () => {
                            try {
                              const { dbService } = await import("../lib/firebase");
                              await dbService.updateUserProfile(user.id, { isSchoolLover: false });
                              store.updateCurrentUser({ isSchoolLover: false });
                              // Simple reactive update trigger
                              setDbUsers(prev => prev.map(u => u.id === user.id ? { ...u, isSchoolLover: false } : u));
                            } catch(e) {
                              console.error(e);
                            }
                          }}
                          className={cn(
                            "px-5 py-3 rounded-xl border font-bold transition-all duration-300 flex items-center gap-2",
                            (!user.isSchoolLover)
                              ? "bg-stone-500 text-white border-stone-600 shadow-md transform scale-105" 
                              : "bg-white/50 border-stone-200 text-stone-600 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-stone-300 hover:border-stone-500/50"
                          )}
                        >
                          <Activity className="w-4 h-4" /> Mặc định (Học viên)
                        </button>
                        {user.isPro ? (
                          <button
                            key="school-lover-tag"
                            onClick={async () => {
                              try {
                                const { dbService } = await import("../lib/firebase");
                                await dbService.updateUserProfile(user.id, { isSchoolLover: true });
                                store.updateCurrentUser({ isSchoolLover: true });
                                // Simple reactive update trigger
                                setDbUsers(prev => prev.map(u => u.id === user.id ? { ...u, isSchoolLover: true } : u));
                              } catch(e) {
                                console.error(e);
                              }
                            }}
                            className={cn(
                              "px-5 py-3 rounded-xl border font-bold transition-all duration-300 flex items-center gap-2",
                              (user.isSchoolLover)
                                ? "bg-pink-500 text-white border-pink-600 shadow-md transform scale-105" 
                                : "bg-white/50 border-stone-200 text-stone-600 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-stone-300 hover:border-pink-500/50"
                            )}
                          >
                            <Heart className="w-4 h-4 fill-pink-100/30 text-white animate-pulse" />💘 Em yêu trường em (VIP)
                          </button>
                        ) : (
                          <button
                            key="school-lover-tag-disabled"
                            disabled
                            title="Bạn cần nâng cấp tài khoản Thành Viên VIP để sử dụng thẻ này"
                            className="px-5 py-3 rounded-xl border font-bold transition-all duration-300 flex items-center gap-2 bg-stone-100/50 border-stone-200 text-stone-400 dark:bg-zinc-800/30 dark:border-zinc-800 dark:text-stone-600 cursor-not-allowed opacity-70"
                          >
                            <Heart className="w-4 h-4" />💘 Em yêu trường em (Cần VIP)
                          </button>
                        )}
                      </div>
                      <p className="text-sm opacity-60 mt-4 italic bg-black/5 dark:bg-white/5 p-4 rounded-lg">
                         Mẹo: Điểm XP (Kinh nghiệm) càng cao sẽ giúp cấp độ Level càng tăng. Hãy tiếp tục ôn tập Flashcard để đạt những danh hiệu Huyền thoại nhé.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 mt-8 pt-8 border-t border-black/10 dark:border-white/10">
                    <h4 className="font-bold text-xl pb-2">Cài đặt ứng dụng</h4>
                    <div className="card-3d p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                      <div>
                        <h5 className="font-bold mb-1 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-amber-500" /> Tự động cập nhật phiên bản</h5>
                        <p className="text-sm opacity-70">Cài đặt chu kỳ hệ thống tự động bắt bản cập nhật mới nhất. Khuyến nghị bật để trải nghiệm mới mẻ và ổn định.</p>
                      </div>
                      <select
                        className="bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 font-medium min-w-[220px]"
                        defaultValue={localStorage.getItem("autoUpdateInterval") || "10"}
                        onChange={(e) => {
                          const val = e.target.value;
                          localStorage.setItem("autoUpdateInterval", val);
                        }}
                      >
                         <option value="disabled">Tắt cập nhật tự động</option>
                         <option value="5">Mỗi 5 phút</option>
                         <option value="10">Mỗi 10 phút (Mặc định)</option>
                         <option value="30">Mỗi 30 phút</option>
                         <option value="60">Mỗi 1 giờ</option>
                      </select>
                    </div>

                    {showEnvDebug && (
                      <div className="mt-8 p-6 text-xs font-mono bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl overflow-x-auto shadow-inner">
                        <h4 className="font-bold mb-4 uppercase tracking-widest opacity-60 flex items-center gap-2">
                          <Bug className="w-4 h-4" /> Environment Diagnostics
                        </h4>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="opacity-60 border-b border-black/10 dark:border-white/10">
                              <th className="pb-3 px-2">Variable</th>
                              <th className="pb-3 px-2 text-center">Exists</th>
                              <th className="pb-3 px-2">Value Preview</th>
                            </tr>
                          </thead>
                          <tbody className="opacity-80">
                            {Object.entries(getEnvDiagnostics()).map(([key, data]) => (
                              <tr key={key} className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <td className="py-3 px-2 font-semibold text-amber-700 dark:text-amber-400">{key}</td>
                                <td className="py-3 px-2 text-center">
                                  {data.exists 
                                    ? <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase">Yes</span>
                                    : <span className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase">No</span>
                                  }
                                </td>
                                <td className="py-3 px-2 font-mono text-[10px]">
                                  {data.exists && data.preview ? (
                                    <span className="bg-stone-300/40 dark:bg-zinc-800/40 px-2.5 py-1 rounded border border-stone-400/20 max-w-xs truncate inline-block">
                                      {data.preview}
                                    </span>
                                  ) : (
                                    <span className="opacity-40">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </motion.div>
      )}

      {activeTab === "cyberpunk" && (
        <motion.div
          key="cyberpunk-tab"
          initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-12 max-w-6xl mx-auto py-4"
        >
          {/* Hero Header Sector */}
          <div className="relative p-8 md:p-12 rounded-3xl bg-black/90 dark:bg-black text-white border-[0.5px] border-amber-500/30 overflow-hidden scanline">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="font-mono text-[9px] text-amber-500 tracking-widest font-bold">SEC_0X08 // OVERDRIVE</span>
            </div>

            <div className="relative z-10 max-w-2xl space-y-4">
              <span className="font-mono text-[11px] tracking-[0.25em] text-amber-500 uppercase font-bold">
                Monochromatic Cyberpunk Art // Luxury Gold Accent
              </span>
              <h2 className="text-4xl md:text-6xl font-serif tracking-tight leading-none text-zinc-100">
                The Stoic <span className="font-sans italic text-amber-500 font-normal">Cinematic</span> Space
              </h2>
              <p className="font-sans text-stone-300 text-sm md:text-base leading-relaxed">
                Trải nghiệm không gian học Stoic tương lai với các tính năng tương tác ba chiều tối tân. Mỗi thẻ đại diện cho một nút thắt suy tưởng - nhấp chuột để giải mã, rê chuột hoặc chạm giữ để cảm nhận lực tương tác vật lý (3D Depth Feedback).
              </p>
              
              <div className="pt-4 flex flex-wrap gap-4 font-mono text-[10px] text-zinc-400">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
                  <span className="text-amber-500 font-bold">GEORGIA:</span> Luxury Title Serif
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
                  <span className="text-amber-500 font-bold">3D_TOUCH:</span> Haptic Simulated Tilt
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
                  <span className="text-amber-500 font-bold">FLOW:</span> Cinematic Staggered Entrance
                </div>
              </div>
            </div>
          </div>

          {/* Staggered Cinematic Cards Grid */}
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-stone-200 dark:border-zinc-800 pb-3">
              <h3 className="font-serif text-2xl font-bold italic tracking-tight text-stone-900 dark:text-zinc-100">
                Stoic Nodes Sector
              </h3>
              <span className="font-mono text-xs text-amber-500">
                3 UNITS LOADED // DEC_KEY: ACTIVE
              </span>
            </div>

            <CinematicContainer className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
              <CyberCard 
                category="ST_101 // MEDITATIONS"
                badge="Marcus Aurelius"
                subtitle="TIÊU ĐIỂM SỨC MẠNH NỘI TÂM"
                title="Khống chế Tâm Trí"
                description="Bạn có quyền kiểm soát tâm trí của mình - chứ không phải các sự kiện bên ngoài. Hãy nhận ra điều này, và bạn sẽ tìm thấy sức mạnh chân thật."
                extraDetails="Marcus Aurelius khuyên rằng mọi sự đau khổ không xuất phát từ chính sự kiện, mà từ cách chúng ta phán xét nó. Khi bạn làm chủ được lăng kính nội tâm, không thế lực nào bên ngoài có thể làm bạn lung lay."
                actionText="SYNC_METRICS"
                onActionClick={() => alert("Hệ thống đồng bộ dữ liệu Stoicism thành công!")}
              />

              <CyberCard 
                category="ST_209 // ON SHORTER"
                badge="Lucius Seneca"
                subtitle="THỜI GIAN VÀ SỰ SỐNG"
                title="Giá Trị Thời Gian"
                description="Không phải chúng ta có ít thời gian để sống, mà là chúng ta đã lãng phí quá nhiều thời gian vào những việc vô nghĩa."
                extraDetails="Seneca nhấn mạnh thời gian là tài sản duy nhất mà chúng ta không bao giờ có thể lấy lại. Sống trọn vẹn từng khoảnh khắc hiện tại chính là cách tối thượng để chiến thắng sự hữu hạn của đời người."
                actionText="TIME_DECRYPT"
                onActionClick={() => alert("Thời gian định vị thành công: " + new Date().toLocaleTimeString())}
              />

              <CyberCard 
                category="ST_315 // DISCOURSES"
                badge="Epictetus"
                subtitle="LÝ THUYẾT VỀ SỰ KHÁC BIỆT"
                title="Tự Do Tuyệt Đối"
                description="Hạnh phúc và tự do chỉ bắt đầu bằng một sự hiểu biết rõ ràng: Điều gì nằm trong tầm kiểm soát của ta, và điều gì thì không."
                extraDetails="Epictetus phân chia thế giới thành hai nửa: những điều ta có quyền tác động (ý nghĩ, khát khao, thái độ) và những điều ta bất lực can thiệp (dư luận, số phận, thể trạng). Tập trung vào vế đầu đưa bạn tới tự do vĩnh cửu."
                actionText="DECRYPT_VIR"
                onActionClick={() => alert("Mở khóa mã nguồn đức hạnh Stoicism thành công!")}
              />
            </CinematicContainer>
          </div>

          {/* Interactive Cinematic Sandbox Controls */}
          <div className="p-8 rounded-3xl border-[0.5px] border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-black/30 backdrop-blur-md">
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
              <div className="space-y-1">
                <h4 className="font-serif text-xl font-bold text-stone-900 dark:text-zinc-100 italic">
                  Chế độ tối giản & Phủ bóng (Minimalist Ambient Glow)
                </h4>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Nhấp vào các phím tính năng dưới đây để kiểm tra hiệu năng hệ thống giao diện Cinematic hoặc chuyển đổi các thiết lập thử nghiệm.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    click();
                    alert("Kích hoạt Chế độ Ambient Light Glow thành công!");
                  }}
                  className="font-mono text-[10px] font-bold tracking-widest px-4 py-2 border border-amber-500/20 hover:border-amber-500 hover:text-amber-500 text-stone-600 dark:text-zinc-400 transition-all rounded-lg"
                >
                  AMBIENT_GLOW: ON
                </button>
                <button
                  onClick={() => {
                     click();
                     toggleEcoMode();
                  }}
                  className="font-mono text-[10px] font-bold tracking-widest px-4 py-2 bg-amber-500 text-black hover:bg-amber-400 transition-all rounded-lg"
                >
                  TOGGLE_ECO_MODE
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "settings" && (
        <motion.div 
          key="settings-tab"
          id="eco-font-controls-box"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-4 sm:p-8 rounded-2xl relative overflow-hidden max-w-3xl mx-auto"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Settings className="w-48 h-48" />
          </div>
          
          <div className="relative z-10">
            <h3 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 mb-8 flex items-center gap-3 border-b border-amber-600/20 dark:border-amber-500/30 pb-4">
               Cài Đặt Hệ Thống
            </h3>
            
            <div className="space-y-6">
              {/* Tùy Chọn Tắt m Toàn Cục */}
              <div className="card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                 <div className="space-y-2 max-w-lg">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                       {muteAll ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-yellow-500 animate-pulse" />}
                       Tắt Mọi Âm Thanh (Mute All)
                    </h4>
                    <p className="opacity-70 text-sm">
                       Tự động vô hiệu hóa toàn bộ hiệu ứng âm thanh (lật thẻ, âm chính xác, sai) trong các phòng học. Cài đặt này được sao lưu trên bộ nhớ cục bộ thiết bị của bạn.
                    </p>
                 </div>
                 <button 
                    onClick={() => {
                        const nextState = !muteAll;
                        setMuteAll(nextState);
                        setMutedStatus(nextState);
                    }}
                    className={cn(
                       "shrink-0 px-6 py-3 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-lg cursor-pointer",
                       muteAll ? "bg-red-500 hover:bg-red-600 text-white" : "bg-yellow-500 hover:bg-yellow-600 text-black"
                    )}
                 >
                    {muteAll ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    {muteAll ? "Đang Tắt Tiếng" : "Bật Âm Thanh"}
                 </button>
              </div>

              {/* Tùy chỉnh Cỡ Chữ Hệ Thống */}
              <div className="card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                 <div className="space-y-4 w-full md:max-w-lg">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                       <Type className="w-5 h-5 text-amber-500" />
                       Cỡ Chữ Hệ Thống (App Font Size)
                    </h4>
                    <p className="opacity-70 text-sm">
                       Điều chỉnh phóng to/thu nhỏ kích thước chữ của toàn bộ ứng dụng. Các widget và bảng hiển thị sẽ tự động co giãn và căn lề tương ứng mà không bị méo mó hay tràn giao diện.
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-sm">Tỷ lệ hiện tại:</span>
                      <span className="font-mono font-black text-base text-yellow-600 dark:text-yellow-400 px-3 py-1 bg-stone-200/60 dark:bg-zinc-800/70 rounded-lg">
                        {Math.round((localFontSize / 16) * 100)}% ({localFontSize}px)
                      </span>
                    </div>
                 </div>

                 <div className="w-full md:w-64 flex flex-col gap-2">
                    <input 
                       type="range" 
                       min="12" 
                       max="32" 
                       value={localFontSize} 
                       onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setLocalFontSize(val);
                          localStorage.setItem("henosis-font-size", val.toString());
                          window.dispatchEvent(new CustomEvent("henosis-font-size-changed", { detail: { size: val } }));
                       }}
                       className="w-full h-2 bg-stone-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                       style={{ accentColor: "#d97706" }}
                    />
                    <div className="flex justify-between text-[11px] text-stone-500 font-bold font-mono">
                      <span>Nhỏ (12px)</span>
                      <span>Mặc định (16px)</span>
                      <span>Lớn (32px)</span>
                    </div>
                    <button
                       onClick={() => {
                          const defaultVal = 16;
                          setLocalFontSize(defaultVal);
                          localStorage.setItem("henosis-font-size", defaultVal.toString());
                          window.dispatchEvent(new CustomEvent("henosis-font-size-changed", { detail: { size: defaultVal } }));
                       }}
                       className="mt-2 w-full py-2 px-4 bg-stone-300 hover:bg-stone-400 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-800 dark:text-stone-200 font-bold text-xs rounded-lg transition-transform hover:scale-102 flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      Đặt lại mặc định (16px)
                    </button>
                 </div>
              </div>

              {/* Tùy chỉnh Mật Độ Giao Diện (UI Density) */}
              <div className="card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                 <div className="space-y-2 max-w-lg">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                       {localUiDensity === "compact" ? <Minimize2 className="w-5 h-5 text-amber-500" /> : <Maximize2 className="w-5 h-5 text-yellow-500" />}
                       Mật độ Giao Diện (UI Density)
                    </h4>
                    <p className="opacity-70 text-sm">
                       Thay đổi tỷ lệ khoảng cách (margin, padding, gap) của toàn bộ hệ thống. Chọn "Nhỏ gọn" nếu mày muốn xem nhiều thông tin hơn trên cùng một màn hình mà không cần tốn nhiều thao tác cuộn.
                    </p>
                 </div>
                 <div className="flex gap-2 p-1 bg-stone-200/50 dark:bg-zinc-900 rounded-xl shadow-inner border border-stone-200/40 dark:border-zinc-800/50">
                    <button
                      onClick={() => {
                        localStorage.setItem("henosis-ui-density", "comfortable");
                        setLocalUiDensity("comfortable");
                        window.dispatchEvent(new CustomEvent("henosis-ui-density-changed", { detail: { density: "comfortable" } }));
                      }}
                      className={cn(
                        "py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-lg whitespace-nowrap transition-all border-none focus:outline-none cursor-pointer",
                        localUiDensity === "comfortable"
                          ? "bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-md"
                          : "text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-250 bg-transparent"
                      )}
                    >
                      Dễ Nhìn (Comfortable)
                    </button>
                    <button
                      onClick={() => {
                        localStorage.setItem("henosis-ui-density", "compact");
                        setLocalUiDensity("compact");
                        window.dispatchEvent(new CustomEvent("henosis-ui-density-changed", { detail: { density: "compact" } }));
                      }}
                      className={cn(
                        "py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-lg whitespace-nowrap transition-all border-none focus:outline-none cursor-pointer",
                        localUiDensity === "compact"
                          ? "bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-md"
                          : "text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-stone-250 bg-transparent"
                      )}
                    >
                      Nhỏ Gọn (Compact)
                    </button>
                 </div>
              </div>

              {/* Tùy chọn Tiết kiệm hiệu năng / Fix Lag */}
              <div className="card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                 <div className="space-y-2 max-w-lg">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                       <Snowflake className={cn("w-5 h-5", isEcoMode ? "text-green-500 animate-[spin_4s_linear_infinite]" : "text-stone-400")} />
                       Chế Độ Mượt - Giảm Lag (Eco / Fix Lag)
                    </h4>
                    <p className="opacity-70 text-sm">
                       Khuyên dùng cho điện thoại và máy tính cấu hình yếu. Giúp loại bỏ các hiệu ứng hạt nền và các hoạt ảnh nặng, hiệu ứng đổ bóng phức tạp giúp tăng tốc phản hồi tối đa.
                    </p>
                 </div>
                 <button 
                    onClick={toggleEcoMode}
                    className={cn(
                       "shrink-0 px-6 py-3 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2 shadow-lg cursor-pointer",
                       isEcoMode ? "bg-green-500 hover:bg-green-600 text-white" : "bg-stone-300 dark:bg-zinc-800 hover:bg-stone-400 dark:hover:bg-zinc-700 text-stone-800 dark:text-stone-200"
                    )}
                 >
                    <Snowflake className="w-5 h-5" />
                    {isEcoMode ? "Đang Bật Chế Độ Mượt" : "Bật Fix Lag"}
                 </button>
              </div>

              <div className="card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                 <div className="space-y-2 max-w-lg">
                    <h4 className="text-xl font-bold flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-500" /> Xóa Dữ Liệu Cũ</h4>
                    <p className="opacity-70 text-sm">
                      Xóa bỏ các dữ liệu nháp của thẻ học (Agent 3) và danh sách thẻ yếu (weak_cards). Điều này giúp làm mới lộ trình học của bạn mà không ảnh hưởng đến điểm số hiện tại.
                    </p>
                 </div>
                 <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="shrink-0 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-transform hover:scale-105 flex items-center gap-2 shadow-lg"
                 >
                    Xóa Dữ Liệu Ngay
                 </button>
              </div>

              <div className="card-3d p-6 rounded-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                 <div className="space-y-2 max-w-lg">
                    <h4 className="text-xl font-bold flex items-center gap-2"><LogOut className="w-5 h-5 text-stone-600 dark:text-stone-400" /> Đăng Xuất</h4>
                    <p className="opacity-70 text-sm">
                      Đăng xuất khỏi thiết bị này. Dữ liệu của bạn được đồng bộ an toàn trên hệ thống.
                    </p>
                 </div>
                 <button 
                    onClick={async () => {
                      try {
                        const { signOut } = await import("firebase/auth");
                        
                        if (auth.currentUser?.uid) {
                           try {
                               const { doc, deleteDoc } = await import("firebase/firestore");
                               await deleteDoc(doc(db, "costudy_room", auth.currentUser.uid));
                           } catch (roomErr) {
                               console.error("Cleanup room error:", roomErr);
                           }
                        }
                  
                        if (auth.currentUser?.isAnonymous) {
                            try {
                               const { dbService } = await import("../lib/firebase");
                               await dbService.deleteUserProfile(auth.currentUser.uid);
                               await auth.currentUser.delete();
                            } catch (delError) {
                               console.error("Soft failing cleanup of anonymous auth:", delError);
                            }
                        } else {
                            await signOut(auth);
                        }
                        store.logout();
                        FirebaseListenerManager.clearAll();
                        navigate("/");
                        sessionStorage.removeItem('isAdminMode');
                      } catch (error) {
                        console.error("Lỗi đăng xuất:", error);
                      }
                    }}
                    className="shrink-0 px-6 py-3 bg-stone-200 dark:bg-zinc-800 hover:bg-stone-300 dark:hover:bg-zinc-700 font-bold rounded-lg transition-transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-black/5"
                 >
                    <LogOut className="w-4 h-4 hidden sm:block" /> Đăng Xuất
                 </button>
              </div>
            </div>
          </div>

          {/* Dialog Confirmation */}
          <AnimatePresence>
             {showClearConfirm && (
                <motion.div 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="modal-glass-overlay flex items-center justify-center p-4"
                >
                   <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="bg-stone-100 dark:bg-zinc-900 border border-red-500/30 shadow-2xl rounded-2xl p-6 md:p-8 max-w-md w-full"
                   >
                      <div className="flex flex-col items-center text-center space-y-4">
                         <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
                             <AlertTriangle className="w-8 h-8" />
                         </div>
                         <h3 className="text-2xl font-bold">Bạn có chắc chắn?</h3>
                         <p className="opacity-80 pb-4">
                            Hành động này sẽ xóa vĩnh viễn các dữ liệu nháp và danh sách thẻ yếu hiện tại (weak_cards) khỏi hệ thống. Bạn không thể hoàn tác thao tác này. Bạn có muốn tiếp tục không?
                         </p>
                         <div className="flex w-full gap-4">
                            <button 
                               onClick={() => setShowClearConfirm(false)}
                               className="flex-1 py-3 rounded-lg border border-amber-600/20 dark:border-amber-500/30 font-bold transition hover:bg-black/5 dark:hover:bg-white/5"
                            >
                               Hủy
                            </button>
                            <button 
                               onClick={handleClearOldData}
                               className="flex-1 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-transform hover:scale-105 shadow-md"
                            >
                               Xác Nhận Xóa
                            </button>
                         </div>
                      </div>
                   </motion.div>
                </motion.div>
             )}
          </AnimatePresence>
        </motion.div>
      )}
      {activeTab === "history" && (
        <motion.div 
          key="history-tab"
          id="history-logs-viewport"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="glass p-6 md:p-8 rounded-2xl relative max-w-6xl mx-auto"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Activity className="w-48 h-48" />
          </div>
          <div className="relative z-10 space-y-8">
             <div className="flex justify-between items-center border-b border-amber-600/20 dark:border-amber-500/30 pb-4">
               <h3 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">
                  Lịch Sử & Phong Độ Ôn Tập
               </h3>
               {user && (
                 <div className="bg-orange-500/15 border border-orange-500/30 text-orange-700 dark:text-orange-400 px-4 py-1.5 rounded-full font-bold flex items-center gap-1.5 text-sm">
                   <Flame className="w-4 h-4 animate-bounce" />
                   Chuỗi học tập hiện tại: {user.streak || 0} ngày
                 </div>
               )}
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               {/* BAN TRÁI: BẢN ĐỒ HOẠT ĐỘNG / CALENDAR VIEW */}
               <div className="lg:col-span-5 space-y-6">
                 <div className="card-3d p-5 rounded-2xl">
                   <div className="flex justify-between items-center mb-4">
                     <button onClick={navigatePrevMonth} className="p-2 border border-amber-500/20 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-bold shrink-0 cursor-pointer">
                       Trước
                     </button>
                     <span className="font-display font-bold text-lg text-stone-800 dark:text-stone-200">
                       {calendarMonthLabel}
                     </span>
                     <button onClick={navigateNextMonth} className="p-2 border border-amber-500/20 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition text-xs font-bold shrink-0 cursor-pointer">
                       Sau
                     </button>
                   </div>

                   {/* Grid Weekdays */}
                   <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs opacity-65 mb-2 py-1 text-stone-600 dark:text-stone-400">
                     {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((w, idx) => (
                       <div key={idx} className={idx === 0 ? "text-red-500" : ""}>{w}</div>
                     ))}
                   </div>

                   {/* Grid Days */}
                   <div className="grid grid-cols-7 gap-1.5 text-center">
                     {/* Empty slot fillers */}
                     {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                       <div key={`empty-${idx}`} className="w-8 h-8 md:w-10 md:h-10"></div>
                     ))}

                     {/* Month days */}
                     {calendarDays.map((dayNum) => {
                       const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                       const isActive = activeStudyDaysSet.has(dateKey);
                       const isToday = new Date().getDate() === dayNum && new Date().getMonth() === calendarMonth && new Date().getFullYear() === calendarYear;

                       return (
                         <div
                           key={dayNum}
                           className={cn(
                             "w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm transition relative select-none",
                             isActive
                               ? "bg-yellow-500 text-black font-extrabold shadow-[0_0_12px_rgba(234,179,8,0.5)] cursor-pointer"
                               : isToday
                               ? "border-2 border-yellow-500 text-yellow-600 dark:text-yellow-400 font-extrabold"
                               : "text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5"
                           )}
                           title={isActive ? `Bạn có hoạt động ôn tập ngày ${dayNum}/${calendarMonth + 1}` : `Ngày ${dayNum}/${calendarMonth + 1}`}
                         >
                           {dayNum}
                           {isActive && (
                             <span className="absolute -bottom-0.5 w-1 h-1 bg-black dark:bg-black rounded-full"></span>
                           )}
                         </div>
                       );
                     })}
                   </div>

                   {/* Legend */}
                   <div className="mt-6 pt-4 border-t border-amber-600/10 dark:border-amber-500/15 flex justify-center items-center gap-6 text-xs text-stone-600 dark:text-stone-400">
                     <div className="flex items-center gap-1.5">
                       <span className="w-3.5 h-3.5 rounded-full bg-yellow-500 flex items-center justify-center text-[8px] text-black font-bold">✔</span>
                       <span>Đã học / Streak</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                       <span className="w-3.5 h-3.5 rounded-full border-2 border-yellow-500"></span>
                       <span>Hôm nay</span>
                     </div>
                   </div>
                 </div>

                 {/* MOTIVATION CARD */}
                 <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/20 dark:from-yellow-500/5 dark:to-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center shadow-sm">
                   <Sparkles className="w-6 h-6 text-yellow-500 mx-auto mb-3 animate-pulse" />
                   <h4 className="font-display font-bold text-stone-800 dark:text-stone-200 mb-1">Duy trì Ngọn lửa Tự học</h4>
                   <p className="text-xs text-stone-600 dark:text-stone-400 italic max-w-sm mx-auto leading-relaxed">
                     Lịch biểu này ghi chép chuỗi ngày năng nổ rèn luyện của bạn. Hãy hoàn thiện bài tập mỗi ngày để duy trì streak tăng hạng!
                   </p>
                 </div>
               </div>

               {/* BAN PHẢI: LỊCH SỬ CHI TIẾT */}
               <div className="lg:col-span-7 space-y-4">
                  <h4 className="text-lg font-bold text-stone-700 dark:text-stone-300 flex items-center gap-2 mb-2">
                    <Activity className="w-4.5 h-4.5 text-yellow-500" /> Bản ghi ôn tập chi tiết
                  </h4>
                  
                  <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
                     {user && store.getReviewHistory(user.id).length > 0 ? (
                       store.getReviewHistory(user.id).map((record) => (
                         <motion.div 
                           key={record.id}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           className="card-3d p-4 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                         >
                           <div className="space-y-1">
                             <div className="flex items-center gap-2">
                                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-stone-200 dark:bg-zinc-700">{record.deckTitle}</span>
                                <span className="text-xs opacity-60 font-mono">{new Date(record.timestamp).toLocaleString()}</span>
                             </div>
                             <p className="font-bold text-sm md:text-base line-clamp-1">{record.front}</p>
                           </div>
                           <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-black/5">
                              {record.remembered ? (
                                 <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-full text-xs"><CheckCircle2 className="w-3.5 h-3.5"/> Nhớ mặt chữ</span>
                              ) : (
                                 <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full text-xs"><XCircle className="w-3.5 h-3.5"/> Chưa nhớ</span>
                              )}
                              <div className="font-mono text-sm w-16 text-right font-bold">
                                <span className={record.masteryChange >= 0 ? "text-green-500" : "text-red-500"}>
                                   {record.masteryChange > 0 ? "+" : ""}{record.masteryChange}%
                                 </span>
                              </div>
                           </div>
                         </motion.div>
                       ))
                     ) : (
                       <div className="text-center p-12 opacity-60 font-bold border-2 border-dashed border-amber-600/20 dark:border-amber-500/30 rounded-xl">
                          Chưa có lịch sử ôn tập. Hãy bắt đầu học!
                       </div>
                     )}
                  </div>
               </div>
             </div>
          </div>
        </motion.div>
      )}

      {/* Full-screen Expanded Chart Overlay */}
      <AnimatePresence>
      {isChartExpanded && (
        <motion.div 
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          className="modal-glass-overlay flex items-center justify-center p-4 md:p-8 z-[100]"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-stone-100/80 dark:bg-zinc-950/40 shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-amber-600/20 dark:border-amber-500/30 rounded-2xl w-full h-[95vh] sm:h-full max-w-6xl md:max-h-[800px] flex flex-col p-4 md:p-8 relative backdrop-blur-xl overflow-y-auto overflow-x-hidden"
          >
            <div className="flex justify-between items-center mb-6 border-b border-amber-600/20 dark:border-amber-500/30 pb-4 flex-wrap gap-4">
              <h3 className="text-2xl md:text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 flex items-center gap-3">
                <Activity className="w-8 h-8 text-yellow-500" /> Biểu Đồ Phong Độ Tuần
              </h3>
              <div className="flex items-center gap-4">
                <select 
                  value={chartPeriod} 
                  onChange={(e) => setChartPeriod(e.target.value as any)}
                  className="bg-stone-200/60 dark:bg-zinc-800/50 border border-amber-600/20 dark:border-amber-500/30 rounded-lg px-4 py-2 text-sm md:text-base font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none cursor-pointer"
                >
                  <option value="7_days">Last 7 Days</option>
                  <option value="30_days">Last 30 Days</option>
                  <option value="all_time">All Time</option>
                </select>
                <button 
                  onClick={() => setIsChartExpanded(false)}
                  className="p-3 bg-stone-200/60 dark:bg-zinc-800/50 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <Minimize2 className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    stroke="currentColor" 
                    fontSize={14}
                    tickLine={false}
                    axisLine={false}
                    opacity={0.7}
                    dy={10}
                  />
                  <YAxis 
                    stroke="currentColor"
                    fontSize={14}
                    tickLine={false}
                    axisLine={false}
                    opacity={0.7}
                    width={50}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    cursor={{ stroke: 'rgba(234,179,8,0.3)', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="points" 
                    stroke="#eab308" 
                    strokeWidth={4}
                    dot={{ fill: '#eab308', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: 'white', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>
      )}

      {studentToDelete && (
        <div className="modal-glass-overlay flex items-center justify-center p-4">
          <div className="modal-glass-content p-6 max-w-md w-full">
            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" /> Xác nhận xóa học sinh "{studentToDelete.name}"?
            </h4>
            <p className="text-sm opacity-85 mb-4">
              Bạn có quyền xóa hoặc khóa tài khoản học sinh này từ hệ thống Henosis.
            </p>
            
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider opacity-60">Phương thức xử lý:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteMode("hard")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                    deleteMode === "hard"
                      ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400"
                      : "border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-850"
                  )}
                >
                  <span>Xóa cứng (Hard)</span>
                  <span className="text-[10px] opacity-60 font-normal">Xóa sạch profile, nhóm và thẻ học</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteMode("soft")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                    deleteMode === "soft"
                      ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                      : "border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-850"
                  )}
                >
                  <span>Xóa mềm (Soft)</span>
                  <span className="text-[10px] opacity-60 font-normal">Ẩn tài khoản hoạt động nhưng giữ lịch sử</span>
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setStudentToDelete(null)}
                disabled={isDeletingStudent}
                className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-zinc-850 hover:bg-stone-300 dark:hover:bg-zinc-800 transition text-sm font-bold text-black dark:text-white"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleDeleteStudentSubmit}
                disabled={isDeletingStudent}
                className={cn(
                  "px-4 py-2 rounded-lg text-white transition text-sm font-bold flex items-center gap-1.5",
                  deleteMode === "hard" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {isDeletingStudent ? "Đang xử lý..." : "Xác nhận thực hiện"}
              </button>
            </div>
          </div>
        </div>
      )}
      </AnimatePresence>

      {/* Dynamic AI MCQ Quiz Setup Modal */}
      <AnimatePresence>
        {activeQuizSetup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/70 backdrop-blur-md"
            onClick={() => setActiveQuizSetup(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-stone-200 dark:border-zinc-850 rounded-3xl shadow-2xl p-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Sparkles className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-black text-stone-900 dark:text-stone-100 uppercase tracking-tight">Sinh Đề Thi AI</h3>
                    <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">{activeQuizSetup.subject}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveQuizSetup(null)}
                  className="p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-2">Số lượng câu hỏi trắc nghiệm</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20, 25, 30, 35, 40].map(count => (
                      <button
                        key={count}
                        onClick={() => setQuizQuestionCount(count)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-bold transition-all border outline-none cursor-pointer",
                          quizQuestionCount === count
                            ? "bg-amber-500 border-amber-600 text-black font-black shadow-md scale-105 hover:bg-amber-600"
                            : "bg-stone-100/60 dark:bg-zinc-900/65 border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/50 dark:hover:bg-zinc-800/80 hover:text-stone-900 dark:hover:text-stone-100"
                        )}
                      >
                        {count} câu
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-2 italic">
                    * Mặc định là 15 câu. Số lượng câu hỏi càng nhiều, Gemini sẽ hỗ trợ phân tích sâu hơn nhưng sẽ lâu hơn xíu m nha.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-2.5">
                <button
                  onClick={() => setActiveQuizSetup(null)}
                  className="flex-1 py-3 rounded-2xl text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-900 text-xs font-black uppercase tracking-wider border border-stone-200 dark:border-zinc-800 cursor-pointer transition"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    const setup = activeQuizSetup;
                    setActiveQuizSetup(null);
                    triggerQuiz(setup.subject, setup.decks, quizQuestionCount);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:scale-105 active:scale-95 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/10 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-black shrink-0" />
                  Bắt đầu thi AI
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <WeeklyStudyAnalyticsModal 
        isOpen={isWeeklyStudyModalOpen}
        onClose={() => setIsWeeklyStudyModalOpen(false)}
        userId={user?.id || ""}
      />

      {/* Quick-View Droplist / Modal Kính Mờ for Thẻ Nhắc Nhở */}
      <AnimatePresence>
        {showRemindLaterModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/70 backdrop-blur-md"
            onClick={() => setShowRemindLaterModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[85vh] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-stone-200/50 dark:border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Bell className="w-5 h-5 text-blue-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Danh Sách Nhắc Nhở</h3>
                    <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-0.5">
                      {remindLaterCards.length} từ vựng cần ưu tiên ôn tập nhanh
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {remindLaterCards.length > 0 && (
                    <button 
                      onClick={() => startRemindLaterStudy()}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm shadow-md hover:shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Cày Tất Cả
                    </button>
                  )}
                  <button 
                    onClick={() => setShowRemindLaterModal(false)}
                    className="p-2 rounded-full bg-stone-200/50 dark:bg-zinc-800/50 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-4 md:p-6 overflow-y-auto space-y-3 custom-scrollbar">
                {remindLaterCards.length === 0 ? (
                  <div className="py-12 text-center text-stone-500 dark:text-stone-400 flex flex-col items-center gap-3">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mb-2 opacity-80" />
                    <p className="font-medium text-lg">Tuyệt vời! Bạn không có thẻ nhớ gấp nào.</p>
                    <p className="text-sm opacity-80">Hãy tiếp tục duy trì tiến độ học tập nhé.</p>
                  </div>
                ) : (
                  remindLaterCards.map((card, idx) => {
                    const backVal = card.back || (card as any).meaning || "";
                    const cleanText = backVal ? backVal.replace(/[*_#`\\[\]]/g, '').substring(0, 150) : "";
                    const firstPart = cleanText.split(/[-;]/)[0] || cleanText;
                    
                    return (
                      <div 
                        key={card.id + idx}
                        className="group flex flex-col sm:flex-row gap-4 justify-between items-center bg-stone-100/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-stone-200 dark:border-zinc-800 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:bg-white dark:hover:bg-zinc-900 transition-all shadow-sm hover:shadow"
                      >
                        <div className="flex-1 w-full relative">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5 line-clamp-1 truncate">
                            <span className="text-lg font-bold text-stone-900 dark:text-white truncate">
                              {card.front || (card as any).word}
                            </span>
                            {(card.wordForm || (card as any).wordType) && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-stone-400 border border-stone-300 dark:border-zinc-700 shrink-0">
                                {card.wordForm || (card as any).wordType}
                              </span>
                            )}
                            {((card as any).phonetic || (card as any).pronunciation) && (
                              <span className="text-sm opacity-60 font-serif translate-y-px">
                                /{((card as any).phonetic || (card as any).pronunciation)}/
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
                             {firstPart || "Chưa có nghĩa chi tiết"}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0 w-full sm:w-auto items-center">
                          <button 
                            onClick={() => startRemindLaterStudy(card.id)}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all font-bold text-sm flex items-center justify-center gap-1.5 group-hover:shadow-md border-none cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Học Ngay
                          </button>
                          <button 
                            onClick={() => {
                              const updatedIds = remindLaterCardIds.filter(id => id !== card.id);
                              setRemindLaterCardIds(updatedIds);
                              localStorage.setItem("remind_later_items", JSON.stringify(updatedIds));
                            }}
                            className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all border-none cursor-pointer"
                            title="Xóa khỏi danh sách nhắc nhở"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gamified User Profile Modal */}
      <AnimatePresence>
        {selectedUserProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 dark:bg-black/70 backdrop-blur-md"
            onClick={() => setSelectedUserProfile(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-zinc-950/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-amber-400 to-amber-600 opacity-20"></div>
              
              <button 
                onClick={() => setSelectedUserProfile(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition z-10"
              >
                <XCircle className="w-6 h-6 text-stone-700 dark:text-stone-300" />
              </button>

              <div className="relative pt-12 pb-8 px-8 flex flex-col items-center">
                <div className={cn(
                  "w-24 h-24 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 dark:from-zinc-800 dark:to-zinc-900 border-4 border-white dark:border-zinc-950 shadow-xl flex items-center justify-center overflow-hidden mb-4 relative",
                  selectedUserProfile.avatarBorder === "bronze" ? "ring-4 ring-[#cd7f32] ring-offset-2 ring-offset-white dark:ring-offset-black" :
                  selectedUserProfile.avatarBorder === "silver" ? "ring-4 ring-[#c0c0c0] ring-offset-2 ring-offset-white dark:ring-offset-black" :
                  selectedUserProfile.avatarBorder === "gold" ? "ring-4 ring-[#ffd700] ring-offset-2 ring-offset-white dark:ring-offset-black" :
                  selectedUserProfile.avatarBorder === "diamond" ? "ring-4 ring-[#00ffff] ring-offset-2 ring-offset-white dark:ring-offset-black animate-pulse" : ""
                )}>
                  {selectedUserProfile.photoURL ? (
                    <img src={selectedUserProfile.photoURL} alt={selectedUserProfile.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-4xl font-bold font-mono opacity-50 uppercase">{selectedUserProfile.name ? selectedUserProfile.name.charAt(0) : "👤"}</span>
                  )}
                  {selectedUserProfile.streak && (
                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-orange-400 to-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-zinc-950 shadow-sm flex items-center gap-1">
                      <Flame className="w-3 h-3" /> {selectedUserProfile.streak}
                    </div>
                  )}
                </div>

                <h3 className="text-2xl font-display font-bold text-stone-900 dark:text-white mb-1">
                  {selectedUserProfile.name}
                </h3>
                
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                  {(() => {
                    const tier = getTier(selectedUserProfile.points || 0);
                    return (
                      <span className={cn("text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5", tier.color)}>
                        {tier.icon} {tier.name}
                      </span>
                    );
                  })()}
                  <UserRoleBadge role={selectedUserProfile.role} isSchoolLover={selectedUserProfile.isSchoolLover} isPro={selectedUserProfile.isPro} />
                </div>

                <div className="w-full grid grid-cols-2 gap-4">
                  <div className="bg-stone-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-stone-100 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                     <Target className="w-6 h-6 text-yellow-500 mb-2" />
                     <span className="text-3xl font-black font-mono text-stone-900 dark:text-white">
                       {selectedUserProfile.points || 0}
                     </span>
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1">Total Points</span>
                  </div>
                  
                  <div className="bg-stone-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-stone-100 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
                     <BrainCircuit className="w-6 h-6 text-blue-500 mb-2" />
                     <span className="text-3xl font-black font-mono text-stone-900 dark:text-white">
                       {rankTrends[selectedUserProfile.id] === 'up' ? '+' : ''}{selectedUserProfile.points || 0}
                     </span>
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 mt-1">Weekly Focus</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <InteractiveTutorial 
        isOpen={showTutorial} 
        onClose={() => {
          localStorage.setItem("hasRunTutorial", "true");
          setShowTutorial(false);
        }} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* HELP / RESTART TOUR FLOATING BUTTON */}
      <button
        onClick={() => {
          localStorage.removeItem("hasRunTutorial");
          setActiveTab("create_deck"); // Go directly to create_deck to let user see step 2, 3, 4, 5
          setShowTutorial(true);
        }}
        id="shortcuts-help-btn-anchor"
        className="fixed bottom-40 right-6 z-40 p-3 bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-550 text-stone-950 dark:text-stone-950 rounded-full shadow-[0_4px_20px_rgba(234,179,8,0.4)] hover:scale-110 active:scale-95 transition-all duration-200 flex items-center gap-2 font-black text-xs border border-yellow-400"
        title="Xem hướng dẫn nhanh sử dụng hệ thống"
      >
        <HelpCircle className="w-5 h-5 animate-bounce" />
        <span className="hidden md:inline">Hướng dẫn nhanh</span>
      </button>

    </div>
  );
}
