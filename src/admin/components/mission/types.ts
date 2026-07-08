export type MissionTabId = 'dados' | 'vinculos' | 'inventario' | 'transmissao';

export const MISSION_TAB_LABELS: Record<MissionTabId, string> = {
  dados: 'Dados',
  vinculos: 'Vínculos',
  inventario: 'Inventário',
  transmissao: 'Transmissão',
};
