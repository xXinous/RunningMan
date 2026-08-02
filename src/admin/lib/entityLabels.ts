import type { MasterAccount } from '../../types/player';
import type { Campaign } from '../../data/campaigns';
import { campaigns as localCampaigns } from '../../data/campaigns';
import { intelRegistry } from '../../data/intel_registry';
import { ALL_ACHIEVEMENTS } from '../../data/achievements';

type AccountLike = Partial<Pick<MasterAccount, 'masterName' | 'email' | 'displayName'>> | null | undefined;

export function masterAccountLabel(acc: AccountLike, fallback = 'Desconhecido'): string {
  if (!acc) return fallback;
  return acc.masterName?.trim() || acc.email?.trim() || acc.displayName?.trim() || fallback;
}

export function masterAccountLabelByUid(
  uid: string,
  users: MasterAccount[],
  fallback = 'Desconhecido',
): string {
  const user = users.find((u) => u.uid === uid);
  return masterAccountLabel(user, fallback);
}

export function campaignLabel(campaignId: string, campaigns: Campaign[]): string {
  const found = campaigns.find((c) => c.id === campaignId);
  if (found?.name) return found.name;
  const local = localCampaigns.find((c) => c.id === campaignId);
  return local?.name || 'Missão desconhecida';
}

export interface IntelTitleSource {
  id: string;
  title?: string;
  originalName?: string;
  filename?: string;
  metadata?: { title?: string };
}

export function intelTitleLabel(
  intelId: string,
  sources?: IntelTitleSource[],
): string {
  const intel = intelRegistry.get(intelId);
  if (intel?.title) return intel.title;

  const remote = sources?.find((s) => s.id === intelId);
  if (remote?.title) return remote.title;
  if (remote?.metadata?.title) return remote.metadata.title;
  if (remote?.originalName) return remote.originalName;
  if (remote?.filename) return remote.filename;

  return 'Intel desconhecido';
}

export function achievementLabel(achId: string): string {
  const ach = ALL_ACHIEVEMENTS.find((a) => a.id === achId);
  return ach?.title || 'Conquista desconhecida';
}

export function characterLabelByKey(
  uid: string,
  characterId: string,
  characterMap: Map<string, string>,
  fallback = 'Agente desconhecido',
): string {
  return characterMap.get(`${uid}_${characterId}`) || fallback;
}
