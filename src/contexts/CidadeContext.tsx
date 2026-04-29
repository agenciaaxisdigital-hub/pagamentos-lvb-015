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
  isRH: boolean;
  loading: boolean;
  refetchMunicipios: () => Promise<void>;
}

const CidadeContext = createContext<CidadeContextType>({
  municipios: [],
  cidadeAtiva: null,
  cidadeAtivaNome: "Todas as Cidades",
  setCidadeAtiva: () => {},
  isAdmin: false,
  isRH: false,
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
  const [isRH, setIsRH] = useState(false);
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

  const checkPermissions = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setIsRH(false);
      return;
    }

    try {
      // 1. Prioridade: Metadata do Token
      const metaCargo = user.user_metadata?.cargo?.toString().toLowerCase().trim();
      
      if (metaCargo) {
        const isAdm = metaCargo === "admin" || metaCargo === "financeiro_admin";
        const isRh = metaCargo === "administrativo" || metaCargo === "gestor_administrativo";
        
        setIsAdmin(isAdm);
        setIsRH(isRh);
        console.log(`[Permissions] Metadata Match: ${metaCargo} -> Admin:${isAdm}, RH:${isRh}`);
        return;
      }

      // 2. Fallback: Tabela usuários
      const { data: userData } = await supabase
        .from("usuarios")
        .select("cargo")
        .eq("user_id", user.id)
        .maybeSingle();

      const tableCargo = userData?.cargo?.toString().toLowerCase().trim() || "";
      const isAdmTable = tableCargo === "admin" || tableCargo === "financeiro_admin";
      const isRhTable = tableCargo === "administrativo" || tableCargo === "gestor_administrativo";
      
      setIsAdmin(isAdmTable);
      setIsRH(isRhTable);
      console.log(`[Permissions] Table Match: ${tableCargo} -> Admin:${isAdmTable}, RH:${isRhTable}`);

    } catch (err) {
      console.error("[Permissions] Erro crítico:", err);
    }
  }, [user]);

  // Paralelizar fetchMunicipios + checkPermissions com Timeout de Segurança
  useEffect(() => {
    let mounted = true;
    const t0 = performance.now();
    
    // Forçar destravamento da tela após 2 segundos
    const timer = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 2000);

    Promise.all([fetchMunicipios(), checkPermissions()])
      .then(() => {
        if (mounted) console.log(`[CidadeProvider] Init completed in ${(performance.now() - t0).toFixed(0)}ms`);
      })
      .catch(err => {
        console.error("[CidadeProvider] Init error:", err);
      })
      .finally(() => {
        if (mounted) {
          clearTimeout(timer);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [fetchMunicipios, checkPermissions]);

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
    isRH,
    loading,
    refetchMunicipios: fetchMunicipios,
  }), [municipios, cidadeAtiva, cidadeAtivaNome, setCidadeAtiva, isAdmin, isRH, loading, fetchMunicipios]);

  return (
    <CidadeContext.Provider value={value}>
      {children}
    </CidadeContext.Provider>
  );
}
