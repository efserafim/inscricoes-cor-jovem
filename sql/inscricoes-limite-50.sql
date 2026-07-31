-- Limite de inscrições de cursistas: 50 vagas (depois encerra)
-- Rodar no SQL Editor do Supabase (idempotente)

create or replace function public.enforce_inscricoes_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim constant int := 50;
  n bigint;
begin
  if tg_op = 'UPDATE'
     and old.status is distinct from 'cancelada'
     and new.status is not distinct from 'cancelada' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status is not distinct from 'cancelada' then
    return new;
  end if;

  perform pg_advisory_xact_lock(872014001);

  select count(*) into n
  from public.inscricoes_cor_jovem
  where status is distinct from 'cancelada'
    and (tg_op = 'INSERT' or id is distinct from new.id);

  if n >= lim then
    raise exception 'VAGAS_ESGOTADAS'
      using errcode = 'P0001',
            hint = 'Limite de inscricoes ativas atingido';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
