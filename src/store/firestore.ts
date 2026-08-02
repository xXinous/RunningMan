import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  deleteDoc,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, db } from '../lib/firebase';
import { 
  PlayerData, 
  PlayerStats, 
  MasterAccount,
  CharacterData,
  LimboGlobalState, 
  GalleryImage, 
  GalleryCategory,
  QrRedirect
} from '../types/player';
import type { IntelItem } from '../types/intel';

const DEFAULT_STATS: PlayerStats = {
  totalListenTime: 0,
  screwClicks: 0,
  fidgetClicks: 0,
  ejectWithoutPlay: 0,
  maxVolumeTime: 0,
  zeroVolumeTime: 0,
};

// --- Admin Types ---
export interface PlayerMeta extends MasterAccount {
  username?: string;
  forceTerminalOpen?: boolean;
  forceMacOpen?: boolean;
}

// --- Account Management ---

export async function loadMasterAccount(uid: string): Promise<MasterAccount> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    throw new Error('Account not found');
  }
  const data = snap.data();
  return {
    uid,
    email: data?.email || '',
    masterName: data?.masterName || data?.displayName || 'Agente',
    role: data?.role || 'player',
    createdAt: data?.createdAt || null,
    ...data
  } as MasterAccount;
}

const DEFAULT_WAIT_FOR_USER_DOC_MS = 8000;

/**
 * Aguarda o perfil users/{uid} ser criado pelo trigger server-side (onAuthUserCreated).
 */
export function waitForUserDoc(uid: string, timeoutMs = DEFAULT_WAIT_FOR_USER_DOC_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const ref = doc(db, 'users', uid);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub();
      reject(new Error('Timeout aguardando criação do perfil.'));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (settled) return;
        if (snap.exists()) {
          settled = true;
          clearTimeout(timer);
          unsub();
          resolve();
        }
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsub();
        reject(err);
      },
    );
  });
}

export async function updateLastLogin(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    lastLogin: serverTimestamp(),
  }, { merge: true });
}

// --- Character Management ---

export async function fetchCharacters(uid: string): Promise<CharacterData[]> {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, 'users', uid, 'characters'), orderBy('createdAt', 'desc')));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as CharacterData))
    .filter(c => !c.archived);
}

