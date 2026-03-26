import { Despesa, NotificacaoConfig } from './types';

const LAST_CHECK_KEY = 'moneymate_last_notif_check';

export function notificacoesSuportadas(): boolean {
  return 'Notification' in window;
}

export async function requestPermissions(): Promise<boolean> {
  if (!notificacoesSuportadas()) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function enviarNotificacaoTeste(): Promise<boolean> {
  const ok = await requestPermissions();
  if (!ok) return false;
  new Notification('MoneyMate - Teste', {
    body: 'Notificacao de teste funcionando!',
    icon: '/icon-192.png',
  });
  return true;
}

export async function enviarNotificacaoDespesa(despesa: Despesa): Promise<boolean> {
  const ok = await requestPermissions();
  if (!ok) return false;
  const valor = `R$ ${despesa.valor.toFixed(2).replace('.', ',')}`;
  new Notification(`Lembrete: ${despesa.descricao}`, {
    body: `Vencimento dia ${despesa.diaVencimento} - ${valor}`,
    icon: '/icon-192.png',
    tag: `despesa-${despesa.id}`,
  });
  return true;
}

/** Get pending bills approaching, due today, or overdue */
export function getDespesasPendentes(despesas: Despesa[], config: NotificacaoConfig): {
  proximas: Despesa[];
  hoje: Despesa[];
  vencidas: Despesa[];
} {
  const diaHoje = new Date().getDate();
  const diasAntes = config.diasAntes ?? 1;

  const proximas: Despesa[] = [];
  const hoje: Despesa[] = [];
  const vencidas: Despesa[] = [];

  for (const d of despesas) {
    if (!d.diaVencimento || d.status === 'pago' || d.notificacao === 'nenhuma') continue;
    // Annual: only alert in the correct month
    if (d.recorrencia === 'anual' && d.mesVencimento !== new Date().getMonth() + 1) continue;

    if (d.diaVencimento === diaHoje) {
      hoje.push(d);
    } else if (d.diaVencimento < diaHoje) {
      vencidas.push(d);
    } else if (d.diaVencimento - diaHoje <= diasAntes) {
      proximas.push(d);
    }
  }

  return { proximas, hoje, vencidas };
}

/**
 * Notifica vencimentos ao abrir o app.
 * Usa intervalos configuraveis para cada tipo de alerta.
 */
export async function notificarVencimentos(despesas: Despesa[], config: NotificacaoConfig) {
  const { proximas, hoje, vencidas } = getDespesasPendentes(despesas, config);
  const total = proximas.length + hoje.length + vencidas.length;
  if (total === 0) return;

  // Determine the minimum interval based on what we have
  let intervaloMs: number;
  if (vencidas.length > 0) {
    intervaloMs = (config.intervaloAposVenc ?? 180) * 60 * 1000;
  } else if (hoje.length > 0) {
    intervaloMs = (config.intervaloNoDia ?? 180) * 60 * 1000;
  } else {
    // Proximas: alert once per day (check at configured time)
    intervaloMs = 12 * 60 * 60 * 1000;
  }

  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  const now = Date.now();
  if (lastCheck && (now - parseInt(lastCheck, 10)) < intervaloMs) return;

  const ok = await requestPermissions();
  if (!ok) return;

  localStorage.setItem(LAST_CHECK_KEY, now.toString());

  // Build notification
  const allPending = [...vencidas, ...hoje, ...proximas];

  if (allPending.length === 1) {
    const d = allPending[0];
    const valor = `R$ ${d.valor.toFixed(2).replace('.', ',')}`;
    const diaHoje = new Date().getDate();
    let title: string;
    if (d.diaVencimento! < diaHoje) title = `VENCIDA: ${d.descricao}`;
    else if (d.diaVencimento! === diaHoje) title = `Hoje vence: ${d.descricao}`;
    else title = `Vence em ${d.diaVencimento! - diaHoje} dia(s): ${d.descricao}`;

    new Notification(title, {
      body: `Dia ${d.diaVencimento} - ${valor}`,
      icon: '/icon-192.png',
      tag: 'vencimentos',
    });
  } else {
    const totalValor = allPending.reduce((s, d) => s + d.valor, 0);
    const parts: string[] = [];
    if (vencidas.length > 0) parts.push(`${vencidas.length} vencida(s)`);
    if (hoje.length > 0) parts.push(`${hoje.length} p/ hoje`);
    if (proximas.length > 0) parts.push(`${proximas.length} proxima(s)`);

    new Notification(`${allPending.length} contas pendentes`, {
      body: `${parts.join(' | ')} | R$ ${totalValor.toFixed(2).replace('.', ',')}`,
      icon: '/icon-192.png',
      tag: 'vencimentos',
    });
  }
}

export function resetNotifCheck() {
  localStorage.removeItem(LAST_CHECK_KEY);
}
