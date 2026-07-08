import React, { useState } from 'react';
import { Campaign } from '../../../data/campaigns';
import { MediaAsset } from '../../../types/media';
import MediaSelectorModal from '../MediaSelectorModal';

interface MissionDataTabProps {
  campaign: Partial<Campaign>;
  isNew: boolean;
  onChange: (campaign: Partial<Campaign>) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function MissionDataTab({
  campaign,
  isNew,
  onChange,
  onSave,
  onCancel,
  saving = false,
}: MissionDataTabProps) {
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);

  const handleMediaSelect = (asset: MediaAsset) => {
    onChange({ ...campaign, imageUrl: asset.url });
  };

  return (
    <>
      <MediaSelectorModal
        isOpen={isMediaSelectorOpen}
        onClose={() => setIsMediaSelectorOpen(false)}
        onSelect={handleMediaSelect}
        title="Selecionar Capa da Missão"
        allowedTypes={['image']}
      />

      <form onSubmit={onSave} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="group">
              <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                Identificador Slug
              </label>
              <input
                type="text"
                value={campaign.id || ''}
                onChange={(e) => onChange({ ...campaign, id: e.target.value })}
                className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-mono outline-none rounded-sm uppercase shadow-inner"
                placeholder="ex: neo-sampa-2099"
                required
                disabled={!isNew}
              />
              <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
            </div>
            <div className="group">
              <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                Nome Operacional
              </label>
              <input
                type="text"
                value={campaign.name || ''}
                onChange={(e) => onChange({ ...campaign, name: e.target.value })}
                className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
                required
              />
              <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
            </div>
            <div className="group">
              <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                Sistema de Regras
              </label>
              <input
                type="text"
                value={campaign.rpgSystem || ''}
                onChange={(e) => onChange({ ...campaign, rpgSystem: e.target.value })}
                className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
              />
              <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                  Ano
                </label>
                <input
                  type="text"
                  value={campaign.year || ''}
                  onChange={(e) => onChange({ ...campaign, year: e.target.value })}
                  className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
                />
                <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
              </div>
              <div className="group">
                <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                  Acesso
                </label>
                <select
                  value={campaign.status || 'Ativa'}
                  onChange={(e) =>
                    onChange({ ...campaign, status: e.target.value as Campaign['status'] })
                  }
                  className="w-full bg-surface-container-lowest border-none text-primary text-[10px] font-display font-bold px-4 py-4 outline-none rounded-sm uppercase cursor-pointer shadow-inner appearance-none"
                >
                  <option value="Ativa">ATIVA</option>
                  <option value="Arquivada">ARQUIVADA</option>
                  <option value="Bloqueada">BLOQUEADA</option>
                </select>
                <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
              </div>
            </div>
            <div className="group">
              <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                Interface do Jogador (Tema)
              </label>
              <select
                value={campaign.playerType || 'walkman'}
                onChange={(e) =>
                  onChange({ ...campaign, playerType: e.target.value as Campaign['playerType'] })
                }
                className="w-full bg-surface-container-lowest border-none text-primary text-[10px] font-display font-bold px-4 py-4 outline-none rounded-sm uppercase cursor-pointer shadow-inner appearance-none"
              >
                <option value="walkman">WALKMAN RETRO</option>
                <option value="nokia">NOKIA 2280 AZUL</option>
              </select>
              <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                Descrição do Setor
              </label>
              <textarea
                value={campaign.description || ''}
                onChange={(e) => onChange({ ...campaign, description: e.target.value })}
                className="w-full h-28 bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-sans outline-none resize-none rounded-sm shadow-inner leading-relaxed"
              />
              <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
            </div>
            <div className="group">
              <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                Localização
              </label>
              <input
                type="text"
                value={campaign.location || ''}
                onChange={(e) => onChange({ ...campaign, location: e.target.value })}
                className="w-full bg-surface-container-lowest border-none text-white px-4 py-4 text-[11px] font-display font-bold outline-none rounded-sm uppercase shadow-inner"
              />
              <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
            </div>
            <div className="group">
              <label className="block text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 group-focus-within:text-primary transition-colors">
                Frequência Visual (Capa)
              </label>

              {campaign.imageUrl && (
                <div className="relative mb-4 rounded-sm overflow-hidden border border-primary/20 group/preview">
                  <img
                    src={campaign.imageUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover opacity-60 group-hover/preview:opacity-80 transition-opacity"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
                  <button
                    type="button"
                    onClick={() => onChange({ ...campaign, imageUrl: '' })}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/70 border border-white/10 rounded-sm flex items-center justify-center text-red-500/70 hover:text-red-500 transition-all hover:border-red-500/30"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                  <p className="absolute bottom-2 left-3 text-[8px] font-display font-bold text-white/50 uppercase tracking-widest">
                    PREVIEW_ATIVA
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsMediaSelectorOpen(true)}
                className="w-full border-2 border-dashed border-primary/15 hover:border-primary/40 bg-surface-container-lowest/50 hover:bg-primary/5 rounded-sm py-8 flex flex-col items-center gap-2 transition-all group/upload cursor-pointer"
              >
                <span className="material-symbols-outlined text-3xl text-industrial-silver/20 group-hover/upload:text-primary/60 transition-colors">
                  perm_media
                </span>
                <span className="text-[10px] font-display font-bold text-industrial-silver/30 group-hover/upload:text-primary/50 uppercase tracking-widest transition-colors">
                  Selecionar da Central de Mídia
                </span>
              </button>

              <div className="flex items-center gap-3 mt-3">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">
                  ou cole URL
                </span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <input
                type="text"
                value={campaign.imageUrl || ''}
                onChange={(e) => onChange({ ...campaign, imageUrl: e.target.value })}
                className="w-full bg-surface-container-lowest border-none text-white px-4 py-3 text-[11px] font-mono outline-none rounded-sm shadow-inner mt-2"
                placeholder="https://..."
              />
              <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t border-white/5">
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-4 text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-[0.3em] transition-all"
          >
            Abortar Missão
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-container text-black px-12 py-4 rounded-sm font-display font-bold text-[11px] tracking-widest uppercase transition-all active:scale-95 glow-orange shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">save</span>
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </>
  );
}
