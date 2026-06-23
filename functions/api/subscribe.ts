import { getDb, initDb, type Env } from '../_lib/db';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const sql = getDb(env);
    await initDb(env);

    const { deviceId, subscription } = await request.json<any>();
    if (!deviceId || !subscription) return json({ error: 'deviceId and subscription required' }, 400);

    await sql`INSERT INTO devices (id) VALUES (${deviceId}) ON CONFLICT (id) DO NOTHING`;

    const { endpoint, keys } = subscription;
    await sql`INSERT INTO push_subscriptions (device_id, endpoint, p256dh, auth)
      VALUES (${deviceId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (device_id, endpoint) DO UPDATE SET p256dh = ${keys.p256dh}, auth = ${keys.auth}`;

    return json({ ok: true });
  } catch (err: any) {
    console.error('Subscribe error:', err);
    return json({ error: err.message }, 500);
  }
};
