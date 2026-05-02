import React, { useEffect, useMemo, useState } from 'react';
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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import api, { getStoredUser } from '../../services/api';
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

function orderLineLabel(item: any) {
  return item.meal?.name ?? item.name ?? 'Meal';
}

function orderLineImageUri(item: any): string | null {
  const raw = item.meal?.image;
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s ? s : null;
}

/** Friendly label so bank + Pending is not mistaken for “failed”. */
function paymentStatusLabel(order: any): string {
  const raw = order?.paymentStatus;
  const pm = order?.paymentMethod;
  const s = typeof raw === 'string' ? raw : '';
  if (pm === 'Bank Transfer' && s === 'Pending') return 'Awaiting verification';
  return s || '—';
}

type UserOrderFilterKey =
  | 'all'
  | 'active'
  | 'Pending'
  | 'Processing'
  | 'Preparing'
  | 'Ready'
  | 'Completed'
  | 'Cancelled';

const USER_ORDER_FILTER_OPTIONS: { key: UserOrderFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'In progress' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Processing', label: 'Processing' },
  { key: 'Preparing', label: 'Preparing' },
  { key: 'Ready', label: 'Ready' },
  { key: 'Completed', label: 'Completed' },
  { key: 'Cancelled', label: 'Cancelled' },
];

function orderMatchesUserFilter(order: { status?: string }, filter: UserOrderFilterKey): boolean {
  const s = order.status ?? '';
  if (filter === 'all') return true;
  if (filter === 'active') return s !== 'Completed' && s !== 'Cancelled';
  return s === filter;
}

