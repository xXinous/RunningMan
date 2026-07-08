import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MediaLibraryPanel from './MediaLibraryPanel';
import { MediaAsset, MediaType } from '../../types/media';
import Screw from '../../components/player/Screw';
import OverlayPortal from './OverlayPortal';

interface MediaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  title?: string;
  allowedTypes?: MediaType[];
}

export default function MediaSelectorModal({ 
  isOpen, 
  onClose, 
  onSelect, 
  title = "Selecionar Mídia",
  allowedTypes 
}: MediaSelectorModalProps) {
  return (
    <OverlayPortal open={isOpen} onClose={onClose}>
      <AnimatePresence>
        {isOpen && (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-5xl max-h-[90vh] bg-surface-container-low border border-primary/20 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="absolute top-2 left-2"><Screw size="xs" /></div>
        <div className="absolute top-2 right-2"><Screw size="xs" /></div>
        <div className="absolute bottom-2 left-2"><Screw size="xs" /></div>
        <div className="absolute bottom-2 right-2"><Screw size="xs" /></div>

        {/* Header */}
        <div className="px-8 py-5 border-b border-primary/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">perm_media</span>
            <h3 className="font-display font-bold text-white uppercase tracking-widest">{title}</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-industrial-silver/40 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <MediaLibraryPanel 
            selectionMode 
            allowedTypes={allowedTypes} 
            onSelect={(asset) => {
              onSelect(asset);
              onClose();
            }} 
          />
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-primary/10 bg-black/20 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-[10px] font-display font-bold text-industrial-silver/40 hover:text-white uppercase tracking-widest transition-colors"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
}
