import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, ArrowLeft, PenLine, Trash2, FileDown, MapPin, Check, ChevronsUpDown, User, Users, DollarSign } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import SignaturePad from "@/components/SignaturePad";
import { exportLiderancaPDF } from "@/lib/exports";
import { useCidade } from "@/contexts/CidadeContext";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface FormData {
  nome: string;
  cpf: string;
  regiao: string;
  whatsapp: string;
  rede_social: string;
  ligacao_politica: string;
  retirada_mensal_valor: number;
  retirada_ate_mes: number;
  retirada_mensal_meses: number;
  chave_pix: string;
  assinatura: string;
  suplente_id: string | null;
  lideranca_vinculada_id: string | null;
  municipio_id: string | null;
}

const defaultForm: FormData = {
  nome: "",
  cpf: "",
  regiao: "",
  whatsapp: "",
  rede_social: "",
  ligacao_politica: "",
  retirada_mensal_valor: 0,
  retirada_ate_mes: 10,
  retirada_mensal_meses: 5,
  chave_pix: "",
  assinatura: "",
  suplente_id: null,
  lideranca_vinculada_id: null,
  municipio_id: null,
};

const fmt = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CadastroLideranca() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { cidadeAtiva, municipios } = useCidade();
  
  const [form, setForm] = useState<FormData>(defaultForm);
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>(cidadeAtiva || "");
  const [showSignature, setShowSignature] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [openVinculo, setOpenVinculo] = useState(false);

  // Queries para os filtros de vínculo
  const { data: suplentesNomes } = useQuery({
    queryKey: ["suplentes-select-city", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("suplentes").select("id, nome").order("nome");
      if (cidadeAtiva) query = query.eq("municipio_id", cidadeAtiva);
      const { data, error } = await query;
      if (error) return [];
      return data;
    }
  });

  const { data: liderancasNomes } = useQuery({
    queryKey: ["liderancas-select-city", cidadeAtiva],
    queryFn: async () => {
      let query = supabase.from("liderancas").select("id, nome").order("nome");
      if (cidadeAtiva) query = query.eq("municipio_id", cidadeAtiva);
      const { data, error } = await query;
      if (error) return [];
      return (data as any[]).filter(l => l.id !== id);
    }
  });

  const { data: existing, isLoading } = useQuery({
    queryKey: ["lideranca", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("liderancas").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

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
      retirada_mensal_meses: existing.retirada_mensal_meses || 4,
      chave_pix: existing.chave_pix || "",
      assinatura: existing.assinatura || "",
      suplente_id: existing.suplente_id || null,
      lideranca_vinculada_id: existing.lideranca_vinculada_id || null,
      municipio_id: existing.municipio_id || null,
    });
    setSelectedMunicipio(existing.municipio_id || cidadeAtiva || "");
    setInitialized(true);
  }

  const set = (key: keyof FormData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Campo obrigatório", description: "O nome da liderança é necessário.", variant: "destructive" });
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome.trim(),
        cpf: form.cpf?.trim() || null,
        whatsapp: form.whatsapp?.trim() || null,
        regiao: form.regiao?.trim() || null,
        ligacao_politica: form.ligacao_politica?.trim() || null,
        retirada_mensal_valor: Number(form.retirada_mensal_valor) || 0,
        retirada_ate_mes: Number(form.retirada_ate_mes) || 9,
        retirada_mensal_meses: Number(form.retirada_mensal_meses) || 0,
        chave_pix: form.chave_pix?.trim() || null,
        assinatura: form.assinatura || null,
        municipio_id: selectedMunicipio || cidadeAtiva || null,
        suplente_id: form.suplente_id || null,
        lideranca_vinculada_id: form.lideranca_vinculada_id || null,
        updated_at: new Date().toISOString(),
      };

      if (id) payload.id = id;

      const { error } = await supabase.from("liderancas").upsert(payload);

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: id ? "Dados atualizados!" : "Cadastrado com sucesso!" });
        if (id) {
          qc.setQueriesData<any[]>({ queryKey: ["liderancas"] }, (old) =>
            Array.isArray(old) ? old.map(l => l.id === id ? { ...l, ...payload } : l) : (old ?? [])
          );
        } else {
          qc.setQueriesData<any[]>({ queryKey: ["liderancas"] }, (old) =>
            Array.isArray(old) ? [...old, { id: `opt-${Date.now()}`, ...payload }].sort((a, b) => (a.nome || "").localeCompare(b.nome || "")) : (old ?? [])
          );
        }
        qc.invalidateQueries();
        navigate("/liderancas");
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-primary" /></div>;

  const totalContrato = (form.retirada_mensal_valor || 0) * (form.retirada_mensal_meses || 0);

  return (
    <PageTransition>
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/liderancas")} className="p-1.5 rounded-xl text-muted-foreground active:bg-muted transition-colors">
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

        <section className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <MapPin size={16} /> Localização
          </h2>
          <Field label="Município" required>
            <Select value={selectedMunicipio || ""} onValueChange={setSelectedMunicipio}>
              <SelectTrigger className="bg-card shadow-sm border-border">
                <SelectValue placeholder="Selecione a cidade" />
              </SelectTrigger>
              <SelectContent>
                {municipios.map(m => (
                  <SelectItem key={m.id} value={m.id}>📍 {m.nome} — {m.uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Dados Pessoais</h2>
          
          <Field label="Nome Completo" required>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: João Silva" className="bg-card shadow-sm border-border" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF">
              <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" className="bg-card shadow-sm border-border" />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(62) 99999-9999" className="bg-card shadow-sm border-border" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Setor/Região">
              <Input value={form.regiao} onChange={(e) => set("regiao", e.target.value)} placeholder="Ex: Centro" className="bg-card shadow-sm border-border" />
            </Field>
            <Field label="Rede Social">
              <Input value={form.rede_social} onChange={(e) => set("rede_social", e.target.value)} placeholder="@usuario" className="bg-card shadow-sm border-border" />
            </Field>
          </div>

          <Field label="Ligação Política / Cargo">
            <Input value={form.ligacao_politica} onChange={(e) => set("ligacao_politica", e.target.value)} placeholder="Ex: Presidente de Bairro" className="bg-card shadow-sm border-border" />
          </Field>
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm border-l-4 border-l-primary/40">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <Users size={16} /> Vínculo e Hierarquia
          </h2>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Associe esta liderança a um Suplente ou a outra Liderança para organizar a árvore política.
          </p>

          <Popover open={openVinculo} onOpenChange={setOpenVinculo}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openVinculo}
                className={cn(
                  "w-full justify-between bg-card border-border h-12 text-sm",
                  (form.suplente_id || form.lideranca_vinculada_id) && "border-primary/50 bg-primary/[0.02]"
                )}
              >
                <div className="flex items-center gap-2 truncate text-foreground font-medium">
                  {(() => {
                    if (form.suplente_id) {
                      const s = suplentesNomes?.find(x => x.id === form.suplente_id);
                      return <><Users size={14} className="text-violet-500" /> {s?.nome || "Suplente selecionado"}</>;
                    }
                    if (form.lideranca_vinculada_id) {
                      const l = liderancasNomes?.find(x => x.id === form.lideranca_vinculada_id);
                      return <><User size={14} className="text-blue-500" /> {l?.nome || "Liderança selecionada"}</>;
                    }
                    return <span className="text-muted-foreground font-normal">Nenhum vínculo selecionado</span>;
                  })()}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Pesquisar..." />
                <CommandList>
                  <CommandEmpty>Nenhum resultado.</CommandEmpty>
                  <CommandGroup heading="Ações">
                    <CommandItem
                      onSelect={() => {
                        setForm(prev => ({ ...prev, suplente_id: null, lideranca_vinculada_id: null }));
                        setOpenVinculo(false);
                      }}
                      className="text-destructive font-medium"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remover Vínculo
                    </CommandItem>
                  </CommandGroup>

                  {suplentesNomes && suplentesNomes.length > 0 && (
                    <CommandGroup heading="Suplentes">
                      {suplentesNomes.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={s.nome}
                          onSelect={() => {
                            setForm(prev => ({ ...prev, suplente_id: s.id, lideranca_vinculada_id: null }));
                            setOpenVinculo(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 text-violet-500", form.suplente_id === s.id ? "opacity-100" : "opacity-0")} />
                          {s.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {liderancasNomes && liderancasNomes.length > 0 && (
                    <CommandGroup heading="Lideranças">
                      {liderancasNomes.map((l) => (
                        <CommandItem
                          key={l.id}
                          value={l.nome}
                          onSelect={() => {
                            setForm(prev => ({ ...prev, suplente_id: null, lideranca_vinculada_id: l.id }));
                            setOpenVinculo(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 text-blue-500", form.lideranca_vinculada_id === l.id ? "opacity-100" : "opacity-0")} />
                          {l.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm border-l-4 border-l-emerald-500/40">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-500" /> Configuração de Pagamento
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Valor Mensal (R$)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                <Input
                  type="number"
                  value={form.retirada_mensal_valor || ""}
                  onChange={(e) => set("retirada_mensal_valor", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="pl-9 bg-card shadow-sm border-border font-bold text-base h-12"
                />
              </div>
            </Field>

            <Field label="Chave PIX">
              <Input value={form.chave_pix} onChange={(e) => set("chave_pix", e.target.value)} placeholder="CPF, e-mail, telefone..." className="bg-card shadow-sm border-border h-12" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mês de Início">
              <Select 
                value={String(Math.max(1, form.retirada_ate_mes - form.retirada_mensal_meses + 1))} 
                onValueChange={(v) => {
                  const inicio = parseInt(v);
                  const duracao = Math.max(1, form.retirada_ate_mes - inicio + 1);
                  set("retirada_mensal_meses", duracao);
                }}
              >
                <SelectTrigger className="bg-card shadow-sm border-border h-12 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Mês Final">
              <Select 
                value={String(form.retirada_ate_mes)} 
                onValueChange={(v) => {
                  const fim = parseInt(v);
                  const inicio = Math.max(1, form.retirada_ate_mes - form.retirada_mensal_meses + 1);
                  const duracao = Math.max(1, fim - inicio + 1);
                  setForm(prev => ({ ...prev, retirada_ate_mes: fim, retirada_mensal_meses: duracao }));
                }}
              >
                <SelectTrigger className="bg-card shadow-sm border-border h-12 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)} disabled={i + 1 < (form.retirada_ate_mes - form.retirada_mensal_meses + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.retirada_mensal_valor > 0 && (
            <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/10 space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Previsão de Recebimento</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{fmt(totalContrato)}</span>
              </div>
              
              <div className="flex items-center gap-2 py-3 bg-white/50 dark:bg-black/20 rounded-lg px-3">
                <div className="flex-1">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold text-center">De</p>
                  <p className="text-sm font-bold text-foreground text-center truncate">
                    {MESES[Math.max(0, form.retirada_ate_mes - form.retirada_mensal_meses)]}
                  </p>
                </div>
                <div className="w-px h-8 bg-emerald-500/20" />
                <div className="px-4 text-center">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Total</p>
                  <p className="text-sm font-black text-emerald-600">{form.retirada_mensal_meses}x</p>
                </div>
                <div className="w-px h-8 bg-emerald-500/20" />
                <div className="flex-1">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold text-center">Até</p>
                  <p className="text-sm font-bold text-foreground text-center truncate">
                    {MESES[form.retirada_ate_mes - 1]}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tighter">
                  Registro Esporádico Ativado
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="bg-card rounded-2xl border border-border p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Assinatura Digital</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowSignature(true)} className="text-xs text-primary hover:bg-primary/10 gap-1.5">
              <PenLine size={14} /> {form.assinatura ? "Alterar" : "Assinar agora"}
            </Button>
          </div>
          
          {form.assinatura ? (
            <div className="bg-white rounded-xl p-3 border border-border flex flex-col items-center gap-3">
              <img src={form.assinatura} alt="Assinatura" className="max-h-24 object-contain" />
              <Button variant="ghost" size="sm" className="text-[10px] text-destructive h-6" onClick={() => set("assinatura", "")}>
                Remover assinatura
              </Button>
            </div>
          ) : (
            <div className="h-24 border-2 border-dashed border-border rounded-xl flex items-center justify-center bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setShowSignature(true)}>
              <span className="text-xs text-muted-foreground">Toque para coletar a assinatura</span>
            </div>
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
          className="w-full bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-95 text-white font-bold h-14 text-lg shadow-xl active:scale-[0.98] transition-all rounded-2xl touch-manipulation"
        >
          {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} className="mr-2" />}
          {saving ? "Salvando..." : id ? "Atualizar Dados" : "Finalizar Cadastro"}
        </Button>
      </div>
    </PageTransition>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
