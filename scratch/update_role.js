
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function update() {
  try {
    const env = fs.readFileSync('.env', 'utf8');
    const url = env.match(/SUPABASE_URL="(.+)"/)[1];
    const keyMatch = env.match(/SUPABASE_PUBLISHABLE_KEY="(.+)"/);
    const key = keyMatch ? keyMatch[1] : "";

    const supabase = createClient(url, key);

    // Tentativa de update (se o RLS permitir)
    const { data, error } = await supabase
      .from('usuarios')
      .update({ cargo: 'financeiro_admin' })
      .eq('nome_usuario', 'teste01');
    
    if (error) {
        console.error("Erro ao atualizar (RLS bloqueou):", error.message);
        console.log("DICA: Use o Dashboard do Supabase para rodar este SQL:");
        console.log("UPDATE usuarios SET cargo = 'financeiro_admin' WHERE nome_usuario = 'teste01';");
        return;
    }

    console.log("Sucesso! O usuário 'teste01' agora é um Gestor Administrativo.");
  } catch (e) {
    console.error("Erro:", e.message);
  }
}

update();
