import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn, Lock, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import NetworkBackground from "@/components/NetworkBackground";
import LogoAxis from "@/components/LogoAxis";

const EMAIL_DOMAIN = "@agenciaaxis.com.br";

export default function Login() {
  const [username, setUsername] = useState(() => localStorage.getItem("saved_user") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem("saved_user"));
  const [entered, setEntered] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const base = username.toLowerCase().replace(/\s+/g, "");
    const candidates = username.includes("@")
      ? [username]
      : [
          base + "@painel.sarelli.com",   // domínio original de produção
          base + "@sistema.local",
          base + "@agenciaaxis.com.br",
          base + "@sarelli.com.br",
        ];

    let lastError: { message: string } | null = null;

    for (const email of candidates) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        if (remember) {
          localStorage.setItem("saved_user", username);
        } else {
          localStorage.removeItem("saved_user");
        }
        localStorage.removeItem("saved_pass");
        setLoading(false);
        navigate("/");
        return;
      }
      lastError = error;
    }

    setLoading(false);
    toast({
      title: "Erro no login",
      description: "Usuário ou senha incorretos",
      variant: "destructive",
    });
    console.error("[Login] Falhou em todos os domínios:", lastError?.message);
  };



  const anim = (delay: number) => ({
    opacity: entered ? 1 : 0,
    transform: entered
      ? 'translateY(0) scale(1)'
      : 'translateY(30px) scale(0.95)',
    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center p-4 pt-8 sm:py-6 relative overflow-y-auto"
      style={{ background: 'linear-gradient(180deg, #090e1a 0%, #0d1527 50%, #030712 100%)' }}
    >
      <NetworkBackground />

      {/* Soft overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 100% 60% at 50% 0%, rgba(107, 114, 128, 0.12) 0%, transparent 60%),
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(156, 163, 175, 0.08) 0%, transparent 50%)
          `,
          opacity: entered ? 1 : 0,
          transition: 'opacity 1s ease-out',
        }}
      />

      <div
        className="w-full max-w-sm space-y-3 sm:space-y-5 relative z-10"
        style={{
          opacity: entered ? 1 : 0,
          transform: entered ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center">
          {/* Logo Axis */}
          <div
            className="animate-float"
            style={{
              width: 136,
              height: 136,
              borderRadius: '50%',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 3px rgba(255,255,255,0.18), 0 0 0 6px rgba(59,130,246,0.15)',
              opacity: entered ? 1 : 0,
              transform: entered ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(10px)',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s',
            }}
          >
            <img
              src="/logo-axis.png"
              alt="Agência Axis"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Subtítulo */}
          <div className="mt-4 text-center" style={anim(0.3)}>
            <h2 className="text-lg font-black tracking-tight text-white leading-none">Gestão Financeira</h2>
            <p className="text-xs font-bold uppercase tracking-[0.25em] mt-1.5"
              style={{ color: '#9ca3af' }}
            >
              Agência Axis
            </p>
          </div>
        </div>

        {/* Login form — glassmorphism with animated tech blue border */}
        <form
          onSubmit={handleLogin}
          className="space-y-4 p-5 sm:p-7 rounded-[24px] relative overflow-hidden animate-[borderPulse_4s_ease-in-out_infinite]"
          style={{
            background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.45) 50%, rgba(15, 23, 42, 0.75) 100%)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '24px',
            boxShadow: `
              0 20px 50px rgba(0, 0, 0, 0.35),
              0 0 30px rgba(107, 114, 128, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `,
            ...anim(0.3),
          }}
        >
          <div className="space-y-1.5" style={anim(0.35)}>
            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
              Usuário
            </Label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
              <Input
                type="text"
                placeholder="Ex: Administrador"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderColor: 'rgba(107, 114, 128, 0.25)',
                  color: '#f8fafc',
                }}
                className="placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20 h-12 pl-10 text-sm rounded-xl border"
              />
            </div>
          </div>

          <div className="space-y-1.5" style={anim(0.4)}>
            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
              Senha
            </Label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }} />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderColor: 'rgba(107, 114, 128, 0.25)',
                  color: '#f8fafc',
                }}
                className="placeholder:text-slate-500 focus:border-slate-500 focus:ring-slate-500/20 h-12 pl-10 pr-10 text-sm rounded-xl border"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:text-white"
                style={{ color: '#9ca3af' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2" style={anim(0.45)}>
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(!!v)}
              className="border-slate-600 data-[state=checked]:bg-slate-600 data-[state=checked]:border-slate-600"
            />
            <label htmlFor="remember" className="text-xs cursor-pointer select-none text-slate-400 hover:text-slate-300">
              Lembrar meus dados
            </label>
          </div>

          <div style={anim(0.5)}>
            <Button
              type="submit"
              disabled={loading}
              className="w-full font-semibold h-12 text-sm text-white transition-all active:scale-[0.97] hover:brightness-110 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #3A3D42 0%, #6B7280 100%)',
                boxShadow: '0 4px 20px rgba(107, 114, 128, 0.3), 0 2px 8px rgba(156, 163, 175, 0.15)',
              }}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={16} />
                  Entrar
                </span>
              )}
            </Button>
          </div>
        </form>

        <div className="text-center space-y-1" style={anim(0.6)}>
          <p className="text-[10px] text-slate-500 font-medium">
            Agência Axis — Tecnologia e Gestão Financeira
          </p>
          <a
            href="https://agenciaaxis.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] transition-colors font-bold hover:underline"
            style={{ color: '#9ca3af' }}
          >
            agenciaaxis.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
