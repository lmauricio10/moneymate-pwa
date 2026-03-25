import { useState, useEffect, useCallback } from 'react';
import { colors } from './colors';
import { Despesa, NotificacaoConfig, ModoNotificacao } from './types';
import { loadDespesas, saveDespesas, loadConfig, saveConfig, DEFAULT_CONFIG } from './store';
import { notificarVencimentos } from './notifications';
import DespesasScreen from './components/DespesasScreen';
import SettingsScreen from './components/SettingsScreen';

type Tab = 'despesas' | 'config';

export default function App() {
  const [tab, setTab] = useState<Tab>('despesas');
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [config, setConfig] = useState<NotificacaoConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const d = loadDespesas();
    const c = loadConfig();
    setDespesas(d);
    setConfig(c);
    setLoading(false);
    // Notify on app open
    notificarVencimentos(d);
  }, []);

  const addDespesa = useCallback((d: Omit<Despesa, 'id' | 'criadoEm' | 'status'>) => {
    const nova: Despesa = {
      ...d,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
    };
    setDespesas((prev) => {
      const next = [nova, ...prev];
      saveDespesas(next);
      return next;
    });
  }, []);

  const removeDespesa = useCallback((id: string) => {
    setDespesas((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveDespesas(next);
      return next;
    });
  }, []);

  const togglePago = useCallback((id: string) => {
    const mesAtual = (() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    })();
    setDespesas((prev) => {
      const next = prev.map((d) => {
        if (d.id !== id) return d;
        const novoStatus = d.status === 'pago' ? 'pendente' : 'pago';
        return { ...d, status: novoStatus as 'pago' | 'pendente', mesPago: novoStatus === 'pago' ? mesAtual : undefined };
      });
      saveDespesas(next);
      return next;
    });
  }, []);

  const updateConfig = useCallback((partial: Partial<NotificacaoConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveConfig(next);
      return next;
    });
  }, []);

  const importDespesas = useCallback((novas: Despesa[], novaConfig?: NotificacaoConfig) => {
    const migradas = novas.map((d) => ({ ...d, status: d.status || ('pendente' as const) }));
    setDespesas(migradas);
    saveDespesas(migradas);
    if (novaConfig) {
      const c = { ...DEFAULT_CONFIG, ...novaConfig };
      setConfig(c);
      saveConfig(c);
    }
  }, []);

  const getDespesasMes = useCallback((ano: number, mes: number) => {
    const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
    return despesas.filter((d) => d.data.startsWith(prefix));
  }, [despesas]);

  const getTotalMes = useCallback((ano: number, mes: number) => {
    return getDespesasMes(ano, mes).reduce((s, d) => s + d.valor, 0);
  }, [getDespesasMes]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}>
        Carregando...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.background }}>
      {/* Header */}
      <div style={{
        background: colors.surface,
        padding: '14px 20px',
        borderBottom: `1px solid ${colors.border}`,
        textAlign: 'center',
        fontWeight: 700,
        fontSize: 17,
      }}>
        {tab === 'despesas' ? 'Despesas' : 'Configuracoes'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'despesas' ? (
          <DespesasScreen
            despesas={despesas}
            config={config}
            addDespesa={addDespesa}
            removeDespesa={removeDespesa}
            togglePago={togglePago}
            getDespesasMes={getDespesasMes}
            getTotalMes={getTotalMes}
          />
        ) : (
          <SettingsScreen
            config={config}
            despesas={despesas}
            updateConfig={updateConfig}
            importDespesas={importDespesas}
          />
        )}
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        background: colors.tabBar,
        borderTop: `1px solid ${colors.border}`,
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}>
        <button onClick={() => setTab('despesas')} style={{
          flex: 1,
          padding: '10px 0 8px',
          background: 'none',
          border: 'none',
          color: tab === 'despesas' ? colors.primary : colors.textMuted,
          fontSize: 11,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/>
          </svg>
          Despesas
        </button>
        <button onClick={() => setTab('config')} style={{
          flex: 1,
          padding: '10px 0 8px',
          background: 'none',
          border: 'none',
          color: tab === 'config' ? colors.primary : colors.textMuted,
          fontSize: 11,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Config
        </button>
      </div>
    </div>
  );
}
