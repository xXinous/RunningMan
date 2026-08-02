import { useEffect, useRef } from 'react';
import { firebaseAnalytics } from '../../services/FirebaseAnalyticsService';
import { analyticsTracker } from '../../services/AnalyticsTracker';
import { playerSyncService } from '../../services/PlayerSyncService';
import type { AppScreen } from '../../types/player';
import type { Toast } from '../../components/ToastNotification';
import type { PlayerAuthState } from './usePlayerAuth';

export function usePlayerScreenAnalytics(screen: AppScreen) {
  const previousScreenRef = useRef<AppScreen | null>(null);

  useEffect(() => {
    firebaseAnalytics.logScreenView(screen, previousScreenRef.current || undefined);
    previousScreenRef.current = screen;
  }, [screen]);
}

export function usePlayerServicesSync(
  auth: Pick<
    PlayerAuthState,
    'playerData' | 'localStats' | 'setPlayerData' | 'setLocalStats' | 'setScreen' | 'setLimboStatus'
  >,
  addToast: (toast: Omit<Toast, 'id'>) => void
) {
  const { playerData, localStats, setPlayerData, setLocalStats, setScreen, setLimboStatus } = auth;

  useEffect(() => {
    if (!playerData || !localStats) return;

    analyticsTracker.init(
      playerData,
      localStats,
      (stats, data) => {
        setLocalStats(stats);
        setPlayerData(data);
      },
      (toast) => addToast(toast)
    );

    playerSyncService.subscribeToPlayerData(
      playerData.uid,
      playerData.activeCharacterId,
      (updatedData) => {
        setPlayerData((prev) => (prev ? { ...prev, ...updatedData } : prev));
      },
      setScreen,
      setLimboStatus
    );

    return () => {
      analyticsTracker.stopAll(true);
      playerSyncService.stopAll();
    };
  }, [playerData?.activeCharacterId, addToast, setPlayerData, setLocalStats, setScreen, setLimboStatus]);

  // Mantém o tracker com o playerData mais recente (unlocks via QR, sync remoto, etc.)
  useEffect(() => {
    if (playerData) analyticsTracker.updatePlayerData(playerData);
  }, [playerData]);
}
