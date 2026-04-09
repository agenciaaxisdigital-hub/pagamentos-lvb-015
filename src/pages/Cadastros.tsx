import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight, MapPin, ArrowLeft, Trash2, FileDown, Loader2, Plus } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { cidadeAtiva } = useCidade();

  const { data: suplentes, refetch, isLoading } = useQuery({
    queryKey: ["suplentes", cidadeAtiva],
    queryFn: async () => {
      let query = (supabase as any).from("suplentes").select("id, nome, numero_urna, bairro, regiao_atuacao, partido, situacao, total_votos, expectativa_votos, retirada_mensal_valor, retirada_mensal_meses, plotagem_qtd, plotagem_valor_unit, liderancas_qtd, liderancas_valor_unit, fiscais_qtd, fiscais_valor_unit, total_campanha, municipio_id, base_politica, telefone, cargo_disputado, ano_eleicao, assinatura").order("nome");
      if (cidadeAtiva) query = query.eq("municipio_id", cidadeAtiva);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const normalizeStr = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtered = suplentes?.filter((s: any) => {
    if (!search.trim()) return true;
    const term = normalizeStr(search);
    const fields = [s.nome, s.bairro, s.regiao_atuacao, s.numero_urna, s.partido, s.base_politica, s.situacao];
    return fields.some(f => f && normalizeStr(f).includes(term));
  }) ?? [];

  const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const editing = editingId ? suplentes?.find((s: any) => s.id === editingId) : null;

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?`)) return;
    setDeleting(id);
    const { error } = await supabase.from("suplentes").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído com sucesso" });
      refetch();
    }
  };

  const runAutoValidateTotals = async () => {
    try {
      const results = await validateAllFinancials();
      if (results.length > 0) {
        const fixed = results.filter((r) => r.updated).length;
        const withIssues = results.filter((r) => r.issues.length > 0).length;
        toast({
          title: `Validacao concluida: ${results.length} divergencia(s)`,
          description: `${fixed} total(is) corrigido(s) automaticamente${withIssues > 0 ? `, ${withIssues} com alerta(s)` : ""}.`,
        });
        refetch();
      }
    } catch (e: any) {
      console.error("Erro na validacao automatica de totais:", e?.message || e);
    }
  };

  const runAutoValidateRequiredData = async () => {
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
      }
    } catch (e: any) {
      console.error("Erro na validacao automatica de dados obrigatorios:", e?.message || e);
    }
  };

  useEffect(() => {
    runAutoValidateRequiredData();
    runAutoValidateTotals();
    const intervalId = window.setInterval(() => {
      runAutoValidateRequiredData();
      runAutoValidateTotals();
    }, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportFichasLotePDF(filtered)}
              disabled={filtered.length === 0}
              className="text-xs gap-1.5 active:scale-95 transition-transform"
            >
              <FileDown size={14} />
              PDF
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, bairro, região ou nº urna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
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
                const isDeleting = deleting === s.id;

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
                          <p className="font-bold text-foreground text-sm truncate">{s.nome}</p>
                          {s.numero_urna && (
                            <p className="text-[10px] text-muted-foreground truncate">Urna: <span className="font-semibold">{s.numero_urna}</span></p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            {s.partido && <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{s.partido}</span>}
                            {s.situacao && <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.situacao}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            {s.regiao_atuacao && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin size={10} className="text-primary shrink-0" /> {s.regiao_atuacao}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-bold text-primary whitespace-nowrap">{fmt(calcTotaisFinanceiros(s).totalFinal)}</p>
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
                    <div className="grid grid-cols-4 border-t border-border divide-x divide-border bg-muted/40">
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
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
