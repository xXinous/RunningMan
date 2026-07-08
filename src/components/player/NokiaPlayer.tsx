import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { IntelBase, AudioIntel, VideoIntel } from '../../services/IntelEngine';
import NokiaVideoSurface, { NokiaVideoSurfaceHandle } from './NokiaVideoSurface';
import { audioEngine } from '../../services/AudioEngine';
import type { WalkmanStatus, CharacterData, Group } from '../../types/player';
import { groupService } from '../../services/GroupService';

// Lazy loaded scanner to keep bundle optimized
const QrScanner = React.lazy(() => import('../QrScanner'));

/* ─── PIXEL ART ICONS ─── */
const PixelIcon = {
  Play: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M4 2h2v2H4V2zm2 2h2v2H6V4zm2 2h2v2H8V6zm-2 2h2v2H6V8zm-2 2h2v2H4v-2z" />
    </svg>
  ),
  Pause: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2h3v10H3V2zm5 0h3v10H8V2z" />
    </svg>
  ),
  Rewind: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M10 2h2v10h-2V2zM2 6h2v2H2V6zm2-2h2v2H4V4zm2-2h2v2H6V2zm0 8h2v2H6v-2zm-2-2h2v2H4V8z" />
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 2h2v2H2V2zm2 2h2v2H4V4zm2 2h2v2H6V6zm2 2h2v2H8V8zm2 2h2v2h-2v-2zm-8 8h2v-2H2v2zm2-2h2v-2H4v2zm4-4h2v-2H8v2zm2-2h2v-2h-2v2z" />
    </svg>
  ),
  Volume: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 5h2v4H2V5zm3-2h2v8H5V3zm3 0h1v1H8V3zm2 2h1v1h-1V5zm1 2h1v1h-1V7zm-1 2h1v1h-1V9zm-2 2h1v1H8v-1z" />
    </svg>
  ),
  Camera: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 4h10v8H2V4zm2-2h6v2H4V2zm3 5h2v2H7V7z" />
    </svg>
  ),
  Audio: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M2 7h2v2H2V7zm2-2h2v2H4V5zm2-2h2v2H6V3zm2 2h2v2H8V5zm2 2h2v2h-2V7z" />
    </svg>
  ),
  Doc: () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <path d="M2 1h6l3 3v7H2V1zm1 2v7h7V5H7V2H3zm5 0v2h2L8 3z" />
    </svg>
  ),
  SMS: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M1 2h12v10H1V2zm2 2v2h8V4H3zm0 4v2h5V8H3z" />
    </svg>
  ),
  VHS: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M1 3h12v8H1V3zm2 1v6h8V4H3zm1,1h2v4H6V5z" />
    </svg>
  ),
  DVD: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="2" />
    </svg>
  ),
};

interface NokiaPlayerProps {
  currentIntel: IntelBase | null;
  status: WalkmanStatus;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  intelItems: IntelBase[];
  currentIntelId: string | null;
  onIntelSelect: (intel: IntelBase) => void;
  onRewind?: () => void;
  onEject: () => void;
  onScanClick: () => void;
  onCancelScan: () => void;
  onQrDetected: (code: string) => void;
  hasTerminalAccess?: boolean;
  onTerminalOpen?: () => void;
  hasMacAccess?: boolean;
  onMacOpen?: () => void;
  onProfileOpen: () => void;
  onCharacterSwitch?: () => void;
  registerBackHandler?: (handler: (() => boolean) | null) => void;
  setBackVisible?: (v: boolean) => void;
  activeCharacter?: CharacterData;
  characterId?: string;
  uid?: string;
  onUpdatePhoneNumber?: (phoneNumber: string) => void;
}

type FilterTab = 'TODOS' | 'AUDIO' | 'VIDEO' | 'DOCS' | 'SMS';

// Retro square-wave audio feedback engine
class NokiaAudioFeedback {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      } catch (e) { /* fallback silently */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, durationMs: number, gainVal: number = 0.03) {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gainNode.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + durationMs / 1000);
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + durationMs / 1000);
    } catch (e) { /* ignore */ }
  }

  playBeep() { this.playTone(880, 45); }
  playConfirm() {
    this.playTone(880, 60, 0.04);
    setTimeout(() => this.playTone(1320, 80, 0.04), 60);
  }
  playBack() {
    this.playTone(1100, 60, 0.04);
    setTimeout(() => this.playTone(660, 100, 0.04), 60);
  }
}

