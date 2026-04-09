import { useState, useEffect } from 'react';
import { colors } from '../colors';
import { CATEGORIAS, Categoria, Despesa, ModoNotificacao, Recorrencia, MESES_NOMES } from '../types';

type DespesaInput = {
  titulo: string;
  descricao?: string;
  valor: number;
  categoria: string;
  recorrencia: Recorrencia;
  diaVencimento?: number;
  mesVencimento?: number;
  notificacao: ModoNotificacao;
  intervaloMinutos: number;
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
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('Outros');
  const [recorrencia, setRecorrencia] = useState<Recorrencia>('mensal');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [mesVencimento, setMesVencimento] = useState(1);
  const [lembreteVespera, setLembreteVespera] = useState(true);
  const [lembreteNoDia, setLembreteNoDia] = useState(true);
  const [intervaloMin, setIntervaloMin] = useState('180');
  const [erro, setErro] = useState('');

  const isEdit = !!editDespesa;

  // Derive ModoNotificacao from the 2 toggles
  const getNotificacao = (): ModoNotificacao => {
    if (lembreteVespera && lembreteNoDia) return 'ambos';
    if (lembreteVespera) return 'vespera';
    if (lembreteNoDia) return 'no_dia';
    return 'nenhuma';
  };

  useEffect(() => {
    if (editDespesa) {
      setTitulo(editDespesa.titulo || '');
      setDescricao(editDespesa.descricao || '');
      setValor(editDespesa.valor.toString().replace('.', ','));
      setCategoria(editDespesa.categoria as Categoria);
      setRecorrencia(editDespesa.recorrencia || 'mensal');
      setDiaVencimento(editDespesa.diaVencimento?.toString() || '');
      setMesVencimento(editDespesa.mesVencimento || 1);
      setLembreteVespera(editDespesa.notificacao === 'vespera' || editDespesa.notificacao === 'ambos');
      setLembreteNoDia(editDespesa.notificacao === 'no_dia' || editDespesa.notificacao === 'ambos');
      setIntervaloMin((editDespesa.intervaloMinutos ?? 180).toString());
      setErro('');
    }
  }, [editDespesa]);

  if (!open) return null;

  const reset = () => {
    setTitulo(''); setDescricao(''); setValor('');
    setCategoria('Outros'); setRecorrencia('mensal');
    setDiaVencimento(''); setMesVencimento(1);
    setLembreteVespera(true); setLembreteNoDia(true);
    setIntervaloMin('180'); setErro('');
  };

  const handleSave = () => {
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (!titulo.trim()) return setErro('Informe o titulo');
    if (isNaN(valorNum) || valorNum <= 0) return setErro('Informe um valor valido');
    if (!diaVencimento.trim()) return setErro('Informe o dia de vencimento');
    const diaVenc = parseInt(diaVencimento, 10);
    if (isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) return setErro('Dia invalido (1-31)');

    const mins = parseInt(intervaloMin, 10);
    const intervalo = isNaN(mins) || mins < 1 ? 180 : mins;

    const data: DespesaInput = {
      titulo: titulo.trim(), descricao: descricao.trim() || undefined,
      valor: valorNum, categoria,
      recorrencia,
      diaVencimento: diaVenc,
      mesVencimento: recorrencia === 'anual' ? mesVencimento : undefined,
      notificacao: getNotificacao(), intervaloMinutos: intervalo, projetoId,
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
    if (isEdit && onDelete && confirm(`Remover "${editDespesa!.titulo}"?`)) {
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
          <label style={S.label}>Titulo</label>
          <input style={S.input} value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Netflix, IPTU, Seguro..." />

          <label style={S.label}>Descricao detalhada (opcional)</label>
          <textarea style={{ ...S.input, minHeight: 100, fontFamily: 'inherit', resize: 'vertical' as const }}
            value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Notas, observacoes ou links (https://...)" />

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

          {/* Schedule 1: Vespera */}
          <div style={S.vencSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Lembrete 1 dia util antes</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Sexta se vence segunda, ultimo dia util antes</div>
              </div>
              <button onClick={() => setLembreteVespera(!lembreteVespera)}
                style={{ ...S.toggle, background: lembreteVespera ? colors.success : colors.border }}>
                <div style={{ ...S.toggleThumb, transform: lembreteVespera ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>
          </div>

          {/* Schedule 2: No dia + posteriores */}
          <div style={{ ...S.vencSection, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Lembrete no dia e posteriores</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>Repete ate marcar como pago</div>
              </div>
              <button onClick={() => setLembreteNoDia(!lembreteNoDia)}
                style={{ ...S.toggle, background: lembreteNoDia ? colors.success : colors.border }}>
                <div style={{ ...S.toggleThumb, transform: lembreteNoDia ? 'translateX(20px)' : 'translateX(0)' }} />
              </button>
            </div>

            {lembreteNoDia && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: colors.textSecondary, fontSize: 13 }}>A cada</span>
                <input style={{ ...S.input, width: 70, textAlign: 'center' as const, padding: 10 }}
                  value={intervaloMin}
                  onChange={(e) => setIntervaloMin(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric" placeholder="180" />
                <span style={{ color: colors.textSecondary, fontSize: 13 }}>min</span>
              </div>
            )}
            {lembreteNoDia && (
              <div style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                180 = 3h | 60 = 1h | 10 = teste | Janela: 9h-22h
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
  toggle: {
    width: 44, height: 24, borderRadius: 12, padding: 2, border: 'none',
    cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
  },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10, background: colors.white,
    transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
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
