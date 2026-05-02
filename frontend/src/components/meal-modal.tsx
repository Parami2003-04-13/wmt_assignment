import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { COLORS } from '../theme/colors';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

const CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Drinks'] as const;

interface MealModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  stallId: string;
  meal?: any; // If provided, we are editing
}

export default function MealModal({ visible, onClose, onSave, stallId, meal }: MealModalProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '',
    category: '',
    image: null as string | null,
  });

  useEffect(() => {
    if (meal) {
      setFormData({
        name: meal.name,
        description: meal.description,
        price: meal.price.toString(),
        quantity: meal.quantity.toString(),
        category: meal.category || '',
        image: meal.image || null,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        quantity: '',
        category: '',
        image: null,
      });
    }
  }, [meal, visible]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to choose a meal image.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
    });

    if (!result.canceled) {
      setFormData({ ...formData, image: result.assets[0].uri });
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description || !formData.price || !formData.quantity || !formData.category) {
      Alert.alert('Error', 'Please fill in all mandatory fields, including category.');
      return;
    }

    const photo = formData.image?.trim();
    if (!photo) {
      Alert.alert('Photo required', 'Please add a meal photo before saving.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity, 10),
        category: formData.category,
        image: photo,
        stallId,
      };

      if (meal) {
        await api.patch(`/meals/${meal._id}`, payload);
        Alert.alert('Success', 'Meal updated successfully!');
      } else {
        await api.post('/meals', payload);
        Alert.alert('Success', 'Meal added successfully!');
      }
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Save meal error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save meal.');
    } finally {
      setLoading(false);
    }
  };

  const heroTop = Math.max(insets.top, 12) + 4;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeTop} edges={['bottom']}>
        <View style={styles.root}>
          <View style={styles.hero}>
            <Image
              source={{
                uri: formData.image || 'https://via.placeholder.com/900x650?text=Meal+photo',
              }}
              style={styles.heroImage}
            />
            <View style={styles.heroOverlay} />

            <TouchableOpacity
              style={[styles.heroRoundBtn, { top: heroTop, left: 16 }]}
              onPress={onClose}
              hitSlop={10}
              activeOpacity={0.85}>
              <MaterialCommunityIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroRoundBtn, { top: heroTop, right: 16 }]}
              onPress={pickImage}
              hitSlop={10}
              activeOpacity={0.85}>
              <MaterialCommunityIcons name="camera-outline" size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.heroBadge} onPress={pickImage} activeOpacity={0.88}>
              <MaterialCommunityIcons name="image-edit-outline" size={18} color={COLORS.primary} />
              <Text style={styles.heroBadgeText}>{formData.image ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.screenTitle}>{meal ? 'Edit meal' : 'Add item'}</Text>
              <Text style={styles.screenSubtitle}>
                {meal ? 'Update details and save changes.' : 'Add a photo, set price and stock, then save to your menu.'}
              </Text>

              <Text style={styles.label}>Name</Text>
              <TextInput
                placeholder="Meal name"
                placeholderTextColor={COLORS.textGray}
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />

              <View style={styles.priceQtyRow}>
                <View style={styles.priceQtyCol}>
                  <Text style={styles.label}>Price</Text>
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePrefix}>Rs.</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={COLORS.textGray}
                      style={styles.priceInput}
                      keyboardType="decimal-pad"
                      value={formData.price}
                      onChangeText={(text) => setFormData({ ...formData, price: text })}
                    />
                  </View>
                </View>
                <View style={styles.qtyCol}>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    placeholder="0"
                    placeholderTextColor={COLORS.textGray}
                    style={styles.qtyInput}
                    keyboardType="number-pad"
                    value={formData.quantity}
                    onChangeText={(text) => setFormData({ ...formData, quantity: text })}
                  />
                </View>
              </View>

              <Text style={[styles.label, styles.labelSpaced]}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}>
                {CATEGORIES.map((cat) => {
                  const active = formData.category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryPill, active ? styles.categoryPillOn : styles.categoryPillOff]}
                      onPress={() => setFormData({ ...formData, category: cat })}
                      activeOpacity={0.85}>
                      <Text style={[styles.categoryPillText, active ? styles.categoryPillTextOn : styles.categoryPillTextOff]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.descCard}>
                <View style={styles.descHeader}>
                  <MaterialCommunityIcons name="text-box-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.descTitle}>Description</Text>
                </View>
                <TextInput
                  placeholder="Write a short description"
                  placeholderTextColor={COLORS.textGray}
                  style={styles.descInput}
                  multiline
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, loading && { opacity: 0.72 }]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.88}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{meal ? 'Update meal' : 'Add to menu'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeTop: { flex: 1, backgroundColor: COLORS.background },
  root: { flex: 1, backgroundColor: COLORS.background },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.primarySoft,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 40, 38, 0.32)',
  },
  heroRoundBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  heroBadgeText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  sheet: {
    marginTop: -20,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 18,
    opacity: 0.85,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textGray,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  labelSpaced: { marginTop: 18 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
  },
  priceQtyRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  priceQtyCol: { flex: 1, minWidth: 0 },
  qtyCol: { width: 112 },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: COLORS.background,
  },
  pricePrefix: { fontSize: 14, fontWeight: '900', color: COLORS.textGray },
  priceInput: { flex: 1, fontSize: 16, fontWeight: '900', color: COLORS.primary, minWidth: 0 },
  qtyInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
    textAlign: 'center',
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    marginBottom: 4,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryPillOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryPillOff: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.border,
  },
  categoryPillText: { fontSize: 14, fontWeight: '800' },
  categoryPillTextOn: { color: '#fff' },
  categoryPillTextOff: { color: COLORS.textDark },

  descCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  descHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  descTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  descInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 120,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
    textAlignVertical: 'top',
    backgroundColor: COLORS.background,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