let _sfxInstance: NokiaAudioFeedback | null = null;
function getSfx(): NokiaAudioFeedback {
  if (!_sfxInstance) _sfxInstance = new NokiaAudioFeedback();
  return _sfxInstance;
}

function generateRandomUSPhoneNumber(): string {
  const areaCode = Math.floor(100 + Math.random() * 900); // 100-999
  const exchangeCode = Math.floor(100 + Math.random() * 900); // 100-999
  const subscriberNumber = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  return `(${areaCode}) ${exchangeCode}-${subscriberNumber}`;
}

function formatVideoTime(time: number): string {
  if (isNaN(time) || time < 0) return '00:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function NokiaPlayer({
  currentIntel,
  status,
  isPlaying,
  setIsPlaying,
  volume,
  setVolume,
  intelItems,
  currentIntelId,
  onIntelSelect,
  onRewind,
  onEject,
  onScanClick,
  onCancelScan,
  onQrDetected,
  hasTerminalAccess = false,
  onTerminalOpen,
  hasMacAccess = false,
  onMacOpen,
  onProfileOpen,
  onCharacterSwitch,
  registerBackHandler,
  setBackVisible,
  activeCharacter,
  characterId: characterIdProp,
  uid,
  onUpdatePhoneNumber,
}: NokiaPlayerProps) {
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('00:00');
  const [durationTimeStr, setDurationTimeStr] = useState('00:00');
  const [showVolumeBar, setShowVolumeBar] = useState(false);
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState<FilterTab>(() => {
    return (sessionStorage.getItem('nokia_active_tab') as FilterTab) || 'TODOS';
  });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    return sessionStorage.getItem('nokia_active_conv') || null;
  });

  useEffect(() => {
    if (activeConversationId) sessionStorage.setItem('nokia_active_conv', activeConversationId);
    else sessionStorage.removeItem('nokia_active_conv');
  }, [activeConversationId]);

  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const intelListRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [readConversationIds, setReadConversationIds] = useState<Set<string>>(() => new Set());
  const videoSurfaceRef = useRef<NokiaVideoSurfaceHandle | null>(null);

  const markConversationRead = useCallback((contactId: string) => {
    setReadConversationIds((prev) => {
      if (prev.has(contactId)) return prev;
      const next = new Set(prev);
      next.add(contactId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      markConversationRead(activeConversationId);
    }
  }, [activeConversationId, markConversationRead]);

  const resolvedCharacterId = characterIdProp || activeCharacter?.id;

  // Group messages into conversations (mesma lógica do mobile: inbox unificado de todos os grupos)
  const conversations = useMemo(() => {
    if (!activeCharacter || !resolvedCharacterId) return [];
    
    const relevantMessages = groupMessages.filter(
      msg => !msg.recipientId || msg.recipientId === resolvedCharacterId || msg.senderId === resolvedCharacterId
    );

    const convMap = new Map<string, {
      contactId: string;
      contactName: string;
      contactNumber: string;
      groupId: string;
      lastMessage: any;
      messages: any[];
    }>();

    const sortedMessages = [...relevantMessages].sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0;
      const timeB = b.createdAt?.toMillis() || 0;
      return timeA - timeB;
    });

    sortedMessages.forEach(msg => {
      let contactId = '';

      if (msg.senderId === resolvedCharacterId) {
        if (!msg.recipientId) return; 
        
        // As of the GroupService fix, player messages now have the NPC correctly set in recipientId
        contactId = msg.recipientId;
      } else {
        contactId = msg.senderId;
      }

      if (!convMap.has(contactId)) {
        convMap.set(contactId, {
          contactId,
          contactName: 'DESCONHECIDO',
          contactNumber: '',
          groupId: msg._groupId || '',
          lastMessage: msg,
          messages: []
        });
      }

      const conv = convMap.get(contactId)!;
      conv.messages.push(msg);
      
      if (msg.createdAt && (!conv.lastMessage.createdAt || msg.createdAt.toDate() > conv.lastMessage.createdAt.toDate())) {
        conv.lastMessage = msg;
        conv.groupId = msg._groupId || conv.groupId;
      }
    });

    for (const conv of convMap.values()) {
      const receivedMsg = conv.messages.find(m => m.senderId !== resolvedCharacterId);
      if (receivedMsg) {
        conv.contactName = receivedMsg.senderName || 'DESCONHECIDO';
        conv.contactNumber = receivedMsg.senderNumber || '';
      } else {
        const msgData = relevantMessages.find(m => m.recipientId === conv.contactId);
        conv.contactName = msgData?.recipientName || 'DESCONHECIDO';
        conv.contactNumber = msgData?.recipientNumber || '';
      }
    }

    return Array.from(convMap.values()).sort((a, b) => {
      const dateA = a.lastMessage.createdAt?.toDate() || new Date(0);
      const dateB = b.lastMessage.createdAt?.toDate() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [groupMessages, activeCharacter, resolvedCharacterId]);

  // Subscribe to character's groups
  useEffect(() => {
    if (!resolvedCharacterId) {
      setUserGroups([]);
      setGroupsLoaded(false);
      return;
    }
    setGroupsLoaded(false);
    const unsub = groupService.subscribeToGroupsForCharacter(
      resolvedCharacterId,
      (groups) => {
        setUserGroups(groups);
        setGroupsLoaded(true);
      },
      uid
    );
    return unsub;
  }, [resolvedCharacterId, uid]);

  // Subscribe to messages from all groups (paridade com mobile)
  useEffect(() => {
    const groupIds = userGroups.map(g => g.id);
    if (groupIds.length === 0) {
      setGroupMessages([]);
      return;
    }
    const unsub = groupService.subscribeToMessagesForGroups(groupIds, setGroupMessages);
    return unsub;
  }, [userGroups]);

  // Auto-scroll messages list to bottom (scoped to messages container only)
  useEffect(() => {
    if (activeTab !== 'SMS' || !activeConversationId) return;
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [groupMessages, activeConversationId, activeTab]);

  const handleSendMessage = async () => {
    if (!newMessageText.trim() || !activeCharacter || !activeConversationId) return;
    try {
      getSfx().playConfirm();
      const text = newMessageText.trim();
      setNewMessageText('');
      
      const activeConv = conversations.find(c => c.contactId === activeConversationId);
      if (!activeConv?.groupId) return;
      
      await groupService.sendGroupMessage(
        activeConv.groupId,
        resolvedCharacterId,
        activeCharacter.codinome,
        activeCharacter.phoneNumber || '',
        text,
        activeConv?.contactId,
        activeConv?.contactName,
        activeConv?.contactNumber
      );
    } catch (error) {
      console.error('[NokiaPlayer] Error sending message:', error);
    }
  };

  // Show back button when in a sub-screen state (e.g., active SMS conversation)
  useEffect(() => {
    if (setBackVisible) {
      setBackVisible(!!activeConversationId);
    }
  }, [setBackVisible, activeConversationId]);

  // Register back button handler
  useEffect(() => {
    if (registerBackHandler) {
      registerBackHandler(() => {
        if (status === 'SCANNING') {
          onCancelScan();
          return true;
        }
        if (showVolumeBar) {
          setShowVolumeBar(false);
          return true;
        }
        // If viewing an SMS conversation, go back to conversation list
        if (activeConversationId) {
          getSfx().playBack();
          setActiveConversationId(null);
          return true;
        }
        return false;
      });
    }
    return () => {
      if (registerBackHandler) registerBackHandler(null);
    };
  }, [registerBackHandler, status, showVolumeBar, onCancelScan, activeConversationId]);

  const audioItems = useMemo(() => intelItems.filter((item) => item.type === 'AUDIO'), [intelItems]);
  const videoItems = useMemo(() => intelItems.filter((item) => item.type === 'VIDEO'), [intelItems]);
  const fileItems = useMemo(() => intelItems.filter((item) => item.type !== 'AUDIO' && item.type !== 'VIDEO'), [intelItems]);

  const sortedItems = useMemo(() => {
    if (activeTab === 'AUDIO') {
      return [...audioItems, ...(fileItems.length > 0 ? [{ __divider: true, label: 'PISTAS / DOCS' } as any, ...fileItems] : [])];
    }
    if (activeTab === 'VIDEO') {
      return videoItems;
    }
    if (activeTab === 'DOCS') {
      return [...fileItems, ...(audioItems.length > 0 ? [{ __divider: true, label: 'PROVAS / AUDIO' } as any, ...audioItems] : [])];
    }
    if (activeTab === 'TODOS') {
      const parts: any[] = [...audioItems];
      if (videoItems.length > 0) {
        if (parts.length > 0) parts.push({ __divider: true, label: 'VÍDEOS' });
        parts.push(...videoItems);
      }
      if (fileItems.length > 0) {
        if (parts.length > 0) parts.push({ __divider: true, label: 'PISTAS / DOCS' });
        parts.push(...fileItems);
      }
      return parts;
    }
    return [...audioItems, ...videoItems, ...fileItems];
  }, [activeTab, audioItems, videoItems, fileItems]);

  const isVideoIntel = currentIntel instanceof VideoIntel;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const updateProgress = (timestamp: number) => {
      // Throttle to ~4 updates/sec (250ms) to avoid excessive re-renders
      if (timestamp - lastUpdateRef.current >= 250) {
        lastUpdateRef.current = timestamp;
        const current = isVideoIntel && videoSurfaceRef.current
          ? videoSurfaceRef.current.getCurrentTime()
          : audioEngine.getCurrentTime();
        const duration = isVideoIntel && videoSurfaceRef.current
          ? videoSurfaceRef.current.getDuration()
          : audioEngine.getDuration();
        setAudioProgress(current);
        setAudioDuration(duration);

        const formatTime = (time: number) => {
          if (isNaN(time) || time < 0) return '00:00';
          const mins = Math.floor(time / 60);
          const secs = Math.floor(time % 60);
          return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        setCurrentTimeStr(formatTime(current));
        setDurationTimeStr(formatTime(duration));
      }

      // Only continue the loop while playing
      if (isPlayingRef.current) {
        rafRef.current = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, isVideoIntel]);

  const handleItemTap = (item: IntelBase) => {
    getSfx().playConfirm();
    onIntelSelect(item);
  };

  const handlePlayToggle = () => {
    getSfx().playConfirm();
    if (currentIntel?.type === 'AUDIO' || currentIntel?.type === 'VIDEO') {
      setIsPlaying(!isPlaying);
    }
  };

  const handleRewindLocal = () => {
    if (onRewind) {
      onRewind();
    } else {
      getSfx().playBeep();
      if (currentIntel instanceof VideoIntel && videoSurfaceRef.current) {
        videoSurfaceRef.current.rewind();
        setIsPlaying(true);
      } else if (currentIntel) {
        audioEngine.stop();
        setTimeout(() => {
          audioEngine.play().catch(() => {});
        }, 1000);
      }
    }
  };

  const handleEject = () => {
    getSfx().playBack();
    onEject();
  };

  const handleVolumeTap = () => {
    getSfx().playConfirm();
    if (showVolumeBar) {
      setShowVolumeBar(false);
    } else {
      setShowVolumeBar(true);
      if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
      volumeTimeoutRef.current = setTimeout(() => setShowVolumeBar(false), 4000);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolume(clamped);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumeBar(false), 4000);
  };

  const handleTabChange = (tab: FilterTab) => {
    getSfx().playBeep();
    setActiveTab(tab);
    sessionStorage.setItem('nokia_active_tab', tab);
    if (intelListRef.current) intelListRef.current.scrollTop = 0;
    if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = 0;
  };

  const isScanning = status === 'SCANNING';
  const hasActiveIntel = !!currentIntel && (status === 'LOADED' || status === 'PLAYING' || status === 'REWINDING');

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'TODOS', label: 'TUDO', icon: <span>[*]</span> },
    { key: 'AUDIO', label: 'AUD', icon: <PixelIcon.Audio /> },
    { key: 'VIDEO', label: 'VID', icon: <PixelIcon.VHS /> },
    { key: 'DOCS', label: 'DOC', icon: <PixelIcon.Doc /> },
    { key: 'SMS', label: 'SMS', icon: <PixelIcon.SMS /> },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden relative select-none">
      <div className="flex-grow overflow-hidden relative flex flex-col">
        {isScanning ? (
          <div className="w-full h-full flex flex-col justify-between bg-black relative overflow-hidden flex-grow">
            <div className="absolute top-1 left-2 z-20 text-[#edfeed] font-black text-[9px] uppercase tracking-widest bg-[#111e14] px-1 animate-pulse">
              SCANNER ATIVO
            </div>
            <div className="flex-grow w-full bg-[#222] relative flex items-center justify-center min-h-0">
              <React.Suspense fallback={<div className="text-[#edfeed] text-[10px] animate-pulse">INICIANDO CAMERA...</div>}>
                <QrScanner onDetected={onQrDetected} onCancel={onCancelScan} />
              </React.Suspense>
              {/* ASCII Crosshair */}
              <div className="absolute w-32 h-32 border border-dashed border-[#edfeed]/40 pointer-events-none flex items-center justify-center opacity-50">
                <div className="absolute inset-0 flex items-center justify-center text-[#edfeed] text-[20px] font-mono">
                  +
                </div>
                <div className="absolute top-0 left-0">┌</div>
                <div className="absolute top-0 right-0">┐</div>
                <div className="absolute bottom-0 left-0">└</div>
                <div className="absolute bottom-0 right-0">┘</div>
              </div>
            </div>
            <div className="h-10 bg-[#edfeed] text-[#111e14] border-t-2 border-[#111e14] px-3 flex items-center justify-between text-[11px] font-black shrink-0">
              <span className="flex items-center gap-2"><PixelIcon.Camera /> ALINHE O CÓDIGO</span>
              <button onClick={onCancelScan} className="uppercase px-2 py-1 border border-[#111e14] active:bg-[#111e14] active:text-[#edfeed]">SAIR</button>
            </div>
          </div>
        ) : showVolumeBar ? (
          <div className="w-full h-full flex flex-col justify-center items-center gap-6 px-4 select-none bg-[#edfeed] flex-grow">
            <div className="text-[14px] font-black uppercase flex flex-col items-center gap-2">
              <PixelIcon.Volume />
              <span>VOLUME</span>
            </div>
            <div className="w-full border-2 border-[#111e14] p-1.5 flex gap-1 h-12 items-center bg-[#edfeed] shadow-[2px_2px_0px_#111e14]">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  onClick={() => handleVolumeChange((i + 1) * 10)}
                  className={`h-full flex-1 border border-[#111e14] cursor-pointer transition-all active:scale-90 ${
                    volume >= (i + 1) * 10 ? 'bg-[#111e14]' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
            <div className="text-[12px] font-black uppercase tracking-[0.2em]">
              NIVEL: {volume}%
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-[#edfeed] p-1 px-2 flex-grow min-h-0">
            {/* ─── TOP AREA: QR SCAN or INLINE PLAYER ─── */}
            <div className="shrink-0 mb-2 mt-1">
              <AnimatePresence mode="wait">
                {hasActiveIntel && currentIntel ? (
                  <motion.div
                    key="player-inline"
                    initial={{ opacity: 0, scaleY: 0, originY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    className="border-2 border-[#111e14] p-2 bg-[#edfeed] shadow-[2px_2px_0px_#111e14]"
                  >
                    <div className="text-center mb-2">
                      <div className="text-[13px] font-black uppercase truncate leading-none mb-1">
                        {currentIntel.title}
                      </div>
                      <div className="text-[9px] font-bold opacity-70 uppercase truncate">
                        {currentIntel instanceof AudioIntel
                          ? currentIntel.metadata.artist
                          : currentIntel instanceof VideoIntel
                            ? `${currentIntel.format} · ${currentIntel.metadata?.npc || 'ARQUIVO'}`
                            : currentIntel.metadata?.npc}
                      </div>
                    </div>

                    {isVideoIntel && currentIntel instanceof VideoIntel ? (
                      <>
                        <div className="relative mb-2 border-2 border-[#111e14] aspect-video overflow-hidden shadow-[2px_2px_0px_#111e14]">
                          <NokiaVideoSurface
                            ref={videoSurfaceRef}
                            intel={currentIntel}
                            isPlaying={isPlaying}
                            volume={volume}
                            onEnded={() => setIsPlaying(false)}
                          />
                        </div>
                        <div className="flex justify-center mb-2">
                          {currentIntel.format === 'DVD' ? (
                            <div className="w-16 h-16 rounded-full border-2 border-[#111e14] flex items-center justify-center relative bg-[#edfeed] shadow-[2px_2px_0px_#111e14]">
                              <div className="w-5 h-5 rounded-full border-2 border-[#111e14] bg-[#111e14]/10" />
                              <div className={`absolute inset-1 rounded-full border border-dashed border-[#111e14]/30 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                            </div>
                          ) : (
                            <div className="w-24 h-14 bg-[#edfeed] border-2 border-[#111e14] relative flex items-center justify-around px-3 shadow-[2px_2px_0px_#111e14]">
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-2 border-b-2 border-[#111e14]" />
                              {[0, 1].map((ri) => (
                                <div key={ri} className="w-5 h-5 border-2 border-[#111e14] flex items-center justify-center relative">
                                  <div className={`w-full h-0.5 bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                                  <div className={`w-0.5 h-full bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                                </div>
                              ))}
                              <span className="absolute bottom-0.5 right-1 text-[7px] font-black">VHS</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-center mb-2">
                        <div className="w-28 h-12 bg-[#edfeed] border-2 border-[#111e14] relative flex items-center justify-around px-4">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 border-b-2 border-[#111e14]" />
                          {[0, 1].map((ri) => (
                            <div
                              key={ri}
                              className="w-6 h-6 border-2 border-[#111e14] flex items-center justify-center relative bg-white/20"
                            >
                              <div
                                className={`w-full h-0.5 bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`}
                                style={{ animationDuration: '4s' }}
                              />
                              <div
                                className={`w-0.5 h-full bg-[#111e14] absolute ${isPlaying ? 'animate-spin' : ''}`}
                                style={{ animationDuration: '4s' }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Progress */}
                    <div className="mb-2">
                      <div className="flex justify-between items-center text-[9px] font-black px-0.5 mb-1">
                        <span>{currentTimeStr}</span>
                        <span className="uppercase tracking-[0.2em] text-[8px]">
                          {status === 'REWINDING' ? '<< REW' : isPlaying ? 'PLAYING' : 'PAUSED'}
                        </span>
                        <span>{durationTimeStr}</span>
                      </div>
                      <div className="w-full border-2 border-[#111e14] h-4 p-[1px] flex gap-[1px] items-center bg-[#edfeed]">
                        {Array.from({ length: 20 }).map((_, i) => {
                          const pct = (i + 1) / 20;
                          const isFilled = audioDuration > 0 && (audioProgress / audioDuration) >= pct;
                          return (
                            <div
                              key={i}
                              className={`h-full flex-1 ${isFilled ? 'bg-[#111e14]' : 'bg-transparent'}`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center items-center gap-3">
                      <button
                        onClick={handleRewindLocal}
                        className={`w-10 h-9 border-2 border-[#111e14] flex items-center justify-center active:bg-[#111e14] active:text-[#edfeed] shadow-[1px_1px_0px_#111e14] ${status === 'REWINDING' ? 'bg-[#111e14] text-[#edfeed]' : ''}`}
                      >
                        <PixelIcon.Rewind />
                      </button>
                      <button
                        onClick={handlePlayToggle}
                        className="w-12 h-10 border-2 border-[#111e14] flex items-center justify-center bg-[#111e14] text-[#edfeed] shadow-[1px_1px_0px_#111e14] active:translate-y-[1px] active:shadow-none"
                      >
                        {isPlaying ? <PixelIcon.Pause /> : <PixelIcon.Play />}
                      </button>
                      <button
                        onClick={handleEject}
                        className="w-10 h-9 border-2 border-[#111e14] flex items-center justify-center active:bg-[#111e14] active:text-[#edfeed] shadow-[1px_1px_0px_#111e14]"
                      >
                        <PixelIcon.Close />
                      </button>
                      <button
                        onClick={handleVolumeTap}
                        className="w-10 h-9 border-2 border-[#111e14] flex items-center justify-center active:bg-[#111e14] active:text-[#edfeed] shadow-[1px_1px_0px_#111e14]"
                      >
                        <PixelIcon.Volume />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="qr-scan"
                    initial={{ opacity: 0, scaleY: 0, originY: 0 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    exit={{ opacity: 0, scaleY: 0 }}
                    onClick={onScanClick}
                    className="border-2 border-dashed border-[#111e14] p-4 flex flex-col justify-center items-center cursor-pointer hover:bg-[#111e14]/5 active:bg-[#111e14]/10 gap-2 transition-colors"
                  >
                    <PixelIcon.Camera />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">ESCANEAR CÓDIGO</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ─── FILTER TABS ─── */}
            <div className="flex border-2 border-[#111e14] shrink-0 mb-2 overflow-hidden shadow-[1px_1px_0px_#111e14] bg-[#edfeed]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-1 transition-all ${
                    activeTab === tab.key
                      ? 'bg-[#111e14] text-[#edfeed]'
                      : 'bg-[#edfeed] text-[#111e14] hover:bg-[#111e14]/5'
                  }`}
                >
                  <div className="scale-75">{tab.icon}</div>
                  <span className="text-[8px] font-black uppercase tracking-tighter">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ─── UNIFIED INTEL LIST ─── */}
            <div ref={intelListRef} className="flex-grow overflow-y-auto min-h-0 px-0.5 custom-nokia-scrollbar" style={{ scrollbarWidth: 'none' }}>
              {activeTab === 'SMS' ? (
                <div className="flex flex-col flex-grow min-h-0 h-full">
                  {!activeCharacter?.phoneNumber ? (
                    <div className="flex flex-col items-center justify-center p-4 border-2 border-[#111e14] bg-[#edfeed] gap-3 text-center my-2 shadow-[1px_1px_0px_#111e14]">
                      <div className="scale-125"><PixelIcon.SMS /></div>
                      <span className="font-black text-[10px] uppercase">REGISTRO DE NÚMERO</span>
                      <p className="text-[9px] opacity-80 leading-normal font-bold">
                        VOCÊ PRECISA DE UM NÚMERO DE TELEFONE US PARA ENVIAR MENSAGENS NO GRUPO.
                      </p>
                      <button
                        onClick={() => {
                          const num = generateRandomUSPhoneNumber();
                          onUpdatePhoneNumber?.(num);
                        }}
                        className="w-full py-2 border-2 border-[#111e14] bg-[#111e14] text-[#edfeed] font-black uppercase active:bg-[#edfeed] active:text-[#111e14] text-[10px] tracking-wider"
                      >
                        [GERAR NÚMERO]
                      </button>
                    </div>
                  ) : !groupsLoaded ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40 gap-2">
                      <PixelIcon.SMS />
                      <span className="font-black text-[9px] uppercase">SINCRONIZANDO GRUPOS...</span>
                    </div>
                  ) : userGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40 gap-2">
                      <PixelIcon.SMS />
                      <span className="font-black text-[9px] uppercase">NENHUM GRUPO ATIVO</span>
                      <p className="text-[8px]">VOCÊ NÃO PERTENCE A NENHUM GRUPO DE AGENTES.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-grow min-h-0 h-full">
                      <div className="flex justify-between items-center bg-[#111e14]/5 border-b border-[#111e14]/20 p-1.5 text-[9px] font-black shrink-0 mb-1.5">
                        <div className="flex items-center gap-1">
                          <span className="opacity-60">DE:</span>
                          <span className="font-mono">{activeCharacter.phoneNumber}</span>
                        </div>
                        {!activeConversationId && userGroups.length > 0 && (
                          <span className="truncate max-w-[140px] uppercase font-bold opacity-60">
                            {userGroups.length === 1 ? userGroups[0].name : `${userGroups.length} GRUPOS`}
                          </span>
                        )}
                      </div>

                      {!activeConversationId ? (
                        /* CONVERSATIONS LIST */
                        <div className="flex-grow overflow-y-auto min-h-0 px-0.5 space-y-1.5 custom-nokia-scrollbar">
                          {conversations.map((conv) => {
                            const dateStr = conv.lastMessage.createdAt?.toDate 
                              ? conv.lastMessage.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Agora';
                            return (
                              <button
                                key={conv.contactId}
                                onClick={() => {
                                  getSfx().playConfirm();
                                  markConversationRead(conv.contactId);
                                  setActiveConversationId(conv.contactId);
                                }}
                                className="w-full text-left flex flex-col p-2 border-2 border-[#111e14] bg-[#edfeed] hover:bg-[#111e14]/5 active:scale-[0.98] transition-all shadow-[1px_1px_0px_#111e14]"
                              >
                                <div className="flex justify-between items-center text-[9px] font-black uppercase mb-1">
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    {!readConversationIds.has(conv.contactId) && (
                                      <span className="w-2 h-2 bg-[#111e14] shrink-0" aria-hidden />
                                    )}
                                    <span className="truncate">{conv.contactName}</span>
                                  </span>
                                  <span className="opacity-50 font-mono text-[8px]">{dateStr}</span>
                                </div>
                                <div className="text-[10px] font-bold opacity-80 truncate uppercase tracking-tighter">
                                  {conv.lastMessage.senderId === resolvedCharacterId ? 'VOCÊ: ' : ''}{conv.lastMessage.text}
                                </div>
                              </button>
                            );
                          })}
                          {conversations.length === 0 && (
                            <div className="py-8 text-center opacity-30 text-[9px] font-black uppercase">
                              CAIXA DE ENTRADA VAZIA
                            </div>
                          )}
                        </div>
                      ) : (
                        /* ACTIVE CONVERSATION MESSAGES */
                        <div className="flex flex-col flex-grow min-h-0 h-full">
                          {/* Chat Header */}
                          <div className="flex items-center gap-2 pb-2 mb-2 border-b-2 border-[#111e14] border-dotted shrink-0">
                            <button
                              onClick={() => {
                                getSfx().playBack();
                                setActiveConversationId(null);
                              }}
                              className="border border-[#111e14] px-1.5 py-0.5 font-black text-[9px] hover:bg-[#111e14] hover:text-[#edfeed] active:scale-95 uppercase transition-all"
                            >
                              [VOLTAR]
                            </button>
                            <span className="font-black text-[10px] uppercase truncate">
                              {conversations.find(c => c.contactId === activeConversationId)?.contactName || 'DESCONHECIDO'}
                            </span>
                          </div>

                          {/* Messages list */}
                          <div ref={messagesContainerRef} className="flex-grow overflow-y-auto min-h-0 px-0.5 space-y-2 custom-nokia-scrollbar">
                            {(() => {
                              const activeConv = conversations.find(c => c.contactId === activeConversationId);
                              if (!activeConv) return null;
                              
                              // Sort messages chronologically
                              const chatMsgs = [...activeConv.messages].sort((a, b) => {
                                const tA = a.createdAt?.toMillis() || 0;
                                const tB = b.createdAt?.toMillis() || 0;
                                return tA - tB;
                              });

                              return chatMsgs.map((msg) => {
                                const isMe = msg.senderId === resolvedCharacterId;
                                const dateStr = msg.createdAt?.toDate 
                                  ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Agora';
                                return (
                                  <div
                                    key={msg.id}
                                    className={`text-[11px] p-2 border-2 border-[#111e14] flex flex-col gap-0.5 shadow-[1px_1px_0px_#111e14] ${
                                      isMe 
                                        ? 'bg-[#111e14] text-[#edfeed] ml-4' 
                                        : 'bg-[#edfeed] mr-4'
                                    }`}
                                  >
                                    <div className="flex justify-between items-center text-[8px] font-black opacity-70 mb-0.5">
                                      <span>{isMe ? 'VOCÊ' : `${msg.senderName}`}</span>
                                      <span>{dateStr}</span>
                                    </div>
                                    <div className="leading-tight font-bold break-words whitespace-pre-wrap">
                                      {msg.text}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>

                          {/* Composer input */}
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSendMessage();
                            }}
                            className="flex gap-1 mt-2 shrink-0"
                          >
                            <input
                              type="text"
                              value={newMessageText}
                              onChange={(e) => setNewMessageText(e.target.value)}
                              placeholder="DIGITE..."
                              className="flex-1 bg-[#edfeed] border-2 border-[#111e14] px-1.5 py-1 text-[10px] text-[#111e14] placeholder:text-[#111e14]/50 focus:outline-none font-bold uppercase"
                            />
                            <button
                              type="submit"
                              disabled={!newMessageText.trim()}
                              className="border-2 border-[#111e14] bg-[#111e14] text-[#edfeed] font-black px-2 py-1 text-[10px] active:scale-95 disabled:opacity-40 transition-all uppercase"
                            >
                              [ENV]
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-30">
                  <div className="mb-2 scale-150"><PixelIcon.Doc /></div>
                  <div className="text-[11px] font-black uppercase">
                    VAZIO
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sortedItems.map((item, idx) => {
                    if (item.__divider) {
                      return (
                        <div key={`div-${idx}`} className="flex items-center gap-2 py-2 px-1">
                          <div className="flex-1 border-t-2 border-[#111e14]/20 border-dotted" />
                          <span className="text-[9px] font-black opacity-50 uppercase tracking-[0.2em] shrink-0">{item.label}</span>
                          <div className="flex-1 border-t-2 border-[#111e14]/20 border-dotted" />
                        </div>
                      );
                    }

                    const isAudio = item.type === 'AUDIO';
                    const isVideo = item.type === 'VIDEO';
                    const isCurrent = item.id === currentIntelId;
                    const videoFormat = isVideo && item instanceof VideoIntel ? item.format : null;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemTap(item)}
                        className={`text-[12px] py-2 px-3 cursor-pointer flex items-center gap-3 font-bold transition-all border-2 shadow-[1px_1px_0px_#111e14] active:translate-y-[1px] active:shadow-none ${
                          isCurrent
                            ? 'bg-[#111e14] text-[#edfeed] border-[#111e14]'
                            : 'bg-[#edfeed] text-[#111e14] border-[#111e14] hover:bg-[#111e14]/5'
                        }`}
                      >
                        <div className="shrink-0 scale-90">
                          {isAudio ? <PixelIcon.Audio /> : isVideo ? (videoFormat === 'DVD' ? <PixelIcon.DVD /> : <PixelIcon.VHS />) : <PixelIcon.Doc />}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate uppercase tracking-tight">{item.title}</span>
                          {isVideo && videoFormat && (
                            <span className="text-[8px] opacity-60 uppercase tracking-widest">{videoFormat}</span>
                          )}
                        </div>
                        {isCurrent && (
                          <div className="ml-auto shrink-0 flex items-center gap-1">
                            {isPlaying ? (
                              <div className="flex gap-[1px]">
                                {[1, 2, 3].map(i => (
                                  <div key={i} className={`w-1 h-3 bg-current animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }} />
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px]">&gt;&gt;</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
