import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL not set');
  return neon(url);
}

export async function initDb() {
  const sql = getDb();

  await sql`CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, endpoint)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS projetos (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    criado_em TEXT NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS despesas (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    projeto_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    data TEXT NOT NULL,
    categoria TEXT NOT NULL,
    recorrencia TEXT DEFAULT 'mensal',
    dia_vencimento INTEGER,
    mes_vencimento INTEGER,
    notificacao TEXT DEFAULT 'nenhuma',
    intervalo_horas NUMERIC DEFAULT 3,
    status TEXT DEFAULT 'pendente',
    mes_pago TEXT,
    last_notified TIMESTAMP,
    criado_em TEXT NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS device_config (
    device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}'
  )`;

  // Migration: add columns if missing
  await sql`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS intervalo_horas NUMERIC DEFAULT 3`;
  await sql`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS last_notified TIMESTAMP`;
}

export { getDb };
