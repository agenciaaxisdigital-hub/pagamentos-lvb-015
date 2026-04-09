import { describe, it, expect } from "vitest";

// ─── Tipos locais (espelham Pagamentos.tsx) ───────────────────────────────────

interface Pagamento {
  id: string;
  suplente_id: string;
  mes: number;
  ano: number;
  categoria: string;
  valor: number;
  observacao: string | null;
  created_at: string;
}

interface Suplente {
  id: string;
  nome: string;
  regiao_atuacao: string | null;
  partido: string | null;
  retirada_mensal_valor: number;
  retirada_mensal_meses: number;
  plotagem_qtd: number;
  plotagem_valor_unit: number;
  liderancas_qtd: number;
  liderancas_valor_unit: number;
  fiscais_qtd: number;
  fiscais_valor_unit: number;
  total_campanha: number;
}

// ─── Funções extraídas de Pagamentos.tsx (lógica pura) ───────────────────────

function pagamentosDoMes(pagamentos: Pagamento[], suplenteId: string, mes: number, ano: number) {
  return pagamentos.filter(
    p => p.suplente_id === suplenteId && p.mes === mes && p.ano === ano
  );
}

function retiradaPagaNoMes(pagamentos: Pagamento[], suplenteId: string, mes: number, ano: number): boolean {
  return pagamentosDoMes(pagamentos, suplenteId, mes, ano).some(p => p.categoria === "retirada");
}

function valorRetiradaPagaNoMes(pagamentos: Pagamento[], suplenteId: string, mes: number, ano: number): number {
  return pagamentosDoMes(pagamentos, suplenteId, mes, ano)
    .filter(p => p.categoria === "retirada")
    .reduce((a, p) => a + (p.valor || 0), 0);
}

function totalPagoNoMes(pagamentos: Pagamento[], mes: number, ano: number): number {
  return pagamentos.filter(p => p.mes === mes && p.ano === ano).reduce((a, p) => a + (p.valor || 0), 0);
}

function suplantesSemRetiradaPaga(
  suplentes: Suplente[],
  pagamentos: Pagamento[],
  mes: number,
  ano: number
): Suplente[] {
  return suplentes.filter(s =>
    s.retirada_mensal_valor > 0 &&
    !pagamentos.some(p => p.suplente_id === s.id && p.mes === mes && p.ano === ano && p.categoria === "retirada")
  );
}

function navMes(mes: number, ano: number, dir: -1 | 1): { mes: number; ano: number } {
  let m = mes + dir;
  let a = ano;
  if (m < 1) { m = 12; a--; }
  if (m > 12) { m = 1; a++; }
  return { mes: m, ano: a };
}

function filterSuplentes(suplentes: Partial<Suplente>[], busca: string): Partial<Suplente>[] {
  const q = busca.toLowerCase();
  return suplentes.filter(s =>
    (s.nome || "").toLowerCase().includes(q) ||
    (s.regiao_atuacao || "").toLowerCase().includes(q) ||
    (s.partido || "").toLowerCase().includes(q)
  );
}

// ─── Dados de fixture ─────────────────────────────────────────────────────────

const suplentes: Suplente[] = [
  {
    id: "s1", nome: "Ana Lima", regiao_atuacao: "Centro", partido: "PL",
    retirada_mensal_valor: 1500, retirada_mensal_meses: 6,
    plotagem_qtd: 4, plotagem_valor_unit: 250,
    liderancas_qtd: 3, liderancas_valor_unit: 1662,
    fiscais_qtd: 10, fiscais_valor_unit: 110,
    total_campanha: 16086,
  },
  {
    id: "s2", nome: "Bruno Melo", regiao_atuacao: "Norte", partido: "PP",
    retirada_mensal_valor: 2000, retirada_mensal_meses: 6,
    plotagem_qtd: 2, plotagem_valor_unit: 250,
    liderancas_qtd: 5, liderancas_valor_unit: 1662,
    fiscais_qtd: 15, fiscais_valor_unit: 110,
    total_campanha: 22080,
  },
  {
    id: "s3", nome: "Carla Souza", regiao_atuacao: "Sul", partido: "MDB",
    retirada_mensal_valor: 0, retirada_mensal_meses: 0, // sem retirada
    plotagem_qtd: 2, plotagem_valor_unit: 250,
    liderancas_qtd: 1, liderancas_valor_unit: 1662,
    fiscais_qtd: 5, fiscais_valor_unit: 110,
    total_campanha: 2762,
  },
];

