import { db } from "../lib/firebase";
import {
  collection,
  doc,
  deleteDoc,
  updateDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDoc,
  writeBatch,
  onSnapshot,
  collectionGroup,
  limit,
  orderBy,
  startAfter
} from "firebase/firestore";
import { MasterAccount, CharacterData, PlayerStats } from "../types/player";

export interface PlayCountData {
  tapeId: string;
  count: number;
}

export class UserService {
  private static instance: UserService;
  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public subscribeToUsers(callback: (users: MasterAccount[]) => void): () => void {
    return onSnapshot(collection(db, "users"), 
      (snapshot) => {
        const users: MasterAccount[] = snapshot.docs.map((doc) => ({ 
          uid: doc.id, 
          ...doc.data() 
        } as MasterAccount));
        callback(users);
      },
      (err) => console.warn('[UserService] users listener error:', err)
    );
  }

  /**
   * Fetches a single page of users with optional filtering and pagination.
   * Usa leitura completa + ordenação no cliente para paginação estável.
   */
  public async fetchUsersPage(pageSize: number, lastDoc: any = null, searchField: string = '', searchQuery: string = ''): Promise<{ users: MasterAccount[], lastVisible: any }> {
    const sortByCreatedAt = (users: MasterAccount[]) =>
      [...users].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

    if (searchQuery && searchField) {
      try {
        const searchEnd = searchQuery + '\uf8ff';
        let q = query(
          collection(db, 'users'),
          where(searchField, '>=', searchQuery),
          where(searchField, '<=', searchEnd),
          orderBy(searchField),
          limit(pageSize),
        );

        if (lastDoc) {
          q = query(q, startAfter(lastDoc));
        }

        const snapshot = await getDocs(q);
        const users = snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() } as MasterAccount));
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        return { users, lastVisible };
      } catch (err) {
        console.warn('[UserService] prefix search failed, falling back to client filter:', err);
      }
    }

    const snapshot = await getDocs(collection(db, 'users'));
    let users = sortByCreatedAt(snapshot.docs.map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() } as MasterAccount)));

    if (searchQuery && searchField) {
      const q = searchQuery.toLowerCase();
      users = users.filter((user) => {
        const value = (user as unknown as Record<string, unknown>)[searchField];
        return String(value ?? '').toLowerCase().includes(q);
      });
    }

    if (lastDoc) {
      const lastUid = lastDoc.id ?? lastDoc.data?.()?.uid;
      const startIdx = users.findIndex((user) => user.uid === lastUid);
      users = startIdx >= 0 ? users.slice(startIdx + 1) : users;
    }

    const page = users.slice(0, pageSize);
    const lastVisible = page.length > 0 ? snapshot.docs.find((docSnap) => docSnap.id === page[page.length - 1].uid) ?? null : null;
    return { users: page, lastVisible };
  }

  public subscribeToAllCharacters(callback: (characters: {uid: string, char: CharacterData}[]) => void): () => void {
    return onSnapshot(collectionGroup(db, "characters"),
      (snapshot) => {
        const characters: {uid: string, char: CharacterData}[] = snapshot.docs.map((doc) => {
          const uid = doc.ref.parent.parent?.id;
          return { 
            uid: uid || '', 
            char: { id: doc.id, ...doc.data() } as CharacterData 
          };
        }).filter(item => item.uid !== '');
        callback(characters);
      },
      (err) => console.warn('[UserService] characters collectionGroup listener error:', err)
    );
  }

  public async fetchCharactersForUser(uid: string): Promise<CharacterData[]> {
    if (!uid) return [];
    const snap = await getDocs(collection(db, "users", uid, "characters"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as CharacterData));
  }

  /**
   * Searches for characters across all users by codinome (prefix search).
   * Note: This uses collectionGroup, so it still has some cost, but limit(20) makes it scalable.
   */
  public async searchCharactersByCodinome(queryStr: string, limitCount: number = 20): Promise<{uid: string, char: CharacterData}[]> {
    if (!queryStr.trim()) return [];
    
    const searchEnd = queryStr + '\uf8ff';
    const q = query(
      collectionGroup(db, "characters"),
      where("codinome", ">=", queryStr),
      where("codinome", "<=", searchEnd),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const uid = doc.ref.parent.parent?.id || '';
      return {
        uid,
        char: { id: doc.id, ...doc.data() } as CharacterData
      };
    });
  }

  public subscribeToUserTotalPlays(callback: (counts: Record<string, number>) => void): () => void {
    return onSnapshot(collection(db, "playEvents"), 
      (snapshot) => {
        const counts: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.uid) {
            counts[data.uid] = (counts[data.uid] || 0) + 1;
          }
        });
        callback(counts);
      },
      (err) => console.warn('[UserService] playEvents listener error:', err)
    );
  }

  public async loadUserDetails(uid: string, characterId: string): Promise<{
    intel: { id: string; unlockedAt: any }[];
    playCounts: PlayCountData[];
    stats: PlayerStats | null;
    achievements: string[];
  }> {
    try {
      const [intelSnap, eventsSnap, statsSnap, achSnap] = await Promise.all([
        getDocs(collection(db, "users", uid, "characters", characterId, "intel")),
        getDocs(query(collection(db, "playEvents"), where("uid", "==", uid), where("characterId", "==", characterId))),
        getDoc(doc(db, "users", uid, "characters", characterId, "stats", "main")),
        getDocs(collection(db, "users", uid, "characters", characterId, "achievements"))
      ]);

      const intel = intelSnap.docs.map(d => ({ 
        id: d.id, 
        unlockedAt: d.data().unlockedAt 
      }));

      const tapeCounts: Record<string, number> = {};
      eventsSnap.forEach((d) => {
        const data = d.data();
        if (data.tapeId) {
          tapeCounts[data.tapeId] = (tapeCounts[data.tapeId] || 0) + 1;
        }
      });

      const playCounts: PlayCountData[] = Object.entries(tapeCounts).map(([tapeId, count]) => ({
        tapeId,
        count,
      }));

      const stats = statsSnap.exists() ? (statsSnap.data() as PlayerStats) : null;
      const achievements = achSnap.docs.map(d => d.id);

      return { intel, playCounts, stats, achievements };
    } catch (error) {
      console.error('[UserService] Error loading user details:', error);
      return { intel: [], playCounts: [], stats: null, achievements: [] };
    }
  }

  public async deleteUser(uid: string): Promise<void> {
    // Recursively delete all subcollections before deleting the master account
    const characters = await this.fetchCharactersForUser(uid);
    for (const char of characters) {
      await this.deleteCharacter(uid, char.id);
    }
    // Delete playEvents associated with this user
    const playEventsSnap = await getDocs(query(collection(db, 'playEvents'), where('uid', '==', uid)));
    const batch = writeBatch(db);
    playEventsSnap.docs.forEach((d) => batch.delete(d.ref));
    if (playEventsSnap.docs.length > 0) await batch.commit();
    // Delete master account document
    await deleteDoc(doc(db, 'users', uid));
  }

  public async updateMasterAccount(uid: string, data: Partial<MasterAccount>): Promise<void> {
    await updateDoc(doc(db, "users", uid), data);
  }

  public async updateCharacter(uid: string, characterId: string, data: Partial<CharacterData>): Promise<void> {
    await updateDoc(doc(db, "users", uid, "characters", characterId), data);
  }

  public async deleteCharacter(uid: string, characterId: string): Promise<void> {
    const batch = writeBatch(db);
    
    // 1. Fetch all docs from subcollections
    const [intelSnap, achSnap] = await Promise.all([
      getDocs(collection(db, "users", uid, "characters", characterId, "intel")),
      getDocs(collection(db, "users", uid, "characters", characterId, "achievements")),
    ]);

    // 2. Add all deletions to batch
    intelSnap.docs.forEach(d => batch.delete(d.ref));
    achSnap.docs.forEach(d => batch.delete(d.ref));

    // 3. Delete the main character document
    batch.delete(doc(db, "users", uid, "characters", characterId));

    // 4. Commit everything
    await batch.commit();
  }

  public async updateUserRole(uid: string, role: 'player' | 'admin'): Promise<void> {
    await updateDoc(doc(db, "users", uid), { role });
  }

  public async removeUserIntel(uid: string, characterId: string, intelId: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid, "characters", characterId, "intel", intelId));
  }

  public async addUserIntel(uid: string, characterId: string, intelId: string): Promise<void> {
    const unlockData = {
      intelId,
      unlockedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "users", uid, "characters", characterId, "intel", intelId), unlockData, { merge: true });
  }

  public async grantUserAchievement(uid: string, characterId: string, achievementId: string): Promise<void> {
    await setDoc(doc(db, "users", uid, "characters", characterId, "achievements", achievementId), {
      achievementId,
      unlockedAt: serverTimestamp(),
    });
  }

  public async revokeUserAchievement(uid: string, characterId: string, achievementId: string): Promise<void> {
    await deleteDoc(doc(db, "users", uid, "characters", characterId, "achievements", achievementId));
  }

  public async adminCreateUser(masterId: string, rawPassword: string, role: 'player' | 'admin'): Promise<{ uid: string; characterId: string }> {
    const { getFunctions } = await import('firebase/functions');
    const { httpsCallable } = await import('firebase/functions');
    const { getApp } = await import('firebase/app');
    const functions = getFunctions(getApp(), 'southamerica-east1');
    const fn = httpsCallable(functions, 'adminCreateUser');
    const result = await fn({ masterId, password: rawPassword, role });
    const data = result.data as { success?: boolean; uid?: string; characterId?: string };
    if (!data.success || !data.uid || !data.characterId) {
      throw new Error('Falha ao criar usuário.');
    }
    return { uid: data.uid, characterId: data.characterId };
  }

  public async resetUserPassword(targetUid: string, newPassword: string): Promise<void> {
    const { getFunctions } = await import('firebase/functions');
    const { httpsCallable } = await import('firebase/functions');
    const { getApp } = await import('firebase/app');
    const functions = getFunctions(getApp(), 'southamerica-east1');
    const fn = httpsCallable(functions, 'adminResetPassword');
    const result = await fn({ targetUid, newPassword });
    const data = result.data as { success?: boolean };
    if (!data.success) throw new Error('Falha ao alterar senha.');
  }

  /**
   * Soft-delete: sets archived=true instead of destroying the character document.
   */
  public async archiveCharacter(uid: string, characterId: string, archived = true): Promise<void> {
    await updateDoc(doc(db, "users", uid, "characters", characterId), { archived });
  }

  /**
   * Quick character creation by admin — only codinome required, everything else defaults.
   */
  public async createCharacterForAccount(uid: string, codinome: string): Promise<string> {
    const charId = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    await setDoc(doc(db, "users", uid, "characters", charId), {
      codinome: codinome.trim(),
      agentStatus: 'vivo',
      dangerLevel: 1,
      archived: false,
      createdAt: serverTimestamp(),
    });
    return charId;
  }

  /**
   * Transfers a character from one account to another by copying all subcollections
   * and deleting from the source.
   */
  public async transferCharacter(fromUid: string, toUid: string, characterId: string): Promise<void> {
    const batch = writeBatch(db);

    // 1. Fetch character document and all subcollections
    const [charSnap, intelSnap, achSnap, statsSnap] = await Promise.all([
      getDoc(doc(db, "users", fromUid, "characters", characterId)),
      getDocs(collection(db, "users", fromUid, "characters", characterId, "intel")),
      getDocs(collection(db, "users", fromUid, "characters", characterId, "achievements")),
      getDoc(doc(db, "users", fromUid, "characters", characterId, "stats", "main"))
    ]);

    if (!charSnap.exists()) throw new Error('Character not found');

    // 2. Set character document in target
    batch.set(doc(db, "users", toUid, "characters", characterId), charSnap.data());

    // 3. Set intel subcollection in target
    intelSnap.docs.forEach(d => {
      batch.set(doc(db, "users", toUid, "characters", characterId, "intel", d.id), d.data());
    });

    // 4. Set achievements subcollection in target
    achSnap.docs.forEach(d => {
      batch.set(doc(db, "users", toUid, "characters", characterId, "achievements", d.id), d.data());
    });

    // 5. Set stats in target
    if (statsSnap.exists()) {
      batch.set(doc(db, "users", toUid, "characters", characterId, "stats", "main"), statsSnap.data());
    }

    // 6. Commit the copies
    await batch.commit();

    // 7. Delete from source
    await this.deleteCharacter(fromUid, characterId);
  }

  /**
   * Returns a consolidated list of all characters with their parent account info.
   * Used by GroupManager for character-level selection.
   */
  public async fetchAllCharactersWithAccounts(): Promise<{ account: MasterAccount; character: CharacterData }[]> {
    const accountsSnap = await getDocs(collection(db, "users"));
    const results: { account: MasterAccount; character: CharacterData }[] = [];

    for (const accDoc of accountsSnap.docs) {
      const account = { uid: accDoc.id, ...accDoc.data() } as MasterAccount;
      const charsSnap = await getDocs(collection(db, "users", accDoc.id, "characters"));
      charsSnap.docs.forEach(charDoc => {
        results.push({
          account,
          character: { id: charDoc.id, ...charDoc.data() } as CharacterData,
        });
      });
    }
    return results;
  }

  public async generateUserBackup(account: MasterAccount, character: CharacterData): Promise<string> {
    const details = await this.loadUserDetails(account.uid, character.id);
    
    const achSnap = await getDocs(collection(db, "users", account.uid, "characters", character.id, "achievements"));
    const achievements = achSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const backup = {
      exportedAt: new Date().toISOString(),
      account: {
        ...account,
        lastLogin: account.lastLogin?.toDate?.()?.toISOString?.() || null,
        createdAt: account.createdAt?.toDate?.()?.toISOString?.() || null,
      },
      character: {
        ...character,
        createdAt: character.createdAt?.toDate?.()?.toISOString?.() || null,
      },
      intel: details.intel,
      achievements,
      playEvents: details.playCounts,
      stats: details.stats
    };

    return JSON.stringify(backup, null, 2);
  }
}

export const userService = UserService.getInstance();
