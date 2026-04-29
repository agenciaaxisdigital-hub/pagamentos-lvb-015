-- Adiciona o novo papel 'administrativo' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrativo';

-- Comentário para documentação
COMMENT ON TYPE public.app_role IS 'Papéis de acesso do sistema: admin (total), recepcao (limitado), administrativo (apenas admin e pagamentos admin)';
