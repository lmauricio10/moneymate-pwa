import { useState, useMemo } from 'react';
import { colors } from '../colors';
import { Despesa, NotificacaoConfig, ModoNotificacao, NOTIFICACAO_LABELS } from '../types';
import AddDespesaModal from './AddDespesaModal';

const MESES = [
  'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function fmt(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}`; }
function fmtDate(iso: string) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }

interface Props {
  despesas: Despesa[];
  config: NotificacaoConfig;
  addDespesa: (d: Omit<Despesa, 'id' | 'criadoEm' | 'status'>) => void;
  removeDespesa: (id: string) => void;
  togglePago: (id: string) => void;
  getDespesasMes: (ano: number, mes: number) => Despesa[];
  getTotalMes: (ano: number, mes: number) => number;
}

export default function DespesasScreen({ config, addDespesa, removeDespesa, togglePago, getDespesasMes, getTotalMes }: Props) {
  const [showModal, setShowModal] = useState(false);
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const despesasMes = useMemo(() => getDespesasMes(ano, mes), [getDespesasMes, ano, mes]);
  const totalMes = useMemo(() => getTotalMes(ano, mes), [getTotalMes, ano, mes]);
  const pendentes = useMemo(() => despesasMes.filter((d) => d.status !== 'pago').length, [despesasMes]);

  const navMes = (dir: -1 | 1) => {
    let nm = mes + dir, na = ano;
    if (nm < 1) { nm = 12; na--; }
    if (nm > 12) { nm = 1; na++; }
    setMes(nm); setAno(na);
  };

  const handleDelete = (item: Despesa) => {
    if (confirm(`Remover "${item.descricao}"?`)) removeDespesa(item.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Month nav */}
      <div style={S.mesNav}>
        <button onClick={() => navMes(-1)} style={S.navBtn}>&#9664;</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{MESES[mes - 1]} {ano}</span>
        <button onClick={() => navMes(1)} style={S.navBtn}>&#9654;</button>
      </div>

      {/* Total */}
      <div style={S.totalBox}>
        <div style={{ color: colors.textSecondary, fontSize: 14 }}>Total do mes</div>
        <div style={{ color: colors.expense, fontSize: 32, fontWeight: 800, marginTop: 4 }}>{fmt(totalMes)}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          {pendentes > 0 ? (
            <span style={{ color: colors.warning, fontSize: 13, fontWeight: 600 }}>
              {pendentes} pendente{pendentes > 1 ? 's' : ''}
            </span>
          ) : despesasMes.length > 0 ? (
            <span style={{ color: colors.success, fontSize: 13, fontWeight: 600 }}>Todas pagas</span>
          ) : null}
          {config.alertaLimite && (
            <span style={{ color: totalMes >= config.limiteMensal ? colors.danger : colors.textMuted, fontSize: 13 }}>
              Limite: {fmt(config.limiteMensal)}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px', paddingBottom: 80 }}>
        {despesasMes.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: colors.textMuted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16 }}>Nenhuma despesa neste mes</div>
          </div>
        ) : (
          despesasMes.map((item) => {
            const isPago = item.status === 'pago';
            return (
              <div key={item.id} style={{ ...S.card, ...(isPago ? S.cardPago : {}), }}>
                {/* Status button */}
                <button onClick={() => togglePago(item.id)} style={S.statusBtn}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 13,
                    border: `2px solid ${isPago ? colors.success : colors.textMuted}`,
                    background: isPago ? colors.success : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: colors.white, fontSize: 14, fontWeight: 700,
                  }}>
                    {isPago ? '✓' : ''}
                  </div>
                </button>

                <div style={{ flex: 1, marginRight: 12 }} onClick={() => handleDelete(item)}>
                  <div style={{
                    fontSize: 16, fontWeight: 600,
                    textDecoration: isPago ? 'line-through' : 'none',
                    color: isPago ? colors.textMuted : colors.text,
                  }}>
                    {item.descricao}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                    {item.categoria} - {fmtDate(item.data)}
                    {item.diaVencimento ? ` | Venc. dia ${item.diaVencimento}` : ''}
                  </div>
                  {item.diaVencimento && item.notificacao !== 'nenhuma' && !isPago && (
                    <div style={{ color: colors.primary, fontSize: 11, marginTop: 2 }}>
                      {NOTIFICACAO_LABELS[item.notificacao]}
                    </div>
                  )}
                  {isPago && <div style={{ color: colors.success, fontSize: 11, fontWeight: 700, marginTop: 2 }}>Pago</div>}
                </div>

                <div style={{ color: isPago ? colors.success : colors.expense, fontSize: 16, fontWeight: 700 }}>
                  {fmt(item.valor)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowModal(true)} style={S.fab}>+</button>

      <AddDespesaModal open={showModal} onClose={() => setShowModal(false)} onSave={addDespesa} />
    </div>
  );
}

const S = {
  mesNav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px',
  },
  navBtn: {
    background: 'none', border: 'none', color: colors.text, fontSize: 18, cursor: 'pointer', padding: 8,
  },
  totalBox: {
    background: colors.card, margin: '0 16px', borderRadius: 16, padding: 20,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', marginBottom: 12,
  },
  card: {
    background: colors.surface, borderRadius: 12, padding: 14,
    display: 'flex', alignItems: 'center', marginBottom: 8,
    border: `1px solid ${colors.border}`, cursor: 'pointer',
  },
  cardPago: {
    opacity: 0.6, borderColor: `${colors.success}40`,
  },
  statusBtn: {
    background: 'none', border: 'none', cursor: 'pointer', marginRight: 12, padding: 2,
  },
  fab: {
    position: 'fixed' as const, right: 20, bottom: 76, width: 56, height: 56,
    borderRadius: 28, background: colors.primary, color: colors.white,
    border: 'none', fontSize: 28, fontWeight: 700, cursor: 'pointer',
    boxShadow: `0 4px 12px ${colors.primary}66`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
