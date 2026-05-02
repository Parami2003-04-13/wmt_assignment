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
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
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

export default function ManageOrdersScreen() {
  const router = useRouter();
  const { stallId, stallName } = useLocalSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await api.get(`orders/stall/${stallId}`);
      setOrders(res.data);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleUpdateOrder = async (orderId: string, updates: any) => {
    setUpdating(true);
    try {
      await api.patch(`orders/${orderId}`, updates);
      fetchOrders();
      setEditModalVisible(false);
    } catch (err) {
      console.error('Update order error:', err);
      Alert.alert('Error', 'Failed to update order.');
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



  const handleDeletePayment = async (orderId: string) => {
    try {
      const res = await api.get(`payments/order/${orderId}`);
      const paymentId = res.data._id;

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
                await api.delete(`payments/${paymentId}`);
                fetchOrders();
                setEditModalVisible(false);
                Alert.alert('Success', 'Payment record deleted.');
              } catch (err) {
                console.error('Delete payment error:', err);
                Alert.alert('Error', 'Failed to delete payment record.');
              }
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Error', 'Could not find payment record.');
    }
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
        ) : (
          orders.map((order) => (
            <TouchableOpacity
              key={order._id}
              style={styles.orderCard}
              onPress={() => {
                setSelectedOrder(order);
                setEditModalVisible(true);
              }}
            >
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderId}>{order.orderId}</Text>
                  <Text style={styles.orderDate}>{dayjs(order.createdAt).format('DD MMM, hh:mm A')}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '15' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>{order.status}</Text>
                </View>
              </View>

              <View style={styles.userRow}>
                <MaterialCommunityIcons name="account-outline" size={16} color={TEXT_GRAY} />
                <Text style={styles.userName}>{order.user?.name || 'Customer'}</Text>
              </View>

              <View style={styles.itemsList}>
                {order.items.map((item: any, idx: number) => (
                  <Text key={idx} style={styles.itemText}>{item.quantity}x {item.name}</Text>
                ))}
              </View>

              <View style={styles.divider} />

              <View style={styles.orderFooter}>
                <View>
                  <Text style={styles.totalLabel}>Total: Rs. {order.totalAmount}</Text>
                  <Text style={styles.pickupTime}>Pickup: {dayjs(order.pickupTime).format('hh:mm A')}</Text>
                  <Text style={styles.nonRefundableText}>Non-refundable</Text>
                </View>
                <View style={styles.paymentInfo}>
                  <View style={[styles.paymentStatusBadge, { backgroundColor: getPaymentStatusColor(order.paymentStatus) + '15' }]}>
                    <Text style={[styles.paymentStatusText, { color: getPaymentStatusColor(order.paymentStatus) }]}>
                      {order.paymentStatus}
                    </Text>
                  </View>
                  <Text style={styles.paymentMethod}>{order.paymentMethod}</Text>

                  {(order.status === 'Completed' || order.status === 'Cancelled') && (
                    <TouchableOpacity
                      style={styles.deleteOrderBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteOrder(order._id);
                      }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={DANGER} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Edit Order Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Order</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView>
                <Text style={styles.label}>Order Status</Text>
                <View style={styles.optionsRow}>
                  {['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.optionChip, selectedOrder.status === s && styles.optionChipActive]}
                      onPress={() => {
                        if (s === 'Cancelled') {
                          Alert.alert(
                            'Cancel Order',
                            'Are you sure you want to cancel this order? This will restore the meal stock. Continue?',
                            [
                              { text: 'No', style: 'cancel' },
                              { 
                                text: 'Yes, Cancel', 
                                style: 'destructive',
                                onPress: () => handleUpdateOrder(selectedOrder._id, { status: s }) 
                              }
                            ]
                          );
                        } else {
                          handleUpdateOrder(selectedOrder._id, { status: s });
                        }
                      }}
                    >
                      <Text style={[styles.optionText, selectedOrder.status === s && styles.optionTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Payment Status</Text>
                {selectedOrder.paymentMethod === 'Card' ? (
                  <View style={styles.infoBox}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={SUCCESS} />
                    <Text style={styles.infoBoxText}>Card payments are automatically verified and set to Paid.</Text>
                  </View>
                ) : (
                  <View style={styles.optionsRow}>
                    {['Pending', 'Paid', 'Failed'].map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.optionChip, selectedOrder.paymentStatus === s && styles.optionChipActive]}
                        onPress={() => {
                          if (s === 'Failed') {
                            Alert.alert(
                              'Payment Failed',
                              'Marking this payment as Failed will automatically Cancel the order and restore the meal stock. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                  text: 'Yes, Mark Failed', 
                                  style: 'destructive',
                                  onPress: () => handleUpdateOrder(selectedOrder._id, { paymentStatus: s }) 
                                }
                              ]
                            );
                          } else {
                            handleUpdateOrder(selectedOrder._id, { paymentStatus: s });
                          }
                        }}
                      >
                        <Text style={[styles.optionText, selectedOrder.paymentStatus === s && styles.optionTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={styles.label}>Order Confirmation Photo</Text>
                {selectedOrder.orderPhoto ? (
                  <View style={styles.photoContainer}>
                    <Image source={{ uri: selectedOrder.orderPhoto }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.changePhotoBtn} onPress={() => uploadOrderPhoto(selectedOrder._id)}>
                      <Text style={styles.changePhotoText}>Change Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBtn} onPress={() => uploadOrderPhoto(selectedOrder._id)}>
                    <MaterialCommunityIcons name="camera-plus-outline" size={32} color={PRIMARY} />
                    <Text style={styles.uploadText}>Upload Photo</Text>
                  </TouchableOpacity>
                )}

                {selectedOrder.paymentMethod === 'Bank Transfer' && (
                  <View style={styles.slipSection}>
                    <Text style={styles.label}>Bank Slip</Text>
                    <PaymentSlipView
                      orderId={selectedOrder._id}
                      onDeleteSuccess={() => {
                        fetchOrders();
                        setEditModalVisible(false);
                      }}
                      paymentMethod={selectedOrder.paymentMethod}
                      paymentStatus={selectedOrder.paymentStatus}
                    />
                  </View>
                )}

                {selectedOrder.paymentMethod === 'Card' && selectedOrder.paymentStatus === 'Failed' && (
                  <View style={styles.slipSection}>
                    <Text style={styles.label}>Payment Status: Failed</Text>
                    <TouchableOpacity
                      style={styles.deletePaymentBtn}
                      onPress={() => handleDeletePayment(selectedOrder._id)}
                    >
                      <MaterialCommunityIcons name="credit-card-remove-outline" size={20} color="#fff" />
                      <Text style={styles.deletePaymentBtnText}>Delete Failed Card Record</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PaymentSlipView({ orderId, onDeleteSuccess, paymentMethod, paymentStatus }: any) {
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const res = await api.get(`payments/order/${orderId}`);
        setPayment(res.data);
      } catch (err) {
        console.error('Fetch payment error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayment();
  }, [orderId]);

  const handleDelete = async () => {
    Alert.alert(
      'Delete Bank Slip',
      'Are you sure you want to delete this bank slip record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`payments/${payment._id}`);
              onDeleteSuccess();
              Alert.alert('Success', 'Payment record deleted.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete payment.');
            }
          }
        }
      ]
    );
  };

  if (loading) return <ActivityIndicator color={PRIMARY} />;
  if (!payment || !payment.paymentSlip) return <Text style={{ color: TEXT_GRAY }}>No slip uploaded.</Text>;

  return (
    <View>
      <Image source={{ uri: payment.paymentSlip }} style={styles.photoPreview} resizeMode="contain" />
      <TouchableOpacity style={styles.deletePaymentInlineBtn} onPress={handleDelete}>
        <MaterialCommunityIcons name="trash-can-outline" size={16} color={DANGER} />
        <Text style={styles.deletePaymentInlineText}>Delete Bank Slip Record</Text>
      </TouchableOpacity>
    </View>
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  userName: {
    fontSize: 14,
    color: TEXT_DARK,
    marginLeft: 6,
    fontWeight: '600',
  },
  itemsList: {
    marginTop: 10,
  },
  itemText: {
    fontSize: 14,
    color: TEXT_GRAY,
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
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 4,
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
  deleteOrderBtn: {
    marginTop: 8,
    padding: 5,
    backgroundColor: '#FFF5F5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  deletePaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DANGER,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
  },
  deletePaymentBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deletePaymentInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'center',
    padding: 5,
  },
  deletePaymentInlineText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
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
  slipSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
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
