import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Text as RNText,
  Platform,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';

const { width } = Dimensions.get('window');
const ORANGE_PRIMARY = '#FF6F3C';
const ORANGE_LIGHT = '#FFF5F2';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const COLOR_OPEN = '#10AC84';
const COLOR_CLOSED = '#EE5253';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

export default function StallManagement() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [stall, setStall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<any[]>([]);

  useEffect(() => {
    fetchStallDetails();
    fetchMeals();
  }, [id]);

  const fetchStallDetails = async () => {
    try {
      const response = await api.get(`/stalls/${id}`);
      setStall(response.data);
    } catch (error) {
      console.error('Fetch stall error:', error);
      Alert.alert('Error', 'Failed to load stall details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeals = async () => {
    try {
      const response = await api.get(`/meals/stall/${id}`);
      setMeals(response.data);
    } catch (error) {
      // Suppress error for now as meals module is pending
      console.log('Meals endpoint likely not ready yet');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ORANGE_PRIMARY} />
      </View>
    );
  }

  if (!stall) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Cover Photo Area */}
        <View style={styles.coverContainer}>
          <Image 
            source={{ uri: stall.coverPhoto || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000' }} 
            style={styles.coverPhoto} 
          />
          <View style={styles.overlay} />
          
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsBtn}>
            <MaterialCommunityIcons name="cog-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile & Info Section */}
        <View style={styles.headerContainer}>
          <View style={styles.overlappingProfileRow}>
            <View style={styles.profileImageWrapper}>
              <Image 
                source={{ uri: stall.profilePhoto || 'https://via.placeholder.com/150' }} 
                style={styles.profilePhoto} 
              />
            </View>
            <View style={styles.statusBadgeWrapper}>
               <View style={[styles.statusBadge, { backgroundColor: stall.status === 'Open' ? COLOR_OPEN : COLOR_CLOSED }]}>
                  <Text style={styles.statusBadgeText}>{stall.status?.toUpperCase()}</Text>
               </View>
            </View>
          </View>

          <View style={styles.infoArea}>
            <Text style={styles.stallName}>{stall.name}</Text>
            <View style={styles.detailsList}>
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={ORANGE_PRIMARY} />
                <Text style={styles.detailText} numberOfLines={1}>{stall.address}</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="phone-outline" size={16} color={ORANGE_PRIMARY} />
                <Text style={styles.detailText}>{stall.phone}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionLabel}>Description</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>
              {stall.description || "No description provided. Add one to help customers find you!"}
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.actionBtn}>
          <MaterialCommunityIcons name="pencil-box-multiple-outline" size={20} color="#fff" />
          <Text style={styles.actionBtnText}>Edit Stall Information</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Meals Section */}
        <View style={styles.menuHeader}>
          <View>
            <Text style={styles.menuTitle}>Your Menu</Text>
            <Text style={styles.menuSubtitle}>{meals.length} items available</Text>
          </View>
          <TouchableOpacity style={styles.viewAllBtn}>
             <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mealsContainer}>
          {/* Add Meals Card */}
          <TouchableOpacity 
            style={styles.addMealCard}
            onPress={() => Alert.alert("Coming Soon", "Meal management module implementation in progress!")}
          >
            <View style={styles.addIconBg}>
              <MaterialCommunityIcons name="plus" size={32} color={ORANGE_PRIMARY} />
            </View>
            <Text style={styles.addText}>Add Meals</Text>
          </TouchableOpacity>

          {/* Meals List */}
          {meals.map((meal) => (
            <TouchableOpacity key={meal._id} style={styles.mealItemCard}>
              <Image source={{ uri: meal.image }} style={styles.mealImg} />
              <View style={styles.mealDetails}>
                <Text style={styles.mealTitle} numberOfLines={1}>{meal.name}</Text>
                <Text style={styles.mealPriceText}>Rs. {meal.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
          
          {meals.length === 0 && (
             <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No meals added yet.</Text>
             </View>
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 20 },
  
  coverContainer: {
    height: 240,
    width: '100%',
    backgroundColor: '#F0F0F0',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  settingsBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerContainer: {
    paddingHorizontal: 20,
    marginTop: -55,
    marginBottom: 20,
  },
  overlappingProfileRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  profileArea: {
    alignItems: 'center',
  },
  profileImageWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff',
    padding: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 51,
  },
  statusBadgeWrapper: {
    position: 'absolute',
    bottom: -5,
    left: 10,
    backgroundColor: '#fff',
    padding: 3,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  infoArea: {
    marginTop: 5,
    paddingLeft: 4,
  },
  stallName: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 6,
  },
  detailsList: {
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: TEXT_GRAY,
    marginLeft: 8,
    fontWeight: '500',
  },

  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  descriptionCard: {
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F3F5',
  },
  descriptionText: {
    fontSize: 15,
    color: '#495057',
    lineHeight: 22,
  },

  actionBtn: {
    marginHorizontal: 20,
    backgroundColor: '#343A40',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    elevation: 2,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 12,
  },
  
  divider: {
    height: 8,
    backgroundColor: '#F1F3F5',
    marginVertical: 10,
  },

  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  menuSubtitle: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  viewAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: ORANGE_LIGHT,
    borderRadius: 8,
  },
  viewAllText: {
    color: ORANGE_PRIMARY,
    fontWeight: '700',
    fontSize: 13,
  },

  mealsContainer: {
    paddingHorizontal: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addMealCard: {
    width: (width - 50) / 2,
    aspectRatio: 0.9,
    margin: 7,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  addIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  addText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_GRAY,
  },
  mealItemCard: {
    width: (width - 50) / 2,
    margin: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  mealImg: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8F9FA',
  },
  mealDetails: {
    padding: 12,
  },
  mealTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  mealPriceText: {
    fontSize: 14,
    color: ORANGE_PRIMARY,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    width: '100%',
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: TEXT_GRAY,
    fontSize: 14,
    fontStyle: 'italic',
  }
});
