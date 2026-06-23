import { getDb, type Env } from '../_lib/db';
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
    // No initDb here: /api/sync maintains the schema. Keeping cron read-light
    // matters because Cloudflare's free tier caps subrequests at 50/invocation.

    const vapid: VapidKeys = {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: 'mailto:moneymate@example.com',
    };

    const now = new Date();
    // Robustly derive São Paulo wall-clock parts. The old
    // `new Date(now.toLocaleString(..., {timeZone}))` trick yields an Invalid
    // Date on the Workers runtime (NaN parts -> nothing ever sends).
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const part = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const horaLocal = part('hour');
    const diaHoje = part('day');
    const mesHoje = part('month');
    const anoHoje = part('year');
    // SP is UTC-3 year-round (no DST since 2019).
    const spMidnight = new Date(`${anoHoje}-${String(mesHoje).padStart(2, '0')}-${String(diaHoje).padStart(2, '0')}T00:00:00-03:00`);

    // ONE subrequest: pull configs, pending despesas, and subscriptions for all
    // devices. We then do all per-device logic in JS (zero extra DB round-trips).
    const [configs, despesas, subs] = await sql.transaction([
      sql`SELECT device_id, config FROM device_config`,
      sql`SELECT id, device_id, titulo, valor, dia_vencimento, mes_vencimento, recorrencia,
                 notificacao, intervalo_horas, last_notified
          FROM despesas
          WHERE status = 'pendente' AND dia_vencimento IS NOT NULL AND notificacao != 'nenhuma'`,
      sql`SELECT device_id, endpoint, p256dh, auth FROM push_subscriptions`,
    ]);

    const configByDevice = new Map<string, any>();
    for (const c of configs) configByDevice.set(c.device_id, c.config || {});

    const subsByDevice = new Map<string, any[]>();
    for (const s of subs) {
      const arr = subsByDevice.get(s.device_id) || [];
      arr.push(s);
      subsByDevice.set(s.device_id, arr);
    }

    const expiredEndpoints: string[] = [];
    const notifiedIds: string[] = [];
    let totalSent = 0;

    for (const d of despesas) {
      const deviceSubs = subsByDevice.get(d.device_id);
      if (!deviceSubs || deviceSubs.length === 0) continue;

      const cfg = configByDevice.get(d.device_id) || {};
      const janelaAtiva = cfg.janelaAtiva !== false;
      const janelaInicio = cfg.janelaInicio ?? 9;
      const janelaFim = cfg.janelaFim ?? 22;
      if (janelaAtiva && (horaLocal < janelaInicio || horaLocal >= janelaFim)) continue;

      const dia = d.dia_vencimento;
      const mesVenc = d.mes_vencimento;
      const recorrencia = d.recorrencia || 'mensal';
      const intervaloMinutos = Number(d.intervalo_horas) || 180; // column named *_horas, stores minutes
      const valor = `R$ ${Number(d.valor).toFixed(2).replace('.', ',')}`;
      const lastNotified = d.last_notified ? new Date(d.last_notified) : null;

      if (recorrencia === 'anual' && mesVenc && mesVenc !== mesHoje) continue;

      let titulo = '';
      let corpo = '';
      let shouldSend = false;

      const isVespera = d.notificacao === 'vespera' || d.notificacao === 'ambos';
      if (isVespera) {
        // Weekday is tz-invariant at midnight, so compute on a UTC date built
        // from the SP calendar day.
        const dueDate = new Date(Date.UTC(anoHoje, mesHoje - 1, dia));
        const lastBizDay = new Date(dueDate);
        lastBizDay.setUTCDate(lastBizDay.getUTCDate() - 1);
        while (lastBizDay.getUTCDay() === 0 || lastBizDay.getUTCDay() === 6) {
          lastBizDay.setUTCDate(lastBizDay.getUTCDate() - 1);
        }
        if (diaHoje === lastBizDay.getUTCDate() && mesHoje - 1 === lastBizDay.getUTCMonth()) {
          if (!lastNotified || lastNotified < spMidnight) {
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
      for (const sub of deviceSubs) {
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
            expiredEndpoints.push(sub.endpoint);
          }
        } catch (err) {
          console.error('Push send failed:', err);
        }
      }

      if (sent) notifiedIds.push(d.id);
    }

    // Batch the two write sets into ONE transaction (1 subrequest).
    const writes: any[] = [];
    if (notifiedIds.length > 0) {
      writes.push(sql`UPDATE despesas SET last_notified = NOW() WHERE id = ANY(${notifiedIds})`);
    }
    if (expiredEndpoints.length > 0) {
      writes.push(sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${expiredEndpoints})`);
    }
    if (writes.length > 0) await sql.transaction(writes);

    return json({ ok: true, sent: totalSent, expired: expiredEndpoints.length, time: now.toISOString() });
  } catch (err: any) {
    console.error('Cron error:', err);
    return json({ error: err.message }, 500);
  }
}

export const onRequestGet: PagesFunction<Env> = ({ request, env }) => handler(request, env);
export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handler(request, env);
