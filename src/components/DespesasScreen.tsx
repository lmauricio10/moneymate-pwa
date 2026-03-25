import { useState, useMemo } from 'react';
import { colors } from '../colors';
import { Despesa, NotificacaoConfig, Projeto, NOTIFICACAO_LABELS } from '../types';
import AddDespesaModal from './AddDespesaModal';

const MESES = [
  'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

function fmt(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}`; }

interface Props {
  despesas: Despesa[];
  config: NotificacaoConfig;
  projetos: Projeto[];
  projetoAtivo: string;
  addDespesa: (d: Omit<Despesa, 'id' | 'criadoEm' | 'status'>) => void;
  updateDespesa: (id: string, changes: Partial<Omit<Despesa, 'id' | 'criadoEm'>>) => void;
  removeDespesa: (id: string) => void;
  togglePago: (id: string) => void;
  getDespesasMes: (ano: number, mes: number) => Despesa[];
  getTotalMes: (ano: number, mes: number) => number;
  addProjeto: (nome: string) => void;
  renameProjeto: (id: string, nome: string) => void;
  removeProjeto: (id: string) => void;
  selectProjeto: (id: string) => void;
}

export default function DespesasScreen({
  despesas, config, projetos, projetoAtivo,
  addDespesa, updateDespesa, removeDespesa, togglePago,
  getDespesasMes, getTotalMes,
  addProjeto, renameProjeto, removeProjeto, selectProjeto,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [editDespesa, setEditDespesa] = useState<Despesa | null>(null);
  const [showProjetoMenu, setShowProjetoMenu] = useState(false);
  const [novoProjetoNome, setNovoProjetoNome] = useState('');
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const projetoNome = projetos.find((p) => p.id === projetoAtivo)?.nome || 'Pessoal';

  // All recurring bills for this project show every month
  const despesasMes = useMemo(() => {
    return despesas.filter((d) => {
      if (d.projetoId !== projetoAtivo) return false;
      // Recurring bills (have diaVencimento) show in all months
      if (d.diaVencimento) return true;
      // One-time expenses filter by date
      const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
      return d.data.startsWith(prefix);
    });
  }, [despesas, projetoAtivo, ano, mes]);

  const totalMes = useMemo(() => despesasMes.reduce((s, d) => s + d.valor, 0), [despesasMes]);
  const pendentes = useMemo(() => despesasMes.filter((d) => d.status !== 'pago').length, [despesasMes]);

  const navMes = (dir: -1 | 1) => {
    let nm = mes + dir, na = ano;
    if (nm < 1) { nm = 12; na--; }
    if (nm > 12) { nm = 1; na++; }
    setMes(nm); setAno(na);
  };

  const handleAddProjeto = () => {
    const nome = novoProjetoNome.trim();
    if (!nome) return;
    addProjeto(nome);
    setNovoProjetoNome('');
    setShowProjetoMenu(false);
  };

  const handleRenameProjeto = (id: string, nomeAtual: string) => {
    const nome = prompt('Novo nome:', nomeAtual);
    if (nome && nome.trim()) renameProjeto(id, nome.trim());
  };

  const handleRemoveProjeto = (id: string, nome: string) => {
    if (projetos.length <= 1) return alert('Deve existir ao menos um projeto');
    if (confirm(`Remover "${nome}" e todas suas despesas?`)) removeProjeto(id);
  };

  const handleCardClick = (item: Despesa) => {
    setEditDespesa(item);
    setShowModal(true);
  };

  const handleSave = (d: { descricao: string; valor: number; categoria: string; diaVencimento?: number; notificacao: any; projetoId: string }) => {
    const data = d.diaVencimento
      ? `${ano}-${String(mes).padStart(2, '0')}-${String(d.diaVencimento).padStart(2, '0')}`
      : new Date().toISOString().split('T')[0];
    addDespesa({ ...d, data });
  };

  const handleUpdate = (id: string, changes: Partial<Omit<Despesa, 'id' | 'criadoEm'>>) => {
    updateDespesa(id, changes);
  };

  const handleDelete = (id: string) => {
    removeDespesa(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Projeto selector */}
      <div style={S.projetoBar}>
        <button onClick={() => setShowProjetoMenu(!showProjetoMenu)} style={S.projetoBtn}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{projetoNome}</span>
          <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 6 }}>▼</span>
        </button>
      </div>

      {/* Projeto dropdown */}
      {showProjetoMenu && (
        <div style={S.projetoMenu}>
          {projetos.map((p) => (
            <div key={p.id} style={{ ...S.projetoItem, ...(p.id === projetoAtivo ? S.projetoItemActive : {}) }}>
              <button onClick={() => { selectProjeto(p.id); setShowProjetoMenu(false); }}
                style={{ flex: 1, background: 'none', border: 'none', color: colors.text, textAlign: 'left', fontSize: 15, cursor: 'pointer', padding: '10px 0' }}>
                {p.nome}
              </button>
              <button onClick={() => handleRenameProjeto(p.id, p.nome)}
                style={S.projetoActionBtn} title="Renomear">✎</button>
              {projetos.length > 1 && (
                <button onClick={() => handleRemoveProjeto(p.id, p.nome)}
                  style={{ ...S.projetoActionBtn, color: colors.danger }} title="Remover">✕</button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input style={{ ...S.projetoInput, flex: 1 }} value={novoProjetoNome}
              onChange={(e) => setNovoProjetoNome(e.target.value)}
              placeholder="Novo projeto..." onKeyDown={(e) => e.key === 'Enter' && handleAddProjeto()} />
            <button onClick={handleAddProjeto} style={S.projetoAddBtn}>+</button>
          </div>
        </div>
      )}

      {/* Month nav */}
      <div style={S.mesNav}>
        <button onClick={() => navMes(-1)} style={S.navBtn}>◀</button>
        <span style={{ fontSize: 18, fontWeight: 700 }}>{MESES[mes - 1]} {ano}</span>
        <button onClick={() => navMes(1)} style={S.navBtn}>▶</button>
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
              <div key={item.id} style={{ ...S.card, ...(isPago ? S.cardPago : {}) }}>
                {/* Status button */}
                <button onClick={(e) => { e.stopPropagation(); togglePago(item.id); }} style={S.statusBtn}>
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

                {/* Click to edit */}
                <div style={{ flex: 1, marginRight: 12, cursor: 'pointer' }} onClick={() => handleCardClick(item)}>
                  <div style={{
                    fontSize: 16, fontWeight: 600,
                    textDecoration: isPago ? 'line-through' : 'none',
                    color: isPago ? colors.textMuted : colors.text,
                  }}>
                    {item.descricao}
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                    {item.categoria}
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
      <button onClick={() => { setEditDespesa(null); setShowModal(true); }} style={S.fab}>+</button>

      <AddDespesaModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditDespesa(null); }}
        onSave={handleSave}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        editDespesa={editDespesa}
        projetoId={projetoAtivo}
      />
    </div>
  );
}

const S = {
  projetoBar: {
    padding: '8px 16px',
    display: 'flex', alignItems: 'center',
  },
  projetoBtn: {
    background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10,
    padding: '8px 16px', cursor: 'pointer', color: colors.text,
    display: 'flex', alignItems: 'center',
  },
  projetoMenu: {
    background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12,
    margin: '0 16px 8px', padding: 12, zIndex: 50,
  },
  projetoItem: {
    display: 'flex', alignItems: 'center', borderRadius: 8, padding: '0 8px',
  },
  projetoItemActive: {
    background: colors.primaryDark + '30',
  },
  projetoActionBtn: {
    background: 'none', border: 'none', color: colors.textMuted, fontSize: 16, cursor: 'pointer', padding: '8px 6px',
  },
  projetoInput: {
    background: colors.inputBg, color: colors.text, border: `1px solid ${colors.border}`,
    borderRadius: 8, padding: 10, fontSize: 14, outline: 'none',
  },
  projetoAddBtn: {
    background: colors.primary, color: colors.white, border: 'none',
    borderRadius: 8, width: 40, fontSize: 20, cursor: 'pointer',
  },
  mesNav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px',
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
    border: `1px solid ${colors.border}`,
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
