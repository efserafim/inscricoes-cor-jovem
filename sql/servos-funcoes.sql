-- Funções de interesse na ficha de servos (escolha no formulário público)
alter table public.servos_cor_jovem
  add column if not exists funcoes_preferidas text[] default '{}';

notify pgrst, 'reload schema';
