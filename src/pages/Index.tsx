import { Navigate } from "react-router-dom";
import { useCidade } from "@/contexts/CidadeContext";
import { useEffect } from "react";

export default function Index() {
  const { municipios, cidadeAtiva, setCidadeAtiva, loading } = useCidade();

  // Auto-select Aparecida de Goiânia if no city is selected
  useEffect(() => {
    if (!loading && municipios.length > 0 && !cidadeAtiva) {
      const aparecida = municipios.find(m => m.nome.toLowerCase().includes("aparecida"));
      if (aparecida) {
        setCidadeAtiva(aparecida.id);
      } else {
        setCidadeAtiva(municipios[0].id);
      }
    }
  }, [loading, municipios, cidadeAtiva, setCidadeAtiva]);

  return <Navigate to="/pagamentos" replace />;
}
