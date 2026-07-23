# XVI C.O.R Jovem

Inscrição de cursistas e servos + painel da equipe (Supabase).

## Estrutura

```
├── index.html                 # Inscrição de cursistas
├── servos.html                # Inscrição de servos
├── dashboard.html             # Painel da equipe (HTML + scripts externos)
├── inscricao-cor-jovem.html   # Redireciona → index.html
├── ESTRUTURA.md               # Convenções de pastas, nomes e módulos
├── css/
│   ├── site.css               # Páginas públicas
│   └── dash.css               # Painel
├── js/
│   ├── config.js              # Supabase + API + Auth
│   ├── site-common.js         # Utilitários das páginas públicas
│   └── dashboard/             # Módulos do painel (ver ESTRUTURA.md)
├── image/
│   ├── logos/
│   ├── hero/
│   ├── peeks/
│   └── og/
└── sql/
    ├── setup.sql              # Tabelas, RLS, RPCs, storage + hardening
    ├── auth-rls.sql           # Políticas se as tabelas já existem
    ├── security-hardening.sql # Limite de vagas, RPCs, throttle, auditoria
    └── confirm-staff.md       # Como criar usuários da equipe
```

Detalhes e regras de manutenção: **[ESTRUTURA.md](ESTRUTURA.md)**.

## Setup rápido

1. No Supabase SQL Editor, rode `sql/setup.sql` (ou `sql/auth-rls.sql` + `sql/security-hardening.sql` se as tabelas já existem).
2. Authentication → Users → crie os usuários da equipe (veja `sql/confirm-staff.md`).
3. Desative o cadastro público (Email → Enable sign ups).
4. Publique a pasta no GitHub Pages (ou outro host estático).

## Segurança (resumo)

| Camada | O que faz |
|--------|-----------|
| Trigger `enforce_inscricoes_limit` | Limite de 70 vagas no banco (atômico) |
| Honeypot + tempo mínimo | Reduz spam nos formulários públicos |
| RPCs `existe_*` + `rpc_throttle` | Duplicidade só com número completo; máx. 5 tentativas/10 min por número |
| `buscar_*` | Revogadas para `anon` (só boolean público) |
| `auditoria_cor_jovem` | Log de update/delete da equipe |
| Storage | Upload de foto só imagem e tamanho limitado |

### LGPD / dados sensíveis

CPF do responsável e dados de saúde ficam visíveis a **qualquer usuário autenticado** do painel. Mantenha a equipe pequena e de confiança. Se crescer, separe papéis (`raw_user_meta_data.role`) e views sem campos sensíveis.

Turnstile/CAPTCHA (Cloudflare) é o próximo passo recomendado se houver abuso.

## Links

| Página | Arquivo |
|--------|---------|
| Cursistas | `index.html` |
| Servos | `servos.html` |
| Painel | `dashboard.html` |
