import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Calculator, PenLine, Trash2, Loader2 } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import BuscaTSE from "@/components/BuscaTSE";
import { useCidade } from "@/contexts/CidadeContext";
import { MapPin } from "lucide-react";

interface FormData {
  municipio_id: string;
  nome: string;
  nome_urna: string;
  numero_urna: string;
  bairro: string;
  regiao_atuacao: string;
  telefone: string;
  cargo_disputado: string;
  ano_eleicao: number;
  partido: string;
  situacao: string;
  total_votos: number;
  expectativa_votos: number;
  base_politica: string;
  retirada_mensal_valor: number;
  retirada_mensal_meses: number;
  plotagem_qtd: number;
  plotagem_valor_unit: number;
  liderancas_qtd: number;
  liderancas_valor_unit: number;
  fiscais_qtd: number;
  fiscais_valor_unit: number;
  assinatura: string;
}

// Meses restantes até setembro (MES_FIM = 9), mínimo 1
const calcMesesRestantes = () => Math.max(1, 9 - (new Date().getMonth() + 1)); // getMonth()+1 → abr=4, 9-4=5

const defaultForm: FormData = {
  municipio_id: "",
  nome: "",
  nome_urna: "",
  numero_urna: "",
  bairro: "",
  regiao_atuacao: "",
  telefone: "",
  cargo_disputado: "Vereador",
  ano_eleicao: 2024,
  partido: "",
  situacao: "Suplente",
  total_votos: 0,
  expectativa_votos: 0,
  base_politica: "",
  retirada_mensal_valor: 0,
  retirada_mensal_meses: calcMesesRestantes(),
  plotagem_qtd: 0,
  plotagem_valor_unit: 250,
  liderancas_qtd: 0,
  liderancas_valor_unit: 1662,
  fiscais_qtd: 0,
  fiscais_valor_unit: 110,
  assinatura: "",
};

interface Props {
  initial?: FormData & { id?: string };
  onSaved?: () => void;
}

function buildFormState(initial?: Props["initial"]): FormData {
  return {
    ...defaultForm,
    ...initial,
    municipio_id: (initial as any)?.municipio_id ?? defaultForm.municipio_id,
    nome: initial?.nome ?? defaultForm.nome,
    nome_urna: initial?.nome_urna ?? defaultForm.nome_urna,
    numero_urna: initial?.numero_urna ?? defaultForm.numero_urna,
    bairro: initial?.bairro ?? defaultForm.bairro,
    regiao_atuacao: initial?.regiao_atuacao ?? defaultForm.regiao_atuacao,
    telefone: initial?.telefone ?? defaultForm.telefone,
    cargo_disputado: initial?.cargo_disputado ?? defaultForm.cargo_disputado,
    ano_eleicao: Number(initial?.ano_eleicao ?? defaultForm.ano_eleicao),
    partido: initial?.partido ?? defaultForm.partido,
    situacao: initial?.situacao ?? defaultForm.situacao,
    total_votos: Number(initial?.total_votos ?? defaultForm.total_votos),
    expectativa_votos: Number(initial?.expectativa_votos ?? defaultForm.expectativa_votos),
    base_politica: initial?.base_politica ?? defaultForm.base_politica,
    retirada_mensal_valor: Number(initial?.retirada_mensal_valor ?? defaultForm.retirada_mensal_valor),
    retirada_mensal_meses: Number(initial?.retirada_mensal_meses ?? defaultForm.retirada_mensal_meses),
    plotagem_qtd: Number(initial?.plotagem_qtd ?? defaultForm.plotagem_qtd),
    plotagem_valor_unit: Number(initial?.plotagem_valor_unit ?? defaultForm.plotagem_valor_unit),
    liderancas_qtd: Number(initial?.liderancas_qtd ?? defaultForm.liderancas_qtd),
    liderancas_valor_unit: Number(initial?.liderancas_valor_unit ?? defaultForm.liderancas_valor_unit),
    fiscais_qtd: Number(initial?.fiscais_qtd ?? defaultForm.fiscais_qtd),
    fiscais_valor_unit: Number(initial?.fiscais_valor_unit ?? defaultForm.fiscais_valor_unit),
    assinatura: initial?.assinatura ?? defaultForm.assinatura,
  };
}

