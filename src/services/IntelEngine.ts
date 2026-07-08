import type { IntelItem, IntelType, AccessLevel, VisualCategory, VideoFormat } from '../types/intel';
import { extractYoutubeId, isYoutubeUrl } from '../lib/youtube';

/**
 * ARCHITECTURE: UNIFIED INTEL ENGINE (OOP)
 * 
 * Uses:
 * - Strategy Pattern for type-specific behavior.
 * - Factory Pattern for item instantiation.
 * - Decorator/Composition for metadata handling.
 */

// 1. Abstract Base Class
export abstract class IntelBase {
  public readonly id: string;
  public readonly type: IntelType;
  public readonly level: AccessLevel;
  public readonly title: string;
  public readonly description: string;
  public readonly metadata: IntelItem['metadata'];

  constructor(item: IntelItem) {
    this.id = item.id;
    this.type = item.type;
    this.level = item.level;
    this.title = item.title;
    this.description = item.description;
    this.metadata = item.metadata || {};
  }

  // Common Business Logic
  public isTopSecret(): boolean {
    return this.level === 4;
  }

  public getFormattedLevel(): string {
    const labels: Record<number, string> = { 1: 'RESTRITO', 2: 'CONFIDENCIAL', 3: 'SIGILOSO', 4: 'TOP SECRET' };
    return labels[this.level] || 'DESCONHECIDO';
  }

  public getTypeLabel(): string {
    const labels: Record<string, string> = { AUDIO: '📼 Áudio', TEXT: '💾 Textos', VISUAL: '📷 Imagens', META: '🏆 Conquistas', VIDEO: '📺 Vídeo' };
    return labels[this.type] || '❓ Desconhecido';
  }

  public getTypeIcon(): string {
    const icons: Record<string, string> = { AUDIO: '📼', TEXT: '💾', VISUAL: '📷', META: '🏆', VIDEO: '📺' };
    return icons[this.type] || '📄';
  }

  public getTypeOrder(): number {
    const order: Record<string, number> = { AUDIO: 0, TEXT: 1, VISUAL: 2, VIDEO: 3, META: 4 };
    return order[this.type] ?? 99;
  }

  // Abstract method for Strategy implementation
  public abstract getDetails(): Record<string, any>;
}

// 2. Concrete Strategy: Audio Intel
export class AudioIntel extends IntelBase {
  public readonly mediaUrl: string;

  constructor(item: IntelItem) {
    super(item);
    this.mediaUrl = item.mediaUrl || '';
  }

  public getDetails() {
    return {
      source: this.mediaUrl,
      artist: this.metadata.artist || 'Desconhecido',
      npc: this.metadata.npc || 'Sistema',
      duration: this.metadata.duration || 0
    };
  }
}

// 3. Concrete Strategy: Visual Intel (Images/Videos)
export class VisualIntel extends IntelBase {
  public readonly mediaUrl: string;
  public readonly category: VisualCategory;

  constructor(item: IntelItem) {
    super(item);
    this.mediaUrl = item.mediaUrl || '';
    this.category = this.metadata.visualCategory || 'itens';
  }

  public isVideo(): boolean {
    return /\.(mp4|webm|ogg|mov)$/i.test(this.mediaUrl);
  }

  public getDetails() {
    return {
      url: this.mediaUrl,
      isVideo: this.isVideo(),
      category: this.category,
      npc: this.metadata.npc || 'Câmera de Campo'
    };
  }
}

// 4. Concrete Strategy: Text Intel (Documents)
export class TextIntel extends IntelBase {
  public readonly content: string;

  constructor(item: IntelItem) {
    super(item);
    this.content = item.textContent || item.description;
  }

  public isCorrupted(): boolean {
    return /[\u0300-\u036f\u0489]/.test(this.content);
  }

  public getDetails() {
    return {
      body: this.content,
      isCorrupted: this.isCorrupted(),
      npc: this.metadata.npc || 'Terminal'
    };
  }
}

// 5. Concrete Strategy: Video Intel (VHS/DVD)
export class VideoIntel extends IntelBase {
  public readonly mediaUrl: string;
  public readonly format: VideoFormat;
  public readonly videoSource: 'upload' | 'youtube';
  public readonly youtubeId: string | null;

  constructor(item: IntelItem) {
    super(item);
    this.mediaUrl = item.mediaUrl || '';
    this.format = item.metadata?.videoFormat || 'VHS';
    this.youtubeId =
      item.metadata?.youtubeId ||
      (isYoutubeUrl(this.mediaUrl) ? extractYoutubeId(this.mediaUrl) : null);
    this.videoSource =
      item.metadata?.videoSource || (this.youtubeId ? 'youtube' : 'upload');
  }

  public isYoutube(): boolean {
    return this.videoSource === 'youtube' && !!this.youtubeId;
  }

  public getDetails() {
    return {
      source: this.mediaUrl,
      format: this.format,
      videoSource: this.videoSource,
      youtubeId: this.youtubeId,
      isYoutube: this.isYoutube(),
      npc: this.metadata.npc || 'Arquivo de Vídeo',
      duration: this.metadata.duration || 0,
    };
  }
}

// 6. Concrete Strategy: Meta Intel (Achievements)
export class MetaIntel extends IntelBase {
  constructor(item: IntelItem) {
    super(item);
  }

  public getDetails() {
    return {
      icon: this.metadata.icon || '🏆',
      condition: this.metadata.unlockCondition || 'Secreto',
      hint: this.metadata.hint || ''
    };
  }
}

// 7. Intel Factory (Singleton)
export class IntelFactory {
  private static instance: IntelFactory;
  private constructor() {}

  public static getInstance(): IntelFactory {
    if (!IntelFactory.instance) IntelFactory.instance = new IntelFactory();
    return IntelFactory.instance;
  }

  public create(item: IntelItem): IntelBase {
    switch (item.type) {
      case 'AUDIO': return new AudioIntel(item);
      case 'VISUAL': return new VisualIntel(item);
      case 'TEXT': return new TextIntel(item);
      case 'VIDEO': return new VideoIntel(item);
      case 'META': return new MetaIntel(item);
      default: throw new Error(`[IntelFactory] Tipo desconhecido: ${item.type}`);
    }
  }
}

// 8. Intel Manager (The Orchestrator)
export class IntelManager {
  private items: Map<string, IntelBase> = new Map();
  private factory = IntelFactory.getInstance();

  constructor(rawItems: IntelItem[] = []) {
    this.ingest(rawItems);
  }

  public ingest(rawItems: IntelItem[]): void {
    rawItems.forEach(raw => {
      this.items.set(raw.id, this.factory.create(raw));
    });
  }

  public get(id: string): IntelBase | undefined {
    return this.items.get(id);
  }

  public getAll(): IntelBase[] {
    return Array.from(this.items.values());
  }

  public getByType(type: IntelType): IntelBase[] {
    return this.getAll().filter(item => item.type === type);
  }

  public getByLevel(level: AccessLevel): IntelBase[] {
    return this.getAll().filter(item => item.level === level);
  }

  // Advanced Sorting
  public sort(by: 'title' | 'level' | 'type'): IntelBase[] {
    return this.getAll().sort((a, b) => {
      if (by === 'level') return b.level - a.level;
      if (by === 'type') return a.type.localeCompare(b.type);
      return a.title.localeCompare(b.title);
    });
  }
}
