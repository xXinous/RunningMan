import { db } from "../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  getDocs, 
  collectionGroup, 
  writeBatch, 
  doc, 
  query, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { ALL_ACHIEVEMENTS } from "../data/achievements";

export interface PlayEvent {
  uid: string;
  tapeId: string;
  playedAt: any;
  completed?: boolean;
}

export interface AudioMetadata {
  id: string;
  size: number;
  title?: string;
  originalName?: string;
}

export interface UserAchievement {
  achievementId: string;
}

import type { PlayerStats } from '../types/player';

export interface UserData {
  uid: string;
  displayName?: string;
  username?: string;
  email?: string;
  createdAt?: any;
  lastLogin?: any;
}

export class AdminAnalyticsService {
  private static instance: AdminAnalyticsService;
  private constructor() {}

  public static getInstance(): AdminAnalyticsService {
    if (!AdminAnalyticsService.instance) {
      AdminAnalyticsService.instance = new AdminAnalyticsService();
    }
    return AdminAnalyticsService.instance;
  }

  public subscribeToAggregatedAnalytics(callback: (data: any) => void): () => void {
    return onSnapshot(doc(db, "system", "analytics"), (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      } else {
        callback(null);
      }
    }, (err) => console.warn('[AdminAnalyticsService] aggregated analytics listener error:', err));
  }

  public subscribeToRawData(callback: (data: {
    playEvents: PlayEvent[];
    users: UserData[];
    audios: AudioMetadata[];
    unlockedAchievements: UserAchievement[];
    stats: PlayerStats[];
  }) => void): () => void {
    let playEvents: PlayEvent[] = [];
    let users: UserData[] = [];
    let audios: AudioMetadata[] = [];
    let unlockedAchievements: UserAchievement[] = [];
    let stats: PlayerStats[] = [];

    const notify = () => {
      callback({ playEvents, users, audios, unlockedAchievements, stats });
    };

    // We keep these for now but they should eventually be paginated or replaced
    const unsubs = [
      onSnapshot(collection(db, "users"), 
        (snap) => {
          users = snap.docs.map(d => d.data() as UserData);
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] users listener error:', err)
      ),
      onSnapshot(collection(db, "mediaAssets"),
        (snap) => {
          audios = snap.docs
            .filter((d) => (d.data() as { type?: string }).type === 'audio')
            .map((d) => {
              const data = d.data() as { size?: number; originalName?: string; metadata?: { title?: string } };
              return {
                id: d.id,
                size: data.size ?? 0,
                originalName: data.originalName,
                title: data.metadata?.title,
              };
            });
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] mediaAssets listener error:', err)
      ),
      onSnapshot(collectionGroup(db, "achievements"), 
        (snap) => {
          unlockedAchievements = snap.docs.map(d => d.data() as UserAchievement);
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] achievements listener error:', err)
      ),
      onSnapshot(collectionGroup(db, "stats"), 
        (snap) => {
          stats = snap.docs.map(d => d.data() as PlayerStats);
          notify();
        },
        (err) => console.warn('[AdminAnalyticsService] stats listener error:', err)
      )
    ];

    return () => unsubs.forEach(u => u());
  }

  public async resetAnalytics(): Promise<void> {
    const [playEventsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'playEvents')),
      getDocs(collection(db, 'users'))
    ]);

    let batch = writeBatch(db);
    let count = 0;

    // Delete play events
    const deletePromises: Promise<void>[] = [];
    playEventsSnap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      count++;
      if (count % 400 === 0) {
        deletePromises.push(batch.commit());
        batch = writeBatch(db);
      }
    });
    deletePromises.push(batch.commit());

    // Reset user stats
    batch = writeBatch(db);
    count = 0;
    const statsPromises: Promise<void>[] = [];
    usersSnap.docs.forEach((userDoc) => {
      const statsRef = doc(db, 'users', userDoc.id, 'stats', 'main');
      batch.set(statsRef, {
        totalListenTime: 0,
        screwClicks: 0,
        fidgetClicks: 0,
        ejectWithoutPlay: 0,
        maxVolumeTime: 0,
        zeroVolumeTime: 0,
      }, { merge: true });
      count++;
      if (count % 400 === 0) {
        statsPromises.push(batch.commit());
        batch = writeBatch(db);
      }
    });
    statsPromises.push(batch.commit());

    await Promise.all([...deletePromises, ...statsPromises]);
  }

  public computeAnalytics(
    playEvents: PlayEvent[],
    users: UserData[],
    audios: AudioMetadata[],
    unlockedAchievements: UserAchievement[],
    stats: PlayerStats[]
  ) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeUsers = users.filter((u) => {
      if (!u.lastLogin?.toDate) return false;
      return u.lastLogin.toDate() >= sevenDaysAgo;
    }).length;

    const tapePlayMap = new Map<string, number>();
    const userPlayMap = new Map<string, number>();
    const dailyPlays = new Map<string, number>();
    const hourMap = new Map<number, number>();
    const userTapePlays = new Map<string, number>();
    let completedPlays = 0;
    let maxObsessionCount = 0;

    // Initialize daily plays for the last 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyPlays.set(key, 0);
    }

    // Initialize hour map
    for (let i = 0; i < 24; i++) hourMap.set(i, 0);

    // Single pass over playEvents for multiple metrics
    playEvents.forEach((e) => {
      tapePlayMap.set(e.tapeId, (tapePlayMap.get(e.tapeId) ?? 0) + 1);
      userPlayMap.set(e.uid, (userPlayMap.get(e.uid) ?? 0) + 1);
      
      if (e.completed) completedPlays++;

      const obsessionKey = `${e.uid}_${e.tapeId}`;
      const obsCount = (userTapePlays.get(obsessionKey) ?? 0) + 1;
      userTapePlays.set(obsessionKey, obsCount);
      if (obsCount > maxObsessionCount) {
        maxObsessionCount = obsCount;
      }

      if (e.playedAt?.toDate) {
        const date = e.playedAt.toDate();
        const dateKey = date.toISOString().slice(0, 10);
        if (dailyPlays.has(dateKey)) {
          dailyPlays.set(dateKey, (dailyPlays.get(dateKey) ?? 0) + 1);
        }
        hourMap.set(date.getHours(), (hourMap.get(date.getHours()) ?? 0) + 1);
      }
    });

    const mostPlayed = Array.from(tapePlayMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const mostActiveUsers = Array.from(userPlayMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([uid, count]) => {
        const user = users.find((u) => u.uid === uid);
        return { uid, name: user?.displayName || user?.username || (uid?.slice ? uid.slice(0, 8) : 'unknown'), count };
      });

    const dailyPlaysSorted = Array.from(dailyPlays.entries()).sort(([a], [b]) => a.localeCompare(b));
    const maxDailyPlays = Math.max(...dailyPlays.values(), 1);
    
    const peakHours = Array.from(hourMap.entries()).map(([h, count]) => ({ hour: h, count }));
    const maxHourCount = Math.max(...hourMap.values(), 1);

    const weeklyGrowth = new Map<string, number>();
    users.forEach((u) => {
      if (u.createdAt?.toDate) {
        const d = u.createdAt.toDate();
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        weeklyGrowth.set(key, (weeklyGrowth.get(key) ?? 0) + 1);
      }
    });

    const achCountMap = new Map<string, number>();
    unlockedAchievements.forEach(a => {
      achCountMap.set(a.achievementId, (achCountMap.get(a.achievementId) ?? 0) + 1);
    });

    const rarityList = ALL_ACHIEVEMENTS.map(a => ({
      ...a,
      count: achCountMap.get(a.id) ?? 0,
      percentage: users.length > 0 ? ((achCountMap.get(a.id) ?? 0) / users.length) * 100 : 0
    })).sort((a, b) => a.count - b.count);

    const totalStorageSize = audios.reduce((acc, a) => acc + (a.size || 0), 0);
    const storagePercentage = (totalStorageSize / (5 * 1024 * 1024 * 1024)) * 100;

    const statsTotals = stats.reduce((acc, s) => ({
      totalListenTime: acc.totalListenTime + (s.totalListenTime || 0),
      screwClicks: acc.screwClicks + (s.screwClicks || 0),
      fidgetClicks: acc.fidgetClicks + (s.fidgetClicks || 0),
      ejectWithoutPlay: acc.ejectWithoutPlay + (s.ejectWithoutPlay || 0),
      maxVolumeTime: acc.maxVolumeTime + (s.maxVolumeTime || 0),
      zeroVolumeTime: acc.zeroVolumeTime + (s.zeroVolumeTime || 0),
    }), { totalListenTime: 0, screwClicks: 0, fidgetClicks: 0, ejectWithoutPlay: 0, maxVolumeTime: 0, zeroVolumeTime: 0 });

    return { 
      activeUsers, 
      mostPlayed, 
      mostActiveUsers, 
      dailyPlaysSorted, 
      maxDailyPlays, 
      weeklyGrowth,
      rarityList,
      peakHours,
      maxHourCount,
      completionRate: playEvents.length > 0 ? (completedPlays / playEvents.length) * 100 : 0,
      totalStorageSize,
      storagePercentage,
      totalListenSecs: statsTotals.totalListenTime,
      avgListenSecs: users.length > 0 ? statsTotals.totalListenTime / users.length : 0,
      totalScrews: statsTotals.screwClicks,
      totalFidgets: statsTotals.fidgetClicks,
      totalEjects: statsTotals.ejectWithoutPlay,
      totalMacVolSecs: statsTotals.maxVolumeTime,
      totalZeroVolSecs: statsTotals.zeroVolumeTime,
      maxObsessionCount,
      abandonRate: playEvents.length > 0 ? ((playEvents.length - completedPlays) / playEvents.length) * 100 : 0,
      totalAchievements: unlockedAchievements.length,
      totalPlays: playEvents.length,
      completedPlays,
    };
  }
}

export const adminAnalyticsService = AdminAnalyticsService.getInstance();
