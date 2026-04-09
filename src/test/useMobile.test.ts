import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

describe("useIsMobile()", () => {
  it("retorna boolean", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe("boolean");
  });

  it("retorna false quando largura > 768px (setup padrão jsdom)", () => {
    // jsdom não tem largura real, matchMedia retorna false (setup.ts)
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
