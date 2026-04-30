import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronDown, ChevronUp, DollarSign, Users } from "lucide-react";
import { PayForm } from "./PayForm";
import { HistoricoItem } from "./HistoricoItem";

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

interface PessoaPayCardProps {
  tipo: "lideranca" | "admin";
  id: string;
  nome: string;
  subtitulo?: string;
  valorEsperado: number;
  pagsMes: Pagamento[];
  mes: number;
  ano: number;
  createdAt?: string;
  suplente_id?: string | null;
  lideranca_vinculada_id?: string | null;
  nomesMap?: Record<string, string>;
}

export function PessoaPayCard({ tipo, id, nome, subtitulo, valorEsperado, pagsMes, mes, ano, createdAt, suplente_id, lideranca_vinculada_id, nomesMap }: PessoaPayCardProps) {
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const totalPagoRaw = pagsMes.reduce((a, p) => a + p.valor, 0);
  const totalPago = Math.min(totalPagoRaw, valorEsperado);
  const faltando = Math.max(0, valorEsperado - totalPago);
  const isPago = totalPago >= valorEsperado;
  const catPadrao = tipo === "lideranca" ? "retirada" : "salario";

  const handleSave = async (valor: number, obs: string) => {
    if (saving) return;

    const jaExiste = pagsMes.some(p => p.categoria === catPadrao);
    if (jaExiste) {
      toast({ title: `⚠️ Já existe pagamento de ${catPadrao === "retirada" ? "Retirada" : "Salário"} neste mês`, description: "Apague o existente antes de inserir outro.", variant: "destructive" });
      return;
    }
    setSaving(true);
    
    const payload: Record<string, any> = { 
      tipo_pessoa: tipo, 
      mes, 
      ano, 
      categoria: catPadrao, 
      valor, 
      observacao: obs || null 
    };
    
    if (tipo === "lideranca") payload.lideranca_id = id;
    else payload.admin_id = id;
    
    const { execOnlineOrEnqueue } = await import("@/lib/offlineFallback");

    await execOnlineOrEnqueue(
      () => supabase.from("pagamentos").insert(payload),
      {
        action: 'INSERT',
        table: 'pagamentos',
        payload,
        onSuccess: () => {
          toast({ title: `✅ ${fmt(valor)} registrado!` });
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
    <div className={`bg-card rounded-2xl border shadow-sm overflow-hidden ${isPago ? "border-green-500/20" : "border-amber-500/30"}`}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground text-sm text-wrap-anywhere">{nome}</p>
            {subtitulo && <p className="text-[11px] text-muted-foreground text-wrap-anywhere">{subtitulo}</p>}
            
            {suplente_id && nomesMap?.[suplente_id] && (
              <div className="flex items-center gap-1 mt-1">
                <Users size={10} className="text-pink-500/60" />
                <span className="text-[10px] text-pink-500/80 font-medium text-wrap-anywhere">
                  Suplente: {nomesMap[suplente_id]}
                </span>
              </div>
            )}

            {lideranca_vinculada_id && nomesMap?.[lideranca_vinculada_id] && (
              <div className="flex items-center gap-1 mt-0.5">
                <Users size={10} className="text-violet-500/60" />
                <span className="text-[10px] text-violet-500/80 font-medium text-wrap-anywhere">
                  Vínculo: {nomesMap[lideranca_vinculada_id]}
                </span>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            {isPago ? (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={14} className="text-green-500" />
                <span className="text-sm font-bold text-green-600 dark:text-green-400 numeric-compact">{fmt(totalPago)}</span>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground">Falta</p>
                <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 numeric-compact">{fmt(faltando)}</p>
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
