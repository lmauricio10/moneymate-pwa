import { useState, useEffect } from 'react';
import { colors } from '../colors';
import { CATEGORIAS, Categoria, Despesa, ModoNotificacao, NOTIFICACAO_LABELS } from '../types';

const MODOS: ModoNotificacao[] = ['vespera', 'no_dia', 'ambos', 'nenhuma'];

type DespesaInput = {
  descricao: string;
  valor: number;
  categoria: string;
  diaVencimento?: number;
  notificacao: ModoNotificacao;
  projetoId: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (d: DespesaInput) => void;
  onUpdate?: (id: string, d: Partial<DespesaInput>) => void;
  onDelete?: (id: string) => void;
  editDespesa?: Despesa | null;
  projetoId: string;
}

export default function AddDespesaModal({ open, onClose, onSave, onUpdate, onDelete, editDespesa, projetoId }: Props) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('Outros');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [notificacao, setNotificacao] = useState<ModoNotificacao>('vespera');
  const [erro, setErro] = useState('');

  const isEdit = !!editDespesa;

  useEffect(() => {
    if (editDespesa) {
      setDescricao(editDespesa.descricao);
      setValor(editDespesa.valor.toString().replace('.', ','));
      setCategoria(editDespesa.categoria as Categoria);
      setDiaVencimento(editDespesa.diaVencimento?.toString() || '');
      setNotificacao(editDespesa.notificacao);
      setErro('');
    }
  }, [editDespesa]);

  if (!open) return null;

  const reset = () => {
    setDescricao(''); setValor('');
    setCategoria('Outros');
    setDiaVencimento(''); setNotificacao('vespera'); setErro('');
  };

  const handleSave = () => {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim()) return setErro('Informe a descricao');
    if (isNaN(valorNum) || valorNum <= 0) return setErro('Informe um valor valido');
    if (!diaVencimento.trim()) return setErro('Informe o dia de vencimento');
    const diaVenc = parseInt(diaVencimento, 10);
    if (isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) return setErro('Dia invalido (1-31)');

    const data: DespesaInput = {
      descricao: descricao.trim(), valor: valorNum, categoria,
      diaVencimento: diaVenc, notificacao, projetoId,
    };

    if (isEdit && onUpdate) {
      onUpdate(editDespesa!.id, data);
    } else {
      onSave(data);
    }
    reset();
    onClose();
  };

  const handleDelete = () => {
    if (isEdit && onDelete && confirm(`Remover "${editDespesa!.descricao}"?`)) {
      onDelete(editDespesa!.id);
      reset();
      onClose();
    }
  };

  return (
    <div style={S.overlay} onClick={() => { reset(); onClose(); }}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{isEdit ? 'Editar Despesa' : 'Nova Despesa'}</span>
          <button onClick={() => { reset(); onClose(); }} style={S.closeBtn}>✕</button>
        </div>

        <div style={S.form}>
          <label style={S.label}>Descricao</label>
          <input style={S.input} value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Netflix, Aluguel, Conta de luz..." />

          <label style={S.label}>Valor (R$)</label>
          <input style={S.input} value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="0,00" inputMode="decimal" />

          <label style={S.label}>Dia de vencimento (1-31)</label>
          <input style={S.input} value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="Ex: 10" inputMode="numeric" />

          {/* Notificacao */}
          <div style={S.vencSection}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Tipo de lembrete</div>
            <div style={S.chips}>
              {MODOS.map((m) => (
                <button key={m} onClick={() => setNotificacao(m)}
                  style={{ ...S.chip, ...(notificacao === m ? S.chipActiveNotif : {}) }}>
                  {NOTIFICACAO_LABELS[m]}
                </button>
              ))}
            </div>
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

        <div style={{ padding: '0 20px 32px', display: 'flex', gap: 10 }}>
          {isEdit && (
            <button style={S.deleteBtn} onClick={handleDelete}>Remover</button>
          )}
          <button style={{ ...S.saveBtn, flex: 1 }} onClick={handleSave}>
            {isEdit ? 'Salvar alteracoes' : 'Salvar'}
          </button>
        </div>
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
    borderRadius: 14, fontSize: 17, fontWeight: 700, cursor: 'pointer',
  },
  deleteBtn: {
    background: 'transparent', color: colors.danger, border: `1px solid ${colors.danger}`,
    padding: 16, borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
};