const pagamentosBase: Pagamento[] = [
  { id: "p1", suplente_id: "s1", mes: 3, ano: 2025, categoria: "retirada", valor: 1500, observacao: null, created_at: "2025-03-01T10:00:00Z" },
  { id: "p2", suplente_id: "s1", mes: 3, ano: 2025, categoria: "plotagem", valor: 1000, observacao: null, created_at: "2025-03-05T10:00:00Z" },
  { id: "p3", suplente_id: "s2", mes: 2, ano: 2025, categoria: "retirada", valor: 2000, observacao: null, created_at: "2025-02-28T10:00:00Z" },
  { id: "p4", suplente_id: "s1", mes: 4, ano: 2025, categoria: "retirada", valor: 1500, observacao: null, created_at: "2025-04-01T10:00:00Z" },
];

// ─── retiradaPagaNoMes ────────────────────────────────────────────────────────

describe("retiradaPagaNoMes()", () => {
  it("retorna true quando retirada foi paga no mês/ano", () => {
    expect(retiradaPagaNoMes(pagamentosBase, "s1", 3, 2025)).toBe(true);
  });

  it("retorna false quando não há pagamento de retirada no mês", () => {
    expect(retiradaPagaNoMes(pagamentosBase, "s2", 3, 2025)).toBe(false);
  });

  it("retorna false quando há pagamento em outro mês", () => {
    expect(retiradaPagaNoMes(pagamentosBase, "s2", 3, 2025)).toBe(false);
    expect(retiradaPagaNoMes(pagamentosBase, "s2", 2, 2025)).toBe(true); // fevereiro está pago
  });

  it("retorna false quando há pagamento de outra categoria (não retirada)", () => {
    // s1 em março tem plotagem mas não foi essa que estamos testando exclusivamente
    // Cria fixture com só plotagem
    const apenasPlotagem: Pagamento[] = [
      { id: "px", suplente_id: "s1", mes: 5, ano: 2025, categoria: "plotagem", valor: 1000, observacao: null, created_at: "" },
    ];
    expect(retiradaPagaNoMes(apenasPlotagem, "s1", 5, 2025)).toBe(false);
  });

  it("retorna false quando o ano é diferente", () => {
    expect(retiradaPagaNoMes(pagamentosBase, "s1", 3, 2024)).toBe(false);
  });

  it("retorna false para lista de pagamentos vazia", () => {
    expect(retiradaPagaNoMes([], "s1", 3, 2025)).toBe(false);
  });
});

// ─── valorRetiradaPagaNoMes ───────────────────────────────────────────────────

describe("valorRetiradaPagaNoMes()", () => {
  it("retorna o valor correto quando pago", () => {
    expect(valorRetiradaPagaNoMes(pagamentosBase, "s1", 3, 2025)).toBe(1500);
  });

  it("retorna zero quando não pago", () => {
    expect(valorRetiradaPagaNoMes(pagamentosBase, "s2", 3, 2025)).toBe(0);
  });

  it("soma múltiplos pagamentos de retirada no mesmo mês", () => {
    const multi: Pagamento[] = [
      { id: "r1", suplente_id: "s1", mes: 3, ano: 2025, categoria: "retirada", valor: 1000, observacao: null, created_at: "" },
      { id: "r2", suplente_id: "s1", mes: 3, ano: 2025, categoria: "retirada", valor: 500, observacao: null, created_at: "" },
    ];
    expect(valorRetiradaPagaNoMes(multi, "s1", 3, 2025)).toBe(1500);
  });
});

// ─── totalPagoNoMes ───────────────────────────────────────────────────────────

