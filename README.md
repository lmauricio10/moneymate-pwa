# MoneyMate PWA

Aplicação de gestão de despesas pessoais como **Progressive Web App**
(instalável, offline-capable, com Web Push notifications).

## Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Cloudflare Pages Functions (`functions/api/*.ts`)
- **DB**: Neon Postgres (`@neondatabase/serverless` — HTTP driver, corre no Workers runtime)
- **Push**: Web Push API + VAPID. O envio (`functions/api/cron.ts`) usa uma
  implementação Web Crypto (RFC 8291 + 8292) em `functions/_lib/webpush.ts`,
  porque a lib `web-push` do npm **não** corre no runtime dos Workers.
- **Cron**: serviço externo (cron-job.org) faz GET a `/api/cron` com
  `Authorization: Bearer <CRON_SECRET>` (Pages não tem cron nativo).
- **Storage local**: `localStorage` (com sync para o servidor via `/api/sync`)

## Deploy

Push para `master` no repo `lmauricio10/moneymate-pwa` → Cloudflare Pages
faz auto-deploy (build `npm run build`, output `dist/`).

Config de runtime em `wrangler.toml`:
- `compatibility_flags = ["nodejs_compat"]`
- `pages_build_output_dir = "dist"`

Variáveis de ambiente necessárias no Cloudflare Pages (Settings → Environment variables):
- `POSTGRES_URL` (ou `DATABASE_URL`) — Neon connection string
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — chaves VAPID para push
- `CRON_SECRET` — segredo partilhado com o cron-job.org para `/api/cron` e `/api/debug`

## Estrutura

```
src/
  App.tsx
  store.ts              # localStorage + sync para /api/sync
  notifications.ts      # local notifications + push subscribe
  types.ts              # Despesa, Projeto, Config
  components/
    DespesasScreen.tsx
    AddDespesaModal.tsx
    SettingsScreen.tsx
functions/
  _lib/
    db.ts               # schema + migrations (idempotentes), getDb(env)
    webpush.ts          # Web Crypto push (aes128gcm + VAPID ES256)
  api/
    sync.ts             # POST /api/sync      — upsert despesas/projetos/config
    subscribe.ts        # POST /api/subscribe — guarda push subscription
    cron.ts             # GET  /api/cron      — chamado pelo cron-job.org, envia push
    debug.ts            # GET  /api/debug     — inspeção (Bearer CRON_SECRET)
```

## Modelo de Despesa

Cada despesa tem:

- **`titulo`** (obrigatório) — etiqueta curta mostrada no card e nas notificações.
- **`descricao`** (opcional) — descrição detalhada multiline. Pode conter
  hyperlinks (`http://...` / `https://...`) que são detetados por regex e
  renderizados como `<a target="_blank">` clicáveis no card da despesa.
- valor, categoria, recorrência (mensal/anual), dia/mês de vencimento,
  notificações, status (pendente/pago).

### Migração titulo / descricao

Antes desta versão, o campo `descricao` funcionava como título. Para não
perder dados:

- **Postgres** (`functions/_lib/db.ts` → `initDb()`): adiciona coluna `titulo TEXT NOT NULL DEFAULT ''`,
  torna `descricao` nullable, e copia `descricao → titulo` quando `titulo`
  está vazio (limpando depois `descricao` para esses registos).
- **Frontend** (`src/store.ts` → `loadDespesas()`): mesma lógica em
  cima dos dados em `localStorage`.

Migrações são idempotentes — `initDb()` corre em cada call de `/api/sync`.

## Como correr localmente

```bash
npm install
npx wrangler pages dev -- npm run dev   # Vite + Pages Functions juntos
# ou
npm run dev                             # só Vite (sem APIs)
```

## Notas

- Existe um repo gémeo `MoneyMate/moneymate-lite` (Expo / React Native)
  com app conceptualmente igual, mas é **outra aplicação** — local-only,
  sem Vercel, sem Postgres. Mudanças num **não** se propagam ao outro.
