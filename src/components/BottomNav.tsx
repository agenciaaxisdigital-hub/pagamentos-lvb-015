import { NavLink } from "@/components/NavLink";
import { Wallet, List, Users, Briefcase, MoreHorizontal, BarChart3, UserCog, LogOut, Plus, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function BottomNav() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [showMais, setShowMais] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setShowMais(false);
  };

  const navBase =
    "flex flex-col items-center justify-center gap-0.5 text-[10px] py-2 px-1 min-w-[40px] min-h-[52px] transition-colors text-muted-foreground active:scale-90 active:opacity-70";
  const navActive = "text-primary font-semibold";

  return (
    <>
      {showMais && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowMais(false)}>
          <div
            className="absolute bottom-[64px] right-2 bg-card border border-border rounded-2xl shadow-xl p-2 w-48"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { navigate("/dashboard"); setShowMais(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground rounded-xl active:bg-muted hover:bg-muted/50"
            >
              <BarChart3 size={17} className="text-primary" />
              Dashboard
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => { navigate("/cadastros/novo"); setShowMais(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground rounded-xl active:bg-muted hover:bg-muted/50"
            >
              <Plus size={17} className="text-primary" />
              Novo Suplente
            </button>
            <button
              onClick={() => { navigate("/liderancas/novo"); setShowMais(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground rounded-xl active:bg-muted hover:bg-muted/50"
            >
              <Users size={17} className="text-primary" />
              Nova Liderança
            </button>
            <button
              onClick={() => { navigate("/administrativo/novo"); setShowMais(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground rounded-xl active:bg-muted hover:bg-muted/50"
            >
              <Briefcase size={17} className="text-primary" />
              Novo Admin
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => { navigate("/usuarios"); setShowMais(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground rounded-xl active:bg-muted hover:bg-muted/50"
            >
              <UserCog size={17} className="text-primary" />
              Usuários
            </button>
            <button
              onClick={() => { navigate("/cidades"); setShowMais(false); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground rounded-xl active:bg-muted hover:bg-muted/50"
            >
              <MapPin size={17} className="text-primary" />
              Cidades
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-destructive rounded-xl active:bg-destructive/10 hover:bg-destructive/5 disabled:opacity-50"
            >
              {signingOut
                ? <div className="w-4 h-4 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin" />
                : <LogOut size={17} />}
              {signingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex justify-around items-stretch max-w-lg mx-auto">
          <NavLink to="/pagamentos" className={navBase} activeClassName={navActive}>
            <Wallet size={20} strokeWidth={1.8} />
            <span>Pagamentos</span>
          </NavLink>

          <NavLink to="/cadastros" className={navBase} activeClassName={navActive}>
            <List size={20} strokeWidth={1.8} />
            <span>Suplentes</span>
          </NavLink>

          <NavLink to="/liderancas" className={navBase} activeClassName={navActive}>
            <Users size={20} strokeWidth={1.8} />
            <span>Lideranças</span>
          </NavLink>

          <NavLink to="/administrativo" className={navBase} activeClassName={navActive}>
            <Briefcase size={20} strokeWidth={1.8} />
            <span>Admin</span>
          </NavLink>

          <button
            onClick={() => setShowMais((v) => !v)}
            className={`${navBase} border-0 bg-transparent cursor-pointer ${showMais ? "text-primary font-semibold" : ""}`}
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
