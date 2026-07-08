import React from 'react';
import IntelCreatorPanel from './IntelCreatorPanel';

interface AcervoPanelProps {
  /** Quando true, omite o container externo (uso dentro do Dashboard). */
  embedded?: boolean;
}

export default function AcervoPanel({ embedded = false }: AcervoPanelProps) {
  if (embedded) return <IntelCreatorPanel />;
  return (
    <div className="bg-surface-container-low border border-primary/20 overflow-hidden rounded-sm shadow-xl">
      <div className="p-4 sm:p-8">
        <IntelCreatorPanel />
      </div>
    </div>
  );
}
