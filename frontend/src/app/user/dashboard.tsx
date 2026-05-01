import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    Text as RNText // Renamed for helper
    ,

    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MealDetailsModal from '../../components/meal-details-modal';
import api, { getStoredUser } from '../../services/api';
// Using standard Icons for 100% stability
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCart } from '../../context/CartContext';

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
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { cartItems } = useCart();
  const cartItemCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      const user = await getStoredUser();
      if (isMounted && user) setUserName(user.name);
    };
    fetchUser();
    fetchDashboardData();
    return () => { isMounted = false; };
  }, []);

  const [meals, setMeals] = useState<any[]>([]);
  const [stalls, setStalls] = useState<any[]>([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [loadingStalls, setLoadingStalls] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const fetchDashboardData = async () => {
    setLoadingStalls(true);
    setLoadingMeals(true);
    try {
      const [stallsRes, mealsRes] = await Promise.all([
        api.get('/stalls'),
        api.get('/meals'),
      ]);

      // Only show approved stalls to users
      const approvedStalls = Array.isArray(stallsRes.data)
        ? stallsRes.data.filter((s: any) => s?.isApproved)
        : [];

      setStalls(approvedStalls);
      setMeals(Array.isArray(mealsRes.data) ? mealsRes.data : []);
    } catch (error) {
      console.log('Fetch dashboard data failed');
    } finally {
      setLoadingStalls(false);
      setLoadingMeals(false);
    }
  };

  const handleViewMeal = (meal: any) => {
    setSelectedMeal(meal);
    setDetailsVisible(true);
  };

  const getMealStallId = (meal: any) => {
    if (!meal) return null;
    if (typeof meal.stall === 'string') return meal.stall;
    return meal.stall?._id || null;
  };

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  const stallById = useMemo(() => {
    const map: Record<string, any> = {};
    stalls.forEach((s: any) => {
      if (s?._id != null) map[String(s._id)] = s;
    });
    return map;
  }, [stalls]);

  const approvedStallIds = useMemo(() => new Set(Object.keys(stallById)), [stallById]);

  const mealsFromApprovedStalls = useMemo(
    () =>
      meals.filter((m: any) => {
        const sid = getMealStallId(m);
        return sid != null && approvedStallIds.has(String(sid));
      }),
    [meals, approvedStallIds],
  );

  const filteredStalls = useMemo(
    () =>
      stalls.filter((s: any) => {
        if (!normalizedQuery) return true;
        const bundle = `${s?.name || ''} ${s?.address || ''} ${s?.phone || ''} ${s?.description || ''} ${s?.status || ''}`;
        return bundle.toLowerCase().includes(normalizedQuery);
      }),
    [stalls, normalizedQuery],
  );

  const filteredMeals = useMemo(
    () =>
      mealsFromApprovedStalls.filter((m: any) => {
        if (selectedCategory && m.category !== selectedCategory) return false;
        if (!normalizedQuery) return true;
        const sid = getMealStallId(m);
        const st = sid ? stallById[String(sid)] : null;
        const populated =
          typeof m?.stall === 'object' && m.stall ? `${m.stall.name ?? ''} ${m.stall.description ?? ''}` : '';
        const bundle = `${m?.name ?? ''} ${m?.description ?? ''} ${String(m?.price ?? '')} ${String(m?.quantity ?? '')} ${st?.name ?? ''} ${st?.address ?? ''} ${st?.phone ?? ''} ${populated}`;
        return bundle.toLowerCase().includes(normalizedQuery);
      }),
    [mealsFromApprovedStalls, normalizedQuery, stallById, selectedCategory],
  );

  // Helper text component

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header (teal) */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerGreeting}>{userName ? `Hi, ${userName}` : 'CampusBites'}</Text>
            <Text style={styles.headerSubtitle}>Search meals & stalls</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} accessibilityLabel="Notifications">
              <MaterialCommunityIcons name="bell-outline" size={20} color="rgba(255,255,255,0.92)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color="rgba(255,255,255,0.85)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search meals, stalls, price, descriptions…"
            placeholderTextColor="rgba(255,255,255,0.65)"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
          />
          {query.length > 0 && Platform.OS !== 'ios' && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <MaterialCommunityIcons name="close-circle" size={20} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          )}
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
            ].map((c) => {
              const isActive = selectedCategory === c.label;
              return (
                <TouchableOpacity 
                  key={c.label} 
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]} 
                  onPress={() => setSelectedCategory(isActive ? null : c.label)}
                  accessibilityLabel={c.label}
                >
                  <View style={[styles.categoryIcon, isActive && styles.categoryIconActive]}>
                    <MaterialCommunityIcons name={c.icon as any} size={18} color={isActive ? '#fff' : PRIMARY} />
                  </View>
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Popular stalls (real from DB) */}
          <View style={styles.mealsHeader}>
            <Text style={styles.sectionTitle}>Popular Stalls</Text>
            <TouchableOpacity onPress={fetchDashboardData} accessibilityLabel="Refresh stalls and meals">
              <MaterialCommunityIcons name="refresh" size={20} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          {loadingStalls ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 6 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stallsScroll}>
              {filteredStalls.map((stall: any) => {
                return (
                  <TouchableOpacity
                    key={stall._id}
                    style={styles.stallCard}
                    onPress={() => router.push(`/user/stall/${stall._id}`)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: stall.profilePhoto || 'https://via.placeholder.com/120?text=Stall' }}
                      style={styles.stallImage}
                    />
                    <View style={styles.stallInfo}>
                      <Text style={styles.stallName} numberOfLines={1}>{stall.name}</Text>
                      <View style={styles.stallMetaRow}>
                        <View style={[styles.stallDot, { backgroundColor: stall.status === 'Open' ? '#10AC84' : '#EE5253' }]} />
                        <Text style={styles.stallMetaText}>{stall.status || 'Unknown'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {filteredStalls.length === 0 && (
                <Text style={styles.noMealsText}>No stalls found.</Text>
              )}
            </ScrollView>
          )}

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
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Today&apos;s Specials</Text>
            </View>
          </View>

          {loadingMeals ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealsScroll}>
              {filteredMeals.map((meal) => (
                <TouchableOpacity key={meal._id} style={styles.mealCard} onPress={() => handleViewMeal(meal)}>
                  <Image source={{ uri: meal.image || 'https://via.placeholder.com/150' }} style={styles.mealImage} />
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                    {meal?.stall?.name && (
                      <Text style={styles.mealStallName} numberOfLines={1}>{meal.stall.name}</Text>
                    )}
                    <Text style={styles.mealPrice}>Rs. {meal.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {filteredMeals.length === 0 && (
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
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/user/cart')} accessibilityLabel="Cart">
          <View>
            <MaterialCommunityIcons name="cart-outline" size={24} color={TEXT_GRAY} />
            {cartItemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.tabLabel}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push('/user/profile')} accessibilityLabel="Profile">
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
    paddingBottom: 18,
    backgroundColor: PRIMARY,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleBlock: {
    flex: 1,
    marginRight: 12,
  },
  headerGreeting: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.98)',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '600',
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
  categoryChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
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
  categoryIconActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  categoryTextActive: {
    color: '#fff',
  },
  stallsScroll: {
    marginLeft: -20,
    paddingLeft: 20,
    marginTop: 2,
  },
  stallCard: {
    width: 170,
    backgroundColor: SURFACE,
    borderRadius: 16,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,91,87,0.10)',
  },
  stallImage: {
    width: '100%',
    height: 96,
    backgroundColor: PRIMARY_SOFT,
  },
  stallInfo: {
    padding: 12,
  },
  stallName: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  stallMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  stallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  stallMetaText: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '700',
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
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FF4757',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: SURFACE,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
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
    width: 260,
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
    flexDirection: 'row',
  },
  mealImage: {
    width: 90,
    height: 100,
  },
  mealInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  mealName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  mealStallName: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 2,
    fontWeight: '700',
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
