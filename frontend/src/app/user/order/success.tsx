import React from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

const WARNING = '#F1C40F';

const PRIMARY = '#0F5B57';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const BG = '#F5F7F7';
const SURFACE = '#FFFFFF';
const SUCCESS = '#27AE60';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

function normalizeParam(v: string | string[] | undefined): string {
  if (v == null) return '';
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' ? s.trim() : '';
}

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = normalizeParam(params.orderId as string | string[] | undefined);
  const paymentMethod = normalizeParam(params.paymentMethod as string | string[] | undefined);
  const isBankTransfer = paymentMethod === 'Bank Transfer';
  const verificationPending = normalizeParam(params.verificationPending as string | string[] | undefined) === '1';
  const submissionIdRaw = normalizeParam(params.submissionId as string | string[] | undefined);
  const submissionRefTail =
    submissionIdRaw.length >= 6 ? submissionIdRaw.slice(-6).toUpperCase() : submissionIdRaw.toUpperCase();

  const titleText = verificationPending
    ? 'Your transaction is verifying'
    : isBankTransfer
      ? 'Transfer submitted'
      : 'Order Placed Successfully!';

  const subtitleText = verificationPending
    ? 'Your bank slip was received successfully. Stall staff are reviewing your payment — we will notify you once verification is complete and your order is placed.'
    : isBankTransfer
      ? 'Your payment is being verified by stall staff. You will be notified when your transfer is approved and your order is confirmed.'
      : 'Your order has been received and is being processed.';

  const showSubmissionRef = verificationPending && submissionRefTail.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View
          style={[
            styles.iconContainer,
            isBankTransfer || verificationPending ? styles.iconShadowBank : styles.iconShadowSuccess,
          ]}>
          <MaterialCommunityIcons
            name={isBankTransfer || verificationPending ? 'clock-outline' : 'check-circle'}
            size={100}
            color={isBankTransfer || verificationPending ? WARNING : SUCCESS}
          />
        </View>

        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.subtitle}>{subtitleText}</Text>

        {showSubmissionRef ? (
          <View style={styles.orderIdCard}>
            <Text style={styles.orderIdLabel}>Reference</Text>
            <Text style={styles.orderIdValue}>{submissionRefTail}</Text>
            <Text style={styles.referenceHint}>Show this reference if stall staff ask for your submission.</Text>
          </View>
        ) : !verificationPending ? (
          <View style={styles.orderIdCard}>
            <Text style={styles.orderIdLabel}>Order ID</Text>
            <Text style={styles.orderIdValue}>{orderId || 'ORD-000-000'}</Text>
          </View>
        ) : null}

        <Text style={styles.infoText}>
          {verificationPending ? (
            <>
              You do not have a pickup order yet. After staff approve your transfer, your order will appear under My Orders.
              {'\n'}
              <Text style={styles.verifyFootnote}>If something looks wrong with your slip, staff may reject it — check back or submit again from checkout.</Text>
            </>
          ) : isBankTransfer ? (
            'Keep this order reference handy. Pull to refresh on My Orders for updates.'
          ) : (
            'Please show this Order ID at the stall counter when you pickup your meal.'
          )}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.doneBtn} 
          onPress={() => router.replace('/user/dashboard')}
        >
          <Text style={styles.doneBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ordersBtn} onPress={() => router.replace('/user/orders')}>
          <Text style={styles.ordersBtnText}>View My Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    marginBottom: 24,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  iconShadowSuccess: {
    shadowColor: SUCCESS,
  },
  iconShadowBank: {
    shadowColor: WARNING,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_GRAY,
    textAlign: 'center',
    marginTop: 12,
  },
  orderIdCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginTop: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  orderIdLabel: {
    fontSize: 14,
    color: TEXT_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  orderIdValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY,
    marginTop: 8,
  },
  referenceHint: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 14,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  verifyFootnote: {
    color: TEXT_GRAY,
    fontWeight: '600',
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
  },
  infoText: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  doneBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ordersBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ordersBtnText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
