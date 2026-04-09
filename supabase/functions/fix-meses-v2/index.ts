import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: string[] = [];

  // Regra: cadastro até março → começa em março (7 meses: mar-set)
  //        cadastro em abril → começa em maio (5 meses: mai-set)  [X+1]
  //        cadastro em maio → começa em junho (4 meses: jun-set) [X+1]
  // Fórmula: mesCad <= 3 → meses = 10 - mesCad
  //          mesCad > 3  → meses = 10 - (mesCad + 1) = 9 - mesCad

  const calcMeses = (mesCad: number) => {
    if (mesCad <= 3) return Math.max(1, 10 - mesCad);
    return Math.max(1, 9 - mesCad);
  };

  // Fix suplentes
  const { data: sups, error: e1 } = await supabase.from("suplentes").select("id, nome, created_at, retirada_mensal_valor, retirada_mensal_meses, plotagem_qtd, plotagem_valor_unit, liderancas_qtd, liderancas_valor_unit, fiscais_qtd, fiscais_valor_unit");
  if (e1) return new Response(JSON.stringify({ error: e1.message }), { status: 500 });

  for (const s of sups || []) {
    const dt = new Date(s.created_at);
    const mesCad = dt.getMonth() + 1;
    const mesesCorreto = calcMeses(mesCad);
    const retirada = (s.retirada_mensal_valor || 0) * mesesCorreto;
    const plotagem = (s.plotagem_qtd || 0) * (s.plotagem_valor_unit || 0);
    const liderancas = (s.liderancas_qtd || 0) * (s.liderancas_valor_unit || 0);
    const fiscais = (s.fiscais_qtd || 0) * (s.fiscais_valor_unit || 0);
    const total = retirada + plotagem + liderancas + fiscais;

    if (s.retirada_mensal_meses !== mesesCorreto) {
      const { error } = await supabase.from("suplentes").update({
        retirada_mensal_meses: mesesCorreto,
        total_campanha: total
      }).eq("id", s.id);
      results.push(`SUP ${s.nome}: ${s.retirada_mensal_meses} → ${mesesCorreto} meses (cad mês ${mesCad}) total=${total} ${error ? "ERRO: " + error.message : "OK"}`);
    }
  }

  // Fix liderancas
  const { data: lids, error: e2 } = await supabase.from("liderancas").select("id, nome, created_at, retirada_mensal_meses");
  if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 500 });

  for (const l of lids || []) {
    const dt = new Date(l.created_at);
    const mesCad = dt.getMonth() + 1;
    const mesesCorreto = calcMeses(mesCad);

    if (l.retirada_mensal_meses !== mesesCorreto) {
      const { error } = await supabase.from("liderancas").update({
        retirada_mensal_meses: mesesCorreto
      }).eq("id", l.id);
      results.push(`LID ${l.nome}: ${l.retirada_mensal_meses} → ${mesesCorreto} meses (cad mês ${mesCad}) ${error ? "ERRO: " + error.message : "OK"}`);
    }
  }

  // Fix admin
  const { data: adms, error: e3 } = await supabase.from("administrativo").select("id, nome, created_at, valor_contrato_meses");
  if (e3) return new Response(JSON.stringify({ error: e3.message }), { status: 500 });

  for (const a of adms || []) {
    const dt = new Date(a.created_at);
    const mesCad = dt.getMonth() + 1;
    const mesesCorreto = calcMeses(mesCad);

    if (a.valor_contrato_meses !== mesesCorreto) {
      const { error } = await supabase.from("administrativo").update({
        valor_contrato_meses: mesesCorreto
      }).eq("id", a.id);
      results.push(`ADM ${a.nome}: ${a.valor_contrato_meses} → ${mesesCorreto} meses (cad mês ${mesCad}) ${error ? "ERRO: " + error.message : "OK"}`);
    }
  }

  return new Response(JSON.stringify({ updated: results.length, results }), {
    headers: { "Content-Type": "application/json" }
  });
});
