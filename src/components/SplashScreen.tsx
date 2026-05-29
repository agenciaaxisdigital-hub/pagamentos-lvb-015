import { useState, useEffect } from "react";
import LogoAxis from "./LogoAxis";

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase("hold"), 150);
    const holdTimer = setTimeout(() => setPhase("exit"), 350);
    const exitTimer = setTimeout(() => onFinish(), 500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
    };
  }, [onFinish]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        opacity: phase === "exit" ? 0 : 1,
        transition: "opacity 0.15s ease-out",
      }}
    >
      <div
        className="flex flex-col items-center justify-center"
        style={{
          opacity: phase === "enter" ? 0 : 1,
          transform: phase === "enter" ? "scale(0.8) translateY(10px)" : "scale(1) translateY(0)",
          transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          className="animate-float"
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.1), 0 0 0 3px rgba(255,255,255,0.8), 0 0 0 6px rgba(59,130,246,0.06)',
          }}
        >
          <img
            src="/logo-axis.png"
            alt="Agência Axis"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">
            Gestão Financeira
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 mt-1">
            Agência Axis
          </p>
        </div>
      </div>
    </div>
  );
}
