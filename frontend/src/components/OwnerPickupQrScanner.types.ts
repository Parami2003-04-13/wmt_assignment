export type OwnerPickupQrScannerModalProps = {
  visible: boolean;
  expectedOrderId: string;
  onClose: () => void;
  onMatched: (rawPayload: string) => void;
};
