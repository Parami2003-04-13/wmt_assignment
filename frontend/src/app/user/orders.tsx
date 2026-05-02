import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

export default function UserOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const user = await getStoredUser();
      if (!user) return;
      const res = await api.get(`orders/user/${user.id}`);
      setOrders(res.data);
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

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 50 }} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={TEXT_GRAY} />
            <Text style={styles.emptyText}>You haven&apos;t placed any orders yet.</Text>
            <TouchableOpacity style={styles.orderNowBtn} onPress={() => router.push('/user/dashboard')}>
              <Text style={styles.orderNowText}>Order Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((order) => (
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
                {order.items.map((item: any, idx: number) => (
                  <Text key={idx} style={styles.itemText}>{item.quantity}x {item.name}</Text>
                ))}
              </View>

              <View style={styles.divider} />

              <View style={styles.orderFooter}>
                <View>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>Rs. {order.totalAmount}</Text>
                  <Text style={styles.nonRefundableText}>Non-refundable</Text>
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentMethod}>{order.paymentMethod}</Text>
                  <View style={[styles.paymentStatusBadge, { backgroundColor: getPaymentStatusColor(order.paymentStatus) + '15' }]}>
                    <Text style={[styles.paymentStatusText, { color: getPaymentStatusColor(order.paymentStatus) }]}>
                      {order.paymentStatus}
                    </Text>
                  </View>
                </View>
              </View>

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
  },
  itemText: {
    fontSize: 14,
    color: TEXT_DARK,
    marginBottom: 4,
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
  nonRefundableText: {
    fontSize: 10,
    color: DANGER,
    marginTop: 2,
    fontWeight: '600',
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
});
