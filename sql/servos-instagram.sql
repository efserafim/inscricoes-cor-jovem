-- Campo Instagram na ficha de servos
-- Rodar no SQL Editor do Supabase (idempotente)

alter table public.servos_cor_jovem
  add column if not exists instagram text;

notify pgrst, 'reload schema';
