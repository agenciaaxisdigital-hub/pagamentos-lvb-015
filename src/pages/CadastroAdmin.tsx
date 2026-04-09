import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, ArrowLeft, PenLine, Trash2, FileDown, MapPin } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import SignaturePad from "@/components/SignaturePad";
import { exportAdminPDF } from "@/lib/exports";
import { useCidade } from "@/contexts/CidadeContext";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface FormData {
  nome: string;
  cpf: string;
  whatsapp: string;
  valor_contrato: number;
  contrato_ate_mes: number;
  assinatura: string;
}

const defaultForm: FormData = {
  nome: "",
  cpf: "",
  whatsapp: "",
  valor_contrato: 0,
  contrato_ate_mes: 9,
  assinatura: "",
};

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CadastroAdmin() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { cidadeAtiva, municipios } = useCidade();
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(cidadeAtiva || "");
  const [showSignature, setShowSignature] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["admin_pessoa", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("administrativo").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<FormData>(defaultForm);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  if (existing && !initialized) {
    setForm({
      nome: existing.nome || "",
      cpf: existing.cpf || "",
      whatsapp: existing.whatsapp || "",
      valor_contrato: existing.valor_contrato || 0,
      contrato_ate_mes: existing.contrato_ate_mes || 9,
      assinatura: existing.assinatura || "",
    });
    setSelectedMunicipio(existing.municipio_id || cidadeAtiva || "");
    setInitialized(true);
  }

  const set = (key: keyof FormData, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = { ...form, updated_at: new Date().toISOString() };
    payload.municipio_id = selectedMunicipio || cidadeAtiva || null;
    let error;
    if (id) {
      ({ error } = await (supabase as any).from("administrativo").update(payload).eq("id", id));
    } else {
      ({ error } = await (supabase as any).from("administrativo").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: id ? "Atualizado!" : "Funcionário cadastrado!" });
      qc.invalidateQueries({ queryKey: ["administrativo"] });
      navigate("/administrativo");
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" /></div>;

  const totalContrato = (form.valor_contrato || 0) * (form.contrato_ate_mes || 0);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/administrativo")} className="p-1.5 rounded-xl text-muted-foreground active:bg-muted">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-foreground">{id ? "Editar Funcionário" : "Novo Funcionário"}</h1>
          </div>
          {id && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => exportAdminPDF({ ...form, id })}>
              <FileDown size={14} /> PDF
            </Button>
          )}
        </div>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <MapPin size={16} /> Cidade
          </h2>
          <Field label="Município" required>
            <Select value={selectedMunicipio || ""} onValueChange={setSelectedMunicipio}>
              <SelectTrigger className="bg-card shadow-sm border-border"><SelectValue placeholder="Selecione a cidade" /></SelectTrigger>
              <SelectContent>
                {municipios.map(m => (
                  <SelectItem key={m.id} value={m.id}>📍 {m.nome} — {m.uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Dados do Funcionário</h2>

          <Field label="Nome" required>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome completo" className="bg-card shadow-sm border-border" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF">
              <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" inputMode="numeric" className="bg-card shadow-sm border-border" />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(62) 99999-9999" inputMode="tel" className="bg-card shadow-sm border-border" />
            </Field>
          </div>
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Valor do Contrato</h2>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor Mensal (R$)" required>
              <Input
                type="number" inputMode="numeric"
                value={form.valor_contrato || ""}
                onChange={(e) => set("valor_contrato", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="bg-card shadow-sm border-border"
              />
            </Field>
            <Field label="Contrato até (mês)">
              <Select value={String(form.contrato_ate_mes)} onValueChange={(v) => set("contrato_ate_mes", parseInt(v))}>
                <SelectTrigger className="bg-card shadow-sm border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="space-y-2 bg-primary/5 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Salário / Contrato</span>
              <span className="text-base font-bold text-primary">{fmt(form.valor_contrato)}/mês</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Até {MESES[(form.contrato_ate_mes || 9) - 1]} ({form.contrato_ate_mes} meses)</span>
              <span className="font-bold text-foreground">Total: {fmt(totalContrato)}</span>
            </div>
          </div>
        </section>

        {/* Assinatura */}
        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Assinatura</h2>
          {form.assinatura ? (
            <div className="space-y-2">
              <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-center">
                <img src={form.assinatura} alt="Assinatura" className="max-h-20 object-contain" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => setShowSignature(true)}>
                  <PenLine size={13} /> Refazer
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive" onClick={() => set("assinatura", "")}>
                  <Trash2 size={13} /> Remover
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full h-20 border-dashed gap-2 text-muted-foreground" onClick={() => setShowSignature(true)}>
              <PenLine size={18} /> Toque para assinar
            </Button>
          )}
        </section>

        <SignaturePad
          open={showSignature}
          onClose={() => setShowSignature(false)}
          onSave={(dataUrl) => set("assinatura", dataUrl)}
          initial={form.assinatura || undefined}
        />

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-90 text-white font-semibold h-12 text-base shadow-lg active:scale-[0.98] transition-transform"
        >
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {saving ? "Salvando..." : id ? "Atualizar Funcionário" : "Salvar Funcionário"}
        </Button>
      </div>
    </PageTransition>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
