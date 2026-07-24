-- PIX: camisa (cursistas + servos) e taxa de contribuição (servos)
-- Rodar no SQL Editor do Supabase (idempotente).

create or replace function public.is_tesoureiro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'tesoureiro',
    false
  );
$$;

revoke all on function public.is_tesoureiro() from public;
grant execute on function public.is_tesoureiro() to authenticated;

-- ─── Config compartilhada ───────────────────────────────────────────────────

create table if not exists public.config_camisa_pix (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  pagamentos_liberados boolean not null default false,
  contribuicoes_liberadas boolean not null default false,
  chave_pix text,
  tipo_chave text check (
    tipo_chave is null
    or tipo_chave in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')
  ),
  nome_recebedor text,
  cidade text,
  valor_camisa numeric(10,2),
  valor_contribuicao_servo numeric(10,2),
  mensagem text
);

alter table public.config_camisa_pix
  add column if not exists contribuicoes_liberadas boolean not null default false;
alter table public.config_camisa_pix
  add column if not exists valor_contribuicao_servo numeric(10,2);

drop trigger if exists trg_config_camisa_pix_updated_at on public.config_camisa_pix;
create trigger trg_config_camisa_pix_updated_at
  before update on public.config_camisa_pix
  for each row execute function public.set_updated_at();

insert into public.config_camisa_pix (id)
select gen_random_uuid()
where not exists (select 1 from public.config_camisa_pix);

alter table public.config_camisa_pix enable row level security;

drop policy if exists "Config pix select tesoureiro" on public.config_camisa_pix;
create policy "Config pix select tesoureiro"
  on public.config_camisa_pix for select to authenticated
  using (public.is_tesoureiro());

drop policy if exists "Config pix update tesoureiro" on public.config_camisa_pix;
create policy "Config pix update tesoureiro"
  on public.config_camisa_pix for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

drop policy if exists "Config pix insert tesoureiro" on public.config_camisa_pix;
create policy "Config pix insert tesoureiro"
  on public.config_camisa_pix for insert to authenticated
  with check (public.is_tesoureiro());

grant select, insert, update on public.config_camisa_pix to authenticated;

-- ─── Pagamentos camisa ──────────────────────────────────────────────────────

create table if not exists public.pagamentos_camisas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tipo_pessoa text not null check (tipo_pessoa in ('cursista', 'servo')),
  pessoa_id uuid not null,
  protocolo text not null,
  nome text not null,
  telefone text,
  tamanho_camisa text,
  valor_esperado numeric(10,2),
  valor_informado numeric(10,2),
  status text not null default 'aguardando_pagamento'
    check (status in (
      'aguardando_pagamento', 'valor_confere', 'divergente', 'confirmado', 'rejeitado'
    )),
  comprovante_url text,
  comprovante_path text,
  enviado_em timestamptz,
  confirmado_por uuid,
  confirmado_em timestamptz,
  nota_tesoureiro text,
  unique (tipo_pessoa, pessoa_id)
);

drop trigger if exists trg_pagamentos_camisas_updated_at on public.pagamentos_camisas;
create trigger trg_pagamentos_camisas_updated_at
  before update on public.pagamentos_camisas
  for each row execute function public.set_updated_at();

create index if not exists pagamentos_camisas_status_idx
  on public.pagamentos_camisas (status);
create index if not exists pagamentos_camisas_protocolo_idx
  on public.pagamentos_camisas (protocolo);

alter table public.pagamentos_camisas enable row level security;

drop policy if exists "Pag camisas select tesoureiro" on public.pagamentos_camisas;
create policy "Pag camisas select tesoureiro"
  on public.pagamentos_camisas for select to authenticated
  using (public.is_tesoureiro());

drop policy if exists "Pag camisas update tesoureiro" on public.pagamentos_camisas;
create policy "Pag camisas update tesoureiro"
  on public.pagamentos_camisas for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

grant select, update on public.pagamentos_camisas to authenticated;

-- ─── Pagamentos contribuição (servos) ───────────────────────────────────────

create table if not exists public.pagamentos_contribuicao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pessoa_id uuid not null unique
    references public.servos_cor_jovem(id) on delete cascade,
  protocolo text not null,
  nome text not null,
  telefone text,
  valor_esperado numeric(10,2),
  valor_informado numeric(10,2),
  status text not null default 'aguardando_pagamento'
    check (status in (
      'aguardando_pagamento', 'valor_confere', 'divergente', 'confirmado', 'rejeitado'
    )),
  comprovante_url text,
  comprovante_path text,
  enviado_em timestamptz,
  confirmado_por uuid,
  confirmado_em timestamptz,
  nota_tesoureiro text
);

