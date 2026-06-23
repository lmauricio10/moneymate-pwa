import { getDb, initDb, type Env } from '../_lib/db';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const sql = getDb(env);
    await initDb(env);

    const devices = await sql`SELECT * FROM devices`;
    const despesas = await sql`SELECT id, titulo, descricao, dia_vencimento, notificacao, intervalo_horas, status, mes_pago, last_notified, device_id FROM despesas`;
    const subs = await sql`SELECT device_id, endpoint FROM push_subscriptions`;
    const configs = await sql`SELECT * FROM device_config`;

    return json({ devices, despesas, subs: subs.length, configs });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
};
