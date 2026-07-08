
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Em dev (incl. browser embutido do Cursor), HTTP/2 do WebChannel costuma falhar.
// Long polling + cache em memória evita ERR_HTTP2_PING_FAILED e BloomFilterError.
const firestoreSettings = import.meta.env.DEV
  ? {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    }
  : {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    };

export const db = initializeFirestore(app, firestoreSettings);
export const storage = getStorage(app);

// Firebase Analytics (GA4) — initialized lazily since it requires browser support check
let _analytics: Analytics | null = null;
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (_analytics) return _analytics;
  try {
    const supported = await isSupported();
    if (supported) {
      _analytics = getAnalytics(app);
    }
  } catch {
    // Analytics not supported in this environment (e.g., SSR, privacy blockers)
  }
  return _analytics;
}

import { activityLogger } from '../services/ActivityLogger';
import { resolveAdminAccess } from './adminAccess';
let _isLogging = false; 
function argsToString(args: unknown[]): string {
  return args.map(a => {
    if (a instanceof Error) return `${a.message}`;
    if (typeof a === 'object') try { return JSON.stringify(a); } catch { return String(a); }
    return String(a);
  }).join(' ');
}
const FIRESTORE_NOISE_PATTERNS = [
  '[ActivityLogger]',
  'Missing or insufficient permissions',
  'permission-denied',
  'access control checks',
  'INTERNAL ASSERTION FAILED',
  'Content blocker prevented',
  'BloomFilter',
  'ERR_HTTP2_PING_FAILED',
  'WebChannelConnection',
];

function isFirestoreNoise(message: string): boolean {
  return FIRESTORE_NOISE_PATTERNS.some((pattern) => message.includes(pattern));
}

function logGlobalBrowserError(tag: string, fullMessage: string, stack?: string, code?: string, extraArgs?: any) {
  if (isFirestoreNoise(fullMessage)) return;

  const user = auth?.currentUser;
  const lines = fullMessage.split('\n');
  let summary = lines[0] || 'Unknown Error';
  
  if (summary.length > 150) summary = summary.slice(0, 147) + '...';
  const finalMessage = `[${tag}] ${summary}`;
  const metadata: Record<string, unknown> = { fullMessage };
  if (stack !== undefined) metadata.stack = stack;
  if (code !== undefined) metadata.code = code;
  if (extraArgs !== undefined) metadata.extraArgs = extraArgs;
  if (!user) return;
  const name = user.displayName || user.email || 'unknown_player';
  void resolveAdminAccess(user).then((isAdmin) => {
    if (isAdmin) {
      activityLogger.logAdmin(name, tag.toLowerCase(), finalMessage, metadata);
    } else {
      activityLogger.logError(user.uid, name, finalMessage, stack, metadata);
    }
  });
}

function getErrorDigest(error: unknown): { message: string; stack?: string; code?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack, code: (error as any).code };
  }
  return { message: String(error) };
}
window.addEventListener('error', (event) => {
  const { message, stack, code } = getErrorDigest(event.error ?? event.message);
  if (isFirestoreNoise(message)) return;
  if (_isLogging) return;
  _isLogging = true;
  try {
    logGlobalBrowserError('GLOBAL_ERROR', message, stack, code, {
      filename: event.filename, lineno: event.lineno, colno: event.colno
    });
  } finally { _isLogging = false; }
});
window.addEventListener('unhandledrejection', (event) => {
  const { message, stack, code } = getErrorDigest(event.reason);
  if (isFirestoreNoise(message)) return;
  if (_isLogging) return;
  _isLogging = true;
  try {
    logGlobalBrowserError('PROMISE_ERROR', message, stack, code);
  } finally { _isLogging = false; }
});
