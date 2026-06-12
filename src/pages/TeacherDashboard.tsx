import React, { useState, useEffect, useRef } from "react";
import { store, Deck } from "../lib/store";
import { FileText, Upload, AlertCircle, AlertTriangle, BarChart3, Users, CheckCircle2, TrendingUp, Target, FileUp, BookOpen, Shield, Trash2, FolderOpen, Inbox, Layers, Settings, Check, X, RefreshCw, Plus, Heart, LogOut, ChevronDown, ChevronUp, Lock, Sparkles } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { safeRequest } from "../utils/apiClient";
import ReactMarkdown from "react-markdown";
import ErrorNotification from "../components/ErrorNotification";
import DocumentConverter from "../components/DocumentConverter";
import { ServiceMonitor } from "./AdminKeysDashboard";
import { DashboardSkeleton } from "../components/DashboardSkeleton";
import { GlobalActivityFeed } from "../components/GlobalActivityFeed";
import { v4 as uuidv4 } from "uuid";

export default function TeacherDashboard() {
  useEffect(() => {
    document.title = "Henosis - Teacher Dashboard";
  }, []);

  const user = store.getCurrentUser();
  
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [isDeletingSet, setIsDeletingSet] = useState(false);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);

  const [showBulkConfirmDeleteDecks, setShowBulkConfirmDeleteDecks] = useState(false);
  const [isBulkDeletingDecks, setIsBulkDeletingDecks] = useState(false);

  const [showBulkConfirmDeleteStudents, setShowBulkConfirmDeleteStudents] = useState<"hard" | "soft" | null>(null);
  const [isBulkDeletingStudents, setIsBulkDeletingStudents] = useState(false);

  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [localDecks, setLocalDecks] = useState<any[]>(() => store.getDecks());
  const [isLibraryExpanded, setIsLibraryExpanded] = useState(false);

  // New States for Admin Library Enhancement (Nested Markdown, Rename Category, Bulk Move)
  const [libraryViewMode, setLibraryViewMode] = useState<"grid" | "markdown">("grid");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategoryName, setIsSavingCategoryName] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  const toggleCategory = (subject: string) => {
    setExpandedCategories(prev => ({ ...prev, [subject]: !prev[subject] }));
  };
  
  const [showMoveBulkModal, setShowMoveBulkModal] = useState(false);
  const [targetMoveCategory, setTargetMoveCategory] = useState("");
  const [isNewCategoryInput, setIsNewCategoryInput] = useState(false);
  const [isMovingBulk, setIsMovingBulk] = useState(false);

  // AI Lesson Plan States
  const [lessonTopic, setLessonTopic] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [lessonPlanData, setLessonPlanData] = useState<any>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);

  const [isAiSystemBusy, setIsAiSystemBusy] = useState(false);
  const [aiBusyType, setAiBusyType] = useState<string | null>(null);

  useEffect(() => {
    const checkBusy = () => {
      if ((window as any).AI_BUSY) {
        setIsAiSystemBusy(true);
        setAiBusyType((window as any).AI_BUSY_TYPE || "syllabus");
      }
    };
    checkBusy();

    const handleAiBusyChange = (e: any) => {
      const { isBusy, type } = e.detail;
      setIsAiSystemBusy(isBusy);
      setAiBusyType(type);
    };

    window.addEventListener("ai-busy-change", handleAiBusyChange);
    return () => {
      window.removeEventListener("ai-busy-change", handleAiBusyChange);
    };
  }, []);

  const triggerServerAndClientLock = async (userId: string) => {
    try {
      await safeRequest("/api/automation/lock-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "syllabus", userId })
      });
    } catch (err) {
      console.warn("Failed to lock AI on server:", err);
    }
    window.dispatchEvent(new CustomEvent("ai-busy-change", { detail: { isBusy: true, type: "syllabus" } }));
  };

  const triggerServerAndClientUnlock = async () => {
    try {
      await safeRequest("/api/automation/unlock-ai", {
        method: "POST"
      });
    } catch (err) {
      console.warn("Failed to unlock AI on server:", err);
    }
    window.dispatchEvent(new CustomEvent("ai-busy-change", { detail: { isBusy: false, type: null } }));
  };

  // Safe cleanup release on unmount to make sure no block is orphaned
  useEffect(() => {
    return () => {
      triggerServerAndClientUnlock();
    };
  }, []);

  const [adminKey, setAdminKey] = useState("");
  useEffect(() => {
    if (user?.role === "teacher" || user?.role === "admin" || user?.role === "Admin") {
      const storedKey = (import.meta as any).env?.VITE_ADMIN_KEY || "seneca";
      setAdminKey(storedKey);
    }
  }, [user?.role]);
  
  // Customization & Anti-Duplication States
  const [planTitle, setPlanTitle] = useState("");
  const [planSubject, setPlanSubject] = useState("");
  const [isCreatingNewSubjectPlan, setIsCreatingNewSubjectPlan] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const isSavingPlanRef = useRef(false);
  const isGeneratingPlanRef = useRef(false);

  const existingSubjects = React.useMemo(() => {
    const subjectsSet = new Set<string>();
    localDecks.forEach(d => {
      const s = (typeof d.subject === 'string' ? d.subject : JSON.stringify(d.subject)) || "general";
      if (s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
    return Array.from(subjectsSet);
  }, [localDecks]);

  const handleGenerateLessonPlan = async () => {
    if (!lessonTopic.trim() || isGeneratingPlanRef.current) return;
    isGeneratingPlanRef.current = true;
    setIsGeneratingPlan(true);
    setLessonError(null);
    setLessonPlanData(null);
    try {
      const currentUserProfile = store.getCurrentUser();
      await triggerServerAndClientLock(currentUserProfile?.id || "anonymous");

      const res = await safeRequest("/api/agent/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: lessonTopic })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response. Please try again.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gặp lỗi khi tạo giáo án");
      setLessonPlanData(JSON.parse(data.result));
      
      // Khởi tạo giá trị mặc định cho UI tùy chỉnh
      setPlanTitle(`Giáo án: ${lessonTopic}`);
      setPlanSubject(lessonTopic);
    } catch (err: any) {
      console.error(err);
      setLessonError(err.message);
    } finally {
      isGeneratingPlanRef.current = false;
      setIsGeneratingPlan(false);
      await triggerServerAndClientUnlock();
    }
  };

  const handleSaveLessonPlanAsDeck = async () => {
    if (!lessonPlanData || isSavingPlanRef.current) return;
    isSavingPlanRef.current = true;
    setIsSavingPlan(true); // Ngăn chặn nháy đúp (duplicate)
    
    try {
      const newDeckId = `deck_${uuidv4()}`;
      const newDeckObj = {
        id: newDeckId,
        title: planTitle.trim() || `Giáo án: ${lessonTopic}`,
        subject: planSubject.trim() || lessonTopic,
        cards: lessonPlanData.flashcards?.map((c: any) => ({
          id: `card_${uuidv4()}`,
          front: c.front,
          back: c.back,
          subject: planSubject.trim() || lessonTopic,
          mastery: 0,
          nextReview: Date.now(),
          isHard: false
        })) || []
      };

      // store.addDeck covers both pushing locally and saving to Firebase
      await store.addDeck(newDeckObj);
      
      alert("Đã lưu giáo án thành bộ thẻ thành công!");
      setLessonPlanData(null);
      setLessonTopic("");
      setPlanTitle("");
      setPlanSubject("");
    } catch (err) {
      console.error(err);
      alert("Lỗi khi lưu bộ thẻ!");
    } finally {
      isSavingPlanRef.current = false;
      setIsSavingPlan(false);
    }
  };

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const unsubUsersRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let isMounted = true;
    if (unsubUsersRef.current) unsubUsersRef.current();
    const initUsersSync = async () => {
      try {
        const { db, FirebaseListenerManager } = await import("../lib/firebase");
        const { collection, onSnapshot, query, limit } = await import("firebase/firestore");
        if (!isMounted) return;
        const q = query(collection(db, "users"), limit(100));
        const unsub = onSnapshot(q, (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          if (!isMounted) return;
          React.startTransition(() => {
            setDbUsers(list);
          });
        }, (err) => {
          console.error("Teacher student sync error:", err);
        });
        if (!isMounted) {
          unsub();
          return;
        }
        unsubUsersRef.current = unsub;
        FirebaseListenerManager.add("TeacherDashboard_users", unsub);
      } catch (e) {
        console.error("Failed to sync students list:", e);
      }
    };
    initUsersSync();
    return () => {
      isMounted = false;
      if (unsubUsersRef.current) unsubUsersRef.current();
      import("../lib/firebase").then(({ FirebaseListenerManager }) => {
        FirebaseListenerManager.remove("TeacherDashboard_users");
      }).catch(console.error);
    };
  }, []);

  const unsubDecksRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let isMounted = true;
    if (unsubDecksRef.current) unsubDecksRef.current();
    const initDecksSync = async () => {
      try {
        const { db, FirebaseListenerManager } = await import("../lib/firebase");
        const { collection, onSnapshot } = await import("firebase/firestore");
        if (!isMounted) return;
        const unsub = onSnapshot(collection(db, "sets"), (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && Array.isArray(data.cards)) {
              data.cards = data.cards.map((c: any) => ({
                ...c,
                mastery: (typeof c.mastery === 'number' && !isNaN(c.mastery)) ? c.mastery : 0
              }));
            }
            list.push(data);
          });
          if (!isMounted) return;
          React.startTransition(() => {
            setLocalDecks(list);
            setIsInitialLoading(false);
          });

          const syncBack = async () => {
            const { store: globalStore } = await import("../lib/store");
            if (globalStore && typeof (globalStore as any).setDecksLocally === "function") {
              (globalStore as any).setDecksLocally(list);
            }
          };
          syncBack();
        });
        if (!isMounted) {
          unsub();
          return;
        }
        unsubDecksRef.current = unsub;
        FirebaseListenerManager.add("TeacherDashboard_decks", unsub);
      } catch (e) {
        console.error("Failed to sync sets in TeacherDashboard:", e);
        if (isMounted) setIsInitialLoading(false);
      }
    };
    initDecksSync();
    return () => {
      isMounted = false;
      if (unsubDecksRef.current) {
        unsubDecksRef.current();
        unsubDecksRef.current = null;
      }
      import("../lib/firebase").then(({ FirebaseListenerManager }) => {
        FirebaseListenerManager.remove("TeacherDashboard_decks");
      }).catch(console.error);
    };
  }, []);

  const [studentToDelete, setStudentToDelete] = useState<any | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"hard" | "soft">("hard");
  const [isSyncingGhostUsers, setIsSyncingGhostUsers] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const generatedMarkdown = React.useMemo(() => {
    let md = `# THƯ VIỆN HỌC PHẦN COSTUDY HENOSIS\n\n`;
    md += `*Tổng số học phần hiện tại: **${localDecks.length}** bộ thẻ.*\n\n`;
    md += `---\n\n`;
    
    const categoryGroup = localDecks.reduce((acc, deck) => {
      const subj = (typeof deck.subject === "string" ? deck.subject : JSON.stringify(deck.subject)) || "Chưa phân loại";
      const cleaned = subj.trim();
      if (!acc[cleaned]) acc[cleaned] = [];
      acc[cleaned].push(deck);
      return acc;
    }, {} as Record<string, Deck[]>);
    
    Object.entries(categoryGroup as Record<string, Deck[]>).forEach(([sub, subDecks]) => {
      md += `## 📂 Chuyên mục: ${sub}\n\n`;
      subDecks.forEach((deck, idx) => {
        const totalCards = deck.cards?.length || 0;
        const systemDecks = ["deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"];
        const creator = systemDecks.includes(deck.id) ? "Hệ thống" : (deck.creatorName || "CoStudy");
        md += `${idx + 1}. **${deck.title}** - *${totalCards} thẻ*\n`;
        md += `   - ID: \`${deck.id}\`\n`;
        md += `   - Người tạo: *${creator}*\n`;
        if ((deck as any).description) {
          md += `   - Mô tả: ${(deck as any).description}\n`;
        }
        md += `\n`;
      });
      md += `---\n\n`;
    });
    
    return md;
  }, [localDecks]);

  if (user?.role !== "teacher" && user?.role !== "admin" && user?.role !== "Admin") return <Navigate to="/dashboard" replace />;
  if (isInitialLoading) return <DashboardSkeleton />;

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

  const handleSyncGhostUsers = async () => {
    setIsSyncingGhostUsers(true);
    setSyncMessage(null);
    try {
      const { auth } = await import("../lib/firebase");
      let idToken = "";
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }

      const response = await fetch("/api/admin/sync-ghost-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": idToken ? `Bearer ${idToken}` : "",
          "x-admin-key": adminKey || ""
        }
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error && (data.error.includes("GOOGLE_SERVICE_ACCOUNT_KEY") || data.error.includes("Google Service Account"))) {
          setSyncMessage(`info:${data.error}`);
          return;
        }
        throw new Error(data.error || "Gặp lỗi khi đồng bộ dọn dẹp.");
      }
      setSyncMessage(data.message || "Đồng bộ thành công!");
      // Briefly reset the sync message after 10 seconds
      setTimeout(() => {
        setSyncMessage(null);
      }, 10000);
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("GOOGLE_SERVICE_ACCOUNT_KEY") || err.message.includes("Google Service Account"))) {
        setSyncMessage(`info:${err.message}`);
      } else {
        setSyncMessage(`Lỗi: ${err.message}`);
      }
    } finally {
      setIsSyncingGhostUsers(false);
    }
  };

  const users = dbUsers.length > 0
    ? dbUsers.filter(u => u.role === "student" && u.status !== "disabled" && u.isAnonymous !== true && u.name !== "Guest Student")
    : (store.getCurrentUser() && !store.getCurrentUser()?.isAnonymous)
      ? []
      : store.getUsers().filter(u => u.role === "student" && u.isAnonymous !== true && u.name !== "Guest Student");
  const decks = localDecks;

  // Compute nested markdown text representation of deck library

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || oldName === trimmedNewName) {
      setEditingCategory(null);
      return;
    }
    setIsSavingCategoryName(true);
    try {
      const { db } = await import("../lib/firebase");
      const { collection, getDocs, writeBatch } = await import("firebase/firestore");
      
      const setsRef = collection(db, "sets");
      const querySnapshot = await getDocs(setsRef);
      const batch = writeBatch(db);
      let count = 0;
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.subject === oldName) {
          batch.update(docSnap.ref, { subject: trimmedNewName });
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
      }
      
      // Update local state store
      const updated = localDecks.map(d => {
        if (d.subject === oldName) {
          return { ...d, subject: trimmedNewName };
        }
        return d;
      });
      setLocalDecks(updated);
      setEditingCategory(null);
    } catch (err: any) {
      console.error("Lỗi khi đổi tên category:", err);
      alert("Có lỗi xảy ra khi đổi tên: " + err.message);
    } finally {
      setIsSavingCategoryName(false);
    }
  };

  const handleMoveDecksBulk = async () => {
    const destination = targetMoveCategory.trim();
    if (!destination) {
      alert("Vui lòng chọn hoặc điền tên chuyên mục đích.");
      return;
    }
    setIsMovingBulk(true);
    try {
      const { db } = await import("../lib/firebase");
      const { writeBatch, doc } = await import("firebase/firestore");
      const batch = writeBatch(db);
      
      selectedDeckIds.forEach((id) => {
        batch.update(doc(db, "sets", id), { subject: destination });
      });
      
      await batch.commit();
      
      // Update local state
      const updated = localDecks.map(deck => {
        if (selectedDeckIds.includes(deck.id)) {
          return { ...deck, subject: destination };
        }
        return deck;
      });
      
      setLocalDecks(updated);
      setSelectedDeckIds([]);
      setShowMoveBulkModal(false);
      setTargetMoveCategory("");
      setIsNewCategoryInput(false);
    } catch (err: any) {
      console.error("Lỗi khi di dời loạt thẻ:", err);
      alert("Gặp lỗi khi di dời: " + err.message);
    } finally {
      setIsMovingBulk(false);
    }
  };

  // Tính toán Class Overall Progress từ tiến trình học thực tế (averageMastery) của tất cả học sinh
  const studentUsers = users.filter(u => u.role === "student" && u.status !== "disabled");
  const classProgress = studentUsers.length > 0
    ? Math.round(studentUsers.reduce((sum, u) => sum + (Number(u.averageMastery) || 0), 0) / studentUsers.length)
    : 0;

  // Vùng hổng kiến thức (AI Weakness Detection)
  const allWeakCards = decks.flatMap(d => (d.cards || []).filter(c => {
    // Nếu được đánh dấu Khó thì chắc chắn là yếu
    if (c.isHard) return true;
    
    // Bỏ qua nếu là thẻ mới tạo chưa ai học
    if (c.isNewCard === true || c.isNewCard === undefined && c.mastery === 0 && (c.repetitionCount === undefined || c.repetitionCount === 0)) {
        // Cần xem xét thêm nếu thẻ có isNewCard undefined nhưng mastery = 0 và không có số lần lặp thì cũng coi như chưa học
        if (!(c.isNewCard === false || (c.repetitionCount !== undefined && c.repetitionCount > 0) || (c.easeFactor !== undefined && c.easeFactor !== 2.5))) {
             return false;
        }
    }

    // Điểm mastery thấp hơn hoặc bằng 40, nhưng phải thực sự đã được học ít nhất 1 lần mới tính là hổng kiến thức
    const hasBeenStudied = c.isNewCard === false || (c.repetitionCount !== undefined && c.repetitionCount > 0) || (c.easeFactor !== undefined && c.easeFactor !== 2.5) || (c.mastery > 0 && c.mastery <= 40);
    return c.mastery <= 40 && hasBeenStudied;
  }));
  const topWeakest = allWeakCards.sort((a, b) => a.mastery - b.mastery).slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in pb-12 w-full max-w-full overflow-x-hidden">
      {/* Banner chế độ xem Student */}
      {user && (user.role === "admin" || user.role === "Admin" || user.role === "teacher") && (
        <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-900 dark:text-violet-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-violet-500 animate-[pulse_2s_infinite] shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Bạn đang ở Admin View</span>. Xem kết quả học tập của cả lớp, thiết lập câu hỏi, quản lý key và chỉnh sửa giáo án.
            </div>
          </div>
          <button 
            onClick={() => {
              sessionStorage.setItem('isAdminMode', 'false');
              window.location.href = '/dashboard';
            }}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white font-extrabold text-xs rounded-lg transition-all duration-300 shadow-md whitespace-nowrap cursor-pointer animate-[pulse_3s_infinite]"
          >
            Sang Học Viên View (Student View) 📖
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 bg-black dark:bg-white text-white dark:text-black p-8 rounded-3xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">Admin Console</h2>
          <p className="opacity-80 mt-1">Data-driven teaching overview.</p>
        </div>
        <div className="relative z-10 flex text-left space-x-6">
           <div>
             <p className="text-sm font-bold opacity-60 uppercase mb-1">Class Progress</p>
             <p className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">{classProgress}%</p>
           </div>
           <div>
             <p className="text-sm font-bold opacity-60 uppercase mb-1">Active Students</p>
             <p className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500">{users.length}</p>
           </div>
           {(user?.role === "teacher" || user?.role === "admin" || user?.role === "Admin") && (
             <div className="hidden md:block">
               <p className="text-sm font-bold opacity-60 uppercase mb-1">System Health</p>
               <a href="#monitor" className="inline-flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-stone-100 dark:border-zinc-700 px-4 py-2 rounded-xl transition text-sm font-bold">
                 <Settings className="w-4 h-4" />
                 Monitor Keys
               </a>
             </div>
           )}
        </div>
        <BarChart3 className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-64 h-64 opacity-10" />
      </div>

      {(user?.role === "teacher" || user?.role === "admin" || user?.role === "Admin") && (
        <div className="md:hidden flex flex-col gap-2">
          <a href="#monitor" className="inline-flex items-center gap-2 bg-stone-100/50 hover:bg-stone-200/50 text-stone-900 dark:bg-zinc-800/50 dark:hover:bg-zinc-700/50 dark:text-stone-100 px-4 py-3 rounded-xl transition text-sm font-bold w-full justify-center border border-stone-200 dark:border-zinc-800">
            <Settings className="w-4 h-4" />
            API Keys Health Monitor
          </a>
          <button
             onClick={async () => {
                try {
                  const { signOut } = await import("firebase/auth");
                  const { auth, db, FirebaseListenerManager } = await import("../lib/firebase");
                  
                  if (auth.currentUser?.uid) {
                     try {
                         const { doc, deleteDoc } = await import("firebase/firestore");
                         await deleteDoc(doc(db, "costudy_room", auth.currentUser.uid));
                     } catch (roomErr) {
                         console.error("Cleanup error:", roomErr);
                     }
                  }
            
                  if (auth.currentUser?.isAnonymous) {
                      try {
                         const { dbService } = await import("../lib/firebase");
                         await dbService.deleteUserProfile(auth.currentUser.uid);
                         await auth.currentUser.delete();
                      } catch (delError) {}
                  } else {
                      await signOut(auth);
                  }
                  store.logout();
                  FirebaseListenerManager.clearAll();
                  sessionStorage.removeItem('isAdminMode');
                  window.location.href = "/";
                } catch (error) {
                  console.error("Lỗi đăng xuất:", error);
                }
            }}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl transition text-sm font-bold w-full justify-center border border-red-500/20"
          >
            <LogOut className="w-4 h-4" /> Đăng Xuất
          </button>
        </div>
      )}

      <DocumentConverter />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Cột 1: Pipeline & Students */}
        <div className="space-y-8">
          
          {/* MỚI: AI SINH GIÁO ÁN NHANH */}
          <section className="glass p-6 rounded-2xl space-y-4 border border-violet-500/10 dark:border-violet-400/10 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-violet-500 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-xl">
              Option 3: Sinh Giáo Án Nhanh
            </div>
            
            <h3 className="text-xl font-display font-medium flex items-center gap-2 text-stone-800 dark:text-stone-100">
              <Layers className="w-5 h-5 text-violet-500" /> AI Tạo Giáo Án & Flashcard 
            </h3>
            
            <p className="text-sm opacity-70">
              Nhập chủ đề (vd: "Thế chiến thứ 2"), AI sẽ tạo sẵn lộ trình, khái niệm cốt lõi và flashcard trong ít giây.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                type="text"
                className="flex-1 min-w-0 bg-stone-200/60 dark:bg-zinc-800/50 border border-amber-600/20 dark:border-amber-500/30 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 outline-none transition font-medium text-base md:text-lg min-h-[3rem]"
                placeholder="Nhập chủ đề (Ví dụ: Định luật Newton)"
                value={lessonTopic}
                onChange={e => setLessonTopic(e.target.value)}
                disabled={isGeneratingPlan || isAiSystemBusy}
              />
              <button 
                onClick={handleGenerateLessonPlan}
                disabled={isGeneratingPlan || isAiSystemBusy || !lessonTopic.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 px-6 rounded-xl transition disabled:opacity-50 whitespace-nowrap min-h-[3rem] shrink-0 flex items-center justify-center gap-1.5"
              >
                {isGeneratingPlan ? (
                  "Đang tạo..."
                ) : isAiSystemBusy ? (
                  <>
                    <Lock className="w-4 h-4 text-violet-300 animate-pulse" /> AI đang bận...
                  </>
                ) : (
                  "Sinh giáo án"
                )}
              </button>
            </div>

            {lessonError && (
              <ErrorNotification message={lessonError} onRetry={handleGenerateLessonPlan} />
            )}

            {lessonPlanData && (
              <div className="mt-6 bg-stone-100/60 dark:bg-zinc-900/50 p-4 rounded-xl space-y-4 border border-violet-500/20">
                <div>
                  <h4 className="font-bold text-violet-700 dark:text-violet-400 mb-2 border-b border-violet-500/20 pb-1">1. Lộ trình học ({lessonPlanData.roadmap?.length} bước)</h4>
                  <ul className="space-y-2">
                    {lessonPlanData.roadmap?.map((r: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <strong className="text-stone-800 dark:text-stone-200">Bước {r.step}: {r.title}</strong> - <span className="opacity-80">{r.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-violet-700 dark:text-violet-400 mb-2 border-b border-violet-500/20 pb-1">2. Khái niệm cốt lõi ({lessonPlanData.concepts?.length})</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {lessonPlanData.concepts?.map((c: any, idx: number) => (
                      <li key={idx} className="text-sm">
                        <strong className="text-stone-800 dark:text-stone-200">{c.term}:</strong> <span className="opacity-80">{c.definition}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-violet-700 dark:text-violet-400 mb-2 border-b border-violet-500/20 pb-1">3. Thẻ bộ nhớ (Flashcards)</h4>
                  <p className="text-xs opacity-70 mb-3">Có {lessonPlanData.flashcards?.length} thẻ được tạo.</p>
                  
                  <div className="space-y-3 mb-4 bg-stone-200/50 dark:bg-zinc-800/50 p-4 rounded-xl border border-stone-300/40 dark:border-zinc-700/50">
                    <div>
                      <label className="text-xs font-bold uppercase opacity-70 mb-1 block">Tên Học Phần</label>
                      <input 
                        type="text" 
                        value={planTitle} 
                        onChange={(e) => setPlanTitle(e.target.value)} 
                        className="w-full input-3d px-3 py-2 text-sm text-stone-900 dark:text-stone-100"
                        placeholder="VD: Giáo án: Thế chiến thứ 2"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase opacity-70 mb-1 block">Phân loại / Danh mục</label>
                      {!isCreatingNewSubjectPlan ? (
                        <div className="flex gap-2">
                          <select
                            value={planSubject}
                            onChange={(e) => {
                              if (e.target.value === "__NEW__") {
                                setIsCreatingNewSubjectPlan(true);
                                setPlanSubject("");
                              } else {
                                setPlanSubject(e.target.value);
                              }
                            }}
                            className="flex-1 input-3d px-3 py-2 text-sm text-stone-900 dark:text-stone-100 bg-stone-200/60 dark:bg-zinc-850"
                          >
                            <option value="">-- Chọn phân loại hiện có --</option>
                            {existingSubjects.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                            <option value="__NEW__" className="text-violet-600 dark:text-violet-400 font-bold">+ Thêm phân loại mới...</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNewSubjectPlan(true);
                              setPlanSubject("");
                            }}
                            className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl flex items-center justify-center transition shadow-md border-b-2 border-violet-800"
                            title="Thêm danh mục mới"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={planSubject} 
                            onChange={(e) => setPlanSubject(e.target.value)} 
                            className="flex-1 input-3d px-3 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
                            placeholder="Nhập danh mục mới (VD: Sinh học)"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingNewSubjectPlan(false);
                              setPlanSubject(existingSubjects[0] || "");
                            }}
                            className="px-3 bg-stone-300 dark:bg-zinc-800 hover:bg-stone-400 text-stone-800 dark:text-stone-200 rounded-xl text-xs font-bold border border-stone-400/30"
                          >
                            Quay lại
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveLessonPlanAsDeck}
                    disabled={isSavingPlan}
                    className="w-full btn-3d bg-yellow-500 text-black py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSavingPlan ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                        Đang lưu...
                      </>
                    ) : "Lưu toàn bộ thành Bộ thẻ (Deck)"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="glass p-6 rounded-2xl relative">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
              <div>
                <h3 className="text-xl font-display font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> Quản lý danh sách Học sinh
                </h3>
                <p className="text-sm opacity-70">Thống kê nhanh các học sinh đang hoạt động.</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={handleSyncGhostUsers}
                  disabled={isSyncingGhostUsers}
                  className="bg-stone-300/60 hover:bg-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-900 dark:text-stone-100 disabled:opacity-50 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5 border-none cursor-pointer"
                  title="Dọn dẹp và đồng bộ các tài khoản đã bị xóa trên Firebase"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isSyncingGhostUsers && "animate-spin")} />
                  <span>{isSyncingGhostUsers ? "Đang quét..." : "Đồng bộ Auth"}</span>
                </button>
                {selectedStudentIds.length > 0 && (
                  <button
                    onClick={() => setShowBulkConfirmDeleteStudents("hard")}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow transition flex items-center gap-1.5 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" /> Xóa các mục đã chọn ({selectedStudentIds.length})
                  </button>
                )}
              </div>
            </div>

            {syncMessage && (
              <div className={cn(
                "p-3 rounded-xl text-xs font-bold mb-4 flex items-center gap-2 transition-all duration-300",
                syncMessage.startsWith("Lỗi:") 
                  ? "bg-red-500/10 border border-red-500/20 text-red-500"
                  : "bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400"
              )}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3 px-1">
              <input
                type="checkbox"
                title="Chọn tất cả"
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-stone-200 border-stone-300 dark:bg-zinc-800 dark:border-zinc-700"
                checked={users.length > 0 && selectedStudentIds.length === users.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedStudentIds(users.map(u => u.id));
                  else setSelectedStudentIds([]);
                }}
              />
              <span className="text-sm font-bold opacity-80 cursor-pointer select-none" onClick={() => setSelectedStudentIds(users.length > 0 && selectedStudentIds.length === users.length ? [] : users.map(u => u.id))}>Chọn tất cả ({users.length})</span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {users.map((u, index) => {
                const masteredSets = decks.filter(d => {
                  // Simulate stable mastery check per student based on id
                  const hash = u.id.length + d.id.length;
                  return hash % 2 === 0;
                }).map(d => typeof d.title === 'string' ? d.title : JSON.stringify(d.title));
                return (
                  <div key={u.id} className="p-3 bg-stone-200/60 dark:bg-zinc-800/50 rounded-xl border border-amber-600/20 dark:border-amber-500/30 flex items-start gap-3">
                    <input
                      type="checkbox"
                      title="Chọn học sinh"
                      className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-stone-100 border-stone-300 dark:bg-zinc-900 dark:border-zinc-700 shrink-0 cursor-pointer"
                      checked={selectedStudentIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudentIds(prev => [...prev, u.id]);
                        else setSelectedStudentIds(prev => prev.filter(id => id !== u.id));
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="font-bold text-sm md:text-base break-words text-stone-900 dark:text-stone-100">{u.name}</span>
                            <span className="text-[10px] sm:text-xs font-mono font-bold text-yellow-600 dark:text-yellow-400 shrink-0 bg-yellow-500/10 px-1.5 py-0.5 rounded">(XP: {u.points || 0})</span>
                            <span className="text-[10px] sm:text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">Progress: {u.averageMastery || 0}%</span>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const { dbService } = await import("../lib/firebase");
                                  const nextState = !(u.isPro || u.isSchoolLover);
                                  await dbService.updateUserProfile(u.id, { isPro: nextState, isSchoolLover: nextState });
                                  setDbUsers(prev => prev.map(item => item.id === u.id ? { ...item, isPro: nextState, isSchoolLover: nextState } : item));
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold transition flex items-center gap-1 shrink-0 border border-transparent cursor-pointer",
                                (u.isPro || u.isSchoolLover)
                                  ? "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30 font-bold"
                                  : "bg-stone-300/50 dark:bg-zinc-700/50 text-stone-500 dark:text-stone-400 hover:border-pink-500/30"
                              )}
                              title={(u.isPro || u.isSchoolLover) ? "Bật Pro thành công. Click để hủy." : "Nhấp kích hoạt Pro"}
                            >
                              <Heart className={cn("w-3 h-3", (u.isPro || u.isSchoolLover) ? "fill-pink-500 text-pink-500 animate-pulse" : "text-stone-400")} />
                              <span>{u.isPro || u.isSchoolLover ? "Yêu trường (Pro)" : "Kích hoạt Pro"}</span>
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setStudentToDelete(u)}
                            className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm shrink-0 self-end sm:self-center"
                            title="Xóa học sinh này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                        <p className="text-xs opacity-70 truncate mt-1">
                          Sets: {masteredSets.length > 0 ? masteredSets.join(", ") : "None yet"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass p-6 rounded-2xl">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 pb-3 border-b border-stone-200/40 dark:border-zinc-800/60">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-display font-black flex items-center gap-2 text-stone-900 dark:text-stone-100">
                  <BookOpen className="w-5 h-5 text-yellow-500" /> Thư viện thẻ bài (Hệ thống & Tự tạo)
                </h3>
                
                <button
                  type="button"
                  onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 border-none",
                    isLibraryExpanded
                      ? "bg-amber-500 text-black hover:bg-amber-600"
                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/20"
                  )}
                >
                  {isLibraryExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Thu gọn thư viện</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>📂 Hiện thư viện ({decks.length})</span>
                    </>
                  )}
                </button>

                {isLibraryExpanded && (
                  <div className="flex bg-stone-100 dark:bg-zinc-900 rounded-lg p-0.5 border border-stone-250 dark:border-zinc-800/80 shrink-0">
                    <button
                      type="button"
                      onClick={() => setLibraryViewMode("grid")}
                      className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-black transition border-none cursor-pointer",
                        libraryViewMode === "grid"
                          ? "bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-sm"
                          : "text-stone-500 hover:text-stone-700"
                      )}
                    >
                      🎴 DẠNG CARD
                    </button>
                    <button
                      type="button"
                      onClick={() => setLibraryViewMode("markdown")}
                      className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-black transition border-none cursor-pointer",
                        libraryViewMode === "markdown"
                          ? "bg-white dark:bg-zinc-800 text-yellow-600 dark:text-yellow-400 shadow-sm"
                          : "text-stone-500 hover:text-stone-700"
                      )}
                    >
                      📝 DẠNG MARKDOWN
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 items-center flex-wrap w-full lg:w-auto">
                {selectedDeckIds.length > 0 && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setShowBulkConfirmDeleteDecks(true)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shadow transition flex items-center gap-1 shrink-0 border-none cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa ({selectedDeckIds.length})
                    </button>
                    
                    <button
                      onClick={() => {
                        setTargetMoveCategory("");
                        setIsNewCategoryInput(false);
                        setShowMoveBulkModal(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shadow transition flex items-center gap-1 shrink-0 border-none cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> Dời ({selectedDeckIds.length}) sang chuyên mục...
                    </button>
                  </div>
                )}
                <Link to="/admin/create-cards" className="bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-black shadow hover:bg-yellow-600 transition flex items-center gap-1.5 shrink-0 ml-auto lg:ml-0">
                  <Plus className="w-4 h-4 text-black stroke-[3]" /> Tạo học phần mới
                </Link>
              </div>
            </div>

            {isLibraryExpanded ? (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-2 mb-4 px-1">
                  <input
                    type="checkbox"
                    title="Chọn tất cả"
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-stone-200 border-stone-300 dark:bg-zinc-800 dark:border-zinc-700 cursor-pointer"
                    checked={decks.length > 0 && selectedDeckIds.length === decks.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDeckIds(decks.map(d => d.id));
                      else setSelectedDeckIds([]);
                    }}
                  />
                  <span className="text-xs font-black opacity-80 cursor-pointer select-none" onClick={() => setSelectedDeckIds(decks.length > 0 && selectedDeckIds.length === decks.length ? [] : decks.map(d => d.id))}>XÁC THỰC CHECKBOX TOÀN BỘ THƯ VIỆN ({decks.length})</span>
                </div>

                {libraryViewMode === "markdown" ? (
                  /* Expanded Nested Markdown List representation inside Admin Dashboard */
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center bg-stone-100 dark:bg-zinc-900/60 p-2.5 rounded-xl">
                      <div className="text-left">
                        <span className="text-[10px] font-black uppercase tracking-wide opacity-75 block">Cấu Trúc Thư Viện Đa Markdown Lồng Nhau</span>
                        <span className="text-[9px] text-stone-500">Mỗi chuyên mục tương ứng với một mảng mỏng Markdown khép kín</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedMarkdown);
                          alert("Đã sao chép cấu trúc Markdown lồng nhau của toàn bộ Thư viện!");
                        }}
                        className="px-2.5 py-1.5 bg-yellow-500 text-black rounded-lg text-[10px] font-black uppercase transition hover:bg-yellow-600 flex items-center gap-1 border-none cursor-pointer"
                      >
                         <Check className="w-3 h-3" /> Sao chép Toàn bộ Markdown
                      </button>
                    </div>
                    
                    {/* Mục lớn là 1 Markdown */}
                    <div className="p-4 bg-stone-50 dark:bg-zinc-900/40 rounded-xl border border-stone-200 dark:border-zinc-800/80">
                      <div className="markdown-body dark:prose-invert">
                        <ReactMarkdown>
                          {`# THƯ VIỆN HỌC PHẦN COSTUDY HENOSIS\n\n*Tổng số học phần hiện tại trong hệ thống: **${decks.length}** bộ thẻ học.*`}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Duyệt qua từng Category, mỗi Category là 1 markdown list lồng nhau */}
                    <div className="space-y-4">
                      {(Object.entries(
                        decks.reduce((acc, deck) => {
                          const subj = (typeof deck.subject === "string" ? deck.subject : JSON.stringify(deck.subject)) || "Chưa phân loại";
                          const cleaned = subj.trim();
                          if (!acc[cleaned]) acc[cleaned] = [];
                          acc[cleaned].push(deck as Deck);
                          return acc;
                        }, {} as Record<string, any[]>)
                      ) as [string, Deck[]][]).map(([subject, subjectDecks]) => {
                        // Generate markdown list for this category
                        const categoryMarkdownList = subjectDecks.map((deck, idx) => {
                          const totalCards = deck.cards?.length || 0;
                          const systemDecks = ["deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"];
                          const creator = systemDecks.includes(deck.id) ? "Hệ thống" : (deck.creatorName || "CoStudy");
                          let listStr = `${idx + 1}. **${deck.title}** - *${totalCards} thẻ*\n`;
                          listStr += `   - ID: \`${deck.id}\`\n`;
                          listStr += `   - Người tạo: *${creator}*\n`;
                          if ((deck as any).description) {
                            listStr += `   - Mô tả: ${(deck as any).description}\n`;
                          }
                          return listStr;
                        }).join("\n");

                        return (
                          <div key={subject} className="glass p-5 rounded-2xl border border-stone-200 dark:border-zinc-800/80 space-y-3 relative">
                            <div 
                              className="flex items-center justify-between border-b border-amber-600/20 dark:border-amber-500/30 pb-2 pt-2 px-1 gap-2 sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-sm cursor-pointer"
                              onClick={() => toggleCategory(subject)}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  title="Chọn mọi bộ thẻ trong chuyên mục"
                                  className="w-4 h-4 text-purple-650 rounded bg-stone-100 border-stone-300 dark:bg-zinc-900 cursor-pointer"
                                  checked={subjectDecks.every(d => selectedDeckIds.includes(d.id))}
                                  onChange={(e) => {
                                    const deckIds = subjectDecks.map(d => d.id);
                                    if (e.target.checked) {
                                      setSelectedDeckIds(prev => Array.from(new Set([...prev, ...deckIds])));
                                    } else {
                                      setSelectedDeckIds(prev => prev.filter(id => !deckIds.includes(id)));
                                    }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                />
                                {editingCategory === subject ? (
                                  <div className="flex items-center gap-2 w-full max-w-md animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="text"
                                      value={newCategoryName}
                                      onChange={(e) => setNewCategoryName(e.target.value)}
                                      className="bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 border border-yellow-500 rounded-lg px-2.5 py-1 text-xs font-bold outline-none flex-1"
                                      placeholder="Tên category mới..."
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleRenameCategory(subject, newCategoryName);
                                        if (e.key === "Escape") setEditingCategory(null);
                                      }}
                                    />
                                    <button
                                      type="button"
                                      disabled={isSavingCategoryName}
                                      onClick={() => handleRenameCategory(subject, newCategoryName)}
                                      className="p-1 px-2 bg-emerald-500 text-white rounded-lg text-xs font-bold transition hover:bg-emerald-600 border-none cursor-pointer"
                                    >
                                      {isSavingCategoryName ? "..." : "Lưu"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingCategory(null)}
                                      className="p-1 px-2 bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs transition border-none cursor-pointer"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="transform transition-transform opacity-70 text-xs" style={{transform: expandedCategories[subject] ? 'rotate(0deg)' : 'rotate(-90deg)'}}>▼</span>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                                      📂 {subject} <span className="opacity-60 text-[10px] font-bold font-mono">({subjectDecks.length} bộ)</span>
                                    </h4>
                                  </div>
                                )}
                              </div>
                              {editingCategory !== subject && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNewCategoryName(subject);
                                    setEditingCategory(subject);
                                  }}
                                  className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-stone-100 dark:bg-zinc-855 text-stone-500 hover:text-yellow-600 dark:hover:text-yellow-450 border border-stone-200 dark:border-zinc-700 transition"
                                  title="Đổi tên chuyên mục này"
                                >
                                  ✍️ ĐỔI TÊN
                                </button>
                              )}
                            </div>

                            {expandedCategories[subject] && (
                              <div className="pl-6 text-xs text-stone-850 dark:text-stone-350 leading-relaxed font-sans mt-3">
                                <div className="markdown-body dark:prose-invert">
                                  <ReactMarkdown>{categoryMarkdownList}</ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Standard Beautiful Grid Representation with Category Editor integrated inline */
                  <div className="space-y-6 animation-delayed max-h-[460px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-750 scrollbar-track-transparent">
                    {(Object.entries(
                      decks.reduce((acc, deck) => {
                        const subj = (typeof deck.subject === "string" ? deck.subject : JSON.stringify(deck.subject)) || "general";
                        const cleaned = subj.trim();
                        if (!acc[cleaned]) acc[cleaned] = [];
                        acc[cleaned].push(deck as Deck);
                        return acc;
                      }, {} as Record<string, Deck[]>)
                    ) as [string, Deck[]][]).map(([subject, subjectDecks]) => (
                      <div key={subject} className="space-y-3 relative">
                        <div 
                           className="flex items-center justify-between border-b border-amber-600/20 dark:border-amber-500/30 pb-2 pt-2 px-1 gap-2 sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-[0_4px_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_10px_-4px_rgba(0,0,0,0.3)] cursor-pointer"
                           onClick={() => toggleCategory(subject)}
                        >
                          {editingCategory === subject ? (
                            <div className="flex items-center gap-2 w-full max-w-md animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="bg-white dark:bg-zinc-900 text-stone-900 dark:text-stone-100 border border-yellow-500 rounded-lg px-2.5 py-1 text-xs font-bold outline-none flex-1"
                                placeholder="Tên category mới..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameCategory(subject, newCategoryName);
                                  if (e.key === "Escape") setEditingCategory(null);
                                }}
                              />
                              <button
                                type="button"
                                disabled={isSavingCategoryName}
                                onClick={() => handleRenameCategory(subject, newCategoryName)}
                                className="p-1 px-2 bg-emerald-500 text-white rounded-lg text-xs font-bold transition hover:bg-emerald-600 border-none cursor-pointer"
                              >
                                {isSavingCategoryName ? "..." : "Lưu"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCategory(null)}
                                className="p-1 px-2 bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs transition border-none cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="transform transition-transform opacity-70 text-xs" style={{transform: expandedCategories[subject] ? 'rotate(0deg)' : 'rotate(-90deg)'}}>▼</span>
                                <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                                  📂 {subject} <span className="opacity-60 text-[10px] font-bold font-mono">({subjectDecks.length} bộ)</span>
                                </h4>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewCategoryName(subject);
                                  setEditingCategory(subject);
                                }}
                                className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-stone-100 dark:bg-zinc-800 text-stone-500 hover:text-yellow-600 dark:hover:text-yellow-450 border border-stone-200 dark:border-zinc-700 transition"
                                title="Đổi tên chuyên mục này"
                              >
                                ✍️ ĐỔI TÊN
                              </button>
                            </>
                          )}
                        </div>
                        
                        {expandedCategories[subject] && subjectDecks.map(deck => (
                          <div key={deck.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 gap-3 bg-stone-100 dark:bg-zinc-900/60 rounded-xl border border-stone-200/60 dark:border-zinc-800/50 hover:bg-stone-150/40 dark:hover:bg-zinc-850/30 transition-colors">
                            <div className="flex items-start gap-3 flex-1 min-w-[150px]">
                              <input
                                type="checkbox"
                                title="Chọn học phần"
                                className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500 bg-stone-100 border-stone-300 dark:bg-zinc-900 dark:border-zinc-700 shrink-0 cursor-pointer"
                                checked={selectedDeckIds.includes(deck.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedDeckIds(prev => [...prev, deck.id]);
                                  else setSelectedDeckIds(prev => prev.filter(id => id !== deck.id));
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold truncate text-xs text-stone-850 dark:text-stone-100">{typeof deck.title === 'string' ? deck.title : JSON.stringify(deck.title)}</p>
                                <p className="text-[10px] opacity-65 flex flex-wrap items-center gap-1.5 mt-1 font-medium">
                                  <span>Số thẻ: {deck.cards?.length || 0}</span>
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    {(() => {
                                      const systemDecks = ["deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"];
                                      if (systemDecks.includes(deck.id) || !deck.createdBy || deck.createdBy === "system") {
                                        return "Hệ thống";
                                      }
                                      if (user && deck.createdBy === user.id) {
                                        return "Bởi bạn";
                                      }
                                      if (deck.creatorRole === "admin" || deck.creatorRole === "Admin" || deck.creatorRole === "teacher") {
                                        return `Admin - ${deck.creatorName || "CoStudy Admin"}`;
                                      }
                                      return deck.creatorName ? `Bởi ${deck.creatorName}` : "Học viên";
                                    })()}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-stone-200 dark:border-zinc-800 w-full sm:w-auto">
                              <Link to={`/study/${deck.id}`} className="flex-1 sm:flex-none text-center bg-yellow-500 text-black px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-yellow-600 transition shrink-0 whitespace-nowrap">
                                Xem / Sửa
                              </Link>
                              {(user?.role === "teacher" || user?.role === "admin" || user?.role === "Admin") && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(deck.id); }}
                                  className="bg-red-600/10 hover:bg-red-600 text-red-650 hover:text-white p-1.5 px-3 rounded-lg text-xs font-bold transition shrink-0 flex items-center justify-center border-none cursor-pointer"
                                  title="Xóa bộ thẻ"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center border border-dashed border-stone-200/50 dark:border-zinc-800/40 rounded-xl bg-stone-200/5 dark:bg-zinc-800/5">
                <p className="text-xs text-stone-500 dark:text-zinc-400 font-medium">🐾 Danh sách các bộ thẻ đang đóng. Hãy nhấn <strong className="text-amber-500">📂 Hiện thư viện</strong> để bung xem chi tiết mà không lo tràn trang!</p>
              </div>
            )}</section></div><div className="space-y-8"><section className="glass p-6 rounded-2xl flex flex-col"><h3 className="text-xl font-display font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-5 h-5 text-red-500" /> AI Weakness Detection</h3><p className="text-sm opacity-70 mb-6">Aggregate top forgotten concepts (cards marked as "X" or with lowest SM-2 scores).</p><div className="space-y-4 flex-1">
             {topWeakest.length > 0 ? topWeakest.map((wc, i) => (
                <div key={wc.id} className="p-4 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">Rank #{i+1}</div>
                  <div className="mb-2 pe-12">
                     <span className="font-bold text-lg text-red-700 dark:text-red-400">{typeof wc.front === 'string' ? wc.front : JSON.stringify(wc.front)}</span>
                     <span className="ml-2 text-xs opacity-60 bg-stone-300/60 dark:bg-zinc-800/80 px-2 py-1 rounded-full uppercase tracking-wider">{typeof wc.subject === 'string' ? wc.subject : JSON.stringify(wc.subject)}</span>
                  </div>
                  <p className="text-sm opacity-90 line-clamp-2">{typeof wc.back === 'string' ? wc.back : JSON.stringify(wc.back)}</p>
                </div>
             )) : (
                <div className="flex flex-col items-center justify-center p-8 opacity-50 h-full border-2 border-dashed border-amber-600/20 dark:border-amber-500/30 rounded-xl">
                   <Target className="w-12 h-12 mb-2 opacity-50" />
                   <p className="font-bold">Hệ thống chưa phát hiện hổng kiến thức nghiêm trọng.</p>
                </div>
             )}
          </div>
        </section>
        <GlobalActivityFeed />
      </div>
    </div>

      {user && (user.role === "teacher" || user.role === "admin" || user.role === "Admin") && adminKey && (
        <div id="monitor" className="pt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 border border-stone-200 dark:border-zinc-800 rounded-lg bg-stone-50 dark:bg-zinc-900 shadow-sm">
               <Settings className="w-5 h-5 text-stone-700 dark:text-stone-300" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold">API Health Monitor</h3>
              <p className="opacity-60 text-sm">Real-time status of backend API keys.</p>
            </div>
          </div>
          <ServiceMonitor adminKey={adminKey} />
        </div>
      )}

      {showConfirmDelete && (
        <div className="modal-glass-overlay flex items-center justify-center p-4">
          <div className="modal-glass-content p-6 max-w-sm w-full">
            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5" /> Xác nhận xóa bộ học tập?
            </h4>
            <p className="text-sm opacity-80 mb-6">
              Hành động này sẽ xóa hoàn toàn bộ học tập trên Cloud Firestore cơ sở dữ liệu. Khi đã thực hiện, hành động này không thể hoàn tác!
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowConfirmDelete(null)}
                disabled={isDeletingSet}
                className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-zinc-850 hover:bg-stone-300 dark:hover:bg-zinc-800 transition text-sm font-bold text-black dark:text-white"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={async () => {
                  setIsDeletingSet(true);
                  try {
                    const { db, handleFirestoreError, OperationType } = await import("../lib/firebase");
                    const { doc, deleteDoc } = await import("firebase/firestore");
                    await deleteDoc(doc(db, "sets", showConfirmDelete));
                    store.removeDeckLocally(showConfirmDelete);
                    setShowConfirmDelete(null);
                  } catch (e) {
                    const { handleFirestoreError, OperationType } = await import("../lib/firebase");
                    handleFirestoreError(e, OperationType.DELETE, `sets/${showConfirmDelete}`);
                  } finally {
                    setIsDeletingSet(false);
                  }
                }}
                disabled={isDeletingSet}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition text-sm font-bold flex items-center gap-1.5"
              >
                {isDeletingSet ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
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

      {showBulkConfirmDeleteStudents && (
        <div className="modal-glass-overlay flex items-center justify-center p-4 z-50">
          <div className="modal-glass-content p-6 max-w-md w-full">
            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" /> Xác nhận xóa {selectedStudentIds.length} học sinh?
            </h4>
            <p className="text-sm opacity-85 mb-4">
              Bạn đang chuẩn bị thao tác hàng loạt trên {selectedStudentIds.length} học sinh.
            </p>
            
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider opacity-60">Phương thức xử lý:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkConfirmDeleteStudents("hard")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                    showBulkConfirmDeleteStudents === "hard"
                      ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400"
                      : "border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-850"
                  )}
                >
                  <span>Xóa cứng (Hard)</span>
                  <span className="text-[10px] opacity-60 font-normal">Xóa sạch profile, nhóm và thẻ học</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkConfirmDeleteStudents("soft")}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold transition flex flex-col gap-1 items-center text-center",
                    showBulkConfirmDeleteStudents === "soft"
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
                onClick={() => setShowBulkConfirmDeleteStudents(null)}
                disabled={isBulkDeletingStudents}
                className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-zinc-850 hover:bg-stone-300 dark:hover:bg-zinc-800 transition text-sm font-bold text-black dark:text-white"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={async () => {
                  setIsBulkDeletingStudents(true);
                  try {
                    const { dbService } = await import("../lib/firebase");
                    const promises = selectedStudentIds.map(id => {
                      if (showBulkConfirmDeleteStudents === "hard") {
                         return dbService.deleteUserProfile(id);
                      } else {
                         return dbService.updateUserProfile(id, { status: "disabled" });
                      }
                    });
                    await Promise.all(promises);
                    if (showBulkConfirmDeleteStudents === "hard") {
                      setDbUsers(prev => prev.filter(u => !selectedStudentIds.includes(u.id)));
                    } else {
                      setDbUsers(prev => prev.map(u => selectedStudentIds.includes(u.id) ? { ...u, status: "disabled" } : u));
                    }
                    setSelectedStudentIds([]);
                    setShowBulkConfirmDeleteStudents(null);
                  } catch (e: any) {
                    console.error("Error bulk deleting students:", e);
                    alert("Có lỗi xảy ra khi thao tác hàng loạt trên học sinh: " + e.message);
                  } finally {
                    setIsBulkDeletingStudents(false);
                  }
                }}
                disabled={isBulkDeletingStudents}
                className={cn(
                  "px-4 py-2 rounded-lg text-white transition text-sm font-bold flex items-center gap-1.5",
                  showBulkConfirmDeleteStudents === "hard" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {isBulkDeletingStudents ? "Đang xử lý..." : "Xác nhận thực hiện"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkConfirmDeleteDecks && (
        <div className="modal-glass-overlay flex items-center justify-center p-4 z-50">
          <div className="modal-glass-content p-6 max-w-sm w-full">
            <h4 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5" /> Xác nhận xóa {selectedDeckIds.length} bộ học tập?
            </h4>
            <p className="text-sm opacity-80 mb-6">
              Hành động này sẽ xóa hoàn toàn {selectedDeckIds.length} bộ học tập trên Cloud Firestore cơ sở dữ liệu. Khi đã thực hiện, hành động này không thể hoàn tác!
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowBulkConfirmDeleteDecks(false)}
                disabled={isBulkDeletingDecks}
                className="px-4 py-2 rounded-lg bg-stone-200 dark:bg-zinc-850 hover:bg-stone-300 dark:hover:bg-zinc-800 transition text-sm font-bold text-black dark:text-white"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={async () => {
                   setIsBulkDeletingDecks(true);
                   try {
                     const { db } = await import("../lib/firebase");
                     const { doc, deleteDoc } = await import("firebase/firestore");
                     
                     await Promise.all(selectedDeckIds.map(id => deleteDoc(doc(db, "sets", id))));
                     
                     selectedDeckIds.forEach(id => store.removeDeckLocally(id));
                     setSelectedDeckIds([]);
                     setShowBulkConfirmDeleteDecks(false);
                   } catch (e) {
                     const { handleFirestoreError, OperationType } = await import("../lib/firebase");
                     handleFirestoreError(e, OperationType.DELETE, `sets/bulk`);
                   } finally {
                     setIsBulkDeletingDecks(false);
                   }
                }}
                disabled={isBulkDeletingDecks}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition text-sm font-bold flex items-center gap-1.5"
              >
                {isBulkDeletingDecks ? "Đang xóa..." : "Xác nhận xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveBulkModal && (
        <div className="modal-glass-overlay flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="modal-glass-content p-6 max-w-md w-full border border-yellow-500/30">
            <h4 className="text-lg font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-3">
              <FolderOpen className="w-5 h-5" /> Di dời {selectedDeckIds.length} bộ thẻ
            </h4>
            <p className="text-xs opacity-75 mb-4 leading-relaxed">
              Dời hàng loạt bộ học tập học phần sang một chuyên mục (Category) khác đồng bộ trên hệ thống.
            </p>

            <div className="mb-4 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-wider opacity-60">Chọn chuyên mục đích:</label>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewCategoryInput(!isNewCategoryInput);
                    setTargetMoveCategory("");
                  }}
                  className="text-[10px] font-black uppercase text-yellow-600 dark:text-yellow-450 hover:underline border-none bg-none cursor-pointer"
                >
                  {isNewCategoryInput ? "Chọn chuyên mục có sẵn" : "✍️ Nhập chuyên mục mới"}
                </button>
              </div>

              {isNewCategoryInput ? (
                <input
                  type="text"
                  placeholder="Điền tên chuyên mục mới..."
                  value={targetMoveCategory}
                  onChange={(e) => setTargetMoveCategory(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-250 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold outline-none text-stone-900 dark:text-stone-100"
                  autoFocus
                />
              ) : (
                <select
                  value={targetMoveCategory}
                  onChange={(e) => setTargetMoveCategory(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-zinc-900 border border-stone-250 dark:border-zinc-800 rounded-xl p-3 text-xs font-bold outline-none text-stone-900 dark:text-stone-100"
                >
                  <option value="">-- Chọn một chuyên mục --</option>
                  {existingSubjects.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3 justify-end items-center mt-6">
              <button
                type="button"
                onClick={() => setShowMoveBulkModal(false)}
                disabled={isMovingBulk}
                className="px-4 py-2 rounded-xl bg-stone-150 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-xs font-bold transition text-stone-700 dark:text-stone-200 border-none cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleMoveDecksBulk}
                disabled={isMovingBulk || !targetMoveCategory.trim()}
                className="px-4.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-black transition shadow-md hover:shadow active:scale-97 flex items-center gap-1.5 border-none cursor-pointer"
              >
                {isMovingBulk ? "Đang di dời..." : "Xác nhận di dời"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
