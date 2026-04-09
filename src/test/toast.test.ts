import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast, toast } from "@/hooks/use-toast";

describe("useToast() — sistema de notificações", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("inicia sem toasts", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it("adiciona toast com title", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Salvo com sucesso" });
    });
    expect(result.current.toasts.length).toBeGreaterThan(0);
    expect(result.current.toasts[0].title).toBe("Salvo com sucesso");
  });

  it("toast com variant destructive", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Erro", variant: "destructive" });
    });
    expect(result.current.toasts[0].variant).toBe("destructive");
  });

  it("toast com description", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Aviso", description: "Usuário ou senha incorretos" });
    });
    expect(result.current.toasts[0].description).toBe("Usuário ou senha incorretos");
  });

  it("dismiss remove toast", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Teste" });
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(id);
    });
    // após dismiss o open deve ser false
    expect(result.current.toasts[0].open).toBe(false);
  });

  it("limite de 1 toast visível ao mesmo tempo", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: "Toast 1" });
      toast({ title: "Toast 2" });
      toast({ title: "Toast 3" });
    });
    expect(result.current.toasts.length).toBeLessThanOrEqual(1);
  });
});
