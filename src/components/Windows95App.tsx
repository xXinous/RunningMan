import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { checkMacClosed } from '../store/firestore';
import { activityLogger } from '../services/ActivityLogger';
import { useLandscapeLayout } from '../player/hooks/useLandscapeLayout';
import DiskRepairApp from './DiskRepairApp';

interface Windows95AppProps {
  uid: string;
  onClose: () => void;
}

type WindowType = 'myComputer' | 'diskRepair' | 'recycleBin';

export default function Windows95App({ uid, onClose }: Windows95AppProps) {
  const { isLandscape, viewportHeight } = useLandscapeLayout();
  const [activeWindows, setActiveWindows] = useState<WindowType[]>([]);
  const [focusedWindow, setFocusedWindow] = useState<WindowType | null>(null);
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleWindow = (type: WindowType) => {
    if (activeWindows.includes(type)) {
      setFocusedWindow(type);
    } else {
      activityLogger.logAction('windows95', `Abriu janela: ${getWindowLabel(type)}`, { window: type });
      setActiveWindows(prev => [...prev, type]);
      setFocusedWindow(type);
    }
    setStartMenuOpen(false);
  };

  const closeWindow = (type: WindowType) => {
    activityLogger.logAction('windows95', `Fechou janela: ${getWindowLabel(type)}`, { window: type });
    setActiveWindows(prev => prev.filter(w => w !== type));
    if (focusedWindow === type) setFocusedWindow(null);
  };

  const handleShutdown = async () => {
    activityLogger.logAction('windows95', 'Solicitou desligamento do Windows 95');
    await checkMacClosed(uid); 
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#008080] font-sans overflow-hidden select-none touch-none text-black player-viewport">
      <style>{`
        @font-face {
          font-family: 'Win95';
          src: url('https://fonts.cdnfonts.com/css/w95fa') format('woff2');
        }
        .win95-font { font-family: 'MS Sans Serif', 'Win95', sans-serif; }
        .win95-border-out {
          box-shadow: inset 1px 1px #fff, inset -1px -1px #0a0a0a, inset -2px -2px #808080;
          border: 1px solid #dfdfdf;
        }
        .win95-border-in {
          box-shadow: inset 1px 1px #0a0a0a, inset -1px -1px #fff;
          border: 1px solid #808080;
        }
        .win95-button {
          background: #c0c0c0;
          box-shadow: inset 1px 1px #dfdfdf, inset 2px 2px #fff, inset -1px -1px #0a0a0a, inset -2px -2px #808080;
          border: 1px solid #0a0a0a;
        }
        .win95-button:active {
          box-shadow: inset 1px 1px #0a0a0a, inset 2px 2px #808080, inset -1px -1px #dfdfdf, inset -2px -2px #fff;
          padding: 2px 0 0 2px;
        }
        .start-menu-sidebar {
            background: linear-gradient(to top, #000080, #1084d0);
            width: 24px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-bottom: 8px;
        }
        .start-menu-text {
            color: #fff;
            font-weight: bold;
            transform: rotate(-90deg);
            white-space: nowrap;
            margin-bottom: 24px;
            font-size: 14px;
        }
      `}</style>

      {/* Desktop Icons */}
      <div
        className={`flex-1 p-4 pointer-events-none min-h-0 ${
          isLandscape ? 'flex flex-row flex-wrap gap-4 items-start content-start' : 'flex flex-col gap-4'
        }`}
      >
        <DesktopIcon icon="💻" label="Meu Computador" onClick={() => toggleWindow('myComputer')} />
        <DesktopIcon icon="🗑️" label="Lixeira" onClick={() => toggleWindow('recycleBin')} />
        <DesktopIcon icon="💾" label="DiskRepair Pro" onClick={() => toggleWindow('diskRepair')} />
      </div>

      {/* Windows Layer */}
      <div
        className={`absolute inset-0 pointer-events-none flex pb-10 ${
          isLandscape ? 'items-start justify-start pt-2 pl-2' : 'items-center justify-center'
        }`}
      >
        <AnimatePresence>
          {activeWindows.map((win, index) => (
            <Window
              key={win}
              type={win}
              isFocused={focusedWindow === win}
              onFocus={() => setFocusedWindow(win)}
              onClose={() => closeWindow(win)}
              uid={uid}
              isLandscape={isLandscape}
              viewportHeight={viewportHeight}
              stackIndex={index}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Taskbar */}
      <div className="h-10 bg-[#c0c0c0] border-t-2 border-white flex items-center px-1 gap-1 z-50">
        <button 
          onClick={() => setStartMenuOpen(!startMenuOpen)}
          className={`win95-button h-8 px-2 flex items-center gap-1 font-bold text-sm ${startMenuOpen ? 'bg-[#dfdfdf] shadow-[inset_1px_1px_#0a0a0a]' : ''}`}
        >
          <span className="text-lg">🪟</span> Iniciar
        </button>
        
        <div className="flex-1 flex gap-1 h-8 overflow-hidden mx-1">
          {activeWindows.map(win => (
            <button 
              key={win}
              onClick={() => setFocusedWindow(win)}
              className={`win95-button h-full px-2 text-xs text-left min-w-[100px] truncate ${focusedWindow === win ? 'shadow-[inset_1px_1px_#0a0a0a] bg-[#dfdfdf]' : ''}`}
            >
              <span className="mr-1">{win === 'diskRepair' ? '💾' : win === 'recycleBin' ? '🗑️' : '💻'}</span>
              {getWindowLabel(win)}
            </button>
          ))}
        </div>

        {/* System Tray */}
        <div className="win95-border-in h-8 px-2 flex items-center gap-2 text-[11px] min-w-[70px] justify-center bg-[#c0c0c0]">
          <span>🔊</span>
          <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Start Menu */}
      <AnimatePresence>
        {startMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setStartMenuOpen(false)} />
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              className="absolute bottom-10 left-0 w-60 max-h-[calc(100dvh-2.5rem)] bg-[#c0c0c0] win95-border-out z-50 p-0.5 flex overflow-hidden"
            >
              <div className="start-menu-sidebar shrink-0">
                <span className="start-menu-text">Windows 95</span>
              </div>
              <div className="flex-1 py-1 overflow-y-auto min-h-0">
                <StartOption icon="💻" label="Programas" subMenu />
                <StartOption icon="📂" label="Documentos" subMenu />
                <StartOption icon="⚙️" label="Configurações" subMenu />
                <StartOption icon="🔍" label="Localizar" subMenu />
                <StartOption icon="❓" label="Ajuda" />
                <StartOption icon="🏃" label="Executar..." />
                <div className="h-px bg-[#808080] border-b border-white my-1 mx-1" />
                <StartOption icon="🚪" label="Desligar..." onClick={handleShutdown} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DesktopIcon({ icon, label, onClick, labelOnLight }: { icon: string, label: string, onClick: () => void, labelOnLight?: boolean }) {
  return (
    <div 
      className="w-20 flex flex-col items-center gap-1 cursor-pointer group pointer-events-auto active:opacity-70"
      onClick={onClick}
    >
      <div className="text-4xl">{icon}</div>
      <span
        className={
          labelOnLight
            ? 'text-[11px] text-black text-center leading-tight bg-transparent px-1 group-active:bg-[#000080] group-active:text-white selection:bg-[#000080] selection:text-white'
            : 'text-[11px] text-white text-center leading-tight bg-transparent group-active:bg-[#000080] px-1 selection:bg-[#000080]'
        }
      >
        {label}
      </span>
    </div>
  );
}

function StartOption({ icon, label, onClick, subMenu }: { icon: string, label: string, onClick?: () => void, subMenu?: boolean }) {
  return (
    <div 
      className="flex items-center gap-3 px-4 py-1.5 hover:bg-[#000080] hover:text-white cursor-pointer group"
      onClick={onClick}
    >
      <span className="text-xl w-6 flex justify-center">{icon}</span>
      <span className="text-[11px] font-medium">{label}</span>
      {subMenu && <span className="ml-auto text-[8px]">▶</span>}
    </div>
  );
}

const Window: React.FC<{
  type: WindowType;
  isFocused: boolean;
  onFocus: () => void;
  onClose: () => void;
  uid: string;
  isLandscape: boolean;
  viewportHeight: number;
  stackIndex: number;
}> = ({ type, isFocused, onFocus, onClose, uid, isLandscape, viewportHeight, stackIndex }) => {
  const maxWindowHeight = Math.min(480, Math.max(200, viewportHeight - 48));
  const minHeight = isLandscape ? 200 : 300;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className={`absolute w-[90%] max-w-lg bg-[#c0c0c0] win95-border-out pointer-events-auto flex flex-col min-h-0`}
      style={{
        zIndex: isFocused ? 45 : 35,
        minHeight,
        maxHeight: maxWindowHeight,
        top: isLandscape ? 8 + stackIndex * 24 : undefined,
        left: isLandscape ? 8 + stackIndex * 24 : undefined,
      }}
      onPointerDown={onFocus}
    >
      {/* Window Title Bar */}
      <div className={`h-[22px] flex items-center px-1 gap-1 ${isFocused ? 'bg-linear-to-r from-[#000080] to-[#1084d0]' : 'bg-[#808080]'}`}>
        <span className="text-xs px-1">{type === 'diskRepair' ? '💾' : type === 'recycleBin' ? '🗑️' : '💻'}</span>
        <span className="text-white font-bold text-[11px] flex-1 truncate select-none">{getWindowLabel(type)}</span>
        <div className="flex gap-1 h-4 py-0.5">
          <button className="win95-button w-4 h-4 text-[7px] flex items-center justify-center font-bold">_</button>
          <button className="win95-button w-4 h-4 text-[7px] flex items-center justify-center font-bold">□</button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="win95-button w-4 h-4 text-[10px] flex items-center justify-center font-bold pb-0.5"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      <div className="flex px-1 gap-3 text-[11px] h-5 items-center">
        <span className="hover:win95-border-in px-1 cursor-default">Arquivo</span>
        <span className="hover:win95-border-in px-1 cursor-default">Editar</span>
        <span className="hover:win95-border-in px-1 cursor-default">Exibir</span>
        <span className="hover:win95-border-in px-1 cursor-default">Ajuda</span>
      </div>

      {/* Window Content */}
      <div className="flex-1 min-h-0 bg-white m-0.5 win95-border-in overflow-auto p-4 flex flex-col">
        {type === 'myComputer' && (
          <div className={`grid gap-4 ${isLandscape ? 'grid-cols-2' : 'grid-cols-3 gap-6'}`}>
            <DesktopIcon icon="💽" label="Disco Local (C:)" onClick={() => {}} labelOnLight />
            <DesktopIcon icon="💿" label="Drive CD (D:)" onClick={() => {}} labelOnLight />
            <DesktopIcon icon="💾" label="Disquete (A:)" onClick={() => {}} labelOnLight />
          </div>
        )}
        
        {type === 'diskRepair' && <DiskRepairApp uid={uid} isWindowed />}

        {type === 'recycleBin' && (
          <div className="flex flex-col items-center justify-center py-12 opacity-30">
            <span className="text-6xl mb-4">🗑️</span>
            <span className="text-sm font-bold">A Lixeira está vazia.</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};


function getWindowLabel(type: WindowType): string {
  switch (type) {
    case 'myComputer': return 'Meu Computador';
    case 'diskRepair': return 'DiskRepair Pro';
    case 'recycleBin': return 'Lixeira';
    default: return 'Janela';
  }
}
