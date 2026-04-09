import { useState, useCallback, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { CidadeProvider } from "@/contexts/CidadeContext";
import SplashScreen from "@/components/SplashScreen";

// ─── Lazy-loaded pages ─────────────────────────────────────────────────
const Login = lazy(() => import("./pages/Login"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Cadastros = lazy(() => import("./pages/Cadastros"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Pagamentos = lazy(() => import("./pages/Pagamentos"));
const ListaLiderancas = lazy(() => import("./pages/ListaLiderancas"));
const CadastroLideranca = lazy(() => import("./pages/CadastroLideranca"));
const ListaAdmin = lazy(() => import("./pages/ListaAdmin"));
const CadastroAdmin = lazy(() => import("./pages/CadastroAdmin"));
const GerenciarCidades = lazy(() => import("./pages/GerenciarCidades"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

// ─── Limpa caches de React Query antigos (NÃO toca no IndexedDB offline) ──
try {
  Object.keys(window.localStorage).forEach(k => {
    if (k.startsWith("rq_cache") || k.startsWith("REACT_QUERY") || k.startsWith("tanstack")) {
      window.localStorage.removeItem(k);
    }
  });
  // Migra itens pendentes do localStorage (offlineQueue antigo) para Dexie
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
          console.log(`[Boot] Migrados ${items.length} itens do localStorage → Dexie`);
        });
      }
      window.localStorage.removeItem("offline_queue");
    } catch { window.localStorage.removeItem("offline_queue"); }
  }
  console.log("[Boot] Startup limpo — IndexedDB offline preservado");
} catch {}

// ─── Fallback de carregamento leve ──────────────────────────────────────
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// ─── Rotas protegidas ────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-muted">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
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

// ─── App ─────────────────────────────────────────────────────────────────

import VersionMonitor from "./components/VersionMonitor";

import { useOfflineSync } from "./hooks/useOfflineSync";

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
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
                <Route path="/cadastros/novo" element={<ProtectedRoute><Cadastro /></ProtectedRoute>} />
                <Route path="/cadastros/:id" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
                <Route path="/pagamentos" element={<ProtectedRoute><Pagamentos /></ProtectedRoute>} />
                <Route path="/liderancas" element={<ProtectedRoute><ListaLiderancas /></ProtectedRoute>} />
                <Route path="/liderancas/novo" element={<ProtectedRoute><CadastroLideranca /></ProtectedRoute>} />
                <Route path="/liderancas/:id" element={<ProtectedRoute><CadastroLideranca /></ProtectedRoute>} />
                <Route path="/administrativo" element={<ProtectedRoute><ListaAdmin /></ProtectedRoute>} />
                <Route path="/administrativo/novo" element={<ProtectedRoute><CadastroAdmin /></ProtectedRoute>} />
                <Route path="/administrativo/:id" element={<ProtectedRoute><CadastroAdmin /></ProtectedRoute>} />
                <Route path="/cidades" element={<ProtectedRoute><GerenciarCidades /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CidadeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
