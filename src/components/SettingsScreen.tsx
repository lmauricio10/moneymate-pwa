import { useState, useRef } from 'react';
import { colors } from '../colors';
import { Despesa, NotificacaoConfig, Projeto } from '../types';
import { enviarNotificacaoTeste, enviarNotificacaoDespesa, notificacoesSuportadas } from '../notifications';
import { exportData, importData, getDeviceId, subscribeToPush } from '../store';

interface Props {
  config: NotificacaoConfig;
  despesas: Despesa[];
  projetos: Projeto[];
  updateConfig: (c: Partial<NotificacaoConfig>) => void;
  importDespesas: (d: Despesa[], c?: NotificacaoConfig, p?: Projeto[]) => void;
}

export default function SettingsScreen({ config, despesas, projetos, updateConfig, importDespesas }: Props) {
  const [limiteInput, setLimiteInput] = useState(config.limiteMensal.toString());
  const [horaInput, setHoraInput] = useState(
    `${String(config.horarioPadrao.hora).padStart(2, '0')}:${String(config.horarioPadrao.minuto).padStart(2, '0')}`,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [pushStatus, setPushStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [pushMsg, setPushMsg] = useState('');

  const handleSync = async () => {
    setSyncStatus('syncing');
    setSyncMsg('');
    try {
      const deviceId = getDeviceId();
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, despesas, projetos, config }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Erro no servidor');
      }
      setSyncStatus('ok');
      setSyncMsg(`Sincronizado: ${despesas.length} despesa(s), ${projetos.length} projeto(s)`);
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMsg(err.message || 'Falha na sincronizacao');
    }
  };

  const handlePushTest = async () => {
    setPushStatus('idle');
    setPushMsg('');
    const ok = await subscribeToPush();
    if (ok) {
      setPushStatus('ok');
      setPushMsg('Push subscription ativa');
    } else {
      setPushStatus('error');
      setPushMsg('Falha ao registrar push. Verifique permissoes do navegador.');
    }
  };

  const despesasComVencimento = despesas.filter((d) => d.diaVencimento && d.notificacao !== 'nenhuma');

  const handleTesteGeral = async () => {
    const ok = await enviarNotificacaoTeste();
    alert(ok ? 'Notificacao de teste enviada!' : 'Permissao de notificacao negada. Verifique as configuracoes do navegador.');
  };

  const handleTesteDespesa = async (d: Despesa) => {
    const ok = await enviarNotificacaoDespesa(d);
    alert(ok ? `Lembrete de "${d.descricao}" enviado!` : 'Permissao negada');
  };

  const salvarHorario = () => {
    const parts = horaInput.split(':');
    if (parts.length !== 2) return alert('Formato invalido. Use HH:MM');
    const hora = parseInt(parts[0], 10);
    const minuto = parseInt(parts[1], 10);
    if (isNaN(hora) || isNaN(minuto) || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) {
      return alert('Horario invalido');
    }
    updateConfig({ horarioPadrao: { hora, minuto } });
    alert(`Horario salvo: ${horaInput}`);
  };

  const salvarLimite = () => {
    const valor = parseFloat(limiteInput.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) return alert('Valor invalido');
    updateConfig({ limiteMensal: valor });
    alert(`Limite salvo: R$ ${valor.toFixed(2)}`);
  };

  const handleExport = () => exportData(despesas, config, projetos);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importData(file);
      if (confirm(`Importar ${data.despesas.length} despesa(s)? Isso substituira todos os dados atuais.`)) {
        importDespesas(data.despesas, data.config, data.projetos);
        alert(`${data.despesas.length} despesa(s) importada(s)!`);
      }
    } catch (err) {
      alert('Erro ao importar: arquivo invalido');
    }
    e.target.value = '';
  };

  return (
    <div style={{ padding: 16, paddingBottom: 40, overflow: 'auto', height: '100%' }}>
      {/* Sincronizacao */}
      <div style={S.section}>Sincronizacao com Servidor</div>
      <div style={S.rowBtns}>
        <button onClick={handleSync} disabled={syncStatus === 'syncing'}
          style={{ ...S.actionBtn, flex: 1, opacity: syncStatus === 'syncing' ? 0.6 : 1 }}>
          {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar agora'}
        </button>
        <button onClick={handlePushTest} style={{ ...S.importBtn, flex: 1 }}>
          Verificar Push
        </button>
      </div>
      {syncStatus !== 'idle' && (
        <div style={{
          marginTop: 8, padding: 10, borderRadius: 8, fontSize: 13,
          background: syncStatus === 'ok' ? colors.success + '20' : syncStatus === 'error' ? colors.danger + '20' : colors.card,
          color: syncStatus === 'ok' ? colors.success : syncStatus === 'error' ? colors.danger : colors.text,
          border: `1px solid ${syncStatus === 'ok' ? colors.success + '40' : syncStatus === 'error' ? colors.danger + '40' : colors.border}`,
        }}>
          {syncStatus === 'ok' ? '✓ ' : syncStatus === 'error' ? '✕ ' : ''}{syncMsg}
        </div>
      )}
      {pushStatus !== 'idle' && (
        <div style={{
          marginTop: 6, padding: 10, borderRadius: 8, fontSize: 13,
          background: pushStatus === 'ok' ? colors.success + '20' : colors.danger + '20',
          color: pushStatus === 'ok' ? colors.success : colors.danger,
          border: `1px solid ${pushStatus === 'ok' ? colors.success + '40' : colors.danger + '40'}`,
        }}>
          {pushStatus === 'ok' ? '✓ ' : '✕ '}{pushMsg}
        </div>
      )}
      <div style={S.hint}>Device ID: {getDeviceId().slice(0, 20)}...</div>

      <div style={S.separator} />

      {/* Backup */}
      <div style={S.section}>Backup dos Dados</div>
      <div style={S.rowBtns}>
        <button onClick={handleExport} style={{ ...S.actionBtn, flex: 1 }}>
          ↓ Exportar
        </button>
        <button onClick={() => fileRef.current?.click()} style={{ ...S.importBtn, flex: 1 }}>
          ↑ Importar
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
      </div>
      <div style={S.hint}>Exporte para salvar suas despesas em JSON. Importe para restaurar.</div>

      <div style={S.separator} />

      {/* Notificacoes */}
      <div style={S.section}>Testar Notificacoes</div>
      {!notificacoesSuportadas() && (
        <div style={{ ...S.hint, color: colors.warning, marginBottom: 12, fontStyle: 'normal' }}>
          Para receber notificacoes no iPhone: adicione o app na tela inicial (Safari → Compartilhar → Tela de Inicio)
        </div>
      )}
      <button onClick={handleTesteGeral} style={S.actionBtn}>
        🔔 Enviar notificacao de teste
      </button>

      {despesasComVencimento.length > 0 && (
        <>
          <div style={{ ...S.label, marginTop: 16 }}>Testar lembrete de despesa:</div>
          {despesasComVencimento.map((d) => (
            <button key={d.id} onClick={() => handleTesteDespesa(d)} style={S.testBtn}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ color: colors.text, fontSize: 15, fontWeight: 600 }}>{d.descricao}</div>
                <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  Venc. dia {d.diaVencimento} - R$ {d.valor.toFixed(2).replace('.', ',')}
                </div>
              </div>
              <span style={{ color: colors.primary }}>➤</span>
            </button>
          ))}
        </>
      )}

      <div style={S.separator} />

      {/* Horario */}
      <div style={S.section}>Configuracoes de Lembrete</div>

      <div style={S.label}>Dias antes do vencimento para lembrar</div>
      <div style={S.inlineRow}>
        <input style={{ ...S.input, flex: 1 }} type="number" value={config.diasAntes ?? 1}
          onChange={(e) => { const v = parseInt(e.target.value); if (v >= 0 && v <= 30) updateConfig({ diasAntes: v }); }}
          min="0" max="30" />
        <span style={{ color: colors.textMuted, fontSize: 13 }}>dia(s)</span>
      </div>

      <div style={S.label}>Horario do lembrete antecipado</div>
      <div style={S.inlineRow}>
        <input style={{ ...S.input, flex: 1 }} type="time" value={horaInput}
          onChange={(e) => setHoraInput(e.target.value)} />
        <button style={S.smallBtn} onClick={salvarHorario}>Salvar</button>
      </div>

      <div style={S.label}>Intervalo de alertas no dia do vencimento</div>
      <div style={S.inlineRow}>
        <input style={{ ...S.input, flex: 1 }} type="number" value={config.intervaloNoDia ?? 180}
          onChange={(e) => { const v = parseInt(e.target.value); if (v >= 5 && v <= 1440) updateConfig({ intervaloNoDia: v }); }}
          min="5" max="1440" />
        <span style={{ color: colors.textMuted, fontSize: 13 }}>min</span>
      </div>
      <div style={S.hint}>180 min = 3h | 60 min = 1h | 30 min = meia hora</div>

      <div style={S.label}>Intervalo de alertas apos vencimento</div>
      <div style={S.inlineRow}>
        <input style={{ ...S.input, flex: 1 }} type="number" value={config.intervaloAposVenc ?? 180}
          onChange={(e) => { const v = parseInt(e.target.value); if (v >= 5 && v <= 1440) updateConfig({ intervaloAposVenc: v }); }}
          min="5" max="1440" />
        <span style={{ color: colors.textMuted, fontSize: 13 }}>min</span>
      </div>
      <div style={S.hint}>Alertas continuam ate marcar como pago</div>

      <div style={S.separator} />

      {/* Limite */}
      <div style={S.section}>Alerta de Limite</div>
      <div style={S.row}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Alerta de limite mensal</div>
          <div style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>Avisa quando despesas passam do limite</div>
        </div>
        <label style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={config.alertaLimite}
            onChange={(e) => updateConfig({ alertaLimite: e.target.checked })} style={{ display: 'none' }} />
          <div style={{ width: 44, height: 24, borderRadius: 12, padding: 2, transition: 'background 0.2s',
            background: config.alertaLimite ? colors.primaryDark : colors.border }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: colors.white,
              transition: 'transform 0.2s', transform: config.alertaLimite ? 'translateX(20px)' : 'translateX(0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
        </label>
      </div>

      {config.alertaLimite && (
        <div style={{ marginTop: 8 }}>
          <div style={S.label}>Limite mensal (R$)</div>
          <div style={S.inlineRow}>
            <input style={{ ...S.input, flex: 1 }} value={limiteInput}
              onChange={(e) => setLimiteInput(e.target.value)} inputMode="decimal" placeholder="3000" />
            <button style={S.smallBtn} onClick={salvarLimite}>Salvar</button>
          </div>
        </div>
      )}

      <div style={S.separator} />

      <div style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 32, lineHeight: '20px' }}>
        MoneyMate PWA v1.0<br />Dados armazenados localmente no navegador
      </div>
    </div>
  );
}

const S = {
  section: {
    color: colors.primary, fontSize: 14, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 16,
  },
  label: {
    color: colors.textSecondary, fontSize: 13, marginBottom: 6,
  },
  hint: {
    color: colors.textMuted, fontSize: 12, marginTop: 6, fontStyle: 'italic' as const,
  },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0',
  },
  rowBtns: {
    display: 'flex', gap: 10,
  },
  inlineRow: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  input: {
    background: colors.inputBg, color: colors.text, border: `1px solid ${colors.border}`,
    borderRadius: 10, padding: 12, fontSize: 16, outline: 'none',
  },
  smallBtn: {
    background: colors.primary, color: colors.white, border: 'none',
    padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  actionBtn: {
    background: colors.primaryDark, color: colors.white, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  importBtn: {
    background: 'transparent', color: colors.primary, border: `1px solid ${colors.primary}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  testBtn: {
    background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: 10,
    padding: 14, marginTop: 8, display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%',
  },
  separator: {
    height: 1, background: colors.border, margin: '16px 0',
  },
};
