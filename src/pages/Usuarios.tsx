import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Eye, EyeOff, Loader2, Trash2, KeyRound, X, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/PageTransition";

function usernameFromEmail(email: string) {
  return email.replace("@painel.sarelli.com", "").replace("@sistema.local", "");
}

export default function Usuarios() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: users, refetch, isLoading: loadingUsers } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      return data.users as { id: string; email: string; created_at: string }[];
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { username: username.trim(), password },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Erro ao criar usuário", description: data?.error || error?.message || "Tente novamente", variant: "destructive" });
    } else {
      toast({ title: "Usuário criado com sucesso!" });
      setUsername("");
      setPassword("");
      refetch();
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`Excluir o usuário "${name}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(userId);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", userId },
    });
    setDeletingId(null);
    if (error || data?.error) {
      toast({ title: "Erro ao excluir", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário excluído" });
      refetch();
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast({ title: "Senha deve ter mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "update-password", userId: editingUserId, password: newPassword },
    });
    setSavingPassword(false);
    if (error || data?.error) {
      toast({ title: "Erro ao atualizar senha", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Senha atualizada com sucesso!" });
      setEditingUserId(null);
      setNewPassword("");
    }
  };

  return (
    <PageTransition>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-foreground">Usuários</h1>

        {/* Criar usuário */}
        <form onSubmit={handleCreate} className="space-y-4 bg-card rounded-2xl border border-border p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
            <UserPlus size={15} /> Criar Novo Usuário
          </h2>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Nome de usuário</Label>
            <Input
              placeholder="Ex: joao"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
              className="bg-card shadow-sm border-border"
            />
            <p className="text-[11px] text-muted-foreground">
              Login: <span className="font-medium text-foreground">{username.trim().toLowerCase().replace(/\s+/g, "") || "..."}</span>@painel.sarelli.com
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="bg-card shadow-sm border-border pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1" tabIndex={-1}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2 h-12 text-base font-semibold active:scale-[0.98] transition-transform">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            {loading ? "Criando..." : "Criar Usuário"}
          </Button>
        </form>

        {/* Lista de usuários */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider">Usuários Cadastrados</h2>

          {loadingUsers ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-card rounded-2xl border border-border p-4 animate-pulse h-16" />
              ))}
            </div>
          ) : !users || users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const name = usernameFromEmail(u.email);
                const isDeleting = deletingId === u.id;
                return (
                  <div key={u.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User size={16} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Criado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary"
                        onClick={() => { setEditingUserId(u.id); setEditingUsername(name); setNewPassword(""); setShowNewPassword(false); }}
                        title="Editar senha"
                      >
                        <KeyRound size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(u.id, name)}
                        disabled={isDeleting}
                        title="Excluir usuário"
                      >
                        {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal editar senha */}
      {editingUserId && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setEditingUserId(null)}>
          <div
            className="w-full bg-card rounded-t-2xl p-5 space-y-4 shadow-xl"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Alterar senha — {editingUsername}</h3>
              <Button variant="ghost" size="icon" onClick={() => setEditingUserId(null)}>
                <X size={18} />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-muted-foreground">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  autoComplete="new-password"
                  className="bg-muted border-border pr-10"
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1" tabIndex={-1}>
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button onClick={handleUpdatePassword} disabled={savingPassword} className="w-full h-12 font-semibold gap-2">
              {savingPassword ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
              {savingPassword ? "Salvando..." : "Salvar Nova Senha"}
            </Button>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
