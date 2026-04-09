import { useCidade } from "@/contexts/CidadeContext";
import { MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

export default function SeletorCidade() {
  const { municipios, cidadeAtiva, setCidadeAtiva, isAdmin, loading } = useCidade();
  const qc = useQueryClient();

  if (loading || municipios.length === 0) return null;

  // Se só tem 1 cidade e não é admin, não precisa mostrar
  if (municipios.length <= 1 && !isAdmin) return null;

  const handleChange = (value: string) => {
    setCidadeAtiva(value === "todas" ? null : value);
    // Invalidar todas as queries para refiltrar
    qc.invalidateQueries();
  };

  return (
    <Select value={cidadeAtiva || "todas"} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-auto min-w-[120px] max-w-[180px] gap-1 border-primary/20 bg-primary/5 text-xs font-semibold text-primary rounded-lg px-2 [&>svg]:hidden">
        <MapPin size={12} className="shrink-0 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {isAdmin && (
          <SelectItem value="todas" className="text-xs font-semibold">
            🌐 Todas as Cidades
          </SelectItem>
        )}
        {municipios.map(m => (
          <SelectItem key={m.id} value={m.id} className="text-xs">
            📍 {m.nome} — {m.uf}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
