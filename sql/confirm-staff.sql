-- XVI C.O.R Jovem — modelo para liberar login da equipe (Auth)
-- NÃO coloque e-mails nem senhas reais neste arquivo se o repositório for público.
-- Prefira: Authentication → Users → Add user → marque Auto Confirm User.
--
-- Se precisar usar SQL, substitua os placeholders abaixo e rode só no SQL Editor
-- (não faça commit com dados reais).

/*
create extension if not exists pgcrypto with schema extensions;

-- Exemplo (edite antes de rodar; não versionar com dados reais):
-- delete from auth.identities where user_id in (
--   select id from auth.users where lower(email) in ('email1@exemplo.com')
-- );
-- delete from auth.users where lower(email) in ('email1@exemplo.com');
--
-- Depois crie o usuário pelo painel do Supabase (recomendado)
-- ou use a Admin API com a service_role key (nunca no front-end).
*/

-- Conferência genérica (seguro versionar):
-- select email, email_confirmed_at is not null as confirmado
-- from auth.users
-- order by created_at desc
-- limit 20;
