import React from 'react';
import { Campaign } from '../../../data/campaigns';
import { Group, MasterAccount, CharacterData } from '../../../types/player';
import { campaignAdminService } from '../../../services/CampaignAdminService';

interface MissionAccessTabProps {
  campaign: Campaign;
  groups: Group[];
  allCharacters: { account: MasterAccount; character: CharacterData }[];
  onCharacterAssigned?: (uid: string, charId: string, campaignId: string) => void;
  onCharacterUnassigned?: (uid: string, charId: string) => void;
  showAlert: (title: string, message: string) => void;
}

export default function MissionAccessTab({
  campaign,
  groups,
  allCharacters,
  onCharacterAssigned,
  onCharacterUnassigned,
  showAlert,
}: MissionAccessTabProps) {
  const handleUnlockForGroup = async (groupId: string, unlock: boolean) => {
    try {
      await campaignAdminService.unlockForGroup(groupId, campaign.id, unlock);
      showAlert('Sucesso', unlock ? 'Missão desbloqueada para o esquadrão.' : 'Acesso removido.');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha ao gerenciar acesso.');
    }
  };

  const handleUnlockForCharacter = async (uid: string, charId: string, unlock: boolean) => {
    try {
      await campaignAdminService.unlockForCharacter(uid, charId, campaign.id, unlock);
      showAlert('Sucesso', unlock ? 'Missão desbloqueada para o agente.' : 'Acesso removido.');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha ao gerenciar acesso.');
    }
  };

  const handleAssignGroup = async (groupId: string) => {
    try {
      await campaignAdminService.assignToGroup(groupId, campaign.id);
      showAlert('Sucesso', 'Esquadrão enviado para a missão (Ativa).');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha na atribuição.');
    }
  };

  const handleAssignCharacter = async (uid: string, charId: string) => {
    try {
      await campaignAdminService.assignToCharacter(uid, charId, campaign.id);
      onCharacterAssigned?.(uid, charId, campaign.id);
      showAlert('Sucesso', 'Agente enviado para a missão (Ativa).');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha na atribuição.');
    }
  };

  const handleUnassignGroup = async (groupId: string) => {
    try {
      await campaignAdminService.unassignFromGroup(groupId);
      showAlert('Sucesso', 'Esquadrão removido do campo.');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha ao remover designação.');
    }
  };

  const handleUnassignCharacter = async (uid: string, charId: string) => {
    try {
      await campaignAdminService.unassignFromCharacter(uid, charId);
      onCharacterUnassigned?.(uid, charId);
      showAlert('Sucesso', 'Agente removido do campo.');
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha ao remover designação.');
    }
  };

  return (
    <div className="space-y-8">
      <p className="text-[9px] font-display font-bold text-industrial-silver/30 uppercase tracking-widest border border-white/5 bg-black/20 px-4 py-3 rounded-sm">
        Lista limitada aos 50 agentes mais recentes. Use a aba Jogadores para buscas avançadas.
      </p>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/5" />
        <span className="text-[9px] font-display font-bold text-industrial-silver/20 uppercase tracking-[0.3em]">
          Vínculos de Rede
        </span>
        <div className="h-px flex-1 bg-white/5" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[8px] text-industrial-silver/30 font-display font-bold uppercase tracking-widest">
            Autorizar Missão para Esquadrão
          </p>
          <select
            className="w-full bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold text-primary p-3 outline-none rounded-sm focus:border-primary/40 transition-all appearance-none cursor-pointer shadow-inner"
            onChange={(e) => e.target.value && handleUnlockForGroup(e.target.value, true)}
            value=""
          >
            <option value="">Autorizar para Esquadrão...</option>
            {groups
              .filter((g) => !(g.unlockedCampaigns || []).includes(campaign.id))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <p className="text-[8px] text-industrial-silver/30 font-display font-bold uppercase tracking-widest">
            Autorizar Missão para Agente
          </p>
          <select
            className="w-full bg-surface-container-lowest border border-white/5 text-[10px] font-display font-bold text-primary p-3 outline-none rounded-sm focus:border-primary/40 transition-all appearance-none cursor-pointer shadow-inner"
            onChange={(e) => {
              if (!e.target.value) return;
              const [uid, charId] = e.target.value.split('|');
              handleUnlockForCharacter(uid, charId, true);
            }}
            value=""
          >
            <option value="">Autorizar para Agente...</option>
            {allCharacters
              .filter((c) => !(c.character.unlockedCampaigns || []).includes(campaign.id))
              .map((c) => (
                <option
                  key={`${c.account.uid}_${c.character.id}`}
                  value={`${c.account.uid}|${c.character.id}`}
                >
                  {c.character.codinome}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[8px] text-industrial-silver/30 font-display font-bold uppercase tracking-widest border-b border-white/5 pb-2">
          Acessos Autorizados (Quem tem acesso)
        </p>
        <div className="flex flex-wrap gap-2">
          {groups
            .filter((g) => (g.unlockedCampaigns || []).includes(campaign.id))
            .map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-sm pr-1"
              >
                <span className="text-[9px] font-display font-bold text-primary/80 px-2 py-1 uppercase tracking-wider">
                  ESQ: {g.name}
                </span>
                <button
                  onClick={() => handleUnlockForGroup(g.id, false)}
                  className="p-1 text-primary/40 hover:text-red-500 material-symbols-outlined text-xs"
                >
                  close
                </button>
              </div>
            ))}
          {allCharacters
            .filter((c) => (c.character.unlockedCampaigns || []).includes(campaign.id))
            .map((c) => (
              <div
                key={c.character.id}
                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-sm pr-1"
              >
                <span className="text-[9px] font-display font-bold text-industrial-silver/60 px-2 py-1 uppercase tracking-wider">
                  AGT: {c.character.codinome}
                </span>
                <button
                  onClick={() =>
                    handleUnlockForCharacter(c.account.uid, c.character.id, false)
                  }
                  className="p-1 text-white/20 hover:text-red-500 material-symbols-outlined text-xs"
                >
                  close
                </button>
              </div>
            ))}
          {groups.filter((g) => (g.unlockedCampaigns || []).includes(campaign.id)).length === 0 &&
            allCharacters.filter((c) =>
              (c.character.unlockedCampaigns || []).includes(campaign.id)
            ).length === 0 && (
              <p className="text-[9px] text-industrial-silver/30 uppercase tracking-widest">
                Nenhum acesso autorizado
              </p>
            )}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[8px] text-emerald-500/50 font-display font-bold uppercase tracking-widest border-b border-emerald-500/10 pb-2">
          Missão Ativa (Em Campo)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <select
            className="w-full bg-emerald-500/5 border border-emerald-500/20 text-[10px] font-display font-bold text-emerald-500 p-3 outline-none rounded-sm focus:border-emerald-500/40 transition-all appearance-none cursor-pointer"
            onChange={(e) => e.target.value && handleAssignGroup(e.target.value)}
            value=""
          >
            <option value="">Designar Esquadrão para Campo...</option>
            {groups
              .filter((g) => g.campaignId !== campaign.id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
          <select
            className="w-full bg-emerald-500/5 border border-emerald-500/20 text-[10px] font-display font-bold text-emerald-500 p-3 outline-none rounded-sm focus:border-emerald-500/40 transition-all appearance-none cursor-pointer"
            onChange={(e) => {
              if (!e.target.value) return;
              const [uid, charId] = e.target.value.split('|');
              handleAssignCharacter(uid, charId);
            }}
            value=""
          >
            <option value="">Designar Agente para Campo...</option>
            {allCharacters
              .filter((c) => c.character.campaignId !== campaign.id)
              .map((c) => (
                <option
                  key={`${c.account.uid}_${c.character.id}`}
                  value={`${c.account.uid}|${c.character.id}`}
                >
                  {c.character.codinome}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {groups
            .filter((g) => g.campaignId === campaign.id)
            .map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-sm pr-1 animate-pulse"
              >
                <span className="text-[9px] font-display font-bold px-3 py-1 uppercase tracking-wider">
                  OPERANDO: {g.name}
                </span>
                <button
                  onClick={() => handleUnassignGroup(g.id)}
                  className="p-1 text-emerald-500/40 hover:text-red-500 material-symbols-outlined text-xs"
                  title="Remover do campo"
                >
                  close
                </button>
              </div>
            ))}
          {allCharacters
            .filter((c) => c.character.campaignId === campaign.id)
            .map((c) => (
              <div
                key={c.character.id}
                className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-sm pr-1 animate-pulse"
              >
                <span className="text-[9px] font-display font-bold px-3 py-1 uppercase tracking-wider">
                  OPERANDO: {c.character.codinome}
                </span>
                <button
                  onClick={() => handleUnassignCharacter(c.account.uid, c.character.id)}
                  className="p-1 text-emerald-500/40 hover:text-red-500 material-symbols-outlined text-xs"
                  title="Remover do campo"
                >
                  close
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
