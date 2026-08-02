import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera } from 'lucide-react';
const QrScanner = React.lazy(() => import('../QrScanner'));
import { IntelBase, AudioIntel } from '../../services/IntelEngine';
import type { WalkmanStatus } from '../../types/player';
import Screw from './Screw';
import RetroSpinner from './RetroSpinner';

export default React.memo(function CassetteVisor({
  currentIntel, 
  status,
  onEject, 
  onScanClick, 
  onCancelScan, 
  onQrDetected,
  compact,
}: {
  currentIntel: IntelBase | null; 
  status: WalkmanStatus;
  onEject: () => void; 
  onScanClick: () => void;
  onCancelScan: () => void; 
  onQrDetected: (code: string) => void;
  compact?: boolean;
}) {
  const isPlaying = status === 'PLAYING';
  const isRewinding = status === 'REWINDING';
  const isLoading = status === 'LOADING';
  const isScanning = status === 'SCANNING';
  const hasTape = !!currentIntel && (status === 'LOADED' || status === 'PLAYING' || status === 'REWINDING');

  return (
    <div
      className={`mx-auto bg-[#222] rounded-xl border-4 border-[#1a1a1a] shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] flex flex-col items-center relative overflow-hidden shrink-0 ${
        compact ? 'mt-0 w-full max-w-[280px] h-[160px]' : 'mt-4 w-[310px] h-[190px]'
      }`}
    >

      {([['top-2 left-2',''],['top-2 right-2','-rotate-45'],['bottom-2 left-2','rotate-90'],['bottom-2 right-2','']] as const).map(([pos, rot], i) => (
        <Screw key={i} className={`absolute ${pos} w-2.5 h-2.5 rounded-full bg-[#111]`} innerClassName={`w-1.5 h-px bg-[#333] ${rot}`} />
      ))}

      <AnimatePresence mode="wait">
        {hasTape && currentIntel ? (
          <motion.div key="cassette" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            onClick={onEject} className="w-full h-full flex flex-col items-center cursor-pointer group">
      
            <div className="mt-4 w-[280px] h-[130px] bg-[#f4f1ea] rounded-md shadow-sm relative flex flex-col p-3 border-t-12 border-orange-600 transition-transform group-hover:scale-[1.01]">
              <div className="text-[8px] font-bold flex justify-center gap-4 text-gray-500 mb-2 border-b border-gray-300/50 pb-1">
                <span>{currentIntel.metadata?.chapter}</span>
                <span>{currentIntel instanceof AudioIntel ? currentIntel.metadata.artist : currentIntel.metadata?.npc}</span>
              </div>
              <div className="flex-1 flex flex-col text-center px-2">
                <div className="text-[13px] font-black uppercase tracking-tight text-gray-800 truncate leading-tight">{currentIntel.title}</div>
                <div className="text-[10px] font-bold text-gray-600 truncate mt-0.5">{currentIntel instanceof AudioIntel ? currentIntel.metadata.artist : currentIntel.metadata?.npc}</div>
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[180px] h-[50px] bg-[#222] rounded-t-lg border-t-2 border-l-2 border-r-2 border-[#111]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-sm">CLIQUE PARA EJETAR</div>
            </div>
      
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[170px] h-[46px] bg-black/40 rounded-md flex items-center justify-between px-4 border border-white/5">
              {[true, false].map((_, si) => (
                <motion.div key={si} 
                  animate={{ rotate: isRewinding ? -360 : (isPlaying ? 360 : 0) }} 
                  transition={{ repeat: (isPlaying || isRewinding) ? Infinity : 0, duration: isRewinding ? 0.3 : (isPlaying ? 3 : 0), ease: 'linear' }}
                  className="w-10 h-10 rounded-full bg-[#d4d4d4] flex items-center justify-center relative shadow-md">
                  <div className="absolute inset-0 rounded-full border-[6px] border-[#111] opacity-90" />
                  <div className="w-4 h-4 rounded-full bg-[#222] flex items-center justify-center z-10">
                    <div className="w-full h-0.5 bg-[#d4d4d4] absolute" /><div className="w-0.5 h-full bg-[#d4d4d4] absolute" />
                    <div className="w-full h-0.5 bg-[#d4d4d4] absolute rotate-45" /><div className="w-0.5 h-full bg-[#d4d4d4] absolute rotate-45" />
                  </div>
                </motion.div>
              ))}
              <div className="absolute bottom-1 left-8 right-8 h-[3px] bg-[#111]" />
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={isScanning ? 'w-full h-full' : 'w-full h-full flex flex-col items-center justify-center p-4'}>
            {isScanning ? (
              <React.Suspense fallback={
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <RetroSpinner size="sm" className="mb-2" />
                  <p className="text-orange-500 text-[9px] font-bold uppercase tracking-widest animate-pulse mt-2">Iniciando scanner...</p>
                </div>
              }>
                <QrScanner
                  onDetected={onQrDetected}
                  onCancel={onCancelScan}
                />
              </React.Suspense>
            ) : (
              <div onClick={!isLoading ? onScanClick : undefined}
                className={`w-[280px] h-[130px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 transition-all ${isLoading ? 'border-orange-500/30 cursor-default' : 'border-[#444] hover:bg-white/5 cursor-pointer group'}`}>
                {isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <RetroSpinner size="sm" />
                    <p className="text-orange-500 text-[9px] font-bold uppercase tracking-widest animate-pulse">Carregando prova...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="text-gray-500 group-hover:text-orange-500 transition-colors" size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">Compartimento Vazio</p>
                      <p className="text-orange-500 text-[9px] font-bold uppercase tracking-tighter mt-1">Escaneie QR para Inserir Prova</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
