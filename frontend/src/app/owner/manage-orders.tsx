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
  Alert,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { COLORS } from '../../theme/colors';
import { OwnerPickupQrScannerModal } from '../../components/OwnerPickupQrScanner';
import { pickupCodeMatchesOrder } from '../../utils/pickupVerification';
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

const ORDER_STATUS_OPTIONS = ['Pending', 'Processing', 'Preparing', 'Ready', 'Completed', 'Cancelled'] as const;

type OrderListFilterKey = 'all' | 'late_pickup' | 'active' | (typeof ORDER_STATUS_OPTIONS)[number];

const ORDER_LIST_FILTER_OPTIONS: { key: OrderListFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'late_pickup', label: 'Late pickup' },
  { key: 'active', label: 'In progress' },
  ...ORDER_STATUS_OPTIONS.map((s) => ({ key: s, label: s })),
];

/** Forward-only funnel; Cancelled is a separate escape hatch (not reversible into the funnel). */
const LINEAR_ORDER_RANK: Record<string, number> = {
  Pending: 0,
  Processing: 1,
  Preparing: 2,
  Ready: 3,
  Completed: 4,
};

function isStatusSelectable(option: string, savedStatus: string): boolean {
  if (savedStatus === 'Cancelled') return option === 'Cancelled';
  if (option === 'Cancelled') return savedStatus !== 'Completed';
  if (option === 'Completed') return savedStatus === 'Ready';

  const savedRank = LINEAR_ORDER_RANK[savedStatus];
  const optRank = LINEAR_ORDER_RANK[option];
  if (savedRank === undefined || optRank === undefined) return true;
  return optRank >= savedRank;
}

function isOrderOlderThanOneMonth(createdAt: string | Date): boolean {
  return dayjs(createdAt).isBefore(dayjs().subtract(1, 'month'));
}

function isActiveOrderStatus(status: string) {
  return status !== 'Completed' && status !== 'Cancelled';
}

/** Pickup window has passed but the order is still active. */
function isPickupOverdue(order: { pickupTime: string | Date; status: string }): boolean {
  if (!isActiveOrderStatus(order.status)) return false;
  return dayjs(order.pickupTime).isBefore(dayjs());
}

function orderMatchesListFilter(order: { status: string; pickupTime: string | Date }, filter: OrderListFilterKey) {
  switch (filter) {
    case 'all':
      return true;
    case 'late_pickup':
      return isPickupOverdue(order);
    case 'active':
      return isActiveOrderStatus(order.status);
    default:
      return order.status === filter;
  }
}

/** Among late-pickup orders: Pending → Processing → Preparing → Ready (then earlier pickup first). */
const OVERDUE_STATUS_PRIORITY_RANK: Record<string, number> = {
  Pending: 0,
  Processing: 1,
  Preparing: 2,
  Ready: 3,
};

function overdueStatusPriorityRank(status: string): number {
  return OVERDUE_STATUS_PRIORITY_RANK[status] ?? 99;
}

function orderLineLabel(item: any) {
  return item.meal?.name ?? item.name ?? 'Meal';
}

function orderLineImageUri(item: any): string | null {
  const raw = item.meal?.image;
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s ? s : null;
}

function orderHasConfirmationPhoto(order: { orderPhoto?: string } | null) {
  return !!order && String(order.orderPhoto ?? '').trim().length > 0;
}

function normalizeUserPhoneForTel(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const compact = s.replace(/[^\d+]/g, '');
  return compact || null;
}

