import type { User } from 'firebase/auth';
import { loadMasterAccount } from '../store/firestore';
import type { MasterAccount } from '../types/player';

export function isAdminAccount(
  account: Pick<MasterAccount, 'role' | 'uid'> | null | undefined,
): boolean {
  return account?.role === 'admin';
}

export async function resolveAdminAccess(user: User): Promise<boolean> {
  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin === true) return true;
  } catch {
    // Token indisponível — segue para checagem no Firestore.
  }

  try {
    const account = await loadMasterAccount(user.uid);
    return account.role === 'admin';
  } catch {
    return false;
  }
}

export function redirectToAdminPanel(): void {
  window.location.href = '/admin';
}
