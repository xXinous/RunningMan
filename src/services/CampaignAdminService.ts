import { db } from '../lib/firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { Campaign, campaigns as initialCampaigns } from '../data/campaigns';
import { activityLogger } from './ActivityLogger';

export class CampaignAdminService {
  private static instance: CampaignAdminService;

  private constructor() {}

  public static getInstance(): CampaignAdminService {
    if (!CampaignAdminService.instance) {
      CampaignAdminService.instance = new CampaignAdminService();
    }
    return CampaignAdminService.instance;
  }

  public async initializeCampaignsFromData(): Promise<void> {
    const batch = writeBatch(db);
    initialCampaigns.forEach((c) => {
      batch.set(doc(db, 'campaigns', c.id), c);
    });
    await batch.commit();
  }

  public async saveCampaign(campaign: Partial<Campaign> & { id: string; name: string }): Promise<void> {
    await setDoc(
      doc(db, 'campaigns', campaign.id),
      { ...campaign, updatedAt: serverTimestamp() },
      { merge: true }
    );
    activityLogger.logAdmin('gm.mpg', 'campaign_saved', `Campanha salva: ${campaign.name}`);
  }

  public async deleteCampaign(id: string): Promise<void> {
    await deleteDoc(doc(db, 'campaigns', id));
    activityLogger.logAdmin('gm.mpg', 'campaign_deleted', `Campanha removida: ${id}`);
  }

  public async setPersistentItems(itemIds: string[]): Promise<void> {
    await setDoc(
      doc(db, 'system', 'campaignSettings'),
      { persistentItemIds: itemIds },
      { merge: true }
    );
  }

  public async unlockForGroup(groupId: string, campaignId: string, unlock: boolean): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), {
      unlockedCampaigns: unlock ? arrayUnion(campaignId) : arrayRemove(campaignId),
    });
  }

  public async unlockForCharacter(
    uid: string,
    charId: string,
    campaignId: string,
    unlock: boolean
  ): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'characters', charId), {
      unlockedCampaigns: unlock ? arrayUnion(campaignId) : arrayRemove(campaignId),
    });
  }

  public async assignToGroup(groupId: string, campaignId: string): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), { campaignId });
  }

  public async assignToCharacter(uid: string, charId: string, campaignId: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'characters', charId), { campaignId });
  }

  public async unassignFromGroup(groupId: string): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), { campaignId: deleteField() });
  }

  public async unassignFromCharacter(uid: string, charId: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid, 'characters', charId), { campaignId: deleteField() });
  }
}

export const campaignAdminService = CampaignAdminService.getInstance();
