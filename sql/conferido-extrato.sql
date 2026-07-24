-- Conferência no extrato bancário (tesoureiro)
-- Rodar no SQL Editor do Supabase (idempotente)

alter table public.pagamentos_camisas
  add column if not exists conferido_extrato boolean not null default false;

alter table public.pagamentos_camisas
  add column if not exists conferido_extrato_em timestamptz;

alter table public.pagamentos_contribuicao
  add column if not exists conferido_extrato boolean not null default false;

alter table public.pagamentos_contribuicao
  add column if not exists conferido_extrato_em timestamptz;

create index if not exists pagamentos_camisas_extrato_idx
  on public.pagamentos_camisas (status, conferido_extrato)
  where status = 'confirmado';

create index if not exists pagamentos_contribuicao_extrato_idx
  on public.pagamentos_contribuicao (status, conferido_extrato)
  where status = 'confirmado';

notify pgrst, 'reload schema';
