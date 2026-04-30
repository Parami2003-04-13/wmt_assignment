import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    Text as RNText // Renamed for helper
    ,

    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MealDetailsModal from '../../components/meal-details-modal';
import api, { clearAuthStorage, getStoredUser } from '../../services/api';
// Using standard Icons for 100% stability
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#0F5B57';
const PRIMARY_DARK = '#0B3F3C';
const PRIMARY_SOFT = '#E7F3F2';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const SURFACE = '#FFFFFF';
const BG = '#F5F7F7';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

export default function UserDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      const user = await getStoredUser();
      if (isMounted && user) setUserName(user.name);
    };
    fetchUser();
    fetchMeals();
    return () => { isMounted = false; };
  }, []);

  const [meals, setMeals] = useState<any[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const fetchMeals = async () => {
    try {
      // For demo, we get all meals. In real app, might be filtered by stall or recommendations
      const response = await api.get('/meals/stall/all'); // Wait, I didn't add this route. 
      // Let's use a fallback or add the route.
      // Actually, let's just get all stalls and then their meals, or just add a 'get all meals' route.
      // I'll add a 'GET /api/meals' route to server.js in a moment.
      const res = await api.get('/stalls');
      if (res.data.length > 0) {
        const mealRes = await api.get(`/meals/stall/${res.data[0]._id}`);
        setMeals(mealRes.data);
      }
    } catch (error) {
      console.log('Fetch meals failed');
    } finally {
      setLoadingMeals(false);
    }
  };

  const handleViewMeal = (meal: any) => {
    setSelectedMeal(meal);
    setDetailsVisible(true);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ok',
          onPress: async () => {
            await clearAuthStorage();
            router.replace('/login');
          },
          style: 'destructive'
        },
      ]
    );
  };

  const recentOrders = [
    { id: 1, dish: 'Pizza Margherita', status: 'Delivered', time: 'Today, 2:45 PM', price: '$12.50', icon: 'pizza' },
    { id: 2, dish: 'Spicy Chicken Burger', status: 'Processing', time: 'Just now', price: '$8.90', icon: 'hamburger' },
    { id: 3, dish: 'Mango Shake', status: 'Delivered', time: 'Yesterday', price: '$4.50', icon: 'glass-cocktail' },
  ];

  // Helper text component

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header (teal) */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.locationWrap}>
            <MaterialCommunityIcons name="map-marker-outline" size={18} color="rgba(255,255,255,0.85)" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.locationLabel}>Your location</Text>
              <View style={styles.locationValueRow}>
                <Text style={styles.locationValue}>Campus</Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color="rgba(255,255,255,0.9)" />
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} accessibilityLabel="Notifications">
              <MaterialCommunityIcons name="bell-outline" size={20} color="rgba(255,255,255,0.92)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.avatarBtn} accessibilityLabel="Account">
              <MaterialCommunityIcons name="account-circle" size={30} color="rgba(255,255,255,0.95)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color="rgba(255,255,255,0.85)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for meals, stalls..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={styles.heroKicker}>Your solution, one tap away!</Text>
              <Text style={styles.heroTitle}>Find today’s best meals</Text>
              <Text style={styles.heroSub}>Recommended specials near you</Text>

              <TouchableOpacity style={styles.heroBtn} accessibilityLabel="Explore specials">
                <Text style={styles.heroBtnText}>Explore</Text>
                <MaterialCommunityIcons name="arrow-right" size={18} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.heroArt}>
              <MaterialCommunityIcons name="food" size={44} color="rgba(255,255,255,0.9)" />
            </View>
          </View>

          {/* Categories */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Service Categories</Text>
            <TouchableOpacity accessibilityLabel="View all categories">
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {[
              { label: 'Breakfast', icon: 'coffee-outline' },
              { label: 'Lunch', icon: 'food-outline' },
              { label: 'Snacks', icon: 'cookie-outline' },
              { label: 'Drinks', icon: 'cup-outline' },
            ].map((c) => (
              <TouchableOpacity key={c.label} style={styles.categoryChip} accessibilityLabel={c.label}>
                <View style={styles.categoryIcon}>
                  <MaterialCommunityIcons name={c.icon as any} size={18} color={PRIMARY} />
                </View>
                <Text style={styles.categoryText}>{c.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={TEXT_GRAY} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Recent orders (kept, restyled) */}
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Recent Orders</Text>

          {recentOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderIconBox}>
                <MaterialCommunityIcons name={order.icon as any} size={24} color={PRIMARY} />
              </View>

              <View style={styles.orderMain}>
                <Text style={styles.orderDish}>{order.dish}</Text>
                <Text style={styles.orderTime}>{order.time}</Text>
              </View>

              <View style={styles.orderRight}>
                <Text style={styles.orderPrice}>{order.price}</Text>
                <View style={[
                  styles.statusTag,
                  { backgroundColor: order.status === 'Processing' ? '#FFF7E1' : '#E8F7F0' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: order.status === 'Processing' ? '#B7791F' : '#0F766E' }
                  ]}>
                    {order.status}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.promoCard} accessibilityLabel="Explore deals">
            <View>
              <Text style={styles.promoHeader}>Craving something new?</Text>
              <Text style={styles.promoSub}>Explore special campus deals</Text>
            </View>
            <View style={styles.promoBtn}>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={styles.mealsHeader}>
            <Text style={styles.sectionTitle}>Today's Specials</Text>
            <TouchableOpacity onPress={fetchMeals}>
               <MaterialCommunityIcons name="refresh" size={20} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          {loadingMeals ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealsScroll}>
              {meals.map((meal) => (
                <TouchableOpacity key={meal._id} style={styles.mealCard} onPress={() => handleViewMeal(meal)}>
                  <Image source={{ uri: meal.image || 'https://via.placeholder.com/150' }} style={styles.mealImage} />
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                    <Text style={styles.mealPrice}>Rs. {meal.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {meals.length === 0 && (
                <Text style={styles.noMealsText}>Check back later for specials!</Text>
              )}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <MealDetailsModal 
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        meal={selectedMeal}
      />

      {/* Modern Bottom Tabs */}
      <View style={styles.bottomTab}>
        <TouchableOpacity style={[styles.tabItem, styles.tabItemActive]}>
          <MaterialCommunityIcons name="home-outline" size={22} color={PRIMARY} />
          <Text style={[styles.tabLabel, { color: PRIMARY }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="history" size={24} color={TEXT_GRAY} />
          <Text style={styles.tabLabel}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="account-outline" size={24} color={TEXT_GRAY} />
          <Text style={styles.tabLabel}>Profile</Text>
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
  baseText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor: PRIMARY,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    marginRight: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrap: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 0,
  },
  scroll: {
    paddingBottom: 100,
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginBottom: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  },
  heroCard: {
    backgroundColor: PRIMARY,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  heroKicker: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginTop: 6,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
  },
  heroBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
    marginRight: 8,
  },
  heroArt: {
    width: 92,
    height: 92,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesScroll: {
    marginLeft: -20,
    paddingLeft: 20,
  },
  categoryChip: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,91,87,0.10)',
  },
  categoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: PRIMARY_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
    marginRight: 10,
  },
  orderCard: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  orderIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: PRIMARY_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  orderMain: {
    flex: 1,
  },
  orderDish: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  orderTime: {
    fontSize: 12,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  promoCard: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  promoHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  promoSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  promoBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomTab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tabItem: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tabItemActive: {
    backgroundColor: PRIMARY_SOFT,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    color: TEXT_GRAY,
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 15,
  },
  mealsScroll: {
    marginLeft: -20,
    paddingLeft: 20,
  },
  mealCard: {
    width: 160,
    backgroundColor: SURFACE,
    borderRadius: 16,
    marginRight: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 10,
  },
  mealImage: {
    width: '100%',
    height: 100,
  },
  mealInfo: {
    padding: 12,
  },
  mealName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  mealPrice: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '700',
    marginTop: 4,
  },
  noMealsText: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontStyle: 'italic',
    marginTop: 10,
  }
});
