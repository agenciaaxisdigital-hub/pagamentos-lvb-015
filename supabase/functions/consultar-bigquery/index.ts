import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sanitize(str: string): string {
  return (str || "").replace(/'/g, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Body JSON inválido", detail: String(e) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { consulta, params = {} } = body;
    const supaUrl = Deno.env.get("SUPA_URL") || Deno.env.get("SUPABASE_URL")!;
    const supaKey = Deno.env.get("SUPA_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supaUrl, supaKey);

    if (!consulta) {
      return new Response(
        JSON.stringify({
          error: "Consulta inválida",
          consultas_disponiveis: ["buscar_candidatos", "candidatos_2024", "votacao_2024", "candidatos_historico"],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let rows: Record<string, string>[] = [];

    if (consulta === "buscar_candidatos") {
      rows = await buscarCandidatos(supabase, params);
    } else if (consulta === "candidatos_2024") {
      rows = await candidatosPorAno(supabase, params, 2024);
    } else if (consulta === "candidatos_historico") {
      rows = await candidatosPorAno(supabase, params, parseInt(params.ano || "2024"));
    } else if (consulta === "votacao_2024") {
      rows = await votacaoPorAno(supabase, params);
    } else {
      return new Response(
        JSON.stringify({ error: "Consulta não suportada", consulta }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ consulta, total: rows.length, dados: rows }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Query error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Main search: candidates with aggregated votes and neighborhood data
 * Replicates the BigQuery "buscar_candidatos" query using local Supabase tables
 */
async function buscarCandidatos(supabase: any, params: Record<string, string>): Promise<Record<string, string>[]> {
  const ano = parseInt(params.ano || "2024");
  const limit = parseInt(params.limit || "50");
  const nome = sanitize(params.nome || "");
  const municipio = sanitize(params.municipio || "");
  const municipios = params.municipios
    ? params.municipios.split(",").map((m: string) => sanitize(m).toUpperCase())
    : [];

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("SUPABASE_DB_URL não configurado");

  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
  const client = new Client(dbUrl);
  await client.connect();

  try {
    // Build WHERE filters
    const conditions = [`c.ano = ${ano}`, `c.ds_cargo = 'VEREADOR'`];
    
    if (nome) {
      conditions.push(`(UPPER(c.nm_candidato) LIKE '%${nome.toUpperCase()}%' OR UPPER(c.nm_urna_candidato) LIKE '%${nome.toUpperCase()}%')`);
    }
    if (municipio) {
      conditions.push(`UPPER(c.nm_ue) LIKE '%${municipio.toUpperCase()}%'`);
    }
    if (municipios.length > 0) {
      const inList = municipios.map((m: string) => `'${m}'`).join(",");
      conditions.push(`UPPER(c.nm_ue) IN (${inList})`);
    }

    const whereClause = conditions.join(" AND ");

    // Check if we have bairro data for this year
    const hasBairros = ano >= 2020;

    let sql: string;
    if (hasBairros) {
      sql = `
        WITH votos_agg AS (
          SELECT nr_candidato, nm_municipio, SUM(qt_votos_nominais) as total_votos
          FROM public.tse_votacao WHERE ano = ${ano}
          GROUP BY nr_candidato, nm_municipio
        ),
        top_zona AS (
          SELECT nr_candidato, nm_municipio, cd_municipio, nr_zona,
                 ROW_NUMBER() OVER (PARTITION BY nr_candidato, nm_municipio ORDER BY SUM(qt_votos_nominais) DESC) as rn
          FROM public.tse_votacao WHERE ano = ${ano}
          GROUP BY nr_candidato, nm_municipio, cd_municipio, nr_zona
        ),
        bairros_agg AS (
          SELECT e.nr_zona, e.cd_municipio,
                 STRING_AGG(e.nm_bairro, ', ' ORDER BY e.qt_eleitor_secao DESC) as bairros_zona
          FROM public.tse_eleitorado e
          WHERE e.ano = ${ano}
          GROUP BY e.nr_zona, e.cd_municipio
        )
        SELECT c.nm_candidato, c.nm_urna_candidato, c.nr_candidato, c.sg_partido,
               c.ds_cargo, c.nm_ue, c.ds_sit_tot_turno, c.nr_turno::text,
               c.sq_candidato,
               COALESCE(v.total_votos, 0)::text as total_votos,
               b.bairros_zona
        FROM public.tse_candidatos c
        LEFT JOIN votos_agg v ON c.nr_candidato = v.nr_candidato AND UPPER(c.nm_ue) = UPPER(v.nm_municipio)
        LEFT JOIN top_zona tz ON c.nr_candidato = tz.nr_candidato AND UPPER(c.nm_ue) = UPPER(tz.nm_municipio) AND tz.rn = 1
        LEFT JOIN bairros_agg b ON tz.nr_zona = b.nr_zona AND tz.cd_municipio = b.cd_municipio
        WHERE ${whereClause}
        ORDER BY COALESCE(v.total_votos, 0) DESC
        LIMIT ${limit}
      `;
    } else {
      sql = `
        WITH votos_agg AS (
          SELECT nr_candidato, nm_municipio, SUM(qt_votos_nominais) as total_votos
          FROM public.tse_votacao WHERE ano = ${ano}
          GROUP BY nr_candidato, nm_municipio
        )
        SELECT c.nm_candidato, c.nm_urna_candidato, c.nr_candidato, c.sg_partido,
               c.ds_cargo, c.nm_ue, c.ds_sit_tot_turno, c.nr_turno::text,
               c.sq_candidato,
               COALESCE(v.total_votos, 0)::text as total_votos,
               NULL as bairros_zona
        FROM public.tse_candidatos c
        LEFT JOIN votos_agg v ON c.nr_candidato = v.nr_candidato AND UPPER(c.nm_ue) = UPPER(v.nm_municipio)
        WHERE ${whereClause}
        ORDER BY COALESCE(v.total_votos, 0) DESC
        LIMIT ${limit}
      `;
    }

    const result = await client.queryArray(sql);
    return result.rows.map((row: any[]) => ({
      nm_candidato: row[0] || "",
      nm_urna_candidato: row[1] || "",
      nr_candidato: row[2] || "",
      sg_partido: row[3] || "",
      ds_cargo: row[4] || "",
      nm_ue: row[5] || "",
      ds_sit_tot_turno: row[6] || "",
      nr_turno: String(row[7] || "1"),
      sq_candidato: row[8] || "",
      total_votos: String(row[9] || "0"),
      bairros_zona: row[10] || null,
    }));
  } finally {
    await client.end();
  }
}

/**
 * Simple candidate list by year
 */
async function candidatosPorAno(supabase: any, params: Record<string, string>, ano: number): Promise<Record<string, string>[]> {
  const limit = parseInt(params.limit || "100");
  const nome = sanitize(params.nome || "");
  const municipio = sanitize(params.municipio || "");

  let query = supabase
    .from("tse_candidatos")
    .select("nm_candidato, nm_urna_candidato, nr_candidato, sg_partido, ds_cargo, nm_ue, ds_sit_tot_turno, nr_turno")
    .eq("ano", ano)
    .eq("ds_cargo", "VEREADOR")
    .order("nm_candidato")
    .limit(limit);

  if (nome) query = query.ilike("nm_candidato", `%${nome}%`);
  if (municipio) query = query.ilike("nm_ue", `%${municipio}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((r: any) => ({
    nm_candidato: r.nm_candidato || "",
    nm_urna_candidato: r.nm_urna_candidato || "",
    nr_candidato: r.nr_candidato || "",
    sg_partido: r.sg_partido || "",
    ds_cargo: r.ds_cargo || "",
    nm_ue: r.nm_ue || "",
    ds_sit_tot_turno: r.ds_sit_tot_turno || "",
    nr_turno: String(r.nr_turno || "1"),
  }));
}

/**
 * Vote details for 2024
 */
async function votacaoPorAno(supabase: any, params: Record<string, string>): Promise<Record<string, string>[]> {
  const limit = parseInt(params.limit || "100");
  const nome = sanitize(params.nome || "");
  const municipio = sanitize(params.municipio || "");
  const numero = sanitize(params.numero || "");

  let query = supabase
    .from("tse_votacao")
    .select("nm_candidato, nr_candidato, qt_votos_nominais, nm_municipio, nr_zona, nr_turno")
    .eq("ano", 2024)
    .order("qt_votos_nominais", { ascending: false })
    .limit(limit);

  if (nome) query = query.ilike("nm_candidato", `%${nome}%`);
  if (municipio) query = query.ilike("nm_municipio", `%${municipio}%`);
  if (numero) query = query.eq("nr_candidato", numero);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((r: any) => ({
    nm_candidato: r.nm_candidato || "",
    nr_candidato: r.nr_candidato || "",
    qt_votos_nominais: String(r.qt_votos_nominais || "0"),
    nm_municipio: r.nm_municipio || "",
    nr_zona: r.nr_zona || "",
    nr_turno: String(r.nr_turno || "1"),
  }));
}
