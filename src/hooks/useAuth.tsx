import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t0 = performance.now();

    // Listener ANTES de getSession (padrão Supabase)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_OUT') {
        console.log("[Auth] SIGNED_OUT — limpando dados locais");
        // Limpa caches do React Query
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("rq_cache") || k.startsWith("tanstack") || k === "cidade_ativa") {
              localStorage.removeItem(k);
            }
          });
        } catch {}
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log("[Auth] Token renovado com sucesso");
      }
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("[Auth] getSession error:", error.message);
        // Offline com token expirado: permite navegação com dados locais
        if (!navigator.onLine) {
          console.warn("[Auth] Offline + auth error — permitindo acesso local");
          // Mantém user null, loading false — app pode mostrar dados cached
        }
      }
      setUser(session?.user ?? null);
      setLoading(false);
      console.log(`[Auth] getSession in ${(performance.now() - t0).toFixed(0)}ms`, session ? "authenticated" : "no session");
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  return { user, loading, signOut };
}
