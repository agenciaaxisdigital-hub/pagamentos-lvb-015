import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { MES_INICIO_LID, MES_INICIO_SUP, MES_INICIO_ADM, MES_FIM } from "@/components/dashboard/types";
import { PageTransition } from "@/components/PageTransition";
import { CardSkeletonList } from "@/components/CardSkeleton";
import {
  ChevronDown, ChevronUp, X, Wallet,
  ChevronLeft, ChevronRight, Search,
  CheckCircle2, AlertCircle, Users, Briefcase, List,
  DollarSign, Receipt, Bell, Package, Pause
} from "lucide-react";
import { calcTotaisFinanceiros } from "@/lib/finance";
import { getMesInicioComHistorico } from "@/lib/paymentEligibility";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePaymentNotifications } from "@/hooks/usePaymentNotifications";
import { useCidade } from "@/contexts/CidadeContext";

// Novos componentes extraídos
import { HistoricoItem } from "@/components/pagamentos/HistoricoItem";
import { PayForm } from "@/components/pagamentos/PayForm";
import { SuplentePayCard } from "@/components/pagamentos/SuplentePayCard";
import { PessoaPayCard } from "@/components/pagamentos/PessoaPayCard";
import { mergePausados, reactivateCollaborator, isCollaboratorPausedInMonth } from "@/lib/pausadosFallback";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: any) => (s ? String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "");

type Pagamento = {
  id: string;
  suplente_id: string | null; lideranca_id: string | null; admin_id: string | null;
  tipo_pessoa: string; mes: number; ano: number;
  categoria: string; valor: number; observacao: string | null; created_at: string;
};

type Suplente = {
  id: string; nome: string; regiao_atuacao: string | null; partido: string | null; bairro: string | null;
  retirada_mensal_valor: number; retirada_mensal_meses: number;
  plotagem_qtd: number; plotagem_valor_unit: number;
  liderancas_qtd: number; liderancas_valor_unit: number;
  fiscais_qtd: number; fiscais_valor_unit: number; total_campanha: number;
  numero_urna: string | null; base_politica: string | null;
  created_at: string;
  municipio_id?: string | null;
  vinculado_id?: string | null;
};

type Lideranca = {
  id: string; nome: string; regiao: string | null;
  retirada_mensal_valor: number | null; 
  retirada_ate_mes: number | null;
  retirada_mensal_meses: number | null;
  chave_pix: string | null;
  created_at: string;
  suplente_id?: string | null;
  lideranca_vinculada_id?: string | null;
};

type AdminPessoa = {
  id: string; nome: string; whatsapp: string | null; 
  valor_contrato: number | null;
  contrato_ate_mes: number | null;
  valor_contrato_meses: number | null;
  created_at: string;
  suplente_id?: string | null;
};

