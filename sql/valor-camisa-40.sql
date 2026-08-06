-- Camisa: R$ 40 (PIX) · R$ 42 no cartão (+ R$ 2 taxa no checkout InfinitePay)
-- Rode no SQL Editor do Supabase.

update public.config_camisa_pix
set
  valor_camisa = 40.00,
  updated_at = now()
where id = (select id from public.config_camisa_pix order by created_at asc limit 1);

-- Atualiza fila aberta para o novo valor base (PIX)
update public.pagamentos_camisas
set valor_esperado = 40.00,
    updated_at = now()
where status in ('aguardando_pagamento', 'divergente', 'rejeitado', 'valor_confere')
  and valor_esperado is distinct from 40.00;

-- Legado: valor antigo R$ 42 (preço único antes da taxa de cartão)
update public.pagamentos_camisas
set valor_esperado = 40.00,
    updated_at = now()
where status in ('aguardando_pagamento', 'divergente', 'rejeitado', 'valor_confere')
  and valor_esperado = 42.00;

notify pgrst, 'reload schema';
