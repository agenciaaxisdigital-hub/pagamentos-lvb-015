import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Dexie DB
vi.mock("@/lib/dexieDb", () => {
  const items: any[] = [];
  return {
    db: {
      syncQueue: {
        add: vi.fn(async (item: any) => { items.push({ ...item, id: items.length + 1 }); return items.length; }),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            first: vi.fn(async () => undefined),
            count: vi.fn(async () => items.filter(i => i.status === 'PENDING').length),
            toArray: vi.fn(async () => items.filter(i => i.status === 'PENDING')),
          })),
        })),
        delete: vi.fn(async () => {}),
        update: vi.fn(async () => {}),
        hook: vi.fn(),
      },
    },
    generateOperationId: vi.fn(() => `test-${Math.random().toString(36).slice(2)}`),
    OfflineSyncDB: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

describe("offlineFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executa online com sucesso sem enfileirar", async () => {
    const { execOnlineOrEnqueue } = await import("@/lib/offlineFallback");
    const onSuccess = vi.fn();
    
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    
    const result = await execOnlineOrEnqueue(
      async () => ({ data: { id: "123" }, error: null }),
      { action: "INSERT", table: "suplentes", payload: { nome: "Test" }, onSuccess }
    );
    
    expect(result.data).toEqual({ id: "123" });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("enfileira quando offline", async () => {
    const { execOnlineOrEnqueue } = await import("@/lib/offlineFallback");
    const { db } = await import("@/lib/dexieDb");
    
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    
    const result = await execOnlineOrEnqueue(
      async () => ({ data: null, error: { message: "offline" } }),
      { action: "INSERT", table: "suplentes", payload: { nome: "Test Offline" } }
    );
    
    expect(result.error).toBeNull();
    expect(db.syncQueue.add).toHaveBeenCalled();
  });

  it("gera operationId automaticamente", async () => {
    const { execOnlineOrEnqueue } = await import("@/lib/offlineFallback");
    const { db } = await import("@/lib/dexieDb");
    
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    
    await execOnlineOrEnqueue(
      async () => ({}),
      { action: "INSERT", table: "pagamentos", payload: { valor: 100 } }
    );
    
    const call = (db.syncQueue.add as any).mock.calls[0]?.[0];
    expect(call?.operationId).toBeDefined();
    expect(call?.operationId.length).toBeGreaterThan(5);
  });
});

describe("generateOperationId", () => {
  it("gera IDs únicos", async () => {
    const { generateOperationId } = await import("@/lib/dexieDb");
    const id1 = generateOperationId();
    const id2 = generateOperationId();
    expect(id1).not.toEqual(id2);
  });
});
