export type ModoNotificacao = 'vespera' | 'no_dia' | 'ambos' | 'nenhuma';
export type StatusPagamento = 'pendente' | 'pago';
export type Recorrencia = 'mensal' | 'anual';

export interface Projeto {
  id: string;
  nome: string;
  criadoEm: string;
}

export interface Despesa {
  id: string;
  projetoId: string;
  titulo: string;
  descricao?: string; // descrição detalhada, pode conter hyperlinks (http/https)
  valor: number;
  data: string; // YYYY-MM-DD
  categoria: string;
  recorrencia: Recorrencia;
  diaVencimento?: number;
  mesVencimento?: number; // 1-12, only for annual
  notificacao: ModoNotificacao;
  intervaloMinutos: number; // minutos entre alertas no dia/apos vencimento (default: 180 = 3h)
  status: StatusPagamento;
  mesPago?: string; // YYYY-MM
  criadoEm: string;
}

export const MESES_NOMES = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez',
] as const;

export interface NotificacaoConfig {
  alertaLimite: boolean;
  limiteMensal: number;
  horarioPadrao: { hora: number; minuto: number };
  diasAntes: number;
  intervaloNoDia: number;
  intervaloAposVenc: number;
  janelaAtiva: boolean; // toggle janela de horario (default: true)
  janelaInicio: number; // hora inicio (default: 9)
  janelaFim: number; // hora fim (default: 22)
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
