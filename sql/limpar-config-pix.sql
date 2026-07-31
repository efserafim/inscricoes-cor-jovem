-- Zera a configuração PIX (tesouraria) — rode no SQL Editor do Supabase
-- Deixa chave, recebedor, valores e mensagem em branco; desativa pagamentos no site.

update public.config_camisa_pix
set
  chave_pix = null,
  tipo_chave = 'aleatoria',
  nome_recebedor = null,
  cidade = null,
  valor_camisa = null,
  valor_contribuicao_servo = null,
  mensagem = null,
  pagamentos_liberados = false,
  contribuicoes_liberadas = false,
  updated_at = now();

notify pgrst, 'reload schema';
