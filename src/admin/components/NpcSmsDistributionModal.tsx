import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Group, CharacterData } from '../../types/player';
import { groupService } from '../../services/GroupService';
import { npcMessages, NpcSmsDialogue } from '../../data/npcMessages';
import { activityLogger } from '../../services/ActivityLogger';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';

interface NpcSmsDistributionModalProps {
  group: Group;
  allCharacters: { uid: string; char: CharacterData }[];
  onClose: () => void;
  onSuccess: () => void;
}

interface SmsAssignment {
  characterId: string;
  characterName: string;
  characterUid: string;
  characterPhoneNumber: string;
  npcId: string;
  npcName: string;
  dialogue: NpcSmsDialogue;
}

export default function NpcSmsDistributionModal({ group, allCharacters, onClose, onSuccess }: NpcSmsDistributionModalProps) {
  const [selectedNpc, setSelectedNpc] = useState<string>('all');
  const [assignments, setAssignments] = useState<SmsAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Get active characters in this group
  const groupCharacters = useMemo(() => {
    const slots = group.characterSlots || [];
    return slots.map(slot => {
      const found = allCharacters.find(c => c.uid === slot.uid && c.char.id === slot.characterId);
      return found ? { uid: slot.uid, char: found.char } : null;
    }).filter((c): c is { uid: string; char: CharacterData } => c !== null);
  }, [group.characterSlots, allCharacters]);

  // List of unique NPCs from npcMessages
  const npcList = useMemo(() => {
    return [
      { id: 'NIL_ECHO', name: 'Nil' },
      { id: 'MAI_ARCHIVE', name: 'Mai' },
      { id: 'JADEN', name: 'Jaden' },
      { id: 'JOE_AMPED', name: 'Joe' },
      { id: 'BIGMOUTH_BOCAO', name: 'Bocão' }
    ];
  }, []);

  // Utility to shuffle an array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Generate random assignments
  const generateAssignments = () => {
    if (groupCharacters.length === 0) {
      setAssignments([]);
      return;
    }

    const npcsToDistribute = selectedNpc === 'all' 
      ? npcList.map(n => n.id)
      : [selectedNpc];

    const newAssignments: SmsAssignment[] = [];

    for (const npcId of npcsToDistribute) {
      const dialogues = npcMessages[npcId] || [];
      if (dialogues.length === 0) continue;

      // Shuffle dialogues for this NPC
      const shuffledDialogues = shuffleArray(dialogues);
      
      // Assign unique dialogues to each group member (looping around if chars > dialogues)
      groupCharacters.forEach((member, index) => {
        const dialogue = shuffledDialogues[index % shuffledDialogues.length];
        const npcName = dialogue.npcName;

        newAssignments.push({
          characterId: member.char.id,
          characterName: member.char.codinome,
          characterUid: member.uid,
          characterPhoneNumber: member.char.phoneNumber || '(Sem Telefone)',
          npcId,
          npcName,
          dialogue
        });
      });
    }

    setAssignments(newAssignments);
  };

  // Generate assignments whenever NPC selection or group characters change
  useEffect(() => {
    generateAssignments();
  }, [selectedNpc, groupCharacters]);

  const handleDistribute = async () => {
    if (assignments.length === 0) return;
    setLoading(true);
    try {
      // Send each assigned dialogue to Firestore
      for (const assignment of assignments) {
        await groupService.sendNpcDialogueToCharacter(
          group.id,
          assignment.characterId,
          assignment.characterName,
          assignment.characterPhoneNumber,
          assignment.dialogue
        );
      }

      setFeedback(`✓ Torpedos de SMS enviados com sucesso.`);
      activityLogger.logAdmin(
        'gm.mpg',
        'npc_sms_distributed',
        `Distribuição de torpedos para o grupo ${group.name}: ${assignments.length} diálogos distribuídos.`
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Erro na distribuição de SMS:", error);
      setFeedback('ERRO: Falha ao distribuir mensagens.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OverlayPortal open onClose={loading ? undefined : onClose}>
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => { if (!loading) onClose(); }}>
      <motion.div 
        initial={{ x: '100%' }} 
        animate={{ x: 0 }} 
        exit={{ x: '100%' }} 
        transition={{ type: 'spring', stiffness: 300, damping: 30 }} 
        className="bg-[#222] border-l-8 border-[#1a1a1a] w-full max-w-2xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra" 
        onClick={e => e.stopPropagation()}
      >
        <Screw className="top-4 left-4" />
        <Screw className="top-4 right-4 -rotate-90" />
        <Screw className="bottom-4 left-4 -rotate-90" />
        <Screw className="bottom-4 right-4" />
        <div className="noise-overlay" />
        <div className="scanlines" />
        
        {/* Header */}
        <div className="p-8 border-b-4 border-[#1a1a1a] bg-black/40 relative z-10 flex justify-between items-center">
          <div>
            <h3 className="font-black text-xl text-white uppercase tracking-widest">Enviar_SMS_de_NPCs</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Grupo: <span className="text-primary">{group.name}</span></p>
          </div>
          <button onClick={onClose} disabled={loading} className="p-2 text-zinc-600 hover:text-white transition-all material-symbols-outlined rounded-sm">close</button>
        </div>
        
        {/* NPC Filter Tab */}
        <div className="flex flex-wrap border-b-2 border-[#1a1a1a] bg-black/20 relative z-10 shrink-0">
          <button 
            onClick={() => setSelectedNpc('all')} 
            className={`flex-1 min-w-[80px] py-4 text-[9px] font-black uppercase tracking-widest transition-all ${selectedNpc === 'all' ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            [ TODOS ]
          </button>
          {npcList.map(npc => (
            <button 
              key={npc.id} 
              onClick={() => setSelectedNpc(npc.id)} 
              className={`flex-1 min-w-[80px] py-4 text-[9px] font-black uppercase tracking-widest transition-all ${selectedNpc === npc.id ? 'text-primary bg-primary/10 border-b-2 border-primary' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              {npc.name}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-black/10 relative z-10 custom-scrollbar flex flex-col gap-4">
          
          {groupCharacters.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-[#333] rounded-sm text-zinc-600 uppercase tracking-widest font-black text-xs">
              <span className="material-symbols-outlined text-4xl block mb-2">person_off</span>
              Nenhum agente vinculado a este grupo
            </div>
          ) : (
            <>
              {/* Header section with Reshuffle */}
              <div className="flex justify-between items-center bg-[#1a1a1a] border border-[#333] px-4 py-3 rounded-sm">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  Preview de Distribuição Aleatória
                </span>
                <button 
                  onClick={generateAssignments} 
                  disabled={loading}
                  className="flex items-center gap-1.5 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20 bg-primary/5 hover:bg-primary/15 px-3 py-1.5 rounded-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[12px]">shuffle</span>
                  Embaralhar Novamente
                </button>
              </div>

              {/* Assignment Previews */}
              <div className="space-y-2">
                {assignments.map((asg, idx) => (
                  <div 
                    key={`${asg.npcId}_${asg.characterId}_${idx}`} 
                    className="bg-[#181818] border border-[#2d2d2d] p-4 rounded-sm flex items-center justify-between group hover:border-[#444] transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-sm font-bold uppercase">
                          NPC: {asg.npcName}
                        </span>
                        <span className="material-symbols-outlined text-zinc-600 text-xs">arrow_forward</span>
                        <span className="text-[10px] font-black text-primary uppercase">
                          {asg.characterName}
                        </span>
                      </div>
                      <h4 className="text-[11px] font-bold text-white uppercase mt-2 tracking-wide truncate">
                        {asg.dialogue.title}
                      </h4>
                      <p className="text-[9px] text-zinc-500 line-clamp-1 italic mt-1">
                        "{asg.dialogue.messages[0]?.text || ''}"
                      </p>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <span className="text-[9px] text-zinc-600 font-bold font-mono">
                        {asg.dialogue.messages.length} SMS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-8 border-t-4 border-[#1a1a1a] flex flex-col sm:flex-row justify-between items-center bg-black/40 gap-6 relative z-10 shrink-0">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            {assignments.length} Diálogos vinculados ({groupCharacters.length} agentes)
          </span>
          <div className="flex gap-4 w-full sm:w-auto">
            <button onClick={onClose} disabled={loading} className="flex-1 sm:flex-none px-6 py-4 text-[10px] font-black text-zinc-600 hover:text-white transition-colors uppercase tracking-widest disabled:opacity-50">
              CANCELAR
            </button>
            <button 
              onClick={handleDistribute} 
              disabled={assignments.length === 0 || loading} 
              className="flex-2 sm:flex-none bg-primary text-black px-10 py-4 rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-primary-container transition-all active:scale-95 disabled:opacity-20 glow-orange shadow-lg"
            >
              {loading ? 'ENVIANDO...' : 'DISTRIBUIR_SMS'}
            </button>
          </div>
        </div>

        {/* Toast feedback */}
        {feedback && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm border px-6 py-3 rounded-full text-[10px] font-black uppercase z-50 flex items-center gap-2 shadow-lg ${feedback.startsWith('ERRO') ? 'border-red-500/50 text-red-400' : 'border-emerald-500/50 text-emerald-400'}`}>
            <span className="material-symbols-outlined text-sm">{feedback.startsWith('ERRO') ? 'error' : 'check_circle'}</span> 
            {feedback}
          </div>
        )}
      </motion.div>
    </div>
    </OverlayPortal>
  );
}
