-- Configuração completa InfinitePay + camisa (produção)
-- Rode UMA VEZ no SQL Editor do Supabase.
-- Depois publique as Edge Functions (ver final deste arquivo).

-- ─── Schema ─────────────────────────────────────────────────────────────────

alter table public.config_camisa_pix
  add column if not exists link_cartao_infinitepay text,
  add column if not exists infinitepay_handle text,
  add column if not exists infinitepay_habilitado boolean not null default false;

alter table public.pagamentos_camisas
  add column if not exists gateway_checkout_id text,
  add column if not exists gateway_checkout_url text,
  add column if not exists gateway_reference_id text,
  add column if not exists gateway_charge_id text,
  add column if not exists gateway_receipt_url text;

alter table public.pagamentos_camisas
  drop constraint if exists pagamentos_camisas_forma_pagamento_check;
alter table public.pagamentos_camisas
  add constraint pagamentos_camisas_forma_pagamento_check
  check (forma_pagamento is null or forma_pagamento in ('pix', 'dinheiro', 'cartao'));

alter table public.pagamentos_contribuicao
  drop constraint if exists pagamentos_contribuicao_forma_pagamento_check;
alter table public.pagamentos_contribuicao
  add constraint pagamentos_contribuicao_forma_pagamento_check
  check (forma_pagamento is null or forma_pagamento in ('pix', 'dinheiro', 'cartao'));

-- ─── Config pública (PIX e/ou cartão integrado) ───────────────────────────

drop function if exists public.get_pix_publico();

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
  cartao_integrado boolean;
