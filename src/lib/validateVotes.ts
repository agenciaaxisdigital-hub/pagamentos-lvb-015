import { supabase } from "@/integrations/supabase/client";

/**
 * Normaliza nome removendo acentos e uppercase
 */
export function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Calcula similaridade simples entre dois nomes normalizados
 * Retorna true se um contém o outro ou se são muito parecidos
 */
export function namesMatch(dbName: string, tseName: string): boolean {
  const a = normalize(dbName);
  const b = normalize(tseName);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Check if all words of the shorter name appear in the longer
  const wordsA = a.split(/\s+/);
  const wordsB = b.split(/\s+/);
  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longer = wordsA.length > wordsB.length ? wordsA : wordsB;
  const matchCount = shorter.filter(w => longer.some(lw => lw === w)).length;
  return matchCount >= Math.max(2, shorter.length * 0.7);
}

export interface ValidationResult {
  id: string;
  nome: string;
  votosAntigo: number;
  votosNovo: number;
  updated: boolean;
}

/**
 * Valida e atualiza votos de todos os suplentes cadastrados
 * comparando com os dados do TSE via edge function + JSON de votos
 */
export async function validateAllVotes(
  onProgress?: (current: number, total: number, nome: string) => void
): Promise<ValidationResult[]> {
  // 1. Load all suplentes
  const { data: suplentes, error } = await supabase
    .from("suplentes")
    .select("id, nome, total_votos, regiao_atuacao")
    .order("nome");

  if (error || !suplentes) throw new Error(error?.message || "Erro ao carregar suplentes");

  // 2. Load votes JSON
  let votosMap: Record<string, number> = {};
  try {
    const resp = await fetch("/tse-votos-go-2024.json", { cache: "force-cache" });
    if (resp.ok) votosMap = await resp.json();
  } catch {
    // continue without local votes
  }

  const results: ValidationResult[] = [];

  // 3. For each suplente, search TSE by name
  for (let i = 0; i < suplentes.length; i++) {
    const s = suplentes[i];
    onProgress?.(i + 1, suplentes.length, s.nome);

    try {
      // Search TSE for this name
      const { data, error: fnError } = await supabase.functions.invoke("buscar-candidato-tse", {
        body: { nome: s.nome.split(" ")[0] + " " + (s.nome.split(" ").slice(-1)[0] || ""), ano: 2024 },
      });

      if (fnError || !data?.resultados) continue;

      // Find best match by name similarity
      const candidatos = data.resultados as Array<{
        id: number;
        nome: string;
        nomeUrna: string;
        codigoMunicipio: string;
      }>;

      let bestMatch: typeof candidatos[0] | null = null;
      for (const c of candidatos) {
        if (namesMatch(s.nome, c.nome) || namesMatch(s.nome, c.nomeUrna)) {
          bestMatch = c;
          break;
        }
      }

      if (!bestMatch) continue;

      // Get votes from JSON
      const key = `${bestMatch.codigoMunicipio}:${bestMatch.id}`;
      const votosNovo = votosMap[key] || 0;

      if (votosNovo > 0 && votosNovo !== (s.total_votos || 0)) {
        // Update in DB
        const { error: updateError } = await supabase
          .from("suplentes")
          .update({ total_votos: votosNovo })
          .eq("id", s.id);

        results.push({
          id: s.id,
          nome: s.nome,
          votosAntigo: s.total_votos || 0,
          votosNovo,
          updated: !updateError,
        });
      }
    } catch {
      // skip this suplente
    }
  }

  return results;
}
