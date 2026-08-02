import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { diskRepairService } from '../services/DiskRepairService';
import { intelRegistry } from '../data/intel_registry';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';

import RetroLoading from './player/RetroLoading';

interface DiskRepairAppProps {
  uid: string;
  characterId?: string;
  onClose?: () => void;
  onBackToTerminal?: () => void;
  isWindowed?: boolean;
}

export default function DiskRepairApp({ uid, characterId = '', onClose, onBackToTerminal, isWindowed }: DiskRepairAppProps) {
  const { isLandscape } = useLandscapeLayout();
  const compact = isWindowed && isLandscape;
  const [phase, setPhase] = useState<'intro' | 'loading' | 'viewer' | 'repairing' | 'result'>('intro');
  const [resultStatus, setResultStatus] = useState<'success' | 'fail' | null>(null);
  const [progress, setProgress] = useState(0);
  const [scrambleText, setScrambleText] = useState("");

  useEffect(() => {
    diskRepairService.init();
  }, []);

  const handleInsertDisk = async () => {
    setPhase('loading');
    setProgress(0);
    await diskRepairService.startAnalysis(uid, characterId, setProgress);
    setScrambleText(intelRegistry.get('evidence-disk-01-corrupted')?.textContent || 'ERRO');
    setPhase('viewer');
  };

  const handleRepair = async () => {
    setPhase('repairing');
    setProgress(0);
    const success = await diskRepairService.startRepair(uid, characterId, setProgress);
    setResultStatus(success ? 'success' : 'fail');
    setPhase('result');
  };

  const handleRetry = () => {
    setPhase('intro');
    setResultStatus(null);
  };

  const content = (
    <div className={`flex flex-col gap-4 text-[#0a0a0a] text-sm ${isWindowed ? 'p-0' : 'p-4'}`}>
      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`flex flex-col items-center border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] bg-white ${compact ? 'gap-3 py-3 p-3' : 'gap-6 py-6 p-6'}`}>
            <div className={compact ? 'text-4xl' : 'text-6xl'}>💾</div>
            <div className="text-center">
              <h2 className="font-bold mb-2">Nenhum disco detectado no Drive A:</h2>
              <p className="text-xs text-[#808080]">Por favor, insira o disquete magnético corrompido fisicamente no leitor para iniciar a análise.</p>
            </div>
            <button onClick={handleInsertDisk} className="px-6 py-2 bg-[#c0c0c0] border-2 border-transparent shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] font-bold outline-hidden focus:outline-black focus:outline-offset-2">
              Inserir Disquete
            </button>
          </motion.div>
        )}

        {(phase === 'loading' || phase === 'repairing') && (
          <div className={compact ? 'min-h-[120px]' : 'min-h-[200px]'}>
            <RetroLoading 
              message={phase === 'loading' ? 'Lendo setores do disco...' : 'Desmagnetizando MFT...'} 
              subMessage={`Progresso: ${Math.round(progress)}% - Analisando trilhas magnéticas`}
            />
          </div>
        )}

        {phase === 'viewer' && (
          <motion.div key="viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            <div className="flex items-start gap-4 mb-2">
              <div className="text-4xl">⚠️</div>
              <div>
                <h2 className="font-bold text-red-600">Erro de Leitura (CRC)</h2>
                <p className="text-xs mt-1">O formato do volume é irreconhecível. Os cabeçários magnéticos estão desativados por exposição severa a ímãs.</p>
              </div>
            </div>
            <div className={`bg-black font-mono text-[10px] p-2 overflow-hidden break-all border-2 border-red-800/60 shadow-[inset_0_0_30px_rgba(255,0,0,0.1),0_0_15px_rgba(255,0,0,0.2)] relative ${compact ? 'h-24' : 'h-40'}`}>
              {/* Scan line */}
              <div className="absolute left-0 right-0 h-6 pointer-events-none z-10" style={{
                background: 'linear-gradient(transparent, rgba(255,0,0,0.06), rgba(0,255,255,0.03), transparent)',
                animation: 'corrupted-scan 3s linear infinite',
              }} />
              {/* Noise overlay */}
              <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-15" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              }} />
              <style>{`
                @keyframes corrupted-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(calc(100% + 200px)); } }
                @keyframes disk-flicker { 0%,100% { opacity: 0.9; } 50% { opacity: 0.7; } 75% { opacity: 1; } }
              `}</style>
              <div className="relative z-5" style={{
                color: '#ff3333',
                textShadow: '0 0 5px rgba(255,0,0,0.4), 2px 0 1px rgba(0,255,255,0.3), -2px 0 1px rgba(255,0,0,0.3)',
                animation: 'disk-flicker 2s step-end infinite',
              }}>
                {scrambleText}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={handleRetry} className="px-4 py-1 bg-[#c0c0c0] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] outline-none">
                Cancelar
              </button>
              <button onClick={handleRepair} className="px-4 py-1 bg-[#c0c0c0] font-bold shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] border-2 border-black active:border-transparent active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] outline-hidden focus:outline-black focus:outline-offset-2">
                Arrumar Disquete
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'result' && resultStatus === 'fail' && (
         <motion.div key="fail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-6 border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] bg-white p-6">
            <div className="text-5xl">🛑</div>
            <div className="text-center">
              <h2 className="font-bold text-red-600 text-lg mb-2">Não é possível ler o disquete.</h2>
              <p className="text-sm">Os danos magnéticos foram extensos e o hardware ejetou o disco para previnir travamentos na agulha.</p>
              <p className="text-xs text-[#808080] mt-2">Certifique-se que o processo DiskRepair.exe está autorizado no Sistema Central.</p>
            </div>
            <button onClick={handleRetry} className="mt-4 px-6 py-2 bg-[#c0c0c0] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] font-bold outline-none">
              Tentar Novamente
            </button>
          </motion.div>
        )}

        {phase === 'result' && resultStatus === 'success' && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            <div className="flex items-center gap-4 mb-2 p-2 bg-[#000080] text-white">
              <div className="text-3xl">✅</div>
              <div>
                <h2 className="font-bold">Disquete Descorrompido!</h2>
                <p className="text-xs">O Master File Table foi reconstruído.</p>
              </div>
            </div>
            <div className="h-40 bg-white text-black font-mono text-xs p-3 overflow-y-auto border border-[#808080] shadow-[inset_1px_1px_#0a0a0a,inset_-1px_-1px_#fff] whitespace-pre-wrap">
               {intelRegistry.get('evidence-disk-01')?.textContent || 'RECUPERADO'}
            </div>
            <div className="text-xs text-center border-t border-[#808080] pt-2 mt-2">
              <p>O conteúdo do disquete agora pode ser copiado com segurança para a unidade central.</p>
            </div>
            {onBackToTerminal && (
              <div className="flex justify-end gap-2">
                <button onClick={onBackToTerminal} className="mt-2 px-4 py-1 bg-[#c0c0c0] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] outline-none">
                  Fechar
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isWindowed) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#008080] font-sans selection:bg-[#000080] selection:text-white touch-none select-none player-viewport safe-area-pad">
      <div className="fixed inset-0 pointer-events-none mix-blend-overlay opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMyMjIiPjwvcmVjdD48cGF0aCBkPSJNMCAwTDIgMk0yIDBMMCAyIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==')]" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-[95%] max-w-lg max-h-[calc(100dvh-2rem)] bg-[#c0c0c0] shadow-[inset_1px_1px_#dfdfdf,inset_2px_2px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] border border-[#0a0a0a] flex flex-col relative z-10 overflow-hidden min-h-0"
      >
        <div className="bg-linear-to-r from-[#000080] to-[#1084d0] p-1 flex items-center justify-between shadow-[inset_1px_1px_#dfdfdf,inset_-1px_-1px_#808080]">
          <div className="flex items-center gap-2 px-1">
            <span className="w-4 h-4 bg-white shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff] border border-[#0a0a0a] flex items-center justify-center text-[10px]">💾</span>
            <span className="text-white font-bold text-sm tracking-wide">Desmagnetizador de Disco v1.4</span>
          </div>
          <div className="flex gap-1">
             {onBackToTerminal && (
               <button onClick={onBackToTerminal} className="bg-[#c0c0c0] w-5 h-5 flex items-center justify-center font-bold text-xs shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] active:translate-y-px active:translate-x-px">
                 _
               </button>
             )}
             {onClose && (
               <button onClick={onClose} className="bg-[#c0c0c0] w-5 h-5 flex items-center justify-center font-bold text-xs shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#0a0a0a,inset_-2px_-2px_#808080] active:shadow-[inset_1px_1px_#0a0a0a,inset_2px_2px_#808080,inset_-1px_-1px_#fff] active:translate-y-px active:translate-x-px">
                 X
               </button>
             )}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{content}</div>
      </motion.div>
    </div>
  );
}
