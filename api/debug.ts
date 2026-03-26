import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, initDb } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = getDb();
    await initDb();

    const devices = await sql`SELECT * FROM devices`;
    const despesas = await sql`SELECT id, descricao, dia_vencimento, notificacao, intervalo_horas, status, mes_pago, last_notified, device_id FROM despesas`;
    const subs = await sql`SELECT device_id, endpoint FROM push_subscriptions`;
    const configs = await sql`SELECT * FROM device_config`;

    return res.status(200).json({ devices, despesas, subs: subs.length, configs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
