-- Admin da equipe — pode redefinir senha de qualquer usuário (via Edge Function admin-users)
-- Rodar no SQL Editor do Supabase

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'efserafimflu@gmail.com',
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Promove efserafimflu@gmail.com a admin (crie o usuário antes no Authentication se ainda não existir)
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'role', 'admin',
    'display_name', coalesce(raw_user_meta_data ->> 'display_name', 'Administrador'),
    'must_change_password', coalesce((raw_user_meta_data ->> 'must_change_password')::boolean, false)
  )
where lower(email) = 'efserafimflu@gmail.com';

notify pgrst, 'reload schema';
