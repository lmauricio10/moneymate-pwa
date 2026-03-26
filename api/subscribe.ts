import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, initDb } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    await initDb();

    const { deviceId, subscription } = req.body;
    if (!deviceId || !subscription) return res.status(400).json({ error: 'deviceId and subscription required' });

    // Upsert device
    await sql`INSERT INTO devices (id) VALUES (${deviceId}) ON CONFLICT (id) DO NOTHING`;

    // Save push subscription
    const { endpoint, keys } = subscription;
    await sql`INSERT INTO push_subscriptions (device_id, endpoint, p256dh, auth)
      VALUES (${deviceId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (device_id, endpoint) DO UPDATE SET p256dh = ${keys.p256dh}, auth = ${keys.auth}`;

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: err.message });
  }
}
