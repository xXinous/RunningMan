import { Timestamp } from 'firebase/firestore';

// --- UI & App State Types ---
export type AppScreen = 'login' | 'characterSelection' | 'player' | 'profile' | 'bios' | 'limbo' | 'diskRepair' | 'macos' | 'windows95' | 'campaignSelection' | 'agentDossier';
export type WalkmanStatus = 'IDLE' | 'LOADING' | 'LOADED' | 'PLAYING' | 'REWINDING' | 'SCANNING';
export type DisplayMode = 'default' | 'title' | 'chapter' | 'type';

// --- Database Models: Master Account ---

export interface MasterAccount {
  uid: string;
  email: string;
  masterName?: string;
  displayName?: string;
  role: 'player' | 'admin';
  createdAt: Timestamp | null;
  lastLogin?: Timestamp | null;
  
  // Account-level flags
  hasTerminalAccess?: boolean;
  hasMacAccess?: boolean;
  suspended?: boolean;
  notes?: string;
}

// --- Database Models: Character (Agent) ---

export interface CharacterData {
  id: string;
  codinome: string;
  agentStatus: 'vivo' | 'morto' | 'desaparecido';
  dangerLevel: number; // 1-5
  profilePhotoUrl?: string;
  campaignId?: string;
  createdAt: Timestamp;
  archived?: boolean; // Soft-delete: hides from default views but preserves logs
  
  // Character-specific game flags
  achievementsRevealed?: boolean;
  forceTerminalOpen?: boolean;
  forceMacOpen?: boolean;
  spotifyPlaylistUrl?: string;
  agentId?: string; // Generated RM-XXXX ID
  unlockedCampaigns?: string[]; // IDs das campanhas desbloqueadas para este personagem
  phoneNumber?: string; // Random 10-digit US phone number, e.g. (555) 555-1234

  /** Tópicos do fórum LIMBO_01 já lidos por este personagem */
  readThreadIds?: string[];

  /** Comando remoto do mestre: reproduzir vídeo na tela do jogador */
  pendingVideoPlay?: {
    intelId: string;
    requestId: string;
    triggeredAt?: Timestamp | null;
  } | null;
}

export interface PlayerStats {
  totalListenTime: number;
  screwClicks: number;
  fidgetClicks: number;
  ejectWithoutPlay: number;
  maxVolumeTime: number;
  zeroVolumeTime: number;
}

/**
 * PlayerData represents the active session: Account + Active Character + Progress.
 */
export interface PlayerData extends MasterAccount {
  activeCharacterId: string;
  character: CharacterData;
  achievementIds: string[];
  /** Intel IDs from the 'intel' subcollection. */
  unlockedIntelIds: string[];
  stats: PlayerStats;
}

// --- System States ---

export interface LimboGlobalState {
  seized: boolean;
  seizedBy?: string | null;
  seizedAt?: Timestamp | null;
  readThreadIds?: string[];
}

export interface GameEventsState {
  diskRepairAllowed: boolean;
}

// Character-level slot in a group
export interface GroupCharacterSlot {
  uid: string;         // Master account UID
  characterId: string; // Character document ID
  joinedAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  characterSlots: GroupCharacterSlot[];
  campaignId?: string;
  unlockedCampaigns?: string[];
  sessions: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- Gallery & Redirects ---

export type GalleryCategory = 'locais' | 'pistas' | 'pessoas' | 'itens';

export interface GalleryImage {
  id: string;
  category: GalleryCategory;
  title: string;
  description: string;
  imageUrl: string;
  level?: number;
  createdAt?: Timestamp;
  createdBy?: string;
}

export interface QrRedirect {
  sourceId: string;
  targetId: string;
  reason: string;
  updatedAt?: Timestamp;
}
