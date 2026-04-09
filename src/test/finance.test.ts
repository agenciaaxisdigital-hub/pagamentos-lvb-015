import { describe, it, expect } from "vitest";
import { calcTotaisFinanceiros } from "@/lib/finance";

describe("calcTotaisFinanceiros()", () => {
  it("calcula todos os subtotais e total corretamente", () => {
    const totals = calcTotaisFinanceiros({
      retirada_mensal_valor: 1500,
      retirada_mensal_meses: 6,
      plotagem_qtd: 4,
      plotagem_valor_unit: 250,
      liderancas_qtd: 3,
      liderancas_valor_unit: 1662,
      fiscais_qtd: 10,
      fiscais_valor_unit: 110,
    });

    expect(totals.retirada).toBe(9000);
    expect(totals.plotagem).toBe(1000);
    expect(totals.liderancas).toBe(4986);
    expect(totals.fiscais).toBe(1100);
    expect(totals.totalCalculado).toBe(16086);
    expect(totals.totalFinal).toBe(16086);
  });

  it("trata campos faltantes como zero", () => {
    const totals = calcTotaisFinanceiros({});
    expect(totals.totalFinal).toBe(0);
  });
});
