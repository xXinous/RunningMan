import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { userService } from '../../services/UserService';
import { intelRegistry } from '../../data/intel_registry';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import RetroSpinner from '../../components/player/RetroSpinner';
import { activityLogger } from '../../services/ActivityLogger';
import { CharacterData, PlayerStats, MasterAccount, Group } from '../../types/player';
import { intelService } from '../../services/IntelService';
import IntelDistributionDrawer from './IntelDistributionDrawer';
import { useModal } from './ConfirmModal';
import Screw from '../../components/player/Screw';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';

interface AgentDossierViewProps {
  uid: string;
  character: CharacterData;
  masterAccount: MasterAccount;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AgentDossierView({ uid, character, masterAccount, onClose, onUpdate }: AgentDossierViewProps) {
  const [details, setDetails] = useState<{
    intel: { id: string; unlockedAt: any }[];
    playCounts: any[];
    stats: PlayerStats | null;
    achievements: string[];
    groups: Group[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [editingChar, setEditingChar] = useState<Partial<CharacterData>>(character);
  const [saveLoading, setSaveLoading] = useState(false);
  
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [allAccounts, setAllAccounts] = useState<MasterAccount[]>([]);
  const [transferTarget, setTransferTarget] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAchievementSelect, setShowAchievementSelect] = useState(false);

  // Use unified intelRegistry instead of direct Firestore listener
  const allAudios = useMemo(() => 
    intelRegistry.getAll().map(item => ({
      id: item.id,
      originalName: item.title || item.id,
      title: item.title,
      artist: item.metadata?.artist,
    })),
  []);

  const { showConfirm, modal } = useModal();

  useEffect(() => {
    loadDetails();
  }, [uid, character.id]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const data = await userService.loadUserDetails(uid, character.id);
      
      // Load groups the character belongs to
      const groupsSnap = await getDocs(collection(db, 'groups'));
      const allGroupsList = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      const groups = allGroupsList.filter(g => g.characterSlots?.some(slot => slot.characterId === character.id));

      setDetails({ ...data, groups });
    } catch (error) {
      console.error("Error loading dossier details:", error);
    } finally {
      setLoading(false);
    }
  };


  const handleUpdateChar = async () => {
    setSaveLoading(true);
    try {
      await userService.updateCharacter(uid, character.id, editingChar);
      onUpdate();
    } catch (error) {
      console.error("Error updating character:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleArchiveChar = async () => {
    const isArchiving = !character.archived;
    const actionName = isArchiving ? 'Arquivar' : 'Desarquivar';
    const ok = await showConfirm(
      `${actionName} Agente`, 
      isArchiving 
        ? `Arquivar removerá o agente da lista principal, mas preservará todo o histórico. Continuar?`
        : `O agente voltará à ativa. Continuar?`, 
      actionName
    );
    if (!ok) return;
    setSaveLoading(true);
    try {
      await userService.archiveCharacter(uid, character.id, isArchiving);
      onUpdate();
      onClose();
    } catch (error) {
      console.error(`Error ${isArchiving ? 'archiving' : 'unarchiving'} character:`, error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteChar = async () => {
    const ok = await showConfirm('Excluir Definitivamente', `AVISO CRÍTICO: Exclusão permanente destruirá todos os dados do agente "${character.codinome}". Esta ação não pode ser desfeita. Confirmar?`, 'Excluir Permanentemente');
    if (!ok) return;
    setSaveLoading(true);
    try {
      await userService.deleteCharacter(uid, character.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error deleting character:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleOpenTransfer = async () => {
    setSaveLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const accs = snap.docs.map(d => ({ uid: d.id, ...d.data() } as MasterAccount)).filter(a => a.uid !== uid);
      setAllAccounts(accs);
      setShowTransferModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferTarget) return;
    const ok = await showConfirm('Transferir Agente', 'Esta operação moverá todos os dados do personagem para a conta selecionada. Confirmar?', 'Transferir');
    if (!ok) return;
    setSaveLoading(true);
    try {
      await userService.transferCharacter(uid, transferTarget, character.id);
      onUpdate();
      onClose();
    } catch (error) {
      console.error("Error transferring character:", error);
    } finally {
      setSaveLoading(false);
      setShowTransferModal(false);
    }
  };

  const handleRemoveIntel = async (intelId: string) => {
    const ok = await showConfirm('Remover Item', "Remover este item do inventário do agente?", 'Remover');
    if (!ok) return;
    await intelService.revokeIntel(uid, character.id, intelId);
    activityLogger.logAdmin('gm.mpg', 'inventory_remove', `Removeu intel ${intelId} de ${character.codinome}`, { uid, charId: character.id, intelId });
    await loadDetails();
  };

  const handleGrantAchievement = async (achId: string) => {
    await userService.grantUserAchievement(uid, character.id, achId);
    activityLogger.logAdmin('gm.mpg', 'achievement_grant', `Outorgou medalha ${achId} para ${character.codinome}`, { uid, charId: character.id, achId });
    setShowAchievementSelect(false);
    await loadDetails();
  };

  const handleRevokeAchievement = async (achId: string) => {
    const ok = await showConfirm('Revogar Medalha', `Deseja revogar a medalha ${achId}?`, 'Revogar');
    if (!ok) return;
    await userService.revokeUserAchievement(uid, character.id, achId);
    activityLogger.logAdmin('gm.mpg', 'achievement_revoke', `Revogou medalha ${achId} de ${character.codinome}`, { uid, charId: character.id, achId });
    await loadDetails();
  };

  if (loading) return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <RetroSpinner />
    </div>,
    document.body
  );

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-[#222] border-l-8 border-[#1a1a1a] w-full max-w-3xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra"
      >
        <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
        <div className="noise-overlay" /><div className="scanlines" />
        
        {/* Header */}
        <div className="p-8 border-b-4 border-[#1a1a1a] flex justify-between items-start bg-black/40 relative z-20">
          <div className="flex gap-8 w-full">
             <div className="w-28 h-28 bg-black border-4 border-[#1a1a1a] rounded-sm flex items-center justify-center overflow-hidden relative group shadow-xl shrink-0">
                {character.profilePhotoUrl ? (
                  <img src={character.profilePhotoUrl} alt={character.codinome} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                ) : (
                  <span className="material-symbols-outlined text-5xl text-zinc-800">person</span>
                )}
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             <div className="flex flex-col flex-1 justify-between py-1">
                <div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{character.codinome}</h2>
                       <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border-2 ${
                         character.agentStatus === 'vivo' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                         character.agentStatus === 'morto' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                         'bg-[#333] text-zinc-500 border-[#444]'
                       }`}>
                         {character.agentStatus}
                       </span>
                       {character.archived && (
                         <span className="px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest border-2 bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                           ARQUIVADO
                         </span>
                       )}
                     </div>
                     <button onClick={onClose} className="text-zinc-600 hover:text-white transition-all material-symbols-outlined -mt-2">close</button>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-sm">
                      Mestre: {masterAccount?.displayName || masterAccount?.masterName || masterAccount?.email}
                    </span>
                    <p className="font-mono text-[9px] text-zinc-600 uppercase tracking-widest font-bold">
                      RM-{character.id} // {(masterAccount?.uid || "").slice(0,8)}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-8 items-end mt-4">
                   <div className="space-y-2">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Nível_de_Ameaça</span>
                      <div className="flex gap-1.5">
                        {[1,2,3,4,5].map(lv => (
                          <div 
                            key={lv} 
                            onClick={() => setEditingChar(prev => ({ ...prev, dangerLevel: lv }))}
                            className={`w-6 h-2.5 rounded-sm cursor-pointer transition-all ${lv <= (editingChar.dangerLevel || 1) ? 'bg-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]' : 'bg-black border border-white/5 hover:border-primary/20'}`}
                          />
                        ))}
                      </div>
                   </div>
                   <div className="space-y-2">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Status_Identidade</span>
                      <select 
                        value={editingChar.agentStatus} 
                        onChange={(e) => setEditingChar(prev => ({ ...prev, agentStatus: e.target.value as any }))}
                        className="bg-black/60 border-2 border-[#1a1a1a] text-[10px] font-black text-primary px-4 py-2 outline-none uppercase rounded-sm focus:border-primary"
                      >
                        <option value="vivo">ATIVO</option>
                        <option value="morto">ELIMINADO</option>
                        <option value="desaparecido">DESAPARECIDO</option>
                      </select>
                   </div>
                   <div className="flex gap-3 ml-auto">
                      <button 
                        onClick={handleUpdateChar}
                        disabled={saveLoading}
                        className="bg-primary hover:bg-primary-container text-black px-6 py-2.5 rounded-sm font-black text-[10px] tracking-widest uppercase transition-all active:scale-95 glow-orange shadow-lg"
                      >
                        {saveLoading ? 'SINC...' : 'SALVAR'}
                      </button>
                      <div className="relative">
                        <button 
                          onClick={() => setIsMenuOpen(!isMenuOpen)}
                          className="bg-[#1a1a1a] text-zinc-400 hover:text-white px-3 py-2.5 rounded-sm transition-all border-2 border-transparent hover:border-white/10"
                        >
                          <span className="material-symbols-outlined text-sm">more_vert</span>
                        </button>
                        {isMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                            <div className="absolute top-full right-0 mt-2 bg-black border-2 border-[#1a1a1a] shadow-xl rounded-sm w-48 z-50">
                              <button onClick={() => { setIsMenuOpen(false); handleOpenTransfer(); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 border-b border-[#1a1a1a]">
                                <span className="material-symbols-outlined text-sm">swap_horiz</span> Transferir
                              </button>
                              <button onClick={() => { setIsMenuOpen(false); handleArchiveChar(); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-yellow-500 hover:bg-yellow-500/10 transition-all flex items-center gap-2 border-b border-[#1a1a1a]">
                                <span className="material-symbols-outlined text-sm">{character.archived ? 'unarchive' : 'inventory_2'}</span> 
                                {character.archived ? 'Desarquivar' : 'Arquivar'}
                              </button>
                              <button onClick={() => { setIsMenuOpen(false); handleDeleteChar(); }} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">delete_forever</span> Excluir
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
          
          {/* Sidebar / Stats */}
          <div className="w-full lg:w-80 border-r-4 border-[#1a1a1a] bg-black/20 p-8 space-y-10 overflow-y-auto custom-scrollbar">
             <div>
                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                   <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Esquadrões Vinculados</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {details?.groups && details.groups.length > 0 ? (
                    details.groups.map(g => (
                      <span key={g.id} className="text-[9px] font-black bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-sm uppercase tracking-wider">
                        {g.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[9px] font-black text-zinc-700 italic uppercase tracking-wider py-1">
                      Nenhum Esquadrão Vinculado
                    </span>
                  )}
                </div>
             </div>

             <div>
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-6 border-b border-white/5 pb-2">Atividade_em_Campo</h3>
                <div className="grid grid-cols-2 gap-4">
                   <StatBox label="Tempo_Escuta" value={formatSecs(details?.stats?.totalListenTime || 0)} />
                   <StatBox label="Fidget_Log" value={details?.stats?.fidgetClicks || 0} />
                   <StatBox label="Screw_Log" value={details?.stats?.screwClicks || 0} />
                   <StatBox label="Pico_Volume" value={formatSecs(details?.stats?.maxVolumeTime || 0)} />
                </div>
             </div>

             <div>
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-2">
                   <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Medalhas_Detectadas</h3>
                   <div className="relative">
                     <button onClick={() => setShowAchievementSelect(!showAchievementSelect)} className="text-[9px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-2 py-1 rounded-sm uppercase font-black transition-all">OUTORGAR_MEDALHA</button>
                     {showAchievementSelect && (
                       <>
                         <div className="fixed inset-0 z-40" onClick={() => setShowAchievementSelect(false)} />
                         <div className="absolute top-full right-0 mt-2 bg-black border-2 border-[#1a1a1a] shadow-xl rounded-sm w-56 z-50 max-h-64 overflow-y-auto custom-scrollbar">
                           {ALL_ACHIEVEMENTS.filter(a => !details?.achievements.includes(a.id)).map(a => (
                             <button key={a.id} onClick={() => handleGrantAchievement(a.id)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3 border-b border-[#1a1a1a]">
                               <span className="text-sm grayscale">{a.icon}</span> <span className="truncate">{a.title}</span>
                             </button>
                           ))}
                         </div>
                       </>
                     )}
                   </div>
                </div>
                <div className="space-y-3">
                   {details?.achievements && details.achievements.length > 0 ? (
                     details.achievements.map(achId => {
                       const achDef = ALL_ACHIEVEMENTS.find(a => a.id === achId);
                       return (
                         <div key={achId} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-sm group hover:border-primary/20 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-8 h-8 bg-primary/10 text-primary flex items-center justify-center rounded-full border border-primary/20 shadow-lg text-lg">
                                 {achDef?.icon || <span className="material-symbols-outlined text-[18px]">workspace_premium</span>}
                              </div>
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-primary transition-colors">{achDef?.title || achId}</span>
                            </div>
                            <button onClick={() => handleRevokeAchievement(achId)} className="p-1.5 text-zinc-800 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all opacity-0 group-hover:opacity-100">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                         </div>
                       );
                     })
                   ) : (
                     <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-sm opacity-20">
                        <p className="text-[9px] font-black uppercase tracking-widest">Nenhuma_Medalha</p>
                     </div>
                   )}
                </div>
             </div>

             <div className="pt-6">
                <button 
                  onClick={() => setShowGrantModal(true)}
                  className="w-full py-4 bg-primary/5 text-primary border-2 border-primary/20 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-primary hover:text-black transition-all flex items-center justify-center gap-3 rounded-sm active:scale-95 shadow-lg"
                >
                  <span className="material-symbols-outlined text-sm">add_box</span> LIBERAR_INTEL
                </button>
             </div>
          </div>

          {/* Main Inventory Grid */}
          <div className="flex-1 bg-black/40 p-8 overflow-y-auto custom-scrollbar">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                   <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Cofre_de_Evidências</h3>
                </div>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Registros_Totais: {details?.intel.length}</span>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {details?.intel.map(t => {
                  const intel = intelRegistry.get(t.id);
                  const audio = allAudios.find(a => a.id === t.id);
                  const label = intel?.title || audio?.title || audio?.originalName || t.id;
                  const type = intel ? intel.type : 'AUDIO';
                  const plays = details?.playCounts.find(pc => pc.tapeId === t.id)?.count || 0;
                  return (
                    <div key={t.id} className="group relative bg-[#1a1a1a] border-4 border-[#1a1a1a] p-6 hover:border-primary/30 transition-all rounded-xl shadow-xl overflow-hidden active:scale-98">
                       <div className="absolute top-0 right-0 w-10 h-10 bg-primary/5 rotate-45 translate-x-5 -translate-y-5 border-b border-primary/10" />
                       <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 rounded-sm bg-black border border-white/5 text-xs transition-all group-hover:border-primary/20 ${
                            type === 'AUDIO' ? 'text-amber-500' :
                            type === 'VISUAL' ? 'text-cyan-500' :
                            type === 'TEXT' ? 'text-emerald-500' : 'text-primary'
                          }`}>
                             <span className="material-symbols-outlined text-[20px]">
                               {type === 'AUDIO' ? 'album' : 
                                type === 'VISUAL' ? 'photo_library' : 
                                type === 'TEXT' ? 'description' : 'shield'}
                             </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {plays > 0 && (
                               <div className="bg-black/60 px-2 py-1 rounded-sm border border-white/5 flex items-center gap-1.5">
                                 <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" />
                                 <span className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Plays: {plays}</span>
                               </div>
                            )}
                            <button 
                              onClick={() => handleRemoveIntel(t.id)}
                              className="p-1.5 text-zinc-800 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                       </div>
                       <h4 className="text-[12px] font-black text-white uppercase truncate mb-1 group-hover:text-primary transition-colors">{label}</h4>
                       <p className="font-mono text-[9px] text-zinc-600 font-bold uppercase truncate mb-4">ID: {t.id}</p>
                       <div className="flex justify-between items-center text-[9px] font-black text-zinc-500 uppercase tracking-widest border-t border-white/5 pt-4">
                          <span className="truncate max-w-[120px]">{intel?.metadata?.npc || audio?.artist || 'SISTEMA'}</span>
                          <span className="text-primary/40">LVL_{intel?.level || 1}</span>
                       </div>
                    </div>
                  );
                })}

                {details?.intel.length === 0 && (
                  <div className="col-span-full p-32 text-center border-4 border-dashed border-[#1a1a1a] rounded-2xl opacity-20 flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-6xl mb-4">folder_off</span>
                    <p className="text-[12px] font-black uppercase tracking-[0.4em]">Inventário_Inativo</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Modals */}
        {showGrantModal && (
          <IntelDistributionDrawer
            uid={uid}
            character={character}
            campaignId={character.campaignId}
            existingItemIds={new Set(details?.intel.map(t => t.id) || [])}
            onClose={() => setShowGrantModal(false)}
            onSuccess={loadDetails}
          />
        )}
        
        {showTransferModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
            <div className="bg-[#1a1a1a] border-4 border-[#333] p-8 w-full max-w-md rounded-xl shadow-2xl relative">
              <h3 className="font-black text-lg text-white uppercase tracking-widest mb-6">Transferir Personagem</h3>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-6 leading-relaxed">Selecione a nova conta mestre que assumirá o controle de {character.codinome}.</p>
              
              <select 
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                className="w-full bg-black border-2 border-[#333] text-[11px] font-black text-white p-4 outline-none uppercase rounded-sm focus:border-primary mb-8"
              >
                <option value="">-- SELECIONE A CONTA DESTINO --</option>
                {allAccounts.map(a => (
                  <option key={a.uid} value={a.uid}>{a.masterName || a.email} ({a.uid.slice(0,6)})</option>
                ))}
              </select>

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowTransferModal(false)} className="px-6 py-3 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors">Cancelar</button>
                <button 
                  onClick={handleConfirmTransfer} 
                  disabled={!transferTarget || saveLoading}
                  className="bg-primary text-black px-8 py-3 rounded-sm font-black text-[10px] tracking-widest uppercase hover:bg-primary-container transition-all active:scale-95 disabled:opacity-50"
                >
                  Confirmar Transferência
                </button>
              </div>
            </div>
          </div>
        )}

        {modal}
      </motion.div>
    </div>,
    document.body
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-black/60 border border-white/5 p-4 flex flex-col justify-center rounded-sm shadow-inner group hover:border-primary/20 transition-all">
      <span className="text-[8px] uppercase tracking-widest text-zinc-600 mb-2 font-black">{label}</span>
      <span className="font-black text-sm text-zinc-300 group-hover:text-primary transition-colors">{value}</span>
    </div>
  );
}

function formatSecs(secs: number) {
  if (!secs) return '0s';
  if (secs < 60) return `${Math.floor(secs)}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${(mins / 60).toFixed(1)}h`;
}
