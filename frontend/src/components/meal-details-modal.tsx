import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
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

  if (!meal) return null;

  const handleAddToCart = () => {
    addToCart(meal);
    onClose();
    router.push('/user/cart');
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

              {meal?.stall?.name && (
                <View style={styles.stallRow}>
                  <MaterialCommunityIcons name="storefront-outline" size={16} color={TEXT_GRAY} />
                  <Text style={styles.stallName} numberOfLines={1}>{meal.stall.name}</Text>
                </View>
              )}

              <View style={styles.qtyBadge}>
                <MaterialCommunityIcons name="tag-outline" size={14} color={PRIMARY} />
                <Text style={styles.qtyText}>{meal.quantity ?? 0} available</Text>
              </View>

              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{meal.description}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.orderBtn} onPress={handleAddToCart}>
                  <MaterialCommunityIcons name="cart-outline" size={22} color="#fff" />
                  <Text style={styles.orderBtnText}>Add to cart</Text>
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
    maxHeight: '85%',
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
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: TEXT_DARK, marginBottom: 10 },
  description: { fontSize: 15, color: TEXT_GRAY, lineHeight: 22, marginBottom: 30 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
