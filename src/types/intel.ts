import { Timestamp } from 'firebase/firestore';

// --- Intel System: Unified Collectible Types ---

/**
 * IntelType classifica o FORMATO do conteúdo coletável.
 * AUDIO  = Fitas de áudio (cassetes)
 * VISUAL = Imagens (fotos de locais, pistas, pessoas, itens)
 * TEXT   = Conteúdo textual (disquetes, documentos)
 * META   = Conquistas, flags de sistema, easter eggs
 * VIDEO  = Gravações de vídeo (fitas VHS / discos DVD)
 */
export type IntelType = 'AUDIO' | 'VISUAL' | 'TEXT' | 'META' | 'VIDEO';

/** Formato físico exibido no Nokia para itens de vídeo */
export type VideoFormat = 'DVD' | 'VHS';

/**
 * AccessLevel define o nível de sigilo RPG:
 * 1 = RESTRITO     — Briefings, fotos de locais, fitas introdutórias
 * 2 = CONFIDENCIAL — Dossiês de NPCs, mapas, diários de áudio
 * 3 = SIGILOSO     — Provas de crimes, interceptações, disquetes corrompidos
 * 4 = TOP SECRET   — Conquistas raras, easter eggs, revelações finais
 */
export type AccessLevel = 1 | 2 | 3 | 4;

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  1: 'RESTRITO',
  2: 'CONFIDENCIAL',
  3: 'SIGILOSO',
  4: 'TOP SECRET',
};

/**
 * Categorias visuais para itens do tipo VISUAL (mapeado a partir de GalleryCategory).
 */
export type VisualCategory = 'locais' | 'pistas' | 'pessoas' | 'itens';

/**
 * IntelItem é a entidade central unificada do sistema de colecionáveis.
 * Qualquer item coletável (fita, imagem, documento, conquista) é uma IntelItem.
 */
export interface IntelItem {
  id: string;
  type: IntelType;
  level: AccessLevel;
  title: string;
  description: string;
  campaignId?: string;

  // --- Dados específicos por tipo (opcionais) ---

  /** URL de mídia (áudio ou imagem) */
  mediaUrl?: string;

  /** Conteúdo textual (disquete, documento) */
  textContent?: string;

  /** Metadados extras flexíveis */
  metadata?: IntelMetadata;
}

/**
 * Metadados opcionais que carregam contexto RPG e informações auxiliares.
 */
export interface IntelMetadata {
  /** NPC associado */
  npc?: string;
  /** Artista/fonte do conteúdo */
  artist?: string;
  /** Capítulo da narrativa */
  chapter?: string;
  /** Duração em segundos (para AUDIO) */
  duration?: number;
  /** Se o item é secreto */
  isSecret?: boolean;
  /** Categoria visual (para VISUAL) — mapeia GalleryCategory */
  visualCategory?: VisualCategory;
  /** URL da imagem (para itens com preview visual) */
  imageUrl?: string;
  /** Ícone do item (para META/conquistas) */
  icon?: string;
  /** Dica de desbloqueio */
  hint?: string;
  /** Condição textual de desbloqueio */
  unlockCondition?: string;
  /** ID da regra de achievement (para avaliação automática) */
  achievementRuleId?: string;
  /** Formato físico do coletável de vídeo (DVD ou VHS) */
  videoFormat?: VideoFormat;
  /** Origem do vídeo: upload Firebase ou link YouTube */
  videoSource?: 'upload' | 'youtube';
  /** ID do vídeo no YouTube (quando videoSource === 'youtube') */
  youtubeId?: string;
}

/**
 * Registro de desbloqueio no Firestore (subcollection do user).
 */
export interface IntelUnlockRecord {
  intelId: string;
  unlockedAt: Timestamp;
  campaignId?: string;
}

/**
 * Inventário formatado do jogador.
 */
export interface PlayerIntelCollection {
  /** Todos os itens desbloqueados, já resolvidos */
  items: IntelItem[];

  /** Agrupados por tipo */
  byType: Record<IntelType, IntelItem[]>;

  /** Agrupados por nível de sigilo */
  byLevel: Record<AccessLevel, IntelItem[]>;

  /** IDs desbloqueados */
  unlockedIds: string[];

  /** Contadores */
  counts: {
    total: number;
    audio: number;
    visual: number;
    text: number;
    meta: number;
    video: number;
  };
}


