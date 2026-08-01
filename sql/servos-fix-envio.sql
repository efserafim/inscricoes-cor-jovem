-- Corrige envio da ficha pública de servos (Supabase → SQL Editor)
-- Idempotente — pode rodar mais de uma vez.
-- Se der erro "relation servos_cor_jovem does not exist", rode antes a seção
-- de servos em sql/setup.sql (create table servos_cor_jovem …).

alter table public.servos_cor_jovem
  add column if not exists instagram text;

alter table public.servos_cor_jovem
  add column if not exists funcoes_preferidas text[] default '{}';

alter table public.servos_cor_jovem
  alter column equipe drop not null;

grant select, insert, update, delete on public.servos_cor_jovem to anon, authenticated;

drop policy if exists "Servos insert publico" on public.servos_cor_jovem;
create policy "Servos insert publico"
  on public.servos_cor_jovem for insert to anon, authenticated with check (true);

notify pgrst, 'reload schema';
