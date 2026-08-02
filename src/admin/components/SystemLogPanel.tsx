import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit, getDocs, writeBatch, Timestamp, collectionGroup } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useModal } from './ConfirmModal';
import { wipeAllUserData, type WipeProgress } from '../wipeUsers';
import { userService } from '../../services/UserService';
import { masterAccountLabelByUid, characterLabelByKey } from '../lib/entityLabels';
import type { MasterAccount } from '../../types/player';

interface LogEntry {
  id: string;
  uid: string;
  characterId?: string;
  username: string;
  type: 'navigation' | 'action' | 'system' | 'error' | 'admin' | 'auth' | 'trace';
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: any;
  source: 'player' | 'admin';
}

const TYPE_COLORS: Record<string, string> = {
  navigation: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10',
  action:     'text-sky-400 bg-sky-500/5 border-sky-500/10',
  system:     'text-orange-400 bg-orange-500/5 border-orange-500/10',
  error:      'text-red-400 bg-red-500/5 border-red-500/10',
  admin:      'text-primary bg-primary/5 border-primary/10',
  auth:       'text-yellow-400 bg-yellow-500/5 border-yellow-500/10',
  trace:      'text-industrial-silver/40 bg-white/5 border-white/5',
};

const TYPE_ICONS: Record<string, string> = {
  navigation: 'swap_horiz',
  action:     'touch_app',
  system:     'settings',
  error:      'report',
  admin:      'shield_person',
  auth:       'key',
  trace:      'terminal',
};

const SEVERITY: Record<string, { label: string; color: string }> = {
  error:  { label: 'CRITICAL', color: 'text-red-500' },
  system: { label: 'INFO',     color: 'text-industrial-silver/40' },
  admin:  { label: 'PRIVILEGED', color: 'text-primary' },
  action: { label: 'EVENT',    color: 'text-sky-500' },
  navigation: { label: 'NAV',  color: 'text-emerald-500' },
  auth:   { label: 'ACCESS',   color: 'text-yellow-500' },
  trace:  { label: 'TRACE',    color: 'text-industrial-silver/20' },
};

