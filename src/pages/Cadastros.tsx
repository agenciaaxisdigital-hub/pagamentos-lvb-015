import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useDeleteWithUndo } from "@/hooks/useDeleteWithUndo";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, MapPin, ArrowLeft, Trash2, FileDown, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import Cadastro from "./Cadastro";
import { exportFichasLotePDF, exportSuplentePDF, exportExcel } from "@/lib/exports";
import { calcTotaisFinanceiros } from "@/lib/finance";
import { validateAllFinancials } from "@/lib/validateFinancials";
import { validateRequiredData } from "@/lib/validateRequiredData";
import { PageTransition } from "@/components/PageTransition";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { useCidade } from "@/contexts/CidadeContext";

export default function Cadastros() {
  const navigate = useNavigate();
  const { deleteWithUndo } = useDeleteWithUndo();
  const [search, setSearch] = usePersistedState("busca-suplentes", "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const { cidadeAtiva } = useCidade();

  const { data: suplentes, refetch, isLoading } = useQuery({
    queryKey: ["suplentes", cidadeAtiva],
    queryFn: async () => {
      let query = (supabase as any).from("suplentes").select("id, nome, numero_urna, bairro, regiao_atuacao, partido, situacao, total_votos, expectativa_votos, retirada_mensal_valor, retirada_mensal_meses, plotagem_qtd, plotagem_valor_unit, liderancas_qtd, liderancas_valor_unit, fiscais_qtd, fiscais_valor_unit, total_campanha, municipio_id, base_politica, telefone, cargo_disputado, ano_eleicao, assinatura").order("nome");
      if (cidadeAtiva) {
        query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const normalizeStr = (str: string) =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    if (!suplentes) return [];
    if (!search.trim()) return suplentes;
    const term = normalizeStr(search);
    return suplentes.filter((s: any) => {
      const fields = [s.nome, s.bairro, s.regiao_atuacao, s.numero_urna, s.partido, s.base_politica, s.situacao];
      return fields.some(f => f && normalizeStr(f).includes(term));
    });
  }, [suplentes, search]);

  const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const nomesMap = useMemo(() => {
    const map: Record<string, string> = {};
    (suplentes || []).forEach((s: any) => { map[s.id] = s.nome; });
    return map;
  }, [suplentes]);

  const editing = useMemo(() => editingId ? suplentes?.find((s: any) => s.id === editingId) : null, [suplentes, editingId]);

  const handleDelete = (id: string, nome: string) => {
    deleteWithUndo({
      queryKey: ["suplentes"],
      itemId: id,
      deleteFn: async () => supabase.from("suplentes").delete().eq("id", id),
      label: nome,
    });
  };

  // Funções de validação agora são manuais (removidas do useEffect)
  const runAutoValidateTotals = async () => {
    toast({ title: "Validando totais...", description: "Por favor aguarde." });
    try {
      const results = await validateAllFinancials();
      if (results.length > 0) {
        const fixed = results.filter((r) => r.updated).length;
        const withIssues = results.filter((r) => r.issues.length > 0).length;
        toast({
          title: `Validação concluída: ${results.length} divergência(s)`,
          description: `${fixed} total(is) corrigido(s) automaticamente${withIssues > 0 ? `, ${withIssues} com alerta(s)` : ""}.`,
        });
        refetch();
      } else {
        toast({ title: "Tudo certo!", description: "Nenhuma divergência encontrada." });
      }
    } catch (e: any) {
      console.error("Erro na validação automática de totais:", e?.message || e);
    }
  };

  const runAutoValidateRequiredData = async () => {
    toast({ title: "Buscando dados no TSE...", description: "Isso pode levar alguns segundos." });
    try {
      const results = await validateRequiredData();
      if (results.length > 0) {
        const updated = results.filter((r) => r.updated).length;
        const campos = [...new Set(results.map((r) => r.campo))];
        toast({
          title: `Dados corrigidos: ${updated} campo(s)`,
          description: `Campos atualizados via TSE: ${campos.join(", ")}`,
        });
        refetch();
      } else {
        toast({ title: "Tudo certo!", description: "Dados já estão sincronizados com o TSE." });
      }
    } catch (e: any) {
      console.error("Erro na validação automática de dados obrigatórios:", e?.message || e);
    }
  };

  if (editing) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <button onClick={() => setEditingId(null)} className="flex items-center gap-1 text-sm text-primary font-medium active:scale-95 transition-transform">
            <ArrowLeft size={16} /> Voltar à lista
          </button>
          <Cadastro
            initial={editing as any}
            onSaved={() => { setEditingId(null); refetch(); }}
          />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Suplentes</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate("/cadastros/novo")}
              className="text-xs gap-1.5 bg-gradient-to-r from-pink-500 to-rose-400 text-white font-bold active:scale-95 transition-transform"
            >
              <Plus size={14} />
              Novo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportExcel(filtered)}
              disabled={filtered.length === 0}
              className="text-xs gap-1.5 active:scale-95 transition-transform"
            >
              <FileDown size={14} />
              Excel
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, bairro, região ou nº urna..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={runAutoValidateTotals} className="text-[10px] h-10 flex-1 sm:flex-none">Revisar Totais</Button>
             <Button variant="outline" size="sm" onClick={runAutoValidateRequiredData} className="text-[10px] h-10 flex-1 sm:flex-none">Sincronizar TSE</Button>
          </div>
        </div>

        {isLoading ? (
          <CardSkeletonList count={4} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{filtered.length} registro(s)</p>

            <div className="space-y-3">
              {filtered.map((s: any, index: number) => {
                const liderancas = (s.liderancas_qtd || 0);
                const fiscais = (s.fiscais_qtd || 0);
                const plotagem = (s.plotagem_qtd || 0);
                const pessoas = liderancas + fiscais;
                const retirada = (s.retirada_mensal_valor || 0) * (s.retirada_mensal_meses || 0);
                const liderancasVal = liderancas * (s.liderancas_valor_unit || 0);
                const fiscaisVal = fiscais * (s.fiscais_valor_unit || 0);
                const plotagemVal = plotagem * (s.plotagem_valor_unit || 0);
                const fmtN = (v: number) => (v || 0).toLocaleString("pt-BR");

                return (
                  <div
                    key={s.id}
                    className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-in"
                    style={{ animationDelay: `${Math.min(index * 50, 300)}ms`, animationFillMode: "both" }}
                  >
                    {/* Header */}
                    <button
                      onClick={() => setEditingId(s.id)}
                      className="w-full text-left p-3 pb-2 active:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground text-sm text-wrap-anywhere">{s.nome}</p>
                          {s.numero_urna && (
                            <p className="text-[10px] text-muted-foreground text-wrap-anywhere">Urna: <span className="font-semibold">{s.numero_urna}</span></p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            {s.partido && <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{s.partido}</span>}
                            {s.situacao && <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.situacao}</span>}
                            {s.vinculado_id && nomesMap[s.vinculado_id] && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-sm">
                                  <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                  Vínculo: {nomesMap[s.vinculado_id]}
                                </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            {s.regiao_atuacao && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin size={10} className="text-primary shrink-0" /> {s.regiao_atuacao}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-bold text-primary numeric-compact">{fmt(calcTotaisFinanceiros(s).totalFinal)}</p>
                      </div>
                    </button>

                    {/* Row 1: Votos / Expectativa / Pessoas */}
                    <div className="grid grid-cols-3 border-t border-border divide-x divide-border bg-muted/40">
                      <div className="py-2 px-1 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Votos</p>
                        <p className="text-sm font-bold text-foreground">{s.total_votos ? fmtN(s.total_votos) : "—"}</p>
                      </div>
                      <div className="py-2 px-1 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Expect.</p>
                        <p className="text-sm font-bold text-foreground">{s.expectativa_votos ? fmtN(s.expectativa_votos) : "—"}</p>
                      </div>
                      <div className="py-2 px-1 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Pessoas</p>
                        <p className="text-sm font-bold text-foreground">{fmtN(pessoas)}</p>
                      </div>
                    </div>

                    {/* Row 2: Lideranças / Fiscais / Plotagem / Retirada */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border sm:divide-x divide-border bg-muted/40">
                      <div className="py-2 px-1 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Líder.</p>
                        <p className="text-sm font-bold text-foreground">{fmtN(liderancas)}</p>
                        <p className="text-[9px] text-muted-foreground">{fmt(liderancasVal)}</p>
                      </div>
                      <div className="py-2 px-1 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Fiscais</p>
                        <p className="text-sm font-bold text-foreground">{fmtN(fiscais)}</p>
                        <p className="text-[9px] text-muted-foreground">{fmt(fiscaisVal)}</p>
                      </div>
                      <div className="py-2 px-1 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Plotag.</p>
                        <p className="text-sm font-bold text-foreground">{fmtN(plotagem)}</p>
                        <p className="text-[9px] text-muted-foreground">{fmt(plotagemVal)}</p>
                      </div>
                      <div className="py-2 px-1 text-center">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Retirada</p>
                        <p className="text-xs font-bold text-foreground">{fmt(retirada)}</p>
                        <p className="text-[9px] text-muted-foreground">{s.retirada_mensal_meses || 0}x {fmt(s.retirada_mensal_valor || 0)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end px-3 py-1.5 border-t border-border gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary active:scale-95" onClick={() => exportSuplentePDF(s)}>
                        <FileDown size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive active:scale-95"
                        onClick={() => handleDelete(s.id, s.nome)}
                      >
                        <Trash2 size={14} />
                      </Button>
                      <ChevronRight size={16} className="text-muted-foreground cursor-pointer" onClick={() => setEditingId(s.id)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
