import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import { intelRegistry } from '../../data/intel_registry';
import { intelService } from '../../services/IntelService';
import type { IntelItem, IntelType, AccessLevel, VisualCategory, VideoFormat } from '../../types/intel';
import Screw from '../../components/player/Screw';
import MediaSelectorModal from './MediaSelectorModal';
import MediaUploadZone from './media/MediaUploadZone';
import { MediaAsset } from '../../types/media';
import { mediaService } from '../../services/MediaService';
import { extractYoutubeId, isYoutubeUrl, youtubeWatchUrl } from '../../lib/youtube';
import OverlayPortal from './OverlayPortal';
import { useModal } from './ConfirmModal';
import {
  INTEL_TYPE_OPTIONS,
  INTEL_STATUS_FILTER_LABELS,
  accessLevelClass,
  accessLevelLabel,
  formatFileSize,
  getIntelCatalogStatus,
  intelCatalogStatusClass,
  intelCatalogStatusLabel,
  matchesIntelStatusFilter,
  type IntelStatusFilter,
} from '../lib/intelDisplay';

/**
 * IntelCreatorPanel — Interface administrativa para criar e gerenciar 
 * itens no IntelRegistry em tempo real.
 */

const TYPE_OPTIONS = INTEL_TYPE_OPTIONS;

const LEVEL_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: 1, label: 'RESTRITO' },
  { value: 2, label: 'CONFIDENCIAL' },
  { value: 3, label: 'SIGILOSO' },
  { value: 4, label: 'TOP SECRET' },
];

const CATEGORY_OPTIONS: VisualCategory[] = ['locais', 'pistas', 'pessoas', 'itens'];

const EMPTY_ITEM: Omit<IntelItem, 'id'> = {
  type: 'TEXT',
  level: 2,
  title: '',
  description: '',
  textContent: '',
  mediaUrl: '',
  metadata: {
    npc: '',
    artist: '',
    chapter: '',
    duration: 0,
    isSecret: false,
    videoFormat: 'VHS' as VideoFormat,
  },
};

const detectTypeFromUrl = (url: string): IntelType => {
  const cleanUrl = url.split('?')[0]; // Remove query params
  const ext = cleanUrl.split('.').pop()?.toLowerCase();
  if (!ext) return 'TEXT';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'AUDIO';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'VIDEO';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'VISUAL';
  if (['txt'].includes(ext)) return 'TEXT';
  return 'TEXT';
};

const detectTypeFromUrlWithYoutube = (url: string): IntelType => {
  if (isYoutubeUrl(url)) return 'VIDEO';
  return detectTypeFromUrl(url);
};

