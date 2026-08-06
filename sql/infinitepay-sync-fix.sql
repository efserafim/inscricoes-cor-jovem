-- Corrige sync InfinitePay: expõe gateway_* na consulta de contribuição
-- Rode no SQL Editor do Supabase.

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

revoke all on function public.consultar_pagamento_contribuicao(text) from public;
grant execute on function public.consultar_pagamento_contribuicao(text) to anon, authenticated;

notify pgrst, 'reload schema';