export default function Cadastro({ initial, onSaved }: Props) {
  const qc = useQueryClient();
  const { cidadeAtiva, municipios } = useCidade();
  const [form, setForm] = useState<FormData>(() => buildFormState(initial));
  const [saving, setSaving] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const initialSnapshot = initial ? JSON.stringify(initial) : "";

  useEffect(() => {
    const built = buildFormState(initial);
    if (!built.municipio_id && cidadeAtiva) built.municipio_id = cidadeAtiva;
    setForm(built);
  }, [initialSnapshot]);

  const set = (key: keyof FormData, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setNum = (key: keyof FormData, raw: string) => {
    const v = parseFloat(raw);
    set(key, isNaN(v) ? 0 : v);
  };

  const retiradaTotal = useMemo(() => form.retirada_mensal_valor * form.retirada_mensal_meses, [form.retirada_mensal_valor, form.retirada_mensal_meses]);
  const plotagemTotal = useMemo(() => form.plotagem_qtd * form.plotagem_valor_unit, [form.plotagem_qtd, form.plotagem_valor_unit]);
  const liderancasTotal = useMemo(() => form.liderancas_qtd * form.liderancas_valor_unit, [form.liderancas_qtd, form.liderancas_valor_unit]);
  const fiscaisTotal = useMemo(() => form.fiscais_qtd * form.fiscais_valor_unit, [form.fiscais_qtd, form.fiscais_valor_unit]);
  const totalCampanha = useMemo(() => retiradaTotal + plotagemTotal + liderancasTotal + fiscaisTotal, [retiradaTotal, plotagemTotal, liderancasTotal, fiscaisTotal]);
  const totalPessoas = useMemo(() => form.liderancas_qtd + form.fiscais_qtd, [form.liderancas_qtd, form.fiscais_qtd]);

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!form.partido.trim()) {
      toast({ title: "Partido obrigatório", description: "Informe o partido antes de salvar.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(form.total_votos) || form.total_votos <= 0) {
      toast({ title: "Votos obrigatórios", description: "Informe o total de votos maior que zero.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(form.expectativa_votos) || form.expectativa_votos <= 0) {
      toast({ title: "Expectativa obrigatória", description: "Informe a expectativa de votos maior que zero.", variant: "destructive" });
      return;
    }
    setSaving(true);

    {
      let query = supabase
        .from("suplentes")
        .select("id, nome")
        .ilike("nome", form.nome.trim());
      if (initial?.id) query = query.neq("id", initial.id);
      const { data: duplicado, error: dupError } = await query.maybeSingle();
      if (dupError) {
        toast({ title: "Erro ao verificar duplicata", description: dupError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      if (duplicado) {
        toast({
          title: "Nome já cadastrado",
          description: `"${duplicado.nome}" já existe na base de dados.`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    }

    const { nome_urna, municipio_id, ...rest } = form;
    const payload: any = { ...rest, numero_urna: nome_urna || rest.numero_urna || "", total_campanha: totalCampanha };
    payload.municipio_id = municipio_id || cidadeAtiva || null;

    let error;
    if (initial?.id) {
      ({ error } = await supabase.from("suplentes").update(payload).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("suplentes").insert(payload));
    }
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      await qc.invalidateQueries({ queryKey: ["suplentes"] });
      toast({ title: initial?.id ? "Atualizado!" : "Cadastrado com sucesso!" });
      if (!initial?.id) setForm(defaultForm);
      onSaved?.();
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-foreground">{initial?.id ? "Editar Ficha" : "Nova Ficha Política"}</h1>
      </div>

      {!initial?.id && (
        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Buscar no TSE</h2>
          <p className="text-xs text-muted-foreground">Busque pelo nome para preencher automaticamente os dados da última eleição.</p>
          <BuscaTSE
            onSelect={async (c) => {
               const cidadeCandidato = c.municipio
                 ? municipios.find(m => m.nome.toUpperCase() === c.municipio.toUpperCase())?.id || ""
                 : "";
               setForm((prev) => ({
                 ...prev,
                 nome: c.nome,
                 nome_urna: c.nomeUrna || "",
                 numero_urna: c.numero ? String(c.numero) : prev.numero_urna,
                 partido: c.partido,
                 cargo_disputado: c.cargo === "Vereador" ? "Vereador" : c.cargo === "Deputado Estadual" ? "Deputado Estadual" : c.cargo === "Deputado Federal" ? "Deputado Federal" : prev.cargo_disputado,
                 situacao: c.situacao.includes("Suplente") ? "Suplente" : c.situacao.includes("Eleito") ? "Eleito" : "Não Eleito",
                 regiao_atuacao: (() => {
                   const bairros = (c.bairrosZona || "")
                     .split(",")
                     .map((bairro) => bairro.trim())
                     .filter(Boolean);
                   return bairros[0] || c.municipio || prev.regiao_atuacao;
                 })(),
                 total_votos: c.totalVotos > 0 ? c.totalVotos : prev.total_votos,
                 expectativa_votos: 0,
                 municipio_id: cidadeCandidato || prev.municipio_id,
               }));
              toast({ title: "Dados preenchidos!", description: `${c.nome} — ${c.partido}${c.totalVotos > 0 ? ` — ${c.totalVotos.toLocaleString("pt-BR")} votos` : ""}` });

              if (c.totalVotos > 0) {
                try {
                  const { data: existing } = await supabase
                    .from("suplentes")
                    .select("id, nome, total_votos")
                    .ilike("nome", `%${c.nome.split(" ")[0]}%${c.nome.split(" ").slice(-1)[0]}%`);
                  if (existing) {
                    for (const rec of existing) {
                      if ((rec.total_votos || 0) !== c.totalVotos) {
                        await supabase.from("suplentes").update({ total_votos: c.totalVotos }).eq("id", rec.id);
                      }
                    }
                  }
                } catch { /* silently skip */ }
              }
            }}
          />
        </section>
      )}

      {/* Dados pessoais */}
      <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Dados do Suplente</h2>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome Completo" required>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome completo" className="bg-card shadow-sm border-border" />
          </Field>
          <Field label="Nome de Urna">
            <Input value={form.nome_urna} onChange={(e) => set("nome_urna", e.target.value)} placeholder="Ex: FERNANDINHA" className="bg-card shadow-sm border-border" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nº de Urna">
            <Input value={form.numero_urna} onChange={(e) => set("numero_urna", e.target.value)} placeholder="Ex: 12345" className="bg-card shadow-sm border-border" inputMode="numeric" />
          </Field>
          <Field label="Setor">
            <Input value={form.regiao_atuacao} onChange={(e) => set("regiao_atuacao", e.target.value)} placeholder="Ex: Setor Bueno, Vila Nova" className="bg-card shadow-sm border-border" />
          </Field>
        </div>

        <Field label="Telefone">
          <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(62) 99999-9999" className="bg-card shadow-sm border-border" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cargo">
            <Select value={form.cargo_disputado} onValueChange={(v) => set("cargo_disputado", v)}>
              <SelectTrigger className="bg-card shadow-sm border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Vereador">Vereador</SelectItem>
                <SelectItem value="Deputado Estadual">Dep. Estadual</SelectItem>
                <SelectItem value="Deputado Federal">Dep. Federal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ano Eleição">
            <Input type="number" value={form.ano_eleicao} onChange={(e) => setNum("ano_eleicao", e.target.value)} className="bg-card shadow-sm border-border" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Partido" required>
            <Input value={form.partido} onChange={(e) => set("partido", e.target.value)} className="bg-card shadow-sm border-border" />
          </Field>
          <Field label="Situação">
            <Select value={form.situacao} onValueChange={(v) => set("situacao", v)}>
              <SelectTrigger className="bg-card shadow-sm border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Suplente">Suplente</SelectItem>
                <SelectItem value="Eleito">Eleito</SelectItem>
                <SelectItem value="Não Eleito">Não Eleito</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Votos Eleição Passada" required>
            <Input type="number" inputMode="numeric" value={form.total_votos || ""} onChange={(e) => setNum("total_votos", e.target.value)} placeholder="0" className="bg-card shadow-sm border-border" />
          </Field>
          <Field label="Expectativa de Votos">
            <Input type="number" inputMode="numeric" value={form.expectativa_votos || ""} onChange={(e) => setNum("expectativa_votos", e.target.value)} placeholder="0" className="bg-card shadow-sm border-border" />
          </Field>
        </div>

        <Field label="Base Política">
          <Textarea value={form.base_politica} onChange={(e) => set("base_politica", e.target.value)} placeholder="Associações, lideranças, comércios..." className="bg-card shadow-sm border-border min-h-[60px]" />
        </Field>
      </section>

      {/* Valores financeiros */}
      <section className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
          <Calculator size={16} /> Valores da Campanha
        </h2>

        <CalcRow label="Retirada Mensal" val1={form.retirada_mensal_valor} label1="Valor (R$)" val2={form.retirada_mensal_meses} label2="Meses" onChange1={(v) => setNum("retirada_mensal_valor", v)} onChange2={(v) => setNum("retirada_mensal_meses", v)} total={retiradaTotal} />
        <CalcRow label="Plotagem" val1={form.plotagem_qtd} label1="Qtd" val2={form.plotagem_valor_unit} label2="Valor Unit. (R$)" onChange1={(v) => setNum("plotagem_qtd", v)} onChange2={(v) => setNum("plotagem_valor_unit", v)} total={plotagemTotal} />
        <CalcRow label="Lideranças na Campanha" val1={form.liderancas_qtd} label1="Qtd" val2={form.liderancas_valor_unit} label2="Valor Unit. (R$)" onChange1={(v) => setNum("liderancas_qtd", v)} onChange2={(v) => setNum("liderancas_valor_unit", v)} total={liderancasTotal} />
        <CalcRow label="Fiscais no Dia da Eleição" val1={form.fiscais_qtd} label1="Qtd" val2={form.fiscais_valor_unit} label2="Valor Unit. (R$)" onChange1={(v) => setNum("fiscais_qtd", v)} onChange2={(v) => setNum("fiscais_valor_unit", v)} total={fiscaisTotal} />

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total Pessoas de Campo</span>
            <span className="font-semibold text-foreground">{totalPessoas}</span>
          </div>
          <div className="flex justify-between items-center bg-gradient-to-r from-pink-500/10 to-rose-400/10 rounded-xl p-3">
            <span className="text-base font-bold text-foreground">TOTAL CAMPANHA</span>
            <span className="text-xl font-bold text-primary">{fmt(totalCampanha)}</span>
          </div>
        </div>
      </section>

      {/* Assinatura */}
      <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
        <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
          <PenLine size={16} /> Assinatura do Suplente
        </h2>
        <p className="text-xs text-muted-foreground">Opcional — clique para o suplente assinar na tela.</p>

        {form.assinatura ? (
          <div className="space-y-2">
            <div className="border border-border rounded-xl p-2 bg-white">
              <img src={form.assinatura} alt="Assinatura" className="w-full h-24 object-contain" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowSignature(true)}>
                <PenLine size={14} /> Refazer
              </Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => set("assinatura", "")}>
                <Trash2 size={14} /> Remover
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full h-20 border-dashed border-2 text-muted-foreground" onClick={() => setShowSignature(true)}>
            <PenLine size={20} className="mr-2" />
            Toque para assinar
          </Button>
        )}
      </section>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-90 text-white font-semibold h-12 text-base shadow-lg active:scale-[0.98] transition-transform"
      >
        {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
        {saving ? "Salvando..." : initial?.id ? "Atualizar Ficha" : "Salvar Ficha"}
      </Button>

      <SignaturePad
        open={showSignature}
        onClose={() => setShowSignature(false)}
        onSave={(dataUrl) => set("assinatura", dataUrl)}
        initial={form.assinatura || undefined}
      />
    </div>
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

function CalcRow({ label, val1, label1, val2, label2, onChange1, onChange2, total }: {
  label: string; val1: number; label1: string; val2: number; label2: string;
  onChange1: (v: string) => void; onChange2: (v: string) => void; total: number;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const displayVal1 = val1 === 0 ? "" : String(val1);
  const displayVal2 = val2 === 0 ? "" : String(val2);

  return (
    <div className="bg-muted/50 rounded-xl p-3 space-y-2 shadow-sm">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-bold text-primary">{fmt(total)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">{label1}</Label>
          <Input type="number" inputMode="numeric" value={displayVal1} placeholder="0" onChange={(e) => onChange1(e.target.value)} className="bg-card shadow-sm border-border h-8 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">{label2}</Label>
          <Input type="number" inputMode="numeric" value={displayVal2} placeholder="0" onChange={(e) => onChange2(e.target.value)} className="bg-card shadow-sm border-border h-8 text-sm" />
        </div>
      </div>
    </div>
  );
}
