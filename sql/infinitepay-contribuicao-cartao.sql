-- Cartão InfinitePay na taxa de contribuição (servos)
-- Rode no SQL Editor do Supabase após configurar-infinitepay-producao.sql

alter table public.pagamentos_contribuicao
  add column if not exists gateway_checkout_id text,
  add column if not exists gateway_checkout_url text,
  add column if not exists gateway_reference_id text,
  add column if not exists gateway_charge_id text,
  add column if not exists gateway_receipt_url text,
  add column if not exists forma_pagamento text;

-- Cartão disponível quando InfinitePay estiver habilitado (camisa ou contribuição)
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

  contrib_ok := c.valor_contribuicao_servo is not null
    and c.valor_contribuicao_servo > 0;

  cartao_integrado := coalesce(c.infinitepay_habilitado, false)
    and coalesce(nullif(btrim(c.infinitepay_handle), ''), '') <> '';

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

-- Confirmação automática: camisa ou contribuição (order_nsu = uuid do pagamento)
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
  payc public.pagamentos_contribuicao%rowtype;
  esperado_cents integer;
  paid numeric;
  forma text;
  nota_auto text;
begin
  if coalesce(nullif(btrim(p_order_nsu), ''), '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'ORDER_NSU_OBRIGATORIO');
  end if;

  begin
    pid := p_order_nsu::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'ORDER_NSU_INVALIDO');
  end;

  forma := case
    when lower(coalesce(p_capture_method, '')) = 'pix' then 'pix'
    else 'cartao'
  end;
  nota_auto := 'Confirmado automaticamente via InfinitePay (' || coalesce(p_capture_method, 'cartao') || ')';

  select * into pay from public.pagamentos_camisas where id = pid for update;
  if found then
    if pay.status = 'confirmado' then
      return jsonb_build_object('ok', true, 'ja_confirmado', true, 'id', pay.id, 'tipo', 'camisa');
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

    update public.pagamentos_camisas
    set status = 'confirmado',
        forma_pagamento = forma,
        valor_informado = paid,
        confirmado_em = now(),
        gateway_checkout_id = coalesce(nullif(btrim(p_invoice_slug), ''), gateway_checkout_id),
        gateway_charge_id = coalesce(nullif(btrim(p_transaction_nsu), ''), gateway_charge_id),
        gateway_receipt_url = coalesce(nullif(btrim(p_receipt_url), ''), gateway_receipt_url),
        nota_tesoureiro = coalesce(nullif(btrim(nota_tesoureiro), ''), nota_auto)
    where id = pid;

    return jsonb_build_object('ok', true, 'id', pid, 'status', 'confirmado', 'tipo', 'camisa');
  end if;

  select * into payc from public.pagamentos_contribuicao where id = pid for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'NAO_ENCONTRADO');
  end if;

  if payc.status = 'confirmado' then
    return jsonb_build_object('ok', true, 'ja_confirmado', true, 'id', payc.id, 'tipo', 'contribuicao');
  end if;

  if p_paid_amount_cents is not null then
    paid := round(p_paid_amount_cents::numeric / 100, 2);
    if payc.valor_esperado is not null then
      esperado_cents := round(payc.valor_esperado * 100);
      if p_paid_amount_cents < esperado_cents - 100 then
        return jsonb_build_object('ok', false, 'erro', 'VALOR_DIVERGENTE');
      end if;
    end if;
  else
    paid := payc.valor_esperado;
  end if;

  update public.pagamentos_contribuicao
  set status = 'confirmado',
      forma_pagamento = forma,
      valor_informado = paid,
      confirmado_em = now(),
      gateway_checkout_id = coalesce(nullif(btrim(p_invoice_slug), ''), gateway_checkout_id),
      gateway_charge_id = coalesce(nullif(btrim(p_transaction_nsu), ''), gateway_charge_id),
      gateway_receipt_url = coalesce(nullif(btrim(p_receipt_url), ''), gateway_receipt_url),
      nota_tesoureiro = coalesce(nullif(btrim(nota_tesoureiro), ''), nota_auto)
  where id = pid;

  return jsonb_build_object('ok', true, 'id', pid, 'status', 'confirmado', 'tipo', 'contribuicao');
end;
$$;

revoke all on function public.confirmar_pagamento_infinitepay(text, text, text, integer, text, text) from public;
grant execute on function public.confirmar_pagamento_infinitepay(text, text, text, integer, text, text) to service_role;

notify pgrst, 'reload schema';
