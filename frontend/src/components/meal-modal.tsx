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
  SafeAreaView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { COLORS } from '../theme/colors';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

interface MealModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  stallId: string;
  meal?: any; // If provided, we are editing
}

export default function MealModal({ visible, onClose, onSave, stallId, meal }: MealModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '',
    image: null as string | null,
  });

  useEffect(() => {
    if (meal) {
      setFormData({
        name: meal.name,
        description: meal.description,
        price: meal.price.toString(),
        quantity: meal.quantity.toString(),
        image: meal.image || null,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        quantity: '',
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
    if (!formData.name || !formData.description || !formData.price || !formData.quantity) {
      Alert.alert('Error', 'Please fill in all mandatory fields.');
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

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.photoHeader}>
          <Image
            source={{
              uri: formData.image || 'https://via.placeholder.com/900x650?text=Meal+photo',
            }}
            style={styles.photoHeaderImg}
          />
          <View style={styles.photoHeaderShade} />

          <TouchableOpacity style={[styles.iconBtn, { left: 16 }]} onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, { right: 16 }]} onPress={pickImage} hitSlop={10}>
            <MaterialCommunityIcons name="camera-outline" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.photoHeaderBadge}>
            <MaterialCommunityIcons name="image-edit-outline" size={16} color={COLORS.primary} />
            <Text style={styles.photoHeaderBadgeText}>{formData.image ? 'Change photo' : 'Add photo'}</Text>
          </View>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                placeholder="Meal name"
                placeholderTextColor={COLORS.textGray}
                style={styles.titleInput}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
              />
            </View>
            <View style={{ width: 120 }}>
              <Text style={styles.fieldLabel}>Price</Text>
              <View style={styles.pricePill}>
                <Text style={styles.pricePrefix}>Rs.</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor={COLORS.textGray}
                  style={styles.priceInput}
                  keyboardType="numeric"
                  value={formData.price}
                  onChangeText={(text) => setFormData({ ...formData, price: text })}
                />
              </View>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.qtyRow}>
              <Text style={styles.metaLabel}>qty</Text>
              <TextInput
                placeholder="0"
                placeholderTextColor={COLORS.textGray}
                style={styles.qtyInput}
                keyboardType="numeric"
                value={formData.quantity}
                onChangeText={(text) => setFormData({ ...formData, quantity: text })}
              />
            </View>
            <View style={styles.starsRow} pointerEvents="none">
              {Array.from({ length: 5 }).map((_, i) => (
                <MaterialCommunityIcons key={i} name="star" size={18} color={COLORS.primary} />
              ))}
            </View>
          </View>

          <View style={styles.descCard}>
            <View style={styles.descHeader}>
              <MaterialCommunityIcons name="text-box-outline" size={18} color={COLORS.textGray} />
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
            style={[styles.saveBtn, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{meal ? 'Update meal' : 'Add to menu'}</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  photoHeader: { width: '100%', aspectRatio: 4 / 3, backgroundColor: COLORS.primarySoft },
  photoHeaderImg: { width: '100%', height: '100%' },
  photoHeaderShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  iconBtn: {
    position: 'absolute',
    top: 14,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHeaderBadge: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoHeaderBadgeText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textGray, marginBottom: 6, textTransform: 'uppercase' },
  topRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  titleInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
  },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: COLORS.background,
  },
  pricePrefix: { fontSize: 14, fontWeight: '900', color: COLORS.textGray },
  priceInput: { flex: 1, fontSize: 16, fontWeight: '900', color: COLORS.primary },

  metaRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaLabel: { fontSize: 13, fontWeight: '800', color: COLORS.textGray },
  qtyInput: {
    minWidth: 90,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    backgroundColor: COLORS.background,
    textAlign: 'center',
  },
  starsRow: { flexDirection: 'row', gap: 4, opacity: 0.9 },

  descCard: {
    marginTop: 14,
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  descTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark },
  descInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 110,
    fontSize: 15,
    color: COLORS.textGray,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  saveBtn: { 
    backgroundColor: COLORS.primary, 
    padding: 18, 
    borderRadius: 14, 
    alignItems: 'center',
    marginTop: 18,
    elevation: 3,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
