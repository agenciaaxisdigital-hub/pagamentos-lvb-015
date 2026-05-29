import { useEffect, useCallback, useRef } from "react";

// Limpa cache de dados da API (não o shell do app) para garantir dados frescos na próxima abertura
async function clearApiCache() {
  if (!("caches" in window) || !navigator.onLine) return;
  try {
    await caches.delete("supabase-api");
    await caches.delete("supabase-functions");
  } catch {
    // silencioso
  }
}

export default function VersionMonitor() {
  const reloadScheduled = useRef(false);

  const checkForUpdates = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) await reg.update();
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    // Limpa cache de API ao fechar/minimizar o app (pagehide é mais confiável no PWA)
    // Na próxima abertura os dados virão frescos da rede
    window.addEventListener("pagehide", clearApiCache);

    // Recarrega silenciosamente quando o usuário não está digitando
    const reloadWhenIdle = () => {
      if (reloadScheduled.current) return;
      reloadScheduled.current = true;

      const tryReload = () => {
        const active = document.activeElement;
        const isTyping =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          (active instanceof HTMLElement && active.contentEditable === "true");

        if (isTyping) {
          setTimeout(tryReload, 2000);
        } else {
          window.location.reload();
        }
      };

      setTimeout(tryReload, 1000);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        checkForUpdates();
      }
    };

    window.addEventListener("online", checkForUpdates);
    document.addEventListener("visibilitychange", handleVisibility);
    
    // Evita loop de recarga na primeira instalação do SW (somente escuta se já controlado)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", reloadWhenIdle);
    }

    // Verifica a cada 5 min
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("pagehide", clearApiCache);
      window.removeEventListener("online", checkForUpdates);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("controllerchange", reloadWhenIdle);
      }
      clearInterval(interval);
    };
  }, [checkForUpdates]);

  return null;
}
