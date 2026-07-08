import React, { useState, useEffect } from 'react';
import { Campaign } from '../../data/campaigns';
import { Group, MasterAccount, CharacterData } from '../../types/player';
import { campaignAdminService } from '../../services/CampaignAdminService';
import { useModal } from './ConfirmModal';
import OverlayPortal from './OverlayPortal';
import MissionDataTab from './mission/MissionDataTab';
import MissionAccessTab from './mission/MissionAccessTab';
import MissionInventoryTab from './mission/MissionInventoryTab';
import MissionVideoTab from './mission/MissionVideoTab';
import { MissionTabId, MISSION_TAB_LABELS } from './mission/types';

interface MissionCommandModalProps {
  open: boolean;
  campaign: Partial<Campaign> | null;
  initialTab?: MissionTabId;
  groups: Group[];
  allCharacters: { account: MasterAccount; character: CharacterData }[];
  onClose: () => void;
  onSaved?: (campaign: Campaign) => void;
  onCharacterUpdate?: (
    updater: (
      prev: { account: MasterAccount; character: CharacterData }[]
    ) => { account: MasterAccount; character: CharacterData }[]
  ) => void;
}

const TAB_ORDER: MissionTabId[] = ['dados', 'vinculos', 'inventario', 'transmissao'];

export default function MissionCommandModal({
  open,
  campaign,
  initialTab = 'dados',
  groups,
  allCharacters,
  onClose,
  onSaved,
  onCharacterUpdate,
}: MissionCommandModalProps) {
  const { showAlert, modal } = useModal();
  const [activeTab, setActiveTab] = useState<MissionTabId>(initialTab);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [isPersisted, setIsPersisted] = useState(false);
  const [saving, setSaving] = useState(false);

  const isNew = Boolean(editingCampaign?.id?.includes('new'));

  useEffect(() => {
    if (!open || !campaign) return;
    setEditingCampaign({ ...campaign });
    setIsPersisted(!campaign.id?.includes('new'));
    setActiveTab(initialTab);
  }, [open, campaign, initialTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign?.name || !editingCampaign?.id) return;

    setSaving(true);
    try {
      await campaignAdminService.saveCampaign(
        editingCampaign as Partial<Campaign> & { id: string; name: string }
      );
      setIsPersisted(true);
      const saved = editingCampaign as Campaign;
      onSaved?.(saved);
      showAlert('Sucesso', 'Missão salva com sucesso.');
      if (isNew) {
        setActiveTab('vinculos');
      }
    } catch (error) {
      console.error('Erro ao salvar campanha:', error);
      showAlert('Erro', 'Não foi possível salvar a campanha.');
    } finally {
      setSaving(false);
    }
  };

  const persistedCampaign = editingCampaign as Campaign | null;
  const tabsLocked = !isPersisted || !persistedCampaign?.id;

  if (!open || !editingCampaign) return null;

  return (
    <OverlayPortal open={open} onClose={onClose}>
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
        <div className="bg-surface-container-low border border-primary/30 w-full max-w-5xl rounded-sm shadow-2xl flex flex-col h-[90vh] relative overflow-hidden">
          <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
            {isNew && !isPersisted ? 'INSTALAÇÃO-DE-MISSÃO' : 'CENTRO-DE-COMANDO'}
          </div>

          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40 shrink-0">
            <div className="flex items-center gap-4 mt-2">
              <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
              <div>
                <h3 className="font-display font-bold text-xl text-white uppercase tracking-tighter">
                  {editingCampaign.name || 'Nova Missão'}
                </h3>
                <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-0.5">
                  Gestão unificada de instância operacional
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 text-industrial-silver/20 hover:text-white transition-all material-symbols-outlined rounded-sm"
            >
              close
            </button>
          </div>

          <div className="flex border-b border-white/5 bg-black/20 shrink-0">
            {TAB_ORDER.map((tab) => {
              const locked = tab !== 'dados' && tabsLocked;
              return (
                <button
                  key={tab}
                  type="button"
                  disabled={locked}
                  onClick={() => !locked && setActiveTab(tab)}
                  className={`flex-1 py-4 text-[10px] font-display font-bold uppercase tracking-[0.15em] transition-all ${
                    activeTab === tab
                      ? 'text-primary bg-primary/10 border-b-2 border-primary'
                      : locked
                        ? 'text-industrial-silver/15 cursor-not-allowed'
                        : 'text-industrial-silver/40 hover:text-white hover:bg-white/5'
                  }`}
                  title={locked ? 'Salve a missão na aba Dados primeiro' : undefined}
                >
                  {MISSION_TAB_LABELS[tab]}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
            {modal}
            {activeTab === 'dados' && (
              <MissionDataTab
                campaign={editingCampaign}
                isNew={isNew && !isPersisted}
                onChange={setEditingCampaign}
                onSave={handleSave}
                onCancel={onClose}
                saving={saving}
              />
            )}
            {activeTab === 'vinculos' && persistedCampaign && (
              <MissionAccessTab
                campaign={persistedCampaign}
                groups={groups}
                allCharacters={allCharacters}
                showAlert={showAlert}
                onCharacterAssigned={(uid, charId, campaignId) => {
                  onCharacterUpdate?.((prev) =>
                    prev.map((c) =>
                      c.character.id === charId && c.account.uid === uid
                        ? { ...c, character: { ...c.character, campaignId } }
                        : c
                    )
                  );
                }}
                onCharacterUnassigned={(uid, charId) => {
                  onCharacterUpdate?.((prev) =>
                    prev.map((c) =>
                      c.character.id === charId && c.account.uid === uid
                        ? { ...c, character: { ...c.character, campaignId: undefined } }
                        : c
                    )
                  );
                }}
              />
            )}
            {activeTab === 'inventario' && persistedCampaign && (
              <MissionInventoryTab
                campaign={persistedCampaign}
                groups={groups}
                allCharacters={allCharacters}
              />
            )}
            {activeTab === 'transmissao' && persistedCampaign && (
              <MissionVideoTab
                campaign={persistedCampaign}
                groups={groups}
                allCharacters={allCharacters}
              />
            )}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
