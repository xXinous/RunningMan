import React from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, onToggleCollapse }: SidebarProps) {
  const groups = [
    {
      title: "Monitoramento",
      items: [
        { id: 'dashboard', label: 'Painel Central', icon: 'monitoring' },
      ]
    },
    {
      title: "Mesa de Jogo",
      items: [
        { id: 'missions', label: 'Missões', icon: 'map' },
        { id: 'players', label: 'Contas & Agentes', icon: 'group' },
        { id: 'squads', label: 'Esquadrões', icon: 'groups' },
      ]
    },
    {
      title: "Conteúdo",
      items: [
        { id: 'intel', label: 'Acervo', icon: 'hub' },
      ]
    },
    {
      title: "Sistema",
      items: [
        { id: 'systems', label: 'Acessos', icon: 'settings_input_component' },
      ]
    }
  ];

  return (
    <aside
      className={clsx(
        "bg-surface-container-low border-r border-primary/10 flex flex-col z-40 overflow-hidden shrink-0 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* SYS_ADMIN Branding */}
      <div className={clsx(
        "border-b border-primary/10 bg-black/20 flex items-center shrink-0 transition-all duration-300",
        isCollapsed ? "px-0 py-5 justify-center" : "px-8 py-6"
      )}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-primary font-display font-bold text-lg leading-none tracking-tighter">S</span>
            <span className="text-white font-display font-bold text-[7px] tracking-[0.2em] uppercase leading-none">ADM</span>
          </div>
        ) : (
          <h1 className="text-2xl font-bold tracking-tighter text-white font-display leading-none whitespace-nowrap">
            SYS<span className="text-primary">_ADMIN</span>
          </h1>
        )}
      </div>

      {/* Navigation */}
      <nav className={clsx(
        "flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300",
        isCollapsed ? "px-2 py-4 space-y-4" : "px-4 py-6 space-y-8"
      )}>
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            {!isCollapsed && (
              <h3 className="px-4 text-[9px] font-display font-bold text-primary/40 uppercase tracking-[0.4em] mb-4 whitespace-nowrap overflow-hidden">
                {group.title}
              </h3>
            )}
            {isCollapsed && (
              <div className="h-px bg-primary/10 mx-2 mb-2" />
            )}
            <div className="space-y-1">
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={clsx(
                    "w-full flex items-center transition-all duration-200 text-left relative group rounded-sm",
                    isCollapsed
                      ? "justify-center px-0 py-3"
                      : "px-4 py-3 gap-3",
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary border-l-2 border-primary" 
                      : "text-industrial-silver/40 hover:bg-white/5 hover:text-industrial-silver/80"
                  )}
                >
                  <span className={clsx(
                    "material-symbols-outlined transition-transform group-hover:scale-110",
                    isCollapsed ? "text-xl" : "text-lg",
                    activeTab === item.id ? "text-primary" : "text-industrial-silver/20"
                  )}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <span className="font-display uppercase font-bold tracking-[0.2em] text-[10px] whitespace-nowrap overflow-hidden">{item.label}</span>
                  )}
                  
                  {activeTab === item.id && !isCollapsed && (
                    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(255,140,0,0.4)]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-primary/10 bg-black/10 shrink-0">
        <button
          onClick={onToggleCollapse}
          className={clsx(
            "w-full flex items-center gap-3 py-4 text-industrial-silver/30 hover:text-primary transition-all hover:bg-white/5 group",
            isCollapsed ? "justify-center px-0" : "px-6"
          )}
          title={isCollapsed ? "Expandir Menu" : "Compactar Menu"}
        >
          {isCollapsed ? (
            <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          ) : (
            <>
              <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="font-display uppercase font-bold tracking-[0.2em] text-[9px] whitespace-nowrap">Compactar</span>
            </>
          )}
        </button>
      </div>

      {/* System Status */}
      {!isCollapsed && (
        <div className="p-4 border-t border-primary/10 bg-black/10 shrink-0">
          <div className="bg-surface-container-lowest border border-primary/5 p-3 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse glow-green shrink-0" />
            <div>
              <p className="text-[8px] text-industrial-silver/60 font-display font-bold tracking-[0.2em] uppercase leading-none">Status do Sistema</p>
              <p className="text-[9px] text-green-500 font-display font-bold tracking-widest uppercase mt-1">Grid_Online</p>
            </div>
          </div>
        </div>
      )}
      {isCollapsed && (
        <div className="p-3 border-t border-primary/10 bg-black/10 flex justify-center shrink-0">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse glow-green" title="Grid Online" />
        </div>
      )}
    </aside>
  );
}
