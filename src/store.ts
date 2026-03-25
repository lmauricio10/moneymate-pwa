import { Despesa, NotificacaoConfig } from './types';

const STORAGE_KEY = 'moneymate_despesas';
const CONFIG_KEY = 'moneymate_config';

export const DEFAULT_CONFIG: NotificacaoConfig = {
  alertaLimite: false,
  limiteMensal: 3000,
  horarioPadrao: { hora: 20, minuto: 0 },
};

function getMesAtual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function resetarStatusMensal(despesas: Despesa[]): { atualizadas: Despesa[]; mudou: boolean } {
  const mesAtual = getMesAtual();
  let mudou = false;
  const atualizadas = despesas.map((d) => {
    if (d.diaVencimento && d.status === 'pago' && d.mesPago !== mesAtual) {
      mudou = true;
      return { ...d, status: 'pendente' as const, mesPago: undefined };
    }
    return d;
  });
  return { atualizadas, mudou };
}

export function loadDespesas(): Despesa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let despesas: Despesa[] = JSON.parse(raw);
    // Migration
    despesas = despesas.map((d) => ({ ...d, status: d.status || 'pendente' }));
    const { atualizadas, mudou } = resetarStatusMensal(despesas);
    if (mudou) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizadas));
    }
    return mudou ? atualizadas : despesas;
  } catch {
    return [];
  }
}

export function saveDespesas(despesas: Despesa[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(despesas));
}

export function loadConfig(): NotificacaoConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: NotificacaoConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function exportData(despesas: Despesa[], config: NotificacaoConfig) {
  const data = JSON.stringify({ despesas, config, exportadoEm: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moneymate_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file: File): Promise<{ despesas: Despesa[]; config?: NotificacaoConfig }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.despesas || !Array.isArray(parsed.despesas)) {
          reject(new Error('Arquivo invalido'));
          return;
        }
        resolve({ despesas: parsed.despesas, config: parsed.config });
      } catch {
        reject(new Error('JSON invalido'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
}
