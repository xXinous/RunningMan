import { useCallback, useEffect, useState } from 'react';

const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px)';

function getViewportHeight(): number {
  if (typeof window === 'undefined') return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

function getIsLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(LANDSCAPE_QUERY).matches;
}

export function useLandscapeLayout() {
  const [isLandscape, setIsLandscape] = useState(getIsLandscape);
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);

  const update = useCallback(() => {
    setIsLandscape(getIsLandscape());
    setViewportHeight(getViewportHeight());
  }, []);

  useEffect(() => {
    update();

    const mq = window.matchMedia(LANDSCAPE_QUERY);
    mq.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [update]);

  return { isLandscape, viewportHeight };
}
