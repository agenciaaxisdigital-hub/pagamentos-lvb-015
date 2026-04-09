import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCidade } from "@/contexts/CidadeContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapPin, Plus, Loader2, ToggleLeft, ToggleRight, ArrowRightLeft } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";

export default function GerenciarCidades() {
  const { refetchMunicipios, municipios } = useCidade();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [uf, setUf] = useState("GO");
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [targetCidade, setTargetCidade] = useState("");

  const { data: cidades, isLoading } = useQuery({
    queryKey: ["municipios-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("municipios")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Array<{ id: string; nome: string; uf: string; ativo: boolean; criado_em: string }>;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: stats } = useQuery({
    queryKey: ["cidade-stats"],
    queryFn: async () => {
      const [sup, lid, adm] = await Promise.all([
        (supabase as any).from("suplentes").select("municipio_id"),
        (supabase as any).from("liderancas").select("municipio_id"),
        (supabase as any).from("administrativo").select("municipio_id"),
      ]);
      const count = (data: any[], cidadeId: string) =>
        (data || []).filter((r: any) => r.municipio_id === cidadeId).length;
      const countNull = (data: any[]) =>
        (data || []).filter((r: any) => !r.municipio_id).length;
      const result: Record<string, { suplentes: number; liderancas: number; admin: number }> = {};
      let semCidade = { suplentes: 0, liderancas: 0, admin: 0 };
      for (const c of (cidades || [])) {
        result[c.id] = {
          suplentes: count(sup.data || [], c.id),
          liderancas: count(lid.data || [], c.id),
          admin: count(adm.data || [], c.id),
        };
      }
      semCidade = {
        suplentes: countNull(sup.data || []),
        liderancas: countNull(lid.data || []),
        admin: countNull(adm.data || []),
      };
      result["__sem_cidade"] = semCidade;
      return result;
    },
    enabled: !!cidades,
    staleTime: 0,
  });

  const handleAdd = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("municipios").insert({ nome: nome.trim(), uf: uf.trim().toUpperCase() || "GO" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${nome} adicionada!` });
      setNome("");
      qc.invalidateQueries({ queryKey: ["municipios-admin"] });
      refetchMunicipios();
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await (supabase as any).from("municipios").update({ ativo: !ativo }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["municipios-admin"] });
      refetchMunicipios();
    }
  };

  const handleAssignAll = async () => {
    if (!targetCidade) {
      toast({ title: "Selecione uma cidade", variant: "destructive" });
      return;
    }
    setAssigning(true);
    try {
      const tables = ["suplentes", "liderancas", "administrativo"];
      let total = 0;
      for (const table of tables) {
        const { data } = await (supabase as any)
          .from(table)
          .select("id")
          .is("municipio_id", null);
        if (data && data.length > 0) {
          const ids = data.map((r: any) => r.id);
          const { error } = await (supabase as any)
            .from(table)
            .update({ municipio_id: targetCidade })
            .in("id", ids);
          if (error) throw error;
          total += ids.length;
        }
      }
      const cidadeNome = municipios.find(m => m.id === targetCidade)?.nome || "";
      toast({ title: `${total} registros vinculados a ${cidadeNome}!` });
      qc.invalidateQueries();
      refetchMunicipios();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setAssigning(false);
  };

  const semCidade = stats?.["__sem_cidade"];
  const totalSemCidade = semCidade ? semCidade.suplentes + semCidade.liderancas + semCidade.admin : 0;

  return (
    <PageTransition>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MapPin size={20} className="text-primary" /> Gerenciar Cidades
        </h1>

        {/* Assign unlinked records */}
        {totalSemCidade > 0 && (
          <section className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider flex items-center gap-2">
              <ArrowRightLeft size={16} /> {totalSemCidade} registros sem cidade
            </h2>
            <p className="text-xs text-muted-foreground">
              {semCidade!.suplentes} suplentes, {semCidade!.liderancas} lideranças, {semCidade!.admin} administrativo — sem cidade vinculada.
            </p>
            <div className="flex gap-2">
              <Select value={targetCidade} onValueChange={setTargetCidade}>
                <SelectTrigger className="flex-1 bg-card border-border text-xs">
                  <SelectValue placeholder="Selecione a cidade destino" />
                </SelectTrigger>
                <SelectContent>
                  {municipios.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">📍 {m.nome} — {m.uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAssignAll} disabled={assigning} size="sm" className="gap-1.5 bg-gradient-to-r from-pink-500 to-rose-400 text-white font-semibold">
                {assigning ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                Vincular Todos
              </Button>
            </div>
          </section>
        )}

        {/* Add city */}
        <section className="bg-card rounded-2xl border border-border p-4 space-y-3 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Nova Cidade</h2>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Aparecida de Goiânia" className="bg-card border-border" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">UF</Label>
              <Input value={uf} onChange={e => setUf(e.target.value)} maxLength={2} className="bg-card border-border uppercase" />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={saving} className="w-full gap-2 bg-gradient-to-r from-pink-500 to-rose-400 text-white font-semibold">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Adicionar Cidade
          </Button>
        </section>

        {/* Cities list */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Cidades Cadastradas</h2>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="bg-card rounded-2xl border border-border p-4 animate-pulse h-20" />)}
            </div>
          ) : !cidades || cidades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cidade cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {cidades.map(c => {
                const s = stats?.[c.id];
                const total = s ? s.suplentes + s.liderancas + s.admin : 0;
                return (
                  <div key={c.id} className={`bg-card rounded-2xl border shadow-sm p-4 ${c.ativo ? "border-border" : "border-border/50 opacity-60"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-primary shrink-0" />
                          <p className="font-bold text-foreground text-sm">{c.nome}</p>
                          <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{c.uf}</span>
                          {!c.ativo && <span className="text-[10px] font-semibold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Inativa</span>}
                        </div>
                        {s && (
                          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>{s.suplentes} suplentes</span>
                            <span>{s.liderancas} lideranças</span>
                            <span>{s.admin} admin</span>
                            <span className="font-semibold text-foreground">{total} total</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleAtivo(c.id, c.ativo)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title={c.ativo ? "Desativar" : "Ativar"}
                      >
                        {c.ativo ? <ToggleRight size={24} className="text-primary" /> : <ToggleLeft size={24} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
