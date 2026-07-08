import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Shield, User, ChevronRight, AlertCircle, Skull, Search, LogOut } from 'lucide-react';
import { fetchCharacters, createCharacter } from '../store/firestore';
import { userService } from '../services/UserService';
import type { CharacterData, MasterAccount } from '../types/player';
import RetroLoading from './player/RetroLoading';
import RetroSpinner from './player/RetroSpinner';

interface CharacterSelectionScreenProps {
  account: MasterAccount;
  onSelect: (character: CharacterData) => Promise<void>;
  onLogout?: () => void;
}

export default function CharacterSelectionScreen({ account, onSelect, onLogout }: CharacterSelectionScreenProps) {
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCodinome, setNewCodinome] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Master Name / Display Name Flow
  const [showMasterNamePrompt, setShowMasterNamePrompt] = useState(!account.displayName && !account.masterName);
  const [newMasterName, setNewMasterName] = useState('');
  const [savingMasterName, setSavingMasterName] = useState(false);

  const handleSaveMasterName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterName.trim() || savingMasterName) return;
    setSavingMasterName(true);
    try {
      await userService.updateMasterAccount(account.uid, { displayName: newMasterName.trim() });
      account.displayName = newMasterName.trim(); // Local update
      setShowMasterNamePrompt(false);
    } catch (err) {
      console.error("Failed to save display name:", err);
    } finally {
      setSavingMasterName(false);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, [account.uid]);

  const loadCharacters = async () => {
    try {
      const list = await fetchCharacters(account.uid);
      setCharacters(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodinome.trim() || creating) return;
    setCreating(true);
    try {
      const char = await createCharacter(account.uid, newCodinome.trim());
      setCharacters([char, ...characters]);
      setIsCreating(false);
      setNewCodinome('');
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = async (char: CharacterData) => {
    if (selectedCharId) return;
    setSelectedCharId(char.id);
    setErrorMsg(null);
    try {
      await onSelect(char);
    } catch (err) {
      setErrorMsg('Falha ao sincronizar agente. Tente novamente.');
      setSelectedCharId(null);
    }
  };

  if (loading) {
    return <RetroLoading message="Acessando Banco de Dados..." subMessage="Recuperando registros de agentes da conta mestra" />;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 relative overflow-hidden bg-surface">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl z-10">
        <header className="mb-8 border-b-2 border-primary/30 pb-6 flex justify-between items-end">
          <div>
            <h1 className="font-display text-4xl font-bold text-white uppercase tracking-tighter">
              Seleção de <span className="text-primary">Agente</span>
            </h1>
            <p className="text-[10px] font-display uppercase tracking-[0.2em] text-industrial-silver/50 mt-1">
              Operador: {account.displayName || account.masterName || account.email} // Registros: {characters.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onLogout} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 w-10 h-10 rounded-sm flex items-center justify-center transition-all active:scale-95" title="Sair da Conta">
              <LogOut size={16} />
            </button>
            <button onClick={() => setIsCreating(true)} className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-sm text-[10px] font-display font-bold uppercase tracking-widest transition-all flex items-center gap-2 group active:scale-95">
              <UserPlus size={14} className="group-hover:scale-110 transition-transform" /> Recrutar Novo
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="mb-4 bg-red-950/30 border border-red-500/50 p-3 flex items-center gap-3 text-red-500 animate-pulse">
            <AlertCircle size={18} />
            <span className="font-display text-xs uppercase tracking-widest">{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {characters.map((char, i) => (
              <motion.div key={char.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                onClick={() => handleSelect(char)}
                className="bg-surface-container-low border-2 border-industrial-silver/10 hover:border-primary/50 p-5 cursor-pointer transition-all group relative overflow-hidden"
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`w-16 h-16 rounded-xl overflow-hidden bg-surface-container-high border-2 ${char.agentStatus === 'morto' ? 'border-red-500/50' : 'border-industrial-silver/20'} flex items-center justify-center`}>
                    {char.profilePhotoUrl ? (
                      <img src={char.profilePhotoUrl} alt={char.codinome} className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-industrial-silver/30" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-xl font-bold text-white uppercase tracking-wider group-hover:text-primary transition-colors">
                      {char.codinome}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${char.agentStatus === 'vivo' ? 'bg-green-500 animate-pulse' : char.agentStatus === 'morto' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className={`text-[9px] font-display font-bold uppercase tracking-widest ${char.agentStatus === 'vivo' ? 'text-green-500' : char.agentStatus === 'morto' ? 'text-red-500' : 'text-yellow-500'}`}>
                          {char.agentStatus}
                        </span>
                      </div>
                      {char.agentId && <span className="text-[9px] font-mono text-industrial-silver/40">RM-{char.agentId}</span>}
                    </div>
                  </div>
                  {selectedCharId === char.id ? (
                    <RetroSpinner size="sm" className="text-primary" />
                  ) : (
                    <ChevronRight size={20} className="text-industrial-silver/20 group-hover:text-primary transition-all group-hover:translate-x-1" />
                  )}
                </div>

                {/* Status-specific overlays */}
                {char.agentStatus === 'morto' && (
                  <div className="absolute inset-0 bg-red-950/10 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Skull className="text-red-500/20 w-24 h-24 rotate-12" />
                  </div>
                )}
                
                {/* Danger Level indicator */}
                <div className="absolute top-2 right-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className={`w-1 h-3 rounded-full ${idx < char.dangerLevel ? 'bg-primary/40' : 'bg-industrial-silver/5'}`} />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {characters.length === 0 && !isCreating && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-industrial-silver/10 rounded-xl opacity-40">
              <Search size={48} className="mb-4" />
              <p className="font-display text-sm uppercase tracking-[0.2em]">Nenhum agente registrado neste nó.</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Create New Character Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md bg-surface-container-low border-2 border-primary/30 p-8 shadow-2xl relative">
              <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
                PROTOCOLO-RECRUTAMENTO
              </div>
              <h2 className="font-display text-2xl font-bold text-white uppercase tracking-tight mb-6">
                Novo <span className="text-primary">Recruta</span>
              </h2>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="group">
                  <label className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] mb-2 text-industrial-silver/60 group-focus-within:text-primary transition-colors">
                    Codinome do Agente
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-primary transition-colors">
                      <Shield size={16} />
                    </div>
                    <input type="text" autoFocus required value={newCodinome} onChange={e => setNewCodinome(e.target.value)}
                      placeholder="EX: PHANTOM-84"
                      className="w-full bg-surface-container-lowest border-none py-4 pl-12 pr-4 text-white font-sans text-base tracking-wide focus:ring-0 placeholder:text-industrial-silver/20 outline-none uppercase" />
                    <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                </div>
                
                <div className="bg-primary/5 border-l-2 border-primary/30 p-4 flex gap-3">
                  <AlertCircle size={18} className="text-primary shrink-0" />
                  <p className="text-[10px] font-display text-industrial-silver/70 leading-relaxed uppercase tracking-wider">
                    Aviso: Uma vez registrado na rede, o codinome se torna sua identidade primária. O progresso será isolado de outros agentes.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-4 text-[10px] font-display font-bold uppercase tracking-widest text-industrial-silver/50 hover:text-white transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating} className="flex-2 bg-primary hover:bg-primary-container text-black font-display font-bold text-xs uppercase tracking-[0.2em] py-4 px-8 transition-all flex items-center justify-center gap-3 disabled:opacity-50 glow-orange">
                    {creating ? <RetroSpinner size="sm" /> : 'Confirmar Registro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mandatory Master Name Modal */}
      <AnimatePresence>
        {showMasterNamePrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-md bg-surface-container-low border-2 border-primary/50 p-8 shadow-[0_0_50px_rgba(255,100,0,0.15)] relative">
              <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase animate-pulse">
                ATUALIZAÇÃO DE PROTOCOLO OBRIGATÓRIA
              </div>
              <h2 className="font-display text-2xl font-bold text-white uppercase tracking-tight mb-4 mt-2">
                Identificação <span className="text-primary">Mestra</span>
              </h2>
              <p className="text-xs font-mono text-industrial-silver/70 mb-8 leading-relaxed">
                Para facilitar o gerenciamento da rede, todos os operadores devem definir um <strong className="text-primary">Nome Geral</strong> para sua conta mestra. Este nome será sua identidade visual no sistema.
              </p>
              
              <form onSubmit={handleSaveMasterName} className="space-y-6">
                <div className="group">
                  <label className="block text-[10px] font-display font-bold uppercase tracking-[0.2em] mb-2 text-industrial-silver/60 group-focus-within:text-primary transition-colors">
                    Nome Geral de Exibição
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-industrial-silver/40 group-focus-within:text-primary transition-colors">
                      <User size={16} />
                    </div>
                    <input type="text" autoFocus required value={newMasterName} onChange={e => setNewMasterName(e.target.value)}
                      placeholder="Ex: João Silva ou Mestre123"
                      className="w-full bg-surface-container-lowest border-none py-4 pl-12 pr-4 text-white font-sans text-base tracking-wide focus:ring-0 placeholder:text-industrial-silver/20 outline-none" />
                    <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                </div>

                <button type="submit" disabled={savingMasterName} className="w-full bg-primary hover:bg-primary-container text-black font-display font-bold text-xs uppercase tracking-[0.2em] py-4 transition-all flex items-center justify-center gap-3 disabled:opacity-50 glow-orange">
                  {savingMasterName ? <RetroSpinner size="sm" /> : 'Confirmar Identificação'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="absolute bottom-8 left-12 right-12 flex justify-between items-center opacity-30 pointer-events-none">
        <div className="text-[10px] font-mono tracking-widest uppercase">Indústrias Smile // Divisão de Segurança</div>
        <div className="text-[10px] font-mono tracking-widest uppercase">Grid-Node: {account?.uid ? account.uid.slice(0, 8) : '--------'}</div>
      </footer>
    </div>
  );
}
