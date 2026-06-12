import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  HelpCircle, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Network, 
  Trophy, 
  Cpu, 
  Bot, 
  Sliders, 
  Download, 
  Users, 
  Award, 
  Type, 
  History, 
  Keyboard 
} from "lucide-react";

interface StepConfig {
  title: string;
  description: string;
  targetSelector: string;
  icon?: React.ReactNode;
}

interface InteractiveTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
}

export function InteractiveTutorial({ isOpen, onClose, activeTab, setActiveTab }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const steps: StepConfig[] = [
    {
      title: "🌲 Cây Kỹ Năng Stoic (Stoicism Skill Tree)",
      description: "Nơi rèn luyện bản lĩnh, kỷ luật của một triết gia thực thụ! Mày không phải học tập mù quáng, mỗi lượng kiến thức hay phần trắc nghiệm mày cày bừa trên các bộ thẻ học sẽ tích lũy mở khóa, liên kết rẽ nhánh các kỹ năng Stoicism cổ đại, bồi đắp chỉ số nội lực bền bỉ mỗi ngày.",
      targetSelector: "#skill-tree-viewport",
      icon: <Network className="w-6 h-6 text-emerald-500 animate-pulse" />
    },
    {
      title: "🏆 Đấu Trường Xếp Hạng (Leaderboard Tuần)",
      description: "Xem điểm số XP và thứ hạng chiến tích của mày so với toàn bộ triết gia học thuật khác. Bảng xếp hạng cập nhật thời gian thực, tự động tôn vinh Top 3 kèm vầng hào quang rực rỡ nhất tuần. Thắng bại tại nỗ lực, lo mà cày đi m nha!",
      targetSelector: "#leaderboard-container",
      icon: <Trophy className="w-6 h-6 text-yellow-500 animate-pulse" />
    },
    {
      title: "🔄 United Ingestion & Rotation Engine V8.0",
      description: "Cơ chế bóc tách Flashcard siêu tốc từ tài liệu, ảnh chụp, file PDF học thuật, ảnh chụp trang sách hoặc văn bản thô dán trực tiếp. Hệ thống sở hữu cụm cân bằng tải xoay tua liên tục hơn 20 Keys Gemini, OpenRouter, DeepInfra, tự ngắt mạch (Circuit Breaker) và 'Silent Bypass' không bao giờ lo sập mạng!",
      targetSelector: '[data-tour="step-4"]',
      icon: <Cpu className="w-6 h-6 text-cyan-500 animate-pulse" />
    },
    {
      title: "🤖 Agent 2 & Agent 3 (Gia Sư Socrates AI & Bản Đồ Mind Map Động)",
      description: "Trò chuyện sâu sắc với Gia Sư AI Socrates (Agent 2) kích thích tư duy phản biện. Đặc biệt, Agent 3 cho phép mày phác họa sơ đồ tư duy (MIND MAP) trực quan động cho bất kỳ khái niệm phức tạp nào chỉ với 1 cú click ngay tại góc học tập. Dữ liệu mượt mà, ghi nhớ x10!",
      targetSelector: "#agent3-side-widget-anchor",
      icon: <Bot className="w-6 h-6 text-purple-500 animate-pulse" />
    },
    {
      title: "📝 Sinh Đề Kiểm Tra & Trắc Nghiệm AI Linh Hoạt",
      description: "Hãy thử sức với trình thi cử thông minh của Agent 3! Mày được quyền tự do tuỳ chỉnh số lượng câu hỏi trắc nghiệm MCQ (từ 5 đến 40 câu) dựa trên chính danh sách các thẻ yếu hoặc bộ học phần của mày để rà soát chính xác lỗ hổng kiến thức định kỳ.",
      targetSelector: "#trigger-quiz-from-dashboard",
      icon: <HelpCircle className="w-6 h-6 text-red-500 animate-pulse" />
    },
    {
      title: "📊 Biểu Đồ Thống Kê Sắc Nét & Hoạt Động Feed",
      description: "Đọc vị mọi thói quen biểu đồ của mày: Hệ thống bóng bong bóng phân rã XP thực chiến, Stoic Heatmap đúc kết lịch sử hằng ngày, và bảng hoạt động Real-time Activity Feed vinh danh những sự kiện học tập mới nhất của cộng đồng hăng hái.",
      targetSelector: "#study-charts-group",
      icon: <Sliders className="w-6 h-6 text-amber-500 animate-pulse" />
    },
    {
      title: "💾 Xuất Thống Kê Học Tập & Bộ Thẻ Excel",
      description: "Mày muốn lưu trữ? Dễ như trở bàn tay! Cụm công cụ Exporter cho phép xuất nhanh toàn bộ nội dung bộ thẻ học ra định dạng JSON, Excel, hoặc tải báo cáo tóm tắt quá trình học Stoic của mày về máy để báo cáo giáo viên hoặc tự theo dõi.",
      targetSelector: "#export-actions-card",
      icon: <Download className="w-6 h-6 text-blue-550 animate-pulse" />
    },
    {
      title: "👥 CoStudy Room (Học Realtime Đồng Đội)",
      description: "Đừng học đơn độc m nha! Nhấp vào banner CoStudy để bước thẳng vào phòng tự học đa nền tảng realtime cực hot, chia sẻ không khí học tập, bật camera ảo nhóm cùng bạn bè trực tuyến, tăng vọt động lực tập trung tuyệt đối.",
      targetSelector: "#costudy-portal-link",
      icon: <Users className="w-6 h-6 text-indigo-500 animate-pulse" />
    },
    {
      title: "👤 Hồ Sơ Cá Nhân & Huy Chương Thành Tựu",
      description: "Kho kỷ vật rực lửa! Nơi vinh danh lòng cam kết Stoic kiên trung của mày qua hệ thống Huy Chương Thành Tựu rực rỡ, Avatar thông minh dán ảnh tùy biến và theo dõi chuỗi ngày Streak dài bất tận ghi đậm dấu ấn cá nhân.",
      targetSelector: "#achievements-showcase",
      icon: <Award className="w-6 h-6 text-pink-500 animate-pulse" />
    },
    {
      title: "⚡ Chế Độ Siêu Mượt (Fix Lag) & Thiết Lập Cỡ Chữ",
      description: "Trải nghiệm bị đứng, giật hình trên máy yếu? Nhấn phím 'E' để bật ngay Chế độ Mượt (Eco Mode) triệt tiêu hiệu ứng nặng. Kéo thanh trượt slider Cỡ Chữ (Font Zoom) trong Menu Cài đặt để phóng to, thu nhỏ giao diện tự cân đối golden-ratio không vỡ layout!",
      targetSelector: "#eco-font-controls-box",
      icon: <Type className="w-6 h-6 text-green-400 animate-pulse" />
    },
    {
      title: "🕒 Lịch Sử Học Tập & Nhật Ký Kỳ Thi",
      description: "Nhật ký rèn luyện ghi chép tường tận từng câu hỏi mày đã trả lời sai, các kì thi thử đã làm, số thẻ flashcard đã ôn tập ngắt quãng để mày dễ dàng lục lại ôn tập sâu vào cuối tuần.",
      targetSelector: "#history-logs-viewport",
      icon: <History className="w-6 h-6 text-teal-400 animate-pulse" />
    },
    {
      title: "⌨️ Phím Tắt Tiện Lợi & Cẩm Nang Sống Còn",
      description: "Sử dụng bàn phím như một Hacker học thuật! Nhấn phím '?' bất cứ lúc nào để mở toang kho Cẩm Nang Phím Tắt (Hotkeys) quyền lực: H về Home, U mở bóc tách AI, K mở cây kỹ năng, S mở cài đặt... Tiết kiệm 90% thao tác chuột rườm rà!",
      targetSelector: "#shortcuts-help-btn-anchor",
      icon: <Keyboard className="w-6 h-6 text-zinc-300 animate-pulse" />
    }
  ];

  // Auto tab transition switcher
  useEffect(() => {
    if (!isOpen) return;

    if (currentStep === 0) {
      if (activeTab !== "skill_tree") setActiveTab("skill_tree");
    } else if (currentStep === 1) {
      if (activeTab !== "ranking") setActiveTab("ranking");
    } else if (currentStep === 2) {
      if (activeTab !== "create_deck") setActiveTab("create_deck");
    } else if (currentStep === 3) {
      if (activeTab !== "study") setActiveTab("study");
    } else if (currentStep === 4) {
      if (activeTab !== "study") setActiveTab("study");
    } else if (currentStep === 5) {
      if (activeTab !== "study") setActiveTab("study");
    } else if (currentStep === 6) {
      if (activeTab !== "settings") setActiveTab("settings");
    } else if (currentStep === 7) {
      if (activeTab !== "study") setActiveTab("study");
    } else if (currentStep === 8) {
      if (activeTab !== "achievements" && activeTab !== "profile") {
        setActiveTab("achievements");
      }
    } else if (currentStep === 9) {
      if (activeTab !== "settings") setActiveTab("settings");
    } else if (currentStep === 10) {
      if (activeTab !== "history") setActiveTab("history");
    } else if (currentStep === 11) {
      if (activeTab !== "study") setActiveTab("study");
    }
  }, [currentStep, isOpen, activeTab, setActiveTab]);

  const updateCoords = (shouldScroll = false) => {
    if (!isOpen) {
      setCoords(null);
      return;
    }

    const step = steps[currentStep];
    if (!step) return;

    // Retry finding element if it takes a tiny moment to render
    const attemptFind = (retries = 0) => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        if (shouldScroll) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      } else {
        if (retries < 5) {
          setTimeout(() => attemptFind(retries + 1), 150);
        } else {
          setCoords(null); // Fallback to centered modal
        }
      }
    };

    attemptFind();
  };

  useEffect(() => {
    const timer = setTimeout(() => updateCoords(true), 300);
    return () => clearTimeout(timer);
  }, [currentStep, isOpen, activeTab]);

  useEffect(() => {
    const handleResizeOrScroll = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => updateCoords(false), 50);
    };

    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll);
    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [currentStep, isOpen]);

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div id="tutorial-overlay-container" className="fixed inset-0 z-[999] pointer-events-auto">
      {/* Dimmed backdrop background with custom SVG cutout overlay */}
      <AnimatePresence>
        {coords ? (
          <div 
            className="fixed inset-0 bg-stone-950/70 dark:bg-black/80 transition-all duration-300 pointer-events-auto"
            style={{
              clipPath: `polygon(
                0% 0%, 
                0% 100%, 
                ${coords.left}px 100%, 
                ${coords.left}px ${coords.top}px, 
                ${coords.left + coords.width}px ${coords.top}px, 
                ${coords.left + coords.width}px ${coords.top + coords.height}px, 
                ${coords.left}px ${coords.top + coords.height}px, 
                ${coords.left}px 100%, 
                100% 100%, 
                100% 0%
              )`
            }}
          />
        ) : (
          <div className="fixed inset-0 bg-stone-950/75 dark:bg-black/85 backdrop-blur-xs transition-all pointer-events-auto" />
        )}
      </AnimatePresence>

      {/* Pulsing spotlight container around highlighted target */}
      {coords && (
        <div
          className="fixed border-2 border-yellow-500 rounded-xl pointer-events-none transition-all duration-300 shadow-[0_0_25px_rgba(234,179,8,0.4)] animate-pulse z-40"
          style={{
            top: coords.top - 4,
            left: coords.left - 4,
            width: coords.width + 8,
            height: coords.height + 8,
          }}
        />
      )}

      {/* Floating Tooltip card */}
      <div 
        className="fixed z-50 flex items-center justify-center p-4 transition-all duration-300 pointer-events-auto"
        style={
          coords 
            ? {
                top: window.innerWidth < 768 ? 'auto' : Math.max(16, Math.min(window.innerHeight - 360, coords.top + coords.height + 20 + (coords.top + coords.height + 300 > window.innerHeight ? -coords.height - 350 : 0))),
                bottom: window.innerWidth < 768 ? '16px' : 'auto',
                left: window.innerWidth < 768 ? '16px' : Math.max(16, Math.min(window.innerWidth - 380, coords.left + coords.width/2 - 180)),
                right: window.innerWidth < 768 ? '16px' : 'auto',
                width: window.innerWidth < 768 ? 'auto' : "360px",
                position: "fixed"
              }
            : {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(380px, calc(100vw - 32px))",
                position: "fixed"
              }
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-stone-900 border border-stone-800 dark:bg-zinc-950 dark:border-zinc-850 text-stone-100 rounded-3xl p-6 shadow-[0_15px_45px_rgba(0,0,0,0.7)] space-y-4 max-h-[85vh] overflow-y-auto scrollbar-thin w-full"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
                {currentStepData.icon}
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-yellow-500 font-black uppercase tracking-widest block">
                  BƯỚC {currentStep + 1} / {steps.length}
                </span>
                <h4 className="text-sm font-black leading-tight tracking-tight text-neutral-100 uppercase font-display">
                  {currentStepData.title}
                </h4>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1.5 rounded-full bg-stone-800 hover:bg-stone-700 transition cursor-pointer"
              title="Đóng Hướng Dẫn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-stone-300 leading-relaxed font-sans font-medium">
            {currentStepData.description}
          </p>

          {/* Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-800/80">
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-white text-xs font-black uppercase tracking-wider transition hover:underline cursor-pointer"
            >
              Bỏ qua tour (Skip)
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-xs font-black text-stone-200 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Trước
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:opacity-90 text-stone-950 text-xs font-black transition-transform active:scale-95 shadow-lg shadow-amber-500/10 flex items-center gap-1 cursor-pointer"
              >
                {isLastStep ? "Xong" : "Tiếp theo"}{" "}
                <ChevronRight className="w-3.5 h-3.5 font-bold" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