drop trigger if exists trg_pagamentos_contribuicao_updated_at on public.pagamentos_contribuicao;
create trigger trg_pagamentos_contribuicao_updated_at
  before update on public.pagamentos_contribuicao
  for each row execute function public.set_updated_at();

create index if not exists pagamentos_contribuicao_status_idx
  on public.pagamentos_contribuicao (status);

alter table public.pagamentos_contribuicao enable row level security;

drop policy if exists "Pag contrib select tesoureiro" on public.pagamentos_contribuicao;
create policy "Pag contrib select tesoureiro"
  on public.pagamentos_contribuicao for select to authenticated
  using (public.is_tesoureiro());

drop policy if exists "Pag contrib update tesoureiro" on public.pagamentos_contribuicao;
create policy "Pag contrib update tesoureiro"
  on public.pagamentos_contribuicao for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

grant select, update on public.pagamentos_contribuicao to authenticated;

-- ─── Storage comprovantes ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('comprovantes-camisas', 'comprovantes-camisas', true)
on conflict (id) do nothing;

drop policy if exists "Comprovantes upload publico" on storage.objects;
create policy "Comprovantes upload publico"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'comprovantes-camisas'
    and name ~* '\.(jpe?g|png|webp|gif|pdf)$'
  );

drop policy if exists "Comprovantes leitura" on storage.objects;
create policy "Comprovantes leitura"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'comprovantes-camisas');

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.protocolo_de_uuid(p_id uuid)
returns text
language sql
immutable
as $$
  select upper(left(replace(p_id::text, '-', ''), 8));
$$;

-- Nota: o front usa slice(0,8) do UUID COM hífens → 8 hex antes do 1º hífen.
-- Alinhar com o painel: upper(left(id::text, 8))
create or replace function public.protocolo_painel(p_id uuid)
returns text
language sql
immutable
as $$
  select upper(left(p_id::text, 8));
$$;

-- ─── Config pública ─────────────────────────────────────────────────────────

-- DROP necessário: versões antigas podem ter defaults nos parâmetros
-- (CREATE OR REPLACE não remove defaults — erro 42P13).
drop function if exists public.get_pix_camisa_publico();
drop function if exists public.get_pix_publico();
drop function if exists public.consultar_pagamento_camisa(text);
drop function if exists public.enviar_comprovante_camisa(uuid, text, numeric, text, text);
drop function if exists public.consultar_pagamento_contribuicao(text);
drop function if exists public.enviar_comprovante_contribuicao(uuid, text, numeric, text, text);

create or replace function public.get_pix_publico()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.config_camisa_pix%rowtype;
  camisa_ok boolean;
  contrib_ok boolean;
begin
  select * into c from public.config_camisa_pix order by created_at asc limit 1;
  if not found then
    return jsonb_build_object(
      'liberado', false,
      'configurado', false,
      'contribuicoes_liberadas', false,
      'contribuicao_configurada', false
    );
  end if;

  camisa_ok := coalesce(nullif(btrim(c.chave_pix), ''), '') <> ''
    and coalesce(nullif(btrim(c.nome_recebedor), ''), '') <> ''
    and coalesce(nullif(btrim(c.cidade), ''), '') <> ''
    and c.valor_camisa is not null
    and c.valor_camisa > 0
    and c.tipo_chave is not null;

  contrib_ok := camisa_ok
    and c.valor_contribuicao_servo is not null
    and c.valor_contribuicao_servo > 0;

  return jsonb_build_object(
    'liberado', coalesce(c.pagamentos_liberados, false) and camisa_ok,
    'configurado', camisa_ok,
    'pagamentos_liberados', coalesce(c.pagamentos_liberados, false),
    'contribuicoes_liberadas', coalesce(c.contribuicoes_liberadas, false) and contrib_ok,
    'contribuicao_configurada', contrib_ok,
    'chave_pix', case when camisa_ok then c.chave_pix else null end,
    'tipo_chave', case when camisa_ok then c.tipo_chave else null end,
    'nome_recebedor', case when camisa_ok then c.nome_recebedor else null end,
    'cidade', case when camisa_ok then c.cidade else null end,
    'valor_camisa', case when camisa_ok then c.valor_camisa else null end,
    'valor_contribuicao_servo', case when contrib_ok then c.valor_contribuicao_servo else null end,
    'mensagem', c.mensagem
  );
