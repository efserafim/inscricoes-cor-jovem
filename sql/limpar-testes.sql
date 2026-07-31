-- Remove dados de teste (PagBank, checkouts sandbox, throttle de consultas)
-- Rodar no SQL Editor do Supabase

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagamentos_camisas' and column_name = 'gateway_checkout_id'
  ) then
    delete from public.pagamentos_camisas
    where coalesce(gateway_checkout_id, '') <> ''
       or coalesce(gateway_reference_id, '') <> ''
       or coalesce(gateway_charge_id, '') <> ''
       or forma_pagamento in ('cartao', 'pagbank')
       or coalesce(nota_tesoureiro, '') ilike '%pagbank%'
       or coalesce(nota_tesoureiro, '') ilike '%teste%';

    update public.pagamentos_camisas
    set gateway_checkout_id = null,
        gateway_checkout_url = null,
        gateway_reference_id = null,
        gateway_charge_id = null
    where status is distinct from 'confirmado'
      and (
        gateway_checkout_id is not null
        or gateway_checkout_url is not null
        or gateway_reference_id is not null
        or gateway_charge_id is not null
      );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagamentos_contribuicao' and column_name = 'gateway_checkout_id'
  ) then
    delete from public.pagamentos_contribuicao
    where coalesce(gateway_checkout_id, '') <> ''
       or coalesce(gateway_reference_id, '') <> ''
       or coalesce(gateway_charge_id, '') <> ''
       or forma_pagamento in ('cartao', 'pagbank')
       or coalesce(nota_tesoureiro, '') ilike '%pagbank%'
       or coalesce(nota_tesoureiro, '') ilike '%teste%';

    update public.pagamentos_contribuicao
    set gateway_checkout_id = null,
        gateway_checkout_url = null,
        gateway_reference_id = null,
        gateway_charge_id = null
    where status is distinct from 'confirmado'
      and (
        gateway_checkout_id is not null
        or gateway_checkout_url is not null
        or gateway_reference_id is not null
        or gateway_charge_id is not null
      );
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'config_camisa_pix' and column_name = 'pagbank_habilitado'
  ) then
    update public.config_camisa_pix
    set pagbank_habilitado = false,
        pagbank_sandbox = true,
        updated_at = now();
  end if;
end $$;

delete from public.rpc_throttle
where bucket ilike '%22998829819%'
   or bucket ilike '%consultar_pagamento%'
   or bucket ilike '%998829819%';

drop function if exists public.confirmar_pagamento_pagbank(text, text, text, integer, text, text);

notify pgrst, 'reload schema';
