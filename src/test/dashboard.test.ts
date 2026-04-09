import { describe, it, expect } from "vitest";

// ─── Lógica de agregação do Dashboard ────────────────────────────────────────
// Testa os cálculos de totais e médias sem montar o componente

interface Suplente {
  nome: string;
  total_votos: number;
  expectativa_votos: number;
  liderancas_qtd: number;
  fiscais_qtd: number;
  total_campanha: number;
  retirada_mensal_valor: number;
  retirada_mensal_meses: number;
  plotagem_qtd: number;
  plotagem_valor_unit: number;
  liderancas_valor_unit: number;
  fiscais_valor_unit: number;
}

function calcDashboardTotals(list: Partial<Suplente>[]) {
  const totalVotos = list.reduce((s, x) => s + (x.total_votos || 0), 0);
  const totalExpectativa = list.reduce((s, x) => s + (x.expectativa_votos || 0), 0);
  const totalPessoas = list.reduce((s, x) => s + (x.liderancas_qtd || 0) + (x.fiscais_qtd || 0), 0);
  const totalCampanha = list.reduce((s, x) => s + (x.total_campanha || 0), 0);
  const totalLiderancas = list.reduce((s, x) => s + (x.liderancas_qtd || 0), 0);
  const totalFiscais = list.reduce((s, x) => s + (x.fiscais_qtd || 0), 0);
  const totalPlotagem = list.reduce((s, x) => s + (x.plotagem_qtd || 0), 0);
  return { totalVotos, totalExpectativa, totalPessoas, totalCampanha, totalLiderancas, totalFiscais, totalPlotagem };
}

const mockList: Partial<Suplente>[] = [
  { nome: "A", total_votos: 1000, expectativa_votos: 1500, liderancas_qtd: 3, fiscais_qtd: 10, total_campanha: 15000, plotagem_qtd: 2 },
  { nome: "B", total_votos: 2500, expectativa_votos: 3000, liderancas_qtd: 5, fiscais_qtd: 20, total_campanha: 25000, plotagem_qtd: 4 },
  { nome: "C", total_votos: 800,  expectativa_votos: 1200, liderancas_qtd: 2, fiscais_qtd: 8,  total_campanha: 10000, plotagem_qtd: 1 },
];

describe("calcDashboardTotals()", () => {
  it("soma votos corretamente", () => {
    expect(calcDashboardTotals(mockList).totalVotos).toBe(4300);
  });

  it("soma expectativa de votos corretamente", () => {
    expect(calcDashboardTotals(mockList).totalExpectativa).toBe(5700);
  });

  it("soma total de pessoas (lideranças + fiscais)", () => {
    // (3+10) + (5+20) + (2+8) = 13+25+10 = 48
    expect(calcDashboardTotals(mockList).totalPessoas).toBe(48);
  });

  it("soma total campanha", () => {
    expect(calcDashboardTotals(mockList).totalCampanha).toBe(50000);
  });

  it("soma total de lideranças", () => {
    expect(calcDashboardTotals(mockList).totalLiderancas).toBe(10);
  });

  it("soma total de fiscais", () => {
    expect(calcDashboardTotals(mockList).totalFiscais).toBe(38);
  });

  it("soma total de plotagem", () => {
    expect(calcDashboardTotals(mockList).totalPlotagem).toBe(7);
  });

  it("lista vazia → todos zeros", () => {
    const t = calcDashboardTotals([]);
    expect(t.totalVotos).toBe(0);
    expect(t.totalCampanha).toBe(0);
    expect(t.totalPessoas).toBe(0);
  });

  it("campos undefined não quebram o cálculo", () => {
    const incomplete = [{ nome: "X" }];
    const t = calcDashboardTotals(incomplete);
    expect(t.totalVotos).toBe(0);
    expect(t.totalPessoas).toBe(0);
  });
});

// ─── Filtro de busca ──────────────────────────────────────────────────────────

function filterSuplentes(list: Partial<Suplente>[], q: string) {
  const lower = q.toLowerCase();
  return list.filter(
    (s) =>
      (s.nome || "").toLowerCase().includes(lower)
  );
}

describe("filterSuplentes() — busca por nome", () => {
  it("sem filtro retorna todos", () => {
    expect(filterSuplentes(mockList, "").length).toBe(3);
  });

  it("filtra por nome parcial", () => {
    const r = filterSuplentes(mockList, "A");
    expect(r.length).toBe(1);
    expect(r[0].nome).toBe("A");
  });

  it("case-insensitive", () => {
    const list = [{ nome: "Fernanda Sarelli" }];
    expect(filterSuplentes(list, "fernanda").length).toBe(1);
    expect(filterSuplentes(list, "FERNANDA").length).toBe(1);
  });

  it("filtro sem resultado retorna []", () => {
    expect(filterSuplentes(mockList, "ZZZ").length).toBe(0);
  });
});