describe("totalPagoNoMes()", () => {
  it("soma todos os pagamentos do mês/ano selecionado", () => {
    // Março 2025: p1 (1500) + p2 (1000) = 2500
    expect(totalPagoNoMes(pagamentosBase, 3, 2025)).toBe(2500);
  });

  it("ignora pagamentos de outros meses", () => {
    expect(totalPagoNoMes(pagamentosBase, 2, 2025)).toBe(2000); // só p3
  });

  it("ignora pagamentos de outros anos", () => {
    expect(totalPagoNoMes(pagamentosBase, 3, 2024)).toBe(0);
  });

  it("retorna zero para lista vazia", () => {
    expect(totalPagoNoMes([], 3, 2025)).toBe(0);
  });

  it("não confunde mês idêntico em anos diferentes", () => {
    const pagsDuasEras: Pagamento[] = [
      { id: "a", suplente_id: "s1", mes: 3, ano: 2025, categoria: "retirada", valor: 1500, observacao: null, created_at: "" },
      { id: "b", suplente_id: "s1", mes: 3, ano: 2024, categoria: "retirada", valor: 9999, observacao: null, created_at: "" },
    ];
    expect(totalPagoNoMes(pagsDuasEras, 3, 2025)).toBe(1500);
    expect(totalPagoNoMes(pagsDuasEras, 3, 2024)).toBe(9999);
  });
});

// ─── suplantesSemRetiradaPaga ─────────────────────────────────────────────────

describe("suplantesSemRetiradaPaga()", () => {
  it("retorna os que ainda não pagaram retirada no mês", () => {
    // s1 pagou em março, s2 não, s3 não tem retirada
    const pendentes = suplantesSemRetiradaPaga(suplentes, pagamentosBase, 3, 2025);
    expect(pendentes.map(s => s.id)).toEqual(["s2"]);
  });

  it("exclui suplentes sem retirada cadastrada (valor = 0)", () => {
    const pendentes = suplantesSemRetiradaPaga(suplentes, pagamentosBase, 3, 2025);
    expect(pendentes.find(s => s.id === "s3")).toBeUndefined();
  });

  it("retorna todos quando nenhum pagou", () => {
    const pendentes = suplantesSemRetiradaPaga(suplentes, [], 3, 2025);
    // s3 tem retirada_mensal_valor = 0, então só s1 e s2
    expect(pendentes.map(s => s.id)).toEqual(["s1", "s2"]);
  });

  it("retorna lista vazia quando todos já pagaram", () => {
    const todosPagos: Pagamento[] = [
      { id: "pa", suplente_id: "s1", mes: 3, ano: 2025, categoria: "retirada", valor: 1500, observacao: null, created_at: "" },
      { id: "pb", suplente_id: "s2", mes: 3, ano: 2025, categoria: "retirada", valor: 2000, observacao: null, created_at: "" },
    ];
    const pendentes = suplantesSemRetiradaPaga(suplentes, todosPagos, 3, 2025);
    expect(pendentes).toHaveLength(0);
  });

  it("ignora pagamentos de outros meses ao verificar pendência", () => {
    // s2 pagou em fevereiro, mas não em março
    const pendentes = suplantesSemRetiradaPaga(suplentes, pagamentosBase, 3, 2025);
    expect(pendentes.find(s => s.id === "s2")).toBeDefined();
  });
});

// ─── navMes ───────────────────────────────────────────────────────────────────

describe("navMes()", () => {
  it("avança para o próximo mês no mesmo ano", () => {
    expect(navMes(5, 2025, 1)).toEqual({ mes: 6, ano: 2025 });
  });

  it("recua para o mês anterior no mesmo ano", () => {
    expect(navMes(5, 2025, -1)).toEqual({ mes: 4, ano: 2025 });
  });

  it("avança de dezembro para janeiro do próximo ano", () => {
    expect(navMes(12, 2025, 1)).toEqual({ mes: 1, ano: 2026 });
  });

  it("recua de janeiro para dezembro do ano anterior", () => {
    expect(navMes(1, 2025, -1)).toEqual({ mes: 12, ano: 2024 });
  });

  it("mantém ano ao avançar de novembro para dezembro", () => {
    expect(navMes(11, 2025, 1)).toEqual({ mes: 12, ano: 2025 });
  });

  it("mantém ano ao recuar de fevereiro para janeiro", () => {
    expect(navMes(2, 2025, -1)).toEqual({ mes: 1, ano: 2025 });
  });
});

// ─── filterSuplentes ──────────────────────────────────────────────────────────