export default function IntelCreatorPanel() {
  const { showConfirm, modal } = useModal();
  const [allItems, setAllItems] = useState<IntelItem[]>(() => intelRegistry.getAll());
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<IntelType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<IntelStatusFilter>('all');
  const [mediaAssetMap, setMediaAssetMap] = useState<Record<string, MediaAsset>>({});
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<IntelItem | null>(null);
  const [formData, setFormData] = useState<Omit<IntelItem, 'id'> & { id: string }>({ id: '', ...EMPTY_ITEM });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [qrCodeModal, setQrCodeModal] = useState<IntelItem | null>(null);
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const refreshItems = useCallback(() => {
    setAllItems(intelRegistry.getAll());
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const unsub = intelService.subscribeToIntelRegistry((items) => {
      setAllItems(items);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = mediaService.subscribeToMedia((assets) => {
      const map: Record<string, MediaAsset> = {};
      assets.forEach((a) => {
        map[a.id] = a;
      });
      setMediaAssetMap(map);
    });
    return unsub;
  }, []);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const asset = mediaAssetMap[item.id];
      const matchesType = filterType === 'ALL' || item.type === filterType;
      const matchesStatus = matchesIntelStatusFilter(item, statusFilter, asset);
      const matchesSearch =
        search === '' ||
        (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [allItems, search, filterType, statusFilter, mediaAssetMap]);
  const handleNewItem = () => {
    setEditingItem(null);
    setFormData({ id: `item-${Date.now()}`, ...EMPTY_ITEM });
    setShowEditor(true);
    setFeedback(null);
  };

  const handleMediaSelect = (asset: MediaAsset) => {
    const keepVideo = formData.type === 'VIDEO' || asset.type === 'video';
    const detectedType = keepVideo ? 'VIDEO' : detectTypeFromUrlWithYoutube(asset.url);
    setFormData(prev => ({
      ...prev,
      mediaUrl: asset.url,
      type: detectedType,
      title: prev.title || asset.metadata.title || asset.filename,
      metadata: {
        ...prev.metadata,
        videoSource: asset.type === 'video' ? 'upload' : prev.metadata?.videoSource,
        youtubeId: undefined,
        duration: asset.metadata.duration || prev.metadata?.duration,
      },
    }));
  };

  const handleMediaFileUpload = async (files: FileList | null) => {
    if (!files?.[0]) return;
    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isAudio && !isImage) {
      setFeedback({ type: 'error', text: 'Selecione áudio, imagem ou vídeo.' });
      return;
    }
    setMediaUploading(true);
    setFeedback(null);
    try {
      const asset = await mediaService.uploadMedia(file, 'gm.mpg');
      const detectedType: IntelType = isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'VISUAL';
      setFormData((prev) => ({
        ...prev,
        type: detectedType,
        mediaUrl: asset.url,
        title: prev.title || asset.metadata.title || file.name.replace(/\.[^/.]+$/, ''),
        metadata: {
          ...prev.metadata,
          videoSource: isVideo ? 'upload' : prev.metadata?.videoSource,
          youtubeId: isVideo ? undefined : prev.metadata?.youtubeId,
          duration: asset.metadata.duration || prev.metadata?.duration,
        },
      }));
      if (isVideo) setYoutubeInput('');
      setFeedback({ type: 'success', text: 'Arquivo enviado com sucesso.' });
    } catch (err) {
      console.error('[IntelCreator] Media upload failed:', err);
      setFeedback({ type: 'error', text: 'Falha no upload.' });
    } finally {
      setMediaUploading(false);
      if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
    }
  };

  const handleBulkUpload = async (files: FileList) => {
    setBulkUploading(true);
    setBulkUploadProgress(0);
    setFeedback(null);
    try {
      for (let i = 0; i < files.length; i++) {
        await mediaService.uploadMedia(files[i], 'gm.mpg', (progress) => {
          setBulkUploadProgress(progress);
        });
      }
      setFeedback({
        type: 'success',
        text: `✓ ${files.length} arquivo(s) enviado(s). Filtre por Órfãos para completar metadados.`,
      });
    } catch (err) {
      console.error('[Acervo] Bulk upload failed:', err);
      setFeedback({ type: 'error', text: 'Falha no upload de um ou mais arquivos.' });
    } finally {
      setBulkUploading(false);
      setBulkUploadProgress(0);
    }
  };

  const handleDeleteFileOnly = async (item: IntelItem) => {
    const asset = mediaAssetMap[item.id];
    if (!asset?.storagePath) {
      setFeedback({ type: 'error', text: 'Este item não possui arquivo no Storage.' });
      return;
    }
    const ok = await showConfirm(
      'Remover arquivo',
      `Remover apenas o arquivo "${asset.filename}" do Storage? A entrada no acervo também será removida.`,
      'Remover arquivo'
    );
    if (!ok) return;
    try {
      await mediaService.deleteMedia(asset);
      intelRegistry.unregister(item.id);
      refreshItems();
      setFeedback({ type: 'success', text: `✓ Arquivo de "${item.title}" removido.` });
    } catch (err) {
      console.error('[Acervo] File delete failed:', err);
      setFeedback({ type: 'error', text: 'Falha ao remover arquivo.' });
    }
  };

  const handleDeleteItem = async (item: IntelItem) => {
    const ok = await showConfirm(
      'Remover Intel',
      `Remover "${item.title}" do catálogo? Jogadores que já possuem o item mantêm no inventário. O arquivo no Storage não será removido automaticamente.`,
      'Remover'
    );
    if (!ok) return;
    const deleteFile = await showConfirm(
      'Arquivo de mídia',
      'Deseja também remover o arquivo do Storage (se existir)?',
      'Remover arquivo'
    );
    setIsLoading(true);
    try {
      await intelService.deleteIntel(item, { deleteStorageFile: deleteFile });
      refreshItems();
      setFeedback({ type: 'success', text: `✓ "${item.title}" removido do acervo.` });
    } catch (err) {
      console.error('[IntelCreator] Delete failed:', err);
      setFeedback({ type: 'error', text: 'Falha ao remover item.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoFileUpload = handleMediaFileUpload;

  const handleApplyYoutubeLink = () => {
    const url = youtubeInput.trim();
    const id = extractYoutubeId(url);
    if (!id) {
      setFeedback({ type: 'error', text: 'URL do YouTube inválida.' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      type: 'VIDEO',
      mediaUrl: youtubeWatchUrl(id),
      title: prev.title || `YouTube — ${id}`,
      metadata: {
        ...prev.metadata,
        videoSource: 'youtube',
        youtubeId: id,
      },
    }));
    setFeedback({ type: 'success', text: 'Link do YouTube vinculado.' });
  };

  const handleEditItem = (item: IntelItem) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      type: item.type,
      level: item.level,
      title: item.title,
      description: item.description,
      textContent: item.textContent || '',
      mediaUrl: item.mediaUrl || '',
      campaignId: item.campaignId,
      metadata: {
        npc: item.metadata?.npc || '',
        artist: item.metadata?.artist || '',
        chapter: item.metadata?.chapter || '',
        duration: item.metadata?.duration || 0,
        isSecret: item.metadata?.isSecret || false,
        visualCategory: item.metadata?.visualCategory,
        imageUrl: item.metadata?.imageUrl || '',
        icon: item.metadata?.icon || '',
        hint: item.metadata?.hint || '',
        unlockCondition: item.metadata?.unlockCondition || '',
        achievementRuleId: item.metadata?.achievementRuleId || '',
        videoFormat: item.metadata?.videoFormat || 'VHS',
        videoSource: item.metadata?.videoSource,
        youtubeId: item.metadata?.youtubeId,
      },
    });
    setYoutubeInput(
      item.metadata?.youtubeId
        ? youtubeWatchUrl(item.metadata.youtubeId)
        : item.type === 'VIDEO' && isYoutubeUrl(item.mediaUrl || '')
          ? item.mediaUrl || ''
          : ''
    );
    setShowEditor(true);
    setFeedback(null);
  };

  const handleSave = async () => {
    if (!formData.id.trim() || !formData.title.trim()) {
      setFeedback({ type: 'error', text: 'ID e Título são obrigatórios.' });
      return;
    }
    const cleanMeta = { ...formData.metadata };

    if (formData.type === 'VIDEO' && formData.mediaUrl) {
      const ytId = extractYoutubeId(formData.mediaUrl);
      if (ytId) {
        cleanMeta.videoSource = 'youtube';
        cleanMeta.youtubeId = ytId;
      } else if (!cleanMeta.videoSource) {
        cleanMeta.videoSource = 'upload';
        delete cleanMeta.youtubeId;
      }
    }

    Object.keys(cleanMeta).forEach(key => {
      const val = (cleanMeta as any)[key];
      if (val === '' || val === 0 || val === false || val === undefined) {
        delete (cleanMeta as any)[key];
      }
    });
    const intelItem: IntelItem = {
      id: formData.id.trim(),
      type: formData.type,
      level: formData.level,
      title: formData.title.trim(),
      description: formData.description.trim(),
      ...(formData.textContent ? { textContent: formData.textContent } : {}),
      ...(formData.mediaUrl ? { mediaUrl: formData.mediaUrl } : {}),
      ...(formData.campaignId ? { campaignId: formData.campaignId } : {}),
      ...(Object.keys(cleanMeta).length > 0 ? { metadata: cleanMeta } : {}),
    };

    setIsLoading(true);
    try {
      await intelService.persistChanges(intelItem);
      refreshItems();
      setShowEditor(false);
      setFeedback({ type: 'success', text: `✓ "${intelItem.title}" ${editingItem ? 'atualizado' : 'registrado'} com sucesso no sistema e nuvem.` });
    } catch (err) {
      console.error("Save error:", err);
      setFeedback({ type: 'error', text: 'Falha ao persistir alterações no Firebase.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportJSON = () => setShowExport(true);

  const exportJSON = useMemo(() => JSON.stringify(intelRegistry.getAll(), null, 2), [showExport, allItems]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      if (field === 'mediaUrl' && value) {
        newData.type = detectTypeFromUrl(value);
      }
      return newData;
    });
  };
  const updateMeta = (field: string, value: any) => setFormData(prev => ({ ...prev, metadata: { ...prev.metadata, [field]: value } }));

  const typeStats = useMemo(() => {
    const stats: Record<string, number> = { AUDIO: 0, TEXT: 0, VISUAL: 0, META: 0, VIDEO: 0, total: 0 };
    allItems.forEach(item => { stats[item.type]++; stats.total++; });
    return stats;
  }, [allItems]);

  // QR Code Helpers
  const getQrCodeSvgDataUri = () => {
    const container = document.getElementById("qr-code-container-intel");
    if (!container) return null;
    const svgElement = container.querySelector("svg");
    if (!svgElement) return null;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDownloadQrCode = () => {
    const dataUri = getQrCodeSvgDataUri();
    if (!dataUri) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const padding = 20;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `qrcode_${qrCodeModal?.id || 'intel'}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = dataUri;
  };

  const handleCopyQrCode = () => {
    const dataUri = getQrCodeSvgDataUri();
    if (!dataUri) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const padding = 20;
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, padding, padding);
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              setFeedback({ type: 'success', text: '✓ QR Code copiado para a área de transferência!' });
            } catch (err) {
              console.error('Failed to copy', err);
              setFeedback({ type: 'error', text: 'Falha ao copiar QR Code. Verifique as permissões.' });
            }
          }
        }, 'image/png');
      }
    };
    img.src = dataUri;
  };

  return (
    <section className="space-y-8 font-sans">
      {modal}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-8 bg-primary shadow-[0_0_10px_rgba(255,140,0,0.4)]" />
          <div>
            <h2 className="font-display font-bold uppercase tracking-widest text-lg text-white flex items-center gap-3">
              Acervo
              {isLoading && (
                <span className="inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              )}
            </h2>
            <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">
              Intel, arquivos e metadados em um só lugar
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExportJSON} className="bg-surface-container-high text-industrial-silver/60 px-6 py-3 text-[11px] font-display font-bold border border-white/5 uppercase hover:bg-white/5 transition-all rounded-sm active:scale-95 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">download</span> EXPORTAR JSON
          </button>
          <button onClick={handleNewItem} className="bg-primary text-black px-6 py-3 text-[11px] font-display font-bold border border-primary/20 uppercase hover:bg-primary-container transition-all rounded-sm active:scale-95 glow-orange shadow-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-base">add_circle</span> NOVA INTEL
          </button>
        </div>
      </div>

      <MediaUploadZone
        onUpload={handleBulkUpload}
        uploading={bulkUploading}
        uploadProgress={bulkUploadProgress}
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface-container-low border border-primary/20 p-5 group">
          <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mb-1">TOTAL REGISTROS</p>
          <p className="text-3xl font-display font-bold text-primary tracking-tighter">{typeStats.total}</p>
        </div>
        {TYPE_OPTIONS.map(t => (
          <div key={t.value} className="bg-surface-container-low border border-white/5 p-5 group hover:border-primary/20 transition-all">
            <div className="flex items-center gap-2 mb-1">
               <span className="material-symbols-outlined text-base text-industrial-silver/20 group-hover:text-primary transition-colors">{t.icon}</span>
               <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest">{t.label}</p>
            </div>
            <p className="text-3xl font-display font-bold text-white/40 group-hover:text-white transition-colors tracking-tighter">{typeStats[t.value]}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      <MediaSelectorModal 
        isOpen={isMediaSelectorOpen}
        onClose={() => setIsMediaSelectorOpen(false)}
        onSelect={handleMediaSelect}
        allowedTypes={formData.type === 'VIDEO' ? ['video'] : undefined}
        title={formData.type === 'VIDEO' ? 'Selecionar Vídeo' : 'Selecionar Mídia'}
      />
      {feedback && (
        <div className={`p-4 border text-[11px] font-display font-bold uppercase tracking-[0.2em] rounded-sm shadow-lg animate-in slide-in-from-top-4 ${feedback.type === 'success' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}>
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full animate-pulse ${feedback.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
             {feedback.text}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(INTEL_STATUS_FILTER_LABELS) as IntelStatusFilter[]).map((key) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 text-[10px] font-display font-bold uppercase tracking-widest border transition-all rounded-sm ${
                statusFilter === key
                  ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                  : 'border-white/5 text-industrial-silver/30 hover:text-industrial-silver/60 hover:bg-white/5'
              }`}
            >
              {INTEL_STATUS_FILTER_LABELS[key]}
            </button>
          ))}
        </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center bg-black/20 p-4 border border-white/5">
        <div className="relative w-full lg:max-w-xs group">
           <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-industrial-silver/20 text-base group-focus-within:text-primary transition-colors">search</span>
           <input
             type="text"
             placeholder="BUSCAR ID OU TÍTULO..."
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full bg-surface-container-lowest border border-white/5 text-[11px] font-display font-bold uppercase tracking-[0.2em] px-10 py-3 text-white focus:border-primary/40 outline-none rounded-sm transition-all"
           />
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`flex-1 lg:flex-none px-6 py-3 text-[10px] font-display font-bold uppercase tracking-widest border transition-all rounded-sm ${filterType === 'ALL' ? 'border-primary text-primary bg-primary/10' : 'border-white/5 text-industrial-silver/30 hover:text-industrial-silver/60 hover:bg-white/5'}`}
          >
            TODOS
          </button>
          {TYPE_OPTIONS.map(t => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`flex-1 lg:flex-none px-5 py-3 text-[10px] font-display font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-2 rounded-sm ${filterType === t.value ? 'border-primary text-primary bg-primary/10' : 'border-white/5 text-industrial-silver/30 hover:text-industrial-silver/60 hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Items Grid */}
      <div className="bg-surface-container-low border border-white/5 overflow-hidden shadow-xl">
        <div className="hidden lg:grid grid-cols-[72px_1fr_100px_80px_100px_100px_100px_minmax(140px,1fr)] gap-0 text-[10px] font-display font-bold uppercase text-industrial-silver/40 tracking-[0.2em] px-8 py-4 border-b border-white/5 bg-black/40">
          <span>TIPO</span>
          <span>IDENTIFICADOR / TÍTULO</span>
          <span>STATUS</span>
          <span>ARQUIVO</span>
          <span>CAPÍTULO</span>
          <span>NPC</span>
          <span>ACESSO</span>
          <span className="text-right">AÇÕES</span>
        </div>
        <div className="max-h-[600px] overflow-y-auto divide-y divide-white/5 custom-scrollbar bg-black/10">
          {filteredItems.length === 0 ? (
            <div className="p-24 text-center text-industrial-silver/20 text-[12px] font-display font-bold uppercase tracking-[0.4em]">
              SINAL DE INTEL INEXISTENTE
            </div>
          ) : (
            filteredItems.map((item) => {
              const asset = mediaAssetMap[item.id];
              const catalogStatus = getIntelCatalogStatus(item, asset);
              const isOrphan = catalogStatus === 'orphan';
              return (
              <div key={item.id} className="grid grid-cols-1 lg:grid-cols-[72px_1fr_100px_80px_100px_100px_100px_minmax(140px,1fr)] gap-4 lg:gap-0 px-8 py-5 items-center group hover:bg-primary/5 transition-all border-b border-white/5 lg:border-none">
                <div className="flex items-center gap-3 lg:block">
                  <span className="material-symbols-outlined text-xl text-industrial-silver/20 group-hover:text-primary transition-colors">
                    {TYPE_OPTIONS.find(t => t.value === item.type)?.icon || 'description'}
                  </span>
                  <span className="lg:hidden text-[10px] font-display font-bold text-industrial-silver/40 uppercase">{item.type}</span>
                </div>
                
                <div className="min-w-0 lg:pr-4">
                  <p className="text-sm font-display font-bold text-white truncate uppercase tracking-wide group-hover:text-primary transition-colors">{item.title}</p>
                  <p className="text-[10px] font-mono text-industrial-silver/20 truncate font-bold uppercase mt-0.5 tracking-tighter">{item.id}</p>
                  {isOrphan && (
                    <button
                      type="button"
                      onClick={() => handleEditItem(item)}
                      className="mt-2 text-[8px] font-display font-bold uppercase tracking-widest text-primary hover:text-primary-container transition-colors"
                    >
                      Completar metadados →
                    </button>
                  )}
                </div>

                <div className="flex lg:block items-center justify-between">
                  <span className="lg:hidden text-[9px] font-display font-bold text-industrial-silver/20 uppercase">Status:</span>
                  <span className={`text-[8px] font-display font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${intelCatalogStatusClass(catalogStatus)}`}>
                    {intelCatalogStatusLabel(catalogStatus)}
                  </span>
                </div>

                <div className="flex lg:block items-center justify-between">
                  <span className="lg:hidden text-[9px] font-display font-bold text-industrial-silver/20 uppercase">Arquivo:</span>
                  <span className="text-[9px] font-mono text-industrial-silver/40 uppercase">
                    {asset?.size ? formatFileSize(asset.size) : '—'}
                  </span>
                </div>
                
                <div className="flex lg:block items-center justify-between">
                  <span className="lg:hidden text-[9px] font-display font-bold text-industrial-silver/20 uppercase">Capítulo:</span>
                  <span className="text-[10px] font-display font-bold text-industrial-silver/40 truncate uppercase tracking-widest">{item.metadata?.chapter || '---'}</span>
                </div>

                <div className="flex lg:block items-center justify-between">
                  <span className="lg:hidden text-[9px] font-display font-bold text-industrial-silver/20 uppercase">NPC:</span>
                  <span className="text-[10px] font-display font-bold text-industrial-silver/40 truncate uppercase tracking-widest">{item.metadata?.npc || '---'}</span>
                </div>

                <div className="flex lg:block items-center justify-between">
                  <span className="lg:hidden text-[9px] font-display font-bold text-industrial-silver/20 uppercase">Acesso:</span>
                   <span className={`text-[9px] font-display font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${accessLevelClass(item.level)}`}>
                     {accessLevelLabel(item.level)}
                   </span>
                </div>

                <div className="text-right border-t border-white/5 lg:border-none pt-4 lg:pt-0 flex items-center justify-end gap-1 flex-wrap">
                  {item.type === 'AUDIO' && item.mediaUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const a = new Audio(item.mediaUrl!);
                        a.play();
                      }}
                      className="p-2.5 text-industrial-silver/30 hover:text-primary hover:bg-primary/10 rounded-sm transition-all material-symbols-outlined text-xl"
                      title="Ouvir prévia"
                    >
                      play_arrow
                    </button>
                  )}
                  <button
                    onClick={() => setQrCodeModal(item)}
                    className="p-2.5 text-industrial-silver/30 hover:text-primary hover:bg-primary/10 rounded-sm transition-all material-symbols-outlined text-xl"
                    title="Gerar QR Code"
                  >
                    qr_code_2
                  </button>
                  <button
                    onClick={() => handleEditItem(item)}
                    className="p-2.5 text-industrial-silver/30 hover:text-primary hover:bg-primary/10 rounded-sm transition-all material-symbols-outlined text-xl"
                    title="Editar Registro"
                  >
                    edit_note
                  </button>
                  {asset?.storagePath && (
                    <button
                      onClick={() => handleDeleteFileOnly(item)}
                      className="p-2.5 text-industrial-silver/30 hover:text-amber-400 hover:bg-amber-500/10 rounded-sm transition-all material-symbols-outlined text-xl"
                      title="Remover só arquivo"
                    >
                      folder_delete
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="p-2.5 text-industrial-silver/30 hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-all material-symbols-outlined text-xl"
                    title="Remover do Acervo"
                  >
                    delete
                  </button>
                </div>
                </div>
              );
            })
                )}
                </div>
                </div>

                {qrCodeModal && (
                <OverlayPortal open={!!qrCodeModal} onClose={() => setQrCodeModal(null)}>
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
                <div className="bg-surface-container-low border border-primary/30 p-8 w-full max-w-sm rounded-sm shadow-2xl flex flex-col items-center relative">
                <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
                ASSINATURA-DIGITAL-INTEL
                </div>

                <h3 className="font-display font-bold text-xl mb-8 text-white uppercase tracking-widest text-center mt-2">
                Gerador de <span className="text-primary">QR Code</span>
                </h3>

                <div id="qr-code-container-intel" className="bg-white p-6 rounded-sm mb-8 shadow-inner ring-4 ring-primary/20">
                <QRCode value={qrCodeModal.id} size={200} />
                </div>

                <div className="w-full bg-black/40 p-3 rounded-sm border border-primary/10 mb-8 text-center">
                <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-1">Identificador Único</p>
                <p className="font-mono text-[10px] text-primary tracking-widest break-all font-bold">
                {qrCodeModal.id}
                </p>
                </div>

                <div className="flex gap-3 mb-6 w-full">
                <button
                onClick={handleCopyQrCode}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-display font-bold border border-primary/20 text-industrial-silver/60 hover:text-primary hover:bg-primary/5 transition-all rounded-sm uppercase tracking-widest"
                >
                <span className="material-symbols-outlined text-base">content_copy</span>
                Copiar
                </button>
                <button
                onClick={handleDownloadQrCode}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-display font-bold border border-primary/20 text-industrial-silver/60 hover:text-primary hover:bg-primary/5 transition-all rounded-sm uppercase tracking-widest"
                >
                <span className="material-symbols-outlined text-base">download</span>
                Salvar
                </button>
                </div>

                <button
                onClick={() => setQrCodeModal(null)}
                className="px-10 py-4 text-[11px] font-display font-bold text-industrial-silver/40 hover:text-white transition-all w-full border-t border-primary/5 uppercase tracking-[0.3em]"
                >
                Fechar Terminal
                </button>
                </div>
                </div>
                </OverlayPortal>
                )}

                {/* Editor Modal */}

      <OverlayPortal open={showEditor} onClose={() => setShowEditor(false)}>
      {showEditor && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
          <div className="bg-surface-container-low border border-primary/30 w-full max-w-2xl rounded-sm shadow-2xl flex flex-col max-h-[90vh] relative">
            <div className="absolute -top-3 left-6 bg-primary px-2 py-0.5 text-[10px] font-display font-bold text-black tracking-widest uppercase">
              {editingItem ? 'ATUALIZAÇÃO-DE-REGISTRO' : 'NOVA-ENTRADA-DE-INTEL'}
            </div>
            
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-black/40">
              <div className="mt-2">
                <h3 className="font-display font-bold text-2xl text-white uppercase tracking-tighter">
                  {editingItem ? 'Ajustar' : 'Injetar'} <span className="text-primary">Propriedades Intel</span>
                </h3>
                <p className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest mt-1">
                  {editingItem ? `Ponto de Acesso: ${editingItem.id}` : 'Registro de nova entrada no servidor mestre'}
                </p>
              </div>
              <button onClick={() => setShowEditor(false)} className="p-3 text-industrial-silver/20 hover:text-white transition-all rounded-sm material-symbols-outlined">close</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="group">
                  <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-primary transition-colors">Identificador ID (Permanente)</label>
                  <input
                    value={formData.id}
                    onChange={e => updateField('id', e.target.value)}
                    disabled={!!editingItem}
                    className="w-full bg-surface-container-lowest border-none py-4 px-4 text-white font-mono text-sm tracking-widest disabled:opacity-20 outline-none transition-all uppercase"
                    placeholder="intel_nome_do_item"
                  />
                  <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                </div>
                <div className="group">
                  <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-primary transition-colors">Vínculo com Campanha</label>
                  <input
                    value={formData.campaignId || ''}
                    onChange={e => updateField('campaignId', e.target.value)}
                    className="w-full bg-surface-container-lowest border-none py-4 px-4 text-white font-mono text-sm tracking-widest outline-none transition-all"
                    placeholder="id_da_missao"
                  />
                  <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] block">Classificação de Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {TYPE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => updateField('type', t.value)}
                      className={`flex-1 py-4 text-[10px] font-display font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-3 rounded-sm ${formData.type === t.value ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(255,140,0,0.1)]' : 'border-white/5 bg-black/20 text-industrial-silver/30 hover:border-white/10 hover:text-industrial-silver/60'}`}
                    >
                      <span className="material-symbols-outlined text-base">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] block">Nível de Autorização</label>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map(l => (
                    <button
                      key={l.value}
                      onClick={() => updateField('level', l.value)}
                      className={`flex-1 py-4 text-[10px] font-display font-bold uppercase tracking-widest border transition-all rounded-sm ${formData.level === l.value ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(255,140,0,0.1)]' : 'border-white/5 bg-black/20 text-industrial-silver/30 hover:border-white/10 hover:text-industrial-silver/60'}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="group">
                <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-primary transition-colors">Título Operacional</label>
                <input
                  value={formData.title}
                  onChange={e => updateField('title', e.target.value)}
                  className="w-full bg-surface-container-lowest border-none py-4 px-4 text-white font-display font-bold text-sm tracking-widest outline-none transition-all uppercase"
                  placeholder="NOME_DA_ENTRADA"
                />
                <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
              </div>

              <div className="group">
                <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-primary transition-colors">Resumo Executivo (Descrição)</label>
                <textarea
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  rows={2}
                  className="w-full bg-surface-container-lowest border-none py-4 px-4 text-white font-sans text-sm tracking-wide outline-none transition-all resize-none"
                  placeholder="Descrição breve para fins de identificação..."
                />
                <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
              </div>

              {formData.type === 'TEXT' && (
                <div className="group">
                  <label className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-primary transition-colors">Corpo do Documento Digital</label>
                  <textarea
                    value={formData.textContent || ''}
                    onChange={e => updateField('textContent', e.target.value)}
                    rows={8}
                    className="w-full bg-surface-container-lowest border-none py-4 px-4 text-primary font-mono text-sm tracking-wide outline-none transition-all resize-none shadow-inner"
                    placeholder="Insira o conteúdo textual sigiloso..."
                  />
                  <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                </div>
              )}

              {(formData.type === 'AUDIO' || formData.type === 'VISUAL') && (
                <div className="space-y-4 border border-white/5 bg-black/20 p-5 rounded-sm">
                  <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em]">
                    Mídia — {formData.type === 'AUDIO' ? 'Áudio' : 'Imagem'}
                  </p>
                  <input
                    ref={mediaFileInputRef}
                    type="file"
                    accept={formData.type === 'AUDIO' ? 'audio/*' : 'image/*'}
                    className="hidden"
                    onChange={(e) => handleMediaFileUpload(e.target.files)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={mediaUploading}
                      onClick={() => mediaFileInputRef.current?.click()}
                      className="py-4 border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-black transition-all rounded-sm flex items-center justify-center gap-2 font-display font-bold text-[9px] uppercase tracking-widest disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      {mediaUploading ? 'Enviando...' : 'Upload de Arquivo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMediaSelectorOpen(true)}
                      className="py-4 border border-white/10 bg-black/30 text-industrial-silver/60 hover:text-white hover:border-white/20 transition-all rounded-sm flex items-center justify-center gap-2 font-display font-bold text-[9px] uppercase tracking-widest"
                    >
                      <span className="material-symbols-outlined text-base">perm_media</span>
                      Biblioteca
                    </button>
                  </div>
                  <input
                    value={formData.mediaUrl || ''}
                    onChange={(e) => updateField('mediaUrl', e.target.value)}
                    className="w-full bg-surface-container-lowest border-none py-4 px-4 text-white font-mono text-sm tracking-widest outline-none transition-all"
                    placeholder="Ou cole a URL do arquivo..."
                  />
                </div>
              )}

              {formData.type === 'VIDEO' && (
                <div className="space-y-4 border border-white/5 bg-black/20 p-5 rounded-sm">
                  <p className="text-[9px] font-display font-bold text-industrial-silver/40 uppercase tracking-[0.2em]">
                    Fonte do Vídeo
                  </p>

                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => handleVideoFileUpload(e.target.files)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={mediaUploading}
                      onClick={() => videoFileInputRef.current?.click()}
                      className="py-4 border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-black transition-all rounded-sm flex items-center justify-center gap-2 font-display font-bold text-[9px] uppercase tracking-widest disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-base">upload_file</span>
                      {mediaUploading ? 'Enviando...' : 'Upload de Arquivo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMediaSelectorOpen(true)}
                      className="py-4 border border-white/10 bg-black/30 text-industrial-silver/60 hover:text-white hover:border-white/20 transition-all rounded-sm flex items-center justify-center gap-2 font-display font-bold text-[9px] uppercase tracking-widest"
                    >
                      <span className="material-symbols-outlined text-base">perm_media</span>
                      Biblioteca
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={youtubeInput}
                      onChange={(e) => setYoutubeInput(e.target.value)}
                      className="flex-1 bg-surface-container-lowest border-none py-3 px-4 text-white font-mono text-xs tracking-wide outline-none"
                      placeholder="https://youtube.com/watch?v=... ou youtu.be/..."
                    />
                    <button
                      type="button"
                      onClick={handleApplyYoutubeLink}
                      className="px-4 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all rounded-sm font-display font-bold text-[9px] uppercase tracking-widest shrink-0"
                    >
                      YouTube
                    </button>
                  </div>

                  {formData.mediaUrl && (
                    <div className="text-[9px] font-mono text-industrial-silver/40 truncate pt-1 border-t border-white/5">
                      {formData.metadata?.videoSource === 'youtube' ? (
                        <span className="text-red-400/80">[YOUTUBE]</span>
                      ) : (
                        <span className="text-primary/80">[UPLOAD]</span>
                      )}{' '}
                      {formData.mediaUrl}
                    </div>
                  )}

                  {formData.mediaUrl && formData.metadata?.videoSource !== 'youtube' && (
                    <div className="aspect-video bg-black border border-white/10 overflow-hidden max-h-48">
                      <video src={formData.mediaUrl} controls className="w-full h-full object-contain" preload="metadata" />
                    </div>
                  )}

                  {formData.metadata?.youtubeId && (
                    <div className="aspect-video bg-black border border-red-500/20 overflow-hidden max-h-48">
                      <iframe
                        src={`https://www.youtube.com/embed/${formData.metadata.youtubeId}`}
                        title="Preview YouTube"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-white/5 pt-8">
                <p className="text-[10px] font-display font-bold text-industrial-silver/60 uppercase tracking-[0.3em] mb-8">Metadados Sistêmicos</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="group">
                    <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary transition-colors">NPC RESPONSÁVEL</label>
                    <input value={formData.metadata?.npc || ''} onChange={e => updateMeta('npc', e.target.value)} className="w-full bg-surface-container-lowest border-none py-3 px-3 text-white font-display font-bold text-[10px] outline-none transition-all" />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  <div className="group">
                    <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary transition-colors">AUTOR / ORIGEM</label>
                    <input value={formData.metadata?.artist || ''} onChange={e => updateMeta('artist', e.target.value)} className="w-full bg-surface-container-lowest border-none py-3 px-3 text-white font-display font-bold text-[10px] outline-none transition-all" />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                  <div className="group">
                    <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary transition-colors">CAPÍTULO / SETOR</label>
                    <input value={formData.metadata?.chapter || ''} onChange={e => updateMeta('chapter', e.target.value)} className="w-full bg-surface-container-lowest border-none py-3 px-3 text-white font-display font-bold text-[10px] outline-none transition-all" />
                    <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                  {formData.type === 'AUDIO' && (
                    <div className="group">
                      <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary transition-colors">DURAÇÃO (SEG)</label>
                      <input type="number" value={formData.metadata?.duration || ''} onChange={e => updateMeta('duration', parseInt(e.target.value) || 0)} className="w-full bg-surface-container-lowest border-none py-3 px-3 text-white font-mono font-bold text-[10px] outline-none transition-all" />
                      <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                    </div>
                  )}
                  {formData.type === 'VIDEO' && (
                    <>
                      <div className="group">
                        <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary transition-colors">FORMATO FÍSICO</label>
                        <select
                          value={formData.metadata?.videoFormat || 'VHS'}
                          onChange={e => updateMeta('videoFormat', e.target.value as VideoFormat)}
                          className="w-full bg-surface-container-lowest border-none py-3 px-3 text-primary font-display font-bold text-[10px] outline-none transition-all uppercase cursor-pointer"
                        >
                          <option value="VHS">VHS (Fita)</option>
                          <option value="DVD">DVD (Disco)</option>
                        </select>
                        <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                      </div>
                      <div className="group">
                        <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary transition-colors">DURAÇÃO (SEG)</label>
                        <input type="number" value={formData.metadata?.duration || ''} onChange={e => updateMeta('duration', parseInt(e.target.value) || 0)} className="w-full bg-surface-container-lowest border-none py-3 px-3 text-white font-mono font-bold text-[10px] outline-none transition-all" />
                        <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                      </div>
                    </>
                  )}
                  {formData.type === 'VISUAL' && (
                    <div className="group">
                      <label className="text-[8px] font-display font-bold text-industrial-silver/30 uppercase block mb-2 tracking-widest group-focus-within:text-primary transition-colors">CATEGORIA VISUAL</label>
                      <select value={formData.metadata?.visualCategory || ''} onChange={e => updateMeta('visualCategory', e.target.value || undefined)} className="w-full bg-surface-container-lowest border-none py-3 px-3 text-primary font-display font-bold text-[10px] outline-none transition-all uppercase cursor-pointer">
                        <option value="">— SELECIONAR —</option>
                        {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                      </select>
                      <div className="h-0.5 w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-4 md:pt-6">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className="relative">
                         <input type="checkbox" checked={formData.metadata?.isSecret || false} onChange={e => updateMeta('isSecret', e.target.checked)} className="peer hidden" />
                         <div className="w-6 h-6 border border-white/10 bg-black/20 rounded-sm peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center shadow-inner">
                            <span className="material-symbols-outlined text-black text-sm font-black opacity-0 peer-checked:opacity-100 transition-opacity">check</span>
                         </div>
                      </div>
                      <span className="text-[10px] font-display font-bold text-industrial-silver/40 uppercase tracking-widest group-hover:text-primary transition-colors">Sinal Sigiloso</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-white/5 flex flex-col sm:flex-row justify-end gap-4 bg-black/40">
              <button onClick={() => setShowEditor(false)} className="px-8 py-4 text-[10px] font-display font-bold text-industrial-silver/30 hover:text-white uppercase tracking-[0.3em] transition-colors">
                Abortar Missão
              </button>
              <button onClick={handleSave} className="bg-primary hover:bg-primary-container text-black px-12 py-4 rounded-sm font-display font-bold text-[11px] tracking-widest uppercase transition-all active:scale-95 glow-orange shadow-lg flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base">{editingItem ? 'sync' : 'save'}</span>
                {editingItem ? 'SINCRONIZAR ALTERAÇÕES' : 'REGISTRAR DADO'}
              </button>
            </div>
          </div>
        </div>
      )}
      </OverlayPortal>

      {/* Export Modal */}
      <OverlayPortal open={showExport} onClose={() => setShowExport(false)}>
      <AnimatePresence>
      {showExport && (
        <div className="fixed inset-0 z-[120] flex justify-end bg-black/80 backdrop-blur-sm" onClick={() => setShowExport(false)}>
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="bg-[#222] border-l-8 border-[#1a1a1a] w-full max-w-4xl shadow-2xl flex flex-col h-full relative overflow-hidden font-chakra" onClick={e => e.stopPropagation()}>
            <Screw className="top-4 left-4" /><Screw className="top-4 right-4 -rotate-90" /><Screw className="bottom-4 left-4 -rotate-90" /><Screw className="bottom-4 right-4" />
            <div className="noise-overlay" /><div className="scanlines" />
            
            <div className="p-8 border-b-4 border-[#1a1a1a] flex justify-between items-center bg-black/40 relative z-10">
              <div className="mt-2">
                <h3 className="font-black text-2xl text-white uppercase tracking-tighter">Exportar <span className="text-primary">Registro Mestre</span></h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Cópia do IntelRegistry ({allItems.length} entradas localizadas)</p>
              </div>
              <button onClick={() => setShowExport(false)} className="p-3 text-zinc-600 hover:text-white material-symbols-outlined rounded-sm">close</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-black/20 custom-scrollbar relative z-10">
              <pre className="bg-black/60 border-2 border-[#1a1a1a] p-8 text-[11px] font-mono text-primary/70 whitespace-pre-wrap break-all rounded-sm leading-relaxed shadow-inner">
                 {exportJSON}
              </pre>
            </div>
            
            <div className="p-8 border-t-4 border-[#1a1a1a] flex justify-end gap-6 bg-black/40 relative z-10 shrink-0">
              <button
                onClick={() => { navigator.clipboard.writeText(exportJSON); setFeedback({ type: 'success', text: '✓ JSON REGISTRY COPIADO COM SUCESSO' }); setShowExport(false); }}
                className="w-full sm:w-auto bg-primary text-black px-12 py-4 text-[11px] font-black uppercase tracking-widest hover:bg-primary-container transition-all rounded-sm active:scale-95 glow-orange shadow-lg flex items-center justify-center gap-3"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                COPIAR PARA ÁREA DE TRANSFERÊNCIA
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      </OverlayPortal>
    </section>
  );
}
