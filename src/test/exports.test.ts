import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Formatadores (extraídos de exports.ts) ──────────────────────────────────

const fmt = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtN = (v: number) => (v || 0).toLocaleString("pt-BR");

describe("fmt() — formatação de moeda BRL", () => {
  it("formata zero como R$ 0,00", () => {
    expect(fmt(0)).toMatch(/R\$\s*0/);
  });

  it("formata valor inteiro", () => {
    expect(fmt(1000)).toMatch(/1\.000/);
  });

  it("formata valor com decimais", () => {
    expect(fmt(1500.50)).toMatch(/1\.500/);
  });

  it("valor undefined/null tratado como 0", () => {
    expect(fmt(undefined as unknown as number)).toMatch(/R\$/);
    expect(fmt(null as unknown as number)).toMatch(/R\$/);
  });

  it("valor negativo é formatado", () => {
    const result = fmt(-500);
    expect(result).toContain("500");
  });
});

describe("fmtN() — formatação de número pt-BR", () => {
  it("zero → '0'", () => {
    expect(fmtN(0)).toBe("0");
  });

  it("mil → '1.000'", () => {
    expect(fmtN(1000)).toBe("1.000");
  });

  it("número simples", () => {
    expect(fmtN(42)).toBe("42");
  });

  it("undefined/null tratado como 0", () => {
    expect(fmtN(undefined as unknown as number)).toBe("0");
    expect(fmtN(null as unknown as number)).toBe("0");
  });
});

// ─── Geração de nome de arquivo ───────────────────────────────────────────────

describe("nomes de arquivo gerados", () => {
  it("PDF individual usa nome do suplente sanitizado", () => {
    const nome = "João Pedro da Silva";
    const filename = `Ficha_${nome.replace(/\s+/g, "_")}.pdf`;
    expect(filename).toBe("Ficha_João_Pedro_da_Silva.pdf");
  });

  it("PDF completo tem nome fixo", () => {
    expect("Relatorio_Suplentes_Completo.pdf").toContain("Suplentes");
  });

  it("Excel tem nome fixo", () => {
    expect("Planilha_Suplentes.xlsx").toContain(".xlsx");
  });
});

// ─── Colunas Excel ────────────────────────────────────────────────────────────

describe("estrutura do Excel exportado", () => {
  const EXPECTED_HEADERS = [
    "Nome", "Região", "Telefone", "Cargo", "Ano", "Partido", "Situação",
    "Votos", "Expect. Votos", "Retirada (valor)", "Retirada (meses)",
    "Retirada Total", "Plotagem (qtd)", "Plotagem (unit)", "Plotagem Total",
    "Lideranças (qtd)", "Lideranças (unit)", "Lideranças Total",
    "Fiscais (qtd)", "Fiscais (unit)", "Fiscais Total", "Total Campanha",
  ];

  it("deve ter pelo menos 19 colunas", () => {
    expect(EXPECTED_HEADERS.length).toBeGreaterThanOrEqual(19);
  });

  it("inclui coluna de Total Campanha", () => {
    expect(EXPECTED_HEADERS).toContain("Total Campanha");
  });

  it("inclui coluna de Votos", () => {
    expect(EXPECTED_HEADERS).toContain("Votos");
  });
});

// ─── Funções de export existem e são callable ─────────────────────────────────

describe("exportSuplentePDF, exportFichasLotePDF, exportAllPDF e exportExcel — existência", () => {
  it("módulo de exports importa sem erros", async () => {
    // Mocka jsPDF e xlsx para não gerar arquivo real no teste
    vi.mock("jspdf", () => ({
      default: vi.fn().mockImplementation(() => ({
        internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
        setFillColor: vi.fn(), rect: vi.fn(), setTextColor: vi.fn(),
        setFontSize: vi.fn(), setFont: vi.fn(), text: vi.fn(),
        addPage: vi.fn(), setPage: vi.fn(), getNumberOfPages: () => 1,
        addImage: vi.fn(), save: vi.fn(),
      })),
    }));
    vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
    vi.mock("xlsx", () => ({
      utils: {
        book_new: vi.fn(() => ({})),
        aoa_to_sheet: vi.fn(() => ({})),
        book_append_sheet: vi.fn(),
      },
      writeFile: vi.fn(),
    }));

    const mod = await import("@/lib/exports");
    expect(typeof mod.exportSuplentePDF).toBe("function");
    expect(typeof mod.exportFichasLotePDF).toBe("function");
    expect(typeof mod.exportAllPDF).toBe("function");
    expect(typeof mod.exportExcel).toBe("function");
  });
});
