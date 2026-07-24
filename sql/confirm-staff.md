# Equipe — Auth (sem dados pessoais)

Use o painel do Supabase para criar usuários:

1. **Authentication → Users → Add user**
2. E-mail + senha de primeiro acesso
3. Marque **Auto Confirm User**
4. Em User Metadata (JSON):

```json
{
  "display_name": "Nome",
  "must_change_password": true
}
```

5. Desative **Enable sign ups** (Authentication → Providers → Email).

## Tesoureiro (PIX)

Para liberar a aba **PIX** no painel (camisas + taxa de contribuição):

1. Authentication → Users → abra o usuário
2. Em **User Metadata**, inclua `"role": "tesoureiro"`:

```json
{
  "display_name": "Nome",
  "role": "tesoureiro",
  "must_change_password": false
}
```

3. No **SQL Editor**, rode o arquivo [`pagamentos-pix.sql`](pagamentos-pix.sql) uma vez.
4. Entre no painel, abra a aba **PIX**, preencha chave/valores e marque as liberações.

Não versionar e-mails nem senhas neste repositório.

Para liberar contas já criadas sem confirmação, use o SQL Editor do Supabase (não faça commit com dados reais).
