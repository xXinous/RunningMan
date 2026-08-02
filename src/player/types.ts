import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { Campaign } from '../data/campaigns';
import type { IntelManager, IntelBase } from '../services/IntelEngine';
import type {
  MasterAccount,
  CharacterData,
  PlayerData,
  PlayerStats,
  AppScreen,
  LimboGlobalState,
  GalleryImage,
  WalkmanStatus,
  DisplayMode,
} from '../types/player';
import type { Toast } from '../components/ToastNotification';
import type { DeviceCapabilities } from './hooks/useActiveCampaign';

export interface PlayerSessionValue {
  masterAccount: MasterAccount | null | undefined;
  setMasterAccount: Dispatch<SetStateAction<MasterAccount | null | undefined>>;
  playerData: PlayerData | null;
  setPlayerData: Dispatch<SetStateAction<PlayerData | null>>;
  localStats: PlayerStats | null;
  screen: AppScreen;
  setScreen: Dispatch<SetStateAction<AppScreen>>;
  limboStatus: LimboGlobalState;
  activeCampaign: Campaign | null;
  intelManager: IntelManager | null;
  visualGalleryImages: GalleryImage[];
  isNokiaTheme: boolean;
  showNokiaShell: boolean;
  deviceCapabilities: DeviceCapabilities;
  handleCharacterSelect: (char: CharacterData) => Promise<void>;
  handleCharacterSwitch: () => void;
  handleLogout: () => Promise<void>;
  handleLogin: (acc: MasterAccount) => void;
  updateSpotify: (url: string) => Promise<void>;
  updatePhone: (num: string) => Promise<void>;
  selectCampaign: (campaign: Campaign) => Promise<void>;
}

export interface PlayerPlaybackValue {
  walkmanStatus: WalkmanStatus;
  setWalkmanStatus: Dispatch<SetStateAction<WalkmanStatus>>;
  currentIntel: IntelBase | null;
  volume: number;
  setVolume: Dispatch<SetStateAction<number>>;
  displayMode: DisplayMode;
  isPlaying: boolean;
  activeEvidence: IntelBase | null;
  setActiveEvidence: Dispatch<SetStateAction<IntelBase | null>>;
  isMuted: boolean;
  nokiaBackVisible: boolean;
  setNokiaBackVisible: Dispatch<SetStateAction<boolean>>;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  handleQrDetected: (code: string) => Promise<void>;
  handleIntelSelect: (intel: IntelBase) => void;
  handleEject: () => void;
  handleScanClick: () => void;
  handleCancelScan: () => void;
  handleSetIsPlaying: (playing: boolean) => void;
  handleRewind: () => void;
  handleVideoEnded: () => void;
  handleModeChange: (dir: 'up' | 'down') => void;
  handleProfileOpen: () => void;
  handleTerminalOpen: () => void;
  handleMacOpen: () => void;
  handleToggleMute: () => void;
  registerNokiaBackHandler: (handler: (() => boolean) | null) => void;
  handleNokiaBack: () => void;
  playerDataRef: RefObject<PlayerData | null>;
}
