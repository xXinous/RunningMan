import type { PlayerData, PlayerStats } from '../types/player';
import type { IntelItem } from '../types/intel';
import { recordPlayEvent, markPlayEventCompleted, firestoreUpdateStats, firestoreGrantAchievements } from '../store/firestore';
import { checkNewAchievements } from '../data/achievements';
import { intelRegistry } from '../data/intel_registry';
import type { Toast } from '../components/ToastNotification';
import { activityLogger } from './ActivityLogger';
import { auth } from '../lib/firebase';
import { firebaseAnalytics } from './FirebaseAnalyticsService';

export class AnalyticsTracker {
  private static instance: AnalyticsTracker;
  private listenTimer: number | null = null;
  private syncTimer: number | null = null;
  private activePlayEventId: string | null = null;
  private activeTapeId: string | null = null;
  private currentVolume: number = 80;
  
  private localStats: PlayerStats | null = null;
  private playerData: PlayerData | null = null;
  
  private onStatsSync: ((stats: PlayerStats, data: PlayerData) => void) | null = null;
  private onToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

  private constructor() {}

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  public init(
    playerData: PlayerData, 
    initialStats: PlayerStats, 
    onStatsSync: (stats: PlayerStats, data: PlayerData) => void,
    onToast: (toast: Omit<Toast, 'id'>) => void
  ) {
    this.playerData = playerData;
    this.localStats = initialStats;
    this.onStatsSync = onStatsSync;
    this.onToast = onToast;
    
    // Auto-initialize activity logger context
    activityLogger.setUser(playerData.uid, playerData.character.codinome, playerData.activeCharacterId);
    
    // Initialize Firebase Analytics with user identity
    firebaseAnalytics.init().then(() => {
      firebaseAnalytics.setUser(playerData.uid, playerData.activeCharacterId, playerData.character.codinome);
    });
    
    this.startBackgroundSync();
  }

  public setVolume(vol: number) {
    this.currentVolume = vol;
  }

  public updatePlayerData(data: PlayerData) {
    this.playerData = data;
    if (data.uid && data.character?.codinome) {
        activityLogger.setUser(data.uid, data.character.codinome, data.activeCharacterId);
    }
  }

  public incrementStat(key: keyof PlayerStats, amount = 1) {
    if (!this.localStats) return;
    this.localStats[key] = (this.localStats[key] as number) + amount;
    this.syncLocalChanges();
    this.checkAchievements();
    
    if (key === 'fidgetClicks' && typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { window.navigator.vibrate(50); } catch(e) {}
    }
  }

  public startPlayback(intel: IntelItem) {
    if (!this.playerData) return;

    // Retomar a mesma fita após pausa não é um novo play: reaproveita o
    // playEvent aberto e só religa o timer de escuta.
    const isResume = this.activePlayEventId !== null && this.activeTapeId === intel.id;
    if (!isResume) {
      this.activeTapeId = intel.id;
      this.activePlayEventId = null;
      recordPlayEvent(this.playerData.uid, this.playerData.activeCharacterId, intel.id)
        .then(id => {
          // Descarta o ID se outra fita começou enquanto o registro era criado
          if (this.activeTapeId === intel.id) this.activePlayEventId = id;
        })
        .catch(console.error);

      activityLogger.logAction('tape_play', `Iniciou reprodução: ${intel.title}`, { intelId: intel.id });

      // Firebase Analytics: tape engagement tracking
      firebaseAnalytics.logTapePlay(
        intel.id, 
        intel.type || 'AUDIO', 
        this.playerData.character?.campaignId
      );
    }
    
    if (this.listenTimer) clearInterval(this.listenTimer);
    this.listenTimer = window.setInterval(() => this.tick(), 5000);
  }

  public pausePlayback() {
    if (this.listenTimer) clearInterval(this.listenTimer);
  }

  /** Encerra a reprodução ativa sem completar o playEvent (eject/troca de fita). */
  public abandonPlayback() {
    this.pausePlayback();
    this.activePlayEventId = null;
    this.activeTapeId = null;
  }