export async function createCharacter(uid: string, codinome: string): Promise<CharacterData> {
  if (!uid) throw new Error('Cannot create character without UID');
  const charId = `${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const charData: Omit<CharacterData, 'id'> = {
    codinome,
    agentStatus: 'vivo',
    dangerLevel: 1,
    archived: false,
    createdAt: serverTimestamp() as any,
  };
  await setDoc(doc(db, 'users', uid, 'characters', charId), charData);
  return { id: charId, ...charData } as CharacterData;
}

export async function loadPlayerData(uid: string, characterId: string): Promise<PlayerData> {
  if (!uid || !characterId) throw new Error('LoadPlayerData failed: Missing identifiers');
  
  const [accountSnap, charSnap, statsSnap, achievementsSnap, intelSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(doc(db, 'users', uid, 'characters', characterId)),
    getDoc(doc(db, 'users', uid, 'characters', characterId, 'stats', 'main')),
    getDocs(collection(db, 'users', uid, 'characters', characterId, 'achievements')),
    getDocs(collection(db, 'users', uid, 'characters', characterId, 'intel'))
  ]);

  if (!accountSnap.exists() || !charSnap.exists()) {
    throw new Error('Data integrity failure: Account or Character missing');
  }

  const accountData = accountSnap.data();
  const account: MasterAccount = {
    uid,
    email: accountData?.email || '',
    masterName: accountData?.masterName || accountData?.displayName || 'Agente',
    role: accountData?.role || 'player',
    createdAt: accountData?.createdAt || null,
    ...accountData
  };
  const character = { ...charSnap.data(), id: characterId } as CharacterData;
  const stats = statsSnap.exists() ? { ...DEFAULT_STATS, ...(statsSnap.data() as Partial<PlayerStats>) } : DEFAULT_STATS;

  return {
    ...account,
    activeCharacterId: characterId,
    character,
    achievementIds: achievementsSnap.docs.map((d) => d.id),
    stats,
    unlockedIntelIds: intelSnap.docs.map((d) => d.id).sort(),
  };
}

// --- Character Progress ---

export async function firestoreUnlockIntel(uid: string, characterId: string, intelId: string, campaignId?: string): Promise<void> {
  const unlockData = {
    intelId,
    unlockedAt: serverTimestamp(),
    campaignId: campaignId || null,
    type: 'AUDIO' // Default type; overridden by IntelService with proper type
  };
  await setDoc(doc(db, 'users', uid, 'characters', characterId, 'intel', intelId), unlockData, { merge: true });
}

export async function firestoreGrantAchievements(uid: string, characterId: string, achievementIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  achievementIds.forEach((id) => {
    batch.set(doc(db, 'users', uid, 'characters', characterId, 'achievements', id), {
      achievementId: id,
      unlockedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function firestoreUpdateStats(uid: string, characterId: string, statsDelta: Partial<PlayerStats>): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId, 'stats', 'main'), statsDelta, { merge: true });
}

export async function firestoreUpdateSpotifyPlaylist(uid: string, characterId: string, url: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { spotifyPlaylistUrl: url }, { merge: true });
}

export async function firestoreUpdatePhoneNumber(uid: string, characterId: string, phoneNumber: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { phoneNumber }, { merge: true });
}

export async function firestoreSetCampaign(uid: string, characterId: string, campaignId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { campaignId }, { merge: true });
}

export async function updateAgentStatus(uid: string, characterId: string, status: 'vivo' | 'morto' | 'desaparecido'): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { agentStatus: status }, { merge: true });
}

export async function updateDangerLevel(uid: string, characterId: string, level: number): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { dangerLevel: Math.max(1, Math.min(5, level)) }, { merge: true });
}

export async function updateCodinome(uid: string, characterId: string, newCodinome: string): Promise<void> {
  const trimmed = newCodinome.trim();
  if (!trimmed) return;
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { codinome: trimmed }, { merge: true });
}

// --- Profile Photos ---

export async function uploadProfilePhoto(uid: string, characterId: string, file: File): Promise<{ url: string }> {
  const photoId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storageRef = ref(storage, `profilePhotos/${uid}/${characterId}/${photoId}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, 'users', uid, 'characters', characterId), { profilePhotoUrl: url }, { merge: true });
  return { url };
}

// --- Global/Admin System State ---

export async function setTerminalStateForUsers(uids: string[], force: boolean, grant: boolean): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach((uid) => {
    batch.set(doc(db, 'users', uid), { 
      forceTerminalOpen: force,
      hasTerminalAccess: grant 
    }, { merge: true });
  });
  await batch.commit();
}

export async function setMacStateForUsers(uids: string[], force: boolean, grant: boolean): Promise<void> {
  const batch = writeBatch(db);
  uids.forEach((uid) => {
    batch.set(doc(db, 'users', uid), { 
      forceMacOpen: force, 
      hasMacAccess: grant 
    }, { merge: true });
  });
  await batch.commit();
}

export async function checkTerminalClosed(uid: string, characterId?: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { forceTerminalOpen: false }, { merge: true });
  if (characterId) {
    await setDoc(
      doc(db, 'users', uid, 'characters', characterId),
      { forceTerminalOpen: false },
      { merge: true }
    );
  }
}

export async function checkMacClosed(uid: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { forceMacOpen: false }, { merge: true });
}

export async function setLimboMilitarySeizureGlobal(seized: boolean): Promise<void> {
  await setDoc(doc(db, 'system', 'limboState'), { 
    seized,
    seizedAt: seized ? serverTimestamp() : null
  }, { merge: true });
}

