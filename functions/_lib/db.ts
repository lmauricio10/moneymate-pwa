import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export interface Env {
  POSTGRES_URL?: string;
  DATABASE_URL?: string;
  CRON_SECRET: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

export function getDb(env: Env): NeonQueryFunction<false, false> {
  const url = env.POSTGRES_URL || env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL not set');
  return neon(url);
}

// Schema + idempotent migrations. Batched into ONE transaction = one HTTP
// subrequest, so it never trips Cloudflare's 50-subrequest/invocation cap.
export async function initDb(env: Env): Promise<void> {
  const sql = getDb(env);

  await sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(device_id, endpoint)
    )`,
    sql`CREATE TABLE IF NOT EXISTS projetos (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      criado_em TEXT NOT NULL
    )`,
    sql`CREATE TABLE IF NOT EXISTS despesas (
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
    )`,
    sql`CREATE TABLE IF NOT EXISTS device_config (
      device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      config JSONB NOT NULL DEFAULT '{}'
    )`,
    // Migrations (idempotent). Statements run in order within the transaction,
    // so the UPDATE sees the columns added by the ALTERs above it.
    sql`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS intervalo_horas NUMERIC DEFAULT 3`,
    sql`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS last_notified TIMESTAMP`,
    sql`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS titulo TEXT NOT NULL DEFAULT ''`,
    sql`ALTER TABLE despesas ALTER COLUMN descricao DROP NOT NULL`,
    sql`UPDATE despesas SET titulo = descricao, descricao = NULL
        WHERE (titulo = '' OR titulo IS NULL) AND descricao IS NOT NULL`,
  ]);
}
