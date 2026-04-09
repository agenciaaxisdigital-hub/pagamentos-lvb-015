import { memo, useState } from "react";
import { Building2, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { StatusBadge, EmptyState } from "./DashShared";
import { fmt, fmtN, fmtK, type CidadeData } from "./types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Props {
  dadosPorCidade: CidadeData[];
}

function CidadeCard({ c }: { c: CidadeData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0 py-3 first:pt-0 last:pb-0 space-y-2">
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            <div>
              <p className="text-sm font-bold text-foreground">{c.nome}</p>
              <p className="text-[10px] text-muted-foreground">{c.suplentes} sup · {c.liderancasCount} lid · {c.admin} adm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-bold text-primary">{fmt(c.orcamento)}</p>
              <StatusBadge pago={c.pago} previsto={c.orcamento} />
            </div>
            {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </div>
        </div>
      </button>

      {/* Summary bar always visible */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Pago: <span className="font-bold text-status-success">{fmt(c.pago)}</span></span>
          <span className="text-muted-foreground">Falta: <span className="font-medium text-foreground">{fmt(Math.max(0, c.orcamento - c.pago))}</span></span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.orcamento > 0 ? Math.min(100, (c.pago / c.orcamento) * 100) : 0}%`, backgroundColor: c.color }} />
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="space-y-3 pt-2 animate-fade-in">
          {/* Suplentes */}
          {c.orcSup > 0 && (
            <div className="bg-muted/30 rounded-xl p-2.5 space-y-1">
              <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Suplentes ({c.suplentes})</p>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="text-[10px]">
                  <span className="text-muted-foreground">Retirada mensal:</span>
                  <span className="font-medium text-foreground ml-1">{fmt(c.retiradaMensalSup)}/mês</span>
                </div>
                <div className="text-[10px]">
                  <span className="text-muted-foreground">Total retirada:</span>
                  <span className="font-medium text-foreground ml-1">{fmt(c.retiradaSup)}</span>
                </div>
                {c.liderancasQtd > 0 && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Lideranças ({fmtN(c.liderancasQtd)}):</span>
                    <span className="font-medium text-foreground ml-1">{fmt(c.liderancasVal)}</span>
                  </div>
                )}
                {c.fiscaisQtd > 0 && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Fiscais ({fmtN(c.fiscaisQtd)}):</span>
                    <span className="font-medium text-foreground ml-1">{fmt(c.fiscaisVal)}</span>
                  </div>
                )}
                {c.plotagemQtd > 0 && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Plotagem ({fmtN(c.plotagemQtd)}):</span>
                    <span className="font-medium text-foreground ml-1">{fmt(c.plotagemVal)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[10px] pt-1 border-t border-border/30">
                <span className="font-bold text-foreground">Total Suplentes</span>
                <span className="font-bold text-primary">{fmt(c.orcSup)}</span>
              </div>
            </div>
          )}

          {/* Lideranças */}
          {c.orcLid > 0 && (
            <div className="bg-muted/30 rounded-xl p-2.5 space-y-1">
              <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Lideranças ({c.liderancasCount})</p>
              <div className="space-y-0.5 pl-2 border-l-2 border-primary/20">
                {c.lidCidade.map(l => (
                  <div key={l.id} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground truncate mr-2">{l.nome} {l.regiao ? `(${l.regiao})` : ""}</span>
                    <span className="font-medium text-foreground shrink-0">{fmt(l.retirada_mensal_valor || 0)}/mês</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] pt-1 border-t border-border/30">
                <span className="font-bold text-foreground">Total Lideranças</span>
                <span className="font-bold text-primary">{fmt(c.orcLid)}</span>
              </div>
            </div>
          )}

          {/* Admin */}
          {c.orcAdm > 0 && (
            <div className="bg-muted/30 rounded-xl p-2.5 space-y-1">
              <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Administrativo ({c.admin})</p>
              <div className="space-y-0.5 pl-2 border-l-2 border-primary/20">
                {c.admCidade.map(a => (
                  <div key={a.id} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground truncate mr-2">{a.nome}</span>
                    <span className="font-medium text-foreground shrink-0">{fmt(a.valor_contrato || 0)}/mês</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] pt-1 border-t border-border/30">
                <span className="font-bold text-foreground">Total Admin</span>
                <span className="font-bold text-primary">{fmt(c.orcAdm)}</span>
              </div>
            </div>
          )}

          {/* Votos */}
          {(c.votos2024 > 0 || c.expectativa2026 > 0) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[8px] text-muted-foreground uppercase">Votos 2024</p>
                <p className="text-sm font-bold text-foreground">{fmtN(c.votos2024)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[8px] text-muted-foreground uppercase">Expect. 2026</p>
                <p className="text-sm font-bold text-foreground">{fmtN(c.expectativa2026)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DashCidadesInner({ dadosPorCidade }: Props) {
  const tooltipFmt = (value: number) => fmt(value);

  if (dadosPorCidade.length === 0) {
    return <EmptyState message="Nenhuma cidade com dados para exibir." />;
  }

  const totalOrc = dadosPorCidade.reduce((a, c) => a + c.orcamento, 0);
  const totalPago = dadosPorCidade.reduce((a, c) => a + c.pago, 0);
  const totalSup = dadosPorCidade.reduce((a, c) => a + c.suplentes, 0);
  const totalLid = dadosPorCidade.reduce((a, c) => a + c.liderancasCount, 0);
  const totalAdm = dadosPorCidade.reduce((a, c) => a + c.admin, 0);

  return (
    <div className="space-y-4">
      {/* Totais consolidados */}
      <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl p-4 shadow-lg text-primary-foreground">
        <p className="text-[10px] uppercase tracking-wider opacity-80 mb-1">💰 Total Todas as Cidades</p>
        <p className="text-2xl font-bold">{fmt(totalOrc)}</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-primary-foreground/15 backdrop-blur rounded-xl px-2 py-1.5 text-center">
            <p className="text-[8px] uppercase opacity-70">Pago</p>
            <p className="text-xs font-bold">{fmt(totalPago)}</p>
          </div>
          <div className="bg-primary-foreground/15 backdrop-blur rounded-xl px-2 py-1.5 text-center">
            <p className="text-[8px] uppercase opacity-70">Falta</p>
            <p className="text-xs font-bold">{fmt(Math.max(0, totalOrc - totalPago))}</p>
          </div>
          <div className="bg-primary-foreground/15 backdrop-blur rounded-xl px-2 py-1.5 text-center">
            <p className="text-[8px] uppercase opacity-70">% Pago</p>
            <p className="text-xs font-bold">{totalOrc > 0 ? ((totalPago / totalOrc) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="text-center">
            <p className="text-[8px] uppercase opacity-70">Suplentes</p>
            <p className="text-sm font-bold">{totalSup}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] uppercase opacity-70">Lideranças</p>
            <p className="text-sm font-bold">{totalLid}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] uppercase opacity-70">Admin</p>
            <p className="text-sm font-bold">{totalAdm}</p>
          </div>
        </div>
      </div>

      {/* Gráfico comparativo */}
      {dadosPorCidade.length > 1 && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <BarChart3 size={14} /> Orçamento por Cidade
          </h2>
          <ResponsiveContainer width="100%" height={Math.max(150, dadosPorCidade.length * 45)}>
            <BarChart data={dadosPorCidade} layout="vertical">
              <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={tooltipFmt} />
              <Bar dataKey="orcamento" name="Orçamento" radius={[0, 6, 6, 0]}>
                {dadosPorCidade.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Bar>
              <Bar dataKey="pago" name="Pago" radius={[0, 6, 6, 0]} fillOpacity={0.4}>
                {dadosPorCidade.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cards por cidade com detalhamento */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <Building2 size={14} /> Detalhamento por Cidade
        </h2>
        <div className="divide-y divide-border">
          {dadosPorCidade.map(c => <CidadeCard key={c.id} c={c} />)}
        </div>
      </div>
    </div>
  );
}

export const DashCidades = memo(DashCidadesInner);
