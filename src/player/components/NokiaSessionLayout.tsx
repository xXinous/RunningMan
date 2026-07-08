import React from 'react';
import RetroLoading from '../../components/player/RetroLoading';
import NokiaDeviceWrapper from './NokiaDeviceWrapper';

const NokiaPlayer = React.lazy(() => import('../../components/player/NokiaPlayer'));
const ProfileScreen = React.lazy(() => import('../../components/ProfileScreen'));
import { usePlayerSession } from '../context/PlayerProviders';
import { usePlayerPlayback } from '../context/PlayerProviders';
import type { IntelBase } from '../../services/IntelEngine';

const EMPTY_INTEL: IntelBase[] = [];

export default function NokiaSessionLayout() {
  const session = usePlayerSession();
  const playback = usePlayerPlayback();

  const { playerData, screen, setScreen, visualGalleryImages } = session;
  if (!playerData) return null;

  return (
    <NokiaDeviceWrapper
      status={playback.walkmanStatus}
      volume={playback.volume}
      isMuted={playback.isMuted}
      onToggleMute={playback.handleToggleMute}
      onBack={playback.handleNokiaBack}
      screen={screen}
      setScreen={setScreen}
      backVisible={screen === 'player' ? playback.nokiaBackVisible : true}
      onProfileOpen={playback.handleProfileOpen}
    >
      <div
        style={{ display: screen === 'player' ? 'flex' : 'none' }}
        className="w-full h-full flex-col flex-grow min-h-0"
      >
        <React.Suspense fallback={<RetroLoading message="CARREGANDO NOKIA..." />}>
          <NokiaPlayer
            currentIntel={playback.currentIntel}
            status={playback.walkmanStatus}
            isPlaying={playback.isPlaying}
            setIsPlaying={playback.handleSetIsPlaying}
            volume={playback.volume}
            setVolume={playback.setVolume}
            intelItems={session.intelManager?.getAll() || EMPTY_INTEL}
            currentIntelId={playback.currentIntel?.id ?? null}
            onIntelSelect={playback.handleIntelSelect}
            onRewind={playback.handleRewind}
            onEject={playback.handleEject}
            onScanClick={playback.handleScanClick}
            onCancelScan={playback.handleCancelScan}
            onQrDetected={playback.handleQrDetected}
            hasTerminalAccess={playerData.hasTerminalAccess}
            onTerminalOpen={playback.handleTerminalOpen}
            hasMacAccess={playerData.hasMacAccess}
            onMacOpen={playback.handleMacOpen}
            onProfileOpen={playback.handleProfileOpen}
            onCharacterSwitch={session.handleCharacterSwitch}
            registerBackHandler={playback.registerNokiaBackHandler}
            setBackVisible={playback.setNokiaBackVisible}
            activeCharacter={playerData.character}
            characterId={playerData.activeCharacterId}
            uid={playerData.uid}
            onUpdatePhoneNumber={session.updatePhone}
          />
        </React.Suspense>
      </div>
      <div
        style={{ display: screen === 'profile' ? 'flex' : 'none' }}
        className="w-full h-full flex-col flex-grow min-h-0"
      >
        <React.Suspense fallback={<RetroLoading message="ACESSANDO PERFIL..." />}>
          <ProfileScreen
            profile={playerData}
            galleryImages={visualGalleryImages}
            onBack={() => setScreen('player')}
            onLogout={session.handleLogout}
            onChangeMission={() => setScreen('campaignSelection')}
            onChangeCharacter={session.handleCharacterSwitch}
            onUpdateSpotify={session.updateSpotify}
            onUpdatePhoneNumber={session.updatePhone}
            variant="nokia"
          />
        </React.Suspense>
      </div>
    </NokiaDeviceWrapper>
  );
}
