## Migração BigQuery → Supabase (Opção B - Espelhada)

### 1. Criar tabelas no Supabase
- `tse_candidatos` (candidatos por ano/município)
- `tse_votacao` (votos por zona/município) 
- `tse_eleitorado` (bairros por zona, só 2020+)
- Índices otimizados para as queries existentes

### 2. Edge Function `importar-tse`
- Lê do BigQuery em batches de 1000
- Insere no Supabase via service_role
- Executa por ano (2016, 2018, 2020, 2022, 2024)

### 3. Atualizar `consultar-bigquery`
- Queries passam a consultar tabelas locais Supabase
- Mesma interface de resposta (sem quebrar frontend)
- BigQuery vira fallback temporário

### 4. Validar
- Contar registros importados
- Testar BuscaTSE com dados locais
- Confirmar campo Setor automático funciona