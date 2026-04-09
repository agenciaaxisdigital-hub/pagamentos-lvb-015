import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Suplentes
  const { data: sups } = await supabase.from("suplentes").select("id, nome, created_at, retirada_mensal_valor, retirada_mensal_meses").order("nome");
  
  const supReport = (sups || []).map(s => {
    const dt = new Date(s.created_at);
    const mesCad = dt.getMonth() + 1;
    const mesesEsperado = Math.max(1, 10 - mesCad); // ultimo pagamento setembro
    const valorMensal = s.retirada_mensal_valor || 0;
    const mesesAtual = s.retirada_mensal_meses || 0;
    const totalAtual = valorMensal * mesesAtual;
    const totalEsperado = valorMensal * mesesEsperado;
    return {
      nome: s.nome,
      mesCadastro: mesCad,
      mesesAtual,
      mesesEsperado,
      correto: mesesAtual === mesesEsperado,
      valorMensal,
      totalAtual,
      totalEsperado,
    };
  });

  // Liderancas
  const { data: lids } = await supabase.from("liderancas").select("id, nome, created_at, retirada_mensal_valor, retirada_mensal_meses, retirada_ate_mes").order("nome");
  
  const lidReport = (lids || []).map(l => {
    const dt = new Date(l.created_at);
    const mesCad = dt.getMonth() + 1;
    const mesesEsperado = Math.max(1, 10 - mesCad);
    const valorMensal = l.retirada_mensal_valor || 0;
    const mesesAtual = l.retirada_mensal_meses || 0;
    const ateMes = l.retirada_ate_mes;
    return {
      nome: l.nome,
      mesCadastro: mesCad,
      mesesAtual,
      mesesEsperado,
      ateMes,
      correto: mesesAtual === mesesEsperado,
      valorMensal,
      totalAtual: valorMensal * mesesAtual,
      totalEsperado: valorMensal * mesesEsperado,
    };
  });

  // Admin
  const { data: adms } = await supabase.from("administrativo").select("id, nome, created_at, valor_contrato, valor_contrato_meses, contrato_ate_mes").order("nome");
  
  const admReport = (adms || []).map(a => {
    const dt = new Date(a.created_at);
    const mesCad = dt.getMonth() + 1;
    const mesesEsperado = Math.max(1, 10 - mesCad);
    const valorMensal = a.valor_contrato || 0;
    const mesesAtual = a.valor_contrato_meses || 0;
    const ateMes = a.contrato_ate_mes;
    return {
      nome: a.nome,
      mesCadastro: mesCad,
      mesesAtual,
      mesesEsperado,
      ateMes,
      correto: mesesAtual === mesesEsperado,
      valorMensal,
      totalAtual: valorMensal * mesesAtual,
      totalEsperado: valorMensal * mesesEsperado,
    };
  });

  const incorretosSup = supReport.filter(s => !s.correto);
  const incorretosLid = lidReport.filter(l => !l.correto);
  const incorretosAdm = admReport.filter(a => !a.correto);

  return new Response(JSON.stringify({
    resumo: {
      suplentes: { total: supReport.length, incorretos: incorretosSup.length },
      liderancas: { total: lidReport.length, incorretos: incorretosLid.length },
      admin: { total: admReport.length, incorretos: incorretosAdm.length },
    },
    suplentes: supReport,
    liderancas: lidReport,
    admin: admReport,
  }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
});
