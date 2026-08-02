import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { intelService, type IntelGrantTarget } from '../../services/IntelService';
import { activityLogger } from '../../services/ActivityLogger';
import { CharacterData } from '../../types/player';
import type { IntelItem } from '../../types/intel';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';
import {
  INTEL_FILTER_TAB_LABELS,
  intelTypeFromFilterTab,
  intelTypeIcon,
  type IntelFilterTab,
} from '../lib/intelDisplay';

export interface IntelDistributionDrawerProps {
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  character?: CharacterData;
  targets?: IntelGrantTarget[];
  uid?: string;
  existingItemIds?: Set<string>;
  campaignId?: string;
  aliveOnly?: boolean;
  agentStatusByKey?: Record<string, string>;
  /** Quando true, permite transmitir um único vídeo aos alvos (Nokia). */
  broadcastMode?: boolean;
  onExecuteGrant?: (selectedIds: Set<string>) => Promise<void>;
}

export default function IntelDistributionDrawer({
  onClose,
  onSuccess,
  title,
  character,
  targets: targetsProp,
  uid,
  existingItemIds = new Set(),
  campaignId,
  aliveOnly,
  agentStatusByKey,
  broadcastMode = false,
  onExecuteGrant,
}: IntelDistributionDrawerProps) {
  const [addTab, setAddTab] = useState<IntelFilterTab>('all');
  const [addSearch, setAddSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [allIntelItems, setAllIntelItems] = useState<IntelItem[]>([]);
  const [grantIntelOnBroadcast, setGrantIntelOnBroadcast] = useState(true);

  const targets = useMemo<IntelGrantTarget[]>(() => {
    if (targetsProp?.length) return targetsProp;
    if (uid && character) return [{ uid, characterId: character.id }];
    return [];
  }, [targetsProp, uid, character]);

  useEffect(() => {
    const unsub = intelService.subscribeToIntelRegistry(setAllIntelItems);
    return unsub;
  }, []);

  const filteredItems = useMemo(() => {
    let items = allIntelItems;
    if (broadcastMode) {
      items = items.filter((i) => i.type === 'VIDEO');
      if (campaignId) {
        items = items.filter((i) => !i.campaignId || i.campaignId === campaignId);
      }
    } else {
      const typeFilter = intelTypeFromFilterTab(addTab);
      if (typeFilter) items = items.filter((i) => i.type === typeFilter);
    }
    const q = addSearch.toLowerCase();
    return items.filter(
      (i) =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.id || '').toLowerCase().includes(q)
    );
  }, [allIntelItems, addSearch, addTab, broadcastMode, campaignId]);

  const executeGrant = async () => {
    if (selectedToAdd.size === 0 || targets.length === 0) return;
    setLoading(true);
    setFeedback(null);
    try {
      if (broadcastMode && selectedToAdd.size === 1) {
        const intelId = [...selectedToAdd][0];
        await intelService.broadcastVideo(targets, intelId, {
          grantIntel: grantIntelOnBroadcast,
          campaignId,
        });
        activityLogger.logAdmin(
          'gm.mpg',
          'video_broadcast',
          `Transmitiu vídeo ${intelId} para ${targets.length} agente(s)`,
          { intelId, campaignId, targets: targets.length }
        );
        setFeedback(`✓ Transmissão enviada para ${targets.length} agente(s).`);
      } else if (onExecuteGrant) {
        await onExecuteGrant(selectedToAdd);
        setFeedback(`✓ ${selectedToAdd.size} item(s) vinculados.`);
      } else {
        await intelService.grantIntel(targets, [...selectedToAdd], {
          campaignId,
          aliveOnly,
          agentStatusByKey,
        });
        setFeedback(`✓ ${selectedToAdd.size} item(s) vinculados.`);
        if (character) {
          activityLogger.logAdmin(
            'gm.mpg',
            'inventory_add',
            `Adicionou ${selectedToAdd.size} itens para ${character.codinome}`,
            { uid: targets[0]?.uid, charId: character.id, items: [...selectedToAdd] }
          );
        }
      }
      setSelectedToAdd(new Set());
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch {
      setFeedback('ERRO: Falha na operação.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string, alreadyHas: boolean) => {
    if (alreadyHas) return;
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (broadcastMode) {
        return next.has(id) ? new Set() : new Set([id]);
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterTabs: IntelFilterTab[] = broadcastMode
    ? ['video']
    : ['all', 'audio', 'video', 'visual', 'text', 'meta'];

  const actionLabel = broadcastMode
    ? loading
      ? 'TRANSMITINDO...'
      : 'TRANSMITIR_VÍDEO'
    : loading
      ? 'SINCRONIZANDO...'
      : 'CONCEDER_INTEL';

  return (
    <OverlayPortal open onClose={loading ? undefined : onClose}>
      <div
        className="fixed inset-0 z-[300] flex justify-end bg-black/80 backdrop-blur-sm"
        onClick={() => {
          if (!loading) onClose();
        }}
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

          <div className="p-8 border-b-4 border-[#1a1a1a] bg-black/40 relative z-10 flex justify-between items-center">
            <div>
              <h3 className="font-black text-xl text-white uppercase tracking-widest">
                {title || (broadcastMode ? 'Transmissão_de_Vídeo' : 'Distribuir_Intel')}
              </h3>
              {character && (
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                  Alvo: <span className="text-primary">{character.codinome}</span>
                </p>
              )}
              {!character && targets.length > 0 && (
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                  Destinos: <span className="text-primary">{targets.length}</span> agente(s)
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-600 hover:text-white transition-all material-symbols-outlined rounded-sm"
            >
              close
            </button>
          </div>

          {!broadcastMode && (
            <div className="flex border-b-2 border-[#1a1a1a] bg-black/20 relative z-10 shrink-0 overflow-x-auto">
              {filterTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAddTab(tab)}
                  className={`flex-1 min-w-[72px] py-4 text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
                    addTab === tab
                      ? 'text-primary bg-primary/10 border-b-2 border-primary'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {INTEL_FILTER_TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          )}

          <div className="p-6 border-b-2 border-[#1a1a1a] bg-black/40 relative z-10 shrink-0">
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-700 text-sm">
                search
              </span>
              <input
                type="text"
                placeholder="LOCALIZAR NO ACERVO..."
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="w-full bg-black/60 border-2 border-[#1a1a1a] text-[11px] font-bold uppercase px-12 py-4 text-white outline-none focus:ring-1 focus:ring-primary transition-all rounded-sm placeholder:text-zinc-800 tracking-widest"
              />
            </div>
          </div>

          {broadcastMode && (
            <div className="px-6 py-4 border-b border-[#1a1a1a] bg-black/20 relative z-10">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grantIntelOnBroadcast}
                  onChange={(e) => setGrantIntelOnBroadcast(e.target.checked)}
                  className="accent-primary"
                />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Desbloquear automaticamente para quem ainda não possui
                </span>
              </label>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/10 relative z-10">
            <div className="grid grid-cols-1 gap-2">
              {filteredItems.map((item) => {
                const alreadyHas = existingItemIds.has(item.id);
                const isSelected = selectedToAdd.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id, alreadyHas)}
                    className={`flex items-center gap-4 px-5 py-4 border-2 transition-all rounded-sm ${
                      alreadyHas
                        ? 'opacity-30 grayscale border-transparent cursor-not-allowed bg-[#111]'
                        : isSelected
                          ? 'bg-primary/10 border-primary/40 cursor-pointer'
                          : 'bg-[#1a1a1a] border-[#1a1a1a] hover:border-primary/20 hover:bg-white/5 cursor-pointer group'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-lg shrink-0 ${
                        isSelected ? 'text-primary' : 'text-zinc-600 group-hover:text-zinc-400'
                      }`}
                    >
                      {intelTypeIcon(item.type)}
                    </span>
                    <div
                      className={`w-6 h-6 border-2 rounded-sm flex items-center justify-center transition-all shrink-0 ${
                        isSelected
                          ? 'bg-primary border-primary shadow-[0_0_8px_rgba(255,140,0,0.4)]'
                          : 'border-zinc-800 group-hover:border-zinc-600'
                      }`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-black text-xs font-black">
                          check
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[11px] font-black uppercase truncate ${
                          isSelected ? 'text-primary' : 'text-zinc-300 group-hover:text-white'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-widest mt-1">
                        {item.metadata?.chapter || item.metadata?.npc || item.type}
                      </p>
                    </div>
                    {alreadyHas && (
                      <span className="text-[8px] font-black uppercase bg-black/60 text-zinc-500 px-3 py-1 border border-white/5 rounded-sm">
                        PRESENTE
                      </span>
                    )}
                  </div>
                );
              })}
              {filteredItems.length === 0 && (
                <div className="py-16 text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                  Nenhum item no acervo
                </div>
              )}
            </div>
          </div>

          <div className="p-8 border-t-4 border-[#1a1a1a] flex flex-col sm:flex-row justify-between items-center bg-black/40 gap-6 relative z-10 shrink-0">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              {broadcastMode
                ? selectedToAdd.size === 1
                  ? '1 VÍDEO SELECIONADO'
                  : 'SELECIONE UM VÍDEO'
                : `${selectedToAdd.size} SELECIONADO(S)`}
            </span>
            <div className="flex gap-4 w-full sm:w-auto">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 sm:flex-none px-6 py-4 text-[10px] font-black text-zinc-600 hover:text-white transition-colors uppercase tracking-widest disabled:opacity-50"
              >
                CANCELAR
              </button>
              <button
                onClick={executeGrant}
                disabled={
                  selectedToAdd.size === 0 ||
                  loading ||
                  targets.length === 0 ||
                  (broadcastMode && selectedToAdd.size !== 1)
                }
                className="flex-2 sm:flex-none bg-primary text-black px-10 py-4 rounded-sm font-black text-[11px] uppercase tracking-widest hover:bg-primary-container transition-all active:scale-95 disabled:opacity-20 glow-orange shadow-lg"
              >
                {actionLabel}
              </button>
            </div>
          </div>

          {feedback && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-sm border border-emerald-500/50 px-6 py-3 rounded-full text-[10px] font-black text-emerald-400 uppercase z-50 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {feedback}
            </div>
          )}
        </motion.div>
      </div>
    </OverlayPortal>
  );
}
