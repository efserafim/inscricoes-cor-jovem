-- Pagamento em dinheiro + forma_pagamento (idempotente)
-- Rodar no SQL Editor após pagamentos-pix.sql

alter table public.pagamentos_camisas
  add column if not exists forma_pagamento text
  check (forma_pagamento is null or forma_pagamento in ('pix', 'dinheiro'));

alter table public.pagamentos_contribuicao
  add column if not exists forma_pagamento text
  check (forma_pagamento is null or forma_pagamento in ('pix', 'dinheiro'));

-- Confirma em dinheiro (camisa ou contribuição). Só tesoureiro.
create or replace function public.registrar_pagamento_dinheiro(
  p_busca text,
  p_tipo text default 'camisa'
)
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
  tipo_pessoa text;
  pid uuid;
  v_nome text;
  v_tel text;
  v_tamanho text;
  proto_out text;
  pay_id uuid;
  valor numeric;
  kind text := lower(btrim(coalesce(p_tipo, 'camisa')));
begin
  if not public.is_tesoureiro() then
    return jsonb_build_object('ok', false, 'erro', 'NAO_AUTORIZADO');
  end if;

  if length(raw) < 4 then
    return jsonb_build_object('ok', false, 'erro', 'BUSCA_INVALIDA');
  end if;

  if kind not in ('camisa', 'contribuicao') then
    return jsonb_build_object('ok', false, 'erro', 'TIPO_INVALIDO');
  end if;

  select * into cfg from public.config_camisa_pix order by created_at asc limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'SEM_CONFIG');
  end if;

  digits := regexp_replace(raw, '\D', '', 'g');
  norm := public.normalize_phone_br(digits);
  proto := upper(regexp_replace(raw, '[^a-fA-F0-9]', '', 'g'));
  if length(proto) > 8 then
    proto := left(proto, 8);
  end if;

  if kind = 'camisa' then
    if norm is not null then
      select i.id, i.nome, i.whatsapp, i.tamanho_camisa
        into pid, v_nome, v_tel, v_tamanho
      from public.inscricoes_cor_jovem i
      where i.status is distinct from 'cancelada'
        and i.camisa = 'sim'
        and public.normalize_phone_br(i.whatsapp) = norm
      order by i.created_at desc
      limit 1;
      if pid is not null then tipo_pessoa := 'cursista'; end if;
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
      if pid is not null then tipo_pessoa := 'servo'; end if;
    end if;

    if pid is null and length(proto) >= 8 then
      select i.id, i.nome, i.whatsapp, i.tamanho_camisa
        into pid, v_nome, v_tel, v_tamanho
      from public.inscricoes_cor_jovem i
      where i.status is distinct from 'cancelada'
        and i.camisa = 'sim'
        and public.protocolo_painel(i.id) = left(proto, 8)
      limit 1;
      if pid is not null then tipo_pessoa := 'cursista'; end if;
    end if;

    if pid is null and length(proto) >= 8 then
      select s.id, s.nome, s.telefone, s.tamanho_camisa
        into pid, v_nome, v_tel, v_tamanho
      from public.servos_cor_jovem s
      where s.status is distinct from 'cancelada'
        and s.camisa = 'sim'
        and public.protocolo_painel(s.id) = left(proto, 8)
      limit 1;
      if pid is not null then tipo_pessoa := 'servo'; end if;
    end if;

    if pid is null then
      return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
    end if;

    if cfg.valor_camisa is null or cfg.valor_camisa <= 0 then
      return jsonb_build_object('ok', false, 'erro', 'SEM_VALOR');
    end if;

    valor := cfg.valor_camisa;
    proto_out := public.protocolo_painel(pid);

    select id into pay_id
    from public.pagamentos_camisas
    where tipo_pessoa = tipo_pessoa and pessoa_id = pid;

    if pay_id is null then
      insert into public.pagamentos_camisas (
        tipo_pessoa, pessoa_id, protocolo, nome, telefone, tamanho_camisa,
        valor_esperado, valor_informado, status, forma_pagamento,
        enviado_em, confirmado_em, confirmado_por, nota_tesoureiro
      ) values (
        tipo_pessoa, pid, proto_out, v_nome, v_tel, v_tamanho,
        valor, valor, 'confirmado', 'dinheiro',
        now(), now(), auth.uid(), 'Confirmado em dinheiro pela tesouraria'
      )
      returning id into pay_id;
    else
      update public.pagamentos_camisas
      set nome = v_nome,
          telefone = v_tel,
          tamanho_camisa = v_tamanho,
          protocolo = proto_out,
          valor_esperado = valor,
          valor_informado = valor,
          status = 'confirmado',
          forma_pagamento = 'dinheiro',
          enviado_em = coalesce(enviado_em, now()),
          confirmado_em = now(),
          confirmado_por = auth.uid(),
          nota_tesoureiro = 'Confirmado em dinheiro pela tesouraria'
      where id = pay_id;
    end if;

    return jsonb_build_object(
      'ok', true,
      'tipo', 'camisa',
      'pagamento_id', pay_id,
      'nome', v_nome,
      'protocolo', proto_out,
      'valor', valor
    );
  end if;

  -- contribuição (servo)
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

  if cfg.valor_contribuicao_servo is null or cfg.valor_contribuicao_servo <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'SEM_VALOR');
  end if;

  valor := cfg.valor_contribuicao_servo;
  proto_out := public.protocolo_painel(pid);

  select id into pay_id from public.pagamentos_contribuicao where pessoa_id = pid;

  if pay_id is null then
    insert into public.pagamentos_contribuicao (
      pessoa_id, protocolo, nome, telefone,
      valor_esperado, valor_informado, status, forma_pagamento,
      enviado_em, confirmado_em, confirmado_por, nota_tesoureiro
    ) values (
      pid, proto_out, v_nome, v_tel,
      valor, valor, 'confirmado', 'dinheiro',
      now(), now(), auth.uid(), 'Confirmado em dinheiro pela tesouraria'
    )
    returning id into pay_id;
  else
    update public.pagamentos_contribuicao
    set nome = v_nome,
        telefone = v_tel,
        protocolo = proto_out,
        valor_esperado = valor,
        valor_informado = valor,
        status = 'confirmado',
        forma_pagamento = 'dinheiro',
        enviado_em = coalesce(enviado_em, now()),
        confirmado_em = now(),
        confirmado_por = auth.uid(),
        nota_tesoureiro = 'Confirmado em dinheiro pela tesouraria'
    where id = pay_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'tipo', 'contribuicao',
    'pagamento_id', pay_id,
    'nome', v_nome,
    'protocolo', proto_out,
    'valor', valor
  );
end;
$$;

revoke all on function public.registrar_pagamento_dinheiro(text, text) from public;
grant execute on function public.registrar_pagamento_dinheiro(text, text) to authenticated;

-- Ao confirmar via comprovante PIX, marcar forma
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
      forma_pagamento = 'pix',
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
      forma_pagamento = 'pix',
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

notify pgrst, 'reload schema';
