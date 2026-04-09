import { useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

export default function VersionMonitor() {
  const reloadScheduled = useRef(false);

  const checkForUpdates = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.update();
      }
      console.log("[SW] Update check completed", new Date().toISOString());
    } catch (err) {
      console.error("[SW] Update check error", err);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => checkForUpdates();

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        checkForUpdates();
      }
    };

    // Reload seguro: só uma vez, com confirmação visual, sem loop
    const handleControllerChange = () => {
      if (reloadScheduled.current) return;
      reloadScheduled.current = true;
      console.log("[SW] controllerchange detected — nova versão ativa", new Date().toISOString());

      toast("Nova versão disponível!", {
        description: "O app será atualizado em 3 segundos...",
        duration: 3000,
        action: {
          label: "Atualizar agora",
          onClick: () => window.location.reload(),
        },
      });

      // Fallback: reload automático após 3s se o usuário não interagir
      setTimeout(() => {
        if (reloadScheduled.current) {
          window.location.reload();
        }
      }, 3000);
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);

    // Check a cada 30 min
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  return null;
}