export default function UserOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickupQrOrder, setPickupQrOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<UserOrderFilterKey>('all');

  const filteredOrders = useMemo(
    () => orders.filter((o) => orderMatchesUserFilter(o, statusFilter)),
    [orders, statusFilter]
  );

  const pickupQrPayload =
    pickupQrOrder && pickupQrOrder.orderId
      ? JSON.stringify({ orderId: String(pickupQrOrder.orderId).trim() })
      : '';

  const fetchOrders = async () => {
    try {
      const user = await getStoredUser();
      if (!user) return;
      const res = await api.get(`orders/user/${user.id}`);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Fetch orders error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return WARNING;
      case 'Processing': return '#3498DB';
      case 'Preparing': return PRIMARY;
      case 'Ready': return SUCCESS;
      case 'Completed': return TEXT_GRAY;
      case 'Cancelled': return DANGER;
      default: return TEXT_GRAY;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return SUCCESS;
      case 'Pending': return WARNING;
      case 'Failed': return DANGER;
      default: return TEXT_GRAY;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={24} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {!loading && orders.length > 0 ? (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterBarContent}
            keyboardShouldPersistTaps="handled">
            {USER_ORDER_FILTER_OPTIONS.map((opt) => {
              const active = statusFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setStatusFilter(opt.key)}
                  activeOpacity={0.85}>
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {statusFilter !== 'all' ? (
            <Text style={styles.filterHint}>
              Showing {filteredOrders.length} of {orders.length}
            </Text>
          ) : null}
        </View>
      ) : null}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 50 }} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>{"You haven't placed any orders yet."}</Text>
            <TouchableOpacity style={styles.orderNowBtn} onPress={() => router.push('/user/dashboard')}>
              <Text style={styles.orderNowText}>Order Now</Text>
            </TouchableOpacity>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="filter-variant" size={56} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>No orders match this filter.</Text>
            <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setStatusFilter('all')} activeOpacity={0.85}>
              <Text style={styles.clearFilterBtnText}>Show all orders</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View key={order._id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>{order.orderId}</Text>
                  <Text style={styles.orderDate}>{dayjs(order.createdAt).format('DD MMM YYYY, hh:mm A')}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '15' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status}</Text>
                </View>
              </View>

              <View style={styles.stallRow}>
                <MaterialCommunityIcons name="storefront-outline" size={16} color={TEXT_GRAY} />
                <Text style={styles.stallName}>{order.stall?.name || 'Stall'}</Text>
              </View>

              <View style={styles.itemsList}>
                {(order.items ?? []).map((item: any, idx: number) => {
                  const uri = orderLineImageUri(item);
                  return (
                    <View key={idx} style={styles.orderLineRow}>
                      {uri ? (
                        <Image source={{ uri }} style={styles.orderLineThumb} />
                      ) : (
                        <View style={styles.orderLineThumbPlaceholder}>
                          <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={TEXT_GRAY} />
                        </View>
                      )}
                      <Text style={styles.orderLineText} numberOfLines={2}>
                        {item.quantity}x {orderLineLabel(item)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <View style={styles.orderFooter}>
                <View>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>Rs. {order.totalAmount}</Text>
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentMethod}>{order.paymentMethod}</Text>
                  <View style={[styles.paymentStatusBadge, { backgroundColor: getPaymentStatusColor(order.paymentStatus) + '15' }]}>
                    <Text style={[styles.paymentStatusText, { color: getPaymentStatusColor(order.paymentStatus) }]}>
                      {paymentStatusLabel(order)}
                    </Text>
                  </View>
                </View>
              </View>

              {order.paymentMethod === 'Bank Transfer' && order.paymentStatus === 'Pending' ? (
                <Text style={styles.bankVerifyHint}>Staff are verifying your transfer; you will be notified when payment is confirmed.</Text>
              ) : null}

              {order.status === 'Ready' ? (
                <TouchableOpacity
                  style={styles.scanQrBtn}
                  activeOpacity={0.88}
                  onPress={() => setPickupQrOrder(order)}
                  accessibilityRole="button"
                  accessibilityLabel="Scan QR — show pickup code for stall staff">
                  <MaterialCommunityIcons name="qrcode-scan" size={20} color="#fff" />
                  <Text style={styles.scanQrBtnText}>Scan QR</Text>
                </TouchableOpacity>
              ) : null}

              {order.orderPhoto ? (
                <View style={styles.orderPhotoSection}>
                  <Text style={styles.photoLabel}>Order Confirmation Photo:</Text>
                  <Image source={{ uri: order.orderPhoto }} style={styles.orderPhoto} resizeMode="cover" />
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={pickupQrOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickupQrOrder(null)}>
        <Pressable style={styles.qrModalBackdrop} onPress={() => setPickupQrOrder(null)}>
          <Pressable style={styles.qrModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Pickup QR</Text>
              <TouchableOpacity onPress={() => setPickupQrOrder(null)} accessibilityLabel="Close">
                <MaterialCommunityIcons name="close" size={26} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>
            <Text style={styles.qrModalHint}>
              Brighten your screen if needed. Stall staff scans this QR to verify pickup for order{' '}
              <Text style={styles.qrModalOrderStrong}>{pickupQrOrder?.orderId ?? ''}</Text>.
            </Text>
            {pickupQrPayload ? (
              <View style={styles.pickupQrBox}>
                <QRCode value={pickupQrPayload} size={200} />
              </View>
            ) : (
              <Text style={styles.qrModalFallback}>Unable to generate code for this order.</Text>
            )}
            <Text style={styles.pickupOrderNo}>{pickupQrOrder?.orderId}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  filterBar: {
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  filterBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F0F4F4',
    borderWidth: 1,
    borderColor: '#E2ECEC',
  },
  filterChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterHint: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_GRAY,
  },
  clearFilterBtn: {
    marginTop: 18,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PRIMARY + '18',
    borderWidth: 1,
    borderColor: PRIMARY + '55',
  },
  clearFilterBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: TEXT_GRAY,
    marginTop: 16,
    textAlign: 'center',
  },
  orderNowBtn: {
    marginTop: 20,
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  orderNowText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  orderCard: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  orderDate: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  stallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  stallName: {
    fontSize: 14,
    color: TEXT_GRAY,
    marginLeft: 6,
    fontWeight: '600',
  },
  itemsList: {
    marginTop: 10,
    gap: 8,
  },
  orderLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderLineThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8ECF0',
  },
  orderLineThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F5F7F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8ECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderLineText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
    fontWeight: '600',
    lineHeight: 19,
  },
  pickupQrSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pickupQrTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_DARK,
    alignSelf: 'flex-start',
  },
  pickupQrHint: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
    lineHeight: 17,
  },
  pickupQrBox: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupOrderNo: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.6,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: PRIMARY,
  },
  paymentInfo: {
    alignItems: 'flex-end',
  },
  paymentMethod: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginBottom: 4,
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  bankVerifyHint: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 10,
    lineHeight: 17,
    fontWeight: '600',
  },
  orderPhotoSection: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  orderPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F7FAFC',
  },
  scanQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: SUCCESS,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  scanQrBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  qrModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  qrModalCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  qrModalHint: {
    fontSize: 13,
    color: TEXT_GRAY,
    lineHeight: 19,
    marginBottom: 16,
  },
  qrModalOrderStrong: {
    fontWeight: '800',
    color: PRIMARY,
  },
  qrModalFallback: {
    fontSize: 14,
    color: DANGER,
    textAlign: 'center',
    marginVertical: 24,
  },
});
