-- Remover pagamento de teste + permitir exclusão pelo tesoureiro
-- Rodar no SQL Editor do Supabase

-- 1) Apaga o registro de teste (ajuste se o protocolo mudar)
delete from public.pagamentos_contribuicao
where upper(protocolo) = 'BB09857B'
   or nome ilike 'Eduardo Ferreira Serafim%';

delete from public.pagamentos_camisas
where upper(protocolo) = 'BB09857B'
   or nome ilike 'Eduardo Ferreira Serafim%';

-- 2) Permite o tesoureiro excluir pela aba PIX
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
