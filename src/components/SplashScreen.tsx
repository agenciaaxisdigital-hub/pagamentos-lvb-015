import { useState, useEffect } from "react";
import LogoSarelli from "@/assets/Logo_Sarelli.png";

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
        background: "linear-gradient(180deg, #fef2f2 0%, #fdf2f8 40%, #fefefe 100%)",
        opacity: phase === "exit" ? 0 : 1,
        transition: "opacity 0.15s ease-out",
      }}
    >
      <div
        style={{
          opacity: phase === "enter" ? 0 : 1,
          transform: phase === "enter" ? "scale(0.8) translateY(10px)" : "scale(1) translateY(0)",
          transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <img
          src={LogoSarelli}
          alt="Dra. Fernanda Sarelli"
          className="h-36 w-auto object-contain drop-shadow-sm"
        />
      </div>

      <div
        className="mt-3 text-center"
        style={{
          opacity: phase === "enter" ? 0 : 1,
          transition: "opacity 0.15s ease-out 0.1s",
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: "#c8aa64" }}
        >
          Painel de Pagamentos
        </p>
      </div>
    </div>
  );
}
