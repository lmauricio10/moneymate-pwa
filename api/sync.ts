import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, initDb } from './db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    await initDb();

    const { deviceId, despesas, projetos, config } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    // Upsert device
    await sql`INSERT INTO devices (id) VALUES (${deviceId}) ON CONFLICT (id) DO NOTHING`;

    // Sync projetos - upsert all, remove deleted
    if (projetos && Array.isArray(projetos)) {
      const projetoIds = projetos.map((p: any) => p.id);

      for (const p of projetos) {
        await sql`INSERT INTO projetos (id, device_id, nome, criado_em)
          VALUES (${p.id}, ${deviceId}, ${p.nome}, ${p.criadoEm})
          ON CONFLICT (id) DO UPDATE SET nome = ${p.nome}`;
      }

      // Remove projetos that no longer exist locally
      if (projetoIds.length > 0) {
        await sql`DELETE FROM projetos WHERE device_id = ${deviceId} AND id != ALL(${projetoIds})`;
      }
    }

    // Sync despesas - upsert all, remove deleted
    if (despesas && Array.isArray(despesas)) {
      const despesaIds = despesas.map((d: any) => d.id);

      for (const d of despesas) {
        await sql`INSERT INTO despesas (id, device_id, projeto_id, descricao, valor, data, categoria, recorrencia, dia_vencimento, mes_vencimento, notificacao, intervalo_horas, status, mes_pago, criado_em)
          VALUES (${d.id}, ${deviceId}, ${d.projetoId}, ${d.descricao}, ${d.valor}, ${d.data}, ${d.categoria}, ${d.recorrencia || 'mensal'}, ${d.diaVencimento || null}, ${d.mesVencimento || null}, ${d.notificacao}, ${d.intervaloMinutos ?? 180}, ${d.status || 'pendente'}, ${d.mesPago || null}, ${d.criadoEm})
          ON CONFLICT (id) DO UPDATE SET
            descricao = ${d.descricao},
            valor = ${d.valor},
            data = ${d.data},
            categoria = ${d.categoria},
            recorrencia = ${d.recorrencia || 'mensal'},
            dia_vencimento = ${d.diaVencimento || null},
            mes_vencimento = ${d.mesVencimento || null},
            notificacao = ${d.notificacao},
            intervalo_horas = ${d.intervaloMinutos ?? 180},
            status = ${d.status || 'pendente'},
            mes_pago = ${d.mesPago || null}`;
      }

      if (despesaIds.length > 0) {
        await sql`DELETE FROM despesas WHERE device_id = ${deviceId} AND id != ALL(${despesaIds})`;
      }
    }

    // Sync config
    if (config) {
      await sql`INSERT INTO device_config (device_id, config)
        VALUES (${deviceId}, ${JSON.stringify(config)})
        ON CONFLICT (device_id) DO UPDATE SET config = ${JSON.stringify(config)}`;
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
