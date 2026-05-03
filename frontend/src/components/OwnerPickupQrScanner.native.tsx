import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Text as RNText,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { pickupCodeMatchesOrder } from '../utils/pickupVerification';
import type { OwnerPickupQrScannerModalProps } from './OwnerPickupQrScanner.types';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

const PRIMARY = '#0F5B57';
const TEXT_DARK = '#2D3436';

export function OwnerPickupQrScannerModal({
  visible,
  expectedOrderId,
  onClose,
  onMatched,
}: OwnerPickupQrScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (visible) setHandled(false);
  }, [visible]);

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (handled) return;
      if (pickupCodeMatchesOrder(expectedOrderId, data)) {
        setHandled(true);
        onMatched(data);
        onClose();
      } else {
        Alert.alert('Invalid QR', 'This code does not match this order.');
      }
    },
    [expectedOrderId, handled, onClose, onMatched]
  );

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.scanRoot}>
        {!permission?.granted ? (
          <SafeAreaView style={styles.permBox} edges={['top', 'bottom']}>
            <Text style={styles.permTitle}>Camera access</Text>
            <Text style={styles.permHint}>Camera is needed to scan the customer&apos;s pickup QR.</Text>
            <TouchableOpacity style={styles.permBtn} onPress={() => requestPermission()}>
              <Text style={styles.permBtnText}>Allow camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeGhost} onPress={onClose}>
              <Text style={styles.closeGhostText}>Cancel</Text>
            </TouchableOpacity>
          </SafeAreaView>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handled ? undefined : onBarcodeScanned}
            />
            <SafeAreaView style={styles.overlayTop} edges={['top']}>
              <TouchableOpacity style={styles.closeFab} onPress={onClose} hitSlop={12}>
                <MaterialCommunityIcons name="close" size={26} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.hint}>Point the camera at the order QR</Text>
            </SafeAreaView>
            {handled ? (
              <View style={styles.loadingMask}>
                <ActivityIndicator color="#fff" size="large" />
              </View>
            ) : null}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scanRoot: { flex: 1, backgroundColor: '#000' },
  overlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  permBox: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: TEXT_DARK, marginBottom: 8 },
  permHint: { fontSize: 15, color: '#636E72', marginBottom: 24 },
  permBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  closeGhost: { marginTop: 16, alignItems: 'center', padding: 12 },
  closeGhostText: { color: PRIMARY, fontWeight: '700' },
  loadingMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
