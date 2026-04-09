import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/consultar-bigquery`;

async function invoke(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

Deno.test("buscar_candidatos retorna resultados para 2024", async () => {
  const { status, data } = await invoke({
    consulta: "buscar_candidatos",
    params: { ano: "2024", nome: "ADRIANA", limit: "5" },
  });
  assertEquals(status, 200);
  assert(data.total > 0, "Deve retornar ao menos 1 candidato");
  assert(data.dados[0].nm_candidato.includes("ADRIANA"), "Nome deve conter ADRIANA");
  assert(data.dados[0].nr_candidato, "Deve ter número de urna");
  assert(data.dados[0].sg_partido, "Deve ter partido");
  assert(data.dados[0].total_votos, "Deve ter total_votos");
});

Deno.test("buscar_candidatos retorna bairros_zona para 2024", async () => {
  const { status, data } = await invoke({
    consulta: "buscar_candidatos",
    params: { ano: "2024", nome: "CARLOS", municipio: "GOIANIA", limit: "3" },
  });
  assertEquals(status, 200);
  if (data.total > 0) {
    // bairros_zona pode ser null se não houver match, mas o campo deve existir
    assert("bairros_zona" in data.dados[0], "Deve ter campo bairros_zona");
  }
});

Deno.test("buscar_candidatos 2016 funciona sem bairros", async () => {
  const { status, data } = await invoke({
    consulta: "buscar_candidatos",
    params: { ano: "2016", nome: "MARIA", limit: "5" },
  });
  assertEquals(status, 200);
  assert(data.total > 0, "Deve retornar candidatos de 2016");
  assertEquals(data.dados[0].bairros_zona, null, "2016 não tem bairros");
});

Deno.test("candidatos_2024 retorna lista", async () => {
  const { status, data } = await invoke({
    consulta: "candidatos_2024",
    params: { nome: "ADRIANA", limit: "5" },
  });
  assertEquals(status, 200);
  assert(data.total > 0);
});

Deno.test("votacao_2024 retorna votos", async () => {
  const { status, data } = await invoke({
    consulta: "votacao_2024",
    params: { municipio: "GOIANIA", limit: "5" },
  });
  assertEquals(status, 200);
  assert(data.total > 0);
  assert(parseInt(data.dados[0].qt_votos_nominais) > 0, "Deve ter votos");
});

Deno.test("consulta inválida retorna 400", async () => {
  const { status, data } = await invoke({ consulta: "xyz" });
  assertEquals(status, 400);
  assert(data.error);
});

Deno.test("campos essenciais do frontend presentes", async () => {
  const { data } = await invoke({
    consulta: "buscar_candidatos",
    params: { ano: "2024", nome: "REIS", limit: "1" },
  });
  if (data.total > 0) {
    const r = data.dados[0];
    const campos = ["nm_candidato", "nm_urna_candidato", "nr_candidato", "sg_partido",
      "ds_cargo", "nm_ue", "ds_sit_tot_turno", "total_votos", "bairros_zona"];
    for (const c of campos) {
      assert(c in r, `Campo '${c}' deve existir na resposta`);
    }
  }
});
