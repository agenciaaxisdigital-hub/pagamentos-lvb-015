import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hzhxrkurljrogxtzxmmb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aHhya3VybGpyb2d4dHp4bW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg1MzgsImV4cCI6MjA4OTA3NDUzOH0.lfvD6V7qCQ1eckbk2QbkSKF2rkz2uYEpmuqHqjquoPY'
const supabase = createClient(supabaseUrl, supabaseKey)

async function auditDatabase() {
  console.log('--- Inicianco Auditoria de Integridade de Dados ---')
  
  // 1. Verificar pagamentos órfãos
  const { data: pags, error: pErr } = await supabase.from('pagamentos').select('*')
  if (pErr) return console.error('Erro ao buscar pagamentos:', pErr)
  
  console.log(`Total de pagamentos: ${pags.length}`)
  
  const orfaos = pags.filter(p => !p.suplente_id && !p.lideranca_id && !p.admin_id)
  if (orfaos.length > 0) {
    console.warn(`[AVISO] Encontrados ${orfaos.length} pagamentos sem vínculo!`)
  } else {
    console.log('[OK] Nenhum pagamento órfão encontrado.')
  }
  
  // 2. Verificar duplicatas de "retirada" no mesmo mês para a mesma pessoa
  const dupMap: Record<string, boolean> = {}
  const dups: any[] = []
  
  pags.forEach(p => {
    if (p.categoria === 'retirada' || p.categoria === 'salario') {
      const id = p.suplente_id || p.lideranca_id || p.admin_id
      const key = `${id}-${p.mes}-${p.ano}-${p.categoria}`
      if (dupMap[key]) {
        dups.push(p)
      }
      dupMap[key] = true
    }
  })
  
  if (dups.length > 0) {
    console.warn(`[AVISO] Encontrados ${dups.length} pagamentos duplicados para o mesmo mês/categoria!`)
    dups.forEach(d => console.log(`  - ID: ${d.id}, Pessoa: ${d.suplente_id || d.lideranca_id || d.admin_id}, Mes: ${d.mes}`))
  } else {
    console.log('[OK] Nenhuma duplicata de pagamento mensal encontrada.')
  }

  // 3. Verificar inconsistências de valor (negativos)
  const negativos = pags.filter(p => p.valor < 0)
  if (negativos.length > 0) {
    console.error(`[ERRO] Encontrados ${negativos.length} pagamentos com valor negativo!`)
  } else {
    console.log('[OK] Todos os valores de pagamento são positivos.')
  }
  
  console.log('--- Auditoria Concluída ---')
}

auditDatabase()
