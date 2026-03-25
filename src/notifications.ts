import { Despesa } from './types';

const LAST_CHECK_KEY = 'moneymate_last_notif_check';
const CHECK_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours in ms

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

/** Get pending bills that are due today or overdue */
export function getDespesasVencidas(despesas: Despesa[]): Despesa[] {
  const hoje = new Date();
  const diaHoje = hoje.getDate();

  return despesas.filter((d) => {
    if (!d.diaVencimento || d.status === 'pago' || d.notificacao === 'nenhuma') return false;
    // Due today or overdue this month
    return d.diaVencimento <= diaHoje;
  });
}

/**
 * Notifica vencimentos ao abrir o app.
 * Respeita intervalo de 3h entre notificacoes para nao spam.
 * Despesas vencidas e nao pagas continuam gerando alertas a cada 3h.
 */
export async function notificarVencimentos(despesas: Despesa[]) {
  const vencidas = getDespesasVencidas(despesas);
  if (vencidas.length === 0) return;

  // Check if 3h passed since last notification
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  const now = Date.now();
  if (lastCheck && (now - parseInt(lastCheck, 10)) < CHECK_INTERVAL) return;

  const ok = await requestPermissions();
  if (!ok) return;

  // Save timestamp
  localStorage.setItem(LAST_CHECK_KEY, now.toString());

  if (vencidas.length === 1) {
    const d = vencidas[0];
    const valor = `R$ ${d.valor.toFixed(2).replace('.', ',')}`;
    const vencida = d.diaVencimento! < new Date().getDate();
    new Notification(vencida ? `VENCIDA: ${d.descricao}` : `Hoje vence: ${d.descricao}`, {
      body: `Dia ${d.diaVencimento} - ${valor}`,
      icon: '/icon-192.png',
      tag: 'vencimentos',
    });
  } else {
    const total = vencidas.reduce((s, d) => s + d.valor, 0);
    const vencidasCount = vencidas.filter((d) => d.diaVencimento! < new Date().getDate()).length;
    const body = vencidasCount > 0
      ? `${vencidasCount} vencida(s) | Total: R$ ${total.toFixed(2).replace('.', ',')}`
      : `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
    new Notification(`${vencidas.length} contas pendentes`, {
      body,
      icon: '/icon-192.png',
      tag: 'vencimentos',
    });
  }
}

/** Reseta o timer de check para forcar notificacao na proxima abertura */
export function resetNotifCheck() {
  localStorage.removeItem(LAST_CHECK_KEY);
}
