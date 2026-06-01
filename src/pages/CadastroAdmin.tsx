import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { saveLocalVencimento, saveLocalAdminSuplente, saveLocalDataInicio, getLocalDataInicio, mergePausados, saveLocalAdminExtra } from "@/lib/pausadosFallback";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, ArrowLeft, PenLine, Trash2, FileDown, MapPin, FileText, Upload, X } from "lucide-react";
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
  valor_contrato_meses: number;
  assinatura: string;
  suplente_id: string | null;
  contrato_url: string | null;
  dia_vencimento: number;
  data_inicio: string;
  endereco: string;
  funcao: string;
}

const defaultForm: FormData = {
  nome: "",
  cpf: "",
  whatsapp: "",
  valor_contrato: 0,
  contrato_ate_mes: 10,
  valor_contrato_meses: 5,
  assinatura: "",
  suplente_id: null,
  contrato_url: null,
  dia_vencimento: 10,
  data_inicio: "",
  endereco: "",
  funcao: "",
};

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CadastroAdmin() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { cidadeAtiva, municipios } = useCidade();
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(cidadeAtiva || "");
  const [showSignature, setShowSignature] = useState(false);
  const [contratoDeMes, setContratoDeMesState] = useState<number>(6);

  const handleDeMesChange = (v: number) => {
    setContratoDeMesState(v);
    const meses = Math.max(1, form.contrato_ate_mes - v + 1);
    setForm((prev) => ({ ...prev, valor_contrato_meses: meses }));
  };

  const handleAteMesChange = (v: number) => {
    setForm((prev) => {
      let de = contratoDeMes;
      if (v < de) {
        de = v;
        setContratoDeMesState(v);
      }
      const meses = Math.max(1, v - de + 1);
      return { ...prev, contrato_ate_mes: v, valor_contrato_meses: meses };
    });
  };

  const { data: suplentes } = useQuery({
    queryKey: ["suplentes-select", selectedMunicipio || cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("suplentes").select("id, nome");
      if (selectedMunicipio || cidadeAtiva) {
        query = query.eq("municipio_id", selectedMunicipio || cidadeAtiva);
      }
      const { data, error } = await query;
      if (error) return [];
      return data;
    }
  });

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
  const savingRef = useRef(false);

  if (existing && !initialized) {
    const [merged] = mergePausados([existing], "admin");
    const mesFim = merged.contrato_ate_mes || 9;
    const meses = merged.valor_contrato_meses || 4;
    setContratoDeMesState(Math.max(3, mesFim - meses + 1));
    setForm({
      nome: merged.nome || "",
      cpf: merged.cpf || "",
      whatsapp: merged.whatsapp || "",
      valor_contrato: merged.valor_contrato || 0,
      contrato_ate_mes: mesFim,
      valor_contrato_meses: meses,
      assinatura: merged.assinatura || "",
      suplente_id: merged.suplente_id || null,
      contrato_url: merged.contrato_url || null,
      dia_vencimento: merged.dia_vencimento || 10,
      data_inicio: merged.data_inicio || "",
      endereco: (merged as any).endereco || "",
      funcao: (merged as any).funcao || "",
    });
    setSelectedMunicipio(merged.municipio_id || cidadeAtiva || "");
    setInitialized(true);
  }

  const set = (key: keyof FormData, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const { dia_vencimento, suplente_id, data_inicio, endereco, funcao, ...formClean } = form;
      const payload: any = { ...formClean, updated_at: new Date().toISOString() };
      payload.municipio_id = selectedMunicipio || cidadeAtiva || null;
      let error;
      if (id) {
        ({ error } = await (supabase as any).from("administrativo").update(payload).eq("id", id));
        if (!error) {
          saveLocalVencimento(id, form.dia_vencimento);
          saveLocalAdminSuplente(id, form.suplente_id);
          saveLocalDataInicio(id, form.data_inicio || null);
          saveLocalAdminExtra(id, { endereco: form.endereco, funcao: form.funcao });
        }
      } else {
        const { data, error: insertErr } = await (supabase as any).from("administrativo").insert(payload).select("id").maybeSingle();
        error = insertErr;
        if (!error && data?.id) {
          saveLocalVencimento(data.id, form.dia_vencimento);
          saveLocalAdminSuplente(data.id, form.suplente_id);
          saveLocalDataInicio(data.id, form.data_inicio || null);
          saveLocalAdminExtra(data.id, { endereco: form.endereco, funcao: form.funcao });
        }
      }
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: id ? "Atualizado!" : "Funcionário cadastrado!" });
        if (id) {
          qc.setQueriesData<any[]>({ queryKey: ["administrativo"] }, (old) =>
            Array.isArray(old) ? old.map(f => f.id === id ? { ...f, ...payload, id } : f) : (old ?? [])
          );
        } else {
          qc.setQueriesData<any[]>({ queryKey: ["administrativo"] }, (old) =>
            Array.isArray(old) ? [...old, { id: `opt-${Date.now()}`, ...payload }].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")) : (old ?? [])
          );
        }
        qc.invalidateQueries();
        navigate("/administrativo");
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" /></div>;

  const totalContrato = (form.valor_contrato || 0) * (form.valor_contrato_meses || 0);

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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de Início">
              <Input
                type="date"
                value={form.data_inicio || ""}
                onChange={(e) => set("data_inicio", e.target.value)}
                className="bg-card shadow-sm border-border"
              />
            </Field>
            <Field label="Função">
              <Input
                value={form.funcao}
                onChange={(e) => set("funcao", e.target.value)}
                placeholder="Ex: Coordenador"
                className="bg-card shadow-sm border-border"
              />
            </Field>
          </div>

          <Field label="Endereço">
            <Input
              value={form.endereco}
              onChange={(e) => set("endereco", e.target.value)}
              placeholder="Endereço completo"
              className="bg-card shadow-sm border-border"
            />
          </Field>

          <Field label="Vínculo com Suplente">
            <Select value={form.suplente_id || "none"} onValueChange={(v) => set("suplente_id", v === "none" ? null : v)}>
              <SelectTrigger className="bg-card shadow-sm border-border">
                <SelectValue placeholder="Selecione um suplente (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum vínculo</SelectItem>
                {(suplentes || []).map(s => (
                  <SelectItem key={s.id} value={s.id}>👤 {s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Valor do Contrato</h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Valor Mensal (R$)" required>
              <Input
                type="number" inputMode="numeric"
                value={form.valor_contrato || ""}
                onChange={(e) => set("valor_contrato", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="bg-card shadow-sm border-border"
              />
            </Field>
            <Field label="Início (mês)">
              <Select value={String(contratoDeMes)} onValueChange={(v) => handleDeMesChange(parseInt(v))}>
                <SelectTrigger className="bg-card shadow-sm border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Término (mês)">
              <Select value={String(form.contrato_ate_mes)} onValueChange={(v) => handleAteMesChange(parseInt(v))}>
                <SelectTrigger className="bg-card shadow-sm border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vencimento (dia)">
              <Select
                value={String(form.dia_vencimento || 10)}
                onValueChange={(v) => set("dia_vencimento", parseInt(v) || 10)}
              >
                <SelectTrigger className="bg-card shadow-sm border-border h-12 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
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
              <span>{MESES[contratoDeMes - 1]} a {MESES[(form.contrato_ate_mes || 9) - 1]} ({form.valor_contrato_meses} {form.valor_contrato_meses === 1 ? "mês" : "meses"})</span>
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
        
        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <FileText size={16} /> Contrato (PDF)
          </h2>
          
          {form.contrato_url ? (
            <div className="flex items-center justify-between bg-muted/30 rounded-xl p-3 border border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <FileText size={20} className="text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">Contrato_Anexado.pdf</p>
                  <a href={form.contrato_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary font-bold hover:underline">VISUALIZAR ARQUIVO</a>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => set("contrato_url", null)}>
                <X size={16} />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <input 
                type="file" 
                accept=".pdf" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast({ title: "Arquivo muito grande", description: "Máximo 5MB", variant: "destructive" });
                    return;
                  }
                  setSaving(true);
                  const fileExt = file.name.split('.').pop();
                  const fileName = `${Date.now()}.${fileExt}`;
                  const { data, error } = await supabase.storage.from('documentos').upload(`contratos/${fileName}`, file);
                  if (error) {
                    toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
                    setSaving(false);
                  } else {
                    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(data.path);
                    set("contrato_url", publicUrl);
                    setSaving(false);
                    toast({ title: "Arquivo anexado!" });
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              />
              <div className="w-full h-20 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-1 bg-muted/10">
                <Upload size={20} className="text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Clique para subir o PDF do contrato</p>
                <p className="text-[10px] text-muted-foreground">Tamanho máx: 5MB</p>
              </div>
            </div>
          )}
        </section>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-slate-700 to-slate-500 hover:opacity-90 text-white font-semibold h-12 text-base shadow-lg active:scale-[0.98] transition-transform touch-manipulation"
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
