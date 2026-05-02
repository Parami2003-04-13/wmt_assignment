import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

function normalizeParam(v: string | string[] | undefined): string {
  if (v == null) return '';
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' ? s.trim() : String(s ?? '').trim();
}

type PaymentMethodFilterKey = 'all' | 'Bank Transfer' | 'Card' | 'Pay at Stall';

const PAY_METHOD_FILTER_OPTIONS: { key: PaymentMethodFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Bank Transfer', label: 'Bank transfer' },
  { key: 'Card', label: 'Card' },
  { key: 'Pay at Stall', label: 'Pay at stall' },
];

const ARCHIVE_DELETE_RETENTION_YEARS = 10;

/** Mirrors backend retention: strict delete only when created before (now − N years). */
function canArchivalDeletePayment(p: { createdAt?: string | Date } | null | undefined): boolean {
  if (!p?.createdAt) return false;
  return dayjs(p.createdAt).isBefore(dayjs().subtract(ARCHIVE_DELETE_RETENTION_YEARS, 'year'));
}

export default function ManagePaymentsScreen() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const stallId = normalizeParam(rawParams.stallId as string | string[] | undefined);
  const stallName = normalizeParam(rawParams.stallName as string | string[] | undefined);
  const [payments, setPayments] = useState<any[]>([]);
  const [pendingBankTransfers, setPendingBankTransfers] = useState<any[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<string>('Pending');
  const [methodFilter, setMethodFilter] = useState<PaymentMethodFilterKey>('all');

  const filteredPayments = useMemo(() => {
    if (methodFilter === 'all') return payments;
    return payments.filter((p) => p.method === methodFilter);
  }, [payments, methodFilter]);

  const showPendingBankSection =
    pendingBankTransfers.length > 0 && (methodFilter === 'all' || methodFilter === 'Bank Transfer');

  const isTotallyEmpty = stallId !== '' && !loading && pendingBankTransfers.length === 0 && payments.length === 0;

  const hasFilteredListContent =
    stallId !== '' && !loading && (showPendingBankSection || filteredPayments.length > 0);

  const isFilterEmpty =
    stallId !== '' &&
    !loading &&
    !isTotallyEmpty &&
    !hasFilteredListContent;

  const canEditPaymentStatusChips =
    !!selected &&
    typeof selected.order === 'object' &&
    selected.order &&
    !(selected.method === 'Card' && selected.status !== 'Failed');

  useEffect(() => {
    if (selected && typeof selected.status === 'string') {
      setDraftPaymentStatus(selected.status);
    }
  }, [selected?._id, selected?.status, modalVisible]);

  const fetchPayments = useCallback(async () => {
    if (!stallId) {
      setPayments([]);
      setPendingBankTransfers([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const payPromise = api
      .get(`payments/stall/${encodeURIComponent(stallId)}`)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Fetch stall payments error:', err);
        return [];
      });
    const pendingPromise = api
      .get(`pending-bank-transfers/stall/${encodeURIComponent(stallId)}`)
      .then((r) => r.data)
      .catch((err) => {
        console.error('Fetch pending bank transfers error:', err);
        return [];
      });

    try {
      const [payData, pendingData] = await Promise.all([payPromise, pendingPromise]);
      setPayments(Array.isArray(payData) ? payData : []);
      setPendingBankTransfers(Array.isArray(pendingData) ? pendingData : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stallId]);

  useEffect(() => {
    setLoading(true);
    fetchPayments();
  }, [stallId, fetchPayments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  const orderId =
    selected?.order && typeof selected.order === 'object' && selected.order._id != null
      ? selected.order._id
      : typeof selected?.order === 'string'
        ? selected.order
        : null;

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

  const savePaymentStatusDraft = () => {
    if (!orderId || updating || !selected) return;
    if (draftPaymentStatus === selected.status) return;

    if (draftPaymentStatus === 'Failed') {
      Alert.alert(
        'Payment failed',
        'Marking this payment as Failed will cancel the order and restore meal stock.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            style: 'destructive',
            onPress: () => void handlePatchOrderPaymentStatus('Failed'),
          },
        ]
      );
      return;
    }

    handlePatchOrderPaymentStatus(draftPaymentStatus);
  };

  const paymentStatusDirty =
    !!orderId &&
    !!selected &&
    canEditPaymentStatusChips &&
    draftPaymentStatus !== selected.status;

  const handleDeletePayment = async (paymentDocId: string) => {
    Alert.alert(
      'Delete archived payment?',
      `This permanently removes this payment record. Only records older than ${ARCHIVE_DELETE_RETENTION_YEARS} years may be deleted.`,
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

  const handleApprovePendingBank = (mongoId: string) => {
    Alert.alert(
      'Verify transfer',
      'This creates the customer order as paid, deducts stock, and notifies the customer.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify & place order',
          style: 'default',
          onPress: async () => {
            const idStr = String(mongoId);
            setPendingActionId(idStr);
            try {
              await api.patch(`pending-bank-transfers/${encodeURIComponent(idStr)}/approve`);
              await fetchPayments();
              Alert.alert('Done', 'Order created and the customer has been notified.');
            } catch (err: any) {
              Alert.alert(
                'Could not approve',
                err?.response?.data?.message || 'Approve failed. Refresh and try again.',
              );
            } finally {
              setPendingActionId(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectPendingBank = (mongoId: string) => {
    Alert.alert(
      'Reject transfer',
      'The customer will be notified they can submit again from checkout.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            const idStr = String(mongoId);
            setPendingActionId(idStr);
            try {
              await api.patch(`pending-bank-transfers/${encodeURIComponent(idStr)}/reject`, {});
              await fetchPayments();
              Alert.alert('Rejected', 'The customer has been notified.');
            } catch (err: any) {
              Alert.alert(
                'Could not reject',
                err?.response?.data?.message || 'Reject failed. Refresh and try again.',
              );
            } finally {
              setPendingActionId(null);
            }
          },
        },
      ]
    );
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
          {stallName ? <Text style={styles.headerSubtitle}>{stallName}</Text> : null}
          {!loading && stallId ? (
            <>
              {pendingBankTransfers.length > 0 && showPendingBankSection ? (
                <Text style={[styles.headerCount, styles.headerPendingHighlight]}>
                  Pending bank slips · {pendingBankTransfers.length}
                </Text>
              ) : null}
              <Text style={styles.headerCount}>
                Payment records · {filteredPayments.length}
                {methodFilter !== 'all' && filteredPayments.length !== payments.length
                  ? ` (${payments.length} total)`
                  : ''}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {!stallId && !loading ? (
        <View style={styles.bannerWarn}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={DANGER} />
          <Text style={styles.bannerWarnText}>Missing stall. Open Manage payments from your stall screen.</Text>
        </View>
      ) : null}

      {stallId && !loading && !isTotallyEmpty ? (
        <View style={styles.methodFilterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.methodFilterBarContent}
            keyboardShouldPersistTaps="handled">
            {PAY_METHOD_FILTER_OPTIONS.map((opt) => {
              const active = methodFilter === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.methodFilterChip, active && styles.methodFilterChipActive]}
                  onPress={() => setMethodFilter(opt.key)}
                  activeOpacity={0.85}>
                  <Text style={[styles.methodFilterChipText, active && styles.methodFilterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        nestedScrollEnabled>
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 50 }} />
        ) : stallId && isTotallyEmpty ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="credit-card-off-outline" size={64} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>
              No pending bank slips to verify and no payment records yet.
            </Text>
          </View>
        ) : !stallId ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="credit-card-off-outline" size={64} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>Could not load payments without a stall id.</Text>
          </View>
        ) : isFilterEmpty ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="filter-variant" size={56} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>No payments match this method filter.</Text>
            <TouchableOpacity style={styles.clearFilterChip} onPress={() => setMethodFilter('all')} activeOpacity={0.85}>
              <Text style={styles.clearFilterChipText}>Show all</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {showPendingBankSection ? (
              <View style={styles.pendingSection}>
                <Text style={styles.sectionHeading}>Awaiting verification</Text>
                {pendingBankTransfers.map((pb) => {
                  const pid = String(pb._id ?? '');
                  const busy = pendingActionId === pid;
                  return (
                    <View key={pid} style={styles.pendingCard}>
                      <View style={styles.pendingCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.orderId}>Bank transfer slip</Text>
                          <Text style={styles.date}>
                            Submitted · {dayjs(pb.createdAt).format('DD MMM YYYY, hh:mm A')}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: WARNING + '28' }]}>
                          <Text style={[styles.statusText, { color: '#B88900' }]}>Needs review</Text>
                        </View>
                      </View>
                      <View style={styles.userRow}>
                        <MaterialCommunityIcons name="account-outline" size={16} color={TEXT_GRAY} />
                        <Text style={styles.userName}>{pb.user?.name || 'Customer'}</Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.amount}>Rs. {pb.totalAmount}</Text>
                        <Text style={styles.method}>Pickup {dayjs(pb.pickupTime).format('DD MMM, hh:mm A')}</Text>
                      </View>
                      {pb.paymentSlip ? (
                        <Image
                          source={{ uri: pb.paymentSlip }}
                          style={styles.pendingSlipThumb}
                          resizeMode="contain"
                        />
                      ) : null}
                      <View style={styles.pendingActionsRow}>
                        <TouchableOpacity
                          style={[styles.pendingRejectBtn, busy && styles.pendingBtnBusy]}
                          onPress={() => handleRejectPendingBank(pid)}
                          disabled={busy}>
                          <MaterialCommunityIcons name="close-circle-outline" size={18} color={DANGER} />
                          <Text style={styles.pendingRejectBtnText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pendingApproveBtn, busy && styles.pendingBtnBusy]}
                          onPress={() => handleApprovePendingBank(pid)}
                          disabled={busy}>
                          {busy ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <MaterialCommunityIcons name="check-decagram-outline" size={18} color="#fff" />
                              <Text style={styles.pendingApproveBtnText}>Verify & place order</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {filteredPayments.length > 0 ? (
              <>
                <Text
                  style={[styles.sectionHeading, showPendingBankSection && styles.sectionHeadingPayments]}>
                  Payment records
                </Text>
                {filteredPayments.map((p) => {
                  const archivable = canArchivalDeletePayment(p);
                  return (
                    <View key={p._id} style={styles.card}>
                      <TouchableOpacity activeOpacity={0.85} onPress={() => openPayment(p)}>
                        <View style={styles.rowTop}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.orderId} numberOfLines={1}>
                              {typeof p.order === 'object' && p.order?.orderId
                                ? p.order.orderId
                                : 'Order (details loading)'}
                            </Text>
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
                      <TouchableOpacity
                        style={[styles.archiveDeleteListRow, !archivable && styles.archiveDeleteListRowMuted]}
                        onPress={() => archivable && handleDeletePayment(String(p._id))}
                        disabled={!archivable}
                        activeOpacity={archivable ? 0.65 : 1}
                        accessibilityState={{ disabled: !archivable }}
                        accessibilityLabel={
                          archivable
                            ? 'Delete archived payment record'
                            : 'Delete payment (only available after 10 years)'
                        }>
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={18}
                          color={archivable ? DANGER : TEXT_GRAY}
                        />
                        <Text style={[styles.archiveDeleteListText, !archivable && styles.archiveDeleteListTextMuted]}>
                          Delete archived record
                        </Text>
                      </TouchableOpacity>
                      {!archivable ? (
                        <Text style={styles.archiveDeleteListHint}>
                          Available when this record is older than {ARCHIVE_DELETE_RETENTION_YEARS} years.
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </>
            ) : null}
          </>
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

            {selected ? (
              <>
                <ScrollView
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.modalScrollPadding}>
                  <Text style={styles.detailLine}>
                    Order ID:{' '}
                    {typeof selected.order === 'object' && selected.order?.orderId != null
                      ? selected.order.orderId
                      : '—'}
                  </Text>
                  <Text style={styles.detailLineMuted}>
                    Amount: Rs. {selected.amount} · {selected.method}
                  </Text>

                  <Text style={styles.label}>Payment status</Text>
                  {typeof selected.order === 'object' &&
                  selected.order &&
                  selected.method === 'Card' &&
                  selected.status !== 'Failed' ? (
                    <View style={styles.infoBox}>
                      <MaterialCommunityIcons name="check-circle" size={18} color={SUCCESS} />
                      <Text style={styles.infoBoxText}>
                        Card payments are verified automatically and set to Paid.
                      </Text>
                    </View>
                  ) : typeof selected.order === 'object' && selected.order ? (
                    <View style={{ marginBottom: 8 }}>
                      <View style={styles.optionsRow}>
                        {['Pending', 'Paid', 'Failed'].map((s) => (
                          <TouchableOpacity
                            key={s}
                            disabled={updating}
                            style={[
                              styles.optionChip,
                              draftPaymentStatus === s && styles.optionChipActive,
                            ]}
                            onPress={() => !updating && setDraftPaymentStatus(s)}>
                            <Text
                              style={[
                                styles.optionText,
                                draftPaymentStatus === s && styles.optionTextActive,
                              ]}>
                              {s}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.paymentHint}>Choose a status, then tap Save changes.</Text>
                    </View>
                  ) : (
                    <Text style={styles.detailLineMuted}>
                      Order link missing — pull to refresh. Amount Rs. {selected.amount} ({selected.method}).
                    </Text>
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

                  <Text style={styles.label}>Record retention</Text>
                  <TouchableOpacity
                    style={[
                      styles.archiveDeleteModalBtn,
                      !canArchivalDeletePayment(selected) && styles.archiveDeleteModalBtnDisabled,
                    ]}
                    onPress={() =>
                      canArchivalDeletePayment(selected) && handleDeletePayment(String(selected._id))
                    }
                    disabled={!canArchivalDeletePayment(selected)}
                    activeOpacity={canArchivalDeletePayment(selected) ? 0.85 : 1}
                    accessibilityState={{ disabled: !canArchivalDeletePayment(selected) }}>
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={20}
                      color={canArchivalDeletePayment(selected) ? '#fff' : TEXT_GRAY}
                    />
                    <Text
                      style={[
                        styles.archiveDeleteModalBtnText,
                        !canArchivalDeletePayment(selected) && styles.archiveDeleteModalBtnTextMuted,
                      ]}>
                      Delete archived record
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.archiveDeleteModalHint}>
                    {canArchivalDeletePayment(selected)
                      ? `This permanently removes this payment row. Intended for records older than ${ARCHIVE_DELETE_RETENTION_YEARS} years only.`
                      : `Deletes are disabled until this payment is older than ${ARCHIVE_DELETE_RETENTION_YEARS} years.`}
                  </Text>
                </ScrollView>
                {canEditPaymentStatusChips ? (
                  <TouchableOpacity
                    style={[styles.saveChangesBtn, (!paymentStatusDirty || updating) && styles.saveChangesBtnDisabled]}
                    onPress={() => savePaymentStatusDraft()}
                    disabled={!paymentStatusDirty || updating || !orderId}
                    activeOpacity={0.9}>
                    {updating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />
                        <Text style={styles.saveChangesBtnText}>Save changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </>
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
  headerCount: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: '600',
    marginTop: 4,
  },
  headerPendingHighlight: {
    color: '#B88900',
    fontWeight: '800',
  },
  methodFilterBar: {
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME_COLORS.border,
  },
  methodFilterBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  methodFilterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F0F4F4',
    borderWidth: 1,
    borderColor: '#E2ECEC',
  },
  methodFilterChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  methodFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  methodFilterChipTextActive: {
    color: SURFACE,
  },
  clearFilterChip: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PRIMARY + '18',
    borderWidth: 1,
    borderColor: PRIMARY + '55',
    alignSelf: 'center',
  },
  clearFilterChipText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY,
  },
  pendingSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 10,
  },
  sectionHeadingPayments: {
    marginTop: 4,
  },
  pendingCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: WARNING + '55',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  pendingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pendingSlipThumb: {
    width: '100%',
    height: 160,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#F7FAFC',
  },
  pendingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  pendingRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DANGER + 'CC',
    backgroundColor: '#FEF2F2',
  },
  pendingApproveBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PRIMARY,
  },
  pendingBtnBusy: {
    opacity: 0.65,
  },
  pendingRejectBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: DANGER,
  },
  pendingApproveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  bannerWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  bannerWarnText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_DARK,
    fontWeight: '600',
    lineHeight: 18,
  },
  scrollContent: { padding: 16 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: {
    fontSize: 16,
    color: TEXT_GRAY,
    marginTop: 16,
    textAlign: 'center',
  },
  archiveDeleteListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF0',
  },
  archiveDeleteListRowMuted: {
    opacity: 0.85,
  },
  archiveDeleteListText: {
    fontSize: 14,
    fontWeight: '800',
    color: DANGER,
  },
  archiveDeleteListTextMuted: {
    color: TEXT_GRAY,
    fontWeight: '700',
  },
  archiveDeleteListHint: {
    fontSize: 11,
    color: TEXT_GRAY,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  archiveDeleteModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: DANGER,
  },
  archiveDeleteModalBtnDisabled: {
    backgroundColor: '#E8ECF0',
  },
  archiveDeleteModalBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  archiveDeleteModalBtnTextMuted: {
    color: TEXT_GRAY,
  },
  archiveDeleteModalHint: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 10,
    lineHeight: 17,
    fontWeight: '600',
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
    paddingBottom: 22,
    maxHeight: '90%',
  },
  modalScrollPadding: {
    paddingBottom: 8,
  },
  paymentHint: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 10,
    lineHeight: 17,
    fontWeight: '600',
  },
  saveChangesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  saveChangesBtnDisabled: {
    opacity: 0.42,
  },
  saveChangesBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
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
