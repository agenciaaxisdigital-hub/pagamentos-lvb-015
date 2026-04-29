import { useState, useCallback, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { CidadeProvider, useCidade } from "@/contexts/CidadeContext";
import SplashScreen from "@/components/SplashScreen";
import VersionMonitor from "./components/VersionMonitor";
import { useOfflineSync } from "./hooks/useOfflineSync";

// ─── Lazy-loaded pages ─────────────────────────────────────────────────
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Cadastros from "./pages/Cadastros";
import Dashboard from "./pages/Dashboard";
import Usuarios from "./pages/Usuarios";
import Pagamentos from "./pages/Pagamentos";
import ListaLiderancas from "./pages/ListaLiderancas";
import CadastroLideranca from "./pages/CadastroLideranca";
import ListaAdmin from "./pages/ListaAdmin";
import CadastroAdmin from "./pages/CadastroAdmin";
import GerenciarCidades from "./pages/GerenciarCidades";
import NotFound from "./pages/NotFound";

// ─── QueryClient com suporte offline ───────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 60_000,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: "always",
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: (failureCount, error: unknown) => {
        const msg = (error as Error)?.message || "";
        if (msg.includes("JWT") || msg.includes("401")) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

// ─── Limpeza caches de React Query antigos ──────────────────────────────
try {
  Object.keys(window.localStorage).forEach(k => {
    if (k.startsWith("rq_cache") || k.startsWith("REACT_QUERY") || k.startsWith("tanstack")) {
      window.localStorage.removeItem(k);
    }
  });
  const legacyQueue = window.localStorage.getItem("offline_queue");
  if (legacyQueue) {
    try {
      const items = JSON.parse(legacyQueue);
      if (Array.isArray(items) && items.length > 0) {
        import("@/lib/dexieDb").then(({ db, generateOperationId }) => {
          items.forEach((item: any) => {
            db.syncQueue.add({
              action: (item.operation || "INSERT").toUpperCase(),
              table: item.table,
              payload: item.data || item.payload || {},
              matchKey: item.filter ? { [item.filter.column]: item.filter.value } : undefined,
              timestamp: new Date(item.timestamp || Date.now()).toISOString(),
              status: "PENDING",
              retryCount: 0,
              operationId: generateOperationId(),
            }).catch(() => {});
          });
        });
      }
      window.localStorage.removeItem("offline_queue");
    } catch { window.localStorage.removeItem("offline_queue"); }
  }
} catch {}

// ─── Fallback de carregamento ───────────────────────────────────────────
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ─── Rotas protegidas ────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedForRH = false }: { children: React.ReactNode; allowedForRH?: boolean }) {
  const { user, loading: loadingAuth } = useAuth();
  const context = useCidade();
  
  const loading = loadingAuth || !context || context.loading;
  
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-muted">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando permissões...</p>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;
  
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: "100dvh", background: "#070510" }} />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GlobalOfflineSync() {
  useOfflineSync();
  return null;
}

function Index() {
  return <Navigate to="/pagamentos" replace />;
}

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    if (sessionStorage.getItem("splash_shown")) return false;
    sessionStorage.setItem("splash_shown", "1");
    return true;
  });

  const handleSplashFinish = useCallback(() => setShowSplash(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CidadeProvider>
          <GlobalOfflineSync />
          <VersionMonitor />
          <Toaster />
          <Sonner />
          {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
          <BrowserRouter>
            <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
          <Route path="/cadastros/novo" element={<ProtectedRoute><Cadastro /></ProtectedRoute>} />
          <Route path="/cadastros/:id" element={<ProtectedRoute><Cadastro /></ProtectedRoute>} />
          <Route path="/liderancas" element={<ProtectedRoute allowedForRH><ListaLiderancas /></ProtectedRoute>} />
          <Route path="/liderancas/novo" element={<ProtectedRoute allowedForRH><CadastroLideranca /></ProtectedRoute>} />
          <Route path="/liderancas/:id" element={<ProtectedRoute allowedForRH><CadastroLideranca /></ProtectedRoute>} />
          <Route path="/administrativo" element={<ProtectedRoute allowedForRH><ListaAdmin /></ProtectedRoute>} />
          <Route path="/administrativo/novo" element={<ProtectedRoute allowedForRH><CadastroAdmin /></ProtectedRoute>} />
          <Route path="/administrativo/:id" element={<ProtectedRoute allowedForRH><CadastroAdmin /></ProtectedRoute>} />
          <Route path="/pagamentos" element={<ProtectedRoute allowedForRH><Pagamentos /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
          <Route path="/cidades" element={<ProtectedRoute><GerenciarCidades /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
          </BrowserRouter>
        </CidadeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
