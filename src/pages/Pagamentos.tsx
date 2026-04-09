import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/PageTransition";
import { CardSkeletonList } from "@/components/CardSkeleton";
import {
  ChevronDown, ChevronUp, Trash2, X, Loader2, Wallet,
  ChevronLeft, ChevronRight, Save, Search,
  CheckCircle2, AlertCircle, Users, Briefcase, List, Pencil,
  DollarSign, Receipt, Bell, Package,
} from "lucide-react";
import { calcTotaisFinanceiros } from "@/lib/finance";
import { getMesInicioComHistorico } from "@/lib/paymentEligibility";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { usePaymentNotifications } from "@/hooks/usePaymentNotifications";
import { useCidade } from "@/contexts/CidadeContext";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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
};

type Lideranca = {
  id: string; nome: string; regiao: string | null;
  retirada_mensal_valor: number | null; chave_pix: string | null;
  created_at: string;
};

type AdminPessoa = {
  id: string; nome: string; whatsapp: string | null; valor_contrato: number | null;
  created_at: string;
};

const CAT_LABEL: Record<string, string> = {
  retirada: "Retirada Mensal", plotagem: "Plotagem",
  liderancas: "Lideranças", fiscais: "Fiscais",
  salario: "Salário", outro: "Outro",
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

// ─── Formulário de pagamento ─────────────────────────────────────────────────
// Mapeamento categoria → campos no banco
const CAT_FIELDS: Record<string, { qtdField: string; valField: string } | { valField: string; mesesField: string }> = {
  retirada: { valField: "retirada_mensal_valor", mesesField: "retirada_mensal_meses" },
  plotagem: { qtdField: "plotagem_qtd", valField: "plotagem_valor_unit" },
  liderancas: { qtdField: "liderancas_qtd", valField: "liderancas_valor_unit" },
  fiscais: { qtdField: "fiscais_qtd", valField: "fiscais_valor_unit" },
};

function PayForm({ pessoaNome, categorias, onSave, onCancel, saving, suplenteId, onFieldsUpdated }: {
  pessoaNome: string;
  categorias: { key: string; label: string; planejado: number; pago: number; detalhe: string; qtd: number; valorUnit: number; faltaMes?: number }[];
  onSave: (valor: number, obs: string, cat: string) => Promise<void>;
  onCancel: () => void; saving: boolean;
  suplenteId?: string;
  onFieldsUpdated?: () => void;
}) {
  const [cat, setCat] = useState(categorias[0]?.key || "retirada");
  const catAtual = categorias.find(c => c.key === cat) || categorias[0];
  // Para retirada, usar faltaMes (só o mês) em vez de falta total
  const faltaCat = catAtual
    ? (catAtual.faltaMes != null ? catAtual.faltaMes : Math.max(0, catAtual.planejado - catAtual.pago))
    : 0;
  const [valor, setValor] = useState(faltaCat > 0 ? String(faltaCat) : "");
  const [obs, setObs] = useState("");
  const valorNum = parseFloat(valor.replace(",", ".")) || 0;

  // Edição inline
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState("");
  const [editVal, setEditVal] = useState("");
  const [savingFields, setSavingFields] = useState(false);

  const handleCatChange = (newCat: string) => {
    setCat(newCat);
    const c = categorias.find(x => x.key === newCat);
    if (c) {
      const f = c.faltaMes != null ? c.faltaMes : Math.max(0, c.planejado - c.pago);
      setValor(f > 0 ? String(f) : "");
    }
  };

  const startEdit = (c: typeof categorias[0]) => {
    if (c.key === "retirada") {
      setEditQtd(String(c.valorUnit)); // meses
      setEditVal(String(c.qtd));       // valor mensal
    } else {
      setEditQtd(String(c.qtd));
      setEditVal(String(c.valorUnit));
    }
    setEditCat(c.key);
  };

  const saveEdit = async (catKey: string) => {
    if (!suplenteId) return;
    const fields = CAT_FIELDS[catKey];
    if (!fields) return;
    setSavingFields(true);
    const update: Record<string, number> = {};
    if ("qtdField" in fields) {
      update[fields.qtdField] = parseInt(editQtd) || 0;
      update[fields.valField] = parseFloat(editVal.replace(",", ".")) || 0;
    } else {
      update[fields.valField] = parseFloat(editVal.replace(",", ".")) || 0;
      update[fields.mesesField] = parseInt(editQtd) || 0;
    }
    const { error } = await supabase.from("suplentes").update(update).eq("id", suplenteId);
    setSavingFields(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Valores atualizados!" });
    setEditCat(null);
    onFieldsUpdated?.();
  };

  const totalPlanejado = categorias.reduce((a, c) => a + c.planejado, 0);
  const totalPago = categorias.reduce((a, c) => a + c.pago, 0);
  const totalFalta = categorias.reduce((a, c) => a + Math.max(0, c.planejado - c.pago), 0);

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-wider">Registrar Pagamento</p>
          <p className="text-sm font-semibold text-foreground">{pessoaNome}</p>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1"><X size={16} /></button>
      </div>

      {/* Visão geral de todas categorias */}
      {categorias.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Valores da Campanha</p>
          {categorias.map(c => {
            const falta = Math.max(0, c.planejado - c.pago);
            const quitado = c.pago >= c.planejado && c.planejado > 0;
            const isEditing = editCat === c.key;
            const isSelected = cat === c.key;

            return (
              <div key={c.key}
                className={`rounded-xl border p-2.5 transition-all cursor-pointer ${isSelected ? "border-primary/40 bg-primary/5" : "border-border/50 bg-muted/20 hover:bg-muted/30"}`}
                onClick={() => !isEditing && handleCatChange(c.key)}>

                {isEditing ? (
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] font-bold text-primary uppercase">{c.label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">
                          {c.key === "retirada" ? "Valor Mensal (R$)" : "Quantidade"}
                        </p>
                        <Input type="number" inputMode="decimal" value={c.key === "retirada" ? editVal : editQtd}
                          onChange={e => c.key === "retirada" ? setEditVal(e.target.value) : setEditQtd(e.target.value)}
                          className="h-8 text-xs bg-card font-bold" />
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">
                          {c.key === "retirada" ? "Meses" : "Valor Unitário (R$)"}
                        </p>
                        <Input type="number" inputMode="decimal" value={c.key === "retirada" ? editQtd : editVal}
                          onChange={e => c.key === "retirada" ? setEditQtd(e.target.value) : setEditVal(e.target.value)}
                          className="h-8 text-xs bg-card font-bold" />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-[10px] flex-1 bg-primary" onClick={() => saveEdit(c.key)} disabled={savingFields}>
                        {savingFields ? <Loader2 size={10} className="animate-spin" /> : <><Save size={10} className="mr-1" />Salvar</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={(e) => { e.stopPropagation(); setEditCat(null); }}>
                        <X size={10} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{c.label}</span>
                        <span className="text-[9px] text-muted-foreground">{c.detalhe}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{fmt(c.planejado)}</span>
                        {suplenteId && (
                          <button onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                            className="text-primary/60 hover:text-primary p-0.5 rounded-md hover:bg-primary/10 transition-colors">
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                    <Bar pago={c.pago} total={c.planejado} cor={quitado ? "bg-green-500" : isSelected ? "bg-primary" : "bg-muted-foreground/30"} height="h-1" />
                    <div className="flex justify-between mt-0.5 text-[9px]">
                      <span className="text-green-600 dark:text-green-400">✓ {fmt(c.pago)}</span>
                      {falta > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">Falta {fmt(falta)}</span>
                      ) : (
                        <span className="text-green-600 font-bold">Quitado</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Total geral */}
          <div className="rounded-xl bg-muted/40 border border-border/50 p-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Total Campanha</span>
              <span className="text-sm font-bold text-foreground">{fmt(totalPlanejado)}</span>
            </div>
            <Bar pago={totalPago} total={totalPlanejado} cor={totalFalta <= 0 ? "bg-green-500" : "bg-primary"} />
            <div className="flex justify-between mt-0.5 text-[9px]">
              <span className="text-green-600 dark:text-green-400 font-bold">Pago: {fmt(totalPago)}</span>
              {totalFalta > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">Falta: {fmt(totalFalta)}</span>
              ) : (
                <span className="text-green-600 font-bold">Campanha Quitada ✓</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Categoria única (liderança/admin) */}
      {categorias.length === 1 && catAtual && (
        <div className="bg-muted/30 rounded-xl p-2.5 space-y-1">
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-muted-foreground font-medium">{catAtual.detalhe}</span>
            <span className="font-bold text-foreground">Planejado: {fmt(catAtual.planejado)}</span>
          </div>
          <Bar pago={catAtual.pago} total={catAtual.planejado} cor={catAtual.pago >= catAtual.planejado ? "bg-green-500" : "bg-primary"} />
          <div className="flex justify-between text-[10px]">
            <span className="text-green-600 dark:text-green-400 font-medium">Pago: {fmt(catAtual.pago)}</span>
            {faltaCat > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">Falta: {fmt(faltaCat)}</span>
            ) : (
              <span className="text-green-600 font-bold">Quitado ✓</span>
            )}
          </div>
        </div>
      )}

      {/* Separador */}
      {categorias.length > 1 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
            Pagando: {categorias.find(c => c.key === cat)?.label}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Valor + Obs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Valor (R$)</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
            <Input type="number" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
              className="pl-8 h-11 text-base font-bold bg-card border-primary/40" placeholder="0,00" autoFocus />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Observação</p>
          <Input value={obs} onChange={e => setObs(e.target.value)} className="h-11 bg-card" placeholder="Opcional" />
        </div>
      </div>

      {faltaCat > 0 && valorNum > 0 && valorNum < faltaCat && (
        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          <AlertCircle size={11} className="text-amber-500 shrink-0" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Parcial — faltará {fmt(faltaCat - valorNum)}</span>
        </div>
      )}

      <Button onClick={() => onSave(valorNum, obs, cat)} disabled={saving || valorNum <= 0}
        className="w-full h-11 bg-gradient-to-r from-pink-500 to-rose-400 text-white font-bold text-sm">
        {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
        {saving ? "Salvando..." : `Registrar ${fmt(valorNum)}`}
      </Button>
    </div>
  );
}

// ─── Item no histórico (editar/excluir) ──────────────────────────────────────
function HistoricoItem({ p, onDelete }: { p: Pagamento; onDelete: (id: string) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(p.valor));
  const [obs, setObs] = useState(p.observacao || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!v) return;
    setSaving(true);
    const { error } = await supabase.from("pagamentos").update({ valor: v, observacao: obs || null }).eq("id", p.id);
    setSaving(false);
    if (!error) { toast({ title: "Atualizado!" }); qc.invalidateQueries({ queryKey: ["pagamentos"] }); setEditing(false); }
  };

  if (editing) return (
    <div className="px-3 py-2 space-y-1.5 bg-muted/20">
      <div className="flex gap-1.5">
        <Input type="number" value={valor} onChange={e => setValor(e.target.value)} className="h-7 text-xs flex-1 bg-card" />
        <Input value={obs} onChange={e => setObs(e.target.value)} className="h-7 text-xs flex-1 bg-card" placeholder="Obs" />
        <Button size="sm" className="h-7 px-2 text-[10px] bg-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={10} className="animate-spin" /> : "✓"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(false)}>✕</Button>
      </div>
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-foreground">{CAT_LABEL[p.categoria] || p.categoria}</span>
        {p.observacao && <span className="text-[10px] text-muted-foreground ml-2">{p.observacao}</span>}
        <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold text-green-600 dark:text-green-400">{fmt(p.valor)}</span>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Editar pagamento"
          title="Editar pagamento"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(p.id)}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-destructive/30 px-2 text-destructive transition-colors hover:bg-destructive/10"
          aria-label="Apagar pagamento"
          title="Apagar pagamento"
        >
          <Trash2 size={12} />
          <span className="text-[10px] font-semibold">Apagar</span>
        </button>
      </div>
    </div>
  );
}

// ─── Card de Suplente no Pagamentos ──────────────────────────────────────────
function SuplentePayCard({ s, pagsMes, pagsTodos, mes, ano }: {
  s: Suplente; pagsMes: Pagamento[]; pagsTodos: Pagamento[]; mes: number; ano: number;
}) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFicha, setShowFicha] = useState(false);

  const retiradaMes = s.retirada_mensal_valor || 0;
  const pagoMesRaw = pagsMes.reduce((a, p) => a + p.valor, 0);
  const pagoMes = Math.min(pagoMesRaw, retiradaMes); // Cap no valor mensal
  const faltaMes = Math.max(0, retiradaMes - pagoMes);
  const pago = pagoMes >= retiradaMes;

  const totais = calcTotaisFinanceiros(s);
  const totalPagoGeral = pagsTodos.reduce((a, p) => a + p.valor, 0);

  const pagoRetiradaMes = pagsMes.filter(p => p.categoria === "retirada").reduce((a, p) => a + p.valor, 0);
  // Cap: para retirada, pago no mês não pode exceder o valor mensal
  const pagoRetiradaMesCap = Math.min(pagoRetiradaMes, retiradaMes);

  const rawPagoRetirada = pagsTodos.filter(p => p.categoria === "retirada").reduce((a, p) => a + p.valor, 0);
  const rawPagoPlotagem = pagsTodos.filter(p => p.categoria === "plotagem").reduce((a, p) => a + p.valor, 0);
  const rawPagoLiderancas = pagsTodos.filter(p => p.categoria === "liderancas").reduce((a, p) => a + p.valor, 0);
  const rawPagoFiscais = pagsTodos.filter(p => p.categoria === "fiscais").reduce((a, p) => a + p.valor, 0);

  // Para retirada: cap pago no planejado (não pode pagar mais que o contratado)
  const categorias = [
    { key: "retirada", label: "Retirada", planejado: totais.retirada, pago: Math.min(rawPagoRetirada, totais.retirada), detalhe: `${fmt(retiradaMes)} × ${s.retirada_mensal_meses || 0}m`, qtd: retiradaMes, valorUnit: s.retirada_mensal_meses || 0, faltaMes: Math.max(0, retiradaMes - pagoRetiradaMesCap) },
    { key: "plotagem", label: "Plotagem", planejado: totais.plotagem, pago: rawPagoPlotagem, detalhe: `${s.plotagem_qtd || 0} × ${fmt(s.plotagem_valor_unit || 0)}`, qtd: s.plotagem_qtd || 0, valorUnit: s.plotagem_valor_unit || 0 },
    { key: "liderancas", label: "Lideranças", planejado: totais.liderancas, pago: rawPagoLiderancas, detalhe: `${s.liderancas_qtd || 0} × ${fmt(s.liderancas_valor_unit || 0)}`, qtd: s.liderancas_qtd || 0, valorUnit: s.liderancas_valor_unit || 0 },
    { key: "fiscais", label: "Fiscais", planejado: totais.fiscais, pago: rawPagoFiscais, detalhe: `${s.fiscais_qtd || 0} × ${fmt(s.fiscais_valor_unit || 0)}`, qtd: s.fiscais_qtd || 0, valorUnit: s.fiscais_valor_unit || 0 },
  ].filter(c => c.planejado > 0 || c.qtd > 0);

  const handleSave = async (valor: number, obs: string, cat: string) => {
    // Para retirada: só 1 pagamento por mês
    if (cat === "retirada") {
      const jaExiste = pagsMes.some(p => p.categoria === "retirada");
      if (jaExiste) {
        toast({ title: "⚠️ Já existe pagamento de Retirada neste mês", description: "Apague o existente antes de inserir outro.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const { error } = await (supabase as any).from("pagamentos").insert({
      tipo_pessoa: "suplente", suplente_id: s.id, mes, ano,
      categoria: cat, valor, observacao: obs || null,
    });
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: `✅ ${fmt(valor)} registrado para ${s.nome}` }); qc.invalidateQueries({ queryKey: ["pagamentos"] }); setPaying(false); }
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
            <p className="font-bold text-foreground text-sm truncate">{s.nome}</p>
            {s.numero_urna && (
              <p className="text-[10px] text-muted-foreground truncate">Urna: <span className="font-semibold">{s.numero_urna}</span></p>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {s.partido && <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">{s.partido}</span>}
              {(s.bairro || s.regiao_atuacao) && <span className="text-[11px] text-muted-foreground">📍 {s.bairro || s.regiao_atuacao}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            {pago ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{fmt(pagoMes || retiradaMes)}</span>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground">Falta</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmt(faltaMes)}</p>
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

      {/* Ações */}
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

          {/* Total campanha */}
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

// ─── Card simples: Liderança / Admin ──────────────────────────────────────────
function PessoaPayCard({ tipo, id, nome, subtitulo, valorEsperado, pagsMes, mes, ano, createdAt }: {
  tipo: "lideranca" | "admin"; id: string; nome: string; subtitulo?: string;
  valorEsperado: number; pagsMes: Pagamento[]; mes: number; ano: number; createdAt?: string;
}) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const totalPagoRaw = pagsMes.reduce((a, p) => a + p.valor, 0);
  const totalPago = Math.min(totalPagoRaw, valorEsperado); // Cap no valor esperado
  const faltando = Math.max(0, valorEsperado - totalPago);
  const isPago = totalPago >= valorEsperado;
  const catPadrao = tipo === "lideranca" ? "retirada" : "salario";

  const handleSave = async (valor: number, obs: string) => {
    // Só 1 pagamento de retirada/salário por mês
    const jaExiste = pagsMes.some(p => p.categoria === catPadrao);
    if (jaExiste) {
      toast({ title: `⚠️ Já existe pagamento de ${catPadrao === "retirada" ? "Retirada" : "Salário"} neste mês`, description: "Apague o existente antes de inserir outro.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = { tipo_pessoa: tipo, mes, ano, categoria: catPadrao, valor, observacao: obs || null };
    if (tipo === "lideranca") payload.lideranca_id = id;
    else payload.admin_id = id;
    const { error } = await (supabase as any).from("pagamentos").insert(payload);
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: `✅ ${fmt(valor)} registrado!` }); qc.invalidateQueries({ queryKey: ["pagamentos"] }); setPaying(false); }
  };

  const handleDelete = async (pagId: string) => {
    if (!confirm("Excluir pagamento?")) return;
    const { error } = await supabase.from("pagamentos").delete().eq("id", pagId);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    toast({ title: "✅ Pagamento excluído" });
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  };

  return (
    <div className={`bg-card rounded-2xl border shadow-sm overflow-hidden ${isPago ? "border-green-500/20" : "border-amber-500/30"}`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground text-sm truncate">{nome}</p>
            {subtitulo && <p className="text-[11px] text-muted-foreground truncate">{subtitulo}</p>}
          </div>
          <div className="text-right shrink-0">
            {isPago ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{fmt(totalPago)}</span>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground">Falta</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmt(faltando)}</p>
              </>
            )}
          </div>
        </div>
        {!isPago && totalPago > 0 && (
          <div className="mt-2">
            <Bar pago={totalPago} total={valorEsperado} cor="bg-amber-500" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>Pago: {fmt(totalPago)}</span>
              <span>Total: {fmt(valorEsperado)}</span>
            </div>
          </div>
        )}
        {createdAt && <p className="text-[10px] text-muted-foreground mt-1">Cadastro: {new Date(createdAt).toLocaleDateString("pt-BR")}</p>}
      </div>

      <div className="flex border-t border-border/30 divide-x divide-border/30">
        <button onClick={() => { setPaying(!paying); setShowHist(false); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold ${!isPago ? "text-white bg-gradient-to-r from-pink-500 to-rose-400" : "text-primary hover:bg-primary/5"}`}>
          <DollarSign size={12} /> {isPago ? "+ Extra" : "Pagar"}
        </button>
        {pagsMes.length > 0 && (
          <button onClick={() => { setShowHist(!showHist); setPaying(false); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:bg-muted/20">
            {pagsMes.length} pag. {showHist ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {paying && (
        <div className="p-3 border-t border-border/30">
          <PayForm
            pessoaNome={nome}
            categorias={[{ key: catPadrao, label: tipo === "lideranca" ? "Retirada" : "Salário", planejado: valorEsperado, pago: totalPago, detalhe: `${fmt(valorEsperado)}/mês`, qtd: valorEsperado, valorUnit: 1 }]}
            onSave={(v, o) => handleSave(v, o)}
            onCancel={() => setPaying(false)}
            saving={saving}
          />
        </div>
      )}
      {showHist && (
        <div className="bg-muted/10 border-t border-border/30 divide-y divide-border/20">
          {pagsMes.map(p => <HistoricoItem key={p.id} p={p} onDelete={handleDelete} />)}
        </div>
      )}
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
  const [mes, setMes] = useState(Math.max(now.getMonth() + 1, 3));
  const [ano, setAno] = useState(now.getFullYear());
  const [abaAtiva, setAbaAtiva] = useState<"suplentes" | "liderancas" | "admin">("suplentes");
  const [busca, setBusca] = useState("");
  const [showPagos, setShowPagos] = useState(true);
  const [showAlertaAtraso, setShowAlertaAtraso] = useState(false);
  const [alertaDismissed, setAlertaDismissed] = useState(false);
  const { cidadeAtiva: cidadeGlobal, municipios, isAdmin } = useCidade();
  const cidadeAtiva = cidadeGlobal;

  const { data: suplentes, isLoading: loadS } = useQuery({
    queryKey: ["suplentes", cidadeAtiva],
    queryFn: async () => {
      let query = (supabase as any).from("suplentes").select(
        "id,nome,numero_urna,bairro,regiao_atuacao,partido,base_politica,retirada_mensal_valor,retirada_mensal_meses,plotagem_qtd,plotagem_valor_unit,liderancas_qtd,liderancas_valor_unit,fiscais_qtd,fiscais_valor_unit,total_campanha,created_at,municipio_id"
      ).order("nome");
      if (cidadeAtiva) query = query.eq("municipio_id", cidadeAtiva);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Suplente[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });




  const { data: liderancas, isLoading: loadL } = useQuery({
    queryKey: ["liderancas", cidadeAtiva],
    queryFn: async () => {
      let query = (supabase as any).from("liderancas").select("id,nome,regiao,retirada_mensal_valor,chave_pix,created_at").order("nome");
      if (cidadeAtiva) query = query.eq("municipio_id", cidadeAtiva);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Lideranca[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: administrativo, isLoading: loadA } = useQuery({
    queryKey: ["administrativo", cidadeAtiva],
    queryFn: async () => {
      let query = (supabase as any).from("administrativo").select("id,nome,whatsapp,valor_contrato,created_at").order("nome");
      if (cidadeAtiva) query = query.eq("municipio_id", cidadeAtiva);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AdminPessoa[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: pagamentos, isLoading: loadP } = useQuery({
    queryKey: ["pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Pagamento[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const isLoading = loadS || loadL || loadA || loadP;
  const MES_MIN_GLOBAL = 3; // Março é o primeiro mês de referência
  const MES_MAX_GLOBAL = 10; // Outubro é o último mês de referência
  const navMes = (dir: -1 | 1) => {
    let m = mes + dir, a = ano;
    if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; }
    if (a === 2026 && m < MES_MIN_GLOBAL) { m = MES_MIN_GLOBAL; }
    if (a === 2026 && m > MES_MAX_GLOBAL) { m = MES_MAX_GLOBAL; }
    setMes(m); setAno(a);
  };

  const pagsMes = (pagamentos || []).filter(p => p.mes === mes && p.ano === ano);

  // Filtra por mês inicial individual: considera created_at de cada pessoa
  // Todos os suplentes elegíveis aparecem (mesmo sem retirada configurada — mostram como pago R$0)
  const supComValor = (suplentes || []).filter(s => mes >= getMesInicioComHistorico({
    tipo: "suplente",
    pessoaId: s.id,
    createdAt: s.created_at,
    mesInicioGlobal: MES_INICIO_SUPLENTES,
    pagamentos: pagamentos || [],
    categoria: "retirada",
  }));
  const lidComValor = (liderancas || []).filter(l => mes >= getMesInicioComHistorico({
    tipo: "lideranca",
    pessoaId: l.id,
    createdAt: l.created_at,
    mesInicioGlobal: MES_INICIO_LIDERANCAS,
    pagamentos: pagamentos || [],
    categoria: "retirada",
  }));
  const admComValor = (administrativo || []).filter(a => mes >= getMesInicioComHistorico({
    tipo: "admin",
    pessoaId: a.id,
    createdAt: a.created_at,
    mesInicioGlobal: MES_INICIO_ADMIN,
    pagamentos: pagamentos || [],
    categoria: "salario",
  }));

  const supPlanejado = supComValor.reduce((a, s) => a + (s.retirada_mensal_valor || 0), 0);
  const lidPlanejado = lidComValor.reduce((a, l) => a + (l.retirada_mensal_valor || 0), 0);
  const admPlanejado = admComValor.reduce((a, p) => a + (p.valor_contrato || 0), 0);
  const totalPlanejado = supPlanejado + lidPlanejado + admPlanejado;

  const supIds = new Set(supComValor.map(s => s.id));
  const lidIds = new Set(lidComValor.map(l => l.id));
  const admIds = new Set(admComValor.map(a => a.id));
  // Para retiradas/salários, cap pago no planejado por pessoa (não pode mostrar mais pago que planejado)
  const supPago = supComValor.reduce((a, s) => {
    const p = pagsMes.filter(p => p.suplente_id === s.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.min(p, s.retirada_mensal_valor || 0);
  }, 0);
  const lidPago = lidComValor.reduce((a, l) => {
    const p = pagsMes.filter(p => p.lideranca_id === l.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.min(p, l.retirada_mensal_valor || 0);
  }, 0);
  const admPago = admComValor.reduce((a, ad) => {
    const p = pagsMes.filter(p => p.admin_id === ad.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.min(p, ad.valor_contrato || 0);
  }, 0);
  const totalPago = supPago + lidPago + admPago;

  // Calcular "falta" por pessoa (não permite que excesso de um compense falta de outro)
  const supFaltaReal = supComValor.reduce((a, s) => {
    const pago = pagsMes.filter(p => p.suplente_id === s.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (s.retirada_mensal_valor || 0) - pago);
  }, 0);
  const lidFaltaReal = lidComValor.reduce((a, l) => {
    const pago = pagsMes.filter(p => p.lideranca_id === l.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (l.retirada_mensal_valor || 0) - pago);
  }, 0);
  const admFaltaReal = admComValor.reduce((a, ad) => {
    const pago = pagsMes.filter(p => p.admin_id === ad.id).reduce((acc, p) => acc + p.valor, 0);
    return a + Math.max(0, (ad.valor_contrato || 0) - pago);
  }, 0);
  const totalFalta = supFaltaReal + lidFaltaReal + admFaltaReal;
  const pctGeral = totalPlanejado > 0 ? Math.min(100, ((totalPlanejado - totalFalta) / totalPlanejado) * 100) : 0;

  // Contagens pagos
  const supPagosN = supComValor.filter(s => pagsMes.filter(p => p.suplente_id === s.id).reduce((a, p) => a + p.valor, 0) >= (s.retirada_mensal_valor || 0)).length;
  const lidPagosN = lidComValor.filter(l => pagsMes.filter(p => p.lideranca_id === l.id).reduce((a, p) => a + p.valor, 0) >= (l.retirada_mensal_valor || 0)).length;
  const admPagosN = admComValor.filter(a => pagsMes.filter(p => p.admin_id === a.id).reduce((a2, p) => a2 + p.valor, 0) >= (a.valor_contrato || 0)).length;

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
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-pink-500 bg-pink-500/10 flex items-center gap-1"><List size={10} />Suplentes</span>
                {supPagosN}/{supComValor.length} pagos
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-foreground">{fmt(supPago)} / {fmt(supPlanejado)}</span>
            </div>
            <Bar pago={supPago} total={supPlanejado} cor="bg-pink-500" />
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
                  mes={mes} ano={ano} />
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
                  mes={mes} ano={ano} />
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
                  mes={mes} ano={ano} createdAt={l.created_at} />
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
                  mes={mes} ano={ano} createdAt={l.created_at} />
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

    // Admin
    const filtrados = admComValor.filter(a => matchBusca(a.nome, a.whatsapp || ""));
    const pendentes = filtrados.filter(a => pagsMes.filter(p => p.admin_id === a.id).reduce((acc, p) => acc + p.valor, 0) < (a.valor_contrato || 0));
    const pagos = filtrados.filter(a => pagsMes.filter(p => p.admin_id === a.id).reduce((acc, p) => acc + p.valor, 0) >= (a.valor_contrato || 0));

    return (
      <>
        <div className="bg-card rounded-xl border border-border p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-blue-500 bg-blue-500/10 flex items-center gap-1"><Briefcase size={10} />Admin</span>
                {admPagosN}/{admComValor.length} pagos
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-foreground">{fmt(admPago)} / {fmt(admPlanejado)}</span>
            </div>
          <Bar pago={admPago} total={admPlanejado} cor="bg-blue-500" />
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
                mes={mes} ano={ano} createdAt={a.created_at} />
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
                mes={mes} ano={ano} createdAt={a.created_at} />
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
  };

  const abas = [
    { id: "suplentes" as const, label: "Suplentes", icon: <List size={12} />, count: supComValor.length, pagos: supPagosN },
    { id: "liderancas" as const, label: "Lideranças", icon: <Users size={12} />, count: lidComValor.length, pagos: lidPagosN },
    { id: "admin" as const, label: "Admin", icon: <Briefcase size={12} />, count: admComValor.length, pagos: admPagosN },
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
                  {supAtrasados.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-pink-500 mb-1">Suplentes ({supAtrasados.length})</p>
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
                  {lidAtrasados.length > 0 && (
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

        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-foreground">Pagamentos</h1>
        </div>

        {/* Painel financeiro geral */}
        {!isLoading && (
          <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-2 text-white/80 text-xs mb-3">
              <Wallet size={14} /> Painel Financeiro — {MESES[mes - 1]}/{ano}
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              <div className="bg-white/15 backdrop-blur rounded-xl p-2 text-center min-w-0">
                <p className="text-white/70 text-[8px] uppercase tracking-wider font-medium">Planejado</p>
                <p className="text-white font-bold text-xs sm:text-base leading-tight truncate">{fmt(totalPlanejado)}</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-xl p-2 text-center min-w-0">
                <p className="text-white/70 text-[8px] uppercase tracking-wider font-medium">Pago</p>
                <p className="text-white font-bold text-xs sm:text-base leading-tight truncate">{fmt(totalPago)}</p>
              </div>
              <div className="bg-black/20 backdrop-blur rounded-xl p-2 text-center min-w-0">
                <p className="text-white/70 text-[8px] uppercase tracking-wider font-medium">Falta</p>
                <p className="text-white font-bold text-xs sm:text-base leading-tight truncate">{fmt(totalFalta)}</p>
              </div>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pctGeral}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-white/60 text-[9px]">{supPagosN + lidPagosN + admPagosN} pagos · {(supComValor.length + lidComValor.length + admComValor.length) - (supPagosN + lidPagosN + admPagosN)} pendentes</span>
              <span className="text-white/60 text-[9px]">{pctGeral.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Painel Outros Gastos: Plotagem + Lideranças + Fiscais (filtrado por mês de cadastro) */}
        {!isLoading && (() => {
          // Só mostra suplentes que recebem retirada E estão elegíveis neste mês
          const sups = (suplentes || []).filter(s => 
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

        {/* Tabs: Suplentes / Lideranças / Admin */}
        <div className="flex bg-muted rounded-xl p-1 gap-1">
          {abas.map(a => (
            <button key={a.id} onClick={() => { setAbaAtiva(a.id); setShowPagos(true); }}
              className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-2 rounded-lg transition-all ${abaAtiva === a.id ? "bg-card shadow text-primary" : "text-muted-foreground"}`}>
              {a.icon}{a.label}
              <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ml-0.5 ${abaAtiva === a.id ? "bg-primary/10 text-primary" : "bg-muted-foreground/20"}`}>{a.count}</span>
            </button>
          ))}
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
