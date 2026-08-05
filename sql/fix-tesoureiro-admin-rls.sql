-- Admin também acessa tesouraria (alinha com o painel: isTesoureiro = admin | tesoureiro)
-- Rode no SQL Editor do Supabase se o painel Pagamentos não carrega/salva.

create or replace function public.is_tesoureiro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('tesoureiro', 'admin'),
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'efserafimflu@gmail.com',
    false
  );
$$;

revoke all on function public.is_tesoureiro() from public;
grant execute on function public.is_tesoureiro() to authenticated;

notify pgrst, 'reload schema';
