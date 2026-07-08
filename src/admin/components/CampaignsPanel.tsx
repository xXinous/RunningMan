import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Screw from '../../components/player/Screw';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { Campaign, campaigns as initialCampaigns } from '../../data/campaigns';
import { Group, MasterAccount, CharacterData } from '../../types/player';
import { campaignAdminService } from '../../services/CampaignAdminService';
import { useModal } from './ConfirmModal';
import { intelRegistry } from '../../data/intel_registry';
import { userService } from '../../services/UserService';
import MissionCommandModal from './MissionCommandModal';
import OverlayPortal from './OverlayPortal';
import { MissionTabId } from './mission/types';

export interface MissionDeepLink {
  campaignId: string;
  tab?: MissionTabId;
}

interface CampaignsPanelProps {
  missionDeepLink?: MissionDeepLink | null;
  onDeepLinkConsumed?: () => void;
}

function createNewCampaignDraft(): Partial<Campaign> {
  return {
    id: `new-mission-${Date.now()}`,
    name: '',
    description: '',
    location: '',
    year: '2026',
    rpgSystem: 'Cyberpunk Red',
    status: 'Ativa',
    imageUrl: '',
  };
}

export default function CampaignsPanel({
  missionDeepLink,
  onDeepLinkConsumed,
}: CampaignsPanelProps) {
  const { showAlert, showConfirm, modal } = useModal();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [persistentItems, setPersistentItems] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allCharacters, setAllCharacters] = useState<
    { account: MasterAccount; character: CharacterData }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [commandModal, setCommandModal] = useState<{
    campaign: Partial<Campaign>;
    tab: MissionTabId;
  } | null>(null);

  useEffect(() => {
    const unsubCampaigns = onSnapshot(
      collection(db, 'campaigns'),
      (snap) => {
        const list: Campaign[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Campaign));
        if (list.length === 0 && initialCampaigns.length > 0) {
          campaignAdminService.initializeCampaignsFromData();
        }
        setCampaigns(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[CampaignsPanel] campaigns listener error:', err);
        setCampaigns(initialCampaigns);
        setLoading(false);
      }
    );

    const unsubSettings = onSnapshot(doc(db, 'system', 'campaignSettings'), (snap) => {
      if (snap.exists()) {
        setPersistentItems(snap.data().persistentItemIds || []);
      }
    });

    const unsubGroups = onSnapshot(collection(db, 'groups'), (snap) => {
      const list: Group[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Group));
      setGroups(list);
    });

    fetchInitialAgents();

    return () => {
      unsubCampaigns();
      unsubSettings();
      unsubGroups();
    };
  }, []);

  useEffect(() => {
    if (!missionDeepLink || loading) return;
    const target = campaigns.find((c) => c.id === missionDeepLink.campaignId);
    if (target) {
      setCommandModal({ campaign: target, tab: missionDeepLink.tab || 'vinculos' });
      onDeepLinkConsumed?.();
    }
  }, [missionDeepLink, campaigns, loading, onDeepLinkConsumed]);

  const fetchInitialAgents = async () => {
    try {
      const result = await userService.fetchUsersPage(50);
      const charPromises = result.users.map((u) => userService.fetchCharactersForUser(u.uid));
      const charResults = await Promise.all(charPromises);

      const combined: { account: MasterAccount; character: CharacterData }[] = [];
      result.users.forEach((acc, i) => {
        charResults[i].forEach((char) => {
          if (!char.archived && acc.role !== 'admin') {
            combined.push({ account: acc as MasterAccount, character: char });
          }
        });
      });
      setAllCharacters(combined);
    } catch (err) {
      console.error('Erro ao carregar agentes iniciais:', err);
    }
  };

  const handleDeleteCampaign = async (id: string, name: string) => {
    const ok = await showConfirm(
      'Apagar Missão',
      `Tem certeza que deseja apagar "${name}"? Referências em agentes e esquadrões (campaignId / unlockedCampaigns) não serão limpas automaticamente.`,
      'Apagar'
    );
    if (!ok) return;

    try {
      await campaignAdminService.deleteCampaign(id);
    } catch (error) {
      console.error('Erro ao deletar campanha:', error);
      showAlert('Erro', 'Falha ao remover campanha.');
    }
  };

  const togglePersistentItem = async (itemId: string) => {
    const newList = persistentItems.includes(itemId)
      ? persistentItems.filter((id) => id !== itemId)
      : [...persistentItems, itemId];

    try {
      await campaignAdminService.setPersistentItems(newList);
      setPersistentItems(newList);
    } catch (error) {
      console.error('Erro ao atualizar itens persistentes:', error);
    }
  };

  const openManage = (campaign: Campaign, tab: MissionTabId = 'dados') => {
    setCommandModal({ campaign, tab });
  };

  const openNewMission = () => {
    setCommandModal({ campaign: createNewCampaignDraft(), tab: 'dados' });
  };

  if (loading) {
    return (
      <div className="p-24 text-center animate-pulse font-display font-bold text-primary text-xs uppercase tracking-[0.4em]">
        Sincronizando Missões...
      </div>
    );
  }

  const allRegistryIntel = intelRegistry.getAll();

  return (
    <div className="space-y-8 font-sans">
      {modal}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white">
              Centro de Comando
            </h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">
              Gestão de Instâncias e Missões Ativas
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setShowItemsModal(true)}
            className="flex items-center gap-3 bg-surface-container-high text-industrial-silver/60 px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest hover:bg-white/5 transition-all border border-white/5 active:scale-95 uppercase"
          >
            <span className="material-symbols-outlined text-base">inventory_2</span>
            Itens Persistentes
          </button>
          <button
            onClick={openNewMission}
            className="flex items-center gap-3 bg-primary text-black px-6 py-3 rounded-sm font-display font-bold text-[11px] tracking-widest hover:bg-primary-container transition-all active:scale-95 glow-orange shadow-lg uppercase"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Nova Missão
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {campaigns.map((campaign) => {
          const authorizedGroups = groups.filter((g) =>
            (g.unlockedCampaigns || []).includes(campaign.id)
          ).length;
          const operatingGroups = groups.filter((g) => g.campaignId === campaign.id).length;
          const operatingAgents = allCharacters.filter(
            (c) => c.character.campaignId === campaign.id
          ).length;

          return (
            <div
              key={campaign.id}
              className="bg-surface-container-low border border-primary/10 overflow-hidden group hover:border-primary/30 transition-all shadow-2xl relative"
            >
              <div className="h-48 bg-black relative overflow-hidden">
                {campaign.imageUrl ? (
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.name}
                    className="w-full h-full object-cover opacity-40 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-industrial-silver/5 bg-surface-container-high">
                    <span className="material-symbols-outlined text-7xl">map</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-surface-container-low via-surface-container-low/20 to-transparent" />

                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse glow-orange" />
                    <p className="text-[10px] font-display font-bold text-primary/70 uppercase tracking-[0.2em]">
                      {campaign.rpgSystem}
                    </p>
                  </div>
                  <h3 className="font-display font-bold text-3xl text-white uppercase tracking-tighter group-hover:text-primary transition-colors leading-none">
                    {campaign.name}
                  </h3>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <p className="text-[12px] text-industrial-silver/50 italic line-clamp-2 leading-relaxed font-sans">
                  {campaign.description}
                </p>

                <div className="flex items-center justify-between text-[10px] font-display font-bold text-industrial-silver/30 uppercase border-y border-white/5 py-3 tracking-widest gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-industrial-silver/20">
                      location_on
                    </span>{' '}
                    {campaign.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-industrial-silver/20">
                      devices
                    </span>
                    {campaign.playerType === 'nokia' ? 'NOKIA 2280' : 'WALKMAN'}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-sm border font-display font-bold ${
                      campaign.status === 'Ativa'
                        ? 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5'
                        : campaign.status === 'Bloqueada'
                          ? 'border-red-500/20 text-red-500 bg-red-500/5'
                          : 'border-white/5 text-industrial-silver/30'
                    }`}
                  >
                    {campaign.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[8px] font-display font-bold uppercase tracking-widest">
                  {authorizedGroups > 0 && (
                    <span className="bg-primary/5 text-primary/70 border border-primary/20 px-2 py-1 rounded-sm">
                      {authorizedGroups} esq. autorizados
                    </span>
                  )}
                  {(operatingGroups > 0 || operatingAgents > 0) && (
                    <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-2 py-1 rounded-sm animate-pulse">
                      {operatingGroups + operatingAgents} em campo
                    </span>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => openManage(campaign)}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-black px-4 py-3 rounded-sm font-display font-bold text-[10px] uppercase tracking-widest hover:bg-primary-container transition-all active:scale-95 glow-orange"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    Gerenciar
                  </button>
                  <button
                    onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                    className="w-12 flex items-center justify-center bg-black/40 border border-white/10 rounded-sm text-industrial-silver/40 hover:text-red-500 hover:border-red-500/30 transition-all active:scale-90"
                    title="Apagar missão"
                  >
                    <span className="material-symbols-outlined text-xl">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {commandModal && (
        <MissionCommandModal
          open
          campaign={commandModal.campaign}
          initialTab={commandModal.tab}
          groups={groups}
          allCharacters={allCharacters}
          onClose={() => setCommandModal(null)}
          onCharacterUpdate={setAllCharacters}
        />
      )}

      <OverlayPortal open={showItemsModal} onClose={() => setShowItemsModal(false)}>
        <AnimatePresence>
          {showItemsModal && (
            <div
              className="fixed inset-0 z-[120] flex justify-end bg-black/80 backdrop-blur-sm"
              onClick={() => setShowItemsModal(false)}
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="bg-[#222] border-l-8 border-[#1a1a1a] w-full max-w-2xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra"
                onClick={(e) => e.stopPropagation()}
              >
                <Screw className="top-4 left-4" />
                <Screw className="top-4 right-4 -rotate-90" />
                <Screw className="bottom-4 left-4 -rotate-90" />
                <Screw className="bottom-4 right-4" />
                <div className="noise-overlay" />
                <div className="scanlines" />

                <div className="p-8 border-b-4 border-[#1a1a1a] flex justify-between items-center bg-black/40 relative z-10">
                  <div className="mt-2">
                    <h3 className="font-black text-xl text-white uppercase tracking-widest">
                      Retenção de <span className="text-primary">Recursos</span>
                    </h3>
                    <p className="text-[10px] font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">
                      Itens disponíveis em todas as missões
                    </p>
                  </div>
                  <button
                    onClick={() => setShowItemsModal(false)}
                    className="p-3 text-industrial-silver/20 hover:text-white transition-all material-symbols-outlined rounded-sm"
                  >
                    close
                  </button>
                </div>

                <div className="p-6 bg-black/20 border-b-2 border-[#1a1a1a] relative z-10">
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-primary transition-colors">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="LOCALIZAR ITEM NO ACERVO..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold px-12 py-4 text-white outline-none rounded-sm uppercase tracking-widest transition-all shadow-inner focus:ring-1 focus:ring-primary placeholder:text-zinc-700"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/10 relative z-10">
                  <div className="grid grid-cols-1 gap-2">
                    {allRegistryIntel
                      .filter(
                        (i) =>
                          (i.title || '').toLowerCase().includes(itemSearch.toLowerCase()) ||
                          (i.metadata?.chapter || '').toLowerCase().includes(itemSearch.toLowerCase())
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => togglePersistentItem(item.id)}
                          className={`flex items-center justify-between p-4 text-left transition-all border-2 rounded-sm group ${
                            persistentItems.includes(item.id)
                              ? 'bg-primary/10 border-primary/30 text-primary shadow-inner'
                              : 'bg-[#1a1a1a] border-[#1a1a1a] text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-10 h-10 rounded-sm bg-black/40 border-2 flex items-center justify-center transition-all ${
                                persistentItems.includes(item.id)
                                  ? 'border-primary/40 text-primary shadow-[0_0_10px_rgba(255,140,0,0.1)]'
                                  : 'border-[#1a1a1a] text-zinc-600'
                              }`}
                            >
                              <span className="material-symbols-outlined text-xl">
                                {item.type === 'AUDIO'
                                  ? 'album'
                                  : item.type === 'TEXT'
                                    ? 'save'
                                    : 'description'}
                              </span>
                            </div>
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-wider">
                                {item.title}
                              </p>
                              <p
                                className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${
                                  persistentItems.includes(item.id)
                                    ? 'text-primary/40'
                                    : 'text-zinc-600'
                                }`}
                              >
                                {item.metadata?.chapter || 'REGISTRO GERAL'}
                              </p>
                            </div>
                          </div>
                          {persistentItems.includes(item.id) && (
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse glow-orange" />
                          )}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="p-8 border-t-4 border-[#1a1a1a] flex justify-end bg-black/40 relative z-10 shrink-0">
                  <button
                    onClick={() => setShowItemsModal(false)}
                    className="bg-[#333] hover:bg-[#444] text-white px-12 py-4 text-[10px] font-black tracking-widest transition-all rounded-sm uppercase active:scale-95"
                  >
                    Concluir Operação
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </OverlayPortal>
    </div>
  );
}
