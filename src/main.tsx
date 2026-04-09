import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: Guard against service worker in iframes/preview
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
} else {
  // Register SW with auto-update + periodic check every 60s
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          // Check for updates every 60 seconds
          setInterval(() => {
            registration.update();
          }, 60 * 1000);
        }
      },
      onOfflineReady() {
        console.log("[PWA] App pronta para uso offline");
      },
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
