import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';

type ModalVariant = 'confirm' | 'alert';
interface ModalState {
  open: boolean;
  variant: ModalVariant;
  title: string;
  message: string;
  confirmLabel?: string;
  resolve?: (v: boolean) => void;
}
interface ConfirmModalProps {
  state: ModalState;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ state, onConfirm, onCancel }: ConfirmModalProps) {
  const isDanger = state.title.toLowerCase().includes('atenção') || state.title.toLowerCase().includes('delete') || state.title.toLowerCase().includes('apagar') || state.title.toLowerCase().includes('zerar') || state.title.toLowerCase().includes('reset') || state.title.toLowerCase().includes('excluir') || state.title.toLowerCase().includes('remover');
  const confirmRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (state.open) setTimeout(() => confirmRef.current?.focus(), 50);
  }, [state.open]);

  return (
    <OverlayPortal open={state.open} onClose={onCancel}>
    <AnimatePresence>
      {state.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="bg-[#222] border-8 border-[#1a1a1a] w-full max-w-md rounded-[32px] shadow-2xl flex flex-col relative overflow-hidden font-chakra"
          >
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />

            {/* Header */}
            <div className={`px-10 py-6 border-b-4 relative z-10 flex items-center gap-4 bg-black/40 ${isDanger ? 'border-red-800/30' : 'border-[#1a1a1a]'}`}>
              <div className={`p-2 rounded-sm border-2 ${isDanger ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                <span className="material-symbols-outlined text-lg">
                  {isDanger ? 'report' : 'info'}
                </span>
              </div>
              <h2 className={`font-black text-xs uppercase tracking-[0.2em] ${isDanger ? 'text-red-400' : 'text-white'}`}>{state.title}</h2>
            </div>

            {/* Content */}
            <div className="px-10 py-8 relative z-10">
              <p className="text-zinc-400 text-sm font-bold uppercase leading-relaxed tracking-wide">{state.message}</p>
            </div>

            {/* Actions */}
            <div className="px-10 pb-10 flex gap-6 relative z-10">
              {state.variant === 'confirm' && (
                <button
                  onClick={onCancel}
                  className="flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-all bg-[#333] hover:bg-[#444] rounded-sm active:scale-95"
                >
                  ABORTAR
                </button>
              )}
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className={`flex-1 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all rounded-sm active:scale-95 shadow-lg ${
                  isDanger
                    ? 'bg-red-700 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'bg-primary hover:bg-primary-container text-black glow-orange'
                }`}
              >
                {state.confirmLabel ?? (state.variant === 'confirm' ? 'CONFIRMAR' : 'ENTENDIDO')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </OverlayPortal>
  );
}

export function useModal() {
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    variant: 'alert',
    title: '',
    message: '',
  });
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const showConfirm = useCallback((title: string, message: string, confirmLabel?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalState({ open: true, variant: 'confirm', title, message, confirmLabel });
    });
  }, []);
  const showAlert = useCallback((title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = (v: boolean) => { resolve(); };
      setModalState({ open: true, variant: 'alert', title, message });
    });
  }, []);
  const handleConfirm = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.(true);
  }, []);
  const handleCancel = useCallback(() => {
    setModalState((s) => ({ ...s, open: false }));
    resolveRef.current?.(false);
  }, []);
  const modal = (
    <ConfirmModal state={modalState} onConfirm={handleConfirm} onCancel={handleCancel} />
  );
  return { showConfirm, showAlert, modal };
}
