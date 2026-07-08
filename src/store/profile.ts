
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { loadMasterAccount, updateLastLogin, waitForUserDoc } from './firestore';
import type { MasterAccount } from '../types/player';

function masterIdToEmail(masterId: string): string {
  const slug = masterId.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  return `${slug}@limboos.local`;
}

export type LoginResult =
  | { ok: true;  account: MasterAccount }
  | { ok: false; error: 'wrong_password' | 'network' | 'unknown'; message: string };

const PROFILE_NOT_FOUND_MESSAGE = 'Perfil não encontrado. Contate o administrador.';
const PROFILE_TIMEOUT_MESSAGE = 'Perfil não provisionado a tempo. Tente novamente em instantes.';

function isProfileProvisioningError(message: string): boolean {
  return message.includes('Timeout aguardando criação do perfil')
    || message.includes('Perfil não encontrado')
    || message === 'Account not found';
}

async function callProvisionUserProfile(): Promise<void> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const { getApp } = await import('firebase/app');
  const functions = getFunctions(getApp(), 'southamerica-east1');
  const fn = httpsCallable(functions, 'provisionUserProfile');
  await fn();
}

/**
 * Garante users/{uid} para a sessão Auth atual.
 * 1. Fast path se o perfil já existe
 * 2. Aguarda onAuthUserCreated em contas novas
 * 3. Fallback via Cloud Function para contas Auth órfãs (login sem doc Firestore)
 */
export async function ensureUserProfile(user: User): Promise<MasterAccount> {
  await user.getIdToken(true);

  const userRef = doc(db, 'users', user.uid);
  let snap = await getDoc(userRef);
  if (snap.exists()) {
    await updateLastLogin(user.uid);
    return loadMasterAccount(user.uid);
  }

  try {
    await waitForUserDoc(user.uid);
  } catch {
    try {
      await callProvisionUserProfile();
    } catch (provisionErr) {
      console.warn('[Auth] Falha ao provisionar perfil via callable:', provisionErr);
    }
  }

  snap = await getDoc(userRef);
  if (!snap.exists()) {
    throw new Error(PROFILE_NOT_FOUND_MESSAGE);
  }

  await updateLastLogin(user.uid);
  return loadMasterAccount(user.uid);
}

async function rollbackAuthOnProfileFailure(user: User | null): Promise<void> {
  if (user) {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignora falha de signOut durante rollback.
    }
  }
}

function profileErrorMessage(err: unknown): string | null {
  const message = (err as Error).message ?? '';
  if (message.includes('Timeout aguardando criação do perfil')) {
    return PROFILE_TIMEOUT_MESSAGE;
  }
  if (isProfileProvisioningError(message)) {
    return PROFILE_NOT_FOUND_MESSAGE;
  }
  return null;
}

export async function loginOrCreate(
  masterId: string,
  password: string,
): Promise<LoginResult> {
  const email = masterIdToEmail(masterId);
  
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const account = await ensureUserProfile(user);
    if (account.suspended && account.role !== 'admin') {
      await firebaseSignOut(auth);
      return { ok: false, error: 'unknown' as const, message: 'CONTA SUSPENSA: Contate o administrador.' };
    }
    return { ok: true, account };
  } catch (signInErr: unknown) {
    const code = (signInErr as { code?: string }).code ?? '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      let user: User | null = null;
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        user = credential.user;
        const account = await ensureUserProfile(user);
        return { ok: true, account };
      } catch (createErr: unknown) {
        await rollbackAuthOnProfileFailure(user ?? auth.currentUser);
        const createCode = (createErr as { code?: string }).code ?? '';
        const createMessage = (createErr as Error).message ?? '';
        if (createCode === 'auth/weak-password') {
          return { ok: false, error: 'wrong_password', message: 'Senha muito fraca (mínimo 6 caracteres).' };
        }
        if (createCode === 'auth/email-already-in-use') {
          return { ok: false, error: 'wrong_password', message: 'FALHA NA AUTENTICAÇÃO: SENHA INCORRETA' };
        }
        const profileMsg = profileErrorMessage(createErr);
        if (profileMsg) {
          return { ok: false, error: 'unknown', message: profileMsg };
        }
        return { ok: false, error: 'unknown', message: 'Erro ao criar perfil.' };
      }
    }
    if (code === 'auth/wrong-password') {
      return { ok: false, error: 'wrong_password', message: 'FALHA NA AUTENTICAÇÃO: CREDENCIAIS INVÁLIDAS' };
    }
    if (code.startsWith('auth/network')) {
      return { ok: false, error: 'network', message: 'SEM CONEXÃO: verifique a rede.' };
    }
    const profileMsg = profileErrorMessage(signInErr);
    if (profileMsg) {
      await rollbackAuthOnProfileFailure(auth.currentUser);
      return { ok: false, error: 'unknown', message: profileMsg };
    }
    return { ok: false, error: 'unknown', message: `Erro inesperado (${code})` };
  }
}

export async function loginWithProvider(providerName: 'google' | 'apple'): Promise<LoginResult> {
  try {
    let provider;
    if (providerName === 'google') {
      provider = new GoogleAuthProvider();
    } else {
      provider = new OAuthProvider('apple.com');
    }

    const { user } = await signInWithPopup(auth, provider);
    const account = await ensureUserProfile(user);

    if (account.suspended && account.role !== 'admin') {
      await firebaseSignOut(auth);
      return { ok: false, error: 'unknown' as const, message: 'CONTA SUSPENSA: Contate o administrador.' };
    }

    return { ok: true, account };
  } catch (err: unknown) {
    await rollbackAuthOnProfileFailure(auth.currentUser);
    const code = (err as { code?: string }).code ?? '';
    const message = (err as Error).message ?? '';
    
    if (code === 'auth/popup-closed-by-user') {
      return { ok: false, error: 'unknown', message: 'OPERAÇÃO CANCELADA PELO USUÁRIO' };
    }
    if (code.startsWith('auth/network')) {
      return { ok: false, error: 'network', message: 'SEM CONEXÃO: verifique a rede.' };
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return { ok: false, error: 'unknown', message: 'E-mail já cadastrado através de outro método de login.' };
    }
    const profileMsg = profileErrorMessage(err);
    if (profileMsg) {
      return { ok: false, error: 'unknown', message: profileMsg };
    }
    
    return { ok: false, error: 'unknown', message: `Erro no login via provedor (${code})` };
  }
}

export async function logout(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(
  callback: (user: User | null) => void,
): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
