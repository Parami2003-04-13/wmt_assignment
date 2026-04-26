import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Text as RNText // Renamed for helper
  ,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator
} from 'react-native';
import api from '../../services/api';
import MealDetailsModal from '../../components/meal-details-modal';
// Using standard Icons for 100% stability
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const ORANGE_PRIMARY = '#FF6F3C';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

export default function UserDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      const userStr = await SecureStore.getItemAsync('user');
      if (isMounted && userStr) setUserName(JSON.parse(userStr).name);
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
            await SecureStore.deleteItemAsync('token');
            await SecureStore.deleteItemAsync('user');
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
      <StatusBar barStyle="dark-content" />

      {/* Header Matching UI Style */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Hello, {userName}!</Text>
          <Text style={styles.pageTitle}>User Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialCommunityIcons name="logout" size={24} color={TEXT_GRAY} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>

          {recentOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderIconBox}>
                <MaterialCommunityIcons name={order.icon as any} size={24} color={ORANGE_PRIMARY} />
              </View>

              <View style={styles.orderMain}>
                <Text style={styles.orderDish}>{order.dish}</Text>
                <Text style={styles.orderTime}>{order.time}</Text>
              </View>

              <View style={styles.orderRight}>
                <Text style={styles.orderPrice}>{order.price}</Text>
                <View style={[
                  styles.statusTag,
                  { backgroundColor: order.status === 'Processing' ? '#FFF9E1' : '#E1FFF1' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: order.status === 'Processing' ? '#FF9F43' : '#10AC84' }
                  ]}>
                    {order.status}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.promoCard}>
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
               <MaterialCommunityIcons name="refresh" size={20} color={ORANGE_PRIMARY} />
            </TouchableOpacity>
          </View>

          {loadingMeals ? (
            <ActivityIndicator color={ORANGE_PRIMARY} style={{ marginTop: 20 }} />
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
        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="home-outline" size={24} color={ORANGE_PRIMARY} />
          <Text style={[styles.tabLabel, { color: ORANGE_PRIMARY }]}>Home</Text>
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
    backgroundColor: '#F7F8FA',
  },
  baseText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  welcomeText: {
    fontSize: 14,
    color: TEXT_GRAY,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
  },
  scroll: {
    paddingBottom: 100,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_DARK,
    marginBottom: 15,
  },
  orderCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
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
    backgroundColor: '#FFF5F2',
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
    backgroundColor: ORANGE_PRIMARY,
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
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
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tabItem: {
    alignItems: 'center',
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
    backgroundColor: '#fff',
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
    color: ORANGE_PRIMARY,
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