export async function fetchLimboGlobalState(): Promise<LimboGlobalState> {
  const snap = await getDoc(doc(db, 'system', 'limboState'));
  return snap.exists() ? (snap.data() as LimboGlobalState) : { seized: false };
}

export async function firestoreMarkThreadRead(
  uid: string,
  characterId: string,
  threadId: string,
): Promise<void> {
  const charRef = doc(db, 'users', uid, 'characters', characterId);
  const limboRef = doc(db, 'system', 'limboState');

  await runTransaction(db, async (transaction) => {
    const charSnap = await transaction.get(charRef);
    const limboSnap = await transaction.get(limboRef);

    if (charSnap.exists()) {
      const charReadIds: string[] = charSnap.data().readThreadIds || [];
      if (!charReadIds.includes(threadId)) {
        transaction.set(charRef, { readThreadIds: [...charReadIds, threadId] }, { merge: true });
      }
    }

    const limboData = limboSnap.exists() ? limboSnap.data() : { seized: false, readThreadIds: [] };
    const globalReadIds: string[] = limboData.readThreadIds || [];
    if (!globalReadIds.includes(threadId)) {
      transaction.set(limboRef, { readThreadIds: [...globalReadIds, threadId] }, { merge: true });
    }
  });
}

// --- Play Events & Media Utils ---

export async function recordPlayEvent(uid: string, characterId: string, tapeId: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'playEvents'), {
    uid,
    characterId,
    tapeId,
    playedAt: serverTimestamp(),
    completed: false,
  });
  return docRef.id;
}

export async function markPlayEventCompleted(eventId: string): Promise<void> {
  await setDoc(doc(db, 'playEvents', eventId), { completed: true }, { merge: true });
}

export async function generateAgentId(uid: string, characterId: string): Promise<string> {
  const charRef = doc(db, 'users', uid, 'characters', characterId);
  const snap = await getDoc(charRef);
  if (snap.exists() && snap.data().agentId) return snap.data().agentId;
  const agentId = Array.from(crypto.getRandomValues(new Uint8Array(3))).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  await setDoc(charRef, { agentId }, { merge: true });
  return agentId;
}