const LogRow = React.memo(({
  entry,
  isExpanded,
  onToggle,
  users,
  characterMap,
}: {
  entry: LogEntry;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  users: MasterAccount[];
  characterMap: Map<string, string>;
}) => {
  const severity = SEVERITY[entry.type] || SEVERITY.action;
  const typeColor = TYPE_COLORS[entry.type] || TYPE_COLORS.action;
  const typeIcon = TYPE_ICONS[entry.type] || TYPE_ICONS.action;
  
  const formatTimestamp = (ts: any) => {
    if (!ts?.toDate) return '—';
    const d = ts.toDate();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => onToggle(entry.id)}
        className={`w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-white/5 transition-colors ${
          entry.type === 'error' ? 'bg-red-500/5' : ''
        }`}
      >
        <span className={`material-symbols-outlined text-base text-industrial-silver/20 transition-transform ${isExpanded ? 'rotate-90 text-primary' : ''}`}>
          chevron_right
        </span>
        
        <span className={`text-[8px] font-display font-bold tracking-widest w-16 ${severity.color}`}>
          {severity.label}
        </span>

        <span className="text-[10px] font-mono text-industrial-silver/30 shrink-0 w-32 tabular-nums">
          {formatTimestamp(entry.timestamp)}
        </span>

        <span className={`text-[8px] font-display font-bold px-2 py-0.5 border rounded-sm shrink-0 flex items-center gap-1.5 ${typeColor}`}>
          <span className="material-symbols-outlined text-[10px]">{typeIcon}</span>
          {entry.type.toUpperCase()}
        </span>

        <span className="text-[11px] font-display font-bold text-white shrink-0 truncate max-w-[120px] tracking-wide">
          {entry.username?.trim() || masterAccountLabelByUid(entry.uid, users, 'SISTEMA')}
        </span>

        <span className={`text-[11px] font-sans flex-1 truncate ${
          entry.type === 'admin' ? 'text-primary/80 font-bold' : 
          entry.type === 'trace' ? 'text-industrial-silver/20' : 
          entry.type === 'error' ? 'text-red-400' :
          'text-industrial-silver/60'
        }`}>
          {entry.message}
        </span>

        <span className="text-[8px] font-display font-bold text-industrial-silver/20 tracking-widest shrink-0 uppercase border border-white/5 px-2 py-0.5 rounded-sm">
          {entry.category}
        </span>
      </button>

      {isExpanded && (
        <div className="px-16 py-6 bg-black/40 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-[11px] font-mono mb-6">
            <div className="space-y-1">
              <p className="text-[8px] font-display font-bold text-industrial-silver/20 uppercase tracking-widest">Identificador de Sessão</p>
              <p className="text-industrial-silver/60 break-all">
                {masterAccountLabelByUid(entry.uid, users, entry.uid || 'SISTEMA')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-display font-bold text-industrial-silver/20 uppercase tracking-widest">Vetor do Agente</p>
              <p className="text-primary/60">
                {entry.characterId
                  ? characterLabelByKey(entry.uid, entry.characterId, characterMap, 'NÃO_IDENTIFICADO')
                  : 'NÃO_IDENTIFICADO'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-display font-bold text-industrial-silver/20 uppercase tracking-widest">Procedência / Fonte</p>
              <p className="text-industrial-silver/60 uppercase">{entry.source} // {entry.category}</p>
            </div>
          </div>
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div className="space-y-2">
              <p className="text-[8px] font-display font-bold text-industrial-silver/20 uppercase tracking-widest">Dados Adicionais de Telemetria:</p>
              <pre className="text-[10px] font-mono text-primary/40 bg-surface-container-lowest border border-white/5 p-4 rounded-sm overflow-x-auto max-h-60 shadow-inner">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function SystemLogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<MasterAccount[]>([]);
  const [characterMap, setCharacterMap] = useState<Map<string, string>>(new Map());
  const [maxEntries, setMaxEntries] = useState(200);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [wipeProgress, setWipeProgress] = useState<WipeProgress | null>(null);
  const { showConfirm, showAlert, modal } = useModal();

  useEffect(() => {
    const unsubUsers = userService.subscribeToUsers(setUsers);
    const unsubCharacters = onSnapshot(collectionGroup(db, 'characters'), (snap) => {
      const map = new Map<string, string>();
      snap.docs.forEach((docSnap) => {
        const uid = docSnap.ref.parent.parent?.id;
        if (!uid) return;
        const data = docSnap.data() as { codinome?: string };
        map.set(`${uid}_${docSnap.id}`, data.codinome?.trim() || 'Agente sem codinome');
      });
      setCharacterMap(map);
    }, (err) => console.warn('[SystemLogPanel] characters listener error:', err));

    return () => {
      unsubUsers();
      unsubCharacters();
    };
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'activityLog'),
      orderBy('timestamp', 'desc'),
      limit(maxEntries)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: LogEntry[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...(d.data() as Omit<LogEntry, 'id'>) });
      });
      setEntries(list);
    });
    return () => unsub();
  }, [maxEntries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterSource !== 'all' && e.source !== filterSource) return false;
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      if (filterUser && e.username !== filterUser) return false;
      if (searchText && !(e.message || '').toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterSource, filterType, filterCategory, filterUser, searchText]);

  const errorCount = entries.filter(e => e.type === 'error').length;

  const handleToggle = React.useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const handleClearLogs = async () => {
    const ok = await showConfirm('Limpar Logs', 'Isso removerá PERMANENTEMENTE todos os registros do banco de dados. Confirmar?', 'Limpar Tudo');
    if (!ok) return;

    setIsClearing(true);
    try {
      const snap = await getDocs(collection(db, 'activityLog'));
      let batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
        count++;
        if (count % 400 === 0) {
          batch.commit();
          batch = writeBatch(db);
        }
      });
      await batch.commit();
      await showAlert('Sincronização', `✓ ${count} registros eliminados do servidor.`);
    } catch (err) {
      console.error('Failed to clear logs:', err);
      await showAlert('Erro de Conexão', 'Falha ao processar requisição de limpeza.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleWipeUsers = async () => {
    const ok = await showConfirm(
      '⚠️ WIPE COMPLETO DE USUÁRIOS', 
      'ATENÇÃO: Esta operação é IRREVERSÍVEL. Todos os dados de jogadores, personagens, intel, achievements, playEvents, logs e grupos serão PERMANENTEMENTE DESTRUÍDOS. Confirmar?', 
      'CONFIRMAR WIPE TOTAL'
    );
    if (!ok) return;

    // Double confirmation
    const ok2 = await showConfirm(
      'CONFIRMAÇÃO FINAL',
      'Tem CERTEZA ABSOLUTA? Não há como reverter esta operação. Todos os dados de todos os jogadores serão perdidos.',
      'SIM, DESTRUIR TUDO'
    );
    if (!ok2) return;

    setIsWiping(true);
    setWipeProgress(null);
    try {
      const result = await wipeAllUserData((progress) => {
        setWipeProgress(progress);
      });
      if (result.success) {
        await showAlert('Wipe Concluído', `${result.usersDeleted} usuários foram removidos permanentemente. A página será recarregada.`);
        window.location.reload();
      } else {
        await showAlert('Erro', `Wipe parcial: ${result.usersDeleted} removidos. Erros: ${result.errors.join('; ')}`);
      }
    } catch (err) {
      console.error(err);
      await showAlert('Erro Crítico', 'Falha na comunicação com o servidor.');
    } finally {
      setIsWiping(false);
      setWipeProgress(null);
    }
  };

  const handleExportJSON = () => {
    const data = filtered.map(e => ({
      timestamp: e.timestamp?.toDate?.()?.toISOString?.() || null,
      type: e.type,
      source: e.source,
      category: e.category,
      uid: e.uid,
      username: e.username,
      message: e.message,
      metadata: e.metadata || null,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sys_log_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-surface-container-low border border-primary/10 flex flex-col font-sans overflow-hidden shadow-2xl" style={{ minHeight: '500px', maxHeight: '65vh' }}>
      {modal}
      
      <div className="flex items-center justify-between px-8 py-5 bg-black/40 border-b border-primary/10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse glow-orange" />
            <h2 className="font-display font-bold uppercase tracking-[0.3em] text-xs text-primary">
              Fluxo de Telemetria em Tempo Real
            </h2>
          </div>
          <span className="text-[10px] font-display font-bold text-industrial-silver/20 tracking-[0.2em] uppercase">
            {filtered.length} de {entries.length} Sinais Captados
          </span>
          {errorCount > 0 && (
            <div className="text-[9px] font-display font-bold text-red-500 bg-red-500/5 border border-red-500/20 px-3 py-1 rounded-sm flex items-center gap-2 animate-pulse">
              <span className="material-symbols-outlined text-[14px]">report</span>
              {errorCount} ANOMALIAS DETECTADAS
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportJSON}
            className="px-6 py-2 text-[10px] font-display font-bold uppercase tracking-widest bg-white/5 border border-white/5 text-industrial-silver/40 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 rounded-sm shadow-lg"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Exportar JSON
          </button>

          <button
            onClick={handleWipeUsers}
            disabled={isWiping}
            className={`px-6 py-2 text-[10px] font-display font-bold uppercase tracking-widest border transition-all flex items-center gap-2 rounded-sm shadow-lg ${
              isWiping
                ? 'bg-red-500/20 text-red-400 border-red-500/20 animate-pulse'
                : 'bg-red-500/5 text-red-500/60 border-red-500/10 hover:bg-red-500/10 hover:text-red-500'
            }`}
          >
            <span className="material-symbols-outlined text-base">delete_forever</span>
            {isWiping ? (wipeProgress ? `${wipeProgress.phase}: ${wipeProgress.usersProcessed}/${wipeProgress.totalUsers}` : 'APAGANDO...') : 'Wipe de Usuários'}
          </button>

          <button
            onClick={handleClearLogs}
            disabled={isClearing}
            className={`px-6 py-2 text-[10px] font-display font-bold uppercase tracking-widest border transition-all flex items-center gap-2 rounded-sm shadow-lg ${
              isClearing
                ? 'bg-white/5 text-industrial-silver/10 border-white/5'
                : 'bg-red-500/5 text-red-500/60 border-red-500/10 hover:bg-red-500/10 hover:text-red-500'
            }`}
          >
            <span className="material-symbols-outlined text-base">delete_sweep</span>
            {isClearing ? 'PROCESSANDO...' : 'Purgar Logs'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 px-8 py-4 bg-black/20 border-b border-white/5 shrink-0 flex-wrap">
        <div className="flex items-center gap-3 mr-4">
          <span className="material-symbols-outlined text-industrial-silver/20 text-base">filter_list</span>
          <span className="text-[9px] font-display font-bold text-industrial-silver/30 tracking-widest uppercase">Filtros de Rede:</span>
        </div>
        
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold uppercase tracking-widest text-primary px-4 py-2 outline-none rounded-sm transition-all cursor-pointer shadow-inner"
        >
          <option value="all">ORIGEM: TUDO</option>
          <option value="player">SINAL: JOGADOR</option>
          <option value="admin">SINAL: OPERADOR</option>
        </select>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold uppercase tracking-widest text-primary px-4 py-2 outline-none rounded-sm transition-all cursor-pointer shadow-inner"
        >
          <option value="all">TIPO: TUDO</option>
          <option value="navigation">Navegação</option>
          <option value="action">Evento</option>
          <option value="system">Sistema</option>
          <option value="auth">Acesso</option>
          <option value="error">Anomalia</option>
          <option value="admin">Comando</option>
          <option value="trace">Rastro</option>
        </select>

        <div className="flex-1" />
        
        <div className="relative group w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-primary transition-colors pointer-events-none">search</span>
          <input
            type="text"
            placeholder="LOCALIZAR MENSAGEM..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold uppercase tracking-widest text-white placeholder:text-industrial-silver/10 pl-10 pr-4 py-2.5 w-full focus:border-primary/40 outline-none rounded-sm transition-all shadow-inner"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 bg-black/10 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-industrial-silver/10 gap-6 py-20">
            <span className="material-symbols-outlined text-7xl animate-pulse">radar</span>
            <p className="font-display font-bold text-[14px] uppercase tracking-[0.6em]">Aguardando Sincronização de Sinal</p>
          </div>
        ) : (
          filtered.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={handleToggle}
              users={users}
              characterMap={characterMap}
            />
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-8 py-4 bg-black/40 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-3">
           <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-primary/20 animate-loading-bar w-1/2" />
           </div>
           <span className="text-[10px] font-display font-bold text-industrial-silver/20 tracking-widest uppercase">
             Monitorando Atividade de Grid em Tempo Real
           </span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-display font-bold text-industrial-silver/20 uppercase tracking-widest">Densidade:</span>
          <div className="flex bg-black/40 p-1 rounded-sm border border-white/5">
            {[200, 500, 1000].map((n) => (
              <button
                key={n}
                onClick={() => setMaxEntries(n)}
                className={`px-4 py-1 text-[10px] font-display font-bold tracking-tighter transition-all rounded-sm ${
                  maxEntries === n
                    ? 'text-primary bg-primary/10 shadow-lg'
                    : 'text-industrial-silver/20 hover:text-white hover:bg-white/5'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
