import React from 'react';
import { motion } from 'motion/react';
import RetroLoading from '../../components/player/RetroLoading';

const BiosTerminal = React.lazy(() => import('../../components/BiosTerminal'));
const LimboBoard = React.lazy(() => import('../../components/LimboBoard'));
const DiskRepairApp = React.lazy(() => import('../../components/DiskRepairApp'));
const MacOsApp = React.lazy(() => import('../../components/MacOsApp'));
const Windows95App = React.lazy(() => import('../../components/Windows95App'));
import type { AppScreen, LimboGlobalState, PlayerData } from '../../types/player';

interface MiniAppsOverlayProps {
  screen: AppScreen;
  playerData: PlayerData;
  limboStatus: LimboGlobalState;
  setScreen: (screen: AppScreen) => void;
}

export default function MiniAppsOverlay({ screen, playerData, limboStatus, setScreen }: MiniAppsOverlayProps) {
  return (
    <motion.div
      key="apps"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50"
    >
      <React.Suspense
        fallback={
          <RetroLoading
            fullScreen
            message="INICIALIZANDO SISTEMA..."
            subMessage="Carregando interface de baixo nível"
          />
        }
      >
        {screen === 'bios' && (
          <BiosTerminal
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            characterName={playerData.character.codinome}
            onIpDetected={() => setScreen('limbo')}
            onClose={() => setScreen('player')}
            onAppLaunch={(app) => app === 'diskRepair' && setScreen('diskRepair')}
            onBootSystem={() => setScreen('windows95')}
          />
        )}
        {screen === 'limbo' && (
          <LimboBoard
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            onClose={() => setScreen('player')}
            onBackToTerminal={() => setScreen('bios')}
            globalSeizedStatus={limboStatus.seized}
            readThreadIds={playerData.character.readThreadIds || []}
          />
        )}
        {screen === 'diskRepair' && (
          <DiskRepairApp
            uid={playerData.uid}
            characterId={playerData.activeCharacterId}
            onClose={() => setScreen('player')}
            onBackToTerminal={() => setScreen('bios')}
          />
        )}
        {screen === 'macos' && <MacOsApp uid={playerData.uid} onClose={() => setScreen('player')} />}
        {screen === 'windows95' && <Windows95App uid={playerData.uid} onClose={() => setScreen('player')} />}
      </React.Suspense>
    </motion.div>
  );
}
