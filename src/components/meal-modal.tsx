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

const ORANGE_PRIMARY = '#FF6F3C';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';

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
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
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

    setLoading(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity),
        stallId
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
        <View style={styles.header}>
          <Text style={styles.title}>{meal ? 'Edit Meal' : 'Add New Meal'}</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={28} color={TEXT_DARK} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll}>
          <Text style={styles.label}>Meal Name <Text style={styles.required}>*</Text></Text>
          <TextInput 
            placeholder="e.g. Spicy Chicken Rice" 
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />

          <Text style={styles.label}>Description <Text style={styles.required}>*</Text></Text>
          <TextInput 
            placeholder="Describe the meal ingredients and taste" 
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Price (Rs.) <Text style={styles.required}>*</Text></Text>
              <TextInput 
                placeholder="0.00" 
                style={styles.input}
                keyboardType="numeric"
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Quantity <Text style={styles.required}>*</Text></Text>
              <TextInput 
                placeholder="Available qty" 
                style={styles.input}
                keyboardType="numeric"
                value={formData.quantity}
                onChangeText={(text) => setFormData({ ...formData, quantity: text })}
              />
            </View>
          </View>

          <Text style={styles.label}>Meal Photo</Text>
          <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
            {formData.image ? (
              <Image source={{ uri: formData.image }} style={styles.previewImage} />
            ) : (
              <>
                <MaterialCommunityIcons name="camera-plus-outline" size={32} color={ORANGE_PRIMARY} />
                <Text style={styles.photoPickerText}>Add Photo</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{meal ? 'Update Meal' : 'Add to Menu'}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0' 
  },
  title: { fontSize: 20, fontWeight: 'bold', color: TEXT_DARK },
  scroll: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: TEXT_DARK, marginBottom: 8, marginTop: 10 },
  required: { color: '#EE5253' },
  input: { 
    borderWidth: 1, 
    borderColor: '#E1E4E8', 
    borderRadius: 12, 
    padding: 15, 
    fontSize: 16, 
    backgroundColor: '#F9FAFB' 
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  photoPicker: { 
    height: 150, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#E1E4E8', 
    borderStyle: 'dashed', 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F9FAFB',
    marginTop: 5,
    marginBottom: 20,
    overflow: 'hidden'
  },
  photoPickerText: { fontSize: 14, color: TEXT_GRAY, marginTop: 8 },
  previewImage: { width: '100%', height: '100%' },
  saveBtn: { 
    backgroundColor: ORANGE_PRIMARY, 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
