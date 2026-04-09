import { describe, it, expect } from "vitest";

// Lógica financeira extraída de Cadastro.tsx (useMemo puro)
// Testamos as fórmulas diretamente sem precisar montar o componente

function calcRetirada(valor: number, meses: number) {
  return valor * meses;
}
function calcPlotagemTotal(qtd: number, valorUnit: number) {
  return qtd * valorUnit;
}
function calcLiderancasTotal(qtd: number, valorUnit: number) {
  return qtd * valorUnit;
}
function calcFiscaisTotal(qtd: number, valorUnit: number) {
  return qtd * valorUnit;
}
function calcTotalCampanha(retirada: number, plotagem: number, liderancas: number, fiscais: number) {
  return retirada + plotagem + liderancas + fiscais;
}
function calcTotalPessoas(liderancasQtd: number, fiscaisQtd: number) {
  return liderancasQtd + fiscaisQtd;
}

// ─── Retirada mensal ─────────────────────────────────────────────────────────

describe("calcRetirada()", () => {
  it("valor × meses correto", () => {
    expect(calcRetirada(1500, 6)).toBe(9000);
  });

  it("zero meses → zero", () => {
    expect(calcRetirada(1500, 0)).toBe(0);
  });

  it("zero valor → zero", () => {
    expect(calcRetirada(0, 6)).toBe(0);
  });

  it("valores decimais", () => {
    expect(calcRetirada(1662.50, 12)).toBeCloseTo(19950);
  });
});

// ─── Plotagem ────────────────────────────────────────────────────────────────

describe("calcPlotagemTotal()", () => {
  it("qtd × valor unitário correto", () => {
    expect(calcPlotagemTotal(10, 250)).toBe(2500);
  });

  it("zero quantidade → zero", () => {
    expect(calcPlotagemTotal(0, 250)).toBe(0);
  });

  it("valor unitário padrão (250)", () => {
    expect(calcPlotagemTotal(4, 250)).toBe(1000);
  });
});

// ─── Lideranças ──────────────────────────────────────────────────────────────

describe("calcLiderancasTotal()", () => {
  it("qtd × valor unitário correto", () => {
    expect(calcLiderancasTotal(5, 1662)).toBe(8310);
  });

  it("valor unitário padrão (1662)", () => {
    expect(calcLiderancasTotal(1, 1662)).toBe(1662);
  });

  it("zero → zero", () => {
    expect(calcLiderancasTotal(0, 1662)).toBe(0);
  });
});

// ─── Fiscais ─────────────────────────────────────────────────────────────────

describe("calcFiscaisTotal()", () => {
  it("qtd × valor unitário correto", () => {
    expect(calcFiscaisTotal(20, 110)).toBe(2200);
  });

  it("valor unitário padrão (110)", () => {
    expect(calcFiscaisTotal(1, 110)).toBe(110);
  });

  it("zero → zero", () => {
    expect(calcFiscaisTotal(0, 110)).toBe(0);
  });
});

// ─── Total Campanha ──────────────────────────────────────────────────────────

describe("calcTotalCampanha()", () => {
  it("soma todos os componentes", () => {
    expect(calcTotalCampanha(9000, 2500, 8310, 2200)).toBe(22010);
  });

  it("tudo zero → zero", () => {
    expect(calcTotalCampanha(0, 0, 0, 0)).toBe(0);
  });

  it("apenas retirada", () => {
    expect(calcTotalCampanha(5000, 0, 0, 0)).toBe(5000);
  });

  it("cenário real típico", () => {
    // retirada: 1500*6=9000, plotagem: 4*250=1000, liderancas: 3*1662=4986, fiscais: 10*110=1100
    const retirada = calcRetirada(1500, 6);
    const plotagem = calcPlotagemTotal(4, 250);
    const liderancas = calcLiderancasTotal(3, 1662);
    const fiscais = calcFiscaisTotal(10, 110);
    expect(calcTotalCampanha(retirada, plotagem, liderancas, fiscais)).toBe(16086);
  });
});

// ─── Total Pessoas ────────────────────────────────────────────────────────────

describe("calcTotalPessoas()", () => {
  it("lideranças + fiscais", () => {
    expect(calcTotalPessoas(3, 10)).toBe(13);
  });

  it("apenas lideranças", () => {
    expect(calcTotalPessoas(5, 0)).toBe(5);
  });

  it("apenas fiscais", () => {
    expect(calcTotalPessoas(0, 20)).toBe(20);
  });

  it("zero → zero", () => {
    expect(calcTotalPessoas(0, 0)).toBe(0);
  });
});
