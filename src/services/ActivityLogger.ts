import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export type ActivityType = 'navigation' | 'action' | 'system' | 'error' | 'admin' | 'auth' | 'trace';

export interface ActivityEvent {
  uid: string;
  characterId?: string;
  username: string;
  type: ActivityType;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: ReturnType<typeof serverTimestamp>;
  source: 'player' | 'admin';
}

class ActivityLogger {
  private static instance: ActivityLogger;
  private lastNavTimestamp = 0;
  private readonly NAV_THROTTLE_MS = 2000;
  
  // Internal User State
  private currentUid: string | null = null;
  private currentCharacterId: string | null = null;
  private currentUsername: string | null = null;

  private constructor() {}

  static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  public setUser(uid: string, username: string, characterId?: string): void {
    this.currentUid = uid;
    this.currentUsername = username;
    this.currentCharacterId = characterId || null;
  }

  public clearUser(): void {
    this.currentUid = null;
    this.currentUsername = null;
    this.currentCharacterId = null;
  }

  private asMetadataRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private async resolveDb(): Promise<Firestore> {
    const { db } = await import('../lib/firebase');
    return db;
  }

  private sanitizeData(obj: unknown): unknown {
    if (obj === undefined) return undefined;
    if (obj === null) return null;
    if (typeof obj === 'function') return undefined;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj
        .map((item) => this.sanitizeData(item))
        .filter((item) => item !== undefined);
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue;
      const cleaned = this.sanitizeData(v);
      if (cleaned !== undefined) {
        result[k] = cleaned;
      }
    }
    return result;
  }

  private humanize(message: string, type?: ActivityType): string {
    if (!message || typeof message !== 'string') return String(message || '');
    
    if (type === 'navigation' && message.includes('→')) {
      const screens: Record<string, string> = {
        'player':     'Walkman MK-III',
        'profile':    'Perfil Usuário',
        'bios':       'Terminal BIOS',
        'limbo':      'Limbo (Firewall)',
        'diskRepair': 'Reparador de Disco',
        'macos':      'System 7.5',
        'windows95':  'Windows 95',
        'login':      'Acesso',
        'campaignSelection': 'Seleção de Instância',
      };
      const [from, to] = message.split('→').map(s => s.trim());
      return `Navegação: ${screens[from] || from} → ${screens[to] || to}`;
    }

    if (message.includes('WebChannelConnection')) return "SINC_DB: Oscilação na conexão em tempo real";
    if (message.includes('Failed to fetch')) return "REDE: Falha ao carregar recurso externo";
    
    const actionMap: Record<string, string> = {
      'Iniciado Play':      '▶️ Reprodução iniciada',
      'Pausado':            '⏸️ Reprodução pausada',
      'Retroceder fita':    '⏪ Retrocedendo fita',
      'Interação tátil (parafuso)': '🛠️ Interação com hardware (Parafuso)',
      'Reprodução finalizada': '⏹️ Fita chegou ao fim',
    };

    for (const [key, val] of Object.entries(actionMap)) {
      if (message.includes(key)) return val;
    }
    return message;
  }

  /**
   * Internal helper to normalize arguments from multiple possible signatures.
   */
  private normalizeArgs(args: any[], type?: ActivityType): { 
    uid: string; 
    characterId?: string;
    username: string; 
    category: string; 
    message: string; 
    metadata?: Record<string, unknown> 
  } {
    let category = 'general';
    let message = '';
    let metadata: Record<string, unknown> = {};

    if (type === 'navigation') {
      // Signature: (path, metadata?)
      category = 'navigation';
      message = args[0] || '';
      metadata = this.asMetadataRecord(args[1]);
    } else {
      // Signature: (category, message, metadata?)
      category = args[0] || 'general';
      message = args[1] || '';
      metadata = this.asMetadataRecord(args[2]);
    }

    return {
      uid: this.currentUid || 'unknown',
      characterId: this.currentCharacterId || undefined,
      username: this.currentUsername || 'System',
      category,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      metadata
    };
  }

  private async write(type: ActivityType, source: 'player' | 'admin', args: any[]): Promise<void> {
    const { uid, characterId, username, category, message, metadata } = this.normalizeArgs(args, type);

    try {
      const humanizedMessage = this.humanize(message, type);
      const finalMetadata = { ...(metadata || {}), original_message: message };

      const cleanEvent = this.sanitizeData({ 
        type,
        category,
        uid,
        characterId,
        username,
        message: humanizedMessage,
        metadata: finalMetadata,
        source
      }) as Record<string, unknown>;

      const db = await this.resolveDb();
      await addDoc(collection(db, 'activityLog'), {
        ...cleanEvent,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      // Don't use console.error to avoid infinite loops if error logging fails
      console.warn('[ActivityLogger] write failed:', err);
    }
  }

  logNavigation(fromScreen: string, toScreen: string, metadata?: Record<string, unknown>): void {
    const now = Date.now();
    if (now - this.lastNavTimestamp < this.NAV_THROTTLE_MS) return;
    this.lastNavTimestamp = now;
    this.write('navigation', 'player', [`${fromScreen} → ${toScreen}`, metadata]);
  }

  logAction(...args: any[]): void {
    this.write('action', 'player', args);
  }

  logSystem(...args: any[]): void {
    this.write('system', 'player', args);
  }

  logError(...args: any[]): void {
    this.write('error', 'player', args);
  }

  logAuth(...args: any[]): void {
    this.write('auth', 'player', args);
  }

  logTrace(...args: any[]): void {
    this.write('trace', 'player', args);
  }

  logAdmin(adminName: string, category: string, message: string, metadata?: Record<string, unknown>): void {
    this.setUser('admin', adminName);
    this.write('admin', 'admin', [category, message, metadata]);
  }
}

export const activityLogger = ActivityLogger.getInstance();
