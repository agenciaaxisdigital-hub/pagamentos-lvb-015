import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Phone, ChevronRight, FileDown, FileText, Pause } from "lucide-react";
import { exportAdminPDF } from "@/lib/exports";
import { PageTransition } from "@/components/PageTransition";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { useCidade } from "@/contexts/CidadeContext";
import { mergePausados, pauseCollaborator, reactivateCollaborator } from "@/lib/pausadosFallback";
import { toast } from "@/hooks/use-toast";

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: any) => (s ? String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "");

export default function ListaAdmin() {
  const navigate = useNavigate();
  const [search, setSearch] = usePersistedState("busca-admin", "");
  const [verPausados, setVerPausados] = usePersistedState("admin-ver-pausados", false);
  const { cidadeAtiva } = useCidade();

  const { data: suplentesNomes, isLoading: loadS } = useQuery({
    queryKey: ["suplentes-nomes-map", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("suplentes").select("id, nome");
      if (cidadeAtiva) {
        query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
      }
      const { data, error } = await query;
      if (error) return [];
      return data;
    },
    staleTime: 0,
  });

  const nomesMap = useMemo(() => {
    const map: Record<string, string> = {};
    (suplentesNomes || []).forEach((s: any) => { map[s.id] = s.nome; });
    return map;
  }, [suplentesNomes]);

  const { data: funcionarios, refetch, isLoading: loadData } = useQuery({
    queryKey: ["administrativo", cidadeAtiva],
    queryFn: async () => {
      let query = (supabase as any).from("administrativo").select("id, nome, cpf, whatsapp, valor_contrato, contrato_ate_mes, municipio_id, contrato_url").order("nome");
      if (cidadeAtiva) {
        query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const isLoading = loadData || loadS;

  const mergedFuncionarios = useMemo(() => mergePausados(funcionarios, "admin"), [funcionarios]);
  const adminAtivos = useMemo(() => (mergedFuncionarios || []).filter((f: any) => !f.pausado), [mergedFuncionarios]);
  const adminPausados = useMemo(() => (mergedFuncionarios || []).filter((f: any) => f.pausado), [mergedFuncionarios]);

  const filtered = useMemo(() => {
    const baseList = verPausados ? adminPausados : adminAtivos;
    if (!baseList) return [];
    if (!search.trim()) return baseList;
    const term = norm(search);
    return baseList.filter((f: any) => norm(f.nome || "").includes(term) || (f.cpf || "").includes(term));
  }, [adminAtivos, adminPausados, search, verPausados]);

  const handlePause = async (id: string, nome: string, pausar: boolean) => {
    if (pausar) {
      const confirm = window.confirm(`Deseja pausar ${nome}? Ele não aparecerá mais nos pagamentos ativos nem somará nas previsões do dashboard.`);
      if (!confirm) return;
      
      const { success, error } = await pauseCollaborator(id, "admin");
      if (!success) {
        toast({ title: "Erro ao pausar", description: error?.message || "Erro desconhecido", variant: "destructive" });
        return;
      }
      toast({ title: `${nome} pausado com sucesso!`, description: "Ele foi movido para a aba de Pausados." });
      navigate("/pausados");
    } else {
      const confirm = window.confirm(`Deseja reativar ${nome}? Ele voltará a aparecer nos pagamentos e somar no dashboard.`);
      if (!confirm) return;

      const { success, error } = await reactivateCollaborator(id, "admin", { pausado: false });
      if (!success) {
        toast({ title: "Erro ao reativar", description: error?.message || "Erro desconhecido", variant: "destructive" });
        return;
      }
      toast({ title: `${nome} reativado com sucesso!` });
    }
    refetch();
  };

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Administrativo</h1>
          <Button
            size="sm"
            onClick={() => navigate("/administrativo/novo")}
            className="bg-gradient-to-r from-slate-700 to-slate-500 text-white gap-1.5 active:scale-95 transition-transform"
          >
            <Plus size={15} /> Novo
          </Button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>

        {/* Ativos / Pausados Tabs */}
        <div className="flex gap-2 border-b border-border/50 pb-1.5">
          <button
            onClick={() => setVerPausados(false)}
            className={`pb-1.5 px-3 text-xs font-bold transition-all relative ${!verPausados ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Ativos ({adminAtivos.length})
          </button>
          <button
            onClick={() => setVerPausados(true)}
            className={`pb-1.5 px-3 text-xs font-bold transition-all relative ${verPausados ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pausados / Retirados ({adminPausados.length})
          </button>
        </div>

        {isLoading ? (
          <CardSkeletonList count={3} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Nenhum funcionário cadastrado</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/administrativo/novo")}>
              <Plus size={14} /> Cadastrar agora
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{filtered.length} registro(s)</p>
            <div className="space-y-3">
              {filtered.map((f: any, i: number) => (
                <div
                  key={f.id}
                  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 40, 200)}ms`, animationFillMode: "both" }}
                >
                  <button
                    onClick={() => navigate(`/administrativo/${f.id}`)}
                    className="w-full text-left p-3 active:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground text-sm truncate">{f.nome}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {f.cpf && <span className="text-[11px] font-mono text-muted-foreground">{f.cpf}</span>}
                          {f.whatsapp && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Phone size={9} /> {f.whatsapp}
                            </span>
                          )}
                          {f.suplente_id && nomesMap?.[f.suplente_id] && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20 shadow-sm">
                              <div className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" />
                              Suplente: {nomesMap?.[f.suplente_id]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-primary">{fmt(f.valor_contrato || 0)}<span className="text-[10px] text-muted-foreground font-normal">/mês</span></span>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                  <div className="flex border-t border-border divide-x divide-border">
                    <button
                      onClick={() => exportAdminPDF(f)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary active:bg-primary/10"
                    >
                      <FileDown size={13} /> PDF
                    </button>
                    {f.contrato_url && (
                      <a
                        href={f.contrato_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-violet-600 dark:text-violet-400 active:bg-violet-500/10"
                      >
                        <FileText size={13} /> Contrato
                      </a>
                    )}
                    {!verPausados ? (
                      <button
                        onClick={() => handlePause(f.id, f.nome, true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-amber-500 hover:text-amber-600 hover:bg-amber-500/5 active:bg-amber-500/10 font-bold"
                      >
                        <Pause size={13} /> Pausar
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePause(f.id, f.nome, false)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 active:bg-emerald-500/10 font-bold"
                      >
                        <Plus size={13} /> Reativar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
