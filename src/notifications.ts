import { Despesa } from './types';

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

/** Checks on app open for pending bills due today or overdue */
export function verificarVencimentos(despesas: Despesa[]): Despesa[] {
  const hoje = new Date();
  const diaHoje = hoje.getDate();

  return despesas.filter((d) => {
    if (!d.diaVencimento || d.status === 'pago' || d.notificacao === 'nenhuma') return false;
    // Due today or overdue
    return d.diaVencimento <= diaHoje;
  });
}

export async function notificarVencimentos(despesas: Despesa[]) {
  const vencidas = verificarVencimentos(despesas);
  if (vencidas.length === 0) return;

  const ok = await requestPermissions();
  if (!ok) return;

  if (vencidas.length === 1) {
    const d = vencidas[0];
    const valor = `R$ ${d.valor.toFixed(2).replace('.', ',')}`;
    new Notification(`Conta pendente: ${d.descricao}`, {
      body: `Vencimento dia ${d.diaVencimento} - ${valor}`,
      icon: '/icon-192.png',
      tag: 'vencimentos',
    });
  } else {
    const total = vencidas.reduce((s, d) => s + d.valor, 0);
    new Notification(`${vencidas.length} contas pendentes`, {
      body: `Total: R$ ${total.toFixed(2).replace('.', ',')} - Abra o app para verificar`,
      icon: '/icon-192.png',
      tag: 'vencimentos',
    });
  }
}
