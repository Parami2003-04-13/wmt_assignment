import React from 'react';
import { Platform } from 'react-native';
import type { OwnerPickupQrScannerModalProps } from './OwnerPickupQrScanner.types';

/** Web: no scanner (manual order number only). Native: full-screen QR scan. */
export function OwnerPickupQrScannerModal(props: OwnerPickupQrScannerModalProps) {
  if (Platform.OS === 'web') return null;
  const NativeModal = (
    require('./OwnerPickupQrScanner.native') as typeof import('./OwnerPickupQrScanner.native')
  ).OwnerPickupQrScannerModal;
  return <NativeModal {...props} />;
}
