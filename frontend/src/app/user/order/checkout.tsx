import React, { useState } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '../../../context/CartContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import api, { getStoredUser } from '../../../services/api';

const PRIMARY = '#0F5B57';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const BG = '#F5F7F7';
const SURFACE = '#FFFFFF';
const DANGER = '#FF4757';
const SUCCESS = '#27AE60';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItems, cartTotal, clearCart } = useCart();

  const [pickupTime, setPickupTime] = useState(new Date(Date.now() + 25 * 60000)); // Default +25 mins
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isStudentDiscount, setIsStudentDiscount] = useState(false);
  const [studentIdImage, setStudentIdImage] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Pay at Canteen' | 'Online'>('Pay at Canteen');
  const [loading, setLoading] = useState(false);

  const validateTime = (selectedTime: Date) => {
    const minTime = dayjs().add(20, 'minute');
    if (dayjs(selectedTime).isBefore(minTime)) {
      setTimeError('Pickup time must be at least 20 minutes from now.');
      return false;
    }
    setTimeError(null);
    return true;
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setPickupTime(selectedDate);
      validateTime(selectedDate);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setStudentIdImage(result.assets[0].uri);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateTime(pickupTime)) {
      Alert.alert('Invalid Time', 'Please select a pickup time at least 20 minutes from now.');
      return;
    }

    if (isStudentDiscount && !studentIdImage) {
      Alert.alert('Student ID Required', 'Please upload your Student ID card to claim the discount.');
      return;
    }

    setLoading(true);
    try {
      const user = await getStoredUser();
      if (!user || !user.id) {
        Alert.alert('Error', 'User session expired. Please login again.');
        router.replace('/login');
        return;
      }

      const orderData = {
        userId: user.id,
        items: cartItems.map(item => ({
          meal: item.meal._id,
          name: item.meal.name,
          quantity: item.quantity,
          price: item.meal.price
        })),
        totalAmount: cartTotal,
        pickupTime: pickupTime.toISOString(),
        isStudentDiscount,
        studentIdImage: studentIdImage || '',
        paymentMethod
      };

      const response = await api.post('/orders', orderData);
      const newOrder = response.data;

      clearCart();
      router.replace({
        pathname: '/user/order/success',
        params: { orderId: newOrder.orderId }
      });

    } catch (error: any) {
      console.error('Failed to place order:', error);
      Alert.alert('Order Failed', error.response?.data?.message || 'Something went wrong while placing your order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {cartItems.map((item) => (
            <View key={item.meal._id} style={styles.summaryItem}>
              <Text style={styles.summaryItemName}>{item.meal.name} x {item.quantity}</Text>
              <Text style={styles.summaryItemPrice}>Rs. {item.meal.price * item.quantity}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalAmount}>Rs. {cartTotal}</Text>
          </View>
        </View>

        {/* Pickup Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup Time</Text>
          <TouchableOpacity 
            style={[styles.timeSelector, timeError ? styles.errorBorder : null]} 
            onPress={() => setShowTimePicker(true)}
          >
            <MaterialCommunityIcons name="clock-outline" size={24} color={PRIMARY} />
            <Text style={styles.timeText}>
              {dayjs(pickupTime).format('hh:mm A')}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={TEXT_GRAY} />
          </TouchableOpacity>
          {timeError && <Text style={styles.errorText}>{timeError}</Text>}
          <Text style={styles.hintText}>* Pickup time must be at least 20 minutes from now.</Text>
          
          {showTimePicker && (
            <DateTimePicker
              value={pickupTime}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={onTimeChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity 
            style={[styles.paymentOption, paymentMethod === 'Pay at Canteen' ? styles.paymentSelected : null]}
            onPress={() => setPaymentMethod('Pay at Canteen')}
          >
            <MaterialCommunityIcons 
              name={paymentMethod === 'Pay at Canteen' ? "radiobox-marked" : "radiobox-blank"} 
              size={24} 
              color={paymentMethod === 'Pay at Canteen' ? PRIMARY : TEXT_GRAY} 
            />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Pay at Canteen</Text>
              <Text style={styles.paymentDesc}>Pay with cash or card when you pickup</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.paymentOption, paymentMethod === 'Online' ? styles.paymentSelected : null]}
            onPress={() => setPaymentMethod('Online')}
          >
            <MaterialCommunityIcons 
              name={paymentMethod === 'Online' ? "radiobox-marked" : "radiobox-blank"} 
              size={24} 
              color={paymentMethod === 'Online' ? PRIMARY : TEXT_GRAY} 
            />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Online Payment</Text>
              <Text style={styles.paymentDesc}>Pay securely via card or mobile wallet</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.discountRow}>
            <View>
              <Text style={styles.sectionTitle}>Student Discount</Text>
              <Text style={styles.discountSubtitle}>Upload ID for 10% off (pending verification)</Text>
            </View>
            <Switch
              value={isStudentDiscount}
              onValueChange={(value) => setIsStudentDiscount(value)}
              trackColor={{ false: '#CBD5E1', true: PRIMARY }}
              thumbColor="#FFFFFF"
            />
          </View>

          {isStudentDiscount && (
            <View style={styles.uploadContainer}>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                {studentIdImage ? (
                  <Image source={{ uri: studentIdImage }} style={styles.uploadedImage} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera-plus-outline" size={32} color={PRIMARY} />
                    <Text style={styles.uploadText}>Upload Student ID Card</Text>
                  </>
                )}
              </TouchableOpacity>
              {studentIdImage && (
                <TouchableOpacity onPress={() => setStudentIdImage(null)} style={styles.removeImageBtn}>
                  <Text style={styles.removeImageText}>Remove & Re-upload</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.placeOrderBtn, loading ? styles.disabledBtn : null]} 
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.placeOrderBtnText}>Place Order</Text>
          )}
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
    padding: 20,
  },
  section: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryItemName: {
    fontSize: 14,
    color: TEXT_GRAY,
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 14,
    color: TEXT_DARK,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY,
  },
  timeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorBorder: {
    borderColor: DANGER,
  },
  timeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: TEXT_DARK,
  },
  errorText: {
    color: DANGER,
    fontSize: 12,
    marginTop: 6,
  },
  hintText: {
    color: TEXT_GRAY,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 12,
  },
  paymentSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#F0F9F9',
  },
  paymentInfo: {
    marginLeft: 12,
  },
  paymentName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  paymentDesc: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountSubtitle: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: -8,
    marginBottom: 10,
  },
  uploadContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  uploadBtn: {
    width: '100%',
    height: 150,
    borderWidth: 2,
    borderColor: PRIMARY,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9F9',
    overflow: 'hidden',
  },
  uploadText: {
    color: PRIMARY,
    fontWeight: '600',
    marginTop: 8,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    marginTop: 10,
  },
  removeImageText: {
    color: DANGER,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  placeOrderBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  placeOrderBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