describe("filterSuplentes() — busca em Pagamentos", () => {
  it("sem busca retorna todos", () => {
    expect(filterSuplentes(suplentes, "")).toHaveLength(3);
  });

  it("filtra por nome parcial (case-insensitive)", () => {
    const r = filterSuplentes(suplentes, "ana");
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("Ana Lima");
  });

  it("filtra por região de atuação", () => {
    const r = filterSuplentes(suplentes, "norte");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("s2");
  });

  it("filtra por partido", () => {
    const r = filterSuplentes(suplentes, "MDB");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("s3");
  });

  it("busca sem resultado retorna lista vazia", () => {
    expect(filterSuplentes(suplentes, "ZZZ_INEXISTENTE")).toHaveLength(0);
  });

  it("busca por sobrenome funciona", () => {
    const r = filterSuplentes(suplentes, "souza");
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("Carla Souza");
  });
});

// ─── Validação de valor de pagamento ─────────────────────────────────────────

describe("validação de valor de pagamento", () => {
  function isValorValido(valorStr: string, limiteMax: number): { ok: boolean; msg?: string } {
    const v = parseFloat(valorStr.replace(",", ".")) || 0;
    if (!v || v <= 0) return { ok: false, msg: "Valor deve ser maior que zero" };
    if (limiteMax > 0 && v > limiteMax) return { ok: false, msg: `Valor excede o limite de R$ ${limiteMax}` };
    return { ok: true };
  }

  it("valor zero é inválido", () => {
    expect(isValorValido("0", 1500).ok).toBe(false);
  });

  it("valor negativo é inválido", () => {
    expect(isValorValido("-100", 1500).ok).toBe(false);
  });

  it("string vazia é inválida", () => {
    expect(isValorValido("", 1500).ok).toBe(false);
  });

  it("valor igual ao limite é válido", () => {
    expect(isValorValido("1500", 1500).ok).toBe(true);
  });

  it("valor abaixo do limite é válido", () => {
    expect(isValorValido("750", 1500).ok).toBe(true);
  });

  it("valor acima do limite é inválido", () => {
    expect(isValorValido("1600", 1500).ok).toBe(false);
  });

  it("valor com vírgula decimal é aceito", () => {
    expect(isValorValido("1.500,50", 2000).ok).toBe(true);
  });

  it("limite zero desativa validação de teto", () => {
    expect(isValorValido("99999", 0).ok).toBe(true);
  });
});

// ─── Cálculo do total de lote ─────────────────────────────────────────────────

describe("cálculo do total a pagar em lote", () => {
  it("soma corretamente os valores de retirada dos pendentes", () => {
    const pendentes = suplantesSemRetiradaPaga(suplentes, pagamentosBase, 3, 2025);
    const totalLote = pendentes.reduce((a, s) => a + s.retirada_mensal_valor, 0);
    // s2 tem retirada_mensal_valor = 2000
    expect(totalLote).toBe(2000);
  });

  it("total do lote é zero quando não há pendentes", () => {
    const todosPagos: Pagamento[] = [
      { id: "pa", suplente_id: "s1", mes: 3, ano: 2025, categoria: "retirada", valor: 1500, observacao: null, created_at: "" },
      { id: "pb", suplente_id: "s2", mes: 3, ano: 2025, categoria: "retirada", valor: 2000, observacao: null, created_at: "" },
    ];
    const pendentes = suplantesSemRetiradaPaga(suplentes, todosPagos, 3, 2025);
    const totalLote = pendentes.reduce((a, s) => a + s.retirada_mensal_valor, 0);
    expect(totalLote).toBe(0);
  });

  it("monta corretamente os inserts do lote", () => {
    const pendentes = suplantesSemRetiradaPaga(suplentes, pagamentosBase, 3, 2025);
    const inserts = pendentes.map(s => ({
      suplente_id: s.id,
      mes: 3,
      ano: 2025,
      categoria: "retirada",
      valor: s.retirada_mensal_valor,
      observacao: `Pagamento em lote — Março/2025`,
    }));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      suplente_id: "s2",
      mes: 3,
      ano: 2025,
      categoria: "retirada",
      valor: 2000,
    });
  });
});
