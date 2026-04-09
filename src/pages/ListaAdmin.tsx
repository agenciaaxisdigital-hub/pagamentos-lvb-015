import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Phone, Trash2, ChevronRight, Loader2, FileDown } from "lucide-react";
import { exportAdminPDF } from "@/lib/exports";
import { PageTransition } from "@/components/PageTransition";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { useCidade } from "@/contexts/CidadeContext";

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ListaAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const { cidadeAtiva } = useCidade();

  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ["administrativo", cidadeAtiva],
    queryFn: async () => {
      let query = (supabase as any).from("administrativo").select("id, nome, cpf, whatsapp, valor_contrato, contrato_ate_mes, municipio_id").order("nome");
      if (cidadeAtiva) query = query.eq("municipio_id", cidadeAtiva);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const filtered = funcionarios?.filter((f: any) => {
    if (!search.trim()) return true;
    const term = norm(search);
    return norm(f.nome || "").includes(term) || (f.cpf || "").includes(term);
  }) ?? [];

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?`)) return;
    setDeleting(id);
    const { error } = await (supabase as any).from("administrativo").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído com sucesso" });
      qc.invalidateQueries({ queryKey: ["administrativo"] });
    }
  };

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Administrativo</h1>
          <Button
            size="sm"
            onClick={() => navigate("/administrativo/novo")}
            className="bg-gradient-to-r from-pink-500 to-rose-400 text-white gap-1.5 active:scale-95 transition-transform"
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
                    <button
                      onClick={() => handleDelete(f.id, f.nome)}
                      disabled={deleting === f.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-destructive active:bg-destructive/10 disabled:opacity-50"
                    >
                      {deleting === f.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Excluir
                    </button>
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
