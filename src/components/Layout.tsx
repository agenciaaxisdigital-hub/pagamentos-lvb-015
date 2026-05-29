import { BottomNav } from "./BottomNav";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { requestNotificationPermission } from "@/hooks/usePaymentNotifications";
import { Download, WifiOff, X, RefreshCw, Bell, BellOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import SeletorCidade from "@/components/SeletorCidade";
import LogoAxis from "./LogoAxis";

const PULL_THRESHOLD = 65;

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
  const { canInstall, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedInstall, setDismissedInstall] = useState(() =>
    sessionStorage.getItem("pwa_install_dismissed") === "1"
  );

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const [dismissedIOS, setDismissedIOS] = useState(() =>
    !!sessionStorage.getItem("pwa_ios_dismissed")
  );
  const showIOSInstall = isIOS && !isStandalone && !dismissedIOS;

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );

  const touchStartY = useRef<number | null>(null);
  const [pullDelta, setPullDelta] = useState(0);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? "granted" : "denied");
  };

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const handleDismissInstall = () => {
    sessionStorage.setItem("pwa_install_dismissed", "1");
    setDismissedInstall(true);
  };

  const handleDismissIOS = () => {
    sessionStorage.setItem("pwa_ios_dismissed", "1");
    setDismissedIOS(true);
  };

  const handleForceRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch { /* SW update não crítico */ }
    }
    await qc.invalidateQueries();
    setRefreshing(false);
  }, [refreshing, qc]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((mainRef.current?.scrollTop ?? 1) === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0 && (mainRef.current?.scrollTop ?? 1) === 0) {
      setPullDelta(Math.min(delta, PULL_THRESHOLD + 30));
    } else {
      touchStartY.current = null;
      setPullDelta(0);
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDelta >= PULL_THRESHOLD) {
      await handleForceRefresh();
    }
    setPullDelta(0);
    touchStartY.current = null;
  }, [pullDelta, handleForceRefresh]);

  const showInstallBanner = (canInstall && !dismissedInstall) || showIOSInstall;
  const pullProgress = Math.min(pullDelta / PULL_THRESHOLD, 1);
  const pullHeight = Math.round(pullProgress * 36);

  return (
    <div className="h-[100dvh] flex flex-col bg-background select-none overflow-hidden">
      <div className="premium-gradient h-1 shrink-0 shadow-[0_0_15px_rgba(236,72,153,0.3)]" />

      <header className="glass-card px-3 sm:px-4 py-3 shrink-0 z-40 mx-2 mt-2 rounded-2xl premium-shadow">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo-axis.png"
              alt="Agência Axis"
              className="w-[38px] h-[38px] object-contain shrink-0 animate-fade-in"
            />
            <div className="min-w-0">
              <h1 className="text-sm font-black text-foreground leading-none tracking-tight">Gestão Financeira</h1>
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">Agência Axis</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 max-w-full">
            <SeletorCidade />
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/50 max-w-full">
              <button
                onClick={handleForceRefresh}
                disabled={refreshing}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors active:scale-90 disabled:opacity-50"
                title="Atualizar dados"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin text-primary" : ""} />
              </button>
              {"Notification" in window && notifPermission !== "granted" && (
                <button
                  onClick={handleEnableNotifications}
                  className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors active:scale-90"
                  title="Ativar notificações"
                >
                  <BellOff size={14} />
                </button>
              )}
              {"Notification" in window && notifPermission === "granted" && (
                <div className="w-7 h-7 flex items-center justify-center text-primary animate-pulse">
                  <Bell size={14} />
                </div>
              )}

              {!isOnline ? (
                <div className="w-7 h-7 flex items-center justify-center text-destructive animate-pulse" title="Offline">
                  <WifiOff size={14} />
                </div>
              ) : (
                <div className="w-7 h-7 flex items-center justify-center text-status-success" title="Conectado">
                  <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overscroll-y-contain min-h-0"
        style={{
          WebkitOverflowScrolling: "touch",
          paddingBottom: showInstallBanner
            ? "calc(140px + env(safe-area-inset-bottom, 0px))"
            : "calc(80px + env(safe-area-inset-bottom, 0px))",
          overscrollBehavior: "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {pullHeight > 0 && (
          <div className="flex items-center justify-center overflow-hidden" style={{ height: pullHeight }}>
            <RefreshCw
              size={15}
              className={`text-primary ${pullProgress >= 1 || refreshing ? "animate-spin" : ""}`}
              style={{ transform: `rotate(${Math.round(pullProgress * 360)}deg)`, opacity: pullProgress }}
            />
          </div>
        )}
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4">
          {children}
        </div>
      </main>

      <BottomNav />

      {canInstall && !dismissedInstall && (
        <div
          className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Download size={15} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight">Instalar app</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Acesso rápido, funciona offline</p>
            </div>
            <button
              onClick={install}
              className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-xl active:opacity-70 shrink-0"
            >
              Instalar
            </button>
            <button
              onClick={handleDismissInstall}
              className="text-muted-foreground p-1 rounded-lg active:bg-muted shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {showIOSInstall && (
        <div
          className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Download size={15} className="text-primary" />
            </div>
            <p className="text-xs text-foreground flex-1 leading-snug">
              <span className="font-semibold">Adicione à tela inicial:</span> toque em{" "}
              <span className="font-mono bg-muted px-1 rounded text-[11px]">⎙</span>{" "}
              depois em <strong>Adicionar à Tela de Início</strong>
            </p>
            <button
              onClick={handleDismissIOS}
              className="text-muted-foreground p-1 rounded-lg active:bg-muted shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
