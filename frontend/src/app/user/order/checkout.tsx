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
  ActivityIndicator,
  TextInput,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '../../../context/CartContext';
import DateTimePicker from '@react-native-community/datetimepicker';

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
  const [timeError, setTimeError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'Pay at Stall' | 'Card' | 'Bank Transfer'>('Pay at Stall');
  const [stallBankDetails, setStallBankDetails] = useState<any>(null);
  const [bankSlip, setBankSlip] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    holderName: '',
  });

  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (cartItems.length > 0) {
      const stallId = cartItems[0].meal.stall._id || cartItems[0].meal.stall;
      fetchStallDetails(stallId);
    }
  }, [cartItems]);

  const fetchStallDetails = async (stallId: string) => {
    try {
      const res = await api.get(`stalls/${stallId}`);
      setStallBankDetails(res.data);
    } catch (err) {
      console.error('Fetch stall details error:', err);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setBankSlip(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

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



  const finalTotal = cartTotal;



  const handlePlaceOrder = async () => {
    if (!validateTime(pickupTime)) {
      Alert.alert('Invalid Time', 'Please select a pickup time at least 20 minutes from now.');
      return;
    }

    setLoading(true);

    if (paymentMethod === 'Card') {
      const rawNumber = cardDetails.number.replace(/\s/g, '');
      if (!rawNumber || rawNumber.length !== 16) {
        Alert.alert('Invalid Card', 'Card number must be 16 digits.');
        setLoading(false);
        return;
      }
      if (!cardDetails.expiry || !/^\d{2}\/\d{2}$/.test(cardDetails.expiry)) {
        Alert.alert('Invalid Expiry', 'Expiry date must be in MM/YY format.');
        setLoading(false);
        return;
      }
      const [month] = cardDetails.expiry.split('/').map(Number);
      if (month < 1 || month > 12) {
        Alert.alert('Invalid Expiry', 'Month must be between 01 and 12.');
        setLoading(false);
        return;
      }
      if (!cardDetails.cvv || (cardDetails.cvv.length !== 3 && cardDetails.cvv.length !== 4)) {
        Alert.alert('Invalid CVV', 'CVV must be 3 or 4 digits.');
        setLoading(false);
        return;
      }
      if (!cardDetails.holderName || cardDetails.holderName.trim().length < 3) {
        Alert.alert('Invalid Name', 'Please enter the card holder name.');
        setLoading(false);
        return;
      }
    }

    if (paymentMethod === 'Bank Transfer' && !bankSlip) {
      Alert.alert('Missing Slip', 'Please upload your bank transfer slip.');
      setLoading(false);
      return;
    }

    if (paymentMethod === 'Card') {
      try {
        // Simulate Online Payment Processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Online payment successful');
      } catch (err) {
        console.error('Payment simulation error:', err);
        setLoading(false);
        return;
      }
    }

    try {
      const user = await getStoredUser();
      if (!user || !user.id) {
        Alert.alert('Error', 'User session expired. Please login again.');
        router.replace('/login');
        return;
      }

      const stallIdRaw = cartItems[0].meal.stall._id || cartItems[0].meal.stall;
      const stallId = String(stallIdRaw);

      const lineItems = cartItems.map((item) => ({
        meal: item.meal._id,
        name: item.meal.name,
        quantity: item.quantity,
        price: item.meal.price,
      }));

      if (paymentMethod === 'Bank Transfer') {
        const pendingRes = await api.post('pending-bank-transfers', {
          userId: user.id,
          stallId,
          items: lineItems,
          totalAmount: finalTotal,
          pickupTime: pickupTime.toISOString(),
          paymentSlip: bankSlip,
        });

        clearCart();
        router.replace({
          pathname: '/user/order/success',
          params: {
            paymentMethod: 'Bank Transfer',
            verificationPending: '1',
            submissionId: pendingRes?.data?._id != null ? String(pendingRes.data._id) : '',
          },
        });
        return;
      }

      const orderData = {
        userId: user.id,
        stallId,
        items: lineItems,
        totalAmount: finalTotal,
        pickupTime: pickupTime.toISOString(),
        paymentMethod,
        cardHolderName: paymentMethod === 'Card' ? cardDetails.holderName : undefined,
        cardLastFour: paymentMethod === 'Card' ? cardDetails.number.replace(/\s/g, '').slice(-4) : undefined,
      };

      const response = await api.post('orders', orderData);

      const newOrder = response.data;

      clearCart();
      router.replace({
        pathname: '/user/order/success',
        params: { orderId: newOrder.orderId },
      });

    } catch (error: any) {
      if (__DEV__) {
        console.warn('Checkout request failed:', error?.message ?? error);
      }
      const serverMsg = error.response?.data?.message;
      const isBank = paymentMethod === 'Bank Transfer';
      if (isBank) {
        Alert.alert(
          'Could not send your slip',
          serverMsg ||
            'Check your connection and try again. After it is sent successfully, stall staff will verify your transfer and you will be notified.',
        );
      } else {
        Alert.alert('Order Failed', serverMsg || 'Something went wrong while placing your order.');
      }
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
            <Text style={styles.totalAmount}>Rs. {finalTotal}</Text>
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
          <Text style={styles.nonRefundableHint}>* All payments are non-refundable once placed.</Text>

          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'Pay at Stall' ? styles.paymentSelected : null]}
            onPress={() => setPaymentMethod('Pay at Stall')}
          >
            <MaterialCommunityIcons
              name={paymentMethod === 'Pay at Stall' ? "radiobox-marked" : "radiobox-blank"}
              size={24}
              color={paymentMethod === 'Pay at Stall' ? PRIMARY : TEXT_GRAY}
            />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Pay at Stall</Text>
              <Text style={styles.paymentDesc}>Pay with cash or card when you pickup</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'Card' ? styles.paymentSelected : null]}
            onPress={() => setPaymentMethod('Card')}
          >
            <MaterialCommunityIcons
              name={paymentMethod === 'Card' ? "radiobox-marked" : "radiobox-blank"}
              size={24}
              color={paymentMethod === 'Card' ? PRIMARY : TEXT_GRAY}
            />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Pay with Card</Text>
              <Text style={styles.paymentDesc}>Secure online payment via card</Text>
            </View>
          </TouchableOpacity>

          {paymentMethod === 'Card' && (
            <View style={styles.subSection}>
              <TextInput
                style={styles.input}
                placeholder="Card Holder Name"
                value={cardDetails.holderName}
                onChangeText={(t) => setCardDetails({ ...cardDetails, holderName: t })}
              />

              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="XXXX XXXX XXXX XXXX"
                keyboardType="numeric"
                maxLength={19}
                value={cardDetails.number}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^0-9]/g, '');
                  const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
                  setCardDetails({ ...cardDetails, number: formatted });
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="MM/YY"
                  keyboardType="numeric"
                  maxLength={5}
                  value={cardDetails.expiry}
                  onChangeText={(t) => {
                    let cleaned = t.replace(/[^0-9]/g, '');
                    if (cleaned.length >= 2) {
                      const month = parseInt(cleaned.substring(0, 2));
                      if (month > 12) cleaned = '12' + cleaned.substring(2);
                      if (month === 0 && cleaned.length === 2) cleaned = '01';
                    }
                    let formatted = cleaned;
                    if (cleaned.length > 2) {
                      formatted = cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
                    }
                    setCardDetails({ ...cardDetails, expiry: formatted });
                  }}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="CVV (3-4 digits)"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                  value={cardDetails.cvv}
                  onChangeText={(t) => setCardDetails({ ...cardDetails, cvv: t.replace(/[^0-9]/g, '') })}
                />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'Bank Transfer' ? styles.paymentSelected : null]}
            onPress={() => setPaymentMethod('Bank Transfer')}
          >
            <MaterialCommunityIcons
              name={paymentMethod === 'Bank Transfer' ? "radiobox-marked" : "radiobox-blank"}
              size={24}
              color={paymentMethod === 'Bank Transfer' ? PRIMARY : TEXT_GRAY}
            />
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Bank Transfer</Text>
              <Text style={styles.paymentDesc}>Transfer to stall account and upload slip</Text>
            </View>
          </TouchableOpacity>

          {paymentMethod === 'Bank Transfer' && stallBankDetails && (
            <View style={styles.subSection}>
              <View style={styles.bankInfoBox}>
                <Text style={styles.bankInfoTitle}>Stall Bank Details</Text>
                <Text style={styles.bankInfoText}>Bank: {stallBankDetails.bankName || 'N/A'}</Text>
                <Text style={styles.bankInfoText}>Branch: {stallBankDetails.branchName || 'N/A'}</Text>
                <Text style={styles.bankInfoText}>Acc Name: {stallBankDetails.accountName || 'N/A'}</Text>
                <Text style={styles.bankInfoText}>Acc No: {stallBankDetails.accountNumber || 'N/A'}</Text>
                <Text style={[styles.bankInfoText, { fontWeight: 'bold', marginTop: 5 }]}>Amount: Rs. {finalTotal}</Text>
              </View>

              <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                {bankSlip ? (
                  <Image source={{ uri: bankSlip }} style={styles.uploadedImage} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="upload" size={32} color={PRIMARY} />
                    <Text style={styles.uploadText}>Upload Payment Slip</Text>
                  </>
                )}
              </TouchableOpacity>
              {bankSlip && (
                <TouchableOpacity onPress={() => setBankSlip(null)} style={styles.removeBtn}>
                  <Text style={styles.removeText}>Remove Slip</Text>
                </TouchableOpacity>
              )}

              <View style={styles.bankVerifyNotice}>
                <MaterialCommunityIcons name="account-check-outline" size={22} color={PRIMARY} />
                <Text style={styles.bankVerifyNoticeText}>
                  Your payment slip will be verified by stall staff. This is not an instant confirmation — you will be notified when your payment is approved and your order is confirmed.
                </Text>
              </View>
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
  subSection: {
    marginTop: 10,
    paddingLeft: 36,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  bankInfoBox: {
    backgroundColor: '#F7FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  bankInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginBottom: 5,
  },
  bankInfoText: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginBottom: 2,
  },
  uploadBtn: {
    height: 120,
    borderWidth: 1,
    borderColor: PRIMARY,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9F9',
    overflow: 'hidden',
  },
  uploadText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 5,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    marginTop: 5,
    alignItems: 'center',
  },
  removeText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: '600',
  },
  bankVerifyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: PRIMARY + '12',
    borderWidth: 1,
    borderColor: PRIMARY + '35',
  },
  bankVerifyNoticeText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_DARK,
    lineHeight: 19,
    fontWeight: '600',
  },
  nonRefundableHint: {
    fontSize: 12,
    color: DANGER,
    marginBottom: 10,
    fontWeight: '600',
  },
  cardLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  logoLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginLeft: 10,
    fontWeight: '600',
  },
});