// ─── Barra de progresso ───────────────────────────────────────────────────────
function Bar({ pago, total, cor = "bg-primary", height = "h-1.5" }: { pago: number; total: number; cor?: string; height?: string }) {
  const pct = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
  return (
    <div className={`${height} bg-muted rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Meses iniciais por tipo ──────────────────────────────────────────────────
const MES_INICIO_SUPLENTES = 3; // Suplentes: pagamentos a partir de Março
const MES_INICIO_LIDERANCAS = 3; // Lideranças: março é exceção (sistema não existia), a partir de abril segue X+1
const MES_INICIO_ADMIN = 3;      // Administrativo: pagamentos a partir de Março

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Pagamentos() {
  const now = new Date();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mes, setMes] = usePersistedState("pag-mes", Math.max(now.getMonth() + 1, 3));
  const [ano, setAno] = usePersistedState("pag-ano", now.getFullYear());
  const { isAdmin, isRH, cidadeAtiva } = useCidade();
  const [abaAtiva, setAbaAtiva] = usePersistedState<"suplentes" | "liderancas" | "admin" | "pausados">("pag-aba", "suplentes");
  const [busca, setBusca] = usePersistedState("pag-busca", "");
  const [showPagos, setShowPagos] = useState(true);
  const [showAlertaAtraso, setShowAlertaAtraso] = useState(false);
  const [alertaDismissed, setAlertaDismissed] = useState(false);
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

  const startReativar = (id: string, tipo: "suplente" | "lideranca" | "admin", nome: string, details?: string) => {
    let valor = 0;
    let inicioMes = Math.max(new Date().getMonth() + 1, 3);
    let fimMes = 10;
    let diaVencimento = 10;

    if (tipo === "suplente") {
      const s = (suplentes || []).find((x: any) => x.id === id);
      if (s) {
        valor = s.retirada_mensal_valor || 0;
        diaVencimento = s.dia_vencimento || 10;
        const meses = s.retirada_mensal_meses || 1;
        inicioMes = Math.max(3, 10 - meses + 1);
        fimMes = 10;
      }
    } else if (tipo === "lideranca") {
      const l = (liderancas || []).find((x: any) => x.id === id);
      if (l) {
        valor = l.retirada_mensal_valor || 0;
        diaVencimento = l.dia_vencimento || 10;
        fimMes = l.retirada_ate_mes || 10;
        const meses = l.retirada_mensal_meses || 1;
        inicioMes = Math.max(3, fimMes - meses + 1);
      }
    } else if (tipo === "admin") {
      const a = (administrativo || []).find((x: any) => x.id === id);
      if (a) {
        valor = a.valor_contrato || 0;
        diaVencimento = a.dia_vencimento || 10;
        fimMes = a.contrato_ate_mes || 10;
        const meses = a.valor_contrato_meses || 1;
        inicioMes = Math.max(3, fimMes - meses + 1);
      }
    }

    setColabReativando({
      id,
      nome,
      tipo,
      valor,
      inicioMes,
      fimMes,
      diaVencimento,
      details,
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
        description: `O colaborador retornou ao status ativo com o novo plano de pagamento.`,
      });

      setColabReativando(null);
      qc.invalidateQueries();
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

  const { data: suplentesNomes } = useQuery({
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
    staleTime: 0,
  });

  const { data: todasLiderancasNomes } = useQuery({
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



  const { data: suplentes, isLoading: loadS } = useQuery({
    queryKey: ["suplentes", cidadeAtiva || "all"],
    queryFn: async () => {
      let query = supabase.from("suplentes").select("*").order("nome");
      if (cidadeAtiva) {
        if (cidadeAtiva.startsWith("opt-loc-")) {
          query = query.is("municipio_id", null);
        } else {
          query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Suplente[];
    },
    staleTime: 0,
  });

  const { data: liderancas, isLoading: loadL } = useQuery({
    queryKey: ["liderancas", cidadeAtiva || "all"],
    queryFn: async () => {
      let query = supabase.from("liderancas").select("*").order("nome");
      if (cidadeAtiva) {
        if (cidadeAtiva.startsWith("opt-loc-")) {
          query = query.is("municipio_id", null);
        } else {
          query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Lideranca[];
    },
    staleTime: 0,
  });

  const { data: administrativo, isLoading: loadA } = useQuery({
    queryKey: ["administrativo", cidadeAtiva || "all"],
    queryFn: async () => {
      let query = supabase.from("administrativo").select("*").order("nome");
      if (cidadeAtiva) {
        if (cidadeAtiva.startsWith("opt-loc-")) {
          query = query.is("municipio_id", null);
        } else {
          query = query.or(`municipio_id.eq.${cidadeAtiva},municipio_id.is.null`);
        }
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AdminPessoa[];
    },
    staleTime: 0,
  });

  const { data: pagamentos, isLoading: loadP } = useQuery({
    queryKey: ["pagamentos", cidadeAtiva || "all"],
    queryFn: async () => {
      // Para pagamentos, precisamos filtrar se houver cidadeAtiva, mas os pagamentos estão ligados a pessoas.
      // É mais seguro buscar todos os pagamentos das pessoas da cidade ativa ou usar uma query com join/rpc.
      // Por enquanto, vamos filtrar por cidade se possível via metadados ou apenas buscar os recentes.
      let query = supabase.from("pagamentos").select("*").order("created_at", { ascending: false });
      
      // Otimização: Se tivermos cidadeAtiva, podemos filtrar pagamentos vinculados aos IDs das pessoas daquela cidade.
      // Mas isso exige saber os IDs primeiro. Vamos manter simples por ora e apenas adicionar o filtro de cidade se a tabela tiver municipio_id.
      // (Verificando migrations... pagamentos não parece ter municipio_id, mas as pessoas têm).
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Pagamento[];
    },
    staleTime: 0,
  });

  const isLoading = loadS || loadL || loadA || loadP;

  const mergedSuplentes = useMemo(() => {
    const list = mergePausados(suplentes, "suplente");
    if (cidadeAtiva) {
      return list.filter((s: any) => s.municipio_id === cidadeAtiva);
    }
    return list;
  }, [suplentes, cidadeAtiva]);

  const mergedLiderancas = useMemo(() => {
    const list = mergePausados(liderancas, "lideranca");
    if (cidadeAtiva) {
      return list.filter((l: any) => l.municipio_id === cidadeAtiva);
    }
    return list;
  }, [liderancas, cidadeAtiva]);

  const mergedAdministrativo = useMemo(() => {
    const list = mergePausados(administrativo, "admin");
    if (cidadeAtiva) {
      return list.filter((a: any) => a.municipio_id === cidadeAtiva);
    }
    return list;
  }, [administrativo, cidadeAtiva]);

  const suplentesAtivos = useMemo(() => (mergedSuplentes || []).filter((s: any) => !isCollaboratorPausedInMonth(s.id, "suplente", mes, s.pausado, s.data_pausa)), [mergedSuplentes, mes]);
  const liderancasAtivas = useMemo(() => (mergedLiderancas || []).filter((l: any) => !isCollaboratorPausedInMonth(l.id, "lideranca", mes, l.pausado, l.data_pausa)), [mergedLiderancas, mes]);
  const administrativoAtivos = useMemo(() => (mergedAdministrativo || []).filter((a: any) => !isCollaboratorPausedInMonth(a.id, "admin", mes, a.pausado, a.data_pausa)), [mergedAdministrativo, mes]);

  const pausados = useMemo(() => {
    const list: Array<{ id: string; nome: string; tipo: "suplente" | "lideranca" | "admin"; details: string }> = [];
    (mergedSuplentes || []).forEach((s: any) => {
      if (s.pausado) list.push({ id: s.id, nome: s.nome, tipo: "suplente", details: s.partido || "Suplente" });
    });
    (mergedLiderancas || []).forEach((l: any) => {
      if (l.pausado) list.push({ id: l.id, nome: l.nome, tipo: "lideranca", details: l.regiao || "Liderança" });
    });
    (mergedAdministrativo || []).forEach((a: any) => {
      if (a.pausado) list.push({ id: a.id, nome: a.nome, tipo: "admin", details: a.whatsapp || "Administrativo" });
    });
    return list;
  }, [mergedSuplentes, mergedLiderancas, mergedAdministrativo]);
  
  const MES_MIN_GLOBAL = 3; // Março é o primeiro mês de referência
  const MES_MAX_GLOBAL = 10; // Outubro é o último mês de referência
  const navMes = (dir: -1 | 1) => {
    let m = mes + dir, a = ano;
    if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; }
    if (a === 2026 && m < MES_MIN_GLOBAL) { m = MES_MIN_GLOBAL; }
    if (a === 2026 && m > MES_MAX_GLOBAL) { m = MES_MAX_GLOBAL; }
    setMes(m); setAno(a);
  };

  const pagsMes = useMemo(() => (pagamentos || []).filter(p => p.mes === mes && p.ano === ano), [pagamentos, mes, ano]);

  // Agrupar pagamentos por pessoa para otimizar getMesInicioComHistorico
  const pagamentosPorPessoa = useMemo(() => {
    const map: Record<string, Pagamento[]> = {};
    (pagamentos || []).forEach(p => {
      const id = p.suplente_id || p.lideranca_id || p.admin_id;
      if (id) {
        if (!map[id]) map[id] = [];
        map[id].push(p);
      }
    });
    return map;
  }, [pagamentos]);

  // Pre-calcular eligibilidade para evitar O(N*M) dentro do render
  const eligibilidadeMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (isLoading) return map;
    
    [...suplentesAtivos, ...liderancasAtivas, ...administrativoAtivos].forEach(p => {
      const tipo = (p as any).retirada_mensal_valor !== undefined 
        ? ((p as any).regiao_atuacao !== undefined ? "suplente" : "lideranca") 
        : "admin";
      
      const cat = tipo === "admin" ? "salario" : "retirada";
      const inicioG = tipo === "suplente" ? MES_INICIO_SUPLENTES : (tipo === "lideranca" ? MES_INICIO_LIDERANCAS : MES_INICIO_ADMIN);
      
      let manualStart: number | null = null;
      if (tipo === "lideranca" && (p as any).retirada_ate_mes && (p as any).retirada_mensal_meses) {
        manualStart = Math.max(1, (p as any).retirada_ate_mes - (p as any).retirada_mensal_meses + 1);
      } else if (tipo === "admin" && (p as any).contrato_ate_mes && (p as any).valor_contrato_meses) {
        manualStart = Math.max(1, (p as any).contrato_ate_mes - (p as any).valor_contrato_meses + 1);
      } else if (tipo === "suplente" && (p as any).retirada_mensal_meses) {
        // Suplentes geralmente tem um Mês Final fixo (Outubro=10), então o início é 10 - meses + 1
        manualStart = Math.max(1, 10 - (p as any).retirada_mensal_meses + 1);
      }

      map[p.id] = getMesInicioComHistorico({
        tipo: tipo as any,
        pessoaId: p.id,
        createdAt: (p as any).created_at,
        mesInicioGlobal: inicioG,
        pagamentos: pagamentosPorPessoa[p.id] || [],
        categoria: cat,
        mesInicioManual: manualStart,
      });
    });
    return map;
  }, [suplentesAtivos, liderancasAtivas, administrativoAtivos, pagamentosPorPessoa, isLoading]);

  const supComValor = useMemo(() => suplentesAtivos.filter(s => {
    const inicio = eligibilidadeMap[s.id] || 99;
    const fim = MES_FIM; // Suplentes até Mês Final
    return mes >= inicio && mes <= fim;
  }), [suplentesAtivos, mes, eligibilidadeMap]);

  const lidComValor = useMemo(() => liderancasAtivas.filter(l => {
    const inicio = eligibilidadeMap[l.id] || 99;
    const fim = l.retirada_ate_mes || MES_FIM;
    return mes >= inicio && mes <= fim;
  }), [liderancasAtivas, mes, eligibilidadeMap]);

  const admComValor = useMemo(() => administrativoAtivos.filter(a => {
    const inicio = eligibilidadeMap[a.id] || 99;
    const fim = a.contrato_ate_mes || MES_FIM;
    return mes >= inicio && mes <= fim;
  }), [administrativoAtivos, mes, eligibilidadeMap]);

  const supPlanejado = useMemo(() => supComValor.reduce((a, s) => a + (s.retirada_mensal_valor || 0), 0), [supComValor]);
  const lidPlanejado = useMemo(() => lidComValor.reduce((a, l) => a + (l.retirada_mensal_valor || 0), 0), [lidComValor]);
  const admPlanejado = useMemo(() => admComValor.reduce((a, p) => a + (p.valor_contrato || 0), 0), [admComValor]);
  const totalPlanejado = supPlanejado + lidPlanejado + admPlanejado;

  // Para retiradas/salários, cap pago no planejado por pessoa (não pode mostrar mais pago que planejado)
  const supPago = useMemo(() => supComValor.reduce((a, s) => {
    const p = pagsMes.filter(p => p.suplente_id === s.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.min(p, s.retirada_mensal_valor || 0);
  }, 0), [supComValor, pagsMes]);

  const lidPago = useMemo(() => lidComValor.reduce((a, l) => {
    const p = pagsMes.filter(p => p.lideranca_id === l.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.min(p, l.retirada_mensal_valor || 0);
  }, 0), [lidComValor, pagsMes]);

  const admPago = useMemo(() => admComValor.reduce((a, ad) => {
    const p = pagsMes.filter(p => p.admin_id === ad.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.min(p, ad.valor_contrato || 0);
  }, 0), [admComValor, pagsMes]);

  const totalPago = supPago + lidPago + admPago;

  // Calcular "falta" por pessoa (não permite que excesso de um compense falta de outro)
  const supFaltaReal = useMemo(() => supComValor.reduce((a, s) => {
    const pago = pagsMes.filter(p => p.suplente_id === s.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (s.retirada_mensal_valor || 0) - pago);
  }, 0), [supComValor, pagsMes]);

  const lidFaltaReal = useMemo(() => lidComValor.reduce((a, l) => {
    const pago = pagsMes.filter(p => p.lideranca_id === l.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (l.retirada_mensal_valor || 0) - pago);
  }, 0), [lidComValor, pagsMes]);

  const admFaltaReal = useMemo(() => admComValor.reduce((a, ad) => {
    const pago = pagsMes.filter(p => p.admin_id === ad.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (ad.valor_contrato || 0) - pago);
  }, 0), [admComValor, pagsMes]);

  const totalFalta = supFaltaReal + lidFaltaReal + admFaltaReal;
  const pctGeral = totalPlanejado > 0 ? Math.min(100, ((totalPlanejado - totalFalta) / totalPlanejado) * 100) : 0;

  // Contagens pagos
  const supPagosN = useMemo(() => supComValor.filter(s => pagsMes.filter(p => p.suplente_id === s.id).reduce((a, p) => a + p.valor, 0) >= (s.retirada_mensal_valor || 0)).length, [supComValor, pagsMes]);
  const lidPagosN = useMemo(() => lidComValor.filter(l => pagsMes.filter(p => p.lideranca_id === l.id).reduce((a, p) => a + p.valor, 0) >= (l.retirada_mensal_valor || 0)).length, [lidComValor, pagsMes]);
  const admPagosN = useMemo(() => admComValor.filter(a => pagsMes.filter(p => p.admin_id === a.id).reduce((a2, p) => a2 + p.valor, 0) >= (a.valor_contrato || 0)).length, [admComValor, pagsMes]);


  // Filtro busca
  const matchBusca = (nome: string, extra?: string) => {
    if (!busca.trim()) return true;
    const q = norm(busca);
    return norm(nome).includes(q) || norm(extra || "").includes(q);
  };

  // ─── Alerta de atraso ────────────────────────────────────────────────────────
  // Salário (admin): prazo até dia 10 do mês SEGUINTE
  // Retirada (suplentes/lideranças): prazo até último dia do mês de referência
  const diaAtual = now.getDate();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  // Retiradas atrasadas: se já passou o mês de referência (ou estamos no mesmo mês mas passou o último dia — impossível, então basta mes < mesAtual)
  const retiradaAtrasada = (mesRef: number, anoRef: number) => {
    if (anoRef < anoAtual) return true;
    if (anoRef === anoAtual && mesRef < mesAtual) return true;
    return false;
  };

  // Salário atrasado: prazo é dia 10 do mês seguinte ao de referência
  const salarioAtrasado = (mesRef: number, anoRef: number) => {
    let mesPrazo = mesRef + 1, anoPrazo = anoRef;
    if (mesPrazo > 12) { mesPrazo = 1; anoPrazo++; }
    if (anoPrazo < anoAtual) return true;
    if (anoPrazo === anoAtual && mesPrazo < mesAtual) return true;
    if (anoPrazo === anoAtual && mesPrazo === mesAtual && diaAtual > 10) return true;
    return false;
  };

  const isRetiradaAtrasada = retiradaAtrasada(mes, ano);
  const isSalarioAtrasado = salarioAtrasado(mes, ano);

  // Suplentes e Lideranças usam retirada (último dia do mês)
  const supAtrasados = isRetiradaAtrasada ? supComValor.filter(s => {
    const pago = pagsMes.filter(p => p.suplente_id === s.id).reduce((a, p) => a + p.valor, 0);
    return pago < (s.retirada_mensal_valor || 0);
  }) : [];
  const lidAtrasados = isRetiradaAtrasada ? lidComValor.filter(l => {
    const pago = pagsMes.filter(p => p.lideranca_id === l.id).reduce((a, p) => a + p.valor, 0);
    return pago < (l.retirada_mensal_valor || 0);
  }) : [];
  // Admin usa salário (dia 10 do mês seguinte)
  const admAtrasados = isSalarioAtrasado ? admComValor.filter(a => {
    const pago = pagsMes.filter(p => p.admin_id === a.id).reduce((a2, p) => a2 + p.valor, 0);
    return pago < (a.valor_contrato || 0);
  }) : [];
  const totalAtrasados = supAtrasados.length + lidAtrasados.length + admAtrasados.length;

  useEffect(() => {
    if (isRH && abaAtiva !== "admin") {
      setAbaAtiva("admin");
    }
  }, [isRH, abaAtiva]);

  useEffect(() => {
    if (!isLoading && totalAtrasados > 0 && !alertaDismissed) {
      setShowAlertaAtraso(true);
    }
  }, [isLoading, totalAtrasados, alertaDismissed]);

  // Notificações PWA para pagamentos atrasados
  const totalValorPendente = supAtrasados.reduce((a, s) => {
    const pago = pagsMes.filter(p => p.suplente_id === s.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (s.retirada_mensal_valor || 0) - pago);
  }, 0) + lidAtrasados.reduce((a, l) => {
    const pago = pagsMes.filter(p => p.lideranca_id === l.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (l.retirada_mensal_valor || 0) - pago);
  }, 0) + admAtrasados.reduce((a, ad) => {
    const pago = pagsMes.filter(p => p.admin_id === ad.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (ad.valor_contrato || 0) - pago);
  }, 0);

  usePaymentNotifications(
    !isLoading && totalAtrasados > 0
      ? { supAtrasados: supAtrasados.length, lidAtrasados: lidAtrasados.length, admAtrasados: admAtrasados.length, mes, totalValorPendente }
      : null
  );

  // Renderizar conteúdo da aba ativa
  const renderAba = () => {
    if (abaAtiva === "suplentes") {
      const filtrados = supComValor.filter(s => matchBusca(s.nome, [s.bairro, s.regiao_atuacao, s.numero_urna, s.partido].filter(Boolean).join(" ")));
      const pendentes = filtrados.filter(s => pagsMes.filter(p => p.suplente_id === s.id).reduce((a, p) => a + p.valor, 0) < (s.retirada_mensal_valor || 0));
      const pagos = filtrados.filter(s => pagsMes.filter(p => p.suplente_id === s.id).reduce((a, p) => a + p.valor, 0) >= (s.retirada_mensal_valor || 0));

      return (
        <>
          {/* Resumo suplentes */}
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-slate-400 bg-slate-600/10 flex items-center gap-1"><List size={10} />Suplentes</span>
                {supPagosN}/{supComValor.length} pagos
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-foreground">{fmt(supPago)} / {fmt(supPlanejado)}</span>
            </div>
            <Bar pago={supPago} total={supPlanejado} cor="bg-slate-600" />
            {supFaltaReal > 0 && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Falta: {fmt(supFaltaReal)}</p>}
          </div>

          {pendentes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-500" />
                <h2 className="text-sm font-bold text-foreground">Falta pagar — {pendentes.length}</h2>
              </div>
              {pendentes.map(s => (
                <SuplentePayCard key={s.id} s={s}
                  pagsMes={pagsMes.filter(p => p.suplente_id === s.id)}
                  pagsTodos={(pagamentos || []).filter(p => p.suplente_id === s.id)}
                  mes={mes} ano={ano} nomesMap={nomesMap} />
              ))}
            </div>
          )}

          {pendentes.length === 0 && pagos.length > 0 && (
            <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-2xl py-4">
              <CheckCircle2 size={18} className="text-green-500" />
              <p className="text-sm font-bold text-green-600 dark:text-green-400">Todos os suplentes pagos! 🎉</p>
            </div>
          )}

          {pagos.length > 0 && (
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between py-2 px-1" onClick={() => setShowPagos(!showPagos)}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <h2 className="text-sm font-bold text-foreground">Pagos — {pagos.length}</h2>
                </div>
                {showPagos ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
              </button>
              {showPagos && pagos.map(s => (
                <SuplentePayCard key={s.id} s={s}
                  pagsMes={pagsMes.filter(p => p.suplente_id === s.id)}
                  pagsTodos={(pagamentos || []).filter(p => p.suplente_id === s.id)}
                  mes={mes} ano={ano} nomesMap={nomesMap} />
              ))}
            </div>
          )}
        </>
      );
    }

    if (abaAtiva === "liderancas") {
      const filtrados = lidComValor.filter(l => matchBusca(l.nome, l.regiao || ""));
      const pendentes = filtrados.filter(l => pagsMes.filter(p => p.lideranca_id === l.id).reduce((a, p) => a + p.valor, 0) < (l.retirada_mensal_valor || 0));
      const pagos = filtrados.filter(l => pagsMes.filter(p => p.lideranca_id === l.id).reduce((a, p) => a + p.valor, 0) >= (l.retirada_mensal_valor || 0));

      return (
        <>
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-violet-500 bg-violet-500/10 flex items-center gap-1"><Users size={10} />Lideranças</span>
                {lidPagosN}/{lidComValor.length} pagos
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-foreground">{fmt(lidPago)} / {fmt(lidPlanejado)}</span>
            </div>
            <Bar pago={lidPago} total={lidPlanejado} cor="bg-violet-500" />
            {lidFaltaReal > 0 && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Falta: {fmt(lidFaltaReal)}</p>}
          </div>

          {pendentes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-500" />
                <h2 className="text-sm font-bold text-foreground">Falta pagar — {pendentes.length}</h2>
              </div>
              {pendentes.map(l => (
                <PessoaPayCard key={l.id} tipo="lideranca" id={l.id} nome={l.nome}
                  subtitulo={[l.regiao, l.chave_pix ? `PIX: ${l.chave_pix}` : undefined].filter(Boolean).join(" · ")}
                  valorEsperado={l.retirada_mensal_valor || 0}
                  pagsMes={pagsMes.filter(p => p.lideranca_id === l.id)}
                  mes={mes} ano={ano} createdAt={l.created_at}
                  suplente_id={(l as any).suplente_id} 
                  lideranca_vinculada_id={(l as any).lideranca_vinculada_id}
                  nomesMap={nomesMap}
                  dia_vencimento={l.dia_vencimento} />
              ))}
            </div>
          )}

          {pendentes.length === 0 && pagos.length > 0 && (
            <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-2xl py-4">
              <CheckCircle2 size={18} className="text-green-500" />
              <p className="text-sm font-bold text-green-600 dark:text-green-400">Todas lideranças pagas!</p>
            </div>
          )}

          {pagos.length > 0 && (
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between py-2 px-1" onClick={() => setShowPagos(!showPagos)}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <h2 className="text-sm font-bold text-foreground">Pagos — {pagos.length}</h2>
                </div>
                {showPagos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showPagos && pagos.map(l => (
                <PessoaPayCard key={l.id} tipo="lideranca" id={l.id} nome={l.nome}
                  subtitulo={l.regiao || undefined}
                  valorEsperado={l.retirada_mensal_valor || 0}
                  pagsMes={pagsMes.filter(p => p.lideranca_id === l.id)}
                  mes={mes} ano={ano} createdAt={l.created_at}
                  suplente_id={(l as any).suplente_id} 
                  lideranca_vinculada_id={(l as any).lideranca_vinculada_id}
                  nomesMap={nomesMap}
                  dia_vencimento={l.dia_vencimento} />
              ))}
            </div>
          )}

          {lidComValor.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma liderança com valor cadastrado</p>
            </div>
          )}
        </>
      );
    }

    if (abaAtiva === "admin") {
      const filtrados = admComValor.filter(a => matchBusca(a.nome, a.whatsapp || ""));
      const pendentes = filtrados.filter(a => pagsMes.filter(p => p.admin_id === a.id).reduce((acc, p) => acc + p.valor, 0) < (a.valor_contrato || 0));
      const pagos = filtrados.filter(a => pagsMes.filter(p => p.admin_id === a.id).reduce((acc, p) => acc + p.valor, 0) >= (a.valor_contrato || 0));

      return (
        <>
          <div className="bg-card rounded-xl border border-border p-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-slate-500 bg-slate-500/10 flex items-center gap-1"><Briefcase size={10} />Admin</span>
                  {admPagosN}/{admComValor.length} pagos
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-foreground">{fmt(admPago)} / {fmt(admPlanejado)}</span>
              </div>
            <Bar pago={admPago} total={admPlanejado} cor="bg-slate-500" />
            {admFaltaReal > 0 && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Falta: {fmt(admFaltaReal)}</p>}
          </div>

          {pendentes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-500" />
                <h2 className="text-sm font-bold text-foreground">Falta pagar — {pendentes.length}</h2>
              </div>
              {pendentes.map(a => (
                <PessoaPayCard key={a.id} tipo="admin" id={a.id} nome={a.nome}
                  subtitulo={a.whatsapp || undefined}
                  valorEsperado={a.valor_contrato || 0}
                  pagsMes={pagsMes.filter(p => p.admin_id === a.id)}
                  mes={mes} ano={ano} createdAt={a.created_at}
                  suplente_id={(a as any).suplente_id} nomesMap={nomesMap}
                  dia_vencimento={a.dia_vencimento} />
              ))}
            </div>
          )}

          {pendentes.length === 0 && pagos.length > 0 && (
            <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-2xl py-4">
              <CheckCircle2 size={18} className="text-green-500" />
              <p className="text-sm font-bold text-green-600 dark:text-green-400">Todos admin pagos!</p>
            </div>
          )}

          {pagos.length > 0 && (
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between py-2 px-1" onClick={() => setShowPagos(!showPagos)}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <h2 className="text-sm font-bold text-foreground">Pagos — {pagos.length}</h2>
                </div>
                {showPagos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showPagos && pagos.map(a => (
                <PessoaPayCard key={a.id} tipo="admin" id={a.id} nome={a.nome}
                  subtitulo={a.whatsapp || undefined}
                  valorEsperado={a.valor_contrato || 0}
                  pagsMes={pagsMes.filter(p => p.admin_id === a.id)}
                  mes={mes} ano={ano} createdAt={a.created_at}
                  suplente_id={(a as any).suplente_id}
                  nomesMap={nomesMap}
                  dia_vencimento={a.dia_vencimento} />
              ))}
            </div>
          )}

          {admComValor.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum administrativo com valor cadastrado</p>
            </div>
          )}
        </>
      );
    }

    if (abaAtiva === "pausados") {
      const filtrados = pausados.filter(p => matchBusca(p.nome, p.details));
      
      return (
        <>
          <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-amber-500 bg-amber-500/10 flex items-center gap-1"><Pause size={10} />Pausados</span>
                {filtrados.length} colaborador(es) pausado(s)
              </span>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-muted/10 border border-dashed border-border rounded-2xl">
              <Pause size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum colaborador pausado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(p => (
                <div key={p.id} className="bg-card rounded-2xl border border-border p-3.5 shadow-sm flex items-center justify-between gap-3 animate-fade-in">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground text-sm truncate">{p.nome}</p>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mt-1">
                      {p.tipo === "suplente" ? "Suplente" : p.tipo === "lideranca" ? "Liderança" : "Administrativo"} · {p.details}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startReativar(p.id, p.tipo, p.nome, p.details)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-bold text-xs shrink-0"
                  >
                    Reativar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    return null;
  };

  const abas = [
    { id: "suplentes" as const, label: "Suplentes", icon: <List size={12} />, count: supComValor.length, pagos: supPagosN },
    { id: "liderancas" as const, label: "Lideranças", icon: <Users size={12} />, count: lidComValor.length, pagos: lidPagosN },
    { id: "admin" as const, label: "Admin", icon: <Briefcase size={12} />, count: admComValor.length, pagos: admPagosN },
    { id: "pausados" as const, label: "Pausados", icon: <Pause size={12} />, count: pausados.length, pagos: 0 },
  ];

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Dialog de alerta de atraso */}
        <Dialog open={showAlertaAtraso} onOpenChange={(open) => { setShowAlertaAtraso(open); if (!open) setAlertaDismissed(true); }}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Bell size={20} /> Pagamentos Atrasados!
              </DialogTitle>
              <DialogDescription className="text-left">
                <span className="block mt-2 text-sm text-foreground font-medium">
                  O prazo de pagamento já passou e ainda há <strong>{totalAtrasados}</strong> pessoa{totalAtrasados > 1 ? "s" : ""} com pagamento pendente em {MESES[mes - 1]}:
                </span>
                <span className="block mt-1 text-[11px] text-muted-foreground">
                  Retiradas: até o último dia do mês · Salários: até dia 10 do mês seguinte
                </span>
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {!isRH && supAtrasados.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-1">Suplentes ({supAtrasados.length})</p>
                      {supAtrasados.map(s => {
                        const pago = pagsMes.filter(p => p.suplente_id === s.id).reduce((a, p) => a + p.valor, 0);
                        return (
                          <div key={s.id} className="flex justify-between text-xs py-0.5">
                            <span className="text-foreground">{s.nome}</span>
                            <span className="text-destructive font-bold">{fmt(Math.max(0, (s.retirada_mensal_valor || 0) - pago))}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isRH && lidAtrasados.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500 mb-1">Lideranças ({lidAtrasados.length})</p>
                      {lidAtrasados.map(l => {
                        const pago = pagsMes.filter(p => p.lideranca_id === l.id).reduce((a, p) => a + p.valor, 0);
                        return (
                          <div key={l.id} className="flex justify-between text-xs py-0.5">
                            <span className="text-foreground">{l.nome}</span>
                            <span className="text-destructive font-bold">{fmt(Math.max(0, (l.retirada_mensal_valor || 0) - pago))}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {admAtrasados.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">Administrativo ({admAtrasados.length})</p>
                      {admAtrasados.map(a => {
                        const pago = pagsMes.filter(p => p.admin_id === a.id).reduce((a2, p) => a2 + p.valor, 0);
                        return (
                          <div key={a.id} className="flex justify-between text-xs py-0.5">
                            <span className="text-foreground">{a.nome}</span>
                            <span className="text-destructive font-bold">{fmt(Math.max(0, (a.valor_contrato || 0) - pago))}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => { setShowAlertaAtraso(false); setAlertaDismissed(true); }} className="w-full mt-2">
              Entendi
            </Button>
          </DialogContent>
        </Dialog>

        {/* Dialog de Reativação de Colaborador */}
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
                    Defina como será a estrutura de pagamento na volta de <strong className="text-foreground">{colabReativando.nome}</strong> ({colabReativando.tipo === "suplente" ? "Suplente" : colabReativando.tipo === "lideranca" ? "Liderança" : "Administrativo"}).
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

                  {/* Preview Card */}
                  {(() => {
                    const totalMeses = Math.max(1, colabReativando.fimMes - colabReativando.inicioMes + 1);
                    const totalProjetado = colabReativando.valor * totalMeses;
                    return (
                      <div className="bg-gradient-to-br from-slate-500/10 via-slate-400/5 to-slate-600/15 border border-slate-500/20 rounded-2xl p-4 space-y-2 relative overflow-hidden shadow-inner mt-2">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl animate-pulse" />
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 size={11} className="text-emerald-500" /> Resumo do Plano de Retorno
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
                    Confirmar Reativação
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Pagamentos</h1>
        </div>

        {/* Painel financeiro geral */}
        {/* Painel financeiro geral - Refatorado para foco no Saldo Devedor */}
        {/* Painel Financeiro - Ampliado para Máxima Visibilidade */}
        {!isLoading && (
          <div className="bg-gradient-to-br from-[#3A3D42] via-[#6B7280] to-[#9CA3AF] rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-8 shadow-2xl relative overflow-hidden mb-6">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-white text-[11px] font-black uppercase tracking-[0.2em] mb-6 drop-shadow-sm">
                <Wallet size={14} className="animate-pulse" /> Painel Financeiro Geral · {MESES[mes - 1]}/{ano}
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-6 sm:mb-8">
                <div className="bg-white/15 backdrop-blur-xl rounded-2xl sm:rounded-[1.5rem] p-2.5 sm:p-4 border border-white/20 text-center shadow-inner">
                  <p className="text-white/80 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-1.5">Planejado</p>
                  <p className="text-white font-black text-[11px] sm:text-lg lg:text-xl leading-none numeric-compact">{fmt(totalPlanejado)}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-xl rounded-2xl sm:rounded-[1.5rem] p-2.5 sm:p-4 border border-white/30 text-center shadow-lg">
                  <p className="text-white/80 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-1.5">Já Pago</p>
                  <p className="text-white font-black text-[11px] sm:text-lg lg:text-xl leading-none numeric-compact">{fmt(totalPago)}</p>
                </div>
                <div className="bg-black/15 backdrop-blur-xl rounded-2xl sm:rounded-[1.5rem] p-2.5 sm:p-4 border border-white/10 text-center shadow-inner">
                  <p className="text-white/80 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-1.5">Falta</p>
                  <p className="text-white font-black text-[11px] sm:text-lg lg:text-xl leading-none numeric-compact">{fmt(totalFalta)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-black/20 rounded-full p-1 border border-white/10 overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(255,255,255,0.6)]" 
                    style={{ width: `${pctGeral}%` }} 
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-[10px] font-black text-white uppercase tracking-wider">
                  <span className="bg-white/20 px-2 py-0.5 rounded-md">{pctGeral.toFixed(1)}% CONCLUÍDO</span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    {(supPagosN + lidPagosN + admPagosN)} DE {(supComValor.length + lidComValor.length + admComValor.length)} CONTRATOS
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Painel Outros Gastos: Plotagem + Lideranças + Fiscais (filtrado por mês de cadastro) */}
        {!isLoading && !isRH && (() => {
          // Só mostra suplentes que recebem retirada E estão elegíveis neste mês
          const sups = suplentesAtivos.filter(s => 
            (s.retirada_mensal_valor || 0) > 0 && 
            mes >= getMesInicioComHistorico({
              tipo: "suplente",
              pessoaId: s.id,
              createdAt: s.created_at,
              mesInicioGlobal: MES_INICIO_SUPLENTES,
              pagamentos: pagamentos || [],
              categoria: "retirada",
            })
          );
          const allPags = pagamentos || [];
          const supIds = new Set(sups.map(s => s.id));

          const totalPlotPlan = sups.reduce((a, s) => a + (s.plotagem_qtd || 0) * (s.plotagem_valor_unit || 0), 0);
          const totalLidPlan = sups.reduce((a, s) => a + (s.liderancas_qtd || 0) * (s.liderancas_valor_unit || 0), 0);
          const totalFisPlan = sups.reduce((a, s) => a + (s.fiscais_qtd || 0) * (s.fiscais_valor_unit || 0), 0);
          const outrosPlan = totalPlotPlan + totalLidPlan + totalFisPlan;

          if (outrosPlan <= 0) return null;

          // Filtrar pagamentos apenas dos suplentes da cidade ativa
          const pagsCidade = allPags.filter(p => p.suplente_id && supIds.has(p.suplente_id));
          const totalPlotPago = pagsCidade.filter(p => p.categoria === "plotagem").reduce((a, p) => a + p.valor, 0);
          const totalLidPago = pagsCidade.filter(p => p.categoria === "liderancas").reduce((a, p) => a + p.valor, 0);
          const totalFisPago = pagsCidade.filter(p => p.categoria === "fiscais").reduce((a, p) => a + p.valor, 0);

          const cats = [
            { label: "Plotagem", plan: totalPlotPlan, pago: totalPlotPago, icon: "🖼️" },
            { label: "Lideranças", plan: totalLidPlan, pago: totalLidPago, icon: "👥" },
            { label: "Fiscais", plan: totalFisPlan, pago: totalFisPago, icon: "🔍" },
          ].filter(c => c.plan > 0);

          return (
            <div className="bg-gradient-to-br from-card to-muted/30 rounded-2xl border border-primary/20 p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Outros Gastos</p>
                  <p className="text-[9px] text-muted-foreground">Plotagem · Lideranças · Fiscais</p>
                </div>
              </div>

              {/* Categorias */}
              <div className={`grid gap-2 ${cats.length === 1 ? "grid-cols-1" : cats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {cats.map(c => {
                  const falta = Math.max(0, c.plan - c.pago);
                  const pct = c.plan > 0 ? Math.min(100, (c.pago / c.plan) * 100) : 0;
                  const quitado = falta <= 0;
                  return (
                    <div key={c.label} className={`rounded-xl border p-2 space-y-1.5 ${quitado ? "border-green-500/30 bg-green-500/5" : "border-border/50 bg-card"}`}>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{c.icon}</span>
                        <span className="text-[10px] font-bold text-foreground">{c.label}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground">{fmt(c.plan)}</p>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${quitado ? "bg-green-500" : "bg-primary/60"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-green-600 dark:text-green-400">{fmt(c.pago)}</span>
                        {quitado
                          ? <span className="text-green-600 font-bold">✓</span>
                          : <span className="text-amber-600 dark:text-amber-400">{fmt(falta)}</span>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {/* Seletor de mês */}
        <div className="bg-card rounded-2xl border border-border p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navMes(-1)}><ChevronLeft size={20} /></Button>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{MESES[mes - 1]} {ano}</p>
              <p className="text-xs text-muted-foreground">Mês de referência</p>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navMes(1)}><ChevronRight size={20} /></Button>
          </div>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome..." className="pl-9 h-10 bg-card border-border rounded-xl text-sm" />
          {busca && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setBusca("")}><X size={14} /></button>}
        </div>

        <div className={`grid ${abas.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} bg-muted/50 rounded-2xl p-1.5 gap-1 border border-border/50 shadow-inner`}>
          {abas.map(a => {
            const isActive = abaAtiva === a.id;
            const colorClass = "slate";
            const activeStyle = "bg-slate-600 text-white shadow-slate-500/20";
            
            return (
              <button
                key={a.id}
                onClick={() => setAbaAtiva(a.id)}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl transition-all duration-300 gap-1 relative overflow-hidden ${
                  isActive ? `${activeStyle} shadow-lg scale-[1.02] z-10` : "bg-card text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span className={isActive ? "text-white" : `text-slate-500`}>{a.icon}</span>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight truncate">{a.label}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className={`text-[11px] font-black ${isActive ? "text-white/90" : "text-foreground"}`}>
                    {a.id === "pausados" ? a.count : `${a.pagos}/${a.count}`}
                  </span>
                  <div className={`h-1 w-8 rounded-full mt-0.5 ${isActive ? "bg-white/30" : `bg-slate-500/20`}`}>
                    <div className={`h-full rounded-full ${isActive ? "bg-white" : `bg-slate-500`}`} style={{ width: `${a.id === "pausados" ? (a.count > 0 ? 100 : 0) : (a.pagos / Math.max(1, a.count)) * 100}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Conteúdo da aba */}
        {isLoading ? <CardSkeletonList count={5} /> : (
          <div className="space-y-3">
            {renderAba()}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
