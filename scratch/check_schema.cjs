
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

try {
  const env = fs.readFileSync('.env', 'utf8');
  const urlMatch = env.match(/SUPABASE_URL="(.+)"/);
  const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="(.+)"/);
  const supabase = createClient(urlMatch[1], keyMatch[1]);

  async function checkColumns() {
    // Tenta pegar um registro para ver as colunas
    const { data, error } = await supabase.from('liderancas').select('*').limit(1);
    if (error) {
       console.log("Erro ao ler tabela liderancas:", error.message);
       return;
    }
    if (data && data.length > 0) {
      console.log("Colunas encontradas na tabela liderancas:", Object.keys(data[0]).join(", "));
    } else {
      console.log("Tabela liderancas está vazia, tentando outra forma...");
      // Tenta inserir um objeto vazio apenas para pegar o erro de colunas (hack seguro)
      const { error: insertError } = await supabase.from('liderancas').insert({}).select();
      console.log("Erro de inserção (útil para ver esquema):", insertError ? insertError.message : "Sem erro");
    }
  }
  checkColumns();
} catch (e) { console.error(e.message); }
