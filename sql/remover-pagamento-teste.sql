-- Permite o tesoureiro excluir QUALQUER pagamento pela aba PIX
-- Rodar no SQL Editor do Supabase (idempotente)

drop policy if exists "Pag camisas delete tesoureiro" on public.pagamentos_camisas;
create policy "Pag camisas delete tesoureiro"
  on public.pagamentos_camisas for delete to authenticated
  using (public.is_tesoureiro());

drop policy if exists "Pag contrib delete tesoureiro" on public.pagamentos_contribuicao;
create policy "Pag contrib delete tesoureiro"
  on public.pagamentos_contribuicao for delete to authenticated
  using (public.is_tesoureiro());

grant delete on public.pagamentos_camisas to authenticated;
grant delete on public.pagamentos_contribuicao to authenticated;

notify pgrst, 'reload schema';
