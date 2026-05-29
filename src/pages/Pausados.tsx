import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/PageTransition";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useCidade } from "@/contexts/CidadeContext";
import { CardSkeletonList } from "@/components/CardSkeleton";
import {
  Pause, Search, Users, Briefcase, List, RefreshCw, X,
  Clock, Calendar, Receipt, ChevronDown, ChevronUp, DollarSign,
  Info
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcTotaisFinanceiros } from "@/lib/finance";
import { mergePausados, reactivateCollaborator } from "@/lib/pausadosFallback";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

type PausadoColab = {
  id: string;
  nome: string;
  tipo: "suplente" | "lideranca" | "admin";
  details: string;
  dataPausa: string | null;
  objetoOriginal: any;
};

export default function Pausados() {
  const qc = useQueryClient();
  const { cidadeAtiva } = useCidade();
  const [busca, setBusca] = usePersistedState("pausados-busca", "");
  const [filtroTipo, setFiltroTipo] = usePersistedState<"todos" | "suplente" | "lideranca" | "admin">("pausados-filtro-tipo", "todos");
  
  // Controle do histórico expandido localmente
  const [historicoExpandido, setHistoricoExpandido] = useState<Record<string, boolean>>({});

  // Controle de Reativação
  const [colabReativando, setColabReativando] = useState<{
    id: string;
    nome: string;
    tipo: "suplente" | "lideranca" | "admin";
    valor: number;
    inicioMes: number;
    fimMes: number;
    diaVencimento: number;
    details?: string;
  } | null>(null);
  const [salvandoReativacao, setSalvandoReativacao] = useState(false);

  // 1. Queries
  const { data: suplentes, isLoading: loadS, refetch: refetchS } = useQuery({
    queryKey: ["suplentes-pausados", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("suplentes").select("*").order("nome");
      if (cidadeAtiva) {
        query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const { data: liderancas, isLoading: loadL, refetch: refetchL } = useQuery({
    queryKey: ["liderancas-pausados", cidadeAtiva],
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

  const { data: administrativo, isLoading: loadA, refetch: refetchA } = useQuery({
    queryKey: ["administrativo-pausados", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("administrativo").select("*").order("nome");
      if (cidadeAtiva) {
        query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const { data: pagamentos, isLoading: loadP } = useQuery({
    queryKey: ["pagamentos-pausados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 0,
  });

  const isLoading = loadS || loadL || loadA || loadP;

  const refetchAll = () => {
    refetchS();
    refetchL();
    refetchA();
    qc.invalidateQueries();
  };

  // 2. Mapeamento de Pausados Unificados
  const pausadosUnificados = useMemo(() => {
    const list: PausadoColab[] = [];
    
    const mergedSuplentes = mergePausados(suplentes, "suplente");
    const mergedLiderancas = mergePausados(liderancas, "lideranca");
    const mergedAdministrativo = mergePausados(administrativo, "admin");

    (mergedSuplentes || []).forEach((s: any) => {
      if (s.pausado) {
        list.push({
          id: s.id,
          nome: s.nome,
          tipo: "suplente",
          details: s.partido || "Sem partido",
          dataPausa: s.data_pausa || s.updated_at || null,
          objetoOriginal: s
        });
      }
    });

    (mergedLiderancas || []).forEach((l: any) => {
      if (l.pausado) {
        list.push({
          id: l.id,
          nome: l.nome,
          tipo: "lideranca",
          details: l.regiao || "Liderança",
          dataPausa: l.data_pausa || l.updated_at || null,
          objetoOriginal: l
        });
      }
    });

    (mergedAdministrativo || []).forEach((a: any) => {
      if (a.pausado) {
        list.push({
          id: a.id,
          nome: a.nome,
          tipo: "admin",
          details: a.whatsapp || "Administrativo",
          dataPausa: a.data_pausa || a.updated_at || null,
          objetoOriginal: a
        });
      }
    });

    return list;
  }, [suplentes, liderancas, administrativo]);

  // 3. Filtrados
  const filtered = useMemo(() => {
    let result = pausadosUnificados;

    if (filtroTipo !== "todos") {
      result = result.filter(p => p.tipo === filtroTipo);
    }

    if (busca.trim()) {
      const term = norm(busca);
      result = result.filter(p => norm(p.nome).includes(term) || norm(p.details).includes(term));
    }

    return result;
  }, [pausadosUnificados, filtroTipo, busca]);

  // 4. Fluxo de Reativação
  const startReativar = (p: PausadoColab) => {
    let valor = 0;
    let inicioMes = Math.max(new Date().getMonth() + 1, 3);
    let fimMes = 10;
    let diaVencimento = 10;

    const s = p.objetoOriginal;
    if (p.tipo === "suplente") {
      valor = s.retirada_mensal_valor || 0;
      diaVencimento = s.dia_vencimento || 10;
      const meses = s.retirada_mensal_meses || 1;
      inicioMes = Math.max(3, 10 - meses + 1);
      fimMes = 10;
    } else if (p.tipo === "lideranca") {
      valor = s.retirada_mensal_valor || 0;
      diaVencimento = s.dia_vencimento || 10;
      fimMes = s.retirada_ate_mes || 10;
      const meses = s.retirada_mensal_meses || 1;
      inicioMes = Math.max(3, fimMes - meses + 1);
    } else if (p.tipo === "admin") {
      valor = s.valor_contrato || 0;
      diaVencimento = s.dia_vencimento || 10;
      fimMes = s.contrato_ate_mes || 10;
      const meses = s.valor_contrato_meses || 1;
      inicioMes = Math.max(3, fimMes - meses + 1);
    }

    setColabReativando({
      id: p.id,
      nome: p.nome,
      tipo: p.tipo,
      valor,
      inicioMes,
      fimMes,
      diaVencimento,
      details: p.details,
    });
  };

  const confirmReativar = async () => {
    if (!colabReativando) return;
    
    const { id, tipo, valor, inicioMes, fimMes, diaVencimento } = colabReativando;
    
    if (valor <= 0) {
      toast({ title: "Valor inválido", description: "O valor do pagamento deve ser maior que zero.", variant: "destructive" });
      return;
    }
    if (diaVencimento < 1 || diaVencimento > 31) {
      toast({ title: "Vencimento inválido", description: "O dia de vencimento deve ser entre 1 e 31.", variant: "destructive" });
      return;
    }
    if (inicioMes > fimMes) {
      toast({ title: "Mês inválido", description: "O mês de início não pode ser após o mês de término.", variant: "destructive" });
      return;
    }

    setSalvandoReativacao(true);
    try {
      const totalMeses = Math.max(1, fimMes - inicioMes + 1);

      let payload: any = {
        dia_vencimento: diaVencimento,
      };

      if (tipo === "suplente") {
        payload.retirada_mensal_valor = valor;
        payload.retirada_mensal_meses = totalMeses;
        const s = (suplentes || []).find((x: any) => x.id === id);
        const plotagemTotal = (s?.plotagem_qtd || 0) * (s?.plotagem_valor_unit || 0);
        const liderancasTotal = (s?.liderancas_qtd || 0) * (s?.liderancas_valor_unit || 0);
        const fiscaisTotal = (s?.fiscais_qtd || 0) * (s?.fiscais_valor_unit || 0);
        payload.total_campanha = (valor * totalMeses) + plotagemTotal + liderancasTotal + fiscaisTotal;
      } else if (tipo === "lideranca") {
        payload.retirada_mensal_valor = valor;
        payload.retirada_mensal_meses = totalMeses;
        payload.retirada_ate_mes = fimMes;
      } else if (tipo === "admin") {
        payload.valor_contrato = valor;
        payload.valor_contrato_meses = totalMeses;
        payload.contrato_ate_mes = fimMes;
      }

      const { success, error } = await reactivateCollaborator(id, tipo, payload);
      if (!success) throw error;

      toast({
        title: `${colabReativando.nome} reativado!`,
        description: `O colaborador retornou com sucesso ao status ativo com o novo plano de pagamento.`,
      });

      setColabReativando(null);
      refetchAll();
    } catch (error: any) {
      toast({
        title: "Erro ao reativar colaborador",
        description: error.message || "Erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setSalvandoReativacao(false);
    }
  };

  const toggleHistorico = (id: string) => {
    setHistoricoExpandido(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getPagsColab = (p: PausadoColab) => {
    return (pagamentos || []).filter(x => {
      if (p.tipo === "suplente") return x.suplente_id === p.id;
      if (p.tipo === "lideranca") return x.lideranca_id === p.id;
      return x.admin_id === p.id;
    });
  };

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Modal de Reativação */}
        <Dialog open={colabReativando !== null} onOpenChange={(open) => { if (!open) setColabReativando(null); }}>
          <DialogContent className="max-w-md rounded-3xl p-5 sm:p-6 border border-border shadow-2xl bg-card animate-scale-in">
            {colabReativando && (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-foreground font-black text-base sm:text-lg">
                    <span className="w-2 h-6 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600" />
                    Reativar Colaborador
                  </DialogTitle>
                  <DialogDescription className="text-left text-xs text-muted-foreground mt-1">
                    Configure os valores de retorno de <strong className="text-foreground">{colabReativando.nome}</strong>.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3.5 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Valor Mensal</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          value={colabReativando.valor || ""}
                          onChange={(e) => setColabReativando({ ...colabReativando, valor: parseFloat(e.target.value) || 0 })}
                          className="pl-8 bg-card border-border font-bold text-sm h-11 shadow-sm"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Dia Vencimento</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={colabReativando.diaVencimento || ""}
                        onChange={(e) => setColabReativando({ ...colabReativando, diaVencimento: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })}
                        className="bg-card border-border font-bold text-sm h-11 text-center shadow-sm"
                        placeholder="10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Mês de Retorno</label>
                      <Select
                        value={String(colabReativando.inicioMes)}
                        onValueChange={(val) => {
                          const newInicio = parseInt(val);
                          setColabReativando({
                            ...colabReativando,
                            inicioMes: newInicio,
                            fimMes: Math.max(newInicio, colabReativando.fimMes),
                          });
                        }}
                      >
                        <SelectTrigger className="bg-card border-border h-11 font-bold text-xs shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 8 }, (_, i) => i + 3).map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {MESES[m - 1]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Mês Final</label>
                      {colabReativando.tipo === "suplente" ? (
                        <div className="h-11 bg-muted/40 border border-border/80 rounded-xl flex items-center justify-between px-3 text-xs font-bold text-foreground">
                          <span>{MESES[9]}</span>
                          <span className="text-[8px] font-black uppercase bg-slate-600/10 text-slate-500 border border-slate-600/20 px-1.5 py-0.5 rounded">Fixo</span>
                        </div>
                      ) : (
                        <Select
                          value={String(colabReativando.fimMes)}
                          onValueChange={(val) => setColabReativando({ ...colabReativando, fimMes: parseInt(val) })}
                        >
                          <SelectTrigger className="bg-card border-border h-11 font-bold text-xs shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 8 }, (_, i) => i + 3)
                              .filter((m) => m >= colabReativando.inicioMes)
                              .map((m) => (
                                <SelectItem key={m} value={String(m)}>
                                  {MESES[m - 1]}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {(() => {
                    const totalMeses = Math.max(1, colabReativando.fimMes - colabReativando.inicioMes + 1);
                    const totalProjetado = colabReativando.valor * totalMeses;
                    return (
                      <div className="bg-gradient-to-br from-slate-500/10 via-slate-400/5 to-slate-600/15 border border-slate-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden shadow-inner mt-2">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl" />
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <DollarSign size={11} className="text-emerald-500 animate-pulse" /> Resumo do Plano de Retorno
                        </h4>
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Período Ativo</span>
                            <p className="text-xs font-black text-foreground mt-0.5">
                              {totalMeses} {totalMeses === 1 ? "mês" : "meses"}
                            </p>
                            <span className="text-[9px] text-muted-foreground font-semibold">
                              ({MESES[colabReativando.inicioMes - 1]} a {MESES[colabReativando.fimMes - 1]})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Custo de Retorno</span>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {fmt(totalProjetado)}
                            </p>
                            <span className="text-[9px] text-muted-foreground font-semibold">
                              Total projetado
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setColabReativando(null)}
                    disabled={salvandoReativacao}
                    className="flex-1 font-bold text-xs h-11 border-border rounded-xl active:scale-[0.98] transition-transform"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={confirmReativar}
                    disabled={salvandoReativacao}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs h-11 rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                  >
                    {salvandoReativacao && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Reativar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Pause size={16} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Colaboradores Pausados</h1>
              <p className="text-[10px] text-muted-foreground">Histórico mantido · Retorno configurável</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={refetchAll} className="h-9 w-9 text-muted-foreground hover:text-foreground">
            <RefreshCw size={15} />
          </Button>
        </div>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador pausado..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 h-10 bg-card border-border rounded-xl text-sm"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {(["todos", "suplente", "lideranca", "admin"] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`text-[10px] font-black uppercase tracking-wider px-3.5 py-2.5 rounded-xl border transition-all ${
                  filtroTipo === t
                    ? "premium-gradient text-white border-transparent shadow-md"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                {t === "todos" ? "Todos" : t === "suplente" ? "Suplentes" : t === "lideranca" ? "Lideranças" : "Admin"}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Pausados */}
        {isLoading ? (
          <CardSkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-dashed rounded-3xl p-6">
            <Pause size={32} className="mx-auto mb-3 opacity-30 text-amber-500" />
            <h3 className="text-sm font-bold text-foreground">Nenhum colaborador pausado</h3>
            <p className="text-xs text-muted-foreground mt-1">Colaboradores pausados aparecerão aqui para preservação de histórico.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => {
              const pags = getPagsColab(p);
              const totalPagoGeral = pags.reduce((acc, x) => acc + x.valor, 0);
              const expandido = !!historicoExpandido[p.id];
              
              return (
                <div key={p.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3 relative overflow-hidden transition-all duration-300">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground text-sm truncate">{p.nome}</h3>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${
                          p.tipo === "suplente"
                            ? "bg-slate-500/10 text-slate-500 border-slate-500/20"
                            : p.tipo === "lideranca"
                              ? "bg-violet-500/10 text-violet-500 border-violet-500/20"
                              : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        }`}>
                          {p.tipo === "suplente" ? "Suplente" : p.tipo === "lideranca" ? "Liderança" : "Admin"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{p.details}</p>
                      
                      {p.dataPausa && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                          <Clock size={11} />
                          Pausado em: {new Date(p.dataPausa).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[9px] text-muted-foreground uppercase font-bold">Total Pago Histórico</p>
                      <p className="text-sm font-black text-foreground numeric-compact">{fmt(totalPagoGeral)}</p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 border-t border-border/30 pt-3 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => startReativar(p)}
                      className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-bold text-xs px-4 rounded-xl shadow-md h-9 flex-1 sm:flex-none active:scale-[0.98] transition-all"
                    >
                      Reativar Colaborador
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleHistorico(p.id)}
                      className="text-xs font-semibold h-9 rounded-xl border-border px-3 gap-1.5 flex items-center justify-center flex-1 sm:flex-none"
                    >
                      <Receipt size={13} />
                      Histórico ({pags.length})
                      {expandido ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </Button>
                  </div>

                  {/* Lista de Histórico de Transações Expandido */}
                  {expandido && (
                    <div className="border-t border-border/50 bg-muted/5 rounded-xl p-3 space-y-2 mt-2 animate-in fade-in duration-300">
                      <p className="text-[9px] font-black uppercase tracking-wider text-primary flex items-center gap-1">
                        <Receipt size={10} /> Transações Registradas (Histórico Preservado)
                      </p>
                      
                      {pags.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic pl-1">Nenhum pagamento registrado no histórico.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {pags.map(x => (
                            <div key={x.id} className="flex justify-between items-center text-[10px] bg-card border border-border/50 rounded-lg p-2">
                              <div className="min-w-0">
                                <span className="font-bold text-foreground block truncate">
                                  {MESES[x.mes - 1]} / {x.ano} · <span className="text-[9px] text-muted-foreground font-semibold capitalize">{x.categoria}</span>
                                </span>
                                {x.observacao && (
                                  <span className="text-[9px] text-muted-foreground italic truncate block">
                                    Obs: {x.observacao}
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-black text-foreground">{fmt(x.valor)}</span>
                                <span className="text-[8px] text-muted-foreground block">
                                  {new Date(x.created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
