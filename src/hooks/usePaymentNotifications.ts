import { useEffect, useRef } from "react";

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface PendingInfo {
  supAtrasados: number;
  lidAtrasados: number;
  admAtrasados: number;
  mes: number;
  totalValorPendente: number;
}

const NOTIFICATION_KEY = "last_payment_notification";

function canNotify(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function shouldNotifyToday(): boolean {
  const last = localStorage.getItem(NOTIFICATION_KEY);
  if (!last) return true;
  const today = new Date().toISOString().slice(0, 10);
  return last !== today;
}

function markNotifiedToday() {
  localStorage.setItem(NOTIFICATION_KEY, new Date().toISOString().slice(0, 10));
}

export function usePaymentNotifications(pending: PendingInfo | null) {
  const notified = useRef(false);

  useEffect(() => {
    if (!pending || notified.current) return;
    const total = pending.supAtrasados + pending.lidAtrasados + pending.admAtrasados;
    if (total === 0) return;
    if (!shouldNotifyToday()) return;
    if (!canNotify()) return;

    notified.current = true;
    markNotifiedToday();

    const fmt = (v: number) =>
      (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const parts: string[] = [];
    if (pending.supAtrasados > 0) parts.push(`${pending.supAtrasados} suplente${pending.supAtrasados > 1 ? "s" : ""}`);
    if (pending.lidAtrasados > 0) parts.push(`${pending.lidAtrasados} liderança${pending.lidAtrasados > 1 ? "s" : ""}`);
    if (pending.admAtrasados > 0) parts.push(`${pending.admAtrasados} admin${pending.admAtrasados > 1 ? "s" : ""}`);

    const body = `${parts.join(", ")} com pagamento pendente em ${MESES[pending.mes]}. Total: ${fmt(pending.totalValorPendente)}`;

    try {
      new Notification("⚠️ Pagamentos Atrasados", {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "payment-reminder",
      } as NotificationOptions);
    } catch {
      // Fallback: some browsers don't support Notification constructor
    }
  }, [pending]);
}