end;
$$;

revoke all on function public.get_pix_publico() from public;
grant execute on function public.get_pix_publico() to anon, authenticated;

-- ─── Consultar / enviar camisa ──────────────────────────────────────────────

create or replace function public.consultar_pagamento_camisa(p_busca text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := btrim(coalesce(p_busca, ''));
  digits text;
  norm text;
  proto text;
  cfg public.config_camisa_pix%rowtype;
  pub jsonb;
  tipo text;
  pid uuid;
  v_nome text;
  v_tel text;
  v_tamanho text;
  pay public.pagamentos_camisas%rowtype;
  proto_out text;
begin
  pub := public.get_pix_publico();
  if not coalesce((pub->>'liberado')::boolean, false) then
    return jsonb_build_object('ok', false, 'erro', 'PAGAMENTOS_FECHADOS');
  end if;

  if length(raw) < 4 then
    return jsonb_build_object('ok', false, 'erro', 'BUSCA_INVALIDA');
  end if;

  digits := regexp_replace(raw, '\D', '', 'g');
  norm := public.normalize_phone_br(digits);
  proto := upper(regexp_replace(raw, '[^a-fA-F0-9]', '', 'g'));
  if length(proto) > 8 then
    proto := left(proto, 8);
  end if;

  perform public.assert_rpc_throttle(
    'consultar_pagamento_camisa',
    coalesce(norm, lower(proto), md5(raw))
  );

  if norm is not null then
    select i.id, i.nome, i.whatsapp, i.tamanho_camisa
      into pid, v_nome, v_tel, v_tamanho
    from public.inscricoes_cor_jovem i
    where i.status is distinct from 'cancelada'
      and i.camisa = 'sim'
      and public.normalize_phone_br(i.whatsapp) = norm
    order by i.created_at desc
    limit 1;
    if pid is not null then tipo := 'cursista'; end if;
  end if;

  if pid is null and norm is not null then
    select s.id, s.nome, s.telefone, s.tamanho_camisa
      into pid, v_nome, v_tel, v_tamanho
    from public.servos_cor_jovem s
    where s.status is distinct from 'cancelada'
      and s.camisa = 'sim'
      and public.normalize_phone_br(s.telefone) = norm
    order by s.created_at desc
    limit 1;
    if pid is not null then tipo := 'servo'; end if;
  end if;

  if pid is null and length(proto) >= 8 then
    select i.id, i.nome, i.whatsapp, i.tamanho_camisa
      into pid, v_nome, v_tel, v_tamanho
    from public.inscricoes_cor_jovem i
    where i.status is distinct from 'cancelada'
      and i.camisa = 'sim'
      and public.protocolo_painel(i.id) = left(proto, 8)
    limit 1;
    if pid is not null then tipo := 'cursista'; end if;
  end if;

  if pid is null and length(proto) >= 8 then
    select s.id, s.nome, s.telefone, s.tamanho_camisa
      into pid, v_nome, v_tel, v_tamanho
    from public.servos_cor_jovem s
    where s.status is distinct from 'cancelada'
      and s.camisa = 'sim'
      and public.protocolo_painel(s.id) = left(proto, 8)
    limit 1;
    if pid is not null then tipo := 'servo'; end if;
  end if;

  if pid is null then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;

  select * into cfg from public.config_camisa_pix order by created_at asc limit 1;
  proto_out := public.protocolo_painel(pid);

  select * into pay
  from public.pagamentos_camisas
  where tipo_pessoa = tipo and pessoa_id = pid;

  if not found then
    insert into public.pagamentos_camisas (
      tipo_pessoa, pessoa_id, protocolo, nome, telefone, tamanho_camisa, valor_esperado, status
    ) values (
      tipo, pid, proto_out, v_nome, v_tel, v_tamanho, cfg.valor_camisa, 'aguardando_pagamento'
    )
    returning * into pay;
  else
    update public.pagamentos_camisas p
    set nome = v_nome,
        telefone = v_tel,
        tamanho_camisa = v_tamanho,
        protocolo = proto_out,
        valor_esperado = case
          when p.status in ('aguardando_pagamento', 'divergente', 'rejeitado', 'valor_confere')
            then cfg.valor_camisa
          else p.valor_esperado
        end
    where p.id = pay.id
    returning * into pay;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pagamento', jsonb_build_object(
      'id', pay.id,
      'tipo_pessoa', pay.tipo_pessoa,
      'protocolo', pay.protocolo,
      'nome', pay.nome,
      'telefone', pay.telefone,
      'tamanho_camisa', pay.tamanho_camisa,
      'valor_esperado', pay.valor_esperado,
      'valor_informado', pay.valor_informado,
      'status', pay.status,
      'comprovante_url', pay.comprovante_url,
      'enviado_em', pay.enviado_em,
      'nota_tesoureiro', pay.nota_tesoureiro
    ),
    'pix', pub
  );
