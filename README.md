# MoneyMate PWA

Aplicação de gestão de despesas pessoais como **Progressive Web App**
(instalável, offline-capable, com Web Push notifications).

Live: https://moneymate-pwa.vercel.app

## Stack

- **Frontend**: Vite + React + TypeScript
- **Backend**: Vercel Serverless Functions (`api/*.ts`)
- **DB**: Neon Postgres (`@neondatabase/serverless`)
- **Push**: Web Push API + VAPID, agendado por Vercel Cron (`api/cron.ts`)
- **Storage local**: `localStorage` (com sync para o servidor via `/api/sync`)

## Deploy

Push para `master` no repo `lmauricio10/moneymate-pwa` → Vercel faz auto-deploy.

```bash
# acompanhar
vercel ls
vercel inspect <deployment-url>
```

Variáveis de ambiente necessárias na Vercel:
- `POSTGRES_URL` (ou `DATABASE_URL`) — Neon connection string
- VAPID keys para push notifications

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
api/
  db.ts                 # schema + migrations (idempotentes)
  sync.ts               # POST /api/sync — upsert despesas/projetos/config
  subscribe.ts          # POST /api/subscribe — guarda push subscription
  cron.ts               # GET  /api/cron    — corre via Vercel Cron, envia push
  debug.ts              # GET  /api/debug   — inspeção
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

- **Postgres** (`api/db.ts` → `initDb()`): adiciona coluna `titulo TEXT NOT NULL DEFAULT ''`,
  torna `descricao` nullable, e copia `descricao → titulo` quando `titulo`
  está vazio (limpando depois `descricao` para esses registos).
- **Frontend** (`src/store.ts` → `loadDespesas()`): mesma lógica em
  cima dos dados em `localStorage`.

Migrações são idempotentes — `initDb()` corre em cada call de `/api/sync`.

## Como correr localmente

```bash
npm install
vercel dev   # corre Vite + funções serverless juntas
# ou
npm run dev  # só Vite (sem APIs)
```

## Notas

- Existe um repo gémeo `MoneyMate/moneymate-lite` (Expo / React Native)
  com app conceptualmente igual, mas é **outra aplicação** — local-only,
  sem Vercel, sem Postgres. Mudanças num **não** se propagam ao outro.
