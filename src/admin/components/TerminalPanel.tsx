import React, { useState, useEffect, useMemo } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  setTerminalStateForUsers,
  setMacStateForUsers,
  setLimboMilitarySeizureGlobal,
  PlayerMeta,
} from '../../store/firestore';
import { Terminal, ShieldBan, ShieldCheck, UserCheck, Apple } from 'lucide-react';
import { activityLogger } from '../../services/ActivityLogger';
import { userService } from '../../services/UserService';
import type { CharacterData, LimboGlobalState } from '../../types/player';
import { LIMBO_THREAD_COUNT } from '../../components/LimboBoard';

interface TerminalAgentRow {
  uid: string;
  characterId: string;
  codinome: string;
  masterName?: string;
  email?: string;
  hasTerminalAccess?: boolean;
  hasMacAccess?: boolean;
  forceTerminalOpen?: boolean;
  forceMacOpen?: boolean;
}

function rowKey(uid: string, characterId: string): string {
  return `${uid}|${characterId}`;
}

export default function TerminalPanel() {
  const [accounts, setAccounts] = useState<PlayerMeta[]>([]);
  const [characters, setCharacters] = useState<{ uid: string; char: CharacterData }[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [limboState, setLimboState] = useState<LimboGlobalState>({ seized: false });
  const [diskRepairAllowed, setDiskRepairAllowed] = useState(false);

  const agents = useMemo((): TerminalAgentRow[] => {
    const accountByUid = new Map(accounts.map((acc) => [acc.uid, acc]));

    return characters
      .filter(({ char }) => !char.archived)
      .map(({ uid, char }) => {
        const account = accountByUid.get(uid);
        return {
          uid,
          characterId: char.id,
          codinome: char.codinome || 'Sem codinome',
          masterName: account?.masterName || account?.displayName,
          email: account?.email,
          hasTerminalAccess: account?.hasTerminalAccess,
          hasMacAccess: account?.hasMacAccess,
          forceTerminalOpen: account?.forceTerminalOpen,
          forceMacOpen: account?.forceMacOpen,
        };
      })
      .sort((a, b) => a.codinome.localeCompare(b.codinome, 'pt-BR'));
  }, [accounts, characters]);

  useEffect(() => {
    const unsubUsers = userService.subscribeToUsers((users) => setAccounts(users as PlayerMeta[]));
    const unsubCharacters = userService.subscribeToAllCharacters(setCharacters);
    return () => {
      unsubUsers();
      unsubCharacters();
    };
  }, []);

  useEffect(() => {
    const unsubLimbo = onSnapshot(doc(db, 'system', 'limboState'), (snap) => {
      setLimboState(snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false });
    });
    const unsubGameEvents = onSnapshot(doc(db, 'system', 'gameEvents'), (snap) => {
      setDiskRepairAllowed(snap.exists() ? !!snap.data().diskRepairAllowed : false);
    });
    return () => {
      unsubLimbo();
      unsubGameEvents();
    };
  }, []);

  const selectedUids = useMemo(() => {
    const uids = new Set<string>();
    for (const key of selectedKeys) {
      const [uid] = key.split('|');
      if (uid) uids.add(uid);
    }
    return [...uids];
  }, [selectedKeys]);

  const toggleSelect = (uid: string, characterId: string) => {
    const key = rowKey(uid, characterId);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedKeys.size === agents.length) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(agents.map((a) => rowKey(a.uid, a.characterId))));
  };

  const selectedCodinomes = () =>
    agents
      .filter((a) => selectedKeys.has(rowKey(a.uid, a.characterId)))
      .map((a) => a.codinome)
      .join(', ');

  const handleForceTerminal = async () => {
    if (selectedUids.length === 0) return;
    activityLogger.logTrace('force_terminal_step', `Iniciando injeção de evento DOS para ${selectedUids.length} conta(s)...`);
    await setTerminalStateForUsers(selectedUids, true, true);
    activityLogger.logAdmin('gm.mpg', 'force_terminal', `Forçou terminal DOS para: ${selectedCodinomes()}`, { uids: selectedUids });
    setSelectedKeys(new Set());
  };

  const handleRevokeAccess = async () => {
    if (selectedUids.length === 0) return;
    activityLogger.logTrace('revoke_terminal_step', `Iniciando revogação de acesso DOS para ${selectedUids.length} conta(s)...`);
    await setTerminalStateForUsers(selectedUids, false, false);
    activityLogger.logAdmin('gm.mpg', 'revoke_terminal', `Revogou acesso DOS de: ${selectedCodinomes()}`, { uids: selectedUids });
    setSelectedKeys(new Set());
  };

  const handleForceMac = async () => {
    if (selectedUids.length === 0) return;
    activityLogger.logTrace('force_mac_step', `Iniciando injeção de boot MacOS para ${selectedUids.length} conta(s)...`);
    await setMacStateForUsers(selectedUids, true, true);
    activityLogger.logAdmin('gm.mpg', 'force_mac', `Forçou MacOS para: ${selectedCodinomes()}`, { uids: selectedUids });
    setSelectedKeys(new Set());
  };

  const handleRevokeMac = async () => {
    if (selectedUids.length === 0) return;
    activityLogger.logTrace('revoke_mac_step', `Iniciando revogação de acesso MacOS para ${selectedUids.length} conta(s)...`);
    await setMacStateForUsers(selectedUids, false, false);
    activityLogger.logAdmin('gm.mpg', 'revoke_mac', `Revogou acesso Mac de: ${selectedCodinomes()}`, { uids: selectedUids });
    setSelectedKeys(new Set());
  };

  const toggleLimboMilitary = async () => {
    const next = !limboState.seized;
    activityLogger.logTrace('limbo_military_step', `Limbo USArmy → ${next ? 'ATIVO' : 'INATIVO'}`);
    await setLimboMilitarySeizureGlobal(next);
    activityLogger.logAdmin('gm.mpg', 'limbo_military_toggle', `Limbo USArmy ${next ? 'ATIVADO' : 'DESATIVADO'} globalmente`, { seized: next });
  };

  const toggleDiskRepair = async () => {
    const newState = !diskRepairAllowed;
    await setDoc(doc(db, 'system', 'gameEvents'), { diskRepairAllowed: newState }, { merge: true });
    activityLogger.logAdmin('gm.mpg', 'disk_repair_toggle', `DiskRepair ${newState ? 'ATIVADO' : 'DESATIVADO'}`, { diskRepairAllowed: newState });
  };

  return (
    <div className="space-y-8 font-chakra">
      <div className="flex items-center gap-4">
        <div className="w-2 h-8 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
        <h2 className="font-black uppercase tracking-widest text-lg text-white">Interface_de_Injeção_de_Terminais</h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className={`bg-[#1a1a1a] border-4 p-8 rounded-xl shadow-xl flex flex-col gap-6 transition-all ${limboState.seized ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-[#1a1a1a]'}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Estado_Global_LIMBO_01</h3>
              {limboState.seized && <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4 font-black uppercase text-xl">
                {limboState.seized ? (
                  <span className="text-red-500 flex items-center gap-3"><ShieldBan size={24}/> MILITAR_LOCK</span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-3"><ShieldCheck size={24}/> GRID_OPEN</span>
                )}
              </div>
              <p className={`text-[10px] font-mono font-bold uppercase tracking-widest ${limboState.seized ? 'text-red-500/70' : 'text-emerald-500/70'}`}>
                Monitorando leitura global de dados... [{(limboState.readThreadIds || []).length}/{LIMBO_THREAD_COUNT}]
              </p>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed font-bold uppercase tracking-wide">
              O bloqueio global é colaborativo. Ativado automaticamente quando todos os setores forem explorados. Forçar este estado sobrescreve a lógica do grid.
            </p>
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-sm">
              <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Acesso_LIMBO_01</p>
              <p className="text-lg font-mono font-black text-white tracking-wider">212.45.1.1</p>
              <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 leading-relaxed">
                IP alvo no terminal DOS — após TRIGGER_DOS ou unlock via walkman.
              </p>
            </div>
            <div className="bg-black/40 border border-white/5 p-5 rounded-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-white uppercase">{limboState.seized ? 'DESATIVAR_BLOQUEIO' : 'FORÇAR_USArmy'}</span>
                <button
                  type="button"
                  onClick={toggleLimboMilitary}
                  className={`px-6 py-2 border-2 font-black uppercase text-[10px] tracking-widest transition-all rounded-sm ${limboState.seized ? 'bg-red-600 border-red-400 text-white' : 'bg-[#333] border-white/5 text-zinc-400 hover:bg-[#444]'} active:scale-95`}
                >
                  {limboState.seized ? 'NORMALIZAR' : 'BLOQUEAR'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-8 rounded-xl shadow-xl flex flex-col gap-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Protocolos_RPG_Mestre</h3>
            <div className="flex items-center justify-between p-5 bg-black/40 border border-white/5 rounded-sm">
              <div>
                <p className="font-black text-sm text-white uppercase">DiskRepair.exe</p>
                <p className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Desmagnetização Remota</p>
              </div>
              <button
                onClick={toggleDiskRepair}
                className={`relative w-14 h-7 rounded-full transition-all border-2 ${diskRepairAllowed ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(255,140,0,0.2)]' : 'bg-zinc-900 border-zinc-800'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 ${diskRepairAllowed ? 'translate-x-7 bg-primary shadow-[0_0_8px_rgba(255,140,0,0.8)]' : 'translate-x-0 bg-zinc-800'}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="lg:w-2/3 flex flex-col bg-[#1a1a1a] border-4 border-[#1a1a1a] rounded-xl shadow-xl overflow-hidden">
          <div className="p-6 border-b-4 border-[#1a1a1a] bg-black/40 flex flex-wrap gap-4 items-center">
            <div className="flex flex-col mr-2">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">LIMBO_01</span>
              <span className="text-xs font-mono font-black text-primary">212.45.1.1</span>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <button onClick={handleForceTerminal} disabled={selectedKeys.size === 0} className="px-6 py-2 bg-primary text-black font-black uppercase text-[10px] tracking-widest hover:bg-primary-container transition-all disabled:opacity-10 rounded-sm flex items-center gap-3 glow-orange">
              <Terminal size={14}/> TRIGGER_DOS
            </button>
            <button onClick={handleRevokeAccess} disabled={selectedKeys.size === 0} className="px-6 py-2 bg-[#333] border border-white/5 text-zinc-300 font-black uppercase text-[10px] tracking-widest hover:bg-[#444] transition-all disabled:opacity-10 rounded-sm">
              EXIT_DOS
            </button>
            <div className="w-px h-6 bg-white/5 mx-2" />
            <button onClick={handleForceMac} disabled={selectedKeys.size === 0} className="px-6 py-2 bg-zinc-200 text-black font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all disabled:opacity-10 rounded-sm flex items-center gap-3 shadow-lg">
              <Apple size={14}/> BOOT_MACOS
            </button>
            <button onClick={handleRevokeMac} disabled={selectedKeys.size === 0} className="px-6 py-2 bg-[#333] border border-white/5 text-zinc-300 font-black uppercase text-[10px] tracking-widest hover:bg-[#444] transition-all disabled:opacity-10 rounded-sm">
              EXIT_MAC
            </button>
          </div>

          <p className="px-6 py-3 text-[9px] font-black text-zinc-600 uppercase tracking-widest border-b border-white/5 bg-black/20">
            {agents.length} personagem(ns) ativo(s) — acesso DOS/MAC é por conta (UID)
          </p>

          <div className="flex-1 overflow-x-auto bg-black/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-[#1a1a1a] text-[10px] font-black uppercase tracking-[0.2em] text-zinc-700">
                  <th className="p-5 w-16 text-center">
                    <div
                      onClick={selectAll}
                      className={`w-5 h-5 border-2 rounded-sm mx-auto cursor-pointer transition-all flex items-center justify-center ${selectedKeys.size > 0 ? 'bg-primary border-primary' : 'border-zinc-800'}`}
                    >
                      {selectedKeys.size > 0 && <span className="material-symbols-outlined text-black text-xs font-black">check</span>}
                    </div>
                  </th>
                  <th className="p-5">PERSONAGEM</th>
                  <th className="p-5 text-center">AUTORIZAÇÃO_HARDWARE</th>
                  <th className="p-5 text-right">ESTADO_EM_CAMPO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                      Nenhum personagem ativo encontrado
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => {
                    const key = rowKey(agent.uid, agent.characterId);
                    const isSelected = selectedKeys.has(key);
                    return (
                      <tr key={key} className={`hover:bg-primary/5 transition-all group ${isSelected ? 'bg-primary/5' : ''}`}>
                        <td className="p-5 text-center">
                          <div
                            onClick={() => toggleSelect(agent.uid, agent.characterId)}
                            className={`w-5 h-5 border-2 rounded-sm mx-auto cursor-pointer transition-all flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-zinc-800 group-hover:border-zinc-600'}`}
                          >
                            {isSelected && <span className="material-symbols-outlined text-black text-xs font-black">check</span>}
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <UserCheck size={16} className={agent.hasTerminalAccess ? 'text-emerald-500' : 'text-zinc-800'} />
                            <div>
                              <p className={`text-xs font-black uppercase ${isSelected ? 'text-primary' : 'text-zinc-200 group-hover:text-white'}`}>
                                {agent.codinome}
                              </p>
                              {(agent.masterName || agent.email) && (
                                <p className="text-[8px] font-bold text-zinc-500 uppercase mt-0.5 tracking-wide">
                                  {agent.masterName}{agent.masterName && agent.email ? ' · ' : ''}{agent.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-5 text-center">
                          <div className="flex items-center justify-center gap-4">
                            <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${agent.hasTerminalAccess ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' : 'border-zinc-900 text-zinc-800'}`}>DOS</div>
                            <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border ${agent.hasMacAccess ? 'border-cyan-500/20 text-cyan-500 bg-cyan-500/5' : 'border-zinc-900 text-zinc-800'}`}>MAC</div>
                          </div>
                        </td>
                        <td className="p-5 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {agent.forceTerminalOpen && <span className="text-primary text-[9px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1"><div className="w-1 h-1 bg-primary rounded-full" /> DOS_LIVE</span>}
                            {agent.forceMacOpen && <span className="text-cyan-500 text-[9px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1"><div className="w-1 h-1 bg-cyan-500 rounded-full" /> MAC_LIVE</span>}
                            {!agent.forceTerminalOpen && !agent.forceMacOpen && <span className="text-zinc-800 text-[9px] font-black uppercase tracking-widest">---</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