begin
  select * into c from public.config_camisa_pix order by created_at asc limit 1;
  if not found then
    return jsonb_build_object(
      'liberado', false,
      'configurado', false,
      'contribuicoes_liberadas', false,
      'contribuicao_configurada', false,
      'cartao_integrado', false
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

  cartao_integrado := coalesce(c.infinitepay_habilitado, false)
    and coalesce(nullif(btrim(c.infinitepay_handle), ''), '') <> ''
    and c.valor_camisa is not null
    and c.valor_camisa > 0;

  return jsonb_build_object(
    'liberado', coalesce(c.pagamentos_liberados, false)
      and (camisa_ok or cartao_integrado),
    'configurado', camisa_ok,
    'pagamentos_liberados', coalesce(c.pagamentos_liberados, false),
    'contribuicoes_liberadas', coalesce(c.contribuicoes_liberadas, false) and contrib_ok,
    'contribuicao_configurada', contrib_ok,
    'chave_pix', case when camisa_ok then c.chave_pix else null end,
    'tipo_chave', case when camisa_ok then c.tipo_chave else null end,
    'nome_recebedor', case when camisa_ok then c.nome_recebedor else null end,
    'cidade', case when camisa_ok then c.cidade else null end,
    'valor_camisa', c.valor_camisa,
    'valor_contribuicao_servo', case when contrib_ok then c.valor_contribuicao_servo else null end,
    'mensagem', c.mensagem,
    'cartao_integrado', cartao_integrado
  );
end;
$$;

revoke all on function public.get_pix_publico() from public;
grant execute on function public.get_pix_publico() to anon, authenticated;

-- ─── Confirmação automática (webhook) ───────────────────────────────────────

drop function if exists public.confirmar_pagamento_infinitepay(text, text, text, integer, text, text);

create or replace function public.confirmar_pagamento_infinitepay(
  p_order_nsu text,
  p_transaction_nsu text default null,
  p_invoice_slug text default null,
  p_paid_amount_cents integer default null,
  p_capture_method text default null,
  p_receipt_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  pay public.pagamentos_camisas%rowtype;
  esperado_cents integer;
  paid numeric;
  forma text;
begin
  if coalesce(nullif(btrim(p_order_nsu), ''), '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'ORDER_NSU_OBRIGATORIO');
  end if;

  begin
    pid := p_order_nsu::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'ORDER_NSU_INVALIDO');
  end;

  select * into pay from public.pagamentos_camisas where id = pid for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;

  if pay.status = 'confirmado' then
    return jsonb_build_object('ok', true, 'ja_confirmado', true, 'id', pay.id);
  end if;

  if p_paid_amount_cents is not null then
    paid := round(p_paid_amount_cents::numeric / 100, 2);
    if pay.valor_esperado is not null then
      esperado_cents := round(pay.valor_esperado * 100);
      if p_paid_amount_cents < esperado_cents - 100 then
        return jsonb_build_object('ok', false, 'erro', 'VALOR_DIVERGENTE');
      end if;
    end if;
  else
    paid := pay.valor_esperado;
  end if;

  forma := case
    when lower(coalesce(p_capture_method, '')) = 'pix' then 'pix'
    else 'cartao'
  end;

  update public.pagamentos_camisas
  set status = 'confirmado',
      forma_pagamento = forma,
      valor_informado = paid,
      confirmado_em = now(),
      gateway_checkout_id = coalesce(nullif(btrim(p_invoice_slug), ''), gateway_checkout_id),
      gateway_charge_id = coalesce(nullif(btrim(p_transaction_nsu), ''), gateway_charge_id),
      gateway_receipt_url = coalesce(nullif(btrim(p_receipt_url), ''), gateway_receipt_url),
      nota_tesoureiro = coalesce(
        nullif(btrim(nota_tesoureiro), ''),
        'Confirmado automaticamente via InfinitePay (' || coalesce(p_capture_method, 'cartao') || ')'
      )
  where id = pid;

  return jsonb_build_object('ok', true, 'id', pid, 'status', 'confirmado');
end;
$$;

revoke all on function public.confirmar_pagamento_infinitepay(text, text, text, integer, text, text) from public;
grant execute on function public.confirmar_pagamento_infinitepay(text, text, text, integer, text, text) to service_role;

-- ─── Consulta camisa (identifica pessoa antes do pagamento) ─────────────────

drop function if exists public.consultar_pagamento_camisa(text);

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
      and public.normalize_phone_br(regexp_replace(coalesce(i.whatsapp, ''), '\D', '', 'g')) = norm
    limit 1;
    if pid is not null then tipo := 'cursista'; end if;
  end if;

  if pid is null and norm is not null then
    select s.id, s.nome, s.telefone, s.tamanho_camisa
      into pid, v_nome, v_tel, v_tamanho
    from public.servos_cor_jovem s
    where s.status is distinct from 'cancelada'
      and s.camisa = 'sim'
      and public.normalize_phone_br(regexp_replace(coalesce(s.telefone, ''), '\D', '', 'g')) = norm
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
      'forma_pagamento', pay.forma_pagamento,
      'comprovante_url', pay.comprovante_url,
      'enviado_em', pay.enviado_em,
      'nota_tesoureiro', pay.nota_tesoureiro,
      'gateway_checkout_id', pay.gateway_checkout_id,
      'gateway_charge_id', pay.gateway_charge_id,
      'gateway_checkout_url', pay.gateway_checkout_url,
      'tem_checkout_cartao', pay.gateway_checkout_url is not null
    ),
    'pix', pub
  );
end;
$$;

revoke all on function public.consultar_pagamento_camisa(text) from public;
grant execute on function public.consultar_pagamento_camisa(text) to anon, authenticated;

-- ─── Valores de produção ────────────────────────────────────────────────────
-- Ajuste chave_pix / nome / cidade se a tesouraria usar PIX no mesmo fluxo.

update public.config_camisa_pix
set
  valor_camisa = coalesce(valor_camisa, 40.00),
  infinitepay_handle = 'nicolegiagio',
  infinitepay_habilitado = true,
  link_cartao_infinitepay = null,
  pagamentos_liberados = true,
  mensagem = coalesce(nullif(btrim(mensagem), ''), 'Consulte seu protocolo ou telefone antes de pagar.')
where id = (select id from public.config_camisa_pix order by created_at asc limit 1);

notify pgrst, 'reload schema';

-- ─── Edge Functions (terminal, na pasta do projeto) ─────────────────────────
-- npx.cmd supabase functions deploy infinitepay-checkout --project-ref bpsznzsgalubbltvcdrh
-- npx.cmd supabase functions deploy infinitepay-webhook --project-ref bpsznzsgalubbltvcdrh --no-verify-jwt
-- npx.cmd supabase functions deploy infinitepay-sync --project-ref bpsznzsgalubbltvcdrh
--
-- Secret (opcional): COR_SITE_URL = https://corjovem.geucaristica.com.br
