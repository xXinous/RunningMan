import React, { useState, useEffect } from 'react';
import { Group, MasterAccount, CharacterData, GroupCharacterSlot } from '../../types/player';
import { Campaign } from '../../data/campaigns';
import { groupService } from '../../services/GroupService';
import { userService } from '../../services/UserService';
import { activityLogger } from '../../services/ActivityLogger';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { useModal } from './ConfirmModal';
import IntelDistributionDrawer from './IntelDistributionDrawer';
import NpcSmsDistributionModal from './NpcSmsDistributionModal';

interface GroupManagerProps {
  isAdmin: boolean;
  onNavigateToMission?: (campaignId: string) => void;
}

export default function GroupManager({ isAdmin, onNavigateToMission }: GroupManagerProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<MasterAccount[]>([]);
  const [allCharacters, setAllCharacters] = useState<{uid: string, char: CharacterData}[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const { showConfirm, modal } = useModal();
  
  // Form State
  const [groupName, setGroupName] = useState("");
  const [selectedCharacters, setSelectedCharacters] = useState<{uid: string, characterId: string}[]>([]);
  const [sessionDate, setSessionDate] = useState("");
  const [sessions, setSessions] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");

  // Intel Grant State
  const [showGrantModal, setShowGrantModal] = useState<string | null>(null);
  const [grantLoading, setGrantLoading] = useState(false);
  
  // SMS Distribution State
  const [showSmsModal, setShowSmsModal] = useState<string | null>(null);

  // Quick Action State
  const [quickAddGroup, setQuickAddGroup] = useState<string | null>(null);
  const [quickAddSearch, setQuickAddSearch] = useState("");

  useEffect(() => {
    const unsubGroups = groupService.subscribeToGroups(setGroups);
    
    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list: Campaign[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Campaign));
      setCampaigns(list);
    });

    fetchInitialAgents();

    return () => {
      unsubGroups();
      unsubCampaigns();
    };
  }, []);

  const fetchInitialAgents = async () => {
    try {
      const result = await userService.fetchUsersPage(50);
      setUsers(result.users as MasterAccount[]);
      
      const charPromises = result.users.map(u => userService.fetchCharactersForUser(u.uid));
      const charResults = await Promise.all(charPromises);
      
      const combined: {uid: string, char: CharacterData}[] = [];
      result.users.forEach((acc, i) => {
        charResults[i].forEach(char => {
          combined.push({ uid: acc.uid, char });
        });
      });
      setAllCharacters(combined);
    } catch (err) {
      console.error("Erro ao carregar agentes:", err);
    }
  };

  const handleAgentSearch = async () => {
    if (!agentSearchQuery.trim()) {
      fetchInitialAgents();
      return;
    }
    try {
      const results = await userService.searchCharactersByCodinome(agentSearchQuery);
      setAllCharacters(results);
      const uids = [...new Set(results.map(r => r.uid))];
      const userPromises = uids.map(uid => userService.fetchUsersPage(1, null, 'uid', uid));
      const userResults = await Promise.all(userPromises);
      const foundUsers = userResults.flatMap(r => r.users);
      setUsers(foundUsers as MasterAccount[]);
    } catch (err) {
      console.error("Erro ao buscar agentes:", err);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      handleAgentSearch();
    }, 500);
    return () => clearTimeout(handler);
  }, [agentSearchQuery]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedCharacters.length === 0) return;

    try {
      const slots: GroupCharacterSlot[] = selectedCharacters.map(c => ({
        uid: c.uid,
        characterId: c.characterId,
        joinedAt: Timestamp.now()
      }));

      await groupService.createGroup(groupName, slots, sessions);
      activityLogger.logAdmin('gm.mpg', 'group_created', `Grupo criado: ${groupName}`, { players: selectedCharacters.length });
      resetForm();
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !groupName.trim()) return;

    try {
      const currentSlots = editingGroup.characterSlots || [];
      const newSlots: GroupCharacterSlot[] = selectedCharacters.map(sc => {
        const existing = currentSlots.find(cs => cs.characterId === sc.characterId);
        return existing ? existing : { uid: sc.uid, characterId: sc.characterId, joinedAt: Timestamp.now() };
      });

      await groupService.updateGroup(editingGroup.id, {
        name: groupName,
        characterSlots: newSlots,
        sessions: sessions
      });
      activityLogger.logAdmin('gm.mpg', 'group_updated', `Grupo atualizado: ${groupName}`);
      resetForm();
    } catch (error) {
      console.error("Erro ao atualizar grupo:", error);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    const ok = await showConfirm('Excluir Grupo', "Tem certeza que deseja excluir este esquadrão PERMANENTEMENTE?", 'Excluir');
    if (!ok) return;
    try {
      await groupService.deleteGroup(id);
      activityLogger.logAdmin('gm.mpg', 'group_deleted', `Grupo excluído: ${id}`);
    } catch (error) {
      console.error("Erro ao excluir grupo:", error);
    }
  };

  const handleGrantIntelToGroup = async (groupId: string, intelIds: Set<string>, aliveOnly: boolean) => {
    setGrantLoading(true);
    try {
      for (const intelId of intelIds) {
        await groupService.grantIntelToGroup(groupId, intelId, aliveOnly);
      }
      activityLogger.logAdmin('gm.mpg', 'group_intel_granted', `${intelIds.size} Intels concedidas a agentes do esquadrão ${groupId}`);
      setShowGrantModal(null);
    } catch (error) {
      console.error("Erro ao conceder intel:", error);
      throw error;
    } finally {
      setGrantLoading(false);
    }
  };

  const handleQuickRemoveMember = async (groupId: string, characterId: string, charName: string) => {
    const ok = await showConfirm('Remover Agente', `Deseja remover ${charName} do esquadrão?`, 'Remover');
    if (!ok) return;
    try {
      await groupService.removeCharacterFromGroup(groupId, characterId);
      activityLogger.logAdmin('gm.mpg', 'group_leave_quick', `Removeu ${charName} do esquadrão rapidamente`);
    } catch (err) {
      console.error("Erro ao remover rapidamente:", err);
    }
  };

  const handleQuickAddMember = async (groupId: string, uid: string, characterId: string, charName: string) => {
    try {
      await groupService.addCharacterToGroup(groupId, uid, characterId);
      activityLogger.logAdmin('gm.mpg', 'group_join_quick', `Adicionou ${charName} ao esquadrão rapidamente`);
      setQuickAddGroup(null);
      setQuickAddSearch("");
    } catch (err) {
      console.error("Erro ao adicionar rapidamente:", err);
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingGroup(null);
    setGroupName("");
    setSelectedCharacters([]);
    setSessions([]);
    setSessionDate("");
  };

  const startEdit = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedCharacters(group.characterSlots ? group.characterSlots.map(s => ({ uid: s.uid, characterId: s.characterId })) : []);
    setSessions(group.sessions || []);
    setIsCreating(true);
  };

  const addSession = () => {
    if (!sessionDate || sessions.includes(sessionDate)) return;
    setSessions([...sessions, sessionDate]);
    setSessionDate("");
  };

  const removeSession = (date: string) => {
    setSessions(sessions.filter(s => s !== date));
  };

  const toggleCharacter = (uid: string, characterId: string) => {
    setSelectedCharacters(prev => {
      const exists = prev.find(c => c.uid === uid && c.characterId === characterId);
      if (exists) return prev.filter(c => !(c.uid === uid && c.characterId === characterId));
      return [...prev, { uid, characterId }];
    });
  };

  const isSelected = (uid: string, characterId: string) => {
    return selectedCharacters.some(c => c.uid === uid && c.characterId === characterId);
  };

  const filteredCharacters = allCharacters.filter(c => showArchived || !c.char.archived);

  const squadMembers = allCharacters.filter(item => 
    selectedCharacters.some(sc => sc.uid === item.uid && sc.characterId === item.char.id)
  );

  const availableAgents = filteredCharacters.filter(item => 
    !selectedCharacters.some(sc => sc.uid === item.uid && sc.characterId === item.char.id)
  );

  return (
    <div className="space-y-8 font-chakra">
      {/* Cabeçalho de Grupos */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
           <h3 className="text-zinc-600 font-black text-[10px] uppercase tracking-[0.3em]">Gerenciamento_de_Esquadrões_RPG</h3>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-primary/10 text-primary px-6 py-2 rounded-sm font-black text-[10px] tracking-widest border border-primary/20 hover:bg-primary/20 transition-all active:scale-95 glow-orange uppercase"
          >
            <span className="material-symbols-outlined text-sm">group_add</span>
            NOVO_ESQUADRÃO
          </button>
        )}
      </div>

      {isCreating ? (
        <div className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-8 rounded-xl shadow-2xl relative overflow-hidden">
          <div className="noise-overlay" /><div className="scanlines" />
          <form onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup} className="space-y-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Coluna 1: Info Básica */}
              <div className="space-y-6">
                <div>
                  <label className="block font-black text-[10px] text-zinc-500 mb-3 uppercase tracking-widest">Identificador_do_Esquadrão (Mesa)</label>
                  <input 
                    type="text" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="EX: NÉVOA_DE_RAVENLOFT"
                    className="w-full bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[11px] font-bold focus:border-primary outline-none rounded-sm uppercase transition-all"
                    required
                  />
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-sm p-4">
                  <p className="text-[9px] font-black text-primary/70 uppercase tracking-widest leading-relaxed">
                    Missões ativas e autorizações são gerenciadas na aba Missões → Gerenciar.
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <label className="block font-black text-[10px] text-zinc-500 mb-3 uppercase tracking-widest">Registros_de_Sessão</label>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="date" 
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="flex-1 bg-black/60 border-2 border-[#1a1a1a] text-white px-4 py-3 text-[10px] font-bold focus:border-primary outline-none rounded-sm"
                    />
                    <button 
                      type="button"
                      onClick={addSession}
                      className="bg-[#333] hover:bg-[#444] text-white px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm"
                    >
                      ADD_DATA
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px] bg-black/40 p-3 rounded-sm border border-[#1a1a1a]">
                    {sessions.map(date => (
                      <span key={date} className="bg-black border border-white/10 text-primary px-3 py-1.5 rounded-sm text-[9px] font-mono font-black flex items-center gap-3 shadow-lg">
                        {date}
                        <button type="button" onClick={() => removeSession(date)} className="text-zinc-600 hover:text-red-500 transition-colors">×</button>
                      </span>
                    ))}
                    {sessions.length === 0 && <p className="text-zinc-800 text-[9px] font-black uppercase tracking-widest italic pt-1">Nenhum Registro Temporal</p>}
                  </div>
                </div>
              </div>

              {/* Coluna 2: Seleção de Personagens */}
              <div className="space-y-6">
                {/* Membros Atuais */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block font-black text-[10px] text-zinc-500 uppercase tracking-widest">Membros do Esquadrão ({selectedCharacters.length})</label>
                  </div>
                  <div className="bg-black/40 border-2 border-[#1a1a1a] h-36 overflow-y-auto p-3 space-y-2 custom-scrollbar rounded-sm">
                    {squadMembers.map(item => {
                      const user = users.find(u => u.uid === item.uid);
                      return (
                        <div
                          key={`member_${item.uid}_${item.char.id}`}
                          className="flex items-center justify-between p-2 bg-primary/5 border border-primary/20 rounded-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-6 h-6 rounded-sm bg-black border border-[#1a1a1a] flex items-center justify-center font-black text-xs ${item.char.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'}`}>
                              {(item.char.codinome || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-[10px] text-primary uppercase truncate">
                                {item.char.codinome}
                              </p>
                              <p className="text-[7px] font-mono text-zinc-600 font-bold uppercase truncate mt-0.5">
                                {user?.displayName || user?.email?.split('@')[0]}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCharacter(item.uid, item.char.id)}
                            className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-500 transition-all rounded-xs hover:bg-red-500/10 cursor-pointer"
                            title="Remover do Esquadrão"
                          >
                            <span className="material-symbols-outlined text-sm font-black">close</span>
                          </button>
                        </div>
                      );
                    })}
                    {selectedCharacters.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-700 py-8 opacity-40">
                        <span className="material-symbols-outlined text-2xl mb-1">group_off</span>
                        <p className="text-[8px] font-black uppercase tracking-widest">Nenhum Agente Selecionado</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Agentes Disponíveis para Seleção */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                     <label className="block font-black text-[10px] text-zinc-500 uppercase tracking-widest">Agentes Disponíveis</label>
                     <label className="flex items-center gap-2 cursor-pointer group">
                       <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="hidden" />
                       <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${showArchived ? 'text-primary' : 'text-zinc-600 group-hover:text-zinc-400'}`}>Incluir_Arquivados</span>
                     </label>
                  </div>

                  <div className="relative mb-3 group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-sm group-focus-within:text-primary transition-all">search</span>
                    <input 
                      type="text" 
                      placeholder="BUSCAR AGENTE POR CODINOME..."
                      value={agentSearchQuery}
                      onChange={(e) => setAgentSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAgentSearch())}
                      className="w-full bg-black/40 border-2 border-[#1a1a1a] text-white px-10 py-2.5 text-[9px] font-bold focus:border-primary/40 outline-none rounded-sm uppercase transition-all shadow-inner"
                    />
                  </div>

                  <div className="bg-black/60 border-2 border-[#1a1a1a] h-44 overflow-y-auto p-3 space-y-2 custom-scrollbar rounded-sm">
                    {availableAgents.map(item => {
                      const user = users.find(u => u.uid === item.uid);
                      return (
                        <button
                          key={`avail_${item.uid}_${item.char.id}`}
                          type="button"
                          onClick={() => toggleCharacter(item.uid, item.char.id)}
                          className="w-full flex items-center justify-between p-2 text-left transition-all border border-transparent hover:border-primary/20 hover:bg-primary/5 rounded-sm group cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-sm bg-black border border-[#1a1a1a] flex items-center justify-center font-black text-sm ${item.char.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'}`}>
                              {(item.char.codinome || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-[10px] text-zinc-400 uppercase truncate group-hover:text-white transition-colors">
                                {item.char.codinome}
                              </p>
                              <p className="text-[7px] font-mono text-zinc-600 font-bold uppercase truncate mt-0.5">
                                JOGADOR: {user?.displayName || user?.email?.split('@')[0]}
                              </p>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-sm text-zinc-800 group-hover:text-primary transition-colors pr-1">person_add</span>
                        </button>
                      );
                    })}
                    {availableAgents.length === 0 && (
                      <p className="text-zinc-600 text-[9px] font-black uppercase tracking-widest text-center py-8">Nenhum Agente Disponível</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-6 pt-8 border-t-4 border-[#1a1a1a]">
              <button type="button" onClick={resetForm} className="px-8 py-3 text-[10px] font-black text-zinc-600 hover:text-white uppercase tracking-widest transition-colors">ABORTAR</button>
              <button 
                type="submit" 
                className="bg-primary hover:bg-primary-container text-black px-12 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 glow-orange shadow-lg"
              >
                {editingGroup ? 'SINCRONIZAR_ALTERAÇÕES' : 'CONFIRMAR_REGISTRO'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groups.map(group => {
            const slots = group.characterSlots || [];
            const statuses = slots.map(slot => {
              const item = allCharacters.find(c => c.uid === slot.uid && c.char.id === slot.characterId);
              return item?.char.agentStatus || 'desaparecido';
            });
            const aliveCount = statuses.filter(s => s === 'vivo').length;
            const deadCount = statuses.filter(s => s === 'morto').length;
            const missingCount = statuses.filter(s => s === 'desaparecido').length;

            return (
              <div key={group.id} className="bg-[#1a1a1a] border-4 border-[#1a1a1a] p-6 group hover:border-primary/20 transition-all rounded-xl shadow-xl relative overflow-hidden active:scale-[0.99]">
                <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 rotate-45 translate-x-6 -translate-y-6 border-b border-primary/10" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-black text-white text-base uppercase tracking-tighter group-hover:text-primary transition-colors">{group.name}</h4>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-sm border border-white/5 shadow-inner">
                         <div className="flex gap-1.5">
                            <span className="flex items-center gap-1 text-[8px] font-black text-emerald-500">🟩 {aliveCount}</span>
                            <span className="flex items-center gap-1 text-[8px] font-black text-yellow-500">🟨 {missingCount}</span>
                            <span className="flex items-center gap-1 text-[8px] font-black text-red-500">🟥 {deadCount}</span>
                         </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-sm border border-white/5 shadow-inner">
                         <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                         <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                           {slots.length} AGENTES
                         </p>
                      </div>
                      {group.campaignId && (
                        <span className="text-[8px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-1 rounded-sm uppercase tracking-widest flex items-center gap-1">
                          <span className="material-symbols-outlined text-[10px]">rocket_launch</span>
                          {campaigns.find(c => c.id === group.campaignId)?.name || group.campaignId}
                        </span>
                      )}
                      {group.unlockedCampaigns && group.unlockedCampaigns.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-sm border border-white/5">
                          <span className="material-symbols-outlined text-[10px] text-zinc-500">vpn_key</span>
                          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                            {group.unlockedCampaigns.length} MISSÕES
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    {group.campaignId && onNavigateToMission && (
                      <button
                        onClick={() => onNavigateToMission(group.campaignId!)}
                        className="w-8 h-8 flex items-center justify-center bg-black/60 border border-white/10 rounded-sm text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all active:scale-90"
                        title="Gerenciar Missões"
                      >
                        <span className="material-symbols-outlined text-sm">rocket_launch</span>
                      </button>
                    )}
                    <button onClick={() => setShowSmsModal(group.id)} className="w-8 h-8 flex items-center justify-center bg-black/60 border border-white/10 rounded-sm text-primary hover:bg-primary hover:text-black transition-all active:scale-90" title="Distribuir Torpedos SMS de NPCs">
                      <span className="material-symbols-outlined text-sm">sms</span>
                    </button>
                    <button onClick={() => setShowGrantModal(group.id)} className="w-8 h-8 flex items-center justify-center bg-black/60 border border-white/10 rounded-sm text-primary hover:bg-primary hover:text-black transition-all active:scale-90" title="Transferência de Evidências em Lote">
                      <span className="material-symbols-outlined text-sm">wifi_tethering</span>
                    </button>
                    <button onClick={() => startEdit(group)} className="w-8 h-8 flex items-center justify-center bg-black/60 border border-white/10 rounded-sm text-zinc-600 hover:text-emerald-400 transition-all active:scale-90">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onClick={() => handleDeleteGroup(group.id)} className="w-8 h-8 flex items-center justify-center bg-black/60 border border-white/10 rounded-sm text-zinc-600 hover:text-red-500 transition-all active:scale-90">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-wrap gap-1.5">
                    {group.sessions?.slice(0, 4).map(date => (
                      <span key={date} className="text-[8px] font-mono bg-black text-zinc-600 px-2 py-1 rounded-sm border border-white/5 font-bold tracking-widest uppercase shadow-sm">
                        {date}
                      </span>
                    ))}
                    {group.sessions?.length > 4 && <span className="text-[8px] font-black text-zinc-800 self-center">+{group.sessions.length - 4}</span>}
                  </div>
                  
                  <div className="flex flex-wrap gap-3 pt-2">
                    {(group.characterSlots || []).map(slot => {
                      const item = allCharacters.find(c => c.uid === slot.uid && c.char.id === slot.characterId);
                      if (!item) return null;
                      return (
                        <div key={`${slot.uid}_${slot.characterId}`} className="group/member flex items-center gap-2 bg-black/40 border border-white/5 px-2 py-1.5 rounded-sm min-w-[120px] relative">
                           <div className={`w-2 h-2 rounded-full ${item.char.agentStatus === 'vivo' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : item.char.agentStatus === 'morto' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                           <div className="min-w-0 flex-1">
                             <p className="font-black text-[9px] text-zinc-300 uppercase truncate pr-4">{item.char.codinome}</p>
                             <p className="font-mono text-[8px] text-zinc-600 truncate">{users.find(u => u.uid === slot.uid)?.displayName || '???'}</p>
                           </div>
                           <button onClick={() => handleQuickRemoveMember(group.id, item.char.id, item.char.codinome)} className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-sm opacity-0 group-hover/member:opacity-100 transition-all bg-black/80 backdrop-blur-sm z-10">
                             <span className="material-symbols-outlined text-[14px]">close</span>
                           </button>
                        </div>
                      );
                    })}
                    <button onClick={() => { setQuickAddGroup(quickAddGroup === group.id ? null : group.id); setQuickAddSearch(""); }} className={`flex items-center justify-center w-8 h-8 rounded-sm transition-all ${quickAddGroup === group.id ? 'bg-primary text-black border-primary' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'}`}>
                      <span className="material-symbols-outlined text-[16px]">{quickAddGroup === group.id ? 'close' : 'person_add'}</span>
                    </button>
                  </div>

                  {quickAddGroup === group.id && (
                    <div className="mt-4 p-4 bg-black/60 border border-primary/30 rounded-sm shadow-xl">
                      <input 
                        type="text" 
                        placeholder="BUSCAR AGENTE PARA ADICIONAR..."
                        value={quickAddSearch}
                        onChange={(e) => setQuickAddSearch(e.target.value)}
                        className="w-full bg-black border-2 border-[#1a1a1a] text-white px-3 py-2 text-[10px] font-bold focus:border-primary outline-none rounded-sm uppercase transition-all mb-2"
                        autoFocus
                      />
                      <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                        {allCharacters.filter(c => 
                          (!quickAddSearch || c.char.codinome?.toLowerCase().includes(quickAddSearch.toLowerCase())) &&
                          !group.characterSlots?.some(s => s.characterId === c.char.id)
                        ).length === 0 ? (
                          <p className="text-[9px] text-zinc-500 uppercase font-black py-2 text-center">NENHUM AGENTE ENCONTRADO</p>
                        ) : (
                          allCharacters.filter(c => 
                            (!quickAddSearch || c.char.codinome?.toLowerCase().includes(quickAddSearch.toLowerCase())) &&
                            !group.characterSlots?.some(s => s.characterId === c.char.id)
                          ).map(c => (
                            <div key={c.char.id} className="flex items-center justify-between p-2 bg-black hover:bg-white/5 border border-white/5 rounded-sm transition-all group/add">
                               <div className="flex items-center gap-2">
                                 <div className={`w-2 h-2 rounded-full ${c.char.agentStatus === 'vivo' ? 'bg-emerald-500' : c.char.agentStatus === 'morto' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                 <div className="flex flex-col">
                                   <span className="text-[10px] font-black text-white uppercase">{c.char.codinome}</span>
                                   <span className="text-[8px] font-mono text-zinc-600 uppercase">{users.find(u => u.uid === c.uid)?.displayName || '???'}</span>
                                 </div>
                               </div>
                               <button onClick={() => handleQuickAddMember(group.id, c.uid, c.char.id, c.char.codinome)} className="text-[9px] font-black bg-primary/10 text-primary px-3 py-1.5 rounded-sm uppercase hover:bg-primary hover:text-black transition-all opacity-0 group-hover/add:opacity-100">Adicionar</button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {groups.length === 0 && (
            <div className="col-span-full py-24 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-zinc-800 mb-4">groups_2</span>
              <p className="text-zinc-700 font-black text-sm uppercase tracking-[0.4em]">Nenhum_Esquadrão_Sincronizado</p>
            </div>
          )}
        </div>
      )}

      {/* Grant Intel Modal (Batch) */}
      {showGrantModal && (
        <IntelDistributionDrawer
           onClose={() => setShowGrantModal(null)}
           onSuccess={() => {}}
           onExecuteGrant={async (selectedIds) => {
             const aliveOnly = await showConfirm('Condição de Distribuição', 'Distribuir apenas para agentes VIVOS no esquadrão? (Clique em confirmar para Apenas Vivos)', 'Apenas Vivos');
             await handleGrantIntelToGroup(showGrantModal, selectedIds, aliveOnly);
           }}
           title="Distribuir Intel — Esquadrão"
        />
      )}

      {/* SMS NPC Distribution Modal */}
      {showSmsModal && (() => {
        const targetGroup = groups.find(g => g.id === showSmsModal);
        return targetGroup ? (
          <NpcSmsDistributionModal 
             group={targetGroup}
             allCharacters={allCharacters}
             onClose={() => setShowSmsModal(null)}
             onSuccess={() => {}}
          />
        ) : null;
      })()}

      {modal}
    </div>
  );
}
