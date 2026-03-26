import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { getDb, initDb } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = getDb();
    await initDb();

    webpush.setVapidDetails(
      'mailto:moneymate@example.com',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    const now = new Date();
    // Convert to Sao Paulo timezone
    const spTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const horaLocal = spTime.getHours();
    const diaHoje = spTime.getDate();
    const mesHoje = spTime.getMonth() + 1;

    // Janela de horario: 9h - 22h (Brasilia)
    if (horaLocal < 9 || horaLocal >= 22) {
      return res.status(200).json({ ok: true, sent: 0, skipped: 'outside_window', hora: horaLocal });
    }

    const devices = await sql`SELECT id FROM devices`;
    let totalSent = 0;

    for (const device of devices) {
      const deviceId = device.id;

      const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE device_id = ${deviceId}`;
      if (subs.length === 0) continue;

      // Get pending despesas with vencimento and notifications enabled
      const despesas = await sql`
        SELECT id, descricao, valor, dia_vencimento, mes_vencimento, recorrencia,
               notificacao, intervalo_horas, last_notified
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
        const intervaloMinutos = Number(d.intervalo_horas) || 180; // column still named intervalo_horas but stores minutes now
        const valor = `R$ ${Number(d.valor).toFixed(2).replace('.', ',')}`;
        const lastNotified = d.last_notified ? new Date(d.last_notified) : null;

        // Annual: skip if not the right month
        if (recorrencia === 'anual' && mesVenc && mesVenc !== mesHoje) continue;

        let titulo = '';
        let corpo = '';
        let shouldSend = false;

        // 1 business day before (vespera) - Friday if due Monday
        const isVespera = d.notificacao === 'vespera' || d.notificacao === 'ambos';
        if (isVespera) {
          // Find the last business day before the due date
          const dueDate = new Date(now.getFullYear(), now.getMonth(), dia);
          const lastBizDay = new Date(dueDate);
          lastBizDay.setDate(lastBizDay.getDate() - 1);
          // Skip weekends: if Sunday go to Friday, if Saturday go to Friday
          while (lastBizDay.getDay() === 0 || lastBizDay.getDay() === 6) {
            lastBizDay.setDate(lastBizDay.getDate() - 1);
          }

          if (diaHoje === lastBizDay.getDate() && now.getMonth() === lastBizDay.getMonth()) {
            const hojeMeia = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (!lastNotified || lastNotified < hojeMeia) {
              titulo = `Amanha vence: ${d.descricao}`;
              corpo = `Vencimento dia ${dia} - ${valor}`;
              shouldSend = true;
            }
          }
        }

        // On the day and after (no_dia)
        const isNoDia = d.notificacao === 'no_dia' || d.notificacao === 'ambos';
        if (isNoDia && diaHoje >= dia) {
          // Check if enough time passed since last notification
          const intervaloMs = intervaloMinutos * 60 * 1000;
          if (!lastNotified || (now.getTime() - lastNotified.getTime()) >= intervaloMs) {
            if (diaHoje === dia) {
              titulo = `Hoje vence: ${d.descricao}`;
              corpo = `${valor} - dia ${dia}`;
            } else {
              const diasAtraso = diaHoje - dia;
              titulo = `ATRASADO: ${d.descricao}`;
              corpo = `${valor} - venceu dia ${dia} (${diasAtraso}d atras)`;
            }
            shouldSend = true;
            tipo = 'no_dia';
          }
        }

        if (!shouldSend) continue;

        // Send to all subscriptions
        let sent = false;
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
            sent = true;
            totalSent++;
          } catch (err: any) {
            if (err.statusCode === 410) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
            }
          }
        }

        // Update last_notified
        if (sent) {
          await sql`UPDATE despesas SET last_notified = NOW() WHERE id = ${d.id}`;
        }
      }
    }

    return res.status(200).json({ ok: true, sent: totalSent, time: now.toISOString() });
  } catch (err: any) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: err.message });
  }
}
