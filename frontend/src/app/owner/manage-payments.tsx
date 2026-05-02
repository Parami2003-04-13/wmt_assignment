import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../services/api';
import { COLORS as THEME_COLORS } from '../../theme/colors';
import dayjs from 'dayjs';

const PRIMARY = '#0F5B57';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const BG = '#F5F7F7';
const SURFACE = '#FFFFFF';
const SUCCESS = '#27AE60';
const WARNING = '#F1C40F';
const DANGER = '#E74C3C';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

export default function ManagePaymentsScreen() {
  const router = useRouter();
  const { stallId, stallName } = useLocalSearchParams();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!stallId) return;
    try {
      const res = await api.get(`payments/stall/${stallId}`);
      setPayments(res.data);
    } catch (err) {
      console.error('Fetch stall payments error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stallId]);

  useEffect(() => {
    if (stallId) fetchPayments();
  }, [stallId, fetchPayments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  const orderId = selected?.order?._id;

  const handlePatchOrderPaymentStatus = async (paymentStatus: string) => {
    if (!orderId) return;
    setUpdating(true);
    try {
      await api.patch(`orders/${orderId}`, { paymentStatus });
      fetchPayments();
      setModalVisible(false);
    } catch (err) {
      console.error('Update payment status error:', err);
      Alert.alert('Error', 'Failed to update payment.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeletePayment = async (paymentDocId: string) => {
    Alert.alert(
      'Delete Payment Record',
      'Are you sure you want to delete this payment record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`payments/${paymentDocId}`);
              fetchPayments();
              setModalVisible(false);
              Alert.alert('Success', 'Payment record deleted.');
            } catch (err: any) {
              console.error('Delete payment error:', err);
              Alert.alert(
                'Error',
                err?.response?.data?.message || 'Failed to delete payment.',
              );
            }
          },
        },
      ]
    );
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return SUCCESS;
      case 'Pending':
        return WARNING;
      case 'Failed':
        return DANGER;
      default:
        return TEXT_GRAY;
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return WARNING;
      case 'Processing':
        return '#3498DB';
      case 'Preparing':
        return PRIMARY;
      case 'Ready':
        return SUCCESS;
      case 'Completed':
        return TEXT_GRAY;
      case 'Cancelled':
        return DANGER;
      default:
        return TEXT_GRAY;
    }
  };

  const openPayment = (p: any) => {
    setSelected(p);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/owner/owner_dashboard')
          }>
          <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitle}>Manage payments</Text>
          {stallName ? <Text style={styles.headerSubtitle}>{String(stallName)}</Text> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        nestedScrollEnabled>
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 50 }} />
        ) : payments.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="credit-card-off-outline" size={64} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>No payment records for this stall yet.</Text>
          </View>
        ) : (
          payments.map((p) => (
            <TouchableOpacity
              key={p._id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => openPayment(p)}>
              <View style={styles.rowTop}>
                <View>
                  <Text style={styles.orderId}>{p.order?.orderId ?? 'Order'}</Text>
                  <Text style={styles.date}>{dayjs(p.createdAt).format('DD MMM YYYY, hh:mm A')}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getPaymentStatusColor(p.status) + '15' },
                  ]}>
                  <Text style={[styles.statusText, { color: getPaymentStatusColor(p.status) }]}>
                    {p.status}
                  </Text>
                </View>
              </View>
              <View style={styles.userRow}>
                <MaterialCommunityIcons name="account-outline" size={16} color={TEXT_GRAY} />
                <Text style={styles.userName}>{p.user?.name || 'Customer'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.amount}>Rs. {p.amount}</Text>
                <Text style={styles.method}>{p.method}</Text>
              </View>
              {p.order?.status ? (
                <Text style={[styles.orderStatus, { color: getOrderStatusColor(p.order.status) }]}>
                  Order: {p.order.status}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            {selected && selected.order ? (
              <ScrollView>
                <Text style={styles.detailLine}>Order ID: {selected.order.orderId}</Text>
                <Text style={styles.detailLineMuted}>
                  Amount: Rs. {selected.amount} · {selected.method}
                </Text>

                <Text style={styles.label}>Payment status</Text>
                {selected.method === 'Card' && selected.status !== 'Failed' ? (
                  <View style={styles.infoBox}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={SUCCESS} />
                    <Text style={styles.infoBoxText}>
                      Card payments are verified automatically and set to Paid.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.optionsRow}>
                    {['Pending', 'Paid', 'Failed'].map((s) => (
                      <TouchableOpacity
                        key={s}
                        disabled={updating}
                        style={[
                          styles.optionChip,
                          selected.status === s && styles.optionChipActive,
                        ]}
                        onPress={() => {
                          if (s === 'Failed') {
                            if (selected.status === 'Failed') return;
                            Alert.alert(
                              'Payment Failed',
                              'Marking this payment as Failed will automatically cancel the order and restore meal stock. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Yes, Mark Failed',
                                  style: 'destructive',
                                  onPress: () => handlePatchOrderPaymentStatus(s),
                                },
                              ]
                            );
                          } else if (selected.status !== s) {
                            handlePatchOrderPaymentStatus(s);
                          }
                        }}>
                        <Text
                          style={[
                            styles.optionText,
                            selected.status === s && styles.optionTextActive,
                          ]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {selected.method === 'Bank Transfer' && selected.paymentSlip ? (
                  <View style={styles.slipSection}>
                    <Text style={styles.label}>Bank slip</Text>
                    <Image
                      source={{ uri: selected.paymentSlip }}
                      style={styles.photoPreview}
                      resizeMode="contain"
                    />
                  </View>
                ) : selected.method === 'Bank Transfer' ? (
                  <Text style={[styles.detailLineMuted, styles.slipSection]}>No slip uploaded.</Text>
                ) : null}

                {selected.method === 'Bank Transfer' && (
                  <TouchableOpacity
                    style={styles.deletePaymentInlineBtn}
                    onPress={() => handleDeletePayment(selected._id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={DANGER} />
                    <Text style={styles.deletePaymentInlineText}>Delete bank slip record</Text>
                  </TouchableOpacity>
                )}

                {selected.method === 'Card' && selected.status === 'Failed' && (
                  <TouchableOpacity
                    style={styles.deletePaymentBtn}
                    onPress={() => handleDeletePayment(selected._id)}>
                    <MaterialCommunityIcons name="credit-card-remove-outline" size={20} color="#fff" />
                    <Text style={styles.deletePaymentBtnText}>Delete failed card record</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  headerSubtitle: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
    marginTop: 2,
  },
  scrollContent: { padding: 16 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: {
    fontSize: 16,
    color: TEXT_GRAY,
    marginTop: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  date: { fontSize: 12, color: TEXT_GRAY, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  userRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  userName: { fontSize: 14, marginLeft: 6, fontWeight: '600', color: TEXT_DARK },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  amount: { fontSize: 15, fontWeight: 'bold', color: TEXT_DARK },
  method: { fontSize: 12, color: TEXT_GRAY },
  orderStatus: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_DARK },
  detailLine: { fontSize: 15, fontWeight: '600', color: TEXT_DARK },
  detailLineMuted: { fontSize: 13, color: TEXT_GRAY, marginTop: 4 },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginTop: 18,
    marginBottom: 10,
  },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F7FAFC',
  },
  optionChipActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY,
  },
  optionText: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  slipSection: { marginTop: 16 },
  photoPreview: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#F7FAFC',
  },
  deletePaymentInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'center',
  },
  deletePaymentInlineText: {
    color: DANGER,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  deletePaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DANGER,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 16,
  },
  deletePaymentBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  infoBoxText: {
    fontSize: 13,
    color: SUCCESS,
    marginLeft: 8,
    fontWeight: '600',
    flex: 1,
  },
});
