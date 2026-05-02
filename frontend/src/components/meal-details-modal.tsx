import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Text as RNText,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../context/CartContext';
import api from '../services/api';

const { width } = Dimensions.get('window');
const PRIMARY = '#0F5B57';
const PRIMARY_DARK = '#0B3F3C';
const PRIMARY_SOFT = '#E7F3F2';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

interface MealDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  meal: any;
}

export default function MealDetailsModal({ visible, onClose, meal }: MealDetailsModalProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  // fetch review stats from api
  const [stats, setStats] = useState<{ averageRating: number; reviewCount: number }>({ averageRating: 0, reviewCount: 0 });
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (visible && meal?._id) {
      api.get(`/reviews/stats/${meal._id}`)
        .then(res => setStats(res.data))
        .catch(err => console.error('Error fetching meal stats:', err));
    }
  }, [visible, meal?._id]);

  // Reset quantity when modal opens for a new meal
  useEffect(() => {
    if (visible) {
      setQuantity(1);
    }
  }, [visible, meal?._id]);

  if (!meal) return null;

  const isOutOfStock = (meal.quantity ?? 0) <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(meal, quantity);
    onClose();
    router.push('/user/cart');
  };

  const increment = () => {
    if (quantity < (meal.quantity ?? 0)) {
      setQuantity(q => q + 1);
    }
  };

  const decrement = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: meal.image || 'https://via.placeholder.com/300?text=No+Image' }}
                style={styles.image}
              />
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <MaterialCommunityIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{meal.name}</Text>
                <Text style={styles.price}>Rs. {meal.price}</Text>
              </View>

              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingValue}>{stats.averageRating}</Text>
                <Text style={styles.reviewCount}>({stats.reviewCount} {stats.reviewCount === 1 ? 'review' : 'reviews'})</Text>
              </View>

              {meal?.stall?.name && (
                <View style={styles.stallRow}>
                  <MaterialCommunityIcons name="storefront-outline" size={16} color={TEXT_GRAY} />
                  <Text style={styles.stallName} numberOfLines={1}>{meal.stall.name}</Text>
                </View>
              )}

              <View style={styles.qtyBadge}>
                <MaterialCommunityIcons name="tag-outline" size={14} color={isOutOfStock ? '#EE5253' : PRIMARY} />
                <Text style={[styles.qtyText, isOutOfStock && { color: '#EE5253' }]}>
                  {isOutOfStock ? 'Out of Stock' : `${meal.quantity ?? 0} available`}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{meal.description}</Text>

              {!isOutOfStock && (
                <View style={styles.quantitySection}>
                  <Text style={styles.sectionTitle}>Select Quantity</Text>
                  <View style={styles.quantityPicker}>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={decrement}
                      disabled={quantity <= 1}
                    >
                      <MaterialCommunityIcons name="minus" size={20} color={quantity <= 1 ? '#CCC' : PRIMARY} />
                    </TouchableOpacity>
                    
                    <View style={styles.qtyValueContainer}>
                      <Text style={styles.qtyValue}>{quantity}</Text>
                    </View>

                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={increment}
                      disabled={quantity >= (meal.quantity ?? 0)}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color={quantity >= (meal.quantity ?? 0) ? '#CCC' : PRIMARY} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.orderBtn, isOutOfStock && styles.disabledBtn]} 
                  onPress={handleAddToCart}
                  disabled={isOutOfStock}
                >
                  <MaterialCommunityIcons name="cart-outline" size={22} color="#fff" />
                  <Text style={styles.orderBtnText}>
                    {isOutOfStock ? 'Currently Unavailable' : 'Add to cart'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.reviewBtn} 
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/user/add-review', params: { mealId: meal._id } });
                  }}
                > 
                  <MaterialCommunityIcons name="star-outline" size={22} color={PRIMARY} />
                  <Text style={styles.reviewBtnText}>Add Review</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  content: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  imageContainer: { width: '100%', height: 250 },
  image: { width: '100%', height: '100%' },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  body: { padding: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  name: { fontSize: 22, fontWeight: 'bold', color: TEXT_DARK, flex: 1, marginRight: 10 },
  price: { fontSize: 20, fontWeight: '800', color: PRIMARY },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  reviewCount: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  stallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stallName: {
    marginLeft: 8,
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: '700',
    flex: 1,
  },
  qtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_SOFT,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 20
  },
  qtyText: { fontSize: 13, color: PRIMARY, fontWeight: '700', marginLeft: 6 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: TEXT_DARK, marginBottom: 12 },
  description: { fontSize: 15, color: TEXT_GRAY, lineHeight: 22, marginBottom: 20 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantitySection: {
    marginBottom: 24,
  },
  quantityPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    padding: 8,
    alignSelf: 'flex-start',
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  qtyValueContainer: {
    paddingHorizontal: 20,
    minWidth: 50,
    alignItems: 'center',
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  orderBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  disabledBtn: {
    backgroundColor: '#A0A0A0',
    shadowOpacity: 0,
    elevation: 0,
  },
  orderBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  reviewBtn: {
    flex: 1,
    backgroundColor: PRIMARY_SOFT,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  reviewBtnText: {
    color: PRIMARY,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
});
