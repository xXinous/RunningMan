import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, LogOut, Trophy, Music, Pencil, Check, X, ExternalLink, Image, Map as MapIcon, User, Phone } from 'lucide-react';
import { ALL_ACHIEVEMENTS } from '../data/achievements';
import PlayerGallery from './PlayerGallery';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';
import type { GalleryImage, PlayerData } from '../types/player';

interface ProfileScreenProps {
  profile: PlayerData;
  galleryImages?: GalleryImage[];
  onBack: () => void;
  onLogout: () => void;
  onUpdateSpotify?: (url: string) => void;
  onUpdatePhoneNumber?: (phoneNumber: string) => void;
  onChangeMission?: () => void;
  onChangeCharacter?: () => void;
  variant?: 'default' | 'nokia';
}

function extractSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes('open.spotify.com/embed')) return url;
  const match = url.match(/open\.spotify\.com\/(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/);
  if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  const uriMatch = url.match(/spotify:(playlist|album|track|episode|show):([a-zA-Z0-9]+)/);
  if (uriMatch) return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}?utm_source=generator&theme=0`;
  return null;
}

type AgentStatusKey = 'vivo' | 'morto' | 'desaparecido';

const STATUS_CONFIG: Map<AgentStatusKey, { label: string; color: string; dot: string; glow: string }> = new Map([
  ['vivo', { label: 'ATIVO', color: 'text-green-500', dot: 'bg-green-500', glow: 'glow-green' }],
  ['morto', { label: 'ELIMINADO', color: 'text-red-500', dot: 'bg-red-500', glow: 'glow-red' }],
  ['desaparecido', { label: 'DESAPARECIDO', color: 'text-yellow-500', dot: 'bg-yellow-500', glow: 'glow-yellow' }],
]);

const DANGER_LABELS = ['—', 'BAIXO', 'MODERADO', 'ELEVADO', 'ALTO', 'CRÍTICO'] as const;

export function generateRandomUSPhoneNumber(): string {
  const areaCode = Math.floor(100 + Math.random() * 900); // 100-999
  const exchangeCode = Math.floor(100 + Math.random() * 900); // 100-999
  const subscriberNumber = Math.floor(1000 + Math.random() * 9000); // 1000-9999
  return `(${areaCode}) ${exchangeCode}-${subscriberNumber}`;
}

export default function ProfileScreen({ 
  profile,
  galleryImages = [],
  onBack, 
  onLogout, 
  onUpdateSpotify, 
  onUpdatePhoneNumber,
  onChangeMission, 
  onChangeCharacter,
  variant = 'default'
}: ProfileScreenProps) {
  const { isLandscape } = useLandscapeLayout();
  const earnedIds = new Set(profile.achievementIds);
  const [isEditingSpotify, setIsEditingSpotify] = useState(false);
  const [spotifyInput, setSpotifyInput] = useState(profile.character.spotifyPlaylistUrl || '');
  const [spotifyError, setSpotifyError] = useState('');
  
  const initials = profile.character.codinome
    .split(/[\s\-_]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const embedUrl = extractSpotifyEmbedUrl(profile.character.spotifyPlaylistUrl || '');

  const handleSaveSpotify = () => {
    const trimmed = spotifyInput.trim();
    if (trimmed && !extractSpotifyEmbedUrl(trimmed)) {
      setSpotifyError('Link inválido. Use o link de uma playlist do Spotify.');
      return;
    }
    setSpotifyError('');
    onUpdateSpotify?.(trimmed);
    setIsEditingSpotify(false);
  };

  const handleCancelEdit = () => {
    setSpotifyInput(profile.character.spotifyPlaylistUrl || '');
    setSpotifyError('');
    setIsEditingSpotify(false);
  };

  if (variant === 'nokia') {
    const statusCfg = STATUS_CONFIG.get((profile.character.agentStatus || 'vivo') as AgentStatusKey) ?? { label: 'ATIVO', color: 'text-green-500', dot: 'bg-green-500', glow: 'glow-green' };
    const dangerLabel = DANGER_LABELS[profile.character.dangerLevel || 0];

    return (
      <div className="w-full h-full bg-[#edfeed] text-[#111e14] flex flex-col p-1 font-mono uppercase text-[10px] select-none tracking-widest relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-[#111e14] pb-1 shrink-0 font-bold mb-2">
          <button onClick={onBack} className="hover:bg-[#111e14] hover:text-[#edfeed] px-1 active:scale-95 transition-all">
            [VOLTAR]
          </button>
          <span className="text-[9px] animate-pulse">CLASSIFICADO</span>
          <button onClick={onLogout} className="hover:bg-[#111e14] hover:text-[#edfeed] px-1 active:scale-95 transition-all">
            [SAIR]
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pb-2 pr-1 custom-nokia-scrollbar" style={{ scrollbarWidth: 'none' }}>
          
          {/* Main Agent Info (Dossier Header) */}
          <div className="border-2 border-[#111e14] p-2 bg-[#111e14]/5 relative overflow-hidden shadow-[2px_2px_0px_#111e14]">
             <div className="flex gap-3 mb-2">
                {/* Pixel Photo Placeholder */}
                <div className="w-12 h-12 border-2 border-[#111e14] bg-[#edfeed] shrink-0 flex items-center justify-center font-black text-[16px] relative overflow-hidden shadow-[1px_1px_0px_#111e14]">
                   {profile.character.profilePhotoUrl ? (
                     <img 
                      src={profile.character.profilePhotoUrl} 
                      alt="Perfil" 
                      className="w-full h-full object-cover grayscale contrast-150 brightness-75 mix-blend-multiply" 
                     />
                   ) : (
                     <span>{initials}</span>
                   )}
                   {/* Scanline Overlay */}
                   <div className="absolute inset-0 opacity-10 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,#111e14_1px,#111e14_2px)]" />
                </div>
                
                <div className="flex-1 flex flex-col justify-between py-0.5">
                  <div className="flex flex-col gap-0.5">
                    <div className="text-[12px] font-black leading-none truncate w-[120px]">{profile.character.codinome}</div>
                    <div className="text-[8px] opacity-60 font-bold tracking-tighter">AGENT_ID: RM-{profile.character.agentId || 'XXXX'}</div>
                  </div>
                  <div className={`self-start px-1.5 py-0.5 border border-[#111e14] text-[7px] font-black ${profile.character.agentStatus === 'vivo' ? 'bg-[#111e14] text-[#edfeed]' : ''}`}>
                    STATUS: {statusCfg.label}
                  </div>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-2 border-y border-[#111e14]/20 py-2 my-2">
                <div className="flex flex-col">
                  <span className="text-[7px] opacity-60 font-bold tracking-tighter">PROVAS_INTEL</span>
                  <span className="text-[14px] font-black leading-none mt-1">{profile.unlockedIntelIds.length}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] opacity-60 font-bold tracking-tighter">MEDALHAS_REG</span>
                  <span className="text-[14px] font-black leading-none mt-1">{profile.achievementIds.length}</span>
                </div>
             </div>

             <div className="">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[7px] opacity-60 font-bold">NIVEL_PERICULOSIDADE</span>
                  <span className="text-[7px] font-black">{dangerLabel}</span>
                </div>
                <div className="flex gap-0.5 h-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`flex-1 border border-[#111e14] ${i < (profile.character.dangerLevel || 0) ? 'bg-[#111e14]' : ''}`} 
                    />
                  ))}
                </div>
             </div>
          </div>

          {/* Actions */}
          <div className="space-y-1">
            <button onClick={onChangeMission} className="w-full border-2 border-[#111e14] flex justify-between px-2 py-2 hover:bg-[#111e14] hover:text-[#edfeed] font-black active:scale-95 transition-all shadow-[1px_1px_0px_#111e14]">
              <span>[ ] ALVO / MISSÃO</span>
              <span>&gt;&gt;</span>
            </button>
            <button onClick={onChangeCharacter} className="w-full border-2 border-[#111e14] flex justify-between px-2 py-2 hover:bg-[#111e14] hover:text-[#edfeed] font-black active:scale-95 transition-all shadow-[1px_1px_0px_#111e14]">
              <span>[ ] TROCAR AGENTE</span>
              <span>&gt;&gt;</span>
            </button>
          </div>

          {/* Spotify */}
          <div className="border-2 border-[#111e14] p-1.5 shadow-[1px_1px_0px_#111e14]">
            <div className="flex justify-between items-center mb-2 font-black border-b border-[#111e14]/20 pb-1">
              <span className="text-[8px]">WALKMAN / REDE_SCN</span>
              {onUpdateSpotify && !isEditingSpotify && (
                <button onClick={() => { setIsEditingSpotify(true); setSpotifyInput(profile.character.spotifyPlaylistUrl || ''); }} className="hover:bg-[#111e14] hover:text-[#edfeed] px-1 active:scale-95 transition-all text-[8px] border border-[#111e14]">
                  [{embedUrl ? 'EDIT' : 'LINK'}]
                </button>
              )}
            </div>
            {isEditingSpotify ? (
              <div className="space-y-1">
                <input
                  type="url"
                  value={spotifyInput}
                  onChange={(e) => { setSpotifyInput(e.target.value); setSpotifyError(''); }}
                  placeholder="URL SPOTIFY..."
                  className="w-full bg-[#edfeed] border border-[#111e14] px-1 py-1 text-[9px] text-[#111e14] focus:outline-none placeholder:text-[#111e14]/50"
                  autoFocus
                />
                {spotifyError && <p className="text-[8px] animate-pulse">ERRO: {spotifyError}</p>}
                <div className="flex gap-1 justify-end">
                  <button onClick={handleCancelEdit} className="border border-[#111e14] px-2 py-0.5 hover:bg-[#111e14] hover:text-[#edfeed] active:scale-95 transition-all text-[8px]">[CANC]</button>
                  <button onClick={handleSaveSpotify} className="border border-[#111e14] px-2 py-0.5 hover:bg-[#111e14] hover:text-[#edfeed] active:scale-95 transition-all font-black text-[8px]">[SALV]</button>
                </div>
              </div>
            ) : embedUrl ? (
              <div className="border border-dashed border-[#111e14] p-0.5 opacity-90">
                <iframe src={embedUrl} width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" />
              </div>
            ) : (
              <div className="text-[8px] text-center border border-dashed border-[#111e14] py-3 opacity-60 font-bold italic">
                SEM CONEXÃO DE ÁUDIO.
              </div>
            )}
          </div>

          {/* Telefone Nokia */}
          <div className="border-2 border-[#111e14] p-1.5 font-black shadow-[1px_1px_0px_#111e14]">
            <div className="flex justify-between items-center mb-1 text-[8px] opacity-60">
              <span>CONTATO / SMS_LINK</span>
            </div>
            {profile.character.phoneNumber ? (
              <div className="flex justify-between items-center bg-[#111e14] text-[#edfeed] p-1.5">
                <span className="text-[8px]">NÚMERO:</span>
                <span className="text-[10px] font-mono tracking-tighter">{profile.character.phoneNumber}</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  const num = generateRandomUSPhoneNumber();
                  onUpdatePhoneNumber?.(num);
                }}
                className="w-full border-2 border-[#111e14] py-1.5 text-center hover:bg-[#111e14] hover:text-[#edfeed] active:scale-95 transition-all text-[9px]"
              >
                [GERAR NÚMERO US]
              </button>
            )}
          </div>

          {/* Gallery */}
          <div className="border-2 border-[#111e14] p-1.5 shadow-[1px_1px_0px_#111e14]">
            <div className="font-black mb-2 flex items-center gap-1 text-[8px] border-b border-[#111e14]/20 pb-1">
               <span>ARQUIVOS_VISUAIS</span>
            </div>
            <PlayerGallery images={galleryImages} variant="nokia" />
          </div>

          {/* Achievements */}
          <div className="border-2 border-[#111e14] p-1.5 shadow-[1px_1px_0px_#111e14]">
            <div className="font-black mb-2 text-[8px] border-b border-[#111e14]/20 pb-1">REGISTROS_OPERACIONAIS</div>
            <div className="space-y-1.5">
              {ALL_ACHIEVEMENTS.map((ach) => {
                const earned = earnedIds.has(ach.id);
                const isRevealed = profile.character.achievementsRevealed;
                const title = earned || isRevealed ? ach.title : 'BLOQUEADO';
                return (
                  <div key={ach.id} className={`p-2 border border-[#111e14]/30 flex gap-2 items-center ${!earned ? 'opacity-40 border-dashed' : 'bg-[#111e14]/5'}`}>
                    <span className="text-[12px] shrink-0 font-black">{earned ? '[X]' : '[ ]'}</span>
                    <div className="leading-tight truncate">
                      <div className="font-black truncate text-[9px] tracking-tighter">{title}</div>
                      {earned && <div className="text-[7px] truncate opacity-60 mt-0.5 lowercase tracking-tight">{ach.description}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className={`relative w-full h-full bg-[#1e1e1e] rounded-[32px] border-8 border-[#1a1a1a] flex flex-col overflow-hidden z-50 ${
        isLandscape ? 'max-w-none max-h-none' : 'max-w-sm max-h-[750px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-[#333] shrink-0">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center hover:bg-[#444] transition-colors"
        >
          <ArrowLeft size={16} className="text-orange-500" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center shadow-lg glow-orange">
            <span className="text-black font-display font-bold text-sm tracking-tight">{initials || '?'}</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight uppercase">{profile.character.codinome}</span>
        </div>
        <button
          onClick={onLogout}
          className="w-9 h-9 rounded-full bg-[#333] flex items-center justify-center hover:bg-red-900/30 transition-colors"
        >
          <LogOut size={15} className="text-red-500" />
        </button>
      </div>

      {/* Stats Bar */}
      <div className="flex divide-x divide-[#333] bg-[#1a1a1a] shrink-0">
        <div className="flex-1 flex flex-col items-center py-3">
          <span className="text-orange-500 font-bold text-xl">{profile.unlockedIntelIds.length}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Provas</span>
        </div>
        <div className="flex-1 flex flex-col items-center py-3">
          <span className="text-orange-500 font-bold text-xl">{profile.achievementIds.length}</span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Conquistas</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Switching Actions */}
        <div className="px-4 py-4 border-b border-[#333] space-y-3">
          <button 
            onClick={onChangeMission}
            className="w-full flex items-center justify-between p-4 bg-orange-600/10 hover:bg-orange-600/20 active:scale-[0.98] rounded-xl border border-orange-500/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center text-black shadow-lg">
                <MapIcon size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white uppercase tracking-wider">Alternar Missão</div>
                <div className="text-[9px] text-orange-500/60 font-bold uppercase mt-0.5 tracking-tighter">Trocar Realidade Ativa</div>
              </div>
            </div>
            <ArrowLeft size={16} className="text-orange-500 rotate-180 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>

          <button 
            onClick={onChangeCharacter}
            className="w-full flex items-center justify-between p-4 bg-primary/10 hover:bg-primary/20 active:scale-[0.98] rounded-xl border border-primary/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-black shadow-lg">
                <User size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-white uppercase tracking-wider">Trocar Agente</div>
                <div className="text-[9px] text-primary/60 font-bold uppercase mt-0.5 tracking-tighter">Assumir Nova Identidade</div>
              </div>
            </div>
            <ArrowLeft size={16} className="text-primary rotate-180 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Spotify Section */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Music size={14} className="text-[#1DB954]" />
              <h2 className="text-[#1DB954] text-xs font-bold uppercase tracking-widest">Meu Walkman</h2>
            </div>
            {onUpdateSpotify && !isEditingSpotify && (
              <button
                onClick={() => { setIsEditingSpotify(true); setSpotifyInput(profile.character.spotifyPlaylistUrl || ''); }}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#1DB954] transition-colors"
              >
                <Pencil size={10} />
                <span className="uppercase tracking-wider">{embedUrl ? 'Editar' : 'Conectar'}</span>
              </button>
            )}
          </div>
          <AnimatePresence mode="wait">
            {isEditingSpotify ? (
              <motion.div
                key="edit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                <div className="bg-[#242424] border border-[#333] rounded-lg p-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">
                    Cole o link da sua playlist do Spotify
                  </label>
                  <input
                    type="url"
                    value={spotifyInput}
                    onChange={(e) => { setSpotifyInput(e.target.value); setSpotifyError(''); }}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="w-full bg-[#1a1a1a] border border-[#444] rounded-md px-3 py-2 text-base text-white placeholder:text-gray-700 focus:border-[#1DB954] focus:outline-none transition-colors"
                    autoFocus
                  />
                  {spotifyError && (
                    <p className="text-red-400 text-[10px] mt-1">{spotifyError}</p>
                  )}
                  <p className="text-[9px] text-gray-600 mt-1.5 leading-relaxed">
                    Abra o Spotify → Playlist → Compartilhar → Copiar link
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#333] text-gray-400 text-[10px] hover:bg-[#444] transition-colors"
                  >
                    <X size={10} /> Cancelar
                  </button>
                  <button
                    onClick={handleSaveSpotify}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1DB954]/20 text-[#1DB954] text-[10px] border border-[#1DB954]/30 hover:bg-[#1DB954]/30 transition-colors"
                  >
                    <Check size={10} /> Salvar
                  </button>
                </div>
              </motion.div>
            ) : embedUrl ? (
              <motion.div
                key="player"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl overflow-hidden border border-[#333] bg-[#121212] shadow-[0_0_30px_rgba(29,185,84,0.08)]"
              >
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="352"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-xl"
                  style={{ borderRadius: '12px' }}
                  title="Spotify Walkman"
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border border-dashed border-[#333] rounded-lg p-6 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20 flex items-center justify-center mx-auto mb-3">
                  <Music size={22} className="text-[#1DB954]/60" />
                </div>
                <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Nenhuma playlist conectada</p>
                <p className="text-gray-700 text-[10px]">Conecte sua playlist do Spotify para personalizar seu Walkman.</p>
                {onUpdateSpotify && (
                  <button
                    onClick={() => setIsEditingSpotify(true)}
                    className="mt-3 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-full bg-[#1DB954]/15 text-[#1DB954] text-[10px] font-bold uppercase tracking-wider border border-[#1DB954]/25 hover:bg-[#1DB954]/25 transition-all"
                  >
                    <ExternalLink size={10} />
                    Conectar Spotify
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Telefone Section */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <Phone size={14} className="text-orange-500" />
            <h2 className="text-orange-500 text-xs font-bold uppercase tracking-widest">Número de Telefone</h2>
          </div>
          <div className="bg-[#242424] border border-[#333] rounded-lg p-3">
            {profile.character.phoneNumber ? (
              <div className="flex items-center justify-between">
                <span className="text-white text-sm font-mono">{profile.character.phoneNumber}</span>
                <span className="text-[9px] text-orange-500 uppercase font-bold tracking-wider">Ativo</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider block">
                  Você precisa de um número americano para enviar mensagens no grupo.
                </p>
                <button
                  onClick={() => {
                    const num = generateRandomUSPhoneNumber();
                    onUpdatePhoneNumber?.(num);
                  }}
                  className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-black font-bold rounded-lg text-xs uppercase tracking-wider transition-all"
                >
                  Gerar Número Aleatório
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gallery Section */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <Image size={14} className="text-cyan-400" />
            <h2 className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Galeria</h2>
          </div>
          <PlayerGallery images={galleryImages} />
        </div>

        {/* Achievements Section */}
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-orange-500" />
            <h2 className="text-orange-500 text-xs font-bold uppercase tracking-widest">Conquistas</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_ACHIEVEMENTS.map((ach) => {
              const earned = earnedIds.has(ach.id);
              const isRevealed = profile.character.achievementsRevealed;
              const title = earned || isRevealed ? ach.title : 'Conquista Bloqueada';
              const description = earned 
                ? (isRevealed ? `${ach.description} (${ach.unlockCondition})` : ach.description)
                : (isRevealed ? `Como desbloquear: ${ach.unlockCondition}` : 'Permaneça atento e explore mais.');
              return (
                <div
                  key={ach.id}
                  className={`rounded-lg p-3 border flex flex-col gap-1 transition-all ${
                    earned
                      ? 'bg-orange-900/20 border-orange-800/50'
                      : 'bg-[#1a1a1a] border-surface-container-high opacity-50'
                  }`}
                >
                  <span className="text-xl">{earned ? ach.icon : '🔒'}</span>
                  <p className={`text-[11px] font-bold leading-tight wrap-break-word min-w-0 ${earned ? 'text-orange-400' : 'text-gray-600'}`}>
                    {title}
                  </p>
                  <p className="text-[9px] text-gray-500 leading-tight wrap-break-word min-w-0">
                    {description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
