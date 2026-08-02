import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { User } from 'lucide-react';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';
export default React.memo(function SideControls({ volume, setVolume, onModeChange, onProfileOpen, onCharacterSwitch, landscape }: {
  volume: number; setVolume: (v: number) => void;
  onModeChange: (dir: 'up' | 'down') => void; onProfileOpen: () => void;
  onCharacterSwitch?: () => void;
  landscape?: boolean;
}) {
  const dragY = useMotionValue(0);
  const firedRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const upArrowColor = useTransform(dragY, (v: number) => v < -5 ? '#ea580c' : '#6b7280');
  const downArrowColor = useTransform(dragY, (v: number) => v > 5 ? '#ea580c' : '#6b7280');
  
  const lastLoggedVolume = useRef(volume);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  useEffect(() => {
    if (volume === lastLoggedVolume.current) return;
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => {
      activityLogger.logAction('player', `Volume ajustado para ${volume}%`, { volume });
      lastLoggedVolume.current = volume;
    }, 1500);
    return () => { if (volumeTimer.current) clearTimeout(volumeTimer.current); };
  }, [volume]);

  const handleProfilePointerDown = (e: React.PointerEvent) => {
    longPressTimer.current = setTimeout(() => {
      if (onCharacterSwitch) {
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
          try { window.navigator.vibrate([50, 30, 50]); } catch(e) {}
        }
        activityLogger.logAction('player', 'Troca rápida de agente acionada via long-press');
        onCharacterSwitch();
      }
      longPressTimer.current = null;
    }, 1000);
  };

  const handleProfilePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      onProfileOpen();
    }
  };

  return (
    <div
      className={
        landscape
          ? 'relative shrink-0 w-16 flex flex-col items-center justify-center gap-4 py-2 touch-none'
          : 'absolute right-2 top-[240px] bottom-20 flex flex-col items-center justify-center gap-6 w-16 touch-none'
      }
    >
      <button 
        onPointerDown={handleProfilePointerDown}
        onPointerUp={handleProfilePointerUp}
        onPointerLeave={() => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }}
        className="w-10 h-10 rounded-full bg-[#333] border-2 border-[#1a1a1a] flex items-center justify-center hover:bg-orange-900/30 transition-colors shrink-0 active:scale-90"
        title="Clique para perfil, segure para trocar agente"
      >
        <User size={16} className="text-orange-500" />
      </button>
      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center z-20">
        <motion.div style={{ color: upArrowColor }} className="absolute -top-4 pointer-events-none transition-colors">
          <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-[6px] border-b-current" />
        </motion.div>
        <motion.div style={{ color: downArrowColor }} className="absolute -bottom-4 pointer-events-none transition-colors">
          <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-[6px] border-t-current" />
        </motion.div>
        <motion.div
          style={{ y: dragY, touchAction: 'none' }}
          className="relative w-14 h-14 rounded-full bg-[#333] border-4 border-[#1a1a1a] shadow-lg flex items-center justify-center group cursor-ns-resize"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const el = e.currentTarget;
            let startY = e.clientY;
            firedRef.current = false;
            const onMove = (me: PointerEvent) => {
              me.preventDefault();
              if (firedRef.current) return; 
              const delta = Math.max(-20, Math.min(20, me.clientY - startY));
              if (delta <= -18) {
                onModeChange('up');
                activityLogger.logAction('player', 'Alterado modo de exibição (Cima)');
                analyticsTracker.incrementStat('fidgetClicks');
                firedRef.current = true;
                animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 25 });
              } else if (delta >= 18) {
                onModeChange('down');
                activityLogger.logAction('player', 'Alterado modo de exibição (Baixo)');
                analyticsTracker.incrementStat('fidgetClicks');
                firedRef.current = true;
                animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 25 });
              } else {
                dragY.set(delta);
              }
            };
            const onUp = () => {
              animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 25 });
              firedRef.current = false;
              el.removeEventListener('pointermove', onMove);
              el.removeEventListener('pointerup', onUp);
            };
            el.addEventListener('pointermove', onMove);
            el.addEventListener('pointerup', onUp);
          }}>
          <div className="absolute inset-0 rounded-full border border-white/10 pointer-events-none" />
          <div className="w-10 h-10 rounded-full bg-[#444] border-2 border-[#222] flex items-center justify-center shadow-inner pointer-events-none">
            <div className="w-5 h-5 rounded-full bg-orange-600 border-2 border-[#1a1a1a]" />
          </div>
        </motion.div>
      </div>
      <div className="w-8 flex-1 max-h-40 bg-[#1a1a1a] rounded-full border-2 border-[#333] relative flex flex-col items-center py-2 shrink-0" style={{ touchAction: 'none' }}>
        <span className="text-[10px] text-gray-500 font-bold mb-1">+</span>
        <div className="flex-1 w-1 bg-[#222] rounded-full relative overflow-visible cursor-pointer"
          onClick={(e) => {
            analyticsTracker.incrementStat('fidgetClicks');
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.round(((rect.bottom - e.clientY) / rect.height) * 100);
            setVolume(Math.max(0, Math.min(100, pct)));
          }}>
          <div className="absolute bottom-0 w-full bg-orange-600 rounded-full transition-[height] duration-75" style={{ height: `${volume}%` }} />
          <div className="absolute left-1/2 -translate-x-1/2 w-6 h-8 bg-linear-to-b from-stone-200 to-stone-400 rounded border-2 border-stone-600 shadow-lg cursor-ns-resize flex flex-col justify-center items-center gap-0.5 z-10"
            style={{ bottom: `calc(${volume}% - 16px)`, touchAction: 'none' }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              const startY = e.clientY, startVol = volume;
              const onMove = (me: PointerEvent) => {
                analyticsTracker.incrementStat('fidgetClicks');
                setVolume(Math.max(0, Math.min(100, Math.round(startVol + ((startY - me.clientY) / 80) * 100))));
              }
              const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
              window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
            }}>
            {[0,1,2].map(i => <div key={i} className="w-3 h-0.5 bg-stone-500 rounded-full" />)}
          </div>
        </div>
        <span className="text-[10px] text-gray-500 font-bold mt-1">-</span>
      </div>
    </div>
  );
});
