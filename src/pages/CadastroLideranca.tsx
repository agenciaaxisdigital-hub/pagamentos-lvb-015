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
import { exportLiderancaPDF } from "@/lib/exports";
import { useCidade } from "@/contexts/CidadeContext";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface FormData {
  nome: string;
  cpf: string;
  regiao: string;
  whatsapp: string;
  rede_social: string;
  ligacao_politica: string;
  retirada_mensal_valor: number;
  retirada_ate_mes: number;
  chave_pix: string;
  assinatura: string;
}

const defaultForm: FormData = {
  nome: "",
  cpf: "",
  regiao: "",
  whatsapp: "",
  rede_social: "",
  ligacao_politica: "",
  retirada_mensal_valor: 0,
  retirada_ate_mes: 9,
  chave_pix: "",
  assinatura: "",
};

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CadastroLideranca() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { cidadeAtiva, municipios } = useCidade();
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(cidadeAtiva || "");
  const [showSignature, setShowSignature] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["lideranca", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("liderancas").select("*").eq("id", id!).single();
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
      regiao: existing.regiao || "",
      whatsapp: existing.whatsapp || "",
      rede_social: existing.rede_social || "",
      ligacao_politica: existing.ligacao_politica || "",
      retirada_mensal_valor: existing.retirada_mensal_valor || 0,
      retirada_ate_mes: existing.retirada_ate_mes || 9,
      chave_pix: existing.chave_pix || "",
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
    // Regra: primeiro pagamento só no mês seguinte ao cadastro
    if (!id) {
      const mesAtual = new Date().getMonth() + 1; // 1-12
      payload.retirada_mensal_meses = Math.max(1, 9 - mesAtual);
    }
    let error;
    if (id) {
      ({ error } = await (supabase as any).from("liderancas").update(payload).eq("id", id));
    } else {
      ({ error } = await (supabase as any).from("liderancas").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: id ? "Atualizado!" : "Liderança cadastrada!" });
      qc.invalidateQueries({ queryKey: ["liderancas"] });
      navigate("/liderancas");
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" /></div>;

  const totalContrato = (form.retirada_mensal_valor || 0) * (form.retirada_ate_mes || 0);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/liderancas")} className="p-1.5 rounded-xl text-muted-foreground active:bg-muted">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-foreground">{id ? "Editar Liderança" : "Nova Liderança"}</h1>
          </div>
          {id && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => exportLiderancaPDF({ ...form, id })}>
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
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Dados da Liderança</h2>

          <Field label="Nome" required>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome completo" className="bg-card shadow-sm border-border" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF">
              <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" inputMode="numeric" className="bg-card shadow-sm border-border" />
            </Field>
            <Field label="Setor">
              <Input value={form.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder="Ex: Setor 1" className="bg-card shadow-sm border-border" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp">
              <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(62) 99999-9999" inputMode="tel" className="bg-card shadow-sm border-border" />
            </Field>
            <Field label="Rede Social">
              <Input value={form.rede_social} onChange={(e) => set("rede_social", e.target.value)} placeholder="@usuario" className="bg-card shadow-sm border-border" />
            </Field>
          </div>

          <Field label="Ligação Política / Cargo">
            <Input value={form.ligacao_politica} onChange={(e) => set("ligacao_politica", e.target.value)} placeholder="Ex: Presidente de Bairro, Cabo Eleitoral..." className="bg-card shadow-sm border-border" />
          </Field>
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Retirada Mensal</h2>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor Mensal (R$)">
              <Input
                type="number" inputMode="numeric"
                value={form.retirada_mensal_valor || ""}
                onChange={(e) => set("retirada_mensal_valor", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="bg-card shadow-sm border-border"
              />
            </Field>
            <Field label="Retirada até (mês)">
              <Select value={String(form.retirada_ate_mes)} onValueChange={(v) => set("retirada_ate_mes", parseInt(v))}>
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
              <span className="text-sm font-semibold text-foreground">Retirada Mensal</span>
              <span className="text-base font-bold text-primary">{fmt(form.retirada_mensal_valor)}/mês</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Até {MESES[(form.retirada_ate_mes || 9) - 1]} ({form.retirada_ate_mes} meses)</span>
              <span className="font-bold text-foreground">Total: {fmt(totalContrato)}</span>
            </div>
          </div>

          <Field label="Chave PIX">
            <Input value={form.chave_pix} onChange={(e) => set("chave_pix", e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" className="bg-card shadow-sm border-border" />
          </Field>
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
          {saving ? "Salvando..." : id ? "Atualizar Liderança" : "Salvar Liderança"}
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