async function openCustomerDialer(phone: unknown) {
  const compact = normalizeUserPhoneForTel(phone);
  if (!compact) {
    Alert.alert('No phone number', 'This customer does not have a phone number on file.');
    return;
  }
  const url = `tel:${compact}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot place call', 'This device cannot open the phone app.');
    }
  } catch {
    Alert.alert('Cannot place call', 'Unable to start a call.');
  }
}

/** Late pickup first; late block ordered by status priority, then pickup time. Non-late: pickup time only. */
function sortOrdersForManageList(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const overdueA = isPickupOverdue(a);
    const overdueB = isPickupOverdue(b);
    if (overdueA !== overdueB) return overdueA ? -1 : 1;
    if (overdueA && overdueB) {
      const pa = overdueStatusPriorityRank(a.status);
      const pb = overdueStatusPriorityRank(b.status);
      if (pa !== pb) return pa - pb;
    }
    return dayjs(a.pickupTime).valueOf() - dayjs(b.pickupTime).valueOf();
  });
}

export default function ManageOrdersScreen() {
  const router = useRouter();
  const { stallId, stallName } = useLocalSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string>('Pending');
  const [pickupScanVisible, setPickupScanVisible] = useState(false);
  const [pickupVerifiedPayload, setPickupVerifiedPayload] = useState<string | null>(null);
  const [manualPickupCode, setManualPickupCode] = useState('');
  const [listFilter, setListFilter] = useState<OrderListFilterKey>('all');

  const filteredOrders = useMemo(
    () => orders.filter((o) => orderMatchesListFilter(o, listFilter)),
    [orders, listFilter]
  );

  const fetchOrders = async () => {
    try {
      const res = await api.get(`orders/stall/${stallId}`);
      setOrders(sortOrdersForManageList(Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      console.error('Fetch stall orders error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (stallId) fetchOrders();
  }, [stallId]);

  useEffect(() => {
    setPickupVerifiedPayload(null);
    setManualPickupCode('');
    setPickupScanVisible(false);
  }, [selectedOrder?._id]);

  useEffect(() => {
    if (draftStatus !== 'Completed') {
      setPickupVerifiedPayload(null);
      setManualPickupCode('');
      setPickupScanVisible(false);
    }
  }, [draftStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleUpdateOrder = async (orderId: string, updates: any) => {
    setUpdating(true);
    try {
      const res = await api.patch(`orders/${orderId}`, updates);
      const updated = res.data;
      fetchOrders();
      setSelectedOrder((prev) =>
        prev && prev._id === orderId
          ? { ...prev, ...updated, user: updated.user ?? prev.user }
          : prev
      );
      if (updates.status !== undefined) {
        setDraftStatus(updated.status);
      }

      // Photo upload stays in-modal; closing only after successful status saves.
      if (updates.orderPhoto !== undefined) {
        /* stay open */
      } else if (updates.status !== undefined) {
        setEditModalVisible(false);
        setPickupVerifiedPayload(null);
        setManualPickupCode('');
      }
    } catch (err: unknown) {
      console.error('Update order error:', err);
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as any).response?.data?.message === 'string'
          ? (err as any).response.data.message
          : 'Failed to update order.';
      Alert.alert('Error', msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    Alert.alert(
      'Delete Order',
      'Are you sure you want to permanently delete this order? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`orders/${orderId}`);
              fetchOrders();
              Alert.alert('Success', 'Order deleted successfully.');
            } catch (err) {
              console.error('Delete order error:', err);
              Alert.alert('Error', 'Failed to delete order.');
            }
          }
        }
      ]
    );
  };

  const uploadOrderPhoto = async (orderId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      handleUpdateOrder(orderId, { orderPhoto: base64 });
    }
  };

  /** Pay at stall — customer presented matching pickup proof; mark payment received. */
  const verifyPayAtStallPaymentAfterPickupProof = (order: any) => {
    if (!order || order.paymentMethod !== 'Pay at Stall') return;
    if (order.paymentStatus === 'Paid') return;
    void handleUpdateOrder(order._id, { paymentStatus: 'Paid' });
  };

  const verifyManualPickup = () => {
    if (!selectedOrder) return;
    if (pickupCodeMatchesOrder(selectedOrder.orderId, manualPickupCode)) {
      setPickupVerifiedPayload(manualPickupCode.trim());
      verifyPayAtStallPaymentAfterPickupProof(selectedOrder);
    } else {
      Alert.alert('No match', 'That order number does not match this order.');
    }
  };

  const submitDraftStatus = () => {
    if (!selectedOrder || draftStatus === selectedOrder.status || updating) return;
    if (!isStatusSelectable(draftStatus, selectedOrder.status)) {
      Alert.alert('Invalid status', 'You can only move the order forward, not backward.');
      setDraftStatus(selectedOrder.status);
      return;
    }
    if (draftStatus === 'Cancelled') {
      Alert.alert(
        'Cancel Order',
        'Are you sure you want to cancel this order? This will restore the meal stock.',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => handleUpdateOrder(selectedOrder._id, { status: 'Cancelled' }),
          },
        ]
      );
      return;
    }
    if (draftStatus === 'Ready') {
      if (!orderHasConfirmationPhoto(selectedOrder)) {
        Alert.alert(
          'Photo required',
          'Upload an order confirmation photo before marking this order Ready.',
        );
        return;
      }
    }
    if (draftStatus === 'Completed') {
      if (selectedOrder.status !== 'Ready') {
        Alert.alert(
          'Not ready yet',
          'Mark this order Ready first (with a confirmation photo), then verify pickup before completing.',
        );
        return;
      }
      if (
        !pickupVerifiedPayload ||
        !pickupCodeMatchesOrder(selectedOrder.orderId, pickupVerifiedPayload)
      ) {
        Alert.alert(
          'Verify pickup',
          'Scan the customer pickup QR or enter the order number and verify before completing.',
        );
        return;
      }
      handleUpdateOrder(selectedOrder._id, {
        status: 'Completed',
        pickupVerification: pickupVerifiedPayload,
      });
      return;
    }
    handleUpdateOrder(selectedOrder._id, { status: draftStatus });
  };

  const statusDirty = selectedOrder ? draftStatus !== selectedOrder.status : false;
  const completeNeedsVerifiedPickup =
    !!selectedOrder &&
    draftStatus === 'Completed' &&
    selectedOrder.status === 'Ready' &&
    (!pickupVerifiedPayload || !pickupCodeMatchesOrder(selectedOrder.orderId, pickupVerifiedPayload));

  /** Hide photo UI while drafting Completed/Cancelled so pickup verification stays visible below the chips. */
  const showConfirmationPhotoUi =
    !!selectedOrder &&
    draftStatus !== 'Completed' &&
    draftStatus !== 'Cancelled' &&
    (draftStatus === 'Ready' || selectedOrder.status === 'Ready') &&
    selectedOrder.status !== 'Completed' &&
    selectedOrder.status !== 'Cancelled';

  const showPickupVerifyUi =
    !!selectedOrder &&
    draftStatus === 'Completed' &&
    selectedOrder.status === 'Ready';

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/owner/owner_dashboard')}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={styles.headerTitle}>Manage Orders</Text>
          <Text style={styles.headerSubtitle}>{stallName}</Text>
        </View>
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
            {ORDER_LIST_FILTER_OPTIONS.map((opt) => {
              const active = listFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setListFilter(opt.key)}
                  activeOpacity={0.85}>
                  {opt.key === 'late_pickup' ? (
                    <MaterialCommunityIcons
                      name="clock-alert-outline"
                      size={14}
                      color={active ? '#fff' : COLORS.danger}
                      style={{ marginRight: 5 }}
                    />
                  ) : null}
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
            <Text style={styles.emptyText}>No orders received for this stall yet.</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="filter-variant-remove" size={56} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>No orders match this filter.</Text>
            <TouchableOpacity style={styles.clearFilterBtn} onPress={() => setListFilter('all')}>
              <Text style={styles.clearFilterBtnText}>Show all orders</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const pickupLate = isPickupOverdue(order);
            const canDelete = isOrderOlderThanOneMonth(order.createdAt);
            return (
            <TouchableOpacity
              key={order._id}
              style={styles.orderCard}
              onPress={() => {
                setSelectedOrder(order);
                setDraftStatus(order.status);
                setPickupVerifiedPayload(null);
                setManualPickupCode('');
                setPickupScanVisible(false);
                setEditModalVisible(true);
              }}
            >
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>{order.orderId}</Text>
                  <Text style={styles.orderDate}>{dayjs(order.createdAt).format('DD MMM, hh:mm A')}</Text>
                </View>
                <View style={styles.orderHeaderBadges}>
                  {pickupLate ? (
                    <View style={[styles.statusBadge, styles.pickupLateBadge]}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={13} color={COLORS.danger} />
                      <Text style={styles.pickupLateBadgeText}>Late pickup</Text>
                    </View>
                  ) : null}
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.userBlock}>
                <View style={styles.userRow}>
                  <MaterialCommunityIcons name="account-outline" size={16} color={TEXT_GRAY} />
                  <Text style={styles.userName}>{order.user?.name || 'Customer'}</Text>
                </View>
                {normalizeUserPhoneForTel(order.user?.phone) ? (
                  <TouchableOpacity
                    style={styles.userPhoneRow}
                    activeOpacity={0.75}
                    onPress={() => openCustomerDialer(order.user?.phone)}
                    accessibilityRole="link"
                    accessibilityLabel={`Call customer at ${order.user?.phone}`}>
                    <MaterialCommunityIcons name="phone-outline" size={16} color={PRIMARY} />
                    <Text style={styles.userPhoneText}>{order.user?.phone}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.userPhoneRow}>
                    <MaterialCommunityIcons name="phone-off-outline" size={16} color={TEXT_GRAY} />
                    <Text style={styles.userPhoneMuted}>No phone on file</Text>
                  </View>
                )}
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.totalLabel}>Total: Rs. {order.totalAmount}</Text>
                  <Text style={styles.pickupTime}>
                    Pickup: {dayjs(order.pickupTime).format('hh:mm A')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.deleteOrderBtn, !canDelete && styles.deleteOrderBtnDisabled]}
                  disabled={!canDelete}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteOrder(order._id);
                  }}
                  accessibilityState={{ disabled: !canDelete }}
                  accessibilityLabel={
                    canDelete ? 'Delete order' : 'Delete order, available when older than 1 month'
                  }>
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={18}
                    color={canDelete ? DANGER : TEXT_GRAY}
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Edit Order Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Order</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditModalVisible(false);
                  setPickupVerifiedPayload(null);
                  setManualPickupCode('');
                  setPickupScanVisible(false);
                }}>
                <MaterialCommunityIcons name="close" size={24} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollContent}>
                  <Text style={styles.label}>Items</Text>
                  <View style={styles.modalItemsList}>
                    {(selectedOrder.items ?? []).map((item: any, idx: number) => {
                      const uri = orderLineImageUri(item);
                      return (
                        <View key={idx} style={styles.modalOrderLineRow}>
                          {uri ? (
                            <Image source={{ uri }} style={styles.modalOrderLineThumb} />
                          ) : (
                            <View style={[styles.orderLineThumbPlaceholder, styles.modalOrderLineThumbPlaceholder]}>
                              <MaterialCommunityIcons name="silverware-fork-knife" size={16} color={TEXT_GRAY} />
                            </View>
                          )}
                          <Text style={styles.modalOrderLineText} numberOfLines={2}>
                            {item.quantity}x {orderLineLabel(item)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <Text style={styles.label}>Customer</Text>
                  <Text style={styles.modalCustomerName}>
                    {selectedOrder.user?.name || 'Customer'}
                  </Text>
                  {selectedOrder.user?.email ? (
                    <Text style={styles.modalCustomerEmail}>{selectedOrder.user.email}</Text>
                  ) : null}
                  {normalizeUserPhoneForTel(selectedOrder.user?.phone) ? (
                    <TouchableOpacity
                      style={styles.modalPhoneTap}
                      activeOpacity={0.75}
                      onPress={() => openCustomerDialer(selectedOrder.user?.phone)}
                      accessibilityRole="link"
                      accessibilityLabel={`Call ${selectedOrder.user?.phone}`}>
                      <MaterialCommunityIcons name="phone-outline" size={18} color={PRIMARY} />
                      <Text style={styles.modalPhoneText}>{selectedOrder.user?.phone}</Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={TEXT_GRAY} />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.modalPhoneTap, styles.modalPhoneTapDisabled]}>
                      <MaterialCommunityIcons name="phone-off-outline" size={18} color={TEXT_GRAY} />
                      <Text style={styles.userPhoneMuted}>No phone on file</Text>
                    </View>
                  )}

                  <Text style={styles.label}>Order Status</Text>
                  <View style={styles.optionsRow}>
                    {ORDER_STATUS_OPTIONS.map((s) => {
                      const allowed = !updating && isStatusSelectable(s, selectedOrder.status);
                      return (
                        <TouchableOpacity
                          key={s}
                          disabled={updating || !allowed}
                          style={[
                            styles.optionChip,
                            draftStatus === s && styles.optionChipActive,
                            !allowed && styles.optionChipDisabled,
                          ]}
                          onPress={() => setDraftStatus(s)}>
                          <Text
                            style={[
                              styles.optionText,
                              draftStatus === s && styles.optionTextActive,
                              !allowed && styles.optionChipDisabledText,
                            ]}>
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {showPickupVerifyUi ? (
                    <View style={styles.pickupVerifyBlock}>
                      <Text style={styles.label}>Complete pickup</Text>
                      <Text style={styles.hintMuted}>
                        Scan the QR from the customer&apos;s app or enter the order number, then verify.
                      </Text>
                      {pickupVerifiedPayload &&
                      pickupCodeMatchesOrder(selectedOrder.orderId, pickupVerifiedPayload) ? (
                        <View style={styles.pickupVerifiedPill}>
                          <MaterialCommunityIcons name="check-decagram" size={20} color={SUCCESS} />
                          <Text style={styles.pickupVerifiedText}>Pickup verified — you can complete the order.</Text>
                        </View>
                      ) : (
                        <>
                          {Platform.OS !== 'web' ? (
                            <TouchableOpacity
                              style={styles.scanQrBtn}
                              onPress={() => setPickupScanVisible(true)}
                              disabled={updating}>
                              <MaterialCommunityIcons name="qrcode-scan" size={22} color="#fff" />
                              <Text style={styles.scanQrBtnText}>Scan pickup QR</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.webScanHint}>On web, enter the order number below.</Text>
                          )}
                          <Text style={[styles.label, { marginTop: 12 }]}>Or enter order number</Text>
                          <TextInput
                            style={styles.pickupInput}
                            value={manualPickupCode}
                            onChangeText={setManualPickupCode}
                            placeholder="e.g. ORD-1234-001"
                            placeholderTextColor="#A0AEC0"
                            autoCapitalize="characters"
                            editable={!updating}
                          />
                          <TouchableOpacity
                            style={styles.verifyManualBtn}
                            onPress={verifyManualPickup}
                            disabled={updating || !manualPickupCode.trim()}>
                            <Text style={styles.verifyManualBtnText}>Verify match</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ) : null}

                  {showConfirmationPhotoUi ? (
                    <>
                      <Text style={styles.label}>Order confirmation photo</Text>
                      <Text style={styles.hintMuted}>
                        Required before you can mark this order Ready.
                      </Text>
                      {selectedOrder.orderPhoto ? (
                        <View style={styles.photoContainer}>
                          <Image source={{ uri: selectedOrder.orderPhoto }} style={styles.photoPreview} />
                          <TouchableOpacity
                            style={styles.changePhotoBtn}
                            onPress={() => uploadOrderPhoto(selectedOrder._id)}
                            disabled={updating}>
                            <Text style={styles.changePhotoText}>Change Photo</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.uploadBtn}
                          onPress={() => uploadOrderPhoto(selectedOrder._id)}
                          disabled={updating}>
                          <MaterialCommunityIcons name="camera-plus-outline" size={32} color={PRIMARY} />
                          <Text style={styles.uploadText}>Upload Photo</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : null}
                  <View style={{ height: 12 }} />
                </ScrollView>
                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    ((!statusDirty || updating || completeNeedsVerifiedPickup) && styles.modalSaveBtnDisabled),
                  ]}
                  disabled={!statusDirty || updating || completeNeedsVerifiedPickup}
                  onPress={submitDraftStatus}
                  activeOpacity={0.85}>
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {selectedOrder ? (
        <OwnerPickupQrScannerModal
          visible={pickupScanVisible}
          expectedOrderId={selectedOrder.orderId}
          onClose={() => setPickupScanVisible(false)}
          onMatched={(raw) => {
            setPickupVerifiedPayload(raw);
            setPickupScanVisible(false);
            if (selectedOrder) verifyPayAtStallPaymentAfterPickupProof(selectedOrder);
          }}
        />
      ) : null}
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
  headerSubtitle: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
  },
  filterBar: {
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
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
  scrollContent: {
    padding: 16,
    paddingTop: 12,
  },
  clearFilterBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearFilterBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
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
  orderCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  orderHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '52%',
    justifyContent: 'flex-end',
  },
  pickupLateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.warningSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,91,87,0.12)',
  },
  pickupLateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textDark,
    letterSpacing: 0.2,
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
  userBlock: {
    marginTop: 10,
    gap: 6,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 14,
    color: TEXT_DARK,
    marginLeft: 6,
    fontWeight: '600',
  },
  userPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 22,
  },
  userPhoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
    textDecorationLine: 'underline',
  },
  userPhoneMuted: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: '500',
  },
  modalCustomerName: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 4,
  },
  modalCustomerEmail: {
    fontSize: 14,
    color: TEXT_GRAY,
    marginBottom: 10,
  },
  modalPhoneTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: PRIMARY + '10',
    borderWidth: 1,
    borderColor: PRIMARY + '35',
  },
  modalPhoneTapDisabled: {
    backgroundColor: '#F5F7F7',
    borderColor: '#E8ECF0',
  },
  modalPhoneText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: PRIMARY,
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
  modalItemsList: {
    gap: 10,
    marginBottom: 4,
  },
  modalOrderLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalOrderLineThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F0F2F5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8ECF0',
  },
  modalOrderLineThumbPlaceholder: {
    width: 40,
    height: 40,
  },
  modalOrderLineText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_DARK,
    fontWeight: '600',
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
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  pickupTime: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
    marginTop: 2,
  },
  deleteOrderBtn: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FFF5F5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  deleteOrderBtnDisabled: {
    backgroundColor: '#F5F6F7',
    borderColor: '#E8EAED',
    opacity: 0.65,
  },
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
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginTop: 15,
    marginBottom: 10,
  },
  hintMuted: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginTop: -4,
    marginBottom: 10,
    lineHeight: 18,
  },
  pickupVerifyBlock: {
    marginTop: 4,
  },
  pickupVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F8EF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C6EFD8',
    marginTop: 6,
  },
  pickupVerifiedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  scanQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  scanQrBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  webScanHint: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginTop: 6,
  },
  pickupInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_DARK,
    backgroundColor: '#F7FAFC',
    marginTop: 6,
  },
  verifyManualBtn: {
    marginTop: 10,
    backgroundColor: '#E7F3F2',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,91,87,0.2)',
  },
  verifyManualBtnText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '800',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  optionChipDisabled: {
    opacity: 0.42,
    backgroundColor: '#F0F0F0',
    borderColor: '#E8E8E8',
  },
  optionChipDisabledText: {
    color: '#B2BEC3',
  },
  optionText: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  uploadBtn: {
    height: 150,
    borderWidth: 2,
    borderColor: PRIMARY,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9F9',
    marginTop: 10,
  },
  uploadText: {
    color: PRIMARY,
    fontWeight: 'bold',
    marginTop: 10,
  },
  photoContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#F7FAFC',
  },
  changePhotoBtn: {
    marginTop: 10,
    padding: 8,
  },
  changePhotoText: {
    color: PRIMARY,
    fontWeight: 'bold',
  },
  modalSaveBtn: {
    marginTop: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnDisabled: {
    backgroundColor: '#A8C9C7',
    opacity: 0.85,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
