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
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = parseFloat(valor.replace(",", "."));
    if (!v) return;
    setSaving(true);
    const { error } = await supabase.from("pagamentos").update({ valor: v, observacao: obs || null }).eq("id", p.id);
    setSaving(true);
    if (!error) {
      toast({ title: "Atualizado!" });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      setEditing(false);
    }
    setSaving(false);
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
