# Estrutura do projeto — XVI C.O.R Jovem

Site estático (HTML/CSS/JS) + Supabase. Sem bundler e sem Node no deploy (GitHub Pages).

## Árvore

```
├── index.html                 # Inscrição de cursistas
├── servos.html                # Inscrição de servos
├── pagamento-camisa.html      # PIX da camisa (público)
├── pagamento-contribuicao.html # Taxa dos servos (público)
├── dashboard.html             # Painel da equipe (só HTML + <script src>)
├── inscricao-cor-jovem.html   # Redirect legado → index.html (manter na raiz)
├── README.md
├── ESTRUTURA.md               # Este arquivo
├── css/
│   ├── site.css               # Páginas públicas
│   └── dash.css               # Painel
├── js/
│   ├── config.js              # Supabase, COR_API, COR_AUTH
│   ├── pix-brcode.js          # Payload PIX (BR Code)
│   ├── pagamento-camisa.js
│   ├── pagamento-contribuicao.js
│   ├── site-common.js         # Utilitários dos formulários públicos
│   └── dashboard/             # Módulos do painel (scripts clássicos, em ordem)
│       ├── state.js
│       ├── utils.js
│       ├── theme.js
│       ├── auth-gate.js
│       ├── drawer.js
│       ├── inscricoes.js
│       ├── servos.js
│       ├── decurias.js
│       ├── camisas.js
│       ├── pagamentos.js      # Aba PIX (tesoureiro)
│       ├── ficha-print.js
│       ├── export.js
│       └── app.js             # listeners + boot (sempre por último)
├── image/
│   ├── logos/                 # Marcas (pascom, geração eucarística)
│   ├── hero/                  # Foto de fundo do hero
│   ├── peeks/                 # Figuras dos “saints peeks”
│   └── og/                    # Open Graph / WhatsApp preview
└── sql/
    ├── setup.sql              # Setup completo (idempotente)
    ├── pagamentos-pix.sql     # PIX camisa + contribuição (idempotente)
    ├── auth-rls.sql           # Só políticas/RPCs se tabelas já existem
    ├── confirm-staff.md       # Como criar usuários / tesoureiro
    ├── security-hardening.sql # Endurecimento adicional
    └── confirm-staff.md       # Como criar usuários da equipe
```

## Onde cada tipo de arquivo mora

| Tipo | Pasta |
|------|--------|
| Página pública / painel | Raiz (`*.html`) — necessário para URLs do GitHub Pages |
| Estilos públicos | `css/site.css` |
| Estilos do painel | `css/dash.css` |
| API / Auth Supabase | `js/config.js` |
| Helpers dos formulários públicos | `js/site-common.js` |
| Lógica de uma view do painel | `js/dashboard/<view>.js` |
| Imagens | `image/<contexto>/` (nunca soltas na raiz de `image/`) |
| SQL | `sql/` |

## Convenção de nomes

| Escopo | Padrão | Exemplo |
|--------|--------|---------|
| Arquivos e pastas | `kebab-case` | `ficha-print.js`, `auth-gate.js` |
| Funções e variáveis JS | `camelCase` | `renderServos`, `statusFilter` |
| Globais do projeto | `COR_*` | `COR_API`, `COR_AUTH`, `COR_SITE` |
| Tabelas / colunas / funções SQL | `snake_case` | `inscricoes_cor_jovem`, `decuria_id` |

## Regra de ouro do painel

**Toda função de UI de uma view nova do painel vira um arquivo novo em `js/dashboard/`. Nunca cresce dentro de `dashboard.html`.**

- `dashboard.html` = marcação HTML + tags `<script src>` (+ o snippet mínimo de tema no `<head>` para evitar flash claro/escuro).
- Scripts clássicos (sem `type="module"`) compartilham o escopo da página: `let`/`const`/`function` de um arquivo são visíveis nos seguintes — por isso a **ordem dos `<script>` importa**.
- `app.js` é o único lugar para amarrar listeners globais e chamar `bootAuth()`.

Ordem canônica:

```html
<script src="js/config.js"></script>
<script src="js/dashboard/state.js"></script>
<script src="js/dashboard/utils.js"></script>
<script src="js/dashboard/theme.js"></script>
<script src="js/dashboard/auth-gate.js"></script>
<script src="js/dashboard/drawer.js"></script>
<script src="js/dashboard/inscricoes.js"></script>
<script src="js/dashboard/servos.js"></script>
<script src="js/dashboard/decurias.js"></script>
<script src="js/dashboard/camisas.js"></script>
<script src="js/dashboard/ficha-print.js"></script>
<script src="js/dashboard/export.js"></script>
<script src="js/dashboard/app.js"></script>
```

## Imagens

| Subpasta | Uso |
|----------|-----|
| `image/logos/` | Logos institucionais |
| `image/hero/` | Fundo do hero |
| `image/peeks/` | Ilustrações laterais |
| `image/og/` | Preview de link (WhatsApp etc.) |

Ao adicionar asset novo: escolha a subpasta pelo **contexto de uso**, não pelo formato do arquivo.

## Como testar localmente

1. Abra a pasta do projeto (não um HTML isolado fora da pasta — os `src`/`href` são relativos).
2. Sirva por HTTP local (evita restrições de `file://` em alguns browsers):

```bash
# Python
python -m http.server 8080

# ou Node
npx --yes serve -p 8080
```

3. Acesse:
   - Cursistas: `http://localhost:8080/index.html`
   - Servos: `http://localhost:8080/servos.html`
   - Painel: `http://localhost:8080/dashboard.html`
4. Confirme no DevTools (F12) que não há 404 em CSS/JS/imagens.
5. SQL novo: rode no Supabase SQL Editor antes de depender da mudança no client.

## O que não fazer

- Não colocar JS novo do painel inline em `dashboard.html`.
- Não misturar estilos do painel em `site.css` (nem o contrário).
- Não deixar imagens novas soltas em `image/` sem subpasta.
- Não renomear tabelas/colunas SQL sem migration explícita e atualização do client.
