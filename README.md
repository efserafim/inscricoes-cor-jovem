# XVI C.O.R Jovem

Inscrição de cursistas e servos + painel da equipe (Supabase).

## Estrutura

```
├── index.html              # Inscrição de cursistas
├── servos.html             # Inscrição de servos
├── dashboard.html          # Painel da equipe (Auth)
├── inscricao-cor-jovem.html # Redireciona → index.html
├── css/
│   ├── site.css            # Páginas públicas
│   └── dash.css            # Painel
├── js/
│   ├── config.js           # Supabase + API + Auth
│   └── site-common.js      # Utilitários das páginas públicas
├── image/                  # Logos, hero e peeks
└── sql/
    ├── setup.sql           # Tabelas, RLS, RPCs, storage
    └── auth-rls.sql        # Só políticas Auth (projeto já existente)
```

## Setup rápido

1. No Supabase SQL Editor, rode `sql/setup.sql` (ou `sql/auth-rls.sql` se as tabelas já existem).
2. Authentication → Users → crie o usuário da equipe.
3. Desative o cadastro público (Email → Enable sign ups).
4. Publique a pasta no GitHub Pages (ou outro host estático).

## Links

| Página | Arquivo |
|--------|---------|
| Cursistas | `index.html` |
| Servos | `servos.html` |
| Painel | `dashboard.html` |
