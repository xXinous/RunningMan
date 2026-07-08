import React, { useState, useEffect } from 'react';
import type { AppScreen, WalkmanStatus } from '../../types/player';

export interface NokiaDeviceWrapperProps {
  children: React.ReactNode;
  status: WalkmanStatus;
  volume: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onBack: () => void;
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;
  backVisible?: boolean;
  onProfileOpen?: () => void;
}

export default function NokiaDeviceWrapper({
  children,
  status,
  volume,
  isMuted,
  onToggleMute,
  onBack,
  screen,
  setScreen,
  backVisible,
  onProfileOpen,
}: NokiaDeviceWrapperProps) {
  const [systemTime, setSystemTime] = useState('12:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const isScanning = status === 'SCANNING';
  const signalBarsCount = Math.ceil((volume / 100) * 5);

  return (
    <div className="absolute inset-0 w-full h-full bg-[#edfeed] p-2 sm:p-4 z-50 flex items-center justify-center overflow-hidden">
      <div className="w-full h-full bg-[#edfeed] rounded-xl border-[4px] border-[#111e14] relative shadow-[inset_0_4px_16px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col max-w-4xl mx-auto">
        <div
          id="nokia-lcd-screen-inner"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          className="w-full h-full bg-[#edfeed] text-[#111e14] flex flex-col justify-between overflow-hidden relative select-none nokia-theme-active"
        >
          <div className="absolute inset-0 border border-[#111e14]/15 pointer-events-none z-20" />

          {!isScanning && (
            <div className="flex justify-between items-center bg-[#edfeed] px-2 border-b border-[#111e14] py-1 text-[12px] font-bold h-[24px] select-none z-10 leading-none shrink-0">
              <div className="flex items-end gap-[1px] h-[10px]" title="Signal">
                <span className="text-[10px] leading-none pr-[2px] font-black">HP</span>
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`w-[2px] ${signalBarsCount >= level ? 'bg-[#111e14]' : 'bg-[#111e14]/10'}`}
                    style={{ height: `${level * 2 + 2}px` }}
                  />
                ))}
              </div>

              <span className="tracking-wide text-[12px] tabular-nums">{systemTime}</span>

              <div className="flex items-center gap-[2px]">
                <span className="text-[10px] pr-[2px] font-black">MP</span>
                <div className="flex items-center border border-[#111e14] p-[1px] rounded-[1px] w-[18px] h-[10px]">
                  <div className="bg-[#111e14] h-full w-[75%]" />
                </div>
                <div className="w-[1px] h-[4px] bg-[#111e14] -ml-[1px]" />
              </div>
            </div>
          )}

          <div className="flex-grow overflow-hidden relative p-2 flex flex-col min-h-0">
            {children}
          </div>

          {!isScanning && (
            <div className="flex justify-around items-center bg-[#edfeed] border-t-2 border-[#111e14] py-2 text-[12px] font-bold z-20 h-[44px] select-none text-[#111e14] shrink-0">
              {backVisible !== false ? (
                <button
                  onClick={onBack}
                  className="px-4 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="text-[10px] font-black">&lt;-</span>{' '}
                  <span className="text-[10px] tracking-tight uppercase">Voltar</span>
                </button>
              ) : (
                <div className="px-4 py-1.5 opacity-0 pointer-events-none flex items-center gap-1.5">
                  <span className="text-[10px] font-black">&lt;-</span>{' '}
                  <span className="text-[10px] tracking-tight uppercase">Voltar</span>
                </div>
              )}

              <button
                onClick={() => setScreen('player')}
                disabled={screen === 'player'}
                className={`px-4 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1.5 ${
                  screen === 'player' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <span className="text-[10px] font-black">[*]</span>{' '}
                <span className="text-[10px] tracking-tight uppercase">Inicio</span>
              </button>

              <button
                onClick={onToggleMute}
                className="px-3 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <span className="text-[10px] font-black">{isMuted ? '[X]' : '[~]'}</span>
                <span className="text-[10px] tracking-tight uppercase">{isMuted ? 'Mudo' : 'Som'}</span>
              </button>

              {onProfileOpen && (
                <button
                  onClick={onProfileOpen}
                  className="px-3 py-1.5 border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span className="text-[10px] font-black">[#]</span>
                  <span className="text-[10px] tracking-tight uppercase">Dossie</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
