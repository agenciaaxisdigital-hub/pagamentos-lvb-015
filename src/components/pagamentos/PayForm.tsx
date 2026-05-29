import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Loader2, Pencil, Save, X } from "lucide-react";

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Bar({ pago, total, cor = "bg-primary", height = "h-1.5" }: { pago: number; total: number; cor?: string; height?: string }) {
  const pct = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
  return (
    <div className={`${height} bg-muted rounded-full overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-500 ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const CAT_FIELDS: Record<string, { qtdField: string; valField: string } | { valField: string; mesesField: string }> = {
  retirada: { valField: "retirada_mensal_valor", mesesField: "retirada_mensal_meses" },
  plotagem: { qtdField: "plotagem_qtd", valField: "plotagem_valor_unit" },
  liderancas: { qtdField: "liderancas_qtd", valField: "liderancas_valor_unit" },
  fiscais: { qtdField: "fiscais_qtd", valField: "fiscais_valor_unit" },
};

interface Categoria {
  key: string;
  label: string;
  planejado: number;
  pago: number;
  detalhe: string;
  qtd: number;
  valorUnit: number;
  faltaMes?: number;
}

interface PayFormProps {
  pessoaNome: string;
  categorias: Categoria[];
  onSave: (valor: number, obs: string, cat: string, dataPagamento?: string) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  suplenteId?: string;
  onFieldsUpdated?: () => void;
}

export function PayForm({ pessoaNome, categorias, onSave, onCancel, saving, suplenteId, onFieldsUpdated }: PayFormProps) {
  const [cat, setCat] = useState(categorias[0]?.key || "retirada");
  const catAtual = categorias.find(c => c.key === cat) || categorias[0];
  const faltaCat = catAtual
    ? (catAtual.faltaMes != null ? catAtual.faltaMes : Math.max(0, catAtual.planejado - catAtual.pago))
    : 0;
  const [valor, setValor] = useState(faltaCat > 0 ? String(faltaCat) : "");
  const [obs, setObs] = useState("");
  const [dataPagamento, setDataPagamento] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const valorNum = parseFloat(valor.replace(",", ".")) || 0;

  const [editCat, setEditCat] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState("");
  const [editVal, setEditVal] = useState("");
  const [savingFields, setSavingFields] = useState(false);
  const savingFieldsRef = useRef(false);

  const handleCatChange = (newCat: string) => {
    setCat(newCat);
    const c = categorias.find(x => x.key === newCat);
    if (c) {
      const f = c.faltaMes != null ? c.faltaMes : Math.max(0, c.planejado - c.pago);
      setValor(f > 0 ? String(f) : "");
    }
  };

  const startEdit = (c: Categoria) => {
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
    if (!suplenteId || savingFieldsRef.current) return;
    const fields = CAT_FIELDS[catKey];
    if (!fields) return;
    savingFieldsRef.current = true;
    setSavingFields(true);
    try {
      const update: Record<string, number> = {};
      if ("qtdField" in fields) {
        update[fields.qtdField] = parseInt(editQtd) || 0;
        update[fields.valField] = parseFloat(editVal.replace(",", ".")) || 0;
      } else {
        update[fields.valField] = parseFloat(editVal.replace(",", ".")) || 0;
        update[fields.mesesField] = parseInt(editQtd) || 0;
      }
      const { error } = await supabase.from("suplentes").update(update).eq("id", suplenteId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Valores atualizados!" });
      setEditCat(null);
      onFieldsUpdated?.();
    } finally {
      savingFieldsRef.current = false;
      setSavingFields(false);
    }
  };

  const totalPlanejado = categorias.reduce((a, c) => a + c.planejado, 0);
  const totalPago = categorias.reduce((a, c) => a + c.pago, 0);
  const totalFalta = categorias.reduce((a, c) => a + Math.max(0, c.planejado - c.pago), 0);

  return (
    <div className="bg-card rounded-2xl border border-primary/30 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-wider">Registrar Pagamento</p>
          <p className="text-sm font-semibold text-foreground text-wrap-anywhere">{pessoaNome}</p>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground p-1"><X size={16} /></button>
      </div>

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
                        <Input type="number" inputMode="decimal" min="0" value={c.key === "retirada" ? editVal : editQtd}
                          onChange={e => c.key === "retirada" ? setEditVal(e.target.value) : setEditQtd(e.target.value)}
                          className="h-8 text-xs bg-card font-bold" />
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-0.5">
                          {c.key === "retirada" ? "Meses" : "Valor Unitário (R$)"}
                        </p>
                        <Input type="number" inputMode="decimal" min="0" value={c.key === "retirada" ? editQtd : editVal}
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

      {categorias.length > 1 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
            Pagando: {categorias.find(c => c.key === cat)?.label}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Valor (R$)</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
            <Input type="number" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
              className="pl-8 h-11 text-base font-bold bg-card border-primary/40" placeholder="0,00" />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Data do Pagamento</p>
          <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} className="h-11 bg-card text-xs font-medium" />
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

      <Button onClick={() => onSave(valorNum, obs, cat, dataPagamento)} disabled={saving || valorNum <= 0}
        className="w-full h-11 bg-gradient-to-r from-slate-700 to-slate-500 text-white font-bold text-sm touch-manipulation">
        {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
        {saving ? "Salvando..." : `Registrar ${fmt(valorNum)}`}
      </Button>
    </div>
  );
}
