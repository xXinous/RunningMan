import React, { createContext, useContext, useMemo, useCallback, useEffect } from 'react';
import { usePlayerAuth, usePlayerAuthLoginHandler } from '../hooks/usePlayerAuth';
import { usePlayerIntel } from '../hooks/usePlayerIntel';
import { useProfileUpdates } from '../hooks/useProfileUpdates';
import { useActiveCampaign, useShowNokiaShell } from '../hooks/useActiveCampaign';
import { usePlayerServicesSync, usePlayerScreenAnalytics } from '../hooks/usePlayerSync';
import { useToasts } from '../hooks/useToasts';
import { useWalkmanPlayback } from '../hooks/useWalkmanPlayback';
import type { PlayerSessionValue, PlayerPlaybackValue } from '../types';

const PlayerSessionContext = createContext<PlayerSessionValue | null>(null);
const PlayerPlaybackContext = createContext<PlayerPlaybackValue | null>(null);

function PlayerProvidersInner({ children }: { children: React.ReactNode }) {
  const { toasts: toastList, addToast, dismissToast } = useToasts();

  const playbackRef = React.useRef<{ resetPlayback: () => void } | null>(null);

  const auth = usePlayerAuth({
    addToast,
    onPlaybackReset: () => playbackRef.current?.resetPlayback(),
  });

  const {
    masterAccount,
    setMasterAccount,
    playerData,
    setPlayerData,
    localStats,
    screen,
    setScreen,
    limboStatus,
    intelCollection,
    setIntelCollection,
    playerDataRef,
    handleCharacterSelect,
    handleCharacterSwitch,
    handleLogout,
  } = auth;

  const { activeCampaign, isNokiaTheme, deviceCapabilities } = useActiveCampaign(playerData);

  const playback = useWalkmanPlayback({
    playerData,
    localStats,
    playerDataRef,
    setPlayerData,
    setScreen,
    addToast,
    deviceCapabilities,
  });

  playbackRef.current = { resetPlayback: playback.resetPlayback };

  useEffect(() => {
    const pending = playerData?.character?.pendingVideoPlay;
    if (!pending?.intelId || !pending?.requestId) return;
    playback.handleRemoteVideoPlay(pending.intelId, pending.requestId);
  }, [playerData?.character?.pendingVideoPlay?.requestId, playback.handleRemoteVideoPlay]);

  const {
    walkmanStatus,
    setWalkmanStatus,
    currentIntel,
    volume,
    setVolume,
    displayMode,
    isPlaying,
    activeEvidence,
    setActiveEvidence,
    isMuted,
    nokiaBackVisible,
    setNokiaBackVisible,
    handleQrDetected,
    handleIntelSelect,
    handleEject,
    handleScanClick,
    handleCancelScan,
    handleSetIsPlaying,
    handleRewind,
    handleVideoEnded,
    handleModeChange,
    handleProfileOpen,
    handleTerminalOpen,
    handleMacOpen,
    handleToggleMute,
    registerNokiaBackHandler,
    handleNokiaBack: handleNokiaBackRaw,
  } = playback;

  const { intelManager, visualGalleryImages } = usePlayerIntel(
    playerData,
    intelCollection,
    setIntelCollection,
    setWalkmanStatus
  );

  const showNokiaShell = useShowNokiaShell(isNokiaTheme, screen);

  const { updateSpotify, updatePhone, selectCampaign } = useProfileUpdates(
    playerData,
    setPlayerData
  );

  const handleLogin = usePlayerAuthLoginHandler(setMasterAccount, setScreen);

  usePlayerServicesSync(auth, addToast);
  usePlayerScreenAnalytics(screen);

  const sessionValue = useMemo<PlayerSessionValue>(
    () => ({
      masterAccount,
      setMasterAccount,
      playerData,
      setPlayerData,
      localStats,
      screen,
      setScreen,
      limboStatus,
      activeCampaign,
      intelManager,
      visualGalleryImages,
      isNokiaTheme,
      showNokiaShell,
      deviceCapabilities,
      handleCharacterSelect,
      handleCharacterSwitch,
      handleLogout,
      handleLogin,
      updateSpotify,
      updatePhone,
      selectCampaign,
    }),
    [
      masterAccount,
      setMasterAccount,
      playerData,
      setPlayerData,
      localStats,
      screen,
      setScreen,
      limboStatus,
      activeCampaign,
      intelManager,
      visualGalleryImages,
      isNokiaTheme,
      showNokiaShell,
      deviceCapabilities,
      handleCharacterSelect,
      handleCharacterSwitch,
      handleLogout,
      handleLogin,
      updateSpotify,
      updatePhone,
      selectCampaign,
    ]
  );

  const handleNokiaBack = useCallback(() => {
    handleNokiaBackRaw(screen);
  }, [handleNokiaBackRaw, screen]);

  const playbackValue = useMemo<PlayerPlaybackValue>(
    () => ({
      walkmanStatus,
      setWalkmanStatus,
      currentIntel,
      volume,
      setVolume,
      displayMode,
      isPlaying,
      activeEvidence,
      setActiveEvidence,
      isMuted,
      nokiaBackVisible,
      setNokiaBackVisible,
      toasts: toastList,
      addToast,
      dismissToast,
      handleQrDetected,
      handleIntelSelect,
      handleEject,
      handleScanClick,
      handleCancelScan,
      handleSetIsPlaying,
      handleRewind,
      handleVideoEnded,
      handleModeChange,
      handleProfileOpen,
      handleTerminalOpen,
      handleMacOpen,
      handleToggleMute,
      registerNokiaBackHandler,
      handleNokiaBack,
      playerDataRef,
    }),
    [
      walkmanStatus,
      setWalkmanStatus,
      currentIntel,
      volume,
      setVolume,
      displayMode,
      isPlaying,
      activeEvidence,
      setActiveEvidence,
      isMuted,
      nokiaBackVisible,
      setNokiaBackVisible,
      toastList,
      addToast,
      dismissToast,
      handleQrDetected,
      handleIntelSelect,
      handleEject,
      handleScanClick,
      handleCancelScan,
      handleSetIsPlaying,
      handleRewind,
      handleVideoEnded,
      handleModeChange,
      handleProfileOpen,
      handleTerminalOpen,
      handleMacOpen,
      handleToggleMute,
      registerNokiaBackHandler,
      handleNokiaBack,
      playerDataRef,
    ]
  );

  return (
    <PlayerSessionContext.Provider value={sessionValue}>
      <PlayerPlaybackContext.Provider value={playbackValue}>{children}</PlayerPlaybackContext.Provider>
    </PlayerSessionContext.Provider>
  );
}

export function PlayerSessionProvider({ children }: { children: React.ReactNode }) {
  return <PlayerProvidersInner>{children}</PlayerProvidersInner>;
}

export function usePlayerSession(): PlayerSessionValue {
  const ctx = useContext(PlayerSessionContext);
  if (!ctx) throw new Error('usePlayerSession must be used within PlayerSessionProvider');
  return ctx;
}

export function usePlayerPlayback(): PlayerPlaybackValue {
  const ctx = useContext(PlayerPlaybackContext);
  if (!ctx) throw new Error('usePlayerPlayback must be used within PlayerSessionProvider');
  return ctx;
}
