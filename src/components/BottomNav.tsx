import { NavLink } from "@/components/NavLink";
import { Wallet, List, Users, Briefcase, MoreHorizontal, BarChart3, UserCog, LogOut, Plus, MapPin, Pause } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCidade } from "@/contexts/CidadeContext";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function BottomNav() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [showMais, setShowMais] = useState(false);
  const { isAdmin, isRH } = useCidade();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleFocus = () => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.getAttribute("contenteditable") === "true")) {
        setIsKeyboardOpen(true);
      }
    };
    const handleBlur = () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (!activeEl || (activeEl.tagName !== "INPUT" && activeEl.tagName !== "TEXTAREA" && activeEl.getAttribute("contenteditable") !== "true")) {
          setIsKeyboardOpen(false);
        }
      }, 50);
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    setShowMais(false);
  };

  const navBase =
    "flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[9px] sm:text-[10px] py-2 px-1 min-h-[52px] transition-colors text-muted-foreground active:scale-90 active:opacity-70";
  const navActive = "text-primary font-semibold";

  if (isKeyboardOpen) return null;

  return (
    <>
      {showMais && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowMais(false)}>
          <div
            className="absolute bottom-[80px] right-4 glass-card rounded-3xl p-3 w-56 animate-in slide-in-from-bottom-4 duration-300 premium-shadow"
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
                <button
                  onClick={() => { navigate("/pausados"); setShowMais(false); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-foreground rounded-xl active:bg-muted hover:bg-muted/50"
                >
                  <Pause size={17} className="text-primary" />
                  Pausados
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

      <nav className="fixed bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 z-50 glass-card rounded-[2rem] premium-shadow animate-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-around items-center max-w-lg mx-auto py-1 px-1">
          <NavLink to="/pagamentos" className={navBase} activeClassName={navActive}>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <Wallet size={20} strokeWidth={1.8} />
            </div>
            <span className="truncate max-w-full">Pagamentos</span>
          </NavLink>

          <NavLink to="/cadastros" className={navBase} activeClassName={navActive}>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <List size={20} strokeWidth={1.8} />
            </div>
            <span className="truncate max-w-full">Suplentes</span>
          </NavLink>

          <NavLink to="/liderancas" className={navBase} activeClassName={navActive}>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <Users size={20} strokeWidth={1.8} />
            </div>
            <span className="truncate max-w-full">Lideranças</span>
          </NavLink>

          <NavLink to="/administrativo" className={navBase} activeClassName={navActive}>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <Briefcase size={20} strokeWidth={1.8} />
            </div>
            <span className="truncate max-w-full">Admin</span>
          </NavLink>

          <NavLink to="/pausados" className={navBase} activeClassName={navActive}>
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <Pause size={20} strokeWidth={1.8} />
            </div>
            <span className="truncate max-w-full">Pausados</span>
          </NavLink>

          <button
            onClick={() => setShowMais((v) => !v)}
            className={`${navBase} border-0 bg-transparent cursor-pointer ${showMais ? "text-primary font-semibold" : ""}`}
          >
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all group-active:scale-95">
              <MoreHorizontal size={20} strokeWidth={1.8} />
            </div>
            <span className="truncate max-w-full">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
