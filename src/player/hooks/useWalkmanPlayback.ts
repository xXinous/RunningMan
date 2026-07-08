import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { audioEngine } from '../../services/AudioEngine';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { activityLogger } from '../../services/ActivityLogger';
import { firebaseAnalytics } from '../../services/FirebaseAnalyticsService';
import { intelService } from '../../services/IntelService';
import {
  IntelBase,
  AudioIntel,
  VisualIntel,
  TextIntel,
  MetaIntel,
  VideoIntel,
  IntelFactory,
} from '../../services/IntelEngine';
import { clearPendingVideoPlay } from '../../store/firestore';
import type { PlayerData, PlayerStats, WalkmanStatus, DisplayMode, AppScreen } from '../../types/player';
import type { Toast } from '../../components/ToastNotification';

export interface UseWalkmanPlaybackOptions {
  playerData: PlayerData | null;
  localStats: PlayerStats | null;
  playerDataRef: React.RefObject<PlayerData | null>;
  setPlayerData: Dispatch<SetStateAction<PlayerData | null>>;
  setScreen: Dispatch<SetStateAction<AppScreen>>;
  addToast: (toast: Omit<Toast, 'id'>) => void;
}

export function useWalkmanPlayback(options: UseWalkmanPlaybackOptions) {
  const { playerData, localStats, playerDataRef, setPlayerData, setScreen, addToast } = options;

  const [walkmanStatus, setWalkmanStatus] = useState<WalkmanStatus>('IDLE');
  const [currentIntel, setCurrentIntel] = useState<IntelBase | null>(null);
  const [volume, setVolume] = useState(80);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [scanTimes, setScanTimes] = useState<number[]>([]);
  const [activeEvidence, setActiveEvidence] = useState<IntelBase | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [preMuteVolume, setPreMuteVolume] = useState(80);
  const [nokiaBackVisible, setNokiaBackVisible] = useState(true);

  const hasPlayedCurrentTape = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nokiaBackHandlerRef = useRef<(() => boolean) | null>(null);
  const lastVideoRequestRef = useRef<string | null>(null);

  const isPlaying = walkmanStatus === 'PLAYING';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    audioEngine.setVolume(volume);
    analyticsTracker.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    audioEngine.setOnEnded(() => {
      setWalkmanStatus('LOADED');
      analyticsTracker.endPlayback();
    });
  }, []);

  useEffect(() => {
    if (currentIntel instanceof AudioIntel && currentIntel.mediaUrl) {
      audioEngine.loadTrack(currentIntel.mediaUrl);
      analyticsTracker.pausePlayback();
    } else if (!currentIntel || currentIntel instanceof VideoIntel) {
      audioEngine.clearTrack();
      if (!currentIntel) analyticsTracker.stopAll();
    }
    return () => audioEngine.clearTrack();
  }, [currentIntel?.id]);

  useEffect(() => {
    if (currentIntel instanceof VideoIntel) return;
    if (walkmanStatus === 'PLAYING') {
      hasPlayedCurrentTape.current = true;
      audioEngine.play();
      if (currentIntel) analyticsTracker.startPlayback(currentIntel as Parameters<typeof analyticsTracker.startPlayback>[0]);
    } else if (walkmanStatus === 'REWINDING') {
      audioEngine.stop();
      analyticsTracker.pausePlayback();
    } else {
      audioEngine.pause();
      analyticsTracker.pausePlayback();
    }
  }, [walkmanStatus, currentIntel?.id]);

  const resetPlayback = useCallback(() => {
    setCurrentIntel(null);
    setWalkmanStatus('IDLE');
    setActiveEvidence(null);
    setVolume(80);
    setIsMuted(false);
    setPreMuteVolume(80);
    setScanTimes([]);
    hasPlayedCurrentTape.current = false;
  }, []);

  const handleQrDetected = useCallback(
    async (code: string) => {
      const currentPD = playerDataRef.current;
      if (!currentPD || !localStats) {
        return addToast({ type: 'error', title: 'Aguarde', subtitle: 'Perfil carregando...', icon: '[..]' });
      }
      setWalkmanStatus('IDLE');

      try {
        const rawIntel = await intelService.resolve(code);
        if (!rawIntel) {
          firebaseAnalytics.logQrScan('fail');
          return addToast({ type: 'error', title: 'Código Desconhecido', subtitle: code, icon: '[X]' });
        }

        const intel = IntelFactory.getInstance().create(rawIntel);
        const { alreadyOwned, updatedIds } = await intelService.unlock(currentPD, intel.id);

        firebaseAnalytics.logQrScan(alreadyOwned ? 'duplicate' : 'success');

        const now = Date.now();
        const recentScans = [...scanTimes.filter((t) => now - t < 300000), now];
        setScanTimes(recentScans);
        analyticsTracker.checkAchievements(recentScans);
        setPlayerData({ ...currentPD, unlockedIntelIds: updatedIds });

        hasPlayedCurrentTape.current = false;
        setWalkmanStatus('LOADING');
        timerRef.current = setTimeout(() => {
          setCurrentIntel(intel);
          setWalkmanStatus('LOADED');
          addToast({
            type: 'tape',
            title: alreadyOwned ? 'Intel Inserida' : 'Intel Desbloqueada!',
            subtitle: intel.title,
            icon: '[=]',
          });
        }, 400);
        activityLogger.logAction(
          alreadyOwned ? 'tape_insert' : 'tape_unlock',
          `${alreadyOwned ? 'Inseriu' : 'Desbloqueou'}: ${intel.title}`,
          { tapeId: intel.id }
        );
      } catch {
        addToast({ type: 'error', title: 'Erro QR', subtitle: 'Tente dnv', icon: '[!]' });
      }
    },
    [localStats, scanTimes, addToast, playerDataRef, setPlayerData]
  );

  const handleIntelSelect = useCallback(
    (intel: IntelBase) => {
      if (!playerDataRef.current) return;
      if (intel instanceof VisualIntel || intel instanceof TextIntel || intel instanceof MetaIntel) {
        setActiveEvidence(intel);
        activityLogger.logAction(
          intel.type === 'VISUAL' ? 'pista_open' : 'evidence_open',
          `Abriu: ${intel.title}`,
          { intelId: intel.id }
        );
        firebaseAnalytics.logEvidenceViewed(intel.id, intel.type);
      } else if (intel instanceof AudioIntel || intel instanceof VideoIntel) {
        if (intel.id === currentIntel?.id) return;
        if (!hasPlayedCurrentTape.current && currentIntel) {
          analyticsTracker.incrementStat('ejectWithoutPlay');
        }
        hasPlayedCurrentTape.current = false;
        setWalkmanStatus('LOADING');
        timerRef.current = setTimeout(() => {
          setCurrentIntel(intel);
          setWalkmanStatus('LOADED');
        }, 400);
        activityLogger.logAction(
          intel instanceof VideoIntel ? 'video_select' : 'tape_select',
          `Selecionou: ${intel.title}`,
          { intelId: intel.id }
        );
      }
    },
    [currentIntel, playerDataRef]
  );

  const handleEject = useCallback(() => {
    if (!hasPlayedCurrentTape.current && currentIntel) {
      analyticsTracker.incrementStat('ejectWithoutPlay');
    }
    setWalkmanStatus('IDLE');
    setCurrentIntel(null);
  }, [currentIntel]);

  const handleScanClick = useCallback(() => setWalkmanStatus('SCANNING'), []);
  const handleCancelScan = useCallback(() => setWalkmanStatus('IDLE'), []);
  const handleSetIsPlaying = useCallback((p: boolean) => setWalkmanStatus(p ? 'PLAYING' : 'LOADED'), []);

  const handleRewind = useCallback(() => {
    setWalkmanStatus('REWINDING');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setWalkmanStatus('LOADED'), 1500);
  }, []);

  const handleModeChange = useCallback((dir: 'up' | 'down') => {
    setDisplayMode((prev) => {
      const modes: DisplayMode[] = ['default', 'title', 'chapter', 'type'];
      const currentIndex = modes.indexOf(prev);
      const nextIndex = (currentIndex + (dir === 'up' ? 1 : -1) + modes.length) % modes.length;
      return modes[nextIndex] ?? 'default';
    });
  }, []);

  const handleProfileOpen = useCallback(() => setScreen('profile'), [setScreen]);
  const handleTerminalOpen = useCallback(() => setScreen('bios'), [setScreen]);
  const handleMacOpen = useCallback(() => setScreen('macos'), [setScreen]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setVolume(preMuteVolume);
      setIsMuted(false);
    } else {
      setPreMuteVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  }, [isMuted, volume, preMuteVolume]);

  const registerNokiaBackHandler = useCallback((handler: (() => boolean) | null) => {
    nokiaBackHandlerRef.current = handler;
  }, []);

  const handleNokiaBack = useCallback(
    (screen: AppScreen) => {
      if (nokiaBackHandlerRef.current) {
        const handled = nokiaBackHandlerRef.current();
        if (handled) return;
      }
      if (screen !== 'player') {
        setScreen('player');
      }
    },
    [setScreen]
  );

  const handleRemoteVideoPlay = useCallback(
    async (intelId: string, requestId: string) => {
      if (lastVideoRequestRef.current === requestId) return;
      lastVideoRequestRef.current = requestId;

      const currentPD = playerDataRef.current;
      if (!currentPD) return;

      try {
        const rawIntel = await intelService.resolve(intelId);
        if (!rawIntel) return;

        const intel = IntelFactory.getInstance().create(rawIntel);
        if (!(intel instanceof VideoIntel)) return;

        let updatedIds = currentPD.unlockedIntelIds;
        if (!updatedIds.includes(intelId)) {
          const unlockResult = await intelService.unlock(currentPD, intelId);
          updatedIds = unlockResult.updatedIds;
          setPlayerData({ ...currentPD, unlockedIntelIds: updatedIds });
        }

        setScreen('player');
        hasPlayedCurrentTape.current = false;
        setWalkmanStatus('LOADING');
        timerRef.current = setTimeout(() => {
          setCurrentIntel(intel);
          setWalkmanStatus('PLAYING');
          addToast({
            type: 'tape',
            title: 'Transmissão Recebida',
            subtitle: intel.title,
            icon: '[▶]',
          });
        }, 400);

        await clearPendingVideoPlay(currentPD.uid, currentPD.activeCharacterId);
        activityLogger.logSystem(
          currentPD.uid,
          currentPD.character.codinome,
          currentPD.activeCharacterId,
          'sync',
          `Vídeo transmitido pelo mestre: ${intel.title}`,
          { intelId, requestId }
        );
      } catch (err) {
        console.error('[WalkmanPlayback] Remote video play failed:', err);
      }
    },
    [playerDataRef, setPlayerData, setScreen, addToast]
  );

  return {
    walkmanStatus,
    setWalkmanStatus,
    currentIntel,
    setCurrentIntel,
    volume,
    setVolume,
    displayMode,
    isPlaying,
    activeEvidence,
    setActiveEvidence,
    isMuted,
    nokiaBackVisible,
    setNokiaBackVisible,
    resetPlayback,
    handleQrDetected,
    handleIntelSelect,
    handleEject,
    handleScanClick,
    handleCancelScan,
    handleSetIsPlaying,
    handleRewind,
    handleModeChange,
    handleProfileOpen,
    handleTerminalOpen,
    handleMacOpen,
    handleToggleMute,
    registerNokiaBackHandler,
    handleNokiaBack,
    handleRemoteVideoPlay,
    playerDataRef,
  };
}

export type WalkmanPlaybackState = ReturnType<typeof useWalkmanPlayback>;
