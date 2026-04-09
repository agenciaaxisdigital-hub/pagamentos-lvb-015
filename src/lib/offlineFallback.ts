import { db, generateOperationId } from './dexieDb';
import { toast } from 'sonner';

interface ExecOfflineOptions {
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC';
  table: string;
  payload: any;
  matchKey?: Record<string, any>;
  operationId?: string; // Se não fornecido, gera automaticamente
  onSuccess?: () => void;
  onError?: (err: any) => void;
}

export async function execOnlineOrEnqueue(
  operation: () => Promise<any>,
  offlineFallback: ExecOfflineOptions
) {
  const opId = offlineFallback.operationId || generateOperationId();

  if (navigator.onLine) {
    try {
      const response = await operation();
      if (response && response.error) {
         throw response.error;
      }
      if (offlineFallback.onSuccess) offlineFallback.onSuccess();
      return response;
    } catch (error) {
      console.warn('⚠️ Operação online falhou. Enfileirando localmente...', error);
    }
  }

  // Deduplicação: verifica se já existe operação com mesmo operationId
  try {
    const existing = await db.syncQueue.where('operationId').equals(opId).first();
    if (existing) {
      console.log(`[Offline] Operação ${opId} já existe na fila, ignorando duplicata`);
      if (offlineFallback.onSuccess) offlineFallback.onSuccess();
      return { data: offlineFallback.payload, error: null };
    }

    await db.syncQueue.add({
      action: offlineFallback.action,
      table: offlineFallback.table,
      payload: offlineFallback.payload,
      matchKey: offlineFallback.matchKey,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0,
      operationId: opId,
    });
    
    toast.success('Modo Offline: ação salva. Será sincronizada na reconexão.');
    if (offlineFallback.onSuccess) offlineFallback.onSuccess();
    return { data: offlineFallback.payload, error: null };
  } catch (dbError) {
    console.error('CRITICAL: Falha ao inserir no IndexedDB.', dbError);
    toast.error('Erro crítico: memória local cheia ou sem suporte IndexedDB.');
    if (offlineFallback.onError) offlineFallback.onError(dbError);
    return { error: dbError };
  }
}
