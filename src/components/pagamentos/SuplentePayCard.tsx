import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronDown, ChevronUp, DollarSign, Receipt, Trash2, Users } from "lucide-react";
import { calcTotaisFinanceiros } from "@/lib/finance";
import { PayForm } from "./PayForm";

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CAT_LABEL: Record<string, string> = {
  retirada: "Retirada Mensal",
  plotagem: "Plotagem",
  liderancas: "Lideranças",
  fiscais: "Fiscais",
  salario: "Salário",
  outro: "Outro",
};

function Bar({ pago, total, cor = "bg-primary", height = "h-1.5" }: { pago: number; total: number; cor?: string; height?: string }) {
  const pct = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
  return (
    <div className={`${height} bg-muted rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

interface Pagamento {
  id: string;
  suplente_id: string | null;
  lideranca_id: string | null;
  admin_id: string | null;
  tipo_pessoa: string;
  mes: number;
  ano: number;
  categoria: string;
  valor: number;
  observacao: string | null;
  created_at: string;
}

interface Suplente {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  partido: string | null;
  bairro: string | null;
  retirada_mensal_valor: number;
  retirada_mensal_meses: number;
  plotagem_qtd: number;
  plotagem_valor_unit: number;
  liderancas_qtd: number;
  liderancas_valor_unit: number;
  fiscais_qtd: number;
  fiscais_valor_unit: number;
  total_campanha: number;
  numero_urna: string | null;
  base_politica: string | null;
  created_at: string;
  municipio_id?: string | null;
  vinculado_id?: string | null;
}

interface SuplentePayCardProps {
  s: Suplente;
  pagsMes: Pagamento[];
  pagsTodos: Pagamento[];
  mes: number;
  ano: number;
  nomesMap?: Record<string, string>;
}

export function SuplentePayCard({ s, pagsMes, pagsTodos, mes, ano, nomesMap }: SuplentePayCardProps) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFicha, setShowFicha] = useState(false);

  const retiradaMes = s.retirada_mensal_valor || 0;
  const pagoMesRaw = pagsMes.reduce((a, p) => a + p.valor, 0);
  const pagoMes = Math.min(pagoMesRaw, retiradaMes);
  const faltaMes = Math.max(0, retiradaMes - pagoMes);
  const pago = pagoMes >= retiradaMes;

  const totais = calcTotaisFinanceiros(s);
  const totalPagoGeral = pagsTodos.reduce((a, p) => a + p.valor, 0);

  const pagoRetiradaMes = pagsMes.filter(p => p.categoria === "retirada").reduce((a, p) => a + p.valor, 0);
  const pagoRetiradaMesCap = Math.min(pagoRetiradaMes, retiradaMes);

  const rawPagoRetirada = pagsTodos.filter(p => p.categoria === "retirada").reduce((a, p) => a + p.valor, 0);
  const rawPagoPlotagem = pagsTodos.filter(p => p.categoria === "plotagem").reduce((a, p) => a + p.valor, 0);
  const rawPagoLiderancas = pagsTodos.filter(p => p.categoria === "liderancas").reduce((a, p) => a + p.valor, 0);
  const rawPagoFiscais = pagsTodos.filter(p => p.categoria === "fiscais").reduce((a, p) => a + p.valor, 0);

  const categorias = [
    { key: "retirada", label: "Retirada", planejado: totais.retirada, pago: Math.min(rawPagoRetirada, totais.retirada), detalhe: `${fmt(retiradaMes)} × ${s.retirada_mensal_meses || 0}m`, qtd: retiradaMes, valorUnit: s.retirada_mensal_meses || 0, faltaMes: Math.max(0, retiradaMes - pagoRetiradaMesCap) },
    { key: "plotagem", label: "Plotagem", planejado: totais.plotagem, pago: rawPagoPlotagem, detalhe: `${s.plotagem_qtd || 0} × ${fmt(s.plotagem_valor_unit || 0)}`, qtd: s.plotagem_qtd || 0, valorUnit: s.plotagem_valor_unit || 0 },
    { key: "liderancas", label: "Lideranças", planejado: totais.liderancas, pago: rawPagoLiderancas, detalhe: `${s.liderancas_qtd || 0} × ${fmt(s.liderancas_valor_unit || 0)}`, qtd: s.liderancas_qtd || 0, valorUnit: s.liderancas_valor_unit || 0 },
    { key: "fiscais", label: "Fiscais", planejado: totais.fiscais, pago: rawPagoFiscais, detalhe: `${s.fiscais_qtd || 0} × ${fmt(s.fiscais_valor_unit || 0)}`, qtd: s.fiscais_qtd || 0, valorUnit: s.fiscais_valor_unit || 0 },
  ].filter(c => c.planejado > 0 || c.qtd > 0);

  const handleSave = async (valor: number, obs: string, cat: string) => {
    if (saving) return;
    if (cat === "retirada") {
      const jaExiste = pagsMes.some(p => p.categoria === "retirada");
      if (jaExiste) {
        toast({ title: "⚠️ Já existe pagamento de Retirada neste mês", description: "Apague o existente antes de inserir outro.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);

    const payload = {
      tipo_pessoa: "suplente",
      suplente_id: s.id,
      mes,
      ano,
      categoria: cat,
      valor,
      observacao: obs || null,
    };

    const { execOnlineOrEnqueue } = await import("@/lib/offlineFallback");
    
    await execOnlineOrEnqueue(
      () => supabase.from("pagamentos").insert(payload),
      {
        action: 'INSERT',
        table: 'pagamentos',
        payload,
        onSuccess: () => {
          toast({ title: `✅ ${fmt(valor)} registrado para ${s.nome}` });
          qc.invalidateQueries({ queryKey: ["pagamentos"] });
          setPaying(false);
          setSaving(false);
        },
        onError: (err) => {
          toast({ title: "Erro", description: err.message, variant: "destructive" });
          setSaving(false);
        }
      }
    );
  };

  const handleDelete = async (pagId: string) => {
    if (!confirm("Excluir pagamento?")) return;
    const { error } = await supabase.from("pagamentos").delete().eq("id", pagId);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Pagamento excluído" });
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  };

  return (
    <div className={`bg-card rounded-2xl border shadow-sm overflow-hidden ${pago ? "border-green-500/20" : "border-amber-500/30"}`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground text-sm text-wrap-anywhere">{s.nome}</p>
            {s.numero_urna && (
              <p className="text-[10px] text-muted-foreground text-wrap-anywhere">Urna: <span className="font-semibold">{s.numero_urna}</span></p>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {s.partido && <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{s.partido}</span>}
              {(s.bairro || s.regiao_atuacao) && <span className="text-[11px] text-muted-foreground text-wrap-anywhere">📍 {s.bairro || s.regiao_atuacao}</span>}
            </div>
            {s.vinculado_id && (nomesMap as any)?.[s.vinculado_id] && (
              <div className="flex items-center gap-1 mt-1">
                <Users size={10} className="text-primary/60" />
                <span className="text-[10px] text-primary/80 font-medium text-wrap-anywhere">
                  Vínculo: {(nomesMap as any)[s.vinculado_id]}
                </span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            {pago ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-sm font-bold text-green-600 dark:text-green-400 numeric-compact">{fmt(pagoMes || retiradaMes)}</span>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground">Falta</p>
                <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 numeric-compact">{fmt(faltaMes)}</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>Retirada {MESES[mes - 1]}</span>
            <span>{fmt(pagoMes)} / {fmt(retiradaMes)}</span>
          </div>
          {retiradaMes > 0 && <Bar pago={pagoMes} total={retiradaMes} cor={pago ? "bg-green-500" : "bg-amber-500"} />}
          <p className="text-[10px] text-muted-foreground mt-1">Cadastro: {new Date(s.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      <div className="flex border-t border-border/30 divide-x divide-border/30">
        <button onClick={() => { setPaying(!paying); setShowFicha(false); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold ${!pago ? "text-white bg-gradient-to-r from-pink-500 to-rose-400" : "text-primary hover:bg-primary/5"}`}>
          <DollarSign size={12} /> {pago ? "+ Pagamento" : "Pagar"}
        </button>
        <button onClick={() => { setShowFicha(!showFicha); setPaying(false); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:bg-muted/20 font-medium">
          <Receipt size={12} /> Ficha {showFicha ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {paying && (
        <div className="p-3 border-t border-border/30">
          <PayForm
            pessoaNome={s.nome}
            categorias={categorias}
            onSave={handleSave}
            onCancel={() => setPaying(false)}
            saving={saving}
            suplenteId={s.id}
            onFieldsUpdated={() => qc.invalidateQueries({ queryKey: ["suplentes"] })}
          />
        </div>
      )}

      {showFicha && (
        <div className="border-t border-border/50 bg-muted/5 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
            <Receipt size={10} /> Gastos da Campanha
          </p>
          {categorias.map(c => {
            const falta = Math.max(0, c.planejado - c.pago);
            const catPags = pagsTodos.filter(p => p.categoria === c.key);
            return (
              <div key={c.key} className="bg-card rounded-xl border border-border/50 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{CAT_LABEL[c.key]}</p>
                    <p className="text-[10px] text-muted-foreground">{c.detalhe}</p>
                  </div>
                  <p className="text-xs font-bold text-foreground">{fmt(c.planejado)}</p>
                </div>
                <Bar pago={c.pago} total={c.planejado} cor={c.pago >= c.planejado ? "bg-green-500" : "bg-primary"} height="h-1" />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-green-600 dark:text-green-400">✓ {fmt(c.pago)}</span>
                  {falta > 0 ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">⏳ {fmt(falta)}</span>
                  ) : (
                    <span className="text-[10px] text-green-600 font-bold">Quitado ✓</span>
                  )}
                </div>
                {catPags.length > 0 && (
                  <div className="mt-1.5 border-t border-border/30 pt-1">
                    {catPags.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-[10px] py-1 group">
                        <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")} {p.observacao && `— ${p.observacao}`}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{fmt(p.valor)}</span>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="inline-flex h-6 items-center gap-1 rounded border border-destructive/30 px-1.5 text-destructive transition-colors hover:bg-destructive/10"
                            title="Apagar"
                          >
                            <Trash2 size={10} />
                            <span className="text-[9px] font-semibold">Apagar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className={`rounded-xl p-3 border ${totalPagoGeral >= totais.totalFinal ? "bg-green-500/10 border-green-500/30" : "bg-card border-border"}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-foreground">Total Campanha</span>
              <span className="text-sm font-bold text-foreground">{fmt(totais.totalFinal)}</span>
            </div>
            <Bar pago={totalPagoGeral} total={totais.totalFinal} cor={totalPagoGeral >= totais.totalFinal ? "bg-green-500" : "bg-primary"} />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-green-600 dark:text-green-400 font-bold">Pago: {fmt(totalPagoGeral)}</span>
              <span className={`text-[11px] font-bold ${totais.totalFinal > totalPagoGeral ? "text-rose-500" : "text-green-500"}`}>
                {totais.totalFinal > totalPagoGeral ? `Falta: ${fmt(totais.totalFinal - totalPagoGeral)}` : "Quitado ✓"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
