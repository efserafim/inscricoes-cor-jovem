-- PIX fixo: Welerson Mendonça de Almeida (camisa + contribuição)
-- Rode no SQL Editor do Supabase (idempotente).

update public.config_camisa_pix
set
  nome_recebedor = 'Welerson Mendonça de Almeida',
  cidade = 'SAQUAREMA',
  chave_pix = '+5522998750491',
  tipo_chave = 'telefone',
  updated_at = now()
where id = (select id from public.config_camisa_pix order by created_at asc limit 1);

notify pgrst, 'reload schema';
