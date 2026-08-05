-- Link InfinitePay (cartão) para camisa + forma_pagamento cartao
-- Rodar no SQL Editor do Supabase após pagamentos-pix.sql e pagamentos-dinheiro.sql

alter table public.config_camisa_pix
  add column if not exists link_cartao_infinitepay text;

-- Permite registrar pagamentos por cartão no painel
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
    'mensagem', c.mensagem,
    'link_cartao_infinitepay', nullif(btrim(c.link_cartao_infinitepay), '')
  );
end;
$$;

revoke all on function public.get_pix_publico() from public;
grant execute on function public.get_pix_publico() to anon, authenticated;

-- Link padrão da tesouraria (ajuste no painel se precisar)
update public.config_camisa_pix
set link_cartao_infinitepay = 'https://link.infinitepay.io/nicolegiagio/VC1DLUMtSQ-7zeb5KLL5E-42,00'
where coalesce(nullif(btrim(link_cartao_infinitepay), ''), '') = '';
