import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Users, FileDown, FileSpreadsheet, Search, Filter, X,
  Calendar, BarChart3, List, Building2, ClipboardCheck,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportAllPDF, exportExcel, exportAuditPDF } from "@/lib/exports";
import { calcTotaisFinanceiros } from "@/lib/finance";
import { getMesInicioComHistorico } from "@/lib/paymentEligibility";
import { PageTransition } from "@/components/PageTransition";
import { SectionSkeleton } from "@/components/dashboard/DashShared";
import { DashResumo } from "@/components/dashboard/DashResumo";
import { DashMensal } from "@/components/dashboard/DashMensal";
import { DashDetalhes } from "@/components/dashboard/DashDetalhes";
import { DashCidades } from "@/components/dashboard/DashCidades";
import { useCidade } from "@/contexts/CidadeContext";
import {
  type Lideranca, type AdminPessoa, type Pagamento, type CidadeData,
  MESES_LABEL, MES_INICIO_LID, MES_INICIO_SUP, MES_INICIO_ADM, MES_FIM,
  COLORS_CAT, COLORS_CITY,
} from "@/components/dashboard/types";

const STALE_TIME = 60_000;

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filtroRegiao, setFiltroRegiao] = useState("");
  const [filtroPartido, setFiltroPartido] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [activeView, setActiveView] = useState<"resumo" | "mensal" | "detalhes" | "cidades">("resumo");
  const { cidadeAtiva, municipios, isAdmin } = useCidade();

  // ─── QUERIES: ALL DATA (used for Resumo, Mensal, Detalhes, Cidades) ──
  const { data: allSuplentes, isLoading: loadS } = useQuery({
    queryKey: ["suplentes-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("suplentes").select("id, nome, numero_urna, bairro, regiao_atuacao, partido, situacao, telefone, cargo_disputado, ano_eleicao, total_votos, expectativa_votos, base_politica, retirada_mensal_valor, retirada_mensal_meses, plotagem_qtd, plotagem_valor_unit, liderancas_qtd, liderancas_valor_unit, fiscais_qtd, fiscais_valor_unit, total_campanha, municipio_id, created_at").order("nome");
      if (error) throw error;
      return data;
    },
    staleTime: STALE_TIME,
  });

  const { data: allLiderancas, isLoading: loadL } = useQuery({
    queryKey: ["liderancas-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("liderancas").select("id, nome, regiao, retirada_mensal_valor, retirada_ate_mes, municipio_id, chave_pix, whatsapp, ligacao_politica, retirada_mensal_meses, created_at").order("nome");
      if (error) throw error;
      return data as Lideranca[];
    },
    staleTime: STALE_TIME,
  });

  const { data: allAdministrativo, isLoading: loadA } = useQuery({
    queryKey: ["administrativo-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("administrativo").select("id, nome, valor_contrato, contrato_ate_mes, municipio_id, whatsapp, created_at").order("nome");
      if (error) throw error;
      return data as AdminPessoa[];
    },
    staleTime: STALE_TIME,
  });

  const { data: pagamentos, isLoading: loadP } = useQuery({
    queryKey: ["pagamentos-dash"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("id, suplente_id, lideranca_id, admin_id, tipo_pessoa, mes, ano, categoria, valor, observacao, created_at");
      if (error) throw error;
      return data as Pagamento[];
    },
    staleTime: STALE_TIME,
  });

  const isLoading = loadS || loadL || loadA;
  const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // ─── GLOBAL LISTS (all cities, no filter) ─────────────────────────
  const globalSup = allSuplentes ?? [];
  const globalLid = allLiderancas ?? [];
  const globalAdm = allAdministrativo ?? [];
  const globalPag = pagamentos ?? [];

  // Pre-calcular eligibilidade para evitar O(N*M) dentro de loops de redução
  const eligibilidadeMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (isLoading) return map;
    
    [...globalSup, ...globalLid, ...globalAdm].forEach(p => {
      const tipo = (p as any).retirada_mensal_valor !== undefined 
        ? ((p as any).regiao_atuacao !== undefined ? "suplente" : "lideranca") 
        : "admin";
      
      const cat = tipo === "admin" ? "salario" : "retirada";
      const inicioG = tipo === "suplente" ? MES_INICIO_SUP : (tipo === "lideranca" ? MES_INICIO_LID : MES_INICIO_ADM);
      
      // Cálculo manual para lideranças (Ate - Meses + 1)
      let manualStart: number | null = null;
      if (tipo === "lideranca" && (p as any).retirada_ate_mes && (p as any).retirada_mensal_meses) {
        manualStart = Math.max(1, (p as any).retirada_ate_mes - (p as any).retirada_mensal_meses + 1);
      } else if (tipo === "admin" && (p as any).contrato_ate_mes && (p as any).valor_contrato_meses) {
        manualStart = Math.max(1, (p as any).contrato_ate_mes - (p as any).valor_contrato_meses + 1);
      } else if (tipo === "suplente" && (p as any).retirada_mensal_meses) {
        // Suplentes: Mês Final fixo (MES_FIM), então início é MES_FIM - meses + 1
        manualStart = Math.max(1, MES_FIM - (p as any).retirada_mensal_meses + 1);
      }

      map[p.id] = getMesInicioComHistorico({
        tipo: tipo as any,
        pessoaId: p.id,
        createdAt: (p as any).created_at,
        mesInicioGlobal: inicioG,
        pagamentos: globalPag,
        categoria: cat,
        mesInicioManual: manualStart,
      });
    });
    return map;
  }, [globalSup, globalLid, globalAdm, globalPag, isLoading]);

  // ─── FILTERED LISTS (for search/export only) ─────────────────────
  const supList = useMemo(() => {
    let all = globalSup;
    if (search.trim()) {
      const q = normalizeStr(search);
      all = all.filter((s: any) => normalizeStr(s.nome || "").includes(q) || normalizeStr(s.numero_urna || "").includes(q) || normalizeStr(s.regiao_atuacao || "").includes(q));
    }
    if (filtroRegiao) all = all.filter((s: any) => s.regiao_atuacao === filtroRegiao || s.bairro === filtroRegiao);
    if (filtroPartido) all = all.filter((s: any) => s.partido === filtroPartido);
    if (filtroSituacao) all = all.filter((s: any) => s.situacao === filtroSituacao);
    return all;
  }, [globalSup, search, filtroRegiao, filtroPartido, filtroSituacao]);

  // ─── FILTER OPTIONS ──────────────────────────────────────────────
  const regioes = useMemo(() => {
    const set = new Set<string>();
    globalSup.forEach((s: any) => { if (s.regiao_atuacao) set.add(s.regiao_atuacao); if (s.bairro) set.add(s.bairro); });
    globalLid.forEach((l: any) => { if (l.regiao) set.add(l.regiao); });
    return Array.from(set).sort();
  }, [globalSup, globalLid]);

  const partidos = useMemo(() => {
    const set = new Set<string>();
    globalSup.forEach((s: any) => { if (s.partido) set.add(s.partido); });
    return Array.from(set).sort();
  }, [globalSup]);

  const situacoes = useMemo(() => {
    const set = new Set<string>();
    globalSup.forEach((s: any) => { if (s.situacao) set.add(s.situacao); });
    return Array.from(set).sort();
  }, [globalSup]);

  const activeFiltersCount = [filtroRegiao, filtroPartido, filtroSituacao].filter(Boolean).length;
  const clearFilters = () => { setFiltroRegiao(""); setFiltroPartido(""); setFiltroSituacao(""); };

  // ─── GLOBAL FINANCIAL CALCULATIONS ────────────────────────────────
  const financials = useMemo(() => {
    const totalCampanhaSup = globalSup.reduce((a: number, s: any) => a + calcTotaisFinanceiros(s).totalFinal, 0);
    const totalRetiradaMensalSup = globalSup.reduce((a: number, s: any) => a + (s.retirada_mensal_valor || 0), 0);
    const totalLiderancasQtd = globalSup.reduce((a: number, s: any) => a + (s.liderancas_qtd || 0), 0);
    const totalFiscais = globalSup.reduce((a: number, s: any) => a + (s.fiscais_qtd || 0), 0);
    const totalPessoas = totalLiderancasQtd + totalFiscais + globalLid.length;
    const totalVotos = globalSup.reduce((a: number, s: any) => a + (s.total_votos || 0), 0);
    const totalExpectativa = globalSup.reduce((a: number, s: any) => a + (s.expectativa_votos || 0), 0);
    const totalRetiradaSup = globalSup.reduce((a: number, s: any) => a + ((s.retirada_mensal_valor || 0) * (s.retirada_mensal_meses || 0)), 0);
    const totalLiderancasVal = globalSup.reduce((a: number, s: any) => a + ((s.liderancas_qtd || 0) * (s.liderancas_valor_unit || 0)), 0);
    const totalFiscaisVal = globalSup.reduce((a: number, s: any) => a + ((s.fiscais_qtd || 0) * (s.fiscais_valor_unit || 0)), 0);
    const totalPlotagemVal = globalSup.reduce((a: number, s: any) => a + ((s.plotagem_qtd || 0) * (s.plotagem_valor_unit || 0)), 0);
    const totalPlotagem = globalSup.reduce((a: number, s: any) => a + (s.plotagem_qtd || 0), 0);
    const totalLidMensal = globalLid.reduce((a: number, l: any) => a + (l.retirada_mensal_valor || 0), 0);
    const totalAdmMensal = globalAdm.reduce((a: number, p: any) => a + (p.valor_contrato || 0), 0);

    return {
      totalCampanhaSup, totalRetiradaMensalSup, totalLiderancasQtd,
      totalFiscais, totalPessoas, totalVotos, totalExpectativa,
      totalRetiradaSup, totalLiderancasVal, totalFiscaisVal,
      totalPlotagemVal, totalPlotagem, totalLidMensal, totalAdmMensal,
    };
  }, [globalSup, globalLid, globalAdm]);

  // ─── GLOBAL FLUXO MENSAL (all cities) ─────────────────────────────
  const fluxoMensal = useMemo(() => {
    const meses = [];
    for (let m = 1; m <= MES_FIM; m++) {
      let supMes = 0, lidMes = 0, admMes = 0;
      if (m >= MES_INICIO_SUP) {
        supMes = globalSup.reduce((a: number, s: any) => {
          const inicio = eligibilidadeMap[s.id] || MES_INICIO_SUP;
          const numMeses = s.retirada_mensal_meses || 0;
          const mesFimCalc = inicio + numMeses - 1;
          const mesFim = Math.min(mesFimCalc, MES_FIM);
          return (m >= inicio && m <= mesFim) ? a + (s.retirada_mensal_valor || 0) : a;
        }, 0);
      }
      if (m >= MES_INICIO_LID) {
        lidMes = globalLid.reduce((a: number, l: any) => {
          const inicio = eligibilidadeMap[l.id] || MES_INICIO_LID;
          const ateMes = l.retirada_ate_mes || MES_FIM;
          return (m >= inicio && m <= ateMes) ? a + (l.retirada_mensal_valor || 0) : a;
        }, 0);
      }
      if (m >= MES_INICIO_ADM) {
        admMes = globalAdm.reduce((a: number, ad: any) => {
          const inicio = eligibilidadeMap[ad.id] || MES_INICIO_ADM;
          const ateMes = ad.contrato_ate_mes || MES_FIM;
          return (m >= inicio && m <= ateMes) ? a + (ad.valor_contrato || 0) : a;
        }, 0);
      }
      const pagoMes = globalPag
        .filter(p => p.mes === m && p.ano === 2026)
        .reduce((a, p) => a + (p.valor || 0), 0);

      meses.push({
        mes: m, label: MESES_LABEL[m],
        suplentes: supMes, liderancas: lidMes, admin: admMes,
        total: supMes + lidMes + admMes, pago: pagoMes,
      });
    }
    return meses;
  }, [globalSup, globalLid, globalAdm, globalPag, eligibilidadeMap]);

  const totalPrevistoAno = useMemo(() => fluxoMensal.reduce((a, m) => a + m.total, 0), [fluxoMensal]);
  const custosPontuais = financials.totalPlotagemVal + financials.totalLiderancasVal + financials.totalFiscaisVal;
  const orcamentoTotal = totalPrevistoAno + custosPontuais;
  const totalPagoAno = useMemo(() => globalPag.filter(p => p.ano === 2026).reduce((a, p) => a + (p.valor || 0), 0), [globalPag]);
  const saldoRestante = orcamentoTotal - totalPagoAno;

  const totalSupFluxo = useMemo(() => fluxoMensal.reduce((a, m) => a + m.suplentes, 0), [fluxoMensal]);
  const totalLidFluxo = useMemo(() => fluxoMensal.reduce((a, m) => a + m.liderancas, 0), [fluxoMensal]);
  const totalAdmFluxo = useMemo(() => fluxoMensal.reduce((a, m) => a + m.admin, 0), [fluxoMensal]);

  const pieData = useMemo(() => [
    { name: "Suplentes", value: totalSupFluxo + custosPontuais, fill: COLORS_CAT.suplentes },
    { name: "Lideranças", value: totalLidFluxo, fill: COLORS_CAT.liderancas },
    { name: "Administrativo", value: totalAdmFluxo, fill: COLORS_CAT.admin },
  ].filter(d => d.value > 0), [totalSupFluxo, totalLidFluxo, totalAdmFluxo, custosPontuais]);

  // ─── DADOS POR CIDADE (always uses ALL data) ──────────────────────
  const dadosPorCidade = useMemo<CidadeData[]>(() => {
    if (municipios.length === 0) return [];
    const aSup = globalSup;
    const aLid = globalLid;
    const aAdm = globalAdm;
    const aPag = globalPag;

    return municipios.map((mun, idx) => {
      const supCidade = aSup.filter((s: any) => s.municipio_id === mun.id);
      const lidCidade = aLid.filter((l: any) => l.municipio_id === mun.id);
      const admCidade = aAdm.filter((a: any) => a.municipio_id === mun.id);

      const retiradaSup = supCidade.reduce((a: number, s: any) => a + ((s.retirada_mensal_valor || 0) * (s.retirada_mensal_meses || 0)), 0);
      const liderancasVal = supCidade.reduce((a: number, s: any) => a + ((s.liderancas_qtd || 0) * (s.liderancas_valor_unit || 0)), 0);
      const fiscaisVal = supCidade.reduce((a: number, s: any) => a + ((s.fiscais_qtd || 0) * (s.fiscais_valor_unit || 0)), 0);
      const plotagemVal = supCidade.reduce((a: number, s: any) => a + ((s.plotagem_qtd || 0) * (s.plotagem_valor_unit || 0)), 0);
      const orcSup = supCidade.reduce((a: number, s: any) => a + calcTotaisFinanceiros(s).totalFinal, 0);
      const retiradaMensalSup = supCidade.reduce((a: number, s: any) => a + (s.retirada_mensal_valor || 0), 0);
      const liderancasQtd = supCidade.reduce((a: number, s: any) => a + (s.liderancas_qtd || 0), 0);
      const fiscaisQtd = supCidade.reduce((a: number, s: any) => a + (s.fiscais_qtd || 0), 0);
      const plotagemQtd = supCidade.reduce((a: number, s: any) => a + (s.plotagem_qtd || 0), 0);
      const lidMensal = lidCidade.reduce((a: number, l: any) => a + (l.retirada_mensal_valor || 0), 0);
      const orcLid = lidCidade.reduce((a: number, l: any) => {
        const duracao = l.retirada_mensal_meses || 0;
        if (duracao > 0) return a + (l.retirada_mensal_valor || 0) * duracao;
        
        const inicio = eligibilidadeMap[l.id] || MES_INICIO_LID;
        const ateMes = Math.min(l.retirada_ate_mes || MES_FIM, MES_FIM);
        const mesesAtivos = Math.max(0, ateMes - inicio + 1);
        return a + (l.retirada_mensal_valor || 0) * mesesAtivos;
      }, 0);
      const admMensal = admCidade.reduce((a: number, ad: any) => a + (ad.valor_contrato || 0), 0);
      const orcAdm = admCidade.reduce((a: number, ad: any) => {
        const duracao = ad.valor_contrato_meses || 0;
        if (duracao > 0) return a + (ad.valor_contrato || 0) * duracao;

        const inicio = eligibilidadeMap[ad.id] || MES_INICIO_ADM;
        const ateMes = Math.min(ad.contrato_ate_mes || MES_FIM, MES_FIM);
        const mesesAtivos = Math.max(0, ateMes - inicio + 1);
        return a + (ad.valor_contrato || 0) * mesesAtivos;
      }, 0);
      const orcTotal = orcSup + orcLid + orcAdm;

      const supIdsCity = new Set(supCidade.map((s: any) => s.id));
      const lidIdsCity = new Set(lidCidade.map((l: any) => l.id));
      const admIdsCity = new Set(admCidade.map((a: any) => a.id));
      const pagoCity = aPag.filter(p =>
        p.ano === 2026 && (
          (p.suplente_id && supIdsCity.has(p.suplente_id)) ||
          (p.lideranca_id && lidIdsCity.has(p.lideranca_id)) ||
          (p.admin_id && admIdsCity.has(p.admin_id))
        )
      ).reduce((a, p) => a + (p.valor || 0), 0);

      return {
        id: mun.id, nome: mun.nome, uf: mun.uf,
        color: COLORS_CITY[idx % COLORS_CITY.length],
        suplentes: supCidade.length, liderancasCount: lidCidade.length, admin: admCidade.length,
        orcSup, retiradaSup, liderancasVal, fiscaisVal, plotagemVal,
        retiradaMensalSup, liderancasQtd, fiscaisQtd, plotagemQtd,
        lidMensal, orcLid, admMensal, orcAdm,
        orcamento: orcTotal, pago: pagoCity,
        votos2024: supCidade.reduce((a: number, s: any) => a + (s.total_votos || 0), 0),
        expectativa2026: supCidade.reduce((a: number, s: any) => a + (s.expectativa_votos || 0), 0),
        lidCidade: lidCidade as Lideranca[],
        admCidade: admCidade as AdminPessoa[],
      };
    }).filter(c => c.orcamento > 0 || c.suplentes > 0 || c.liderancasCount > 0 || c.admin > 0);
  }, [municipios, globalSup, globalLid, globalAdm, globalPag, eligibilidadeMap]);

  const mesAtual = new Date().getMonth() + 1;

  const viewTabs: [string, string, any][] = [
    ["resumo", "Resumo", BarChart3],
    ["mensal", "Mensal", Calendar],
    ["detalhes", "Detalhes", List],
    ["cidades", "Cidades", Building2],
  ];

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 active:scale-95 transition-transform" onClick={() => { const mMap = Object.fromEntries(municipios.map(m => [m.id, m.nome])); exportAllPDF(supList, { regiao: filtroRegiao, partido: filtroPartido, situacao: filtroSituacao, busca: search }, mMap); }} disabled={supList.length === 0}>
              <FileDown size={14} /> PDF
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 active:scale-95 transition-transform" onClick={() => { const mMap = Object.fromEntries(municipios.map(m => [m.id, m.nome])); exportExcel(supList, { regiao: filtroRegiao, partido: filtroPartido, situacao: filtroSituacao, busca: search }, mMap); }} disabled={supList.length === 0}>
              <FileSpreadsheet size={14} /> Excel
            </Button>
            <Button variant="default" size="sm" className="text-xs gap-1.5 active:scale-95 transition-transform" onClick={() => { const mMap = Object.fromEntries(municipios.map(m => [m.id, m.nome])); exportAuditPDF({ suplentes: globalSup, liderancas: globalLid, administrativo: globalAdm, pagamentos: globalPag, municipiosMap: mMap }); }} disabled={isLoading}>
              <ClipboardCheck size={14} /> Auditoria
            </Button>
          </div>
        </div>

        {/* Search + Filters - Premium Design */}
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
          <div className="flex gap-3">
            <div className="relative flex-1 group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Buscar por nome, urna ou setor..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-12 h-12 bg-card/50 border-border/50 rounded-2xl focus:ring-primary/20 transition-all premium-shadow" 
              />
              {search && (
                <button 
                  onClick={() => setSearch("")} 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Button 
              variant={showFilters || activeFiltersCount > 0 ? "default" : "outline"} 
              size="icon" 
              className="h-12 w-12 shrink-0 relative rounded-2xl transition-all active:scale-90 premium-shadow" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-black flex items-center justify-center border-2 border-background shadow-lg animate-in zoom-in">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="glass-card rounded-[2rem] p-5 space-y-4 shadow-2xl animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <Filter size={14} />
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Filtros Avançados</p>
                </div>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="text-[10px] text-destructive font-bold uppercase tracking-widest flex items-center gap-1.5 hover:opacity-70 transition-opacity">
                    <X size={12} /> Limpar Tudo
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] ml-1">Região / Setor</p>
                  <div className="flex flex-wrap gap-2">
                    {regioes.map(r => (
                      <button key={r} onClick={() => setFiltroRegiao(filtroRegiao === r ? "" : r)}
                        className={`text-[11px] font-bold px-4 py-2 rounded-xl transition-all border ${filtroRegiao === r ? "premium-gradient text-white border-transparent shadow-lg scale-105" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"}`}>{r}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] ml-1">Partido</p>
                    <div className="flex flex-wrap gap-2">
                      {partidos.map(p => (
                        <button key={p} onClick={() => setFiltroPartido(filtroPartido === p ? "" : p)}
                          className={`text-[11px] font-bold px-4 py-2 rounded-xl transition-all border ${filtroPartido === p ? "premium-gradient text-white border-transparent shadow-lg scale-105" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"}`}>{p}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] ml-1">Situação</p>
                    <div className="flex flex-wrap gap-2">
                      {situacoes.map(s => (
                        <button key={s} onClick={() => setFiltroSituacao(filtroSituacao === s ? "" : s)}
                          className={`text-[11px] font-bold px-4 py-2 rounded-xl transition-all border ${filtroSituacao === s ? "premium-gradient text-white border-transparent shadow-lg scale-105" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFiltersCount > 0 && !showFilters && (
            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
              {filtroRegiao && (
                <span className="text-[10px] font-black bg-primary/10 text-primary border border-primary/20 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2 uppercase tracking-wider">
                  {filtroRegiao} 
                  <button onClick={() => setFiltroRegiao("")} className="hover:scale-125 transition-transform"><X size={12} /></button>
                </span>
              )}
              {filtroPartido && (
                <span className="text-[10px] font-black bg-primary/10 text-primary border border-primary/20 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2 uppercase tracking-wider">
                  {filtroPartido} 
                  <button onClick={() => setFiltroPartido("")} className="hover:scale-125 transition-transform"><X size={12} /></button>
                </span>
              )}
              {filtroSituacao && (
                <span className="text-[10px] font-black bg-primary/10 text-primary border border-primary/20 pl-3 pr-2 py-1.5 rounded-full flex items-center gap-2 uppercase tracking-wider">
                  {filtroSituacao} 
                  <button onClick={() => setFiltroSituacao("")} className="hover:scale-125 transition-transform"><X size={12} /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-2 shadow-sm animate-pulse">
                  <div className="h-3 bg-muted rounded w-16" />
                  <div className="h-6 bg-muted rounded w-12" />
                </div>
              ))}
            </div>
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        ) : (
          <>
            {/* View Tabs */}
            <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
              {viewTabs.map(([key, label, Icon]) => (
                <button key={key} onClick={() => setActiveView(key as any)}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all ${activeView === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  <Icon size={13} className="shrink-0" /> <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {activeView === "resumo" && (
              <DashResumo
                supList={globalSup}
                lidList={globalLid}
                admList={globalAdm}
                orcamentoTotal={orcamentoTotal}
                totalPagoAno={totalPagoAno}
                saldoRestante={saldoRestante}
                totalVotos={financials.totalVotos}
                totalExpectativa={financials.totalExpectativa}
                totalPessoas={financials.totalPessoas}
                totalLiderancasQtd={financials.totalLiderancasQtd}
                totalFiscais={financials.totalFiscais}
                totalPlotagem={financials.totalPlotagem}
                totalPlotagemVal={financials.totalPlotagemVal}
                totalCampanhaSup={financials.totalCampanhaSup}
                totalRetiradaSup={financials.totalRetiradaSup}
                totalLiderancasVal={financials.totalLiderancasVal}
                totalFiscaisVal={financials.totalFiscaisVal}
                totalRetiradaMensalSup={financials.totalRetiradaMensalSup}
                totalLidMensal={financials.totalLidMensal}
                totalAdmMensal={financials.totalAdmMensal}
                totalLidFluxo={totalLidFluxo}
                totalAdmFluxo={totalAdmFluxo}
                pieData={pieData}
              />
            )}

            {activeView === "mensal" && (
              <DashMensal
                fluxoMensal={fluxoMensal}
                mesAtual={mesAtual}
              />
            )}

            {activeView === "detalhes" && (
              <DashDetalhes
                dadosPorCidade={dadosPorCidade}
              />
            )}

            {activeView === "cidades" && (
              <DashCidades dadosPorCidade={dadosPorCidade} />
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
