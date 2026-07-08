import type { IntelItem, IntelType } from '../../types/intel';
import { ACCESS_LEVEL_LABELS } from '../../types/intel';
import type { MediaAsset } from '../../types/media';

export const LOCAL_INTEL_IDS = new Set([
  'evidence-disk-01-corrupted',
  'evidence-disk-01',
]);

export type IntelStatusFilter = 'all' | 'catalogued' | 'orphan' | 'text_meta';

export const INTEL_STATUS_FILTER_LABELS: Record<IntelStatusFilter, string> = {
  all: 'Todos',
  catalogued: 'Catalogados',
  orphan: 'Órfãos',
  text_meta: 'Texto/Meta',
};

export const INTEL_TYPE_OPTIONS: { value: IntelType; label: string; icon: string }[] = [
  { value: 'AUDIO', label: 'Áudio', icon: 'album' },
  { value: 'VIDEO', label: 'Vídeo', icon: 'videocam' },
  { value: 'TEXT', label: 'Texto', icon: 'save' },
  { value: 'VISUAL', label: 'Visual', icon: 'photo_library' },
  { value: 'META', label: 'Meta', icon: 'emoji_events' },
];

export type IntelFilterTab = 'all' | 'audio' | 'video' | 'visual' | 'text' | 'meta';

export const INTEL_FILTER_TAB_LABELS: Record<IntelFilterTab, string> = {
  all: 'Todos',
  audio: 'Áudio',
  video: 'Vídeo',
  visual: 'Visual',
  text: 'Texto',
  meta: 'Meta',
};

const FILTER_TO_TYPE: Record<Exclude<IntelFilterTab, 'all'>, IntelType> = {
  audio: 'AUDIO',
  video: 'VIDEO',
  visual: 'VISUAL',
  text: 'TEXT',
  meta: 'META',
};

export function intelTypeFromFilterTab(tab: IntelFilterTab): IntelType | null {
  if (tab === 'all') return null;
  return FILTER_TO_TYPE[tab];
}

export function intelTypeIcon(type: IntelType): string {
  return INTEL_TYPE_OPTIONS.find((t) => t.value === type)?.icon ?? 'description';
}

export function intelTypeLabel(type: IntelType): string {
  return INTEL_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

export function accessLevelLabel(level: number): string {
  return ACCESS_LEVEL_LABELS[level as keyof typeof ACCESS_LEVEL_LABELS] ?? `NÍVEL ${level}`;
}

export function accessLevelClass(level: number): string {
  if (level >= 4) return 'border-red-500/30 text-red-500 bg-red-500/5';
  if (level >= 2) return 'border-primary/30 text-primary/70';
  return 'border-white/5 text-industrial-silver/30';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function isLocalIntel(item: IntelItem): boolean {
  return LOCAL_INTEL_IDS.has(item.id);
}

/** Item com arquivo mas sem metadados RPG preenchidos pelo mestre. */
export function isOrphanIntel(item: IntelItem, asset?: MediaAsset): boolean {
  if (isLocalIntel(item)) return false;

  const mediaTypes: IntelType[] = ['AUDIO', 'VISUAL', 'VIDEO'];
  const hasMedia = Boolean(item.mediaUrl) || Boolean(asset?.storagePath);
  if (!mediaTypes.includes(item.type) && !hasMedia) return false;
  if ((item.type === 'TEXT' || item.type === 'META') && !hasMedia) return false;

  const hasRpgMetadata = Boolean(
    item.campaignId?.trim() ||
      item.metadata?.npc?.trim() ||
      item.metadata?.chapter?.trim() ||
      item.description?.trim()
  );
  if (hasRpgMetadata) return false;

  const filenameStem = asset?.filename?.replace(/\.[^/.]+$/, '') ?? '';
  const titleLooksAuto =
    item.id.startsWith('item-') ||
    item.title === item.id ||
    (filenameStem && item.title.toLowerCase() === filenameStem.toLowerCase());

  return hasMedia && titleLooksAuto;
}

export type IntelCatalogStatus = 'catalogued' | 'orphan' | 'local';

export function getIntelCatalogStatus(item: IntelItem, asset?: MediaAsset): IntelCatalogStatus {
  if (isLocalIntel(item)) return 'local';
  if (isOrphanIntel(item, asset)) return 'orphan';
  return 'catalogued';
}

export function intelCatalogStatusLabel(status: IntelCatalogStatus): string {
  const labels: Record<IntelCatalogStatus, string> = {
    catalogued: 'Catalogado',
    orphan: 'Órfão',
    local: 'Local',
  };
  return labels[status];
}

export function intelCatalogStatusClass(status: IntelCatalogStatus): string {
  const classes: Record<IntelCatalogStatus, string> = {
    catalogued: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
    orphan: 'border-amber-500/30 text-amber-400 bg-amber-500/5',
    local: 'border-industrial-silver/20 text-industrial-silver/50 bg-white/5',
  };
  return classes[status];
}

export function matchesIntelStatusFilter(
  item: IntelItem,
  filter: IntelStatusFilter,
  asset?: MediaAsset
): boolean {
  if (filter === 'all') return true;
  if (filter === 'catalogued') return getIntelCatalogStatus(item, asset) === 'catalogued';
  if (filter === 'orphan') return getIntelCatalogStatus(item, asset) === 'orphan';
  if (filter === 'text_meta') {
    return (item.type === 'TEXT' || item.type === 'META') && !item.mediaUrl;
  }
  return true;
}
