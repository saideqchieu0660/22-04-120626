import React, { useState, useEffect } from 'react';
import { Bug, X, Send } from 'lucide-react';
import { cn } from '../lib/utils';

export function GlobalErrorReporter() {
  const [errorLog, setErrorLog] = useState<{message: string; stack?: string; time: string; url: string} | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const handleGlobalApiError = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      setErrorLog({
        message: detail.message || "Lỗi API không xác định",
        stack: detail.stack || "API path: " + detail.path,
        time: new Date().toISOString(),
        url: window.location.href,
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      // Ignore chunk load errors here because ErrorBoundary handles them nicely
      if (event.message.includes("chunk") || event.message.includes("dynamically imported module")) return;
      setErrorLog({
        message: event.message || "Lỗi giao diện không xác định",
        stack: event.error?.stack || "No stack",
        time: new Date().toISOString(),
        url: window.location.href,
      });
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      setErrorLog({
        message: typeof reason === 'string' ? reason : (reason?.message || "Lỗi xử lý (Promise Rejection)"),
        stack: reason?.stack || "No stack",
        time: new Date().toISOString(),
        url: window.location.href,
      });
    };

    window.addEventListener('global-api-error', handleGlobalApiError);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('global-api-error', handleGlobalApiError);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, []);

  const handleReport = async () => {
    if (!errorLog) return;
    setIsRedirecting(true);

    const logData = `[BUG REPORT]
Message: ${errorLog.message}
Stack: ${errorLog.stack}
Time: ${errorLog.time}
URL: ${errorLog.url}
User Agent: ${navigator.userAgent}`;

    let copySuccess = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(logData);
        copySuccess = true;
      } catch (e) {
        console.error("Clipboard API failed:", e);
      }
    }

    if (!copySuccess) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = logData;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copySuccess = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (e) {
        console.error("Fallback copy failed:", e);
      }
    }

    const telegramLink = "https://t.me/+O50q6ltXTzwxMzk1";
    const newWin = window.open(telegramLink, "_blank");
    if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
      window.location.href = telegramLink;
    }

    setTimeout(() => {
      setIsRedirecting(false);
      setErrorLog(null);
    }, 3000);
  };

  if (!errorLog) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-full bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border-l-4 border-l-red-500 border border-t-stone-200 border-r-stone-200 border-b-stone-200 dark:border-t-zinc-700 dark:border-r-zinc-700 dark:border-b-zinc-700 p-4 animate-in slide-in-from-bottom-8">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-full shrink-0">
          <Bug className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200 mb-1">Đã phát hiện lỗi hệ thống</h4>
          <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 break-words">
            {errorLog.message}
          </p>
        </div>
        <button 
          onClick={() => setErrorLog(null)}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <button
        onClick={handleReport}
        disabled={isRedirecting}
        className={cn(
           "mt-3 w-full py-2.5 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all",
           isRedirecting 
             ? "bg-green-500 text-white" 
             : "bg-stone-100 dark:bg-zinc-700 text-stone-700 dark:text-stone-200 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400"
        )}
      >
        <Send className={cn("w-4 h-4", isRedirecting && "animate-pulse")} />
        {isRedirecting ? "Đã chép mã lỗi, đang chuyển hướng..." : "Báo cáo qua Telegram"}
      </button>
    </div>
  );
}
