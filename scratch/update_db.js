
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const url = env.match(/SUPABASE_URL="(.+)"/)[1];
    // Tenta pegar a service role key se estiver no .env, senão tenta a anon key (mas alter table exige privilégios)
    const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY="(.+)"/);
    const key = keyMatch ? keyMatch[1] : env.match(/SUPABASE_PUBLISHABLE_KEY="(.+)"/)[1];

    const supabase = createClient(url, key);

    console.log("Adicionando coluna 'cargo' na tabela 'usuarios'...");
    
    // Como não podemos rodar ALTER TABLE direto via client JS sem RPC, 
    // vamos tentar fazer um insert com a nova coluna. Se o banco aceitar, a coluna já existe ou o Supabase a criará (improvável).
    // O ideal é usar SQL direto. Vou te passar o SQL para rodar no Dashboard.
    
    console.log("--------------------------------------------------");
    console.log("POR FAVOR, RODE ESTE SQL NO DASHBOARD DO SUPABASE:");
    console.log("--------------------------------------------------");
    console.log("ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cargo text DEFAULT 'admin';");
    console.log("--------------------------------------------------");
  } catch (e) {
    console.error("Erro:", e.message);
  }
}

run();
