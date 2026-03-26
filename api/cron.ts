import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { getDb, initDb } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = getDb();
    await initDb();

    const vapidPublic = process.env.VAPID_PUBLIC_KEY!;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY!;

    webpush.setVapidDetails('mailto:moneymate@example.com', vapidPublic, vapidPrivate);

    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth() + 1;

    // Get all devices with their despesas, config, and subscriptions
    const devices = await sql`SELECT id FROM devices`;

    let totalSent = 0;

    for (const device of devices) {
      const deviceId = device.id;

      // Get config
      const configRows = await sql`SELECT config FROM device_config WHERE device_id = ${deviceId}`;
      const config = configRows.length > 0 ? configRows[0].config : {};
      const diasAntes = config.diasAntes ?? 1;

      // Get push subscriptions
      const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE device_id = ${deviceId}`;
      if (subs.length === 0) continue;

      // Get pending despesas with vencimento
      const despesas = await sql`
        SELECT descricao, valor, dia_vencimento, mes_vencimento, recorrencia, notificacao
        FROM despesas
        WHERE device_id = ${deviceId}
          AND status = 'pendente'
          AND dia_vencimento IS NOT NULL
          AND notificacao != 'nenhuma'
      `;

      for (const d of despesas) {
        const dia = d.dia_vencimento;
        const mesVenc = d.mes_vencimento;
        const recorrencia = d.recorrencia || 'mensal';
        const valor = `R$ ${Number(d.valor).toFixed(2).replace('.', ',')}`;

        // Annual: skip if not the right month
        if (recorrencia === 'anual' && mesVenc && mesVenc !== mesHoje) continue;

        let titulo = '';
        let corpo = '';
        let shouldSend = false;

        // Check vespera (day before)
        const diaVespera = dia === 1 ? 28 : dia - 1;
        const isVespera = (d.notificacao === 'vespera' || d.notificacao === 'ambos');

        // For configurable diasAntes
        const diasDiff = dia - diaHoje;
        const isAntecipado = diasDiff > 0 && diasDiff <= diasAntes;

        if (isVespera && (diaHoje === diaVespera || isAntecipado)) {
          titulo = `Amanha vence: ${d.descricao}`;
          corpo = `Vencimento dia ${dia} - ${valor}`;
          shouldSend = true;
        }

        // Check no_dia (on the day)
        const isNoDia = (d.notificacao === 'no_dia' || d.notificacao === 'ambos');
        if (isNoDia && diaHoje === dia) {
          titulo = `Hoje vence: ${d.descricao}`;
          corpo = `${valor} - dia ${dia}`;
          shouldSend = true;
        }

        // Check overdue (after due date)
        if (isNoDia && diaHoje > dia) {
          const diasAtraso = diaHoje - dia;
          titulo = `ATRASADO: ${d.descricao}`;
          corpo = `${valor} - venceu dia ${dia} (${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} atras)`;
          shouldSend = true;
        }

        if (!shouldSend) continue;

        // Send to all subscriptions for this device
        for (const sub of subs) {
          const pushSub = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };

          try {
            await webpush.sendNotification(pushSub, JSON.stringify({
              title: titulo,
              body: corpo,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              data: { url: '/' },
            }));
            totalSent++;
          } catch (err: any) {
            // Remove invalid subscriptions (410 Gone)
            if (err.statusCode === 410) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
            }
            console.error('Push error:', err.statusCode || err.message);
          }
        }
      }
    }

    return res.status(200).json({ ok: true, sent: totalSent });
  } catch (err: any) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
