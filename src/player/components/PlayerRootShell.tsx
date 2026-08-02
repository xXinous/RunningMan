import React from 'react';
import { AnimatePresence } from 'motion/react';
import { useSwipeable } from 'react-swipeable';
import ToastNotification from '../../components/ToastNotification';
import RetroLoading from '../../components/player/RetroLoading';

const EvidenceReader = React.lazy(() => import('../../components/EvidenceReader'));
import NokiaSessionLayout from './NokiaSessionLayout';
import PlayerScreenRouter from './PlayerScreenRouter';
import { usePlayerSession } from '../context/PlayerProviders';
import { usePlayerPlayback } from '../context/PlayerProviders';

export default function PlayerRootShell() {
  const session = usePlayerSession();
  const playback = usePlayerPlayback();

  const { masterAccount, playerData, screen, setScreen, isNokiaTheme, showNokiaShell } = session;

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => screen === 'player' && playback.playerDataRef.current && setScreen('profile'),
    onSwipedRight: () => screen === 'profile' && playback.playerDataRef.current && setScreen('player'),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  if (masterAccount === null) {
    return (
      <RetroLoading fullScreen message="AUTENTICANDO..." subMessage="Validando credenciais de acesso" />
    );
  }

  return (
    <div
      onMouseDown={swipeHandlers.onMouseDown}
      ref={swipeHandlers.ref}
      className={`fixed inset-0 player-viewport bg-surface flex items-center justify-center p-0 sm:p-4 overflow-hidden select-none${showNokiaShell ? ' overscroll-none' : ''}`}
    >
      {!isNokiaTheme && (
        <>
          <div className="noise-overlay" />
          <div className="scanlines" />
          <div className="vignette" />
        </>
      )}

      {showNokiaShell && playerData ? <NokiaSessionLayout /> : <PlayerScreenRouter />}

      <AnimatePresence>
        {playback.activeEvidence && (
          <React.Suspense fallback={null}>
            <EvidenceReader
              evidence={playback.activeEvidence}
              onClose={() => playback.setActiveEvidence(null)}
            />
          </React.Suspense>
        )}
      </AnimatePresence>

      <ToastNotification toasts={playback.toasts} onDismiss={playback.dismissToast} />
    </div>
  );
}