  public endPlayback() {
    this.pausePlayback();
    const completedEventId = this.activePlayEventId;
    if (completedEventId) {
      markPlayEventCompleted(completedEventId).catch(console.error);
      this.activePlayEventId = null;
    }
    this.activeTapeId = null;
    activityLogger.logAction('tape_end', 'Reprodução finalizada');
    
    // Firebase Analytics: completion tracking
    if (this.localStats) {
      firebaseAnalytics.logTapeCompleted(
        completedEventId || 'unknown',
        this.localStats.totalListenTime
      );
    }
  }

  private tickCount = 0;

  private tick() {
    if (!this.localStats || !this.playerData) return;
    this.localStats.totalListenTime += 5;
    if (this.currentVolume === 100) this.localStats.maxVolumeTime += 5;
    if (this.currentVolume === 0) this.localStats.zeroVolumeTime += 5;
    
    this.tickCount++;
    if (this.tickCount % 6 === 0) {
      this.syncLocalChanges();
      this.checkAchievements();
    }
  }

  private syncLocalChanges() {
    if (this.onStatsSync && this.localStats && this.playerData) {
      this.onStatsSync({ ...this.localStats }, { ...this.playerData });
    }
  }

  public forceSyncToServer() {
    if (this.playerData && this.localStats) {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== this.playerData.uid) {
        return;
      }
      firestoreUpdateStats(this.playerData.uid, this.playerData.activeCharacterId, this.localStats).catch(console.error);
    }
  }

  private startBackgroundSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = window.setInterval(() => this.forceSyncToServer(), 60000);
  }

  public stopAll(skipSync = false) {
    this.pausePlayback();
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (!skipSync) this.forceSyncToServer();
    this.activePlayEventId = null;
    this.activeTapeId = null;
    this.playerData = null;
    this.localStats = null;
    this.onStatsSync = null;
    this.onToast = null;
    activityLogger.clearUser();
    firebaseAnalytics.clearUser();
  }

  private resolveOwnedIntelForAchievements(): IntelItem[] {
    if (!this.playerData) return [];
    const ids = this.playerData.unlockedIntelIds;
    return intelRegistry.resolve(ids);
  }

  public checkAchievements(scanTimes: number[] = []) {
    if (!this.playerData || !this.localStats) return;
    const profile = { ...this.playerData, stats: this.localStats };
    const intelItems = this.resolveOwnedIntelForAchievements();
    const newAchievements = checkNewAchievements(profile, intelItems, scanTimes.length);
    
    if (newAchievements.length > 0) {
      firestoreGrantAchievements(this.playerData.uid, this.playerData.activeCharacterId, newAchievements.map(a => a.id))
        .catch(err => console.warn('[AnalyticsTracker] Failed to grant achievements:', err));
      
      this.forceSyncToServer();
      newAchievements.forEach(ach => {
        if (this.onToast) this.onToast({ type: 'achievement', title: 'Conquista!', subtitle: ach.title, icon: ach.icon });
        // Firebase Analytics: achievement tracking for ML predictions
        firebaseAnalytics.logAchievementUnlocked(ach.id);
      });
      this.playerData.achievementIds = [...this.playerData.achievementIds, ...newAchievements.map(a => a.id)];
      this.syncLocalChanges();
    }
  }

  public grantAchievement(id: string) {
    if (!this.playerData || !this.localStats) return;
    if (this.playerData.achievementIds.includes(id)) return;
    
    firestoreGrantAchievements(this.playerData.uid, this.playerData.activeCharacterId, [id])
      .catch(err => console.warn('[AnalyticsTracker] Failed to grant achievement:', err));
    
    this.playerData.achievementIds = [...this.playerData.achievementIds, id];
    activityLogger.logAction('achievement', `Conquista desbloqueada: ${id}`, { achievementId: id });
    
    if (this.onToast) {
      this.onToast({ type: 'achievement', title: 'Conquista!', subtitle: 'Nova Conquista Desbloqueada', icon: '🏆' });
    }
    this.syncLocalChanges();
    this.forceSyncToServer();
  }
}

export const analyticsTracker = AnalyticsTracker.getInstance();
