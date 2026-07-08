import React, { useMemo, useState } from 'react';
import { Campaign } from '../../../data/campaigns';
import { Group, CharacterData, MasterAccount } from '../../../types/player';
import IntelDistributionDrawer from '../IntelDistributionDrawer';

interface MissionVideoTabProps {
  campaign: Campaign;
  groups: Group[];
  allCharacters: { account: MasterAccount; character: CharacterData }[];
}

export default function MissionVideoTab({
  campaign,
  groups,
  allCharacters,
}: MissionVideoTabProps) {
  const [showBroadcastDrawer, setShowBroadcastDrawer] = useState(false);

  const campaignCharacters = useMemo(() => {
    return allCharacters.filter(({ character }) => {
      if (character.campaignId === campaign.id) return true;
      return groups.some(
        (g) =>
          g.campaignId === campaign.id &&
          g.characterSlots?.some((slot) => slot.characterId === character.id)
      );
    });
  }, [allCharacters, groups, campaign.id]);

  const broadcastTargets = useMemo(
    () =>
      campaignCharacters.map(({ account, character }) => ({
        uid: account.uid,
        characterId: character.id,
      })),
    [campaignCharacters]
  );

  return (
    <div className="space-y-8">
      <div className="border border-white/10 bg-black/30 p-6 rounded-sm">
        <h4 className="text-[11px] font-display font-bold uppercase tracking-[0.2em] text-primary mb-2">
          Transmissão Remota de Vídeo
        </h4>
        <p className="text-[11px] text-industrial-silver/50 leading-relaxed max-w-2xl mb-6">
          Selecione um coletável de vídeo (VHS/DVD) e dispare a reprodução na tela dos Nokia dos
          agentes vinculados a esta missão. O mesmo fluxo unificado de distribuição de Intel é usado
          aqui, com opção de desbloqueio automático.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-[10px] text-industrial-silver/40 uppercase tracking-widest">
            Destino: <span className="text-primary font-bold">{campaignCharacters.length}</span>{' '}
            agente(s) vinculado(s)
          </div>
          <button
            type="button"
            disabled={campaignCharacters.length === 0}
            onClick={() => setShowBroadcastDrawer(true)}
            className="inline-flex items-center justify-center gap-2 py-4 px-8 bg-primary text-black font-display font-black uppercase tracking-[0.2em] text-[11px] hover:bg-primary/90 transition-all disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">cast</span>
            Abrir Transmissão
          </button>
        </div>

        {campaignCharacters.length === 0 && (
          <p className="text-[10px] text-industrial-silver/30 mt-4 uppercase tracking-widest">
            Designe agentes ou esquadrões na aba Vínculos antes de transmitir.
          </p>
        )}
      </div>

      {showBroadcastDrawer && (
        <IntelDistributionDrawer
          broadcastMode
          campaignId={campaign.id}
          targets={broadcastTargets}
          title="Transmissão de Vídeo — Missão"
          onClose={() => setShowBroadcastDrawer(false)}
          onSuccess={() => setShowBroadcastDrawer(false)}
        />
      )}
    </div>
  );
}
