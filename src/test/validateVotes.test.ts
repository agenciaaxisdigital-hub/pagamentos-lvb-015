import { describe, it, expect } from "vitest";
import { normalize, namesMatch } from "@/lib/validateVotes";

// ─── normalize() ────────────────────────────────────────────────────────────

describe("normalize()", () => {
  it("converte para maiúsculas", () => {
    expect(normalize("fernanda")).toBe("FERNANDA");
  });

  it("remove acentos", () => {
    expect(normalize("José")).toBe("JOSE");
    expect(normalize("Fernanda Sarêlli")).toBe("FERNANDA SARELLI");
    expect(normalize("João")).toBe("JOAO");
    expect(normalize("Ângela")).toBe("ANGELA");
  });

  it("remove acentos compostos", () => {
    expect(normalize("çãõéíóúàèìòùâêîôû")).toBe("CAOEIOUAEIOUAEIOU");
  });

  it("faz trim de espaços nas bordas", () => {
    expect(normalize("  Carlos  ")).toBe("CARLOS");
  });

  it("mantém espaços internos", () => {
    expect(normalize("Ana Maria")).toBe("ANA MARIA");
  });

  it("string vazia retorna vazia", () => {
    expect(normalize("")).toBe("");
  });

  it("mantém números", () => {
    expect(normalize("Candidato 2024")).toBe("CANDIDATO 2024");
  });
});

// ─── namesMatch() ────────────────────────────────────────────────────────────

describe("namesMatch()", () => {
  it("nomes idênticos → true", () => {
    expect(namesMatch("Fernanda Sarelli", "Fernanda Sarelli")).toBe(true);
  });

  it("nomes idênticos com acentos diferentes → true", () => {
    expect(namesMatch("José Silva", "Jose Silva")).toBe(true);
  });

  it("nome curto contido no longo → true", () => {
    expect(namesMatch("Ana Silva", "Ana Maria Silva")).toBe(true);
  });

  it("nome longo contém o curto → true", () => {
    expect(namesMatch("Carlos Alberto Souza Silva", "Carlos Silva")).toBe(true);
  });

  it("nomes completamente diferentes → false", () => {
    expect(namesMatch("João Pedro", "Maria Fernanda")).toBe(false);
  });

  it("nomes sem sobreposição de palavras → false", () => {
    expect(namesMatch("Roberto Lima", "Gustavo Santos")).toBe(false);
  });

  it("match com 2 palavras em comum (≥70% das palavras menores) → true", () => {
    // "Carlos Silva" tem 2 palavras, "Carlos Eduardo Silva" tem 3
    // 2 matches de 2 palavras = 100% → true
    expect(namesMatch("Carlos Silva", "Carlos Eduardo Silva")).toBe(true);
  });

  it("apenas 1 palavra em comum com nome de 2 palavras → false (< 70%)", () => {
    // "João Santos" com "Santos Lima" — 1 de 2 palavras = 50% < 70%
    expect(namesMatch("João Santos", "Santos Lima")).toBe(false);
  });

  it("nomes com case diferente → true", () => {
    expect(namesMatch("fernanda sarelli", "FERNANDA SARELLI")).toBe(true);
  });

  it("nome urna abreviado → true quando contém palavras-chave", () => {
    expect(namesMatch("Carlos Augusto Pereira", "Carlos Pereira")).toBe(true);
  });
});
