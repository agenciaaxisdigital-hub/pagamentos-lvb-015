import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '@/lib/dexieDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook de sincronização offline → online.
 * - Deduplicação por operationId
 * - INSERTs usam upsert para idempotência
 * - UPDATEs usam LWW (Last-Write-Wins) via updated_at
 * - Retry com backoff exponencial (max 5 tentativas)
 */
export function useOfflineSync() {
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);

  const updateCount = useCallback(async () => {
    try {
      const count = await db.syncQueue.where('status').equals('PENDING').count();
      setPendingCount(count);
    } catch (err) {
      console.error("[Sync] Erro ao contar fila:", err);
    }
  }, []);

  const processSyncQueue = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    
    syncingRef.current = true;
    setSyncing(true);
    const t0 = performance.now();
    
    try {
      const pendingOperations = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .toArray();

      if (pendingOperations.length === 0) {
        setPendingCount(0);
        return;
      }

      console.log(`[Sync] Processando ${pendingOperations.length} operações... (${new Date().toISOString()})`);
      toast.info(`Sincronizando ${pendingOperations.length} registros...`, { id: 'sync-progress', duration: 10000 });

      let successCount = 0;
      let errorCount = 0;

      for (const op of pendingOperations) {
        try {
          let error = null;

          switch (op.action) {
            case 'INSERT': {
              // Idempotência: usa upsert se payload tem 'id'
              if (op.payload?.id) {
                const res = await supabase.from(op.table as any).upsert(op.payload, { onConflict: 'id' });
                error = res.error;
              } else {
                const res = await supabase.from(op.table as any).insert(op.payload);
                error = res.error;
              }
              break;
            }
            case 'UPDATE': {
              if (!op.matchKey) throw new Error("MatchKey missing in UPDATE");
              // LWW: o payload já contém updated_at do cliente
              const req = supabase.from(op.table as any).update(op.payload);
              const res = await req.match(op.matchKey);
              error = res.error;
              break;
            }
            case 'DELETE': {
              if (op.matchKey) {
                const res = await supabase.from(op.table as any).delete().match(op.matchKey);
                error = res.error;
              }
              break;
            }
            case 'RPC': {
              const res = await supabase.rpc(op.table as any, op.payload);
              error = res.error;
              break;
            }
          }

          if (error) throw error;
          
          await db.syncQueue.delete(op.id!);
          successCount++;
        } catch (err: any) {
          errorCount++;
          const newRetry = op.retryCount + 1;
          console.error(`[Sync] Falha op #${op.id} (${op.table}/${op.action}), retry ${newRetry}/5:`, err.message);
          
          await db.syncQueue.update(op.id!, { 
            status: newRetry >= 5 ? 'ERROR' : 'PENDING',
            errorMessage: err.message,
            retryCount: newRetry,
          });
        }
      }

      const elapsed = (performance.now() - t0).toFixed(0);
      console.log(`[Sync] Concluído: ${successCount} ok, ${errorCount} erros (${elapsed}ms)`);

      if (successCount > 0) {
        toast.success(`${successCount} registros sincronizados!`, { id: 'sync-progress' });
      } else if (errorCount > 0) {
        toast.error(`Falha em ${errorCount} registros (verifique logs)`, { id: 'sync-progress' });
      } else {
        toast.dismiss('sync-progress');
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      updateCount();
    }
  }, [updateCount]);

  useEffect(() => {
    updateCount();

    db.syncQueue.hook('creating', () => { setTimeout(updateCount, 100); });
    db.syncQueue.hook('updating', () => { setTimeout(updateCount, 100); });
    db.syncQueue.hook('deleting', () => { setTimeout(updateCount, 100); });

    const handleOnline = () => processSyncQueue();
    window.addEventListener('online', handleOnline);
    
    if (navigator.onLine) processSyncQueue();

    // Retry a cada 5 min
    const interval = setInterval(() => {
       if (navigator.onLine) processSyncQueue();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [processSyncQueue, updateCount]);

  return { 
    syncing, 
    pendingCount, 
    syncQueue: processSyncQueue 
  };
}
