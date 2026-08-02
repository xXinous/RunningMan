import { AnimatePresence, motion } from 'motion/react';
import type { IntelBase } from '../../services/IntelEngine';
import type { DisplayMode } from '../../types/player';
import React from 'react';

export default React.memo(function TapeLibrary({ 
  intelItems, 
  currentIntelId, 
  isPlaying, 
  displayMode, 
  onIntelSelect,
  landscape,
}: {
  intelItems: IntelBase[]; 
  currentIntelId: string | null; 
  isPlaying: boolean; 
  displayMode: DisplayMode;
  onIntelSelect: (intel: IntelBase) => void;
  landscape?: boolean;
}) {
  const sorted = React.useMemo(() => {
    if (displayMode === 'title') return [...intelItems].sort((a, b) => a.title.localeCompare(b.title));
    if (displayMode === 'chapter') return [...intelItems].sort((a, b) => (a.metadata?.chapter || '').localeCompare(b.metadata?.chapter || ''));
    if (displayMode === 'type') return [...intelItems].sort((a, b) => a.getTypeOrder() - b.getTypeOrder() || a.title.localeCompare(b.title));
    return intelItems;
  }, [intelItems, displayMode]);

  return (
    <div className={`${landscape ? 'mt-0' : 'mt-6 mr-[76px]'} flex-1 bg-[#1a1a1a] rounded-2xl border-2 border-[#333] overflow-hidden flex flex-col min-h-0`}>
      <div className="p-3 border-b border-[#333] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center"><span className="text-white font-black text-sm italic">R.</span></div>
          <h2 className="text-orange-500 text-sm font-bold tracking-tight">Lista de Provas</h2>
        </div>
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
          {displayMode === 'default' ? 'Original' : displayMode === 'title' ? 'A-Z' : displayMode === 'chapter' ? 'Cap.' : 'Tipo'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <style>{`.tape-scroll::-webkit-scrollbar{width:4px}.tape-scroll::-webkit-scrollbar-track{background:#1a1a1a}.tape-scroll::-webkit-scrollbar-thumb{background:#ea580c;border-radius:4px}`}</style>
        <div className="tape-scroll overflow-y-auto h-full">
          {intelItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <span className="text-3xl mb-2">📼</span>
              <p className="text-gray-600 text-xs uppercase tracking-widest">Nenhuma prova</p>
              <p className="text-gray-700 text-[10px] mt-1">Escaneie um QR code para começar</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {sorted.map((item, idx) => {
                const showGroupHeader = displayMode === 'type' && (idx === 0 || sorted[idx - 1].type !== item.type);
                return (
                  <React.Fragment key={item.id}>
                    {showGroupHeader && (
                      <div className="px-3 py-1.5 bg-[#111] border-b border-[#333] sticky top-0 z-10">
                        <span className="text-[9px] text-orange-500/80 font-bold uppercase tracking-widest">{item.getTypeLabel()}</span>
                      </div>
                    )}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => onIntelSelect(item)}
                      className={`p-2 border-b border-[#222] cursor-pointer transition-colors flex justify-between items-center ${item.id === currentIntelId ? 'bg-orange-900/20 border-orange-500/50' : 'hover:bg-[#222]'}`}>
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className={`text-xs font-bold truncate ${item.id === currentIntelId ? 'text-orange-500' : 'text-gray-200'}`}>{item.title}</span>
                        <span className="text-[10px] text-orange-400 opacity-80 truncate">{item.metadata?.chapter}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.id === currentIntelId && isPlaying && (
                          <motion.div animate={{ opacity: [0, 1] }} transition={{ repeat: Infinity, duration: 0.5 }}
                            className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-orange-500 border-b-4 border-b-transparent" />
                        )}
                        <div className={`w-8 h-8 rounded border flex items-center justify-center text-sm ${
                          item.type === 'TEXT' ? 'bg-orange-600/30 border-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.3)]' : 
                          item.type === 'VISUAL' ? 'bg-cyan-600/30 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]' : 
                          item.type === 'META' ? 'bg-yellow-600/30 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' :
                          'bg-[#222] border-[#333]'
                        }`}>
                          {item.getTypeIcon()}
                        </div>
                      </div>
                    </motion.div>
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
});
