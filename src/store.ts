import { Despesa, NotificacaoConfig, Projeto } from './types';

const STORAGE_KEY = 'moneymate_despesas';
const CONFIG_KEY = 'moneymate_config';
const PROJETOS_KEY = 'moneymate_projetos';
const PROJETO_ATIVO_KEY = 'moneymate_projeto_ativo';

const DEFAULT_PROJETO: Projeto = {
  id: 'pessoal',
  nome: 'Pessoal',
  criadoEm: new Date().toISOString(),
};

export const DEFAULT_CONFIG: NotificacaoConfig = {
  alertaLimite: false,
  limiteMensal: 3000,
  horarioPadrao: { hora: 20, minuto: 0 },
  diasAntes: 1,
  intervaloNoDia: 180,
  intervaloAposVenc: 180,
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

export function loadProjetos(): Projeto[] {
  try {
    const raw = localStorage.getItem(PROJETOS_KEY);
    if (!raw) return [DEFAULT_PROJETO];
    const projetos: Projeto[] = JSON.parse(raw);
    return projetos.length > 0 ? projetos : [DEFAULT_PROJETO];
  } catch {
    return [DEFAULT_PROJETO];
  }
}

export function saveProjetos(projetos: Projeto[]) {
  localStorage.setItem(PROJETOS_KEY, JSON.stringify(projetos));
}

export function loadProjetoAtivo(): string {
  return localStorage.getItem(PROJETO_ATIVO_KEY) || 'pessoal';
}

export function saveProjetoAtivo(id: string) {
  localStorage.setItem(PROJETO_ATIVO_KEY, id);
}

export function loadDespesas(): Despesa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let despesas: Despesa[] = JSON.parse(raw);
    // Migration: add status, projetoId, recorrencia
    despesas = despesas.map((d) => ({
      ...d,
      status: d.status || 'pendente',
      projetoId: d.projetoId || 'pessoal',
      recorrencia: d.recorrencia || 'mensal',
    }));
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

export function exportData(despesas: Despesa[], config: NotificacaoConfig, projetos: Projeto[]) {
  const data = JSON.stringify({ despesas, config, projetos, exportadoEm: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moneymate_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file: File): Promise<{ despesas: Despesa[]; config?: NotificacaoConfig; projetos?: Projeto[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.despesas || !Array.isArray(parsed.despesas)) {
          reject(new Error('Arquivo invalido'));
          return;
        }
        resolve({ despesas: parsed.despesas, config: parsed.config, projetos: parsed.projetos });
      } catch {
        reject(new Error('JSON invalido'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
}
