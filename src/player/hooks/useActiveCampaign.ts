import { useState, useEffect, useMemo } from 'react';
import { campaignService } from '../../services/CampaignService';
import type { Campaign } from '../../data/campaigns';
import type { PlayerData } from '../../types/player';

/**
 * Contrato universal de capacidades de dispositivo.
 * O motor de playback consulta capacidades, nunca o tipo do dispositivo:
 * um dispositivo futuro só precisa declarar o que suporta aqui.
 */
export interface DeviceCapabilities {
  supportsVideo: boolean;
}

const DEVICE_CAPABILITIES: Record<NonNullable<Campaign['playerType']>, DeviceCapabilities> = {
  walkman: { supportsVideo: false },
  nokia: { supportsVideo: true },
};

export function getDeviceCapabilities(playerType: Campaign['playerType']): DeviceCapabilities {
  return DEVICE_CAPABILITIES[playerType ?? 'walkman'];
}

export function useActiveCampaign(playerData: PlayerData | null) {
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (!playerData?.character?.campaignId) {
      setActiveCampaign(null);
      return;
    }
    return campaignService.subscribeToActiveCampaigns((list) => {
      const found = list.find((c) => c.id === playerData.character.campaignId);
      if (found) {
        setActiveCampaign(found);
      }
    });
  }, [playerData?.character?.campaignId]);

  const isNokiaTheme = playerData !== null && activeCampaign?.playerType === 'nokia';
  const deviceCapabilities = useMemo(
    () => getDeviceCapabilities(activeCampaign?.playerType),
    [activeCampaign?.playerType]
  );

  return { activeCampaign, isNokiaTheme, deviceCapabilities };
}

export function useShowNokiaShell(isNokiaTheme: boolean, screen: string) {
  return useMemo(
    () => isNokiaTheme && (screen === 'player' || screen === 'profile'),
    [isNokiaTheme, screen]
  );
}
