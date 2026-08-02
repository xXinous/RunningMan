import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import RetroLoading from '../../components/player/RetroLoading';
import WalkmanShell from './WalkmanShell';
import MiniAppsOverlay from './MiniAppsOverlay';
import LoginScreen from '../../components/LoginScreen';

const CharacterSelectionScreen = React.lazy(() => import('../../components/CharacterSelectionScreen'));
const ProfileScreen = React.lazy(() => import('../../components/ProfileScreen'));
const AgentDossierOverlay = React.lazy(() =>
  import('../../components/campaign/AgentDossierOverlay').then((m) => ({ default: m.AgentDossierOverlay }))
);
const CampaignSelection = React.lazy(() => import('../../components/CampaignSelection'));
import { usePlayerSession } from '../context/PlayerProviders';
import { usePlayerPlayback } from '../context/PlayerProviders';

export default function PlayerScreenRouter() {
  const session = usePlayerSession();
  const playback = usePlayerPlayback();

  const {
    masterAccount,
    playerData,
    screen,
    setScreen,
    limboStatus,
    intelManager,
    visualGalleryImages,
    handleCharacterSelect,
    handleCharacterSwitch,
    handleLogout,
    handleLogin,
    updateSpotify,
    updatePhone,
    selectCampaign,
  } = session;

  return (
    <AnimatePresence mode="wait">
      {screen === 'login' || !masterAccount ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full h-full flex items-center justify-center"
        >
          <LoginScreen onLogin={handleLogin} />
        </motion.div>
      ) : screen === 'characterSelection' && masterAccount ? (
        <motion.div
          key="charSelect"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full h-full flex items-center justify-center"
        >
          <React.Suspense fallback={<RetroLoading message="LISTANDO AGENTES..." />}>
            <CharacterSelectionScreen
              account={masterAccount}
              onSelect={handleCharacterSelect}
              onLogout={handleLogout}
            />
          </React.Suspense>
        </motion.div>
      ) : playerData === null ? (
        <RetroLoading message="SINCRONIZANDO..." subMessage="Recuperando dossiê do agente" />
      ) : screen === 'profile' ? (
        <motion.div
          key="profile"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full flex items-center justify-center"
        >
          <React.Suspense fallback={<RetroLoading message="ACESSANDO PERFIL..." />}>
            <ProfileScreen
              profile={playerData}
              galleryImages={visualGalleryImages}
              onBack={() => setScreen('player')}
              onLogout={handleLogout}
              onChangeMission={() => setScreen('campaignSelection')}
              onChangeCharacter={handleCharacterSwitch}
              onUpdateSpotify={updateSpotify}
              onUpdatePhoneNumber={updatePhone}
            />
          </React.Suspense>
        </motion.div>
      ) : screen === 'agentDossier' ? (
        <motion.div
          key="agentDossier"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full flex items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full h-full max-w-[520px] rounded-none sm:rounded-[20px] shadow-[0_35px_100px_rgba(0,0,0,0.9)] border-0 sm:border-2 border-primary/20 relative flex flex-col mx-auto overflow-hidden bg-surface">
            <React.Suspense fallback={<RetroLoading message="ABRINDO DOSSIÊ..." />}>
              <AgentDossierOverlay
                onClose={() => setScreen('campaignSelection')}
                playerData={playerData}
                intelManager={intelManager}
              />
            </React.Suspense>
          </div>
        </motion.div>
      ) : screen === 'campaignSelection' ? (
        <motion.div
          key="campaignSelection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full flex items-center justify-center p-0 sm:p-4"
        >
          <React.Suspense fallback={<RetroLoading message="SELECIONANDO MISSÃO..." />}>
            <CampaignSelection
              onSelect={async (c) => {
                await selectCampaign(c);
                setScreen('player');
              }}
              onLogout={handleLogout}
              onShowProfile={() => setScreen('agentDossier')}
              onChangeCharacter={handleCharacterSwitch}
              playerData={playerData}
            />
          </React.Suspense>
        </motion.div>
      ) : screen === 'player' ? (
        <WalkmanShell
          currentIntel={playback.currentIntel}
          walkmanStatus={playback.walkmanStatus}
          isPlaying={playback.isPlaying}
          displayMode={playback.displayMode}
          volume={playback.volume}
          setVolume={playback.setVolume}
          intelItems={intelManager?.getAll() ?? []}
          playerData={playerData}
          onEject={playback.handleEject}
          onScanClick={playback.handleScanClick}
          onCancelScan={playback.handleCancelScan}
          onQrDetected={playback.handleQrDetected}
          onIntelSelect={playback.handleIntelSelect}
          onModeChange={playback.handleModeChange}
          onProfileOpen={playback.handleProfileOpen}
          onCharacterSwitch={handleCharacterSwitch}
          onSetIsPlaying={playback.handleSetIsPlaying}
          onRewind={playback.handleRewind}
          onTerminalOpen={playback.handleTerminalOpen}
          onMacOpen={playback.handleMacOpen}
        />
      ) : (
        <MiniAppsOverlay
          screen={screen}
          playerData={playerData}
          limboStatus={limboStatus}
          setScreen={setScreen}
        />
      )}
    </AnimatePresence>
  );
}
