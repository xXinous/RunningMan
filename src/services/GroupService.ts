import { 
  db 
} from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  onSnapshot, 
  serverTimestamp, 
  query, 
  orderBy,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { Group, GroupCharacterSlot } from '../types/player';
import { intelService } from './IntelService';

export class GroupService {
  private static instance: GroupService;
  private constructor() {}

  public static getInstance(): GroupService {
    if (!GroupService.instance) {
      GroupService.instance = new GroupService();
    }
    return GroupService.instance;
  }

  public subscribeToGroups(callback: (groups: Group[]) => void): () => void {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      callback(groups);
    });
  }

  public async createGroup(name: string, characterSlots: GroupCharacterSlot[], sessions: string[], campaignId?: string, unlockedCampaigns?: string[]): Promise<string> {
    const groupRef = doc(collection(db, 'groups'));
    const now = Timestamp.now();

    const newGroup: Group = {
      id: groupRef.id,
      name,
      characterSlots,
      ...(campaignId ? { campaignId } : {}),
      unlockedCampaigns: unlockedCampaigns || [],
      sessions,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(groupRef, newGroup);
    return groupRef.id;
  }

  public async updateGroup(groupId: string, data: Partial<Group>): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);

    await updateDoc(groupRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  public async deleteGroup(groupId: string): Promise<void> {
    await deleteDoc(doc(db, 'groups', groupId));
  }

  public async addSessionDate(groupId: string, date: string): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      sessions: arrayUnion(date),
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Add a character slot to an existing group
   */
  public async addCharacterToGroup(groupId: string, uid: string, characterId: string): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) throw new Error('Group not found');

    const group = snap.data() as Group;
    const slots = group.characterSlots || [];
    
    // Prevent duplicate
    if (slots.some(s => s.characterId === characterId)) return;

    const newSlot: GroupCharacterSlot = {
      uid,
      characterId,
      joinedAt: Timestamp.now(),
    };

    await updateDoc(groupRef, {
      characterSlots: [...slots, newSlot],
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Remove a character slot from a group
   */
  public async removeCharacterFromGroup(groupId: string, characterId: string): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) throw new Error('Group not found');

    const group = snap.data() as Group;
    const newSlots = (group.characterSlots || []).filter(s => s.characterId !== characterId);

    await updateDoc(groupRef, {
      characterSlots: newSlots,
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Verifica se um slot pertence ao personagem ativo (com fallback por uid da conta).
   */
  private isSlotForCharacter(
    slot: GroupCharacterSlot | Record<string, unknown>,
    characterId: string,
    uid?: string
  ): boolean {
    const slotCharacterId = String(
      (slot as GroupCharacterSlot).characterId ??
      (slot as Record<string, unknown>).character_id ??
      ''
    );
    const slotUid = String((slot as GroupCharacterSlot).uid ?? '');

    if (slotCharacterId && slotCharacterId === characterId) return true;
    if (uid && slotUid === uid && (!slotCharacterId || slotCharacterId === characterId)) return true;
    return false;
  }

  private filterGroupsForCharacter(groups: Group[], characterId: string, uid?: string): Group[] {
    return groups.filter((g) => {
      const slots = g.characterSlots;
      if (!Array.isArray(slots)) return false;
      return slots.some((slot) => this.isSlotForCharacter(slot, characterId, uid));
    });
  }

  /**
   * Get all groups that a specific character belongs to.
   */
  public async getGroupsForCharacter(characterId: string, uid?: string): Promise<Group[]> {
    const q = query(collection(db, 'groups'));
    const snap = await getDocs(q);
    const groups = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
    return this.filterGroupsForCharacter(groups, characterId, uid);
  }

  /**
   * Subscribe to all groups that a specific character belongs to.
   */
  public subscribeToGroupsForCharacter(
    characterId: string,
    callback: (groups: Group[]) => void,
    uid?: string
  ): () => void {
    const q = query(collection(db, 'groups'));
    return onSnapshot(q, (snapshot) => {
      const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group));
      callback(this.filterGroupsForCharacter(groups, characterId, uid));
    }, (error) => {
      console.warn('[GroupService] subscribeToGroupsForCharacter error:', error);
      callback([]);
    });
  }

  /**
   * Grant intel to all (or only alive) characters in a group.
   * Returns the count of characters that received the intel.
   */
  public async grantIntelToGroup(groupId: string, intelId: string, aliveOnly: boolean = true): Promise<number> {
    const groupSnap = await getDoc(doc(db, 'groups', groupId));
    if (!groupSnap.exists()) throw new Error('Group not found');

    const group = groupSnap.data() as Group;
    const slots = group.characterSlots || [];
    const targets: { uid: string; characterId: string }[] = [];
    const agentStatusByKey: Record<string, string> = {};

    for (const slot of slots) {
      const charSnap = await getDoc(doc(db, 'users', slot.uid, 'characters', slot.characterId));
      if (!charSnap.exists()) continue;
      const charData = charSnap.data();
      const key = `${slot.uid}_${slot.characterId}`;
      agentStatusByKey[key] = charData.agentStatus || '';
      targets.push({ uid: slot.uid, characterId: slot.characterId });
    }

    return intelService.grantIntel(targets, [intelId], {
      campaignId: group.campaignId,
      aliveOnly,
      agentStatusByKey,
    });
  }

  /**
   * Subscribe to messages across multiple groups (merged inbox).
   * Each message is tagged with `_groupId` for reply routing.
   */
  public subscribeToMessagesForGroups(
    groupIds: string[],
    callback: (messages: Array<Record<string, unknown> & { _groupId: string }>) => void
  ): () => void {
    if (groupIds.length === 0) {
      callback([]);
      return () => {};
    }

    const messagesByGroup = new Map<string, any[]>();
    const unsubs: (() => void)[] = [];

    const emit = () => {
      const merged = groupIds.flatMap((groupId) =>
        (messagesByGroup.get(groupId) || []).map((msg) => ({ ...msg, _groupId: groupId }))
      );
      callback(merged);
    };

    for (const groupId of groupIds) {
      const unsub = this.subscribeToGroupMessages(groupId, (messages) => {
        messagesByGroup.set(groupId, messages);
        emit();
      });
      unsubs.push(unsub);
    }

    return () => unsubs.forEach((u) => u());
  }

  /**
   * Subscribe to messages in a specific group.
   */
  public subscribeToGroupMessages(groupId: string, callback: (messages: any[]) => void): () => void {
    const q = query(
      collection(db, 'groups', groupId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(messages);
    }, (error) => {
      console.warn('[GroupService] subscribeToGroupMessages error:', error);
      callback([]);
    });
  }

  /**
   * Send a message to a specific group.
   */
  public async sendGroupMessage(
    groupId: string,
    senderId: string,
    senderName: string,
    senderNumber: string,
    text: string,
    recipientId?: string,
    recipientName?: string,
    recipientNumber?: string
  ): Promise<void> {
    const messageRef = doc(collection(db, 'groups', groupId, 'messages'));
    const data: any = {
      id: messageRef.id,
      senderId,
      senderName,
      senderNumber,
      text,
      createdAt: serverTimestamp()
    };
    if (recipientId) data.recipientId = recipientId;
    if (recipientName) data.recipientName = recipientName;
    if (recipientNumber) data.recipientNumber = recipientNumber;
    
    await setDoc(messageRef, data);
  }

  /**
   * Send a parsed NPC dialogue to a specific character.
   */
  public async sendNpcDialogueToCharacter(
    groupId: string,
    characterId: string,
    characterCodename: string,
    characterPhoneNumber: string,
    dialogue: {
      npcId: string;
      npcName: string;
      npcNumber: string;
      messages: { speaker: 'npc' | 'player'; text: string }[];
    }
  ): Promise<void> {
    const baseTime = Date.now();
    for (let i = 0; i < dialogue.messages.length; i++) {
      const msg = dialogue.messages[i];
      const messageRef = doc(collection(db, 'groups', groupId, 'messages'));
      
      const isPlayer = msg.speaker === 'player';
      
      await setDoc(messageRef, {
        id: messageRef.id,
        senderId: isPlayer ? characterId : dialogue.npcId,
        senderName: isPlayer ? characterCodename : dialogue.npcName,
        senderNumber: isPlayer ? characterPhoneNumber : dialogue.npcNumber,
        text: msg.text,
        recipientId: isPlayer ? dialogue.npcId : characterId,
        recipientName: isPlayer ? dialogue.npcName : characterCodename,
        recipientNumber: isPlayer ? dialogue.npcNumber : characterPhoneNumber,
        createdAt: Timestamp.fromMillis(baseTime + i * 2000)
      });
    }
  }
}

export const groupService = GroupService.getInstance();

