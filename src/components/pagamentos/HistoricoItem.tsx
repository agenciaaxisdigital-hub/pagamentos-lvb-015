import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pencil, Trash2 } from "lucide-react";

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CAT_LABEL: Record<string, string> = {
  retirada: "Retirada Mensal",
  plotagem: "Plotagem",
  liderancas: "Lideranças",
  fiscais: "Fiscais",
  salario: "Salário",
  outro: "Outro",
};

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

interface HistoricoItemProps {
  p: Pagamento;
  onDelete: (id: string) => void;
}

export function HistoricoItem({ p, onDelete }: HistoricoItemProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(p.valor));
  const [obs, setObs] = useState(p.observacao || "");
  const [dataPagamento, setDataPagamento] = useState(() => {
    return p.created_at ? p.created_at.substring(0, 10) : "";
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!v) return;
    setSaving(true);
    const createdAtVal = dataPagamento ? new Date(dataPagamento + "T12:00:00").toISOString() : p.created_at;
    const { error } = await supabase.from("pagamentos").update({ 
      valor: v, 
      observacao: obs || null,
      created_at: createdAtVal
    }).eq("id", p.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Atualizado!" });
    qc.setQueriesData<Pagamento[]>({ queryKey: ["pagamentos"] }, (old) =>
      Array.isArray(old) ? old.map(item => item.id === p.id ? { ...item, valor: v, observacao: obs || null, created_at: createdAtVal } : item) : (old ?? [])
    );
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  };

  if (editing) return (
    <div className="px-3 py-2.5 space-y-2 bg-muted/25 border-y border-border/30">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Valor (R$)</p>
          <Input type="number" value={valor} onChange={e => setValor(e.target.value)} className="h-8 text-xs bg-card font-bold" />
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Data do Pagamento</p>
          <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} className="h-8 text-[11px] bg-card" />
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">Observação</p>
          <Input value={obs} onChange={e => setObs(e.target.value)} className="h-8 text-xs bg-card" placeholder="Opcional" />
        </div>
      </div>
      <div className="flex gap-1.5 pt-1">
        <Button size="sm" className="h-7 text-[10px] flex-1 bg-gradient-to-r from-slate-700 to-slate-500 text-white font-bold" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={10} className="animate-spin mr-1" /> : "Salvar Alterações"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-3 border border-border" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
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
