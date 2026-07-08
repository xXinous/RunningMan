import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import RetroSpinner from '../../../components/player/RetroSpinner';
import Screw from '../../../components/player/Screw';
import OverlayPortal from '../OverlayPortal';

interface MediaUploadZoneProps {
  onUpload: (files: FileList) => Promise<void>;
  uploading: boolean;
  uploadProgress: number;
  disabled?: boolean;
  /** Oculta a zona de drag-and-drop (ex.: modo seleção no modal). */
  hideDropZone?: boolean;
  /** Texto do botão de upload rápido. */
  uploadButtonLabel?: string;
}

export default function MediaUploadZone({
  onUpload,
  uploading,
  uploadProgress,
  disabled = false,
  hideDropZone = false,
  uploadButtonLabel = 'NOVO_UPLOAD',
}: MediaUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled || uploading) return;
    await onUpload(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {uploading && (
        <OverlayPortal open={uploading}>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex flex-col items-center justify-center gap-6">
            <RetroSpinner />
            <div className="space-y-2 text-center">
              <div className="text-primary font-display font-bold uppercase tracking-[0.4em] animate-pulse text-lg">
                Transferindo_Dados...
              </div>
              <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-primary/10">
                <motion.div
                  className="h-full bg-primary glow-orange"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="text-[10px] font-display font-bold text-industrial-silver/40 tracking-widest uppercase">
                {Math.round(uploadProgress)}% COMPLETO
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}

      <div className="flex flex-wrap items-center gap-3 justify-end">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          multiple
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex items-center gap-2 bg-primary hover:bg-primary-container text-black px-5 py-2.5 rounded-sm font-display font-bold text-[10px] tracking-widest transition-all active:scale-95 glow-orange shadow-lg disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-base">
            {uploading ? 'sync' : 'add_circle'}
          </span>
          {uploadButtonLabel}
        </button>
      </div>

      {!hideDropZone && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !uploading) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`relative border-2 border-dashed rounded-sm p-10 text-center transition-all group overflow-hidden ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-primary/10 bg-black/20 hover:border-primary/20 hover:bg-black/40'
          } ${disabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="absolute top-2 left-2 opacity-20">
            <Screw size="xs" />
          </div>
          <div className="absolute top-2 right-2 opacity-20">
            <Screw size="xs" />
          </div>
          <div className="absolute bottom-2 left-2 opacity-20">
            <Screw size="xs" />
          </div>
          <div className="absolute bottom-2 right-2 opacity-20">
            <Screw size="xs" />
          </div>

          <div className="relative inline-block mb-3">
            <span
              className={`material-symbols-outlined text-4xl transition-all duration-300 ${
                isDragOver ? 'text-primary scale-110' : 'text-industrial-silver/20 group-hover:text-primary/40'
              }`}
            >
              {isDragOver ? 'downloading' : 'cloud_upload'}
            </span>
          </div>
          <p className="text-industrial-silver/60 text-[10px] font-display font-bold uppercase tracking-[0.3em] group-hover:text-industrial-silver/80">
            {isDragOver ? 'SOLTAR AGORA' : 'ARRASTAR E SOLTAR ARQUIVOS PARA O ACERVO'}
          </p>
          <p className="text-industrial-silver/30 text-[9px] font-display uppercase tracking-widest mt-2">
            Arquivos entram como órfãos até você completar os metadados
          </p>
        </div>
      )}
    </>
  );
}
