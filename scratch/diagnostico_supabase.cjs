
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Tenta ler do .env manualmente
try {
  const env = fs.readFileSync('.env', 'utf8');
  const urlMatch = env.match(/SUPABASE_URL="(.+)"/);
  const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="(.+)"/);

  if (!urlMatch || !keyMatch) {
    console.error("Não foi possível encontrar as chaves no .env");
    process.exit(1);
  }

  const supabase = createClient(urlMatch[1], keyMatch[1]);

  async function diagnose() {
    console.log("Conectando em:", urlMatch[1]);
    
    // Testa conexão básica
    const { data, error } = await supabase
      .from('liderancas')
      .select('nome')
      .limit(1);

    if (error) {
      console.error("Erro ao conectar no banco liderancas:", error.message);
    } else {
      console.log("Conexão com a tabela 'liderancas' OK!");
    }

    // Testa se a função v4 existe para este cliente
    const { error: rpcError } = await supabase.rpc('upsert_lideranca_v4', { payload: {} });
    
    if (rpcError && rpcError.message.includes("Could not find the function")) {
      console.error("ERRO CRÍTICO: A função 'upsert_lideranca_v4' NÃO FOI ENCONTRADA neste banco.");
    } else if (rpcError) {
      console.log("A função EXISTE, mas retornou um erro esperado (payload vazio):", rpcError.message);
    } else {
      console.log("A função EXISTE e respondeu com sucesso!");
    }
  }

  diagnose();
} catch (e) {
  console.error("Erro ao ler arquivo:", e.message);
}
