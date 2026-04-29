
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function check() {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const url = env.match(/SUPABASE_URL="(.+)"/)[1];
    const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="(.+)"/);
    const key = keyMatch ? keyMatch[1] : "";
    
    if (!key) {
        console.error("Erro: SUPABASE_PUBLISHABLE_KEY não encontrada no .env");
        return;
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase.from('usuarios').select('nome_usuario, email, cargo, user_id');
    
    if (error) {
        console.error("Erro:", error.message);
        return;
    }

    console.log("=== LISTA DE USUÁRIOS E CARGOS ===");
    data.forEach(u => {
      console.log(`Usuário: ${u.nome_usuario} | ID: ${u.user_id} | Cargo: ${u.cargo || 'admin'}`);
    });
    console.log("==================================");
  } catch (e) {
    console.error("Erro:", e.message);
  }
}

check();
