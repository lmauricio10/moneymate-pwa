import { useState, useEffect } from 'react';
import { colors } from '../colors';
import { CATEGORIAS, Categoria, Despesa, ModoNotificacao, NOTIFICACAO_LABELS, Recorrencia, MESES_NOMES } from '../types';

const MODOS: ModoNotificacao[] = ['vespera', 'no_dia', 'ambos', 'nenhuma'];

type DespesaInput = {
  descricao: string;
  valor: number;
  categoria: string;
  recorrencia: Recorrencia;
  diaVencimento?: number;
  mesVencimento?: number;
  notificacao: ModoNotificacao;
  intervaloHoras: number;
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
  const [recorrencia, setRecorrencia] = useState<Recorrencia>('mensal');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [mesVencimento, setMesVencimento] = useState(1);
  const [notificacao, setNotificacao] = useState<ModoNotificacao>('ambos');
  const [intervaloHoras, setIntervaloHoras] = useState('3');
  const [erro, setErro] = useState('');

  const isEdit = !!editDespesa;

  useEffect(() => {
    if (editDespesa) {
      setDescricao(editDespesa.descricao);
      setValor(editDespesa.valor.toString().replace('.', ','));
      setCategoria(editDespesa.categoria as Categoria);
      setRecorrencia(editDespesa.recorrencia || 'mensal');
      setDiaVencimento(editDespesa.diaVencimento?.toString() || '');
      setMesVencimento(editDespesa.mesVencimento || 1);
      setNotificacao(editDespesa.notificacao);
      setIntervaloHoras((editDespesa.intervaloHoras ?? 3).toString());
      setErro('');
    }
  }, [editDespesa]);

  if (!open) return null;

  const reset = () => {
    setDescricao(''); setValor('');
    setCategoria('Outros'); setRecorrencia('mensal');
    setDiaVencimento(''); setMesVencimento(1);
    setNotificacao('ambos'); setIntervaloHoras('3'); setErro('');
  };

  const handleSave = () => {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!descricao.trim()) return setErro('Informe a descricao');
    if (isNaN(valorNum) || valorNum <= 0) return setErro('Informe um valor valido');
    if (!diaVencimento.trim()) return setErro('Informe o dia de vencimento');
    const diaVenc = parseInt(diaVencimento, 10);
    if (isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) return setErro('Dia invalido (1-31)');

    const horas = parseFloat(intervaloHoras.replace(',', '.'));
    const intervalo = isNaN(horas) || horas < 1 ? 3 : horas;

    const data: DespesaInput = {
      descricao: descricao.trim(), valor: valorNum, categoria,
      recorrencia,
      diaVencimento: diaVenc,
      mesVencimento: recorrencia === 'anual' ? mesVencimento : undefined,
      notificacao, intervaloHoras: intervalo, projetoId,
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
            placeholder="Ex: Netflix, IPTU, Seguro..." />

          <label style={S.label}>Valor (R$)</label>
          <input style={S.input} value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="0,00" inputMode="decimal" />

          {/* Recorrencia */}
          <label style={S.label}>Recorrencia</label>
          <div style={S.chips}>
            <button onClick={() => setRecorrencia('mensal')}
              style={{ ...S.chip, ...(recorrencia === 'mensal' ? S.chipActive : {}) }}>
              Mensal
            </button>
            <button onClick={() => setRecorrencia('anual')}
              style={{ ...S.chip, ...(recorrencia === 'anual' ? S.chipActive : {}) }}>
              Anual
            </button>
          </div>

          <label style={S.label}>Dia de vencimento (1-31)</label>
          <input style={S.input} value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))}
            placeholder="Ex: 10" inputMode="numeric" />

          {/* Mes de vencimento - only for annual */}
          {recorrencia === 'anual' && (
            <>
              <label style={S.label}>Mes de vencimento</label>
              <div style={S.chips}>
                {MESES_NOMES.map((nome, i) => (
                  <button key={i} onClick={() => setMesVencimento(i + 1)}
                    style={{ ...S.chip, minWidth: 44, ...(mesVencimento === i + 1 ? S.chipActive : {}) }}>
                    {nome}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Notificacao */}
          <div style={S.vencSection}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Lembrete</div>
            <div style={S.chips}>
              {MODOS.map((m) => (
                <button key={m} onClick={() => setNotificacao(m)}
                  style={{ ...S.chip, ...(notificacao === m ? S.chipActiveNotif : {}) }}>
                  {NOTIFICACAO_LABELS[m]}
                </button>
              ))}
            </div>

            {notificacao !== 'nenhuma' && notificacao !== 'vespera' && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
                  Intervalo entre alertas (horas)
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input style={{ ...S.input, width: 80, textAlign: 'center' as const }}
                    value={intervaloHoras}
                    onChange={(e) => setIntervaloHoras(e.target.value.replace(/[^\d.,]/g, ''))}
                    inputMode="decimal" placeholder="3" />
                  <span style={{ color: colors.textMuted, fontSize: 13 }}>hora(s) no dia e apos vencimento</span>
                </div>
              </div>
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

        <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          <button style={S.saveBtn} onClick={handleSave}>
            {isEdit ? 'Salvar alteracoes' : 'Salvar'}
          </button>
          {isEdit && (
            <button style={S.deleteBtn} onClick={handleDelete}>Remover despesa</button>
          )}
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
    background: colors.primary, color: colors.white, border: 'none',
    padding: 18, borderRadius: 14, fontSize: 17, fontWeight: 700, cursor: 'pointer',
    width: '100%', minHeight: 54,
  },
  deleteBtn: {
    background: 'transparent', color: colors.danger, border: `1px solid ${colors.danger}`,
    padding: 18, borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: 'pointer',
    width: '100%', minHeight: 54,
  },
};
