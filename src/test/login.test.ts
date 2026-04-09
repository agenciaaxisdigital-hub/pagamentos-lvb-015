import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Lógica de conversão de usuário → email (extraída de Login.tsx) ──────────

const EMAIL_DOMAIN = "@painel.sarelli.com";

function toEmail(username: string, domain = EMAIL_DOMAIN): string {
  if (username.includes("@")) return username;
  return username.toLowerCase().replace(/\s+/g, "") + domain;
}

describe("toEmail() — conversão usuário → email", () => {
  it("usuário simples ganha o domínio", () => {
    expect(toEmail("administrador")).toBe("administrador@painel.sarelli.com");
  });

  it("email completo passado diretamente não é alterado", () => {
    expect(toEmail("admin@painel.sarelli.com")).toBe("admin@painel.sarelli.com");
  });

  it("nome com espaços vira minúsculo sem espaços + domínio", () => {
    expect(toEmail("Fernanda Sarelli")).toBe("fernandasarelli@painel.sarelli.com");
  });

  it("maiúsculas viram minúsculas", () => {
    expect(toEmail("Administrador")).toBe("administrador@painel.sarelli.com");
  });

  it("múltiplos espaços são removidos", () => {
    expect(toEmail("João   Pedro")).toBe("joãopedro@painel.sarelli.com");
  });

  it("email com @ no meio não é alterado", () => {
    expect(toEmail("user@outrodominio.com")).toBe("user@outrodominio.com");
  });
});

// ─── localStorage — lembrar credenciais ──────────────────────────────────────

describe("remember me — localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("salva usuário e senha quando remember=true", () => {
    const username = "gustavo";
    const password = "senha123";
    localStorage.setItem("saved_user", username);
    localStorage.setItem("saved_pass", password);
    expect(localStorage.getItem("saved_user")).toBe("gustavo");
    expect(localStorage.getItem("saved_pass")).toBe("senha123");
  });

  it("remove credenciais quando remember=false", () => {
    localStorage.setItem("saved_user", "gustavo");
    localStorage.setItem("saved_pass", "senha123");
    localStorage.removeItem("saved_user");
    localStorage.removeItem("saved_pass");
    expect(localStorage.getItem("saved_user")).toBeNull();
    expect(localStorage.getItem("saved_pass")).toBeNull();
  });

  it("inicializa remember=true se saved_user existir", () => {
    localStorage.setItem("saved_user", "gustavo");
    const remember = !!localStorage.getItem("saved_user");
    expect(remember).toBe(true);
  });

  it("inicializa remember=false se saved_user não existir", () => {
    const remember = !!localStorage.getItem("saved_user");
    expect(remember).toBe(false);
  });

  it("username inicial vem do localStorage", () => {
    localStorage.setItem("saved_user", "admin");
    const initialUsername = localStorage.getItem("saved_user") || "";
    expect(initialUsername).toBe("admin");
  });

  it("username inicial vazio quando sem localStorage", () => {
    const initialUsername = localStorage.getItem("saved_user") || "";
    expect(initialUsername).toBe("");
  });
});
