import { BottomNav } from "./BottomNav";
import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { requestNotificationPermission } from "@/hooks/usePaymentNotifications";
import { Download, WifiOff, X, RefreshCw, Bell, BellOff } from "lucide-react";
import SeletorCidade from "@/components/SeletorCidade";

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLDivElement>(null);
  const { canInstall, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const { syncing, pendingCount, syncQueue } = useOfflineSync();
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

  const showInstallBanner = (canInstall && !dismissedInstall) || showIOSInstall;

  return (
    <div className="h-[100dvh] flex flex-col bg-muted select-none">
      <div className="bg-gradient-to-r from-primary via-rose-400 to-pink-300 h-1.5 shrink-0" />

      <header className="bg-card border-b border-border px-4 py-2.5 shrink-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary-foreground">FS</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground leading-tight">Painel Político</h1>
              <p className="text-[10px] text-muted-foreground">Dra. Fernanda Sarelli</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SeletorCidade />
            {"Notification" in window && notifPermission !== "granted" && (
              <button
                onClick={handleEnableNotifications}
                className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 bg-muted px-2 py-1 rounded-full active:opacity-70"
                title="Ativar notificações"
              >
                <BellOff size={9} />
              </button>
            )}
            {"Notification" in window && notifPermission === "granted" && (
              <span className="text-[10px] text-primary flex items-center">
                <Bell size={9} />
              </span>
            )}
            {!isOnline && (
              <span className="text-[10px] text-destructive font-semibold flex items-center gap-1 bg-destructive/10 px-2 py-1 rounded-full border border-destructive/20">
                <WifiOff size={9} /> Offline
              </span>
            )}
            {isOnline && syncing && (
              <span className="text-[10px] text-primary font-semibold flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
                <RefreshCw size={9} className="animate-spin" /> Sincronizando
              </span>
            )}
            {isOnline && !syncing && pendingCount > 0 && (
              <button
                onClick={syncQueue}
                className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20 active:opacity-70"
              >
                <RefreshCw size={9} /> {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
              </button>
            )}
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
      >
        <div className="max-w-2xl mx-auto px-4 py-4">
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
