import { describe, expect, it } from "vitest";
import { getMesInicioComHistorico, getMesInicioPorCadastro, type PagamentoElegibilidade } from "@/lib/paymentEligibility";

describe("paymentEligibility", () => {
  it("mantém março para cadastro antigo sem histórico", () => {
    expect(getMesInicioPorCadastro("2026-03-30T12:00:00Z", 3)).toBe(3);
  });

  it("empurra para abril quando o primeiro salário real foi em abril", () => {
    const pagamentos: PagamentoElegibilidade[] = [
      { ano: 2026, mes: 4, categoria: "salario", admin_id: "adm-1" },
    ];

    expect(getMesInicioComHistorico({
      tipo: "admin",
      pessoaId: "adm-1",
      createdAt: "2026-03-30T12:00:00Z",
      mesInicioGlobal: 3,
      pagamentos,
      categoria: "salario",
    })).toBe(4);
  });

  it("mantém regra X+1 para cadastro feito em abril sem pagamento ainda", () => {
    expect(getMesInicioComHistorico({
      tipo: "lideranca",
      pessoaId: "lid-1",
      createdAt: "2026-04-05T12:00:00Z",
      mesInicioGlobal: 3,
      pagamentos: [],
      categoria: "retirada",
    })).toBe(5);
  });
});