import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, MapPin, Phone, Trash2, ChevronRight, Loader2, FileDown, Filter } from "lucide-react";
import { exportLiderancasExcel, exportLiderancaPDF } from "@/lib/exports";
import { PageTransition } from "@/components/PageTransition";
import { CardSkeletonList } from "@/components/CardSkeleton";
import { useCidade } from "@/contexts/CidadeContext";
import { fmt } from "@/components/dashboard/types";

const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function ListaLiderancas() {
  const navigate = useNavigate();

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filtroVinculo, setFiltroVinculo] = useState<string>("todos");
  const { cidadeAtiva } = useCidade();

  const { data: suplentesNomes, isLoading: loadS } = useQuery({
    queryKey: ["suplentes-nomes-map", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("suplentes").select("id, nome").order("nome");
      if (cidadeAtiva) {
        query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
      }
      const { data, error } = await query;
      if (error) return [];
      return data;
    },
    staleTime: 0, // Sem cache longo para atualização simultânea
  });

  const { data: todasLiderancasNomes, isLoading: loadL } = useQuery({
    queryKey: ["liderancas-nomes-map", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("liderancas").select("id, nome").order("nome");
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
    (todasLiderancasNomes || []).forEach((l: any) => { map[l.id] = l.nome; });
    return map;
  }, [suplentesNomes, todasLiderancasNomes]);

  const { data: liderancas, isLoading: loadData } = useQuery({
    queryKey: ["liderancas", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("liderancas").select("*").order("nome");
      if (cidadeAtiva) {
        query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const isLoading = loadData || loadS || loadL;

  const filtered = useMemo(() => {
    if (!liderancas) return [];
    
    let result = liderancas;
    
    // Filtro por Vínculo
    if (filtroVinculo !== "todos") {
      result = result.filter((l: any) => l.suplente_id === filtroVinculo || l.lideranca_vinculada_id === filtroVinculo);
    }

    if (!search.trim()) return result;
    
    const term = norm(search);
    return result.filter((l: any) => 
      norm(l.nome || "").includes(term) ||
      norm(l.regiao || "").includes(term) ||
      norm(l.ligacao_politica || "").includes(term)
    );
  }, [liderancas, filtroVinculo, search]);

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir "${nome}"?`)) return;
    setDeleting(id);
    const { error } = await (supabase as any).from("liderancas").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído com sucesso" });
      qc.setQueriesData<any[]>({ queryKey: ["liderancas"] }, (old) =>
        Array.isArray(old) ? old.filter(l => l.id !== id) : (old ?? [])
      );
      qc.invalidateQueries({ queryKey: ["liderancas"] });
      qc.invalidateQueries({ queryKey: ["liderancas-nomes-map"] });
    }
  };

  const totalMensal = useMemo(() => filtered.reduce((a: number, l: any) => a + (l.retirada_mensal_valor || 0), 0), [filtered]);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Lideranças</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate("/liderancas/novo")}
              className="bg-gradient-to-r from-pink-500 to-rose-400 text-white gap-1.5 active:scale-95 transition-transform"
            >
              <Plus size={15} /> Nova
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportLiderancasExcel(filtered)}
              disabled={filtered.length === 0}
              className="text-xs gap-1.5 active:scale-95 transition-transform"
            >
              <FileDown size={14} />
              Excel
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, setor ou cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>

          <div className="w-full sm:w-64">
            <Select value={filtroVinculo} onValueChange={setFiltroVinculo}>
              <SelectTrigger className="bg-card border-border">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por vínculo" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os vínculos</SelectItem>
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">Suplentes</SelectLabel>
                  {(suplentesNomes || []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">Lideranças</SelectLabel>
                  {(todasLiderancasNomes || []).map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <CardSkeletonList count={3} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Nenhuma liderança cadastrada</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/liderancas/novo")}>
              <Plus size={14} /> Cadastrar agora
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{filtered.length} registro(s)</p>
              <p className="text-xs font-bold text-primary">Total: {fmt(totalMensal)}/mês</p>
            </div>
            <div className="space-y-3">
              {filtered.map((l: any, i: number) => (
                <div
                  key={l.id}
                  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${Math.min(i * 40, 200)}ms`, animationFillMode: "both" }}
                >
                  <button
                    onClick={() => navigate(`/liderancas/${l.id}`)}
                    className="w-full text-left p-3 active:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground text-sm truncate">{l.nome}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {l.regiao && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin size={10} className="text-primary shrink-0" /> {l.regiao}
                            </span>
                          )}
                          {l.ligacao_politica && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{l.ligacao_politica}</span>}
                          {l.suplente_id && nomesMap[l.suplente_id] && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-700 dark:text-violet-400 border border-violet-500/20 shadow-sm">
                              <div className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" />
                              Suplente: {nomesMap[l.suplente_id]}
                            </span>
                          )}
                          {l.lideranca_vinculada_id && nomesMap[l.lideranca_vinculada_id] && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shadow-sm">
                              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                              Vínculo: {nomesMap[l.lideranca_vinculada_id]}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 mt-1">
                          {l.whatsapp && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Phone size={9} /> {l.whatsapp}
                            </span>
                          )}
                          {l.chave_pix && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">PIX: {l.chave_pix}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-primary">{fmt(l.retirada_mensal_valor || 0)}<span className="text-[10px] text-muted-foreground font-normal">/mês</span></span>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                  <div className="flex border-t border-border divide-x divide-border">
                    <button
                      onClick={() => exportLiderancaPDF(l)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary active:bg-primary/10"
                    >
                      <FileDown size={13} /> PDF
                    </button>
                    <button
                      onClick={() => handleDelete(l.id, l.nome)}
                      disabled={deleting === l.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-destructive active:bg-destructive/10 disabled:opacity-50"
                    >
                      {deleting === l.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
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
