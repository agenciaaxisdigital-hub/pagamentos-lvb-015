import { memo } from "react";
import { DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { MiniBar, EmptyState } from "./DashShared";
import { fmt, fmtN, type Lideranca, type AdminPessoa } from "./types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface Props {
  supList: any[];
  lidList: Lideranca[];
  admList: AdminPessoa[];
  orcamentoTotal: number;
  totalPagoAno: number;
  saldoRestante: number;
  totalVotos: number;
  totalExpectativa: number;
  totalPessoas: number;
  totalLiderancasQtd: number;
  totalFiscais: number;
  totalPlotagem: number;
  totalPlotagemVal: number;
  totalCampanhaSup: number;
  totalRetiradaSup: number;
  totalLiderancasVal: number;
  totalFiscaisVal: number;
  totalRetiradaMensalSup: number;
  totalLidMensal: number;
  totalAdmMensal: number;
  totalLidFluxo: number;
  totalAdmFluxo: number;
  pieData: { name: string; value: number; fill: string }[];
}

function DashResumoInner({
  supList, lidList, admList,
  orcamentoTotal, totalPagoAno, saldoRestante,
  totalVotos, totalExpectativa, totalPessoas,
  totalLiderancasQtd, totalFiscais, totalPlotagem, totalPlotagemVal,
  totalCampanhaSup, totalRetiradaSup, totalLiderancasVal, totalFiscaisVal,
  totalRetiradaMensalSup, totalLidMensal, totalAdmMensal,
  totalLidFluxo, totalAdmFluxo, pieData,
}: Props) {
  const tooltipFmt = (value: number) => fmt(value);

  if (supList.length === 0 && lidList.length === 0 && admList.length === 0) {
    return <EmptyState message="Nenhum dado cadastrado para exibir no resumo." />;
  }

  return (
    <div className="space-y-4">
      {/* Hero card - Refatorado com layout de saldo e cor Rosa */}
      <div className="bg-gradient-to-br from-pink-600 via-rose-500 to-rose-400 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden mb-2">
        {/* Decoração sutil de fundo */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="bg-white/20 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/20 mb-6">
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Resumo Financeiro 2026</span>
          </div>

          <p className="text-white/80 text-[11px] font-bold uppercase tracking-widest mb-2">Saldo Restante (A Pagar)</p>
          <h2 className="text-white text-5xl sm:text-6xl font-black tracking-tighter mb-8 tabular-nums drop-shadow-lg">
            {fmt(saldoRestante)}
          </h2>

          <div className="w-full grid grid-cols-2 gap-4 mb-8">
            <div className="text-left bg-white/15 backdrop-blur-sm rounded-3xl p-5 border border-white/10">
              <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest mb-1">Total Já Pago</p>
              <p className="text-white text-xl font-bold">{fmt(totalPagoAno)}</p>
            </div>
            <div className="text-left bg-white/15 backdrop-blur-sm rounded-3xl p-5 border border-white/10">
              <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest mb-1">Orçamento Geral</p>
              <p className="text-white text-xl font-bold">{fmt(orcamentoTotal)}</p>
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="flex justify-between items-end mb-1">
              <span className="text-white/70 text-[10px] font-bold uppercase tracking-tighter">Status da Operação</span>
              <span className="text-white text-sm font-black">{orcamentoTotal > 0 ? ((totalPagoAno / orcamentoTotal) * 100).toFixed(1) : 0}% PAGO</span>
            </div>
            <div className="h-4 bg-black/10 rounded-full p-1 border border-white/10">
              <div 
                className="h-full bg-white rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                style={{ width: `${orcamentoTotal > 0 ? Math.min(100, (totalPagoAno / orcamentoTotal) * 100) : 0}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Resumo Geral</h2>

        {/* Números da Eleição */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">📊 Números da Eleição</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Votos recebidos em 2024</p>
              <p className="text-xl font-bold text-foreground">{fmtN(totalVotos)}</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Expectativa de votos 2026</p>
              <p className="text-xl font-bold text-foreground">{fmtN(totalExpectativa)}</p>
              {totalVotos > 0 && (
                <p className={`text-[9px] font-medium flex items-center gap-0.5 mt-0.5 ${totalExpectativa >= totalVotos ? "text-status-success" : "text-destructive"}`}>
                  {totalExpectativa >= totalVotos ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
                  {((((totalExpectativa - totalVotos) / totalVotos) * 100).toFixed(0))}% vs 2024
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Equipe */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">👥 Equipe de Campo e Apoio</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Suplentes cadastrados</p>
              <p className="text-xl font-bold text-foreground">{supList.length}</p>
              <p className="text-[9px] text-muted-foreground">Candidatos que a operação apoia</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Lideranças contratadas</p>
              <p className="text-xl font-bold text-foreground">{lidList.length}</p>
              <p className="text-[9px] text-muted-foreground">Cabos eleitorais e líderes de bairro</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Equipe administrativa</p>
              <p className="text-xl font-bold text-foreground">{admList.length}</p>
              <p className="text-[9px] text-muted-foreground">Funcionários e prestadores</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-0.5">Pessoas de campo (total)</p>
              <p className="text-xl font-bold text-foreground">{fmtN(totalPessoas)}</p>
              <p className="text-[9px] text-muted-foreground">{fmtN(totalLiderancasQtd)} lideranças + {fmtN(totalFiscais)} fiscais</p>
            </div>
          </div>
        </div>

        {/* Plotagem */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">🚗 Carros Plotados</p>
          <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Carros plotados contratados</p>
              <p className="text-lg font-bold text-foreground">{fmtN(totalPlotagem)} unidades</p>
              <p className="text-[9px] text-muted-foreground">Veículos com adesivação e plotagem</p>
            </div>
            <p className="text-sm font-bold text-primary">{fmt(totalPlotagemVal)}</p>
          </div>
        </div>
      </div>

      {/* Custos detalhados */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">💰 De Onde Vem Cada Gasto</h2>

        {/* Suplentes */}
        <div className="space-y-2 bg-muted/30 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">Suplentes (custo de campanha)</p>
              <p className="text-[10px] text-muted-foreground">Tudo que é gasto com cada suplente: salários, pessoas, material</p>
            </div>
            <p className="text-sm font-bold text-primary shrink-0">{fmt(totalCampanhaSup)}</p>
          </div>
          <MiniBar pago={totalCampanhaSup} total={orcamentoTotal} cor="bg-primary" />
          <div className="space-y-1 pl-2 border-l-2 border-primary/20">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Retirada mensal dos suplentes</span>
              <span className="font-medium text-foreground">{fmt(totalRetiradaSup)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Lideranças de campo ({fmtN(totalLiderancasQtd)} pessoas)</span>
              <span className="font-medium text-foreground">{fmt(totalLiderancasVal)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Fiscais de urna ({fmtN(totalFiscais)} pessoas)</span>
              <span className="font-medium text-foreground">{fmt(totalFiscaisVal)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Plotagem / Material ({fmtN(totalPlotagem)} un.)</span>
              <span className="font-medium text-foreground">{fmt(totalPlotagemVal)}</span>
            </div>
            <div className="flex justify-between text-[11px] pt-1 border-t border-border/30">
              <span className="text-muted-foreground italic">Retirada mensal somada (todos sup.)</span>
              <span className="font-bold text-foreground">{fmt(totalRetiradaMensalSup)}/mês</span>
            </div>
          </div>
        </div>

        {/* Lideranças */}
        <div className="space-y-2 bg-muted/30 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">Lideranças (mensal)</p>
              <p className="text-[10px] text-muted-foreground">Cabos eleitorais e líderes de bairro — pagos todo mês</p>
            </div>
            <p className="text-sm font-bold text-primary shrink-0">{fmt(totalLidMensal)}/mês</p>
          </div>
          <MiniBar pago={totalLidFluxo} total={orcamentoTotal} cor="bg-primary" />
          <div className="space-y-0.5 pl-2 border-l-2 border-primary/20">
            {lidList.map(l => (
              <div key={l.id} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground truncate mr-2">{l.nome} {l.regiao ? `(${l.regiao})` : ""}</span>
                <span className="font-medium text-foreground shrink-0">{fmt(l.retirada_mensal_valor || 0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin */}
        <div className="space-y-2 bg-muted/30 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">Administrativo (mensal)</p>
              <p className="text-[10px] text-muted-foreground">Funcionários e prestadores de serviço</p>
            </div>
            <p className="text-sm font-bold text-primary shrink-0">{fmt(totalAdmMensal)}/mês</p>
          </div>
          <MiniBar pago={totalAdmFluxo} total={orcamentoTotal} cor="bg-primary" />
          <div className="space-y-0.5 pl-2 border-l-2 border-primary/20">
            {admList.map(a => (
              <div key={a.id} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground truncate mr-2">{a.nome}</span>
                <span className="font-medium text-foreground shrink-0">{fmt(a.valor_contrato || 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />
        <div className="flex justify-between items-center pt-1">
          <span className="text-sm font-bold text-foreground">TOTAL GERAL DA OPERAÇÃO</span>
          <span className="text-lg font-bold text-primary">{fmt(orcamentoTotal)}</span>
        </div>
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <PieChartIcon size={14} /> Onde vai o dinheiro (%)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={tooltipFmt} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-bold text-foreground">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const DashResumo = memo(DashResumoInner);
