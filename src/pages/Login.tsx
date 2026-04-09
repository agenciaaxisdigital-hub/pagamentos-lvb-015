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
import LogoSarelli from "@/assets/Logo_Sarelli.png";
import FotoDra from "@/assets/foto_dra.png";

const EMAIL_DOMAIN = "@painel.sarelli.com";

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
    let email = username.includes("@")
      ? username
      : username.toLowerCase().replace(/\s+/g, "") + "@sistema.local";
      
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error && !username.includes("@")) {
      const emailLegacy = username.toLowerCase().replace(/\s+/g, "") + EMAIL_DOMAIN;
      const legacyAttempt = await supabase.auth.signInWithPassword({ email: emailLegacy, password });
      error = legacyAttempt.error;
    }
    setLoading(false);
    if (error) {
      toast({
        title: "Erro no login",
        description: "Usuário ou senha incorretos",
        variant: "destructive",
      });
    } else {
      if (remember) {
        localStorage.setItem("saved_user", username);
      } else {
        localStorage.removeItem("saved_user");
      }
      localStorage.removeItem("saved_pass");
      navigate("/");
    }
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
      style={{ background: 'linear-gradient(180deg, #fef2f2 0%, #fdf2f8 40%, #fefefe 100%)' }}
    >
      <NetworkBackground />

      {/* Soft overlay */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 100% 60% at 50% 0%, rgba(200, 170, 100, 0.07) 0%, transparent 60%),
            radial-gradient(ellipse 80% 50% at 50% 100%, rgba(236, 72, 153, 0.05) 0%, transparent 50%)
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
          {/* Foto circular */}
          <div
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? 'scale(1) translateY(0)' : 'scale(0.6) translateY(20px)',
              transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
            }}
          >
            <div
              className="rounded-full overflow-hidden mx-auto w-[90px] h-[90px] sm:w-[110px] sm:h-[110px]"
              style={{
                border: '3px solid #ec4899',
                boxShadow: '0 4px 25px rgba(236, 72, 153, 0.3)',
              }}
            >
              <img
                src={FotoDra}
                alt="Dra. Fernanda Sarelli"
                className="w-full h-full object-cover object-top"
                style={{ objectPosition: '50% 15%' }}
                loading="eager"
              />
            </div>
          </div>

          {/* Logo */}
          <div
            className="-mt-6"
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(10px)',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s',
            }}
          >
            <img
              src={LogoSarelli}
              alt="Sarelli"
              className="mx-auto h-36 sm:h-44 w-auto object-contain drop-shadow-sm"
              loading="eager"
            />
          </div>

          {/* Subtítulo */}
          <div className="-mt-4" style={anim(0.3)}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#c8aa64' }}
            >
              Painel de Pagamentos
            </p>
          </div>
        </div>

        {/* Login form — glassmorphism with animated pink border */}
        <form
          onSubmit={handleLogin}
          className="space-y-4 p-5 sm:p-7 rounded-[20px] relative overflow-hidden animate-[borderPulse_4s_ease-in-out_infinite]"
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.38) 0%, rgba(255,240,245,0.18) 50%, rgba(255,255,255,0.08) 100%)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            border: '2px solid rgba(236, 150, 170, 0.5)',
            borderRadius: '20px',
            boxShadow: `
              0 8px 40px rgba(236, 72, 153, 0.08),
              0 2px 12px rgba(0, 0, 0, 0.04),
              inset 0 1px 0 rgba(255, 255, 255, 0.5),
              0 0 20px rgba(236, 150, 170, 0.15)
            `,
            ...anim(0.3),
          }}
        >
          <div className="space-y-1.5" style={anim(0.35)}>
            <Label className="text-[11px] uppercase tracking-widest font-bold"
              style={{ color: '#555' }}
            >
              Usuário
            </Label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c8aa64' }} />
              <Input
                type="text"
                placeholder="Ex: Administrador"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  borderColor: 'rgba(200,170,100,0.3)',
                  color: '#333',
                }}
                className="placeholder:text-gray-400 focus:border-pink-400 focus:ring-pink-200 h-12 pl-10 text-sm rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5" style={anim(0.4)}>
            <Label className="text-[11px] uppercase tracking-widest font-bold"
              style={{ color: '#555' }}
            >
              Senha
            </Label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c8aa64' }} />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  background: 'rgba(255,255,255,0.55)',
                  borderColor: 'rgba(200,170,100,0.3)',
                  color: '#333',
                }}
                className="placeholder:text-gray-400 focus:border-pink-400 focus:ring-pink-200 h-12 pl-10 pr-10 text-sm rounded-xl"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#c8aa64' }}
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
              className="border-gray-300 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
            />
            <label htmlFor="remember" className="text-xs cursor-pointer select-none" style={{ color: '#777' }}>
              Lembrar meus dados
            </label>
          </div>

          <div style={anim(0.5)}>
            <Button
              type="submit"
              disabled={loading}
              className="w-full font-semibold h-12 text-sm text-white transition-all active:scale-[0.97] hover:brightness-110 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #d4a054 100%)',
                boxShadow: '0 4px 20px rgba(236, 72, 153, 0.3), 0 2px 8px rgba(200, 170, 100, 0.2)',
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
          <p className="text-[10px]" style={{ color: '#bbb' }}>
            Pré-candidata a Deputada Estadual — GO 2026
          </p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] transition-colors"
            style={{ color: '#ec4899' }}
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>
    </div>
  );
}
