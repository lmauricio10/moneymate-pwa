import { getDb, initDb, type Env } from '../_lib/db';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const sql = getDb(env);
    await initDb(env); // 1 subrequest (batched DDL)

    const { deviceId, despesas, projetos, config } = await request.json<any>();
    if (!deviceId) return json({ error: 'deviceId required' }, 400);

    // Collect every write, then run as ONE transaction (1 subrequest) so the
    // number of despesas can't push us past Cloudflare's 50-subrequest cap.
    const writes: any[] = [];
    writes.push(sql`INSERT INTO devices (id) VALUES (${deviceId}) ON CONFLICT (id) DO NOTHING`);

    if (projetos && Array.isArray(projetos)) {
      for (const p of projetos) {
        writes.push(sql`INSERT INTO projetos (id, device_id, nome, criado_em)
          VALUES (${p.id}, ${deviceId}, ${p.nome}, ${p.criadoEm})
          ON CONFLICT (id) DO UPDATE SET nome = ${p.nome}`);
      }
      const projetoIds = projetos.map((p: any) => p.id);
      if (projetoIds.length > 0) {
        writes.push(sql`DELETE FROM projetos WHERE device_id = ${deviceId} AND id != ALL(${projetoIds})`);
      }
    }

    if (despesas && Array.isArray(despesas)) {
      for (const d of despesas) {
        writes.push(sql`INSERT INTO despesas (id, device_id, projeto_id, titulo, descricao, valor, data, categoria, recorrencia, dia_vencimento, mes_vencimento, notificacao, intervalo_horas, status, mes_pago, criado_em)
          VALUES (${d.id}, ${deviceId}, ${d.projetoId}, ${d.titulo || ''}, ${d.descricao || null}, ${d.valor}, ${d.data}, ${d.categoria}, ${d.recorrencia || 'mensal'}, ${d.diaVencimento || null}, ${d.mesVencimento || null}, ${d.notificacao}, ${d.intervaloMinutos ?? 180}, ${d.status || 'pendente'}, ${d.mesPago || null}, ${d.criadoEm})
          ON CONFLICT (id) DO UPDATE SET
            titulo = ${d.titulo || ''},
            descricao = ${d.descricao || null},
            valor = ${d.valor},
            data = ${d.data},
            categoria = ${d.categoria},
            recorrencia = ${d.recorrencia || 'mensal'},
            dia_vencimento = ${d.diaVencimento || null},
            mes_vencimento = ${d.mesVencimento || null},
            notificacao = ${d.notificacao},
            intervalo_horas = ${d.intervaloMinutos ?? 180},
            status = ${d.status || 'pendente'},
            mes_pago = ${d.mesPago || null}`);
      }
      const despesaIds = despesas.map((d: any) => d.id);
      if (despesaIds.length > 0) {
        writes.push(sql`DELETE FROM despesas WHERE device_id = ${deviceId} AND id != ALL(${despesaIds})`);
      }
    }

    if (config) {
      writes.push(sql`INSERT INTO device_config (device_id, config)
        VALUES (${deviceId}, ${JSON.stringify(config)})
        ON CONFLICT (device_id) DO UPDATE SET config = ${JSON.stringify(config)}`);
    }

    await sql.transaction(writes);

    return json({ ok: true });
  } catch (err: any) {
    console.error('Sync error:', err);
    return json({ error: err.message }, 500);
  }
};
