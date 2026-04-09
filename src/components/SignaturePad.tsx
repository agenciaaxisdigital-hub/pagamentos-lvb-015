import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, Check, Eraser } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  initial?: string;
}

export default function SignaturePad({ open, onClose, onSave, initial }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  // Lock scroll when open + scroll para o topo para garantir visibilidade no PWA
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      // Rola todos os containers para o topo antes de exibir o modal
      // Necessário em PWA/iOS onde position:fixed pode ter comportamento inesperado
      window.scrollTo({ top: 0, behavior: "instant" });
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.scrollTop = 0;
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#1e1e1e";

      if (initial) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setHasContent(true);
        };
        img.src = initial;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [open, initial]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const start = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const move = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  };

  const end = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasContent(false);
  };

  const save = () => {
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
    onClose();
  };

  if (!open) return null;

  // Portal garante que o modal seja renderizado direto no body,
  // fora de qualquer ancestor com transform (PageTransition), evitando
  // o bug onde position:fixed fica preso no contexto do elemento transformado.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Header - fixed height */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X size={20} />
        </Button>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Assinatura</h2>
        <Button variant="ghost" size="icon" onClick={clear}>
          <Eraser size={20} className="text-muted-foreground" />
        </Button>
      </div>

      {/* Canvas area - takes remaining space minus footer */}
      <div className="relative flex-1 overflow-hidden bg-card">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      {/* Footer - always visible */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 space-y-2" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Assine acima desta linha</p>
        </div>
        <div className="border-b border-dashed border-border" />
        <Button
          onClick={save}
          disabled={!hasContent}
          className="h-12 w-full font-semibold"
        >
          <Check size={20} />
          Salvar assinatura
        </Button>
      </div>
    </div>,
    document.body
  );
}
