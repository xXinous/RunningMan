import { useMemo, useEffect, useRef } from 'react';
import { IntelManager, VisualIntel } from '../../services/IntelEngine';
import { intelService } from '../../services/IntelService';
import type { PlayerData, WalkmanStatus, GalleryImage } from '../../types/player';
import type { PlayerIntelCollection } from '../../types/intel';
import type { Dispatch, SetStateAction } from 'react';

export function usePlayerIntel(
  playerData: PlayerData | null,
  intelCollection: PlayerIntelCollection | null,
  setIntelCollection: Dispatch<SetStateAction<PlayerIntelCollection | null>>,
  setWalkmanStatus: Dispatch<SetStateAction<WalkmanStatus>>
) {
  const isInitialIntelLoad = useRef(true);

  const intelManager = useMemo(() => {
    if (!intelCollection?.items) return null;
    return new IntelManager(intelCollection.items);
  }, [intelCollection]);

  const intelIdsKey = playerData?.unlockedIntelIds?.join(',') ?? '';

  useEffect(() => {
    if (!playerData) return;

    const fetchIntel = async () => {
      if (isInitialIntelLoad.current) {
        // Feedback de loading no visor apenas se o walkman estiver ocioso;
        // não sobrescreve SCANNING/PLAYING nem inventa fita (volta para IDLE).
        setWalkmanStatus((prev) => (prev === 'IDLE' ? 'LOADING' : prev));
      }
      try {
        const collection = await intelService.getCollection(playerData);
        setIntelCollection(collection);
      } catch (error) {
        console.error('[PlayerIntel] Error during Intel Fetch:', error);
      } finally {
        if (isInitialIntelLoad.current) {
          setWalkmanStatus((prev) => (prev === 'LOADING' ? 'IDLE' : prev));
          isInitialIntelLoad.current = false;
        }
      }
    };

    fetchIntel();
  }, [playerData?.activeCharacterId, intelIdsKey, setIntelCollection, setWalkmanStatus]);

  useEffect(() => {
    if (!playerData) {
      isInitialIntelLoad.current = true;
    }
  }, [playerData?.activeCharacterId]);

  const visualGalleryImages = useMemo((): GalleryImage[] => {
    return (
      intelManager
        ?.getAll()
        .filter((i): i is VisualIntel => i.type === 'VISUAL')
        .map(
          (i) =>
            ({
              id: i.id,
              title: i.title,
              description: i.description || '',
              imageUrl: i.mediaUrl,
              category: 'pistas',
              level: i.level || 1,
            }) as GalleryImage
        ) ?? []
    );
  }, [intelManager]);

  return { intelManager, visualGalleryImages };
}
