import React from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '../../context/CartContext';

const PRIMARY = '#0F5B57';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const BG = '#F5F7F7';
const SURFACE = '#FFFFFF';
const DANGER = '#FF4757';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

export default function CartScreen() {
  const router = useRouter();
  const { cartItems, removeFromCart, clearCart, cartTotal } = useCart();

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    Alert.alert('Checkout Successful', 'Your order has been placed!', [
      {
        text: 'OK',
        onPress: () => {
          clearCart();
          router.replace('/user/dashboard');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <View style={{ width: 24 }} /> {/* Placeholder for alignment */}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {cartItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="cart-remove" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>Looks like you haven&apos;t added any meals yet.</Text>
            <TouchableOpacity style={styles.browseBtn} onPress={() => router.back()}>
              <Text style={styles.browseBtnText}>Browse Meals</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cartItems.map((item) => (
            <View key={item.meal._id} style={styles.cartItem}>
              <Image source={{ uri: item.meal.image || 'https://via.placeholder.com/150' }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.meal.name}</Text>
                <Text style={styles.itemStall} numberOfLines={1}>
                  {item.meal.stall?.name || 'Stall'}
                </Text>
                <Text style={styles.itemPrice}>Rs. {item.meal.price} x {item.quantity}</Text>
              </View>
              <View style={styles.itemActions}>
                <Text style={styles.itemTotal}>Rs. {item.meal.price * item.quantity}</Text>
                <TouchableOpacity onPress={() => removeFromCart(item.meal._id)} style={styles.removeBtn}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={DANGER} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Footer */}
      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>Rs. {cartTotal}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
            <Text style={styles.checkoutBtnText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    marginTop: 8,
    textAlign: 'center',
  },
  browseBtn: {
    marginTop: 24,
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  itemStall: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '600',
    marginTop: 6,
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  removeBtn: {
    padding: 6,
  },
  footer: {
    backgroundColor: SURFACE,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: TEXT_GRAY,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: PRIMARY,
  },
  checkoutBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
