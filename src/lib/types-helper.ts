/**
 * @file types-helper.ts
 * @description Helper types and utility contracts mapping the database schema to frontend representations
 * to ensure strict type compliance across the system.
 */

import { Database } from "@/integrations/supabase/types";

export type DBTable<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type DBInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type DBUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

/**
 * Domain-specific Enum representing the different payment categories.
 */
export type PaymentCategory = "retirada" | "salario" | "fiscais" | "plotagem";

/**
 * Mapped types for domain models in Sarelli ecosystem.
 */
export type Lideranca = DBTable<"liderancas">;
export type Suplente = DBTable<"suplentes">;
export type Administrativo = DBTable<"administrativo">;
export type Pagamento = DBTable<"pagamentos">;
export type Municipio = DBTable<"municipios">;

/**
 * Structure representing the aggregated financial metrics for dashboard summaries.
 */
export interface FinancialSummary {
  totalAllocated: number;
  totalPaid: number;
  totalPending: number;
  paidPercentage: number;
  byCategory: Record<PaymentCategory, number>;
}

/**
 * Computes eligibility rules for a payment resource.
 *
 * @param entityType - The type of persona receiving the payment.
 * @param startMonth - The month index when the persona starts receiving payments.
 * @param monthlyValue - The monthly recurring amount.
 * @param paidMonths - List of months that have already been paid.
 * @returns An array of month indices (1-12) where payment is pending/expected.
 */
export function calculatePendingMonths(
  entityType: "lideranca" | "suplente" | "admin",
  startMonth: number,
  monthlyValue: number,
  paidMonths: number[]
): number[] {
  if (monthlyValue <= 0) return [];
  
  const pending: number[] = [];
  const currentMonth = new Date().getMonth() + 1; // 1-indexed (Jan = 1, Dec = 12)
  
  // Calculate up to the current month in the current election cycle
  for (let m = startMonth; m <= currentMonth; m++) {
    if (!paidMonths.includes(m)) {
      pending.push(m);
    }
  }
  return pending;
}
