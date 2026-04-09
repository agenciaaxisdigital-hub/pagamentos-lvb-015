import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function MiniBar({ pago, total, cor = "bg-primary" }: { pago: number; total: number; cor?: string }) {
  const pct = total > 0 ? Math.min(100, (pago / total) * 100) : 0;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatusBadge({ pago, previsto }: { pago: number; previsto: number }) {
  if (previsto <= 0) return null;
  const pct = (pago / previsto) * 100;
  if (pct >= 100) return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-status-success bg-status-success/10 px-1.5 py-0.5 rounded-full">
      <CheckCircle2 size={9} /> Quitado
    </span>
  );
  if (pct >= 50) return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-status-warning bg-status-warning/10 px-1.5 py-0.5 rounded-full">
      <AlertTriangle size={9} /> {pct.toFixed(0)}%
    </span>
  );
  if (pct > 0) return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-status-alert bg-status-alert/10 px-1.5 py-0.5 rounded-full">
      <AlertTriangle size={9} /> {pct.toFixed(0)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
      <XCircle size={9} /> Pendente
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <span className="text-lg">📊</span>
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-32" />
      <div className="h-20 bg-muted rounded" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-16 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    </div>
  );
}
