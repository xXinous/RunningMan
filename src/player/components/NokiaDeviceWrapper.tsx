import React, { useState, useEffect } from 'react';
import { useLandscapeLayout } from '../hooks/useLandscapeLayout';
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
  onTerminalOpen?: () => void;
  hasTerminalAccess?: boolean;
}

function NavButton({
  onClick,
  disabled,
  icon,
  label,
  vertical,
}: {
  onClick?: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  vertical?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border border-[#111e14] rounded hover:bg-[#111e14] hover:text-[#edfeed] transition-all duration-100 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
        vertical
          ? 'w-full py-2 flex flex-col items-center justify-center gap-0.5 min-h-[44px]'
          : 'px-3 py-1.5 flex items-center gap-1'
      }`}
    >
      <span className="text-[10px] font-black">{icon}</span>
      <span className={`font-black tracking-tight uppercase ${vertical ? 'text-[8px]' : 'text-[10px]'}`}>{label}</span>
    </button>
  );
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
  onTerminalOpen,
  hasTerminalAccess,
}: NokiaDeviceWrapperProps) {
  const { isLandscape } = useLandscapeLayout();
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

  const navButtons = (
    <>
      {backVisible !== false ? (
        <NavButton onClick={onBack} icon="&lt;-" label="Voltar" vertical={isLandscape} />
      ) : (
        <div className={`opacity-0 pointer-events-none ${isLandscape ? 'py-2' : 'px-4 py-1.5'}`}>
          <NavButton icon="&lt;-" label="Voltar" vertical={isLandscape} />
        </div>
      )}

      <NavButton
        onClick={() => setScreen('player')}
        disabled={screen === 'player'}
        icon="[*]"
        label="Inicio"
        vertical={isLandscape}
      />

      <NavButton
        onClick={onToggleMute}
        icon={isMuted ? '[X]' : '[~]'}
        label={isMuted ? 'Mudo' : 'Som'}
        vertical={isLandscape}
      />

      {hasTerminalAccess && onTerminalOpen && (
        <NavButton onClick={onTerminalOpen} icon="[>]" label="DOS" vertical={isLandscape} />
      )}

      {onProfileOpen && (
        <NavButton onClick={onProfileOpen} icon="[#]" label="Dossie" vertical={isLandscape} />
      )}
    </>
  );

  return (
    <div className="absolute inset-0 w-full h-full bg-[#edfeed] p-2 sm:p-4 z-50 flex items-center justify-center overflow-hidden player-viewport">
      <div
        className={`w-full h-full bg-[#edfeed] rounded-xl border-[4px] border-[#111e14] relative shadow-[inset_0_4px_16px_rgba(0,0,0,0.45)] overflow-hidden max-w-4xl mx-auto ${
          isLandscape && !isScanning ? 'flex flex-row' : 'flex flex-col'
        }`}
      >
        <div
          id="nokia-lcd-screen-inner"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          className={`w-full h-full bg-[#edfeed] text-[#111e14] overflow-hidden relative select-none nokia-theme-active ${
            isLandscape && !isScanning ? 'flex flex-row min-h-0' : 'flex flex-col justify-between'
          }`}
        >
          <div className="absolute inset-0 border border-[#111e14]/15 pointer-events-none z-20" />

          {!isScanning && isLandscape && (
            <div className="w-12 shrink-0 flex flex-col justify-around items-stretch bg-[#edfeed] border-r-2 border-[#111e14] py-2 px-1 gap-1 z-20 select-none text-[#111e14]">
              {navButtons}
            </div>
          )}

          <div className={`flex flex-col min-h-0 min-w-0 ${isLandscape && !isScanning ? 'flex-1' : 'h-full'}`}>
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

            <div className="flex-grow overflow-hidden relative p-2 flex flex-col min-h-0">{children}</div>

            {!isScanning && !isLandscape && (
              <div className="flex justify-around items-center bg-[#edfeed] border-t-2 border-[#111e14] py-2 text-[12px] font-bold z-20 h-[44px] select-none text-[#111e14] shrink-0">
                {navButtons}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
