import Dexie, { type Table } from 'dexie';

export interface SyncOperation {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC';
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'ERROR';
  retryCount: number;
  errorMessage?: string;
  matchKey?: Record<string, any>;
  operationId: string; // UUID para idempotência e deduplicação
}

export class OfflineSyncDB extends Dexie {
  syncQueue!: Table<SyncOperation, number>;

  constructor() {
    super('sarelliOfflineDatabase');
    this.version(1).stores({
      syncQueue: '++id, table, action, status, timestamp'
    });
    // v2: adiciona índice operationId para deduplicação
    this.version(2).stores({
      syncQueue: '++id, table, action, status, timestamp, operationId'
    });
  }
}

export const db = new OfflineSyncDB();

/** Gera UUID v4 para operationId */
export function generateOperationId(): string {
  return crypto.randomUUID?.() ?? 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