end;
$$;

create or replace function public.enviar_comprovante_camisa(
  p_pagamento_id uuid,
  p_busca text,
  p_valor_informado numeric,
  p_comprovante_url text,
  p_comprovante_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.pagamentos_camisas%rowtype;
  check_row jsonb;
  novo_status text;
  esperado numeric;
begin
  if p_pagamento_id is null
     or p_valor_informado is null
     or p_valor_informado <= 0
     or coalesce(nullif(btrim(p_comprovante_url), ''), '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS');
  end if;

  check_row := public.consultar_pagamento_camisa(p_busca);
  if not coalesce((check_row->>'ok')::boolean, false) then
    return check_row;
  end if;

  select * into pay from public.pagamentos_camisas where id = p_pagamento_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;

  if pay.id::text is distinct from (check_row->'pagamento'->>'id') then
    return jsonb_build_object('ok', false, 'erro', 'BUSCA_NAO_BATE');
  end if;

  if pay.status = 'confirmado' then
    return jsonb_build_object('ok', false, 'erro', 'JA_CONFIRMADO');
  end if;

  esperado := coalesce(pay.valor_esperado, 0);
  if abs(p_valor_informado - esperado) < 0.005 then
    novo_status := 'confirmado';
  else
    novo_status := 'divergente';
  end if;

  update public.pagamentos_camisas
  set valor_informado = p_valor_informado,
      comprovante_url = p_comprovante_url,
      comprovante_path = p_comprovante_path,
      enviado_em = now(),
      status = novo_status,
      confirmado_em = case when novo_status = 'confirmado' then now() else null end,
      confirmado_por = null,
      nota_tesoureiro = case when novo_status = 'confirmado' then coalesce(nota_tesoureiro, 'Confirmado automaticamente (valor confere)') else nota_tesoureiro end
  where id = pay.id
  returning * into pay;

  return jsonb_build_object(
    'ok', true,
    'pagamento', jsonb_build_object(
      'id', pay.id,
      'status', pay.status,
      'valor_informado', pay.valor_informado,
      'comprovante_url', pay.comprovante_url,
      'enviado_em', pay.enviado_em
    )
  );
end;
$$;

revoke all on function public.consultar_pagamento_camisa(text) from public;
revoke all on function public.enviar_comprovante_camisa(uuid, text, numeric, text, text) from public;
grant execute on function public.consultar_pagamento_camisa(text) to anon, authenticated;
grant execute on function public.enviar_comprovante_camisa(uuid, text, numeric, text, text) to anon, authenticated;

-- ─── Consultar / enviar contribuição ────────────────────────────────────────

create or replace function public.consultar_pagamento_contribuicao(p_busca text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw text := btrim(coalesce(p_busca, ''));
  digits text;
  norm text;
  proto text;
  cfg public.config_camisa_pix%rowtype;
  pub jsonb;
  pid uuid;
  v_nome text;
  v_tel text;
  pay public.pagamentos_contribuicao%rowtype;
  proto_out text;
begin
  pub := public.get_pix_publico();
  if not coalesce((pub->>'contribuicoes_liberadas')::boolean, false) then
    return jsonb_build_object('ok', false, 'erro', 'CONTRIBUICOES_FECHADAS');
  end if;

  if length(raw) < 4 then
    return jsonb_build_object('ok', false, 'erro', 'BUSCA_INVALIDA');
  end if;

  digits := regexp_replace(raw, '\D', '', 'g');
  norm := public.normalize_phone_br(digits);
  proto := upper(regexp_replace(raw, '[^a-fA-F0-9]', '', 'g'));
  if length(proto) > 8 then
    proto := left(proto, 8);
  end if;

  perform public.assert_rpc_throttle(
    'consultar_pagamento_contribuicao',
    coalesce(norm, lower(proto), md5(raw))
  );

  if norm is not null then
    select s.id, s.nome, s.telefone
      into pid, v_nome, v_tel
    from public.servos_cor_jovem s
    where s.status is distinct from 'cancelada'
      and public.normalize_phone_br(s.telefone) = norm
    order by s.created_at desc
    limit 1;
  end if;

  if pid is null and length(proto) >= 8 then
    select s.id, s.nome, s.telefone
      into pid, v_nome, v_tel
    from public.servos_cor_jovem s
    where s.status is distinct from 'cancelada'
      and public.protocolo_painel(s.id) = left(proto, 8)
    limit 1;
  end if;

  if pid is null then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;

  select * into cfg from public.config_camisa_pix order by created_at asc limit 1;
  proto_out := public.protocolo_painel(pid);

  select * into pay from public.pagamentos_contribuicao where pessoa_id = pid;

  if not found then
    insert into public.pagamentos_contribuicao (
      pessoa_id, protocolo, nome, telefone, valor_esperado, status
    ) values (
      pid, proto_out, v_nome, v_tel, cfg.valor_contribuicao_servo, 'aguardando_pagamento'
    )
    returning * into pay;
  else
    update public.pagamentos_contribuicao p
    set nome = v_nome,
        telefone = v_tel,
        protocolo = proto_out,
        valor_esperado = case
          when p.status in ('aguardando_pagamento', 'divergente', 'rejeitado', 'valor_confere')
            then cfg.valor_contribuicao_servo
          else p.valor_esperado
        end
    where p.id = pay.id
    returning * into pay;
  end if;

  return jsonb_build_object(
    'ok', true,
    'pagamento', jsonb_build_object(
      'id', pay.id,
      'protocolo', pay.protocolo,
      'nome', pay.nome,
      'telefone', pay.telefone,
      'valor_esperado', pay.valor_esperado,
      'valor_informado', pay.valor_informado,
      'status', pay.status,
      'comprovante_url', pay.comprovante_url,
      'enviado_em', pay.enviado_em,
      'nota_tesoureiro', pay.nota_tesoureiro
    ),
    'pix', pub
  );
end;
$$;

create or replace function public.enviar_comprovante_contribuicao(
  p_pagamento_id uuid,
  p_busca text,
  p_valor_informado numeric,
  p_comprovante_url text,
  p_comprovante_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.pagamentos_contribuicao%rowtype;
  check_row jsonb;
  novo_status text;
  esperado numeric;
begin
  if p_pagamento_id is null
     or p_valor_informado is null
     or p_valor_informado <= 0
     or coalesce(nullif(btrim(p_comprovante_url), ''), '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'DADOS_INVALIDOS');
  end if;

  check_row := public.consultar_pagamento_contribuicao(p_busca);
  if not coalesce((check_row->>'ok')::boolean, false) then
    return check_row;
  end if;

  select * into pay from public.pagamentos_contribuicao where id = p_pagamento_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;

  if pay.id::text is distinct from (check_row->'pagamento'->>'id') then
    return jsonb_build_object('ok', false, 'erro', 'BUSCA_NAO_BATE');
  end if;

  if pay.status = 'confirmado' then
    return jsonb_build_object('ok', false, 'erro', 'JA_CONFIRMADO');
  end if;

  esperado := coalesce(pay.valor_esperado, 0);
  if abs(p_valor_informado - esperado) < 0.005 then
    novo_status := 'confirmado';
  else
    novo_status := 'divergente';
  end if;

  update public.pagamentos_contribuicao
  set valor_informado = p_valor_informado,
      comprovante_url = p_comprovante_url,
      comprovante_path = p_comprovante_path,
      enviado_em = now(),
      status = novo_status,
      confirmado_em = case when novo_status = 'confirmado' then now() else null end,
      confirmado_por = null,
      nota_tesoureiro = case when novo_status = 'confirmado' then coalesce(nota_tesoureiro, 'Confirmado automaticamente (valor confere)') else nota_tesoureiro end
  where id = pay.id
  returning * into pay;

  return jsonb_build_object(
    'ok', true,
    'pagamento', jsonb_build_object(
      'id', pay.id,
      'status', pay.status,
      'valor_informado', pay.valor_informado,
      'comprovante_url', pay.comprovante_url,
      'enviado_em', pay.enviado_em
    )
  );
end;
$$;

revoke all on function public.consultar_pagamento_contribuicao(text) from public;
revoke all on function public.enviar_comprovante_contribuicao(uuid, text, numeric, text, text) from public;
grant execute on function public.consultar_pagamento_contribuicao(text) to anon, authenticated;
grant execute on function public.enviar_comprovante_contribuicao(uuid, text, numeric, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
