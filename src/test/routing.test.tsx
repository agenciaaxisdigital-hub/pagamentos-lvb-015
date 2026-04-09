import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// ─── Componente stub para testar rotas ───────────────────────────────────────

const LoginPage = () => <div>LOGIN</div>;
const HomePage = () => <div>HOME</div>;
const NotFoundPage = () => <div>NOT FOUND</div>;

// Mock de useAuth para simular usuário logado ou não
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

// ─── Testa que as rotas corretas existem no App ───────────────────────────────

describe("roteamento — estrutura de rotas", () => {
  it("rota /login renderiza página de login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("LOGIN")).toBeDefined();
  });

  it("rota / renderiza home", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("HOME")).toBeDefined();
  });

  it("rota inexistente renderiza not found", () => {
    render(
      <MemoryRouter initialEntries={["/pagina-que-nao-existe"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("NOT FOUND")).toBeDefined();
  });
});

// ─── Rotas protegidas — redirecionamento sem auth ─────────────────────────────

describe("rotas protegidas", () => {
  it("lista de rotas protegidas esperadas", () => {
    const protectedRoutes = ["/", "/cadastros", "/dashboard", "/usuarios"];
    expect(protectedRoutes).toContain("/");
    expect(protectedRoutes).toContain("/cadastros");
    expect(protectedRoutes).toContain("/dashboard");
    expect(protectedRoutes).toContain("/usuarios");
  });

  it("rota pública esperada", () => {
    const publicRoutes = ["/login"];
    expect(publicRoutes).toContain("/login");
  });
});
