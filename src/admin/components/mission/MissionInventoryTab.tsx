import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { Campaign } from '../../../data/campaigns';
import { Group, CharacterData, MasterAccount } from '../../../types/player';
import { intelRegistry } from '../../../data/intel_registry';
import { intelService } from '../../../services/IntelService';
import { useModal } from '../ConfirmModal';
import RetroSpinner from '../../../components/player/RetroSpinner';
import IntelDistributionDrawer from '../IntelDistributionDrawer';
import { fetchAudioTapesByIds } from '../../../store/firestore';
import { intelTitleLabel } from '../../lib/entityLabels';

interface MissionInventoryTabProps {
  campaign: Campaign;
  groups: Group[];
  allCharacters: { account: MasterAccount; character: CharacterData }[];
}

export default function MissionInventoryTab({
  campaign,
  groups,
  allCharacters,
}: MissionInventoryTabProps) {
  const [loading, setLoading] = useState(true);
  const [characterInventories, setCharacterInventories] = useState<
    Record<string, { id: string; unlockedAt: unknown }[]>
  >({});
  const [showGrantModal, setShowGrantModal] = useState<{ charId: string; uid: string } | null>(
    null
  );
  const [remoteIntelTitles, setRemoteIntelTitles] = useState<Record<string, string>>({});

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

  const loadInventories = async () => {
    setLoading(true);

    try {
      const results = await Promise.all(
        campaignCharacters.map(async (item) => {
          try {
            const intelSnap = await getDocs(
              collection(db, 'users', item.account.uid, 'characters', item.character.id, 'intel')
            );
            const items = intelSnap.docs
              .map((d) => ({
                id: d.id,
                unlockedAt: d.data().unlockedAt,
                campaignId: d.data().campaignId,
              }))
              .filter((t) => !t.campaignId || t.campaignId === campaign.id);

            return { key: `${item.account.uid}_${item.character.id}`, items };
          } catch (err) {
            console.error('Error loading inventory for char', item.character.id, err);
            return { key: `${item.account.uid}_${item.character.id}`, items: [] };
          }
        })
      );

      const inventories: Record<string, { id: string; unlockedAt: unknown }[]> = {};
      results.forEach((res) => {
        inventories[res.key] = res.items;
      });

      setCharacterInventories(inventories);
    } catch (err) {
      console.error('Critical error in bulk loading inventories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventories();
  }, [campaign.id, campaignCharacters]);

  useEffect(() => {
    const unknownIds = new Set<string>();
    Object.values(characterInventories).forEach((items) => {
      items.forEach((t) => {
        if (!intelRegistry.get(t.id)) unknownIds.add(t.id);
      });
    });

    if (unknownIds.size === 0) {
      setRemoteIntelTitles({});
      return;
    }

    let cancelled = false;
    fetchAudioTapesByIds([...unknownIds]).then((results) => {
      if (cancelled) return;
      const titles: Record<string, string> = {};
      results.forEach((asset) => {
        if (!asset?.id) return;
        titles[asset.id] =
          asset.metadata?.title || asset.filename || asset.originalName || 'Intel desconhecido';
      });
      setRemoteIntelTitles(titles);
    });

    return () => {
      cancelled = true;
    };
  }, [characterInventories]);

  const { showConfirm, modal } = useModal();

  const handleExecuteBulk = async (selectedIds: Set<string>) => {
    if (!showGrantModal) return;
    await intelService.grantIntel(
      [{ uid: showGrantModal.uid, characterId: showGrantModal.charId }],
      [...selectedIds],
      { campaignId: campaign.id }
    );
  };

  const handleRevokeIntel = async (uid: string, charId: string, intelId: string) => {
    const ok = await showConfirm(
      'Revogar Evidência',
      'Remover este item do inventário do personagem para esta campanha?',
      'Remover'
    );
    if (!ok) return;
    try {
      await intelService.revokeIntel(uid, charId, intelId);
      await loadInventories();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 opacity-50">
        <RetroSpinner />
        <p className="text-[10px] font-display font-bold text-primary uppercase tracking-widest mt-4 animate-pulse">
          Analisando Datacrons...
        </p>
      </div>
    );
  }

  return (
    <>
      {modal}
      <div className="space-y-8">
        {campaignCharacters.length === 0 && (
          <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-sm opacity-30 flex flex-col items-center">
            <span className="material-symbols-outlined text-5xl text-industrial-silver/40 mb-4">
              person_off
            </span>
            <p className="text-[11px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">
              Nenhum Agente Vinculado a Esta Missão
            </p>
            <p className="text-[9px] text-industrial-silver/30 mt-2 uppercase tracking-widest">
              Designe agentes ou esquadrões na aba Vínculos
            </p>
          </div>
        )}

        {campaignCharacters.map(({ account, character }) => {
          const compositeKey = `${account.uid}_${character.id}`;
          const items = characterInventories[compositeKey] || [];
          return (
            <div
              key={compositeKey}
              className="bg-black/40 border border-white/5 rounded-sm p-6 group hover:border-primary/20 transition-all shadow-inner"
            >
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-sm bg-black border border-[#1a1a1a] flex items-center justify-center font-black text-sm ${
                      character.agentStatus === 'vivo' ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {(character.codinome || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-white uppercase tracking-wider">
                      {character.codinome}
                    </h4>
                    <p className="text-[9px] font-mono font-bold text-industrial-silver/40 uppercase tracking-widest mt-0.5">
                      Mestre: {account.masterName || account.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-display font-bold text-primary/40 uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-sm border border-primary/10">
                    {items.length} Itens
                  </span>
                  <button
                    onClick={() => setShowGrantModal({ charId: character.id, uid: account.uid })}
                    className="bg-primary/10 text-primary border border-primary/20 px-4 py-2 rounded-sm font-display font-bold text-[9px] tracking-widest uppercase hover:bg-primary hover:text-black transition-all active:scale-95 glow-orange flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">add</span> Conceder
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((t) => {
                  const intel = intelRegistry.get(t.id);
                  return (
                    <div
                      key={t.id}
                      className="bg-surface-container-lowest border border-white/5 p-4 rounded-sm relative group/item hover:border-primary/30 transition-all shadow-md"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div
                          className={`p-1.5 rounded-sm bg-black/40 border border-white/5 text-[10px] transition-all group-hover/item:border-primary/20 ${
                            intel?.type === 'AUDIO'
                              ? 'text-amber-500'
                              : intel?.type === 'VISUAL'
                                ? 'text-cyan-500'
                                : intel?.type === 'TEXT'
                                  ? 'text-emerald-500'
                                  : 'text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {intel?.type === 'AUDIO'
                              ? 'album'
                              : intel?.type === 'VISUAL'
                                ? 'photo_library'
                                : intel?.type === 'TEXT'
                                  ? 'description'
                                  : 'shield'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRevokeIntel(account.uid, character.id, t.id)}
                          className="text-industrial-silver/20 hover:text-red-500 transition-colors bg-black/40 p-1 rounded-sm border border-white/5 hover:border-red-500/30"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                      <p className="font-display font-bold text-[10px] text-white uppercase tracking-widest truncate group-hover/item:text-primary transition-colors">
                        {intelTitleLabel(t.id, Object.entries(remoteIntelTitles).map(([id, title]) => ({ id, title })))}
                      </p>
                      <p className="text-[8px] font-mono text-industrial-silver/40 uppercase mt-1 truncate">
                        {intel?.metadata?.npc || 'SISTEMA'}
                      </p>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="col-span-full py-6 text-center border border-dashed border-white/5 rounded-sm opacity-20">
                    <span className="text-[9px] font-display font-bold uppercase tracking-widest text-industrial-silver/40">
                      Inventário Vazio
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showGrantModal &&
        (() => {
          const char = allCharacters.find(
            (c) =>
              c.character.id === showGrantModal.charId && c.account.uid === showGrantModal.uid
          )?.character;
          if (!char) return null;
          const compositeKey = `${showGrantModal.uid}_${showGrantModal.charId}`;
          return (
            <IntelDistributionDrawer
              targets={[{ uid: showGrantModal.uid, characterId: showGrantModal.charId }]}
              character={char}
              campaignId={campaign.id}
              existingItemIds={new Set(characterInventories[compositeKey]?.map((t) => t.id) || [])}
              onClose={() => setShowGrantModal(null)}
              onSuccess={loadInventories}
              onExecuteGrant={handleExecuteBulk}
            />
          );
        })()}
    </>
  );
}
