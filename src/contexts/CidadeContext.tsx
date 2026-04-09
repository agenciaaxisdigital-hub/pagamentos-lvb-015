import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Municipio {
  id: string;
  nome: string;
  uf: string;
  ativo: boolean;
  criado_em: string;
}

interface CidadeContextType {
  municipios: Municipio[];
  cidadeAtiva: string | null;
  cidadeAtivaNome: string;
  setCidadeAtiva: (id: string | null) => void;
  isAdmin: boolean;
  loading: boolean;
  refetchMunicipios: () => Promise<void>;
}

const CidadeContext = createContext<CidadeContextType>({
  municipios: [],
  cidadeAtiva: null,
  cidadeAtivaNome: "Todas as Cidades",
  setCidadeAtiva: () => {},
  isAdmin: false,
  loading: true,
  refetchMunicipios: async () => {},
});

export const useCidade = () => useContext(CidadeContext);

const STORAGE_KEY = "cidade_ativa";

export function CidadeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [cidadeAtiva, setCidadeAtivaState] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored !== "todas" ? stored : null;
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMunicipios = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("municipios")
      .select("id, nome, uf, ativo, criado_em")
      .eq("ativo", true)
      .order("nome");
    if (!error && data) {
      setMunicipios(data);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored || stored === "") {
        const aparecida = data.find((m: Municipio) => m.nome.toLowerCase().includes("aparecida"));
        if (aparecida) {
          setCidadeAtivaState(aparecida.id);
          localStorage.setItem(STORAGE_KEY, aparecida.id);
        } else if (data.length === 1) {
          setCidadeAtivaState(data[0].id);
          localStorage.setItem(STORAGE_KEY, data[0].id);
        }
      }
      if (stored && stored !== "todas" && !data.find((m: Municipio) => m.id === stored)) {
        const aparecida = data.find((m: Municipio) => m.nome.toLowerCase().includes("aparecida"));
        const fallback = aparecida || data[0];
        if (fallback) {
          setCidadeAtivaState(fallback.id);
          localStorage.setItem(STORAGE_KEY, fallback.id);
        }
      }
    }
  }, []);

  const checkAdmin = useCallback(async () => {
    if (!user) { setIsAdmin(false); return; }
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setIsAdmin(!!data);
  }, [user]);

  // Paralelizar fetchMunicipios + checkAdmin
  useEffect(() => {
    const t0 = performance.now();
    Promise.all([fetchMunicipios(), checkAdmin()])
      .then(() => {
        console.log(`[CidadeProvider] Init completed in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch(err => console.error("[CidadeProvider] Init error:", err))
      .finally(() => setLoading(false));
  }, [fetchMunicipios, checkAdmin]);

  const setCidadeAtiva = useCallback((id: string | null) => {
    setCidadeAtivaState(id);
    localStorage.setItem(STORAGE_KEY, id || "todas");
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "todas") {
      setCidadeAtivaState(null);
    }
  }, []);

  const cidadeAtivaNome = useMemo(() => {
    if (!cidadeAtiva) return "Todas as Cidades";
    const m = municipios.find(m => m.id === cidadeAtiva);
    return m ? `${m.nome}` : "Todas as Cidades";
  }, [cidadeAtiva, municipios]);

  const value = useMemo(() => ({
    municipios,
    cidadeAtiva,
    cidadeAtivaNome,
    setCidadeAtiva,
    isAdmin,
    loading,
    refetchMunicipios: fetchMunicipios,
  }), [municipios, cidadeAtiva, cidadeAtivaNome, setCidadeAtiva, isAdmin, loading, fetchMunicipios]);

  return (
    <CidadeContext.Provider value={value}>
      {children}
    </CidadeContext.Provider>
  );
}