export async function fetchAudioTapeById(audioId: string) {
  const snap = await getDoc(doc(db, 'mediaAssets', audioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchAudioTapesByIds(audioIds: string[]) {
  if (audioIds.length === 0) return [];
  const audios: any[] = [];
  for (let i = 0; i < audioIds.length; i += 30) {
    const chunk = audioIds.slice(i, i + 30);
    const q = query(collection(db, 'mediaAssets'), where('__name__', 'in', chunk));
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      audios.push({ id: d.id, ...d.data() });
    });
  }
  return audios;
}

export async function fetchAllMediaAssets() {
  const snap = await getDocs(collection(db, 'mediaAssets'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Persiste alterações de um IntelItem de volta para o Firebase.
 */
export async function updateRemoteIntel(item: IntelItem): Promise<void> {
  const docRef = doc(db, 'mediaAssets', item.id);

  let rawType = 'other';
  if (item.type === 'AUDIO') {
    rawType = 'audio';
  } else if (item.type === 'VIDEO') {
    rawType = 'video';
  } else if (item.type === 'VISUAL') {
    rawType = 'image';
  } else if (item.type === 'TEXT') {
    rawType = 'text';
  } else if (item.type === 'META') {
    rawType = 'meta';
  }

  const metadata: any = {
    level: item.level,
    title: item.title,
    description: item.description,
  };

  if (item.metadata) {
    if (item.metadata.npc !== undefined) metadata.npc = item.metadata.npc;
    if (item.metadata.artist !== undefined) metadata.artist = item.metadata.artist;
    if (item.metadata.chapter !== undefined) metadata.chapter = item.metadata.chapter;
    if (item.metadata.duration !== undefined) metadata.duration = item.metadata.duration;
    if (item.metadata.isSecret !== undefined) metadata.isSecret = item.metadata.isSecret;
    if (item.metadata.visualCategory !== undefined) metadata.category = item.metadata.visualCategory;
    if (item.metadata.imageUrl !== undefined) metadata.imageUrl = item.metadata.imageUrl;
    if (item.metadata.icon !== undefined) metadata.icon = item.metadata.icon;
    if (item.metadata.hint !== undefined) metadata.hint = item.metadata.hint;
    if (item.metadata.unlockCondition !== undefined) metadata.unlockCondition = item.metadata.unlockCondition;
    if (item.metadata.achievementRuleId !== undefined) metadata.achievementRuleId = item.metadata.achievementRuleId;
    if (item.metadata.videoFormat !== undefined) metadata.videoFormat = item.metadata.videoFormat;
    if (item.metadata.videoSource !== undefined) metadata.videoSource = item.metadata.videoSource;
    if (item.metadata.youtubeId !== undefined) metadata.youtubeId = item.metadata.youtubeId;
  }

  const updateData: any = {
    type: rawType,
    campaignId: item.campaignId || null,
    metadata,
  };

  if (item.mediaUrl) {
    updateData.url = item.mediaUrl;
  }
  if (item.textContent) {
    updateData.textContent = item.textContent;
  }

  await setDoc(docRef, updateData, { merge: true });
}

export async function fetchQrRedirect(sourceId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'qrRedirects', sourceId));
  return snap.exists() ? snap.data().targetId || null : null;
}

export async function fetchAllQrRedirects(): Promise<QrRedirect[]> {
  const snap = await getDocs(collection(db, 'qrRedirects'));
  return snap.docs.map(d => ({ sourceId: d.id, ...d.data() } as QrRedirect));
}

export function subscribeToQrRedirects(callback: (redirects: QrRedirect[]) => void): () => void {
  const q = collection(db, 'qrRedirects');
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ sourceId: d.id, ...d.data() } as QrRedirect));
    callback(list);
  }, (err) => console.warn('[Firestore] subscribeToQrRedirects error:', err));
}

export async function saveQrRedirect(sourceId: string, targetId: string, reason?: string): Promise<void> {
  await setDoc(doc(db, 'qrRedirects', sourceId), {
    targetId,
    reason: reason || '',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQrRedirect(sourceId: string): Promise<void> {
  await deleteDoc(doc(db, 'qrRedirects', sourceId));
}

// --- Remote Video Broadcast (Admin → Player) ---

export interface VideoBroadcastTarget {
  uid: string;
  characterId: string;
}

/**
 * Envia comando de reprodução de vídeo para personagens selecionados.
 * Opcionalmente desbloqueia o intel antes de transmitir.
 */
export async function broadcastVideoToCharacters(
  targets: VideoBroadcastTarget[],
  intelId: string,
  options?: { grantIntel?: boolean; campaignId?: string }
): Promise<string> {
  if (targets.length === 0) return '';
  const requestId = crypto.randomUUID();
  const batch = writeBatch(db);

  targets.forEach(({ uid, characterId }) => {
    if (options?.grantIntel) {
      const intelRef = doc(db, 'users', uid, 'characters', characterId, 'intel', intelId);
      batch.set(intelRef, {
        unlockedAt: serverTimestamp(),
        campaignId: options.campaignId || null,
      }, { merge: true });
    }
    batch.set(doc(db, 'users', uid, 'characters', characterId), {
      pendingVideoPlay: {
        intelId,
        requestId,
        triggeredAt: serverTimestamp(),
      },
    }, { merge: true });
  });

  await batch.commit();
  return requestId;
}

export async function clearPendingVideoPlay(uid: string, characterId: string): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'characters', characterId), {
    pendingVideoPlay: null,
  }, { merge: true });
}

// Re-export types used by admin panels
export type { GalleryImage, GalleryCategory, LimboGlobalState } from '../types/player';
