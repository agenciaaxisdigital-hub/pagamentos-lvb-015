import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface Options {
  queryKey: unknown[];
  itemId: string;
  deleteFn: () => Promise<{ error: any }>;
  label?: string;
  onAfterDelete?: () => void;
}

export function useDeleteWithUndo() {
  const qc = useQueryClient();

  const deleteWithUndo = ({ queryKey, itemId, deleteFn, label = "Registro", onAfterDelete }: Options) => {
    const snapshots = qc.getQueriesData<any[]>({ queryKey });

    qc.setQueriesData<any[]>({ queryKey }, (old) =>
      Array.isArray(old) ? old.filter(i => i.id !== itemId) : (old ?? [])
    );

    let cancelled = false;

    const restore = () => {
      snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    };

    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const { error } = await deleteFn();
        if (error) {
          restore();
          toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        } else {
          qc.invalidateQueries({ queryKey });
          onAfterDelete?.();
        }
      } catch (err: any) {
        restore();
        toast({ title: "Erro ao excluir", description: err?.message ?? "Erro de rede", variant: "destructive" });
      }
    }, 4500);

    toast({
      title: `${label} excluído`,
      action: (
        <ToastAction
          altText="Desfazer"
          onClick={() => {
            cancelled = true;
            clearTimeout(timer);
            restore();
          }}
        >
          Desfazer
        </ToastAction>
      ),
      duration: 5000,
    });
  };

  return { deleteWithUndo };
}
