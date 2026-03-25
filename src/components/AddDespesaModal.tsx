import { useState } from 'react';
import { colors } from '../colors';
import { CATEGORIAS, Categoria, ModoNotificacao, NOTIFICACAO_LABELS } from '../types';

const MODOS: ModoNotificacao[] = ['vespera', 'no_dia', 'ambos', 'nenhuma'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (d: { descricao: string; valor: number; data: string; categoria: string; diaVencimento?: number; notificacao: ModoNotificacao }) => void;
}

function todayStr() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

export default function AddDespesaModal({ open, onClose, onSave }: Props) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(todayStr());
  const [categoria, setCategoria] = useState<Categoria>('Outros');
  const [temVencimento, setTemVencimento] = useState(true);
  const [diaVencimento, setDiaVencimento] = useState('');
  const [notificacao, setNotificacao] = useState<ModoNotificacao>('vespera');
  const [erro, setErro] = useState('');

  if (!open) return null;

  const reset = () => {
    setDescricao(''); setValor(''); setData(todayStr());
    setCategoria('Outros'); setTemVencimento(true);
    setDiaVencimento(''); setNotificacao('vespera'); setErro('');
  };

  const handleSave = () => {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim()) return setErro('Informe a descricao');
    if (isNaN(valorNum) || valorNum <= 0) return setErro('Informe um valor valido');
    if (!data) return setErro('Informe a data');

    let diaVenc: number | undefined;
    if (temVencimento) {
      if (!diaVencimento.trim()) return setErro('Informe o dia de vencimento');
      diaVenc = parseInt(diaVencimento, 10);
      if (isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) return setErro('Dia invalido (1-31)');
    }

    onSave({
      descricao: descricao.trim(), valor: valorNum, data, categoria,
      diaVencimento: diaVenc,
      notificacao: temVencimento ? notificacao : 'nenhuma',
    });
    reset();
    onClose();
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>Nova Despesa</span>
          <button onClick={() => { reset(); onClose(); }} style={S.closeBtn}>✕</button>
        </div>

        <div style={S.form}>
          <label style={S.label}>Descricao</label>
          <input style={S.input} value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Almoço, Uber, Conta de luz..." />

          <label style={S.label}>Valor (R$)</label>
          <input style={S.input} value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="0,00" inputMode="decimal" />

          <label style={S.label}>Data</label>
          <input style={S.input} type="date" value={data} onChange={(e) => setData(e.target.value)} />

          {/* Vencimento */}
          <div style={S.vencSection}>
            <div style={S.vencHeader}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Dia de vencimento mensal</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Ativar para receber lembretes</div>
              </div>
              <label style={S.toggle}>
                <input type="checkbox" checked={temVencimento} onChange={(e) => setTemVencimento(e.target.checked)} style={{ display: 'none' }} />
                <div style={{ ...S.toggleTrack, background: temVencimento ? colors.primaryDark : colors.border }}>
                  <div style={{ ...S.toggleThumb, transform: temVencimento ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
              </label>
            </div>

            {temVencimento && (
              <>
                <input style={{ ...S.input, marginTop: 10 }} value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="Dia do mes (1-31)" inputMode="numeric" />

                <label style={{ ...S.label, marginTop: 12 }}>Tipo de lembrete</label>
                <div style={S.chips}>
                  {MODOS.map((m) => (
                    <button key={m} onClick={() => setNotificacao(m)}
                      style={{ ...S.chip, ...(notificacao === m ? S.chipActiveNotif : {}) }}>
                      {NOTIFICACAO_LABELS[m]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <label style={S.label}>Categoria</label>
          <div style={S.chips}>
            {CATEGORIAS.map((cat) => (
              <button key={cat} onClick={() => setCategoria(cat)}
                style={{ ...S.chip, ...(categoria === cat ? S.chipActive : {}) }}>
                {cat}
              </button>
            ))}
          </div>

          {erro && <div style={S.erro}>{erro}</div>}
        </div>

        <button style={S.saveBtn} onClick={handleSave}>Salvar</button>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, background: colors.overlay,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: colors.surface, borderRadius: '24px 24px 0 0', width: '100%',
    maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column' as const,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottom: `1px solid ${colors.border}`,
  },
  closeBtn: {
    background: 'none', border: 'none', color: colors.textSecondary, fontSize: 20, cursor: 'pointer',
  },
  form: {
    padding: 20, overflow: 'auto', flex: 1,
  },
  label: {
    display: 'block', color: colors.textSecondary, fontSize: 14, marginBottom: 6, marginTop: 12,
  },
  input: {
    width: '100%', background: colors.inputBg, color: colors.text, border: `1px solid ${colors.border}`,
    borderRadius: 12, padding: 14, fontSize: 16, outline: 'none',
  },
  vencSection: {
    background: colors.card, borderRadius: 14, padding: 14, marginTop: 16,
    border: `1px solid ${colors.primary}40`,
  },
  vencHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  toggle: { cursor: 'pointer' },
  toggleTrack: {
    width: 44, height: 24, borderRadius: 12, padding: 2, transition: 'background 0.2s',
  },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10, background: colors.white,
    transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
  chips: {
    display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 4,
  },
  chip: {
    padding: '8px 14px', borderRadius: 20, background: colors.inputBg,
    border: `1px solid ${colors.border}`, color: colors.textSecondary,
    fontSize: 13, cursor: 'pointer',
  },
  chipActive: {
    background: colors.primaryDark, borderColor: colors.primary, color: colors.white, fontWeight: 600,
  },
  chipActiveNotif: {
    background: '#1B5E20', borderColor: colors.success, color: colors.white, fontWeight: 600,
  },
  erro: {
    color: colors.danger, fontSize: 14, marginTop: 12, textAlign: 'center' as const,
  },
  saveBtn: {
    background: colors.primary, color: colors.white, border: 'none', padding: 16,
    margin: '0 20px 32px', borderRadius: 14, fontSize: 17, fontWeight: 700, cursor: 'pointer',
  },
};
