import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface SearchableItem {
  id: string;
  label: string;
  sublabel?: string;
  category: 'account' | 'agent' | 'tab';
  icon: string;
  action: () => void;
}

interface SpotlightSearchProps {
  open: boolean;
  onClose: () => void;
  items: SearchableItem[];
}

export default function SpotlightSearch({ open, onClose, items }: SpotlightSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 12);
    const q = query.toLowerCase();
    return items.filter(
      (it) => it.label.toLowerCase().includes(q) || (it.sublabel || '').toLowerCase().includes(q)
    ).slice(0, 12);
  }, [items, query]);

  // Group results by category
  const grouped = useMemo(() => {
    const map: Record<string, SearchableItem[]> = {};
    filtered.forEach((it) => {
      if (!map[it.category]) map[it.category] = [];
      map[it.category].push(it);
    });
    return map;
  }, [filtered]);

  const categoryLabel: Record<string, string> = {
    tab: 'NAVEGAÇÃO',
    account: 'CONTAS',
    agent: 'AGENTES',
  };

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleSelect = useCallback((item: SearchableItem) => {
    item.action();
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) handleSelect(filtered[selectedIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIdx, handleSelect, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/85 backdrop-blur-lg p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            className="w-full max-w-lg bg-surface-container-low border border-primary/30 shadow-2xl overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-white/5 bg-black/30">
              <span className="material-symbols-outlined text-primary text-xl">search</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar agentes, contas, seções..."
                className="flex-1 bg-transparent text-white text-sm font-display font-bold outline-none placeholder:text-industrial-silver/20 uppercase tracking-wider"
              />
              <kbd className="text-[9px] font-display font-bold text-industrial-silver/20 bg-black/30 border border-white/5 px-2 py-1 rounded-sm tracking-wider">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-industrial-silver/10 block mb-3">search_off</span>
                  <p className="text-[10px] font-display font-bold text-industrial-silver/20 uppercase tracking-[0.3em]">Nenhum resultado encontrado</p>
                </div>
              ) : (
                Object.entries(grouped).map(([cat, catItems]: [string, SearchableItem[]]) => (
                  <div key={cat}>
                    <div className="px-6 py-2 bg-black/20">
                      <span className="text-[9px] font-display font-bold text-primary/40 uppercase tracking-[0.3em]">{categoryLabel[cat] || cat}</span>
                    </div>
                    {catItems.map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      const isSelected = globalIdx === selectedIdx;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIdx(globalIdx)}
                          className={`w-full flex items-center gap-4 px-6 py-3.5 transition-all text-left ${
                            isSelected ? 'bg-primary/10 text-primary' : 'text-industrial-silver/50 hover:bg-white/5'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-lg ${isSelected ? 'text-primary' : 'text-industrial-silver/15'}`}>{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[11px] font-display font-bold uppercase tracking-widest truncate ${isSelected ? 'text-white' : ''}`}>{item.label}</p>
                            {item.sublabel && <p className="text-[9px] font-mono text-industrial-silver/25 truncate mt-0.5">{item.sublabel}</p>}
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-display font-bold text-primary/40 tracking-wider">ENTER ↵</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between">
              <div className="flex gap-4">
                <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">↑↓ Navegar</span>
                <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">↵ Selecionar</span>
              </div>
              <span className="text-[8px] font-display font-bold text-industrial-silver/15 uppercase tracking-widest">{filtered.length} resultados</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Build searchable items from accounts, characters, and tabs
export function buildSearchItems(
  accounts: { uid: string; email?: string; masterName?: string }[],
  characters: { uid: string; char: { id: string; codinome?: string } }[],
  setActiveTab: (tab: string) => void,
  onSelectAccount?: (uid: string) => void,
  onSelectAgent?: (uid: string, charId: string) => void,
): SearchableItem[] {
  const items: SearchableItem[] = [];

  // Navigation tabs
  const tabs = [
    { id: 'dashboard', label: 'Painel Central', icon: 'monitoring' },
    { id: 'missions', label: 'Missões', icon: 'map' },
    { id: 'players', label: 'Agentes', icon: 'group' },
    { id: 'inventory', label: 'Inventário', icon: 'inventory_2' },
    { id: 'intel', label: 'Acervo', icon: 'hub' },
    { id: 'systems', label: 'Acessos', icon: 'settings_input_component' },
  ];
  tabs.forEach((t) => {
    items.push({ id: `tab_${t.id}`, label: t.label, category: 'tab', icon: t.icon, action: () => setActiveTab(t.id) });
  });

  // Accounts
  accounts.forEach((acc) => {
    items.push({
      id: `acc_${acc.uid}`,
      label: acc.masterName || acc.email || acc.uid,
      sublabel: acc.email,
      category: 'account',
      icon: 'person',
      action: () => { setActiveTab('players'); onSelectAccount?.(acc.uid); },
    });
  });

  // Characters
  characters.forEach(({ uid, char }) => {
    items.push({
      id: `char_${char.id}`,
      label: char.codinome || char.id,
      sublabel: `UID: ${uid.slice(0, 12)}...`,
      category: 'agent',
      icon: 'badge',
      action: () => { setActiveTab('players'); onSelectAgent?.(uid, char.id); },
    });
  });

  return items;
}
