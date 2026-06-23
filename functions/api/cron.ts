import { getDb, initDb, type Env } from '../_lib/db';
import { sendWebPush, type VapidKeys, type PushSubscription } from '../_lib/webpush';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function handler(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const sql = getDb(env);
    await initDb(env);

    const vapid: VapidKeys = {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: 'mailto:moneymate@example.com',
    };

    const now = new Date();
    const spTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const horaLocal = spTime.getHours();
    const diaHoje = spTime.getDate();
    const mesHoje = spTime.getMonth() + 1;

    const devices = await sql`SELECT id FROM devices`;
    let totalSent = 0;

    for (const device of devices) {
      const deviceId = device.id;

      const configRows = await sql`SELECT config FROM device_config WHERE device_id = ${deviceId}`;
      const deviceConfig = configRows.length > 0 ? configRows[0].config : {};
      const janelaAtiva = deviceConfig.janelaAtiva !== false;
      const janelaInicio = deviceConfig.janelaInicio ?? 9;
      const janelaFim = deviceConfig.janelaFim ?? 22;

      if (janelaAtiva && (horaLocal < janelaInicio || horaLocal >= janelaFim)) continue;

      const subs = await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE device_id = ${deviceId}`;
      if (subs.length === 0) continue;

      const despesas = await sql`
        SELECT id, titulo, valor, dia_vencimento, mes_vencimento, recorrencia,
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
        const intervaloMinutos = Number(d.intervalo_horas) || 180; // column named intervalo_horas but stores minutes
        const valor = `R$ ${Number(d.valor).toFixed(2).replace('.', ',')}`;
        const lastNotified = d.last_notified ? new Date(d.last_notified) : null;

        if (recorrencia === 'anual' && mesVenc && mesVenc !== mesHoje) continue;

        let titulo = '';
        let corpo = '';
        let shouldSend = false;

        const isVespera = d.notificacao === 'vespera' || d.notificacao === 'ambos';
        if (isVespera) {
          const dueDate = new Date(now.getFullYear(), now.getMonth(), dia);
          const lastBizDay = new Date(dueDate);
          lastBizDay.setDate(lastBizDay.getDate() - 1);
          while (lastBizDay.getDay() === 0 || lastBizDay.getDay() === 6) {
            lastBizDay.setDate(lastBizDay.getDate() - 1);
          }
          if (diaHoje === lastBizDay.getDate() && now.getMonth() === lastBizDay.getMonth()) {
            const hojeMeia = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (!lastNotified || lastNotified < hojeMeia) {
              titulo = `Amanha vence: ${d.titulo}`;
              corpo = `Vencimento dia ${dia} - ${valor}`;
              shouldSend = true;
            }
          }
        }

        const isNoDia = d.notificacao === 'no_dia' || d.notificacao === 'ambos';
        if (isNoDia && diaHoje >= dia) {
          const intervaloMs = intervaloMinutos * 60 * 1000;
          if (!lastNotified || (now.getTime() - lastNotified.getTime()) >= intervaloMs) {
            if (diaHoje === dia) {
              titulo = `Hoje vence: ${d.titulo}`;
              corpo = `${valor} - dia ${dia}`;
            } else {
              const diasAtraso = diaHoje - dia;
              titulo = `ATRASADO: ${d.titulo}`;
              corpo = `${valor} - venceu dia ${dia} (${diasAtraso}d atras)`;
            }
            shouldSend = true;
          }
        }

        if (!shouldSend) continue;

        let sent = false;
        for (const sub of subs) {
          const pushSub: PushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          };
          try {
            const result = await sendWebPush(pushSub, JSON.stringify({
              title: titulo,
              body: corpo,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              data: { url: '/' },
            }), vapid);
            if (result.ok) {
              sent = true;
              totalSent++;
            } else if (result.expired) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
            }
          } catch (err) {
            console.error('Push send failed:', err);
          }
        }

        if (sent) {
          await sql`UPDATE despesas SET last_notified = NOW() WHERE id = ${d.id}`;
        }
      }
    }

    return json({ ok: true, sent: totalSent, time: now.toISOString() });
  } catch (err: any) {
    console.error('Cron error:', err);
    return json({ error: err.message }, 500);
  }
}

export const onRequestGet: PagesFunction<Env> = ({ request, env }) => handler(request, env);
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handler(request, env);
