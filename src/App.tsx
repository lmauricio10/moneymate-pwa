import { useState, useEffect, useCallback } from 'react';
import { colors } from './colors';
import { Despesa, NotificacaoConfig, Projeto } from './types';
import {
  loadDespesas, saveDespesas, loadConfig, saveConfig,
  loadProjetos, saveProjetos, loadProjetoAtivo, saveProjetoAtivo,
  DEFAULT_CONFIG,
} from './store';
import { notificarVencimentos } from './notifications';
import DespesasScreen from './components/DespesasScreen';
import SettingsScreen from './components/SettingsScreen';

type Tab = 'despesas' | 'config';

export default function App() {
  const [tab, setTab] = useState<Tab>('despesas');
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [config, setConfig] = useState<NotificacaoConfig>(DEFAULT_CONFIG);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoAtivo, setProjetoAtivo] = useState('pessoal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const d = loadDespesas();
    const c = loadConfig();
    const p = loadProjetos();
    const pa = loadProjetoAtivo();
    setDespesas(d);
    setConfig(c);
    setProjetos(p);
    setProjetoAtivo(pa);
    setLoading(false);
    notificarVencimentos(d);
  }, []);

  const addDespesa = useCallback((d: Omit<Despesa, 'id' | 'criadoEm' | 'status'>) => {
    const nova: Despesa = {
      ...d,
      data: d.data || new Date().toISOString().split('T')[0],
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

  const updateDespesa = useCallback((id: string, changes: Partial<Omit<Despesa, 'id' | 'criadoEm'>>) => {
    setDespesas((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, ...changes } : d);
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

  const addProjeto = useCallback((nome: string) => {
    const novo: Projeto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      nome,
      criadoEm: new Date().toISOString(),
    };
    setProjetos((prev) => {
      const next = [...prev, novo];
      saveProjetos(next);
      return next;
    });
    setProjetoAtivo(novo.id);
    saveProjetoAtivo(novo.id);
    return novo;
  }, []);

  const renameProjeto = useCallback((id: string, nome: string) => {
    setProjetos((prev) => {
      const next = prev.map((p) => p.id === id ? { ...p, nome } : p);
      saveProjetos(next);
      return next;
    });
  }, []);

  const removeProjeto = useCallback((id: string) => {
    setProjetos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveProjetos(next);
      if (projetoAtivo === id && next.length > 0) {
        setProjetoAtivo(next[0].id);
        saveProjetoAtivo(next[0].id);
      }
      return next;
    });
    // Remove despesas do projeto
    setDespesas((prev) => {
      const next = prev.filter((d) => d.projetoId !== id);
      saveDespesas(next);
      return next;
    });
  }, [projetoAtivo]);

  const selectProjeto = useCallback((id: string) => {
    setProjetoAtivo(id);
    saveProjetoAtivo(id);
  }, []);

  const handleCloudShare = useCallback(async () => {
    const data = JSON.stringify({ despesas, config, projetos, exportadoEm: new Date().toISOString() }, null, 2);
    const file = new File([data], `moneymate_${new Date().toISOString().split('T')[0]}.json`, { type: 'application/json' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'MoneyMate Backup' });
      } catch (e: any) {
        if (e.name !== 'AbortError') alert('Erro ao compartilhar');
      }
    } else {
      // Fallback: download
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [despesas, config, projetos]);

  const importDespesas = useCallback((novas: Despesa[], novaConfig?: NotificacaoConfig, novosProjetos?: Projeto[]) => {
    const migradas = novas.map((d) => ({ ...d, status: d.status || ('pendente' as const), projetoId: d.projetoId || 'pessoal' }));
    setDespesas(migradas);
    saveDespesas(migradas);
    if (novaConfig) {
      const c = { ...DEFAULT_CONFIG, ...novaConfig };
      setConfig(c);
      saveConfig(c);
    }
    if (novosProjetos && novosProjetos.length > 0) {
      setProjetos(novosProjetos);
      saveProjetos(novosProjetos);
    }
  }, []);

  const getDespesasMes = useCallback((ano: number, mes: number) => {
    const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
    return despesas.filter((d) => d.projetoId === projetoAtivo && d.data.startsWith(prefix));
  }, [despesas, projetoAtivo]);

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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ width: 36 }} />
        <span style={{ fontWeight: 700, fontSize: 17 }}>
          {tab === 'despesas' ? 'MoneyMate' : 'Configuracoes'}
        </span>
        <button onClick={handleCloudShare} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: colors.primary, fontSize: 20,
        }} title="Salvar na nuvem">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            <polyline points="8 16 12 12 16 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'despesas' ? (
          <DespesasScreen
            despesas={despesas}
            config={config}
            projetos={projetos}
            projetoAtivo={projetoAtivo}
            addDespesa={addDespesa}
            updateDespesa={updateDespesa}
            removeDespesa={removeDespesa}
            togglePago={togglePago}
            getDespesasMes={getDespesasMes}
            getTotalMes={getTotalMes}
            addProjeto={addProjeto}
            renameProjeto={renameProjeto}
            removeProjeto={removeProjeto}
            selectProjeto={selectProjeto}
          />
        ) : (
          <SettingsScreen
            config={config}
            despesas={despesas}
            projetos={projetos}
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
          flex: 1, padding: '10px 0 8px', background: 'none', border: 'none',
          color: tab === 'despesas' ? colors.primary : colors.textMuted,
          fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/>
          </svg>
          Despesas
        </button>
        <button onClick={() => setTab('config')} style={{
          flex: 1, padding: '10px 0 8px', background: 'none', border: 'none',
          color: tab === 'config' ? colors.primary : colors.textMuted,
          fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
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
