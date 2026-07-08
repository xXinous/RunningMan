import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, animate } from 'motion/react';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Campaign } from '../data/campaigns';
import { campaignService } from '../services/CampaignService';
import { groupService } from '../services/GroupService';
import type { PlayerData, Group } from '../types/player';

import { Barcode, AnalogLogo } from './campaign/Common';
import { CassetteCard } from './campaign/CassetteCard';
const SecurityMenu = React.lazy(() => import('./campaign/SecurityMenu').then(m => ({ default: m.SecurityMenu })));
const MetadataOverlay = React.lazy(() => import('./campaign/MetadataOverlay').then(m => ({ default: m.MetadataOverlay })));
import { TapeProgress } from './campaign/TapeProgress';
import { getMetrics, SNAP_SPRING } from './campaign/constants';
import RetroLoading from './player/RetroLoading';

interface CampaignSelectionProps {
  onSelect: (campaign: Campaign) => void;
  onLogout?: () => void;
  onShowProfile?: () => void;
  onChangeCharacter?: () => void;
  playerData?: PlayerData | null;
}

export default function CampaignSelection({ 
  onSelect, 
  onLogout, 
  onShowProfile, 
  onChangeCharacter,
  playerData 
}: CampaignSelectionProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [overlays, setOverlays] = useState({ menu: false, metadata: false });
  const [containerSize, setContainerSize] = useState({ width: 460, height: 0 });
  const mainRef = useRef<HTMLElement>(null);

  const metrics = useMemo(() => getMetrics(containerSize.width, containerSize.height), [containerSize]);
  const x = useMotionValue(0);
  const springX = useSpring(x, SNAP_SPRING);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const update = () => el.clientWidth > 0 && setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playerData) return;

    let activeCampaigns: Campaign[] = [];
    let characterGroups: Group[] = [];

    const updateVisibleCampaigns = () => {
      // 1. Collect all unlocked IDs (including active/assigned campaigns)
      const unlockedIds = new Set<string>([
        ...(playerData.character.unlockedCampaigns || []),
        ...(playerData.character.campaignId ? [playerData.character.campaignId] : []),
        ...characterGroups.flatMap(g => [
          ...(g.unlockedCampaigns || []),
          ...(g.campaignId ? [g.campaignId] : [])
        ])
      ]);

      // 2. Filter active campaigns
      const visible = playerData.role === 'admin'
        ? activeCampaigns
        : activeCampaigns.filter(c => unlockedIds.has(c.id));

      setCampaigns(visible);
      setLoading(false);
    };

    // Listen to groups
    const unsubGroups = groupService.subscribeToGroupsForCharacter(
      playerData.activeCharacterId,
      (groups) => {
        characterGroups = groups;
        updateVisibleCampaigns();
      },
      playerData.uid
    );

    // Listen to active campaigns
    const unsubCampaigns = campaignService.subscribeToActiveCampaigns(
      (list) => {
        activeCampaigns = list;
        updateVisibleCampaigns();
      }
    );

    return () => {
      unsubGroups();
      unsubCampaigns();
    };
  }, [playerData]);

  // Ensure `x` stays perfectly aligned if the container is resized (e.g. mobile URL bar hiding)
  const prevStepRef = useRef(metrics.step);
  useEffect(() => {
    if (prevStepRef.current !== metrics.step) {
      x.jump(-currentIndex * metrics.step);
      prevStepRef.current = metrics.step;
    }
  }, [metrics.step, currentIndex, x]);

  const snapTo = useCallback((index: number) => {
    if (!campaigns.length) return;
    const clamped = Math.max(0, Math.min(campaigns.length - 1, index));
    animate(x, -clamped * metrics.step, SNAP_SPRING);
    setCurrentIndex(clamped);
  }, [x, campaigns.length, metrics.step]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (overlays.menu || overlays.metadata) return;
      if (e.key === 'ArrowLeft') snapTo(currentIndex - 1);
      else if (e.key === 'ArrowRight') snapTo(currentIndex + 1);
      else if ((e.key === 'Enter' || e.key === ' ') && campaigns[currentIndex]?.status !== 'Bloqueada') onSelect(campaigns[currentIndex]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex, campaigns, overlays, snapTo, onSelect]);

  if (loading) return <RetroLoading message="Sincronizando Banco de Dados..." subMessage="Acessando registros de operações do Terminal RM-84" />;

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-surface">
      <div className="noise-overlay" />
      <div className="scanlines" />

      <header className="flex justify-between items-center min-h-16 sm:min-h-20 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:py-0 px-4 sm:px-8 relative z-30 border-b border-primary/20 bg-surface-container-low/50 backdrop-blur-md">
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <button onClick={() => setOverlays(v => ({ ...v, menu: true }))} 
            className="p-2 sm:p-2.5 hover:bg-primary/10 rounded-sm text-primary transition-all group border border-primary/20 shrink-0">
            <Menu size={24} className="group-hover:scale-110" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-2xl font-bold text-white uppercase tracking-tighter leading-none truncate">
              Campanhas <span className="text-primary">Ativas</span>
            </h1>
            <p className="text-[7px] sm:text-[9px] font-display uppercase tracking-[0.2em] text-industrial-silver/40 mt-1 truncate">
              Registro de Operações // Terminal RM-84
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-2">
          <div className="text-[10px] font-display font-bold text-industrial-silver/30 uppercase tracking-[0.2em] hidden sm:block">
            Nó_Central: Link_Ativo
          </div>
          <Barcode onClick={() => setOverlays(v => ({ ...v, metadata: true }))} className="text-primary opacity-50 hover:opacity-100 transition-opacity cursor-pointer shrink-0" />
        </div>
      </header>

      <main ref={mainRef} className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 relative cursor-grab active:cursor-grabbing select-none touch-none overflow-hidden">
          <motion.div 
            drag="x" 
            dragConstraints={{ left: -(campaigns.length - 1) * metrics.step, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              const projectedX = x.get() + info.velocity.x * 0.2;
              snapTo(Math.round(-projectedX / metrics.step));
            }}
            style={{ x }} 
            className="absolute inset-0 will-change-transform touch-none"
          >
            {campaigns.map((c, i) => (
              <div 
                key={c.id} 
                className="absolute top-1/2 left-1/2" 
                style={{ 
                  transform: `translate(calc(-50% + ${i * metrics.step}px), -50%)`,
                  perspective: '1200px'
                }}
              >
                <CassetteCard campaign={c} onSelect={onSelect} index={i} dragX={x} cardWidth={metrics.cardWidth} cardHeight={metrics.cardHeight} step={metrics.step} isActive={currentIndex === i} onSnapToSelf={() => snapTo(i)} />
              </div>
            ))}
          </motion.div>
        </div>

        {currentIndex > 0 && (
          <button onClick={() => snapTo(currentIndex - 1)} 
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/20 border border-primary/20 text-primary hover:bg-primary/40 transition-all flex items-center justify-center backdrop-blur-md shadow-xl">
            <ChevronLeft size={24} />
          </button>
        )}
        {currentIndex < campaigns.length - 1 && (
          <button onClick={() => snapTo(currentIndex + 1)} 
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/20 border border-primary/20 text-primary hover:bg-primary/40 transition-all flex items-center justify-center backdrop-blur-md shadow-xl">
            <ChevronRight size={24} />
          </button>
        )}
        
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
          <TapeProgress total={campaigns.length} current={currentIndex} onChange={snapTo} />
        </div>
      </main>

      <footer className="px-4 sm:px-8 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-between items-center bg-surface-container-low/80 border-t border-primary/10 relative z-30">
        <div className="flex items-center gap-2 sm:gap-3 text-[8px] sm:text-[10px] font-display font-bold tracking-[0.2em] uppercase text-industrial-silver/50 truncate">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-pulse glow-orange shrink-0" /> 
          Sinal de Rede: Estabilizado
        </div>
        <div className="font-display text-[7px] sm:text-[10px] text-industrial-silver/20 tracking-widest uppercase shrink-0 ml-2">
          RM-SYS-093 // GRID_PROTECTED
        </div>
      </footer>

      <AnimatePresence>
        {overlays.menu && (
          <React.Suspense fallback={null}>
            <SecurityMenu 
              onClose={() => setOverlays(v => ({ ...v, menu: false }))} 
              onLogout={() => { setOverlays(v => ({ ...v, menu: false })); onLogout?.(); }} 
              onShowProfile={() => { setOverlays(v => ({ ...v, menu: false })); onShowProfile?.(); }}
              onChangeCharacter={() => { setOverlays(v => ({ ...v, menu: false })); onChangeCharacter?.(); }}
            />
          </React.Suspense>
        )}
        {overlays.metadata && (
          <React.Suspense fallback={null}>
            <MetadataOverlay onClose={() => setOverlays(v => ({ ...v, metadata: false }))} agent={playerData ? { uid: playerData.uid, characterId: playerData.activeCharacterId, username: playerData.character.codinome, agentId: playerData.character.agentId, agentStatus: playerData.character.agentStatus, dangerLevel: playerData.character.dangerLevel, lastCampaignName: campaigns.find(c => c.id === playerData.character.campaignId)?.name || playerData.character.campaignId } : null} />
          </React.Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
