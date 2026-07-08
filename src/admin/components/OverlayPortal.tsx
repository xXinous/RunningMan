import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renderiza overlays (drawers/modais) diretamente em document.body via portal.
 * Necessário porque ancestrais com backdrop-filter/transform criam um novo
 * containing block, quebrando o `position: fixed` (gaveta ficava presa na
 * área rolável em vez de ancorar na viewport). Também trava o scroll do body
 * e fecha o overlay com a tecla Esc (quando onClose é fornecido).
 */
export default function OverlayPortal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
