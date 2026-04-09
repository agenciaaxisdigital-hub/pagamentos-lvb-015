export type SuplenteFinanceiro = {
  retirada_mensal_valor?: number | null;
  retirada_mensal_meses?: number | null;
  plotagem_qtd?: number | null;
  plotagem_valor_unit?: number | null;
  liderancas_qtd?: number | null;
  liderancas_valor_unit?: number | null;
  fiscais_qtd?: number | null;
  fiscais_valor_unit?: number | null;
  total_campanha?: number | null;
};

export type TotaisFinanceiros = {
  retirada: number;
  plotagem: number;
  liderancas: number;
  fiscais: number;
  totalCalculado: number;
  totalFinal: number;
};

export function calcTotaisFinanceiros(s: SuplenteFinanceiro): TotaisFinanceiros {
  const retirada = (s.retirada_mensal_valor || 0) * (s.retirada_mensal_meses || 0);
  const plotagem = (s.plotagem_qtd || 0) * (s.plotagem_valor_unit || 0);
  const liderancas = (s.liderancas_qtd || 0) * (s.liderancas_valor_unit || 0);
  const fiscais = (s.fiscais_qtd || 0) * (s.fiscais_valor_unit || 0);
  const totalCalculado = retirada + plotagem + liderancas + fiscais;
  // Mantem o total sempre consistente com os componentes financeiros.
  const totalFinal = totalCalculado;

  return {
    retirada,
    plotagem,
    liderancas,
    fiscais,
    totalCalculado,
    totalFinal,
  };
}
