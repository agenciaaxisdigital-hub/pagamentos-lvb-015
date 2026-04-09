import { supabase } from "@/integrations/supabase/client";
import { calcTotaisFinanceiros } from "@/lib/finance";

type SuplenteRow = {
  id: string;
  nome: string;
  retirada_mensal_valor: number | null;
  retirada_mensal_meses: number | null;
  plotagem_qtd: number | null;
  plotagem_valor_unit: number | null;
  liderancas_qtd: number | null;
  liderancas_valor_unit: number | null;
  fiscais_qtd: number | null;
  fiscais_valor_unit: number | null;
  total_campanha: number | null;
};

export type FinancialValidationResult = {
  id: string;
  nome: string;
  oldTotal: number;
  calculatedTotal: number;
  updated: boolean;
  issues: string[];
};

const FIELDS: Array<keyof SuplenteRow> = [
  "retirada_mensal_valor",
  "retirada_mensal_meses",
  "plotagem_qtd",
  "plotagem_valor_unit",
  "liderancas_qtd",
  "liderancas_valor_unit",
  "fiscais_qtd",
  "fiscais_valor_unit",
  "total_campanha",
];

function isFiniteNumber(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v);
}

export async function validateAllFinancials(
  onProgress?: (current: number, total: number, nome: string) => void
): Promise<FinancialValidationResult[]> {
  const { data, error } = await supabase
    .from("suplentes")
    .select(
      "id,nome,retirada_mensal_valor,retirada_mensal_meses,plotagem_qtd,plotagem_valor_unit,liderancas_qtd,liderancas_valor_unit,fiscais_qtd,fiscais_valor_unit,total_campanha"
    )
    .order("nome");

  if (error || !data) throw new Error(error?.message || "Erro ao carregar dados financeiros");

  const results: FinancialValidationResult[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i] as SuplenteRow;
    onProgress?.(i + 1, data.length, row.nome);

    const issues: string[] = [];
    for (const field of FIELDS) {
      const value = row[field];
      if (value !== null && !isFiniteNumber(value)) {
        issues.push(`${field} invalido`);
      }
      if (isFiniteNumber(value) && (value as number) < 0) {
        issues.push(`${field} negativo`);
      }
    }

    const { totalFinal } = calcTotaisFinanceiros(row);
    const oldTotal = Number(row.total_campanha) || 0;
    const needsUpdate = oldTotal !== totalFinal;
    let updated = false;

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from("suplentes")
        .update({ total_campanha: totalFinal })
        .eq("id", row.id);
      updated = !updateError;
      if (updateError) {
        issues.push(`erro ao atualizar total: ${updateError.message}`);
      }
    }

    if (issues.length > 0 || needsUpdate) {
      results.push({
        id: row.id,
        nome: row.nome,
        oldTotal,
        calculatedTotal: totalFinal,
        updated,
        issues,
      });
    }
  }

  return results;
}
