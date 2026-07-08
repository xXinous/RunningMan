/**
 * @deprecated Use IntelDistributionDrawer. Mantido para compatibilidade.
 */
import IntelDistributionDrawer, {
  type IntelDistributionDrawerProps,
} from './IntelDistributionDrawer';

interface BulkInventoryModalProps {
  uid?: string;
  character?: IntelDistributionDrawerProps['character'];
  title?: string;
  existingItemIds?: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
  onExecuteBulk?: (selectedIds: Set<string>) => Promise<void>;
}

export default function BulkInventoryModal({
  uid,
  character,
  title,
  existingItemIds,
  onClose,
  onSuccess,
  onExecuteBulk,
}: BulkInventoryModalProps) {
  return (
    <IntelDistributionDrawer
      uid={uid}
      character={character}
      title={title}
      existingItemIds={existingItemIds}
      onClose={onClose}
      onSuccess={onSuccess}
      onExecuteGrant={onExecuteBulk}
    />
  );
}

export type { BulkInventoryModalProps };
