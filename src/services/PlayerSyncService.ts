import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { activityLogger } from './ActivityLogger';
import type { PlayerData, LimboGlobalState, CharacterData } from '../types/player';
import type { AppScreen } from '../types/player';

export class PlayerSyncService {
  private static instance: PlayerSyncService;
  private unsubs: (() => void)[] = [];
  private constructor() {}

  public static getInstance(): PlayerSyncService {
    if (!PlayerSyncService.instance) {
      PlayerSyncService.instance = new PlayerSyncService();
    }
    return PlayerSyncService.instance;
  }

  public subscribeToPlayerData(
    uid: string | undefined,
    characterId: string | undefined,
    onPlayerDataUpdate: (data: Partial<PlayerData>) => void,
    onScreenChange: (screenSetter: (prev: AppScreen) => AppScreen) => void,
    onLimboUpdate: (limboStatus: LimboGlobalState) => void
  ) {
    this.stopAll();
    if (!uid || !characterId) return;

    // 1. Intel Listener — reads the unified 'intel' subcollection.

    let latestIntelIds: string[] = [];

    const emitIntelUpdate = () => {
      onPlayerDataUpdate({
        unlockedIntelIds: latestIntelIds,
      });
    };

    const unsubIntel = onSnapshot(collection(db, 'users', uid, 'characters', characterId, 'intel'),
      (snapshot) => {
        latestIntelIds = snapshot.docs.map((d) => d.id).sort();
        emitIntelUpdate();
      },
      (error) => console.warn('[PlayerSyncService] Intel/unified error:', error)
    );

    // 2. Character Doc Listener (Character-specific flags)
    const unsubChar = onSnapshot(doc(db, 'users', uid, 'characters', characterId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CharacterData;
          
          if (data.forceTerminalOpen) {
            onScreenChange((prev) => {
              if (prev !== 'bios' && prev !== 'limbo' && prev !== 'diskRepair') {
                activityLogger.logSystem('sync', 'Terminal forçado pelo servidor', { triggeredBy: 'forceTerminalOpen', characterId });
                return 'bios';
              }
              return prev;
            });
          } else if (data.forceMacOpen) {
            onScreenChange((prev) => {
              if (prev !== 'macos') {
                activityLogger.logSystem('sync', 'MacOS forçado pelo servidor', { triggeredBy: 'forceMacOpen', characterId });
                return 'macos';
              }
              return prev;
            });
          }

          onPlayerDataUpdate({ character: { ...data, id: characterId } });
        }
      },
      (error) => console.warn('[PlayerSyncService] Character error:', error)
    );

    // 3. Master Account Listener (Account-level flags)
    const unsubUser = onSnapshot(doc(db, 'users', uid), 
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();

          if (data.forceTerminalOpen) {
            onScreenChange((prev) => {
              if (prev !== 'bios' && prev !== 'limbo' && prev !== 'diskRepair') {
                activityLogger.logSystem('sync', 'Terminal forçado pelo servidor', { triggeredBy: 'forceTerminalOpen', characterId });
                return 'bios';
              }
              return prev;
            });
          } else if (data.forceMacOpen) {
            onScreenChange((prev) => {
              if (prev !== 'macos') {
                activityLogger.logSystem('sync', 'MacOS forçado pelo servidor', { triggeredBy: 'forceMacOpen', characterId });
                return 'macos';
              }
              return prev;
            });
          }

          onPlayerDataUpdate({
            hasTerminalAccess: !!data.hasTerminalAccess,
            hasMacAccess: !!data.hasMacAccess,
          });
        }
      },
      (error) => console.warn('[PlayerSyncService] User error:', error)
    );

    // 4. Limbo Global State
    const unsubLimbo = onSnapshot(doc(db, 'system', 'limboState'), 
      (snap) => {
        const lState: LimboGlobalState = snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false };
        onLimboUpdate(lState);
      },
      (error) => console.warn('[PlayerSyncService] Limbo error:', error)
    );

    this.unsubs.push(unsubIntel, unsubChar, unsubUser, unsubLimbo);
  }

  public stopAll() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
  }
}

export const playerSyncService = PlayerSyncService.getInstance();
