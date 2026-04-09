import { supabase } from "@/integrations/supabase/client";

export type RequiredDataValidationResult = {
  id: string;
  nome: string;
  campo: string;
  antes: string;
  depois: string;
  updated: boolean;
};

const MAX_CONCURRENCY = 3;

/**
 * Busca candidato no BigQuery pelo nome e município
 */
async function searchBigQuery(nome: string, municipio?: string) {
  const params: Record<string, string> = {
    nome: nome.replace(/'/g, ""),
    ano: "2024",
    limit: "5",
  };
  if (municipio) params.municipio = municipio.replace(/'/g, "");

  const { data, error } = await supabase.functions.invoke("consultar-bigquery", {
    body: { consulta: "buscar_candidatos", params },
  });

  if (error || !data?.dados) return null;
  return data.dados as Array<{
    nm_candidato: string;
    nm_urna_candidato: string;
    nr_candidato: string;
    sg_partido: string;
    ds_cargo: string;
    nm_ue: string;
    ds_sit_tot_turno: string;
    total_votos: string;
    bairros_zona?: string;
    sq_candidato?: string;
  }>;
}

function normalizeStr(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

/**
 * Tenta encontrar o melhor match pelo nome
 */
function findBestMatch(
  nome: string,
  candidatos: NonNullable<Awaited<ReturnType<typeof searchBigQuery>>>
) {
  const norm = normalizeStr(nome);
  // Exact match first
  const exact = candidatos.find(
    (c) => normalizeStr(c.nm_candidato) === norm || normalizeStr(c.nm_urna_candidato) === norm
  );
  if (exact) return exact;

  // Contains match
  const contains = candidatos.find(
    (c) => normalizeStr(c.nm_candidato).includes(norm) || norm.includes(normalizeStr(c.nm_candidato))
  );
  if (contains) return contains;

  // Word-based match
  const words = norm.split(/\s+/);
  return candidatos.find((c) => {
    const cWords = normalizeStr(c.nm_candidato).split(/\s+/);
    const matched = words.filter((w) => cWords.includes(w)).length;
    return matched >= Math.max(2, words.length * 0.6);
  }) || null;
}

/**
 * Verifica se o setor parece ser um nome de cidade ao invés de bairro
 */
function setorPareceCidade(setor: string): boolean {
  if (!setor || !setor.trim()) return false;
  const cityKeywords = [
    "APARECIDA", "GOIANIA", "GOIÂNIA", "ANAPOLIS", "ANÁPOLIS", "TRINDADE",
    "SENADOR CANEDO", "HIDROLANDIA", "HIDROLÂNDIA", "GOIANIRA", "NEROPOLIS",
    "NERÓPOLIS", "INHUMAS", "JATAI", "JATAÍ", "RIO VERDE", "LUZIANIA",
    "LUZIÂNIA", "CATALAO", "CATALÃO", "ITUMBIARA", "FORMOSA", "PLANALTINA",
    "VALPARAISO", "VALPARAÍSO", "ÁGUAS LINDAS"
  ];
  const upper = setor.toUpperCase().trim();
  return cityKeywords.some((kw) => upper === kw || upper.startsWith(kw + " DE") || upper.includes(kw));
}

/**
 * Valida e corrige dados de todos os suplentes cadastrados:
 * 1. Se regiao_atuacao contém nome de cidade → busca bairro correto via BigQuery
 * 2. Se total_votos diverge do TSE → atualiza
 * 3. Se partido/numero_urna/regiao_atuacao vazios → preenche via BigQuery
 */
export async function validateRequiredData(
  onProgress?: (current: number, total: number, nome: string) => void
): Promise<RequiredDataValidationResult[]> {
  const { data: suplentes, error } = await supabase
    .from("suplentes")
    .select("id, nome, partido, total_votos, numero_urna, regiao_atuacao, municipio_id")
    .order("nome");

  if (error || !suplentes) throw new Error(error?.message || "Erro ao carregar suplentes");

  // Load municipios for name lookup
  const { data: municipios } = await supabase.from("municipios").select("id, nome");
  const municipioMap = new Map((municipios || []).map((m) => [m.id, m.nome]));

  const results: RequiredDataValidationResult[] = [];
  let progress = 0;

  const worker = async (s: (typeof suplentes)[number]) => {
    progress += 1;
    onProgress?.(progress, suplentes.length, s.nome);

    try {
      const municipioNome = s.municipio_id ? municipioMap.get(s.municipio_id) : undefined;

      // Search BigQuery for this candidate
      const candidatos = await searchBigQuery(s.nome, municipioNome);
      if (!candidatos || candidatos.length === 0) return;

      const match = findBestMatch(s.nome, candidatos);
      if (!match) return;

      const payload: Record<string, string | number> = {};
      const changes: RequiredDataValidationResult[] = [];

      // 1. Fix regiao_atuacao if it looks like a city name OR is empty
      const setorVazio = !s.regiao_atuacao || !s.regiao_atuacao.trim();
      const setorECidade = !setorVazio && setorPareceCidade(s.regiao_atuacao || "");

      if ((setorVazio || setorECidade) && match.bairros_zona) {
        const bairros = match.bairros_zona.split(", ");
        const novoBairro = bairros[0];
        if (novoBairro && novoBairro.trim()) {
          payload.regiao_atuacao = novoBairro.trim();
          changes.push({
            id: s.id,
            nome: s.nome,
            campo: "regiao_atuacao",
            antes: s.regiao_atuacao || "(vazio)",
            depois: novoBairro.trim(),
            updated: false,
          });
        }
      }

      // 2. Validate/fix total_votos
      const votosTSE = parseInt(match.total_votos || "0", 10);
      const votosAtual = s.total_votos || 0;
      if (votosTSE > 0 && votosTSE !== votosAtual) {
        payload.total_votos = votosTSE;
        changes.push({
          id: s.id,
          nome: s.nome,
          campo: "total_votos",
          antes: String(votosAtual),
          depois: String(votosTSE),
          updated: false,
        });
      }

      // 3. Fill empty partido
      if ((!s.partido || !s.partido.trim()) && match.sg_partido) {
        payload.partido = match.sg_partido.trim();
        changes.push({
          id: s.id,
          nome: s.nome,
          campo: "partido",
          antes: "(vazio)",
          depois: match.sg_partido.trim(),
          updated: false,
        });
      }

      // 4. Fill empty numero_urna
      if ((!s.numero_urna || !s.numero_urna.trim()) && match.nr_candidato) {
        payload.numero_urna = match.nr_candidato.trim();
        changes.push({
          id: s.id,
          nome: s.nome,
          campo: "numero_urna",
          antes: "(vazio)",
          depois: match.nr_candidato.trim(),
          updated: false,
        });
      }

      if (!Object.keys(payload).length) return;

      const { error: updateError } = await supabase.from("suplentes").update(payload).eq("id", s.id);

      for (const c of changes) {
        c.updated = !updateError;
        results.push(c);
      }
    } catch {
      // skip
    }
  };

  for (let i = 0; i < suplentes.length; i += MAX_CONCURRENCY) {
    const chunk = suplentes.slice(i, i + MAX_CONCURRENCY);
    await Promise.all(chunk.map(worker));
  }

  return results;
}
