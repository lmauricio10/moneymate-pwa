export type ModoNotificacao = 'vespera' | 'no_dia' | 'ambos' | 'nenhuma';
export type StatusPagamento = 'pendente' | 'pago';

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  categoria: string;
  diaVencimento?: number;
  notificacao: ModoNotificacao;
  status: StatusPagamento;
  mesPago?: string; // YYYY-MM
  criadoEm: string;
}

export interface NotificacaoConfig {
  alertaLimite: boolean;
  limiteMensal: number;
  horarioPadrao: { hora: number; minuto: number };
}

export const CATEGORIAS = [
  'Alimentacao',
  'Transporte',
  'Moradia',
  'Saude',
  'Educacao',
  'Lazer',
  'Vestuario',
  'Assinaturas',
  'Contas',
  'Mercado',
  'Outros',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const NOTIFICACAO_LABELS: Record<ModoNotificacao, string> = {
  vespera: '1 dia antes',
  no_dia: 'No dia (a cada 3h)',
  ambos: 'Vespera + no dia',
  nenhuma: 'Sem lembrete',
};
