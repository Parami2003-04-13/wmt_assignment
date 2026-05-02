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

const COLOMBO_TZ = 'Asia/Colombo';

/** Minutes since midnight for Asia/Colombo (stall hours semantics). */
function getColomboMinutesSinceMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: COLOMBO_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  let h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  let m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  if (Number.isNaN(h)) h = 0;
  if (Number.isNaN(m)) m = 0;
  return h * 60 + m;
}

type CampusMealWindow = {
  category: 'Breakfast' | 'Lunch';
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

/** 6–11 Colombo → breakfast · 11–16 → lunch · else rail hidden */
function campusMealWindowFromNow(now: Date): CampusMealWindow | null {
  const mins = getColomboMinutesSinceMidnight(now);
  const d6 = 6 * 60;
  const d11 = 11 * 60;
  const d16 = 16 * 60;
  if (mins >= d6 && mins < d11) {
    return {
      category: 'Breakfast',
      title: 'Breakfast picks',
      subtitle: 'Morning menu · Colombo 6 AM – 11 AM',
      icon: 'coffee-outline',
    };
  }
  if (mins >= d11 && mins < d16) {
    return {
      category: 'Lunch',
      title: 'Lunch picks',
      subtitle: 'Midday favourites · Colombo 11 AM – 4 PM',
      icon: 'food-outline',
    };
  }
  return null;
}

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

  /** Re-evaluate sunrise/lunch rails when Colombo hour changes (~1/min). */
  const [campusClock, setCampusClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setCampusClock(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

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

  const stallIdsForCategory = useMemo(() => {
    if (!selectedCategory) return null;
    const ids = new Set<string>();
    for (const m of mealsFromApprovedStalls) {
      if (String(m?.category ?? '').trim() !== selectedCategory) continue;
      const sid = getMealStallId(m);
      if (sid != null) ids.add(String(sid));
    }
    return ids;
  }, [mealsFromApprovedStalls, selectedCategory]);

  const filteredStalls = useMemo(
    () =>
      stalls.filter((s: any) => {
        if (stallIdsForCategory && !stallIdsForCategory.has(String(s._id))) return false;
        if (!normalizedQuery) return true;
        const bundle = `${s?.name || ''} ${s?.address || ''} ${s?.phone || ''} ${s?.description || ''} ${s?.status || ''}`;
        return bundle.toLowerCase().includes(normalizedQuery);
      }),
    [stalls, normalizedQuery, stallIdsForCategory],
  );

  const filteredMeals = useMemo(
    () =>
      mealsFromApprovedStalls.filter((m: any) => {
        if (selectedCategory && String(m?.category ?? '').trim() !== selectedCategory) return false;
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

  const campusNowWindow = useMemo(() => campusMealWindowFromNow(campusClock), [campusClock]);

  /** Time-based carousel: ignores search/category filters so window always reflects the clock. */
  const rightNowMeals = useMemo(() => {
    if (!campusNowWindow) return [];
    let rows = mealsFromApprovedStalls.filter((m: any) => String(m?.category ?? '').trim() === campusNowWindow.category);
    rows.sort((a: any, b: any) => {
      const sa = stallById[String(getMealStallId(a) || '')]?.name || '';
      const sb = stallById[String(getMealStallId(b) || '')]?.name || '';
      const c = String(sa).localeCompare(String(sb));
      if (c !== 0) return c;
      return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
    });
    return rows.slice(0, 30);
  }, [mealsFromApprovedStalls, stallById, campusNowWindow]);

  const stallLabelForMeal = (meal: any) => {
    const sid = getMealStallId(meal);
    if (typeof meal?.stall === 'object' && meal.stall?.name) return String(meal.stall.name);
    return (sid && stallById[String(sid)]?.name) || '';
  };

  // Helper text component

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} translucent={false} />

      {/* Header (teal) — extends under status bar; icons stay visible on iOS & Android */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerGreeting}>{userName ? `Hi, ${userName}` : 'CampusBites'}</Text>
            <Text style={styles.headerSubtitle}>Search meals & stalls</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              accessibilityLabel="Cart"
              onPress={() => router.push('/user/cart')}>
              <View style={styles.headerIconInner}>
                <MaterialCommunityIcons name="cart-outline" size={21} color="rgba(255,255,255,0.92)" />
                {cartItemCount > 0 && (
                  <View style={styles.headerCartBadge}>
                    <Text style={styles.headerCartBadgeText}>
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, styles.headerIconBtnAfter]}
              accessibilityLabel="Notifications">
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

          {campusNowWindow ? (
            <View style={styles.rightNowZone}>
              <View style={styles.rightNowZoneHeader}>
                <View style={styles.rightNowIconWrap}>
                  <MaterialCommunityIcons name={campusNowWindow.icon} size={22} color={PRIMARY} />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.rightNowKicker}>Right now (Colombo)</Text>
                  <Text style={styles.rightNowTitle}>{campusNowWindow.title}</Text>
                  <Text style={styles.rightNowSub}>{campusNowWindow.subtitle}</Text>
                </View>
                <TouchableOpacity
                  style={styles.rightNowChevronWrap}
                  onPress={() => router.push('/user/meals')}
                  hitSlop={8}
                  accessibilityLabel="Browse all meals">
                  <MaterialCommunityIcons name="chevron-right" size={22} color={PRIMARY} />
                </TouchableOpacity>
              </View>

              {!loadingMeals && rightNowMeals.length === 0 ? (
                <Text style={styles.rightNowEmpty}>
                  Nothing listed yet for this time — check stalls below or open All meals.
                </Text>
              ) : null}

              {loadingMeals ? (
                <ActivityIndicator color={PRIMARY} style={{ marginTop: 8, marginBottom: 4 }} />
              ) : (
                rightNowMeals.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={[styles.mealsScroll, styles.rightNowMealsRail]}
                    contentContainerStyle={styles.rightNowMealsContent}>
                    {rightNowMeals.map((meal) => {
                      const stallName = stallLabelForMeal(meal);
                      const category = meal?.category ? String(meal.category).trim() : '';
                      const qty = Number(meal?.quantity ?? 0);
                      return (
                        <TouchableOpacity
                          key={`now-${meal._id}`}
                          style={styles.specialCard}
                          onPress={() => handleViewMeal(meal)}
                          activeOpacity={0.92}>
                          <View style={styles.specialCardImageWrap}>
                            <Image
                              source={{ uri: meal.image || 'https://via.placeholder.com/300' }}
                              style={styles.specialCardImage}
                              resizeMode="cover"
                            />
                            <View style={styles.specialCardImageScrim} />
                            {category ? (
                              <View style={styles.specialBadge}>
                                <Text style={styles.specialBadgeText}>{category}</Text>
                              </View>
                            ) : (
                              <View style={[styles.specialBadge, styles.specialBadgeHighlight]}>
                                <MaterialCommunityIcons name="chef-hat" size={13} color={PRIMARY} />
                                <Text style={[styles.specialBadgeText, styles.specialBadgeTextDark]}>Featured</Text>
                              </View>
                            )}
                            <View style={styles.specialPricePill}>
                              <Text style={styles.specialPricePillText}>Rs. {meal.price}</Text>
                            </View>
                          </View>
                          <View style={styles.specialCardBody}>
                            <Text style={styles.specialTitle} numberOfLines={2}>
                              {meal.name}
                            </Text>
                            {meal.description && String(meal.description).trim() ? (
                              <Text style={styles.specialDesc} numberOfLines={2}>
                                {String(meal.description).trim()}
                              </Text>
                            ) : null}
                            <View style={styles.specialMetaRow}>
                              <View style={styles.specialStallRow}>
                                <MaterialCommunityIcons name="storefront-outline" size={15} color={TEXT_GRAY} />
                                <Text style={styles.specialStallName} numberOfLines={1}>
                                  {stallName || 'Campus stall'}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.specialFooterRow}>
                              <View style={[styles.stockDot, qty > 0 ? styles.stockDotIn : styles.stockDotOut]} />
                              <Text style={styles.stockLabel}>
                                {qty > 10 ? 'In stock' : qty > 0 ? `${qty} left` : 'Out of stock'}
                              </Text>
                              <MaterialCommunityIcons name="chevron-right" size={18} color={PRIMARY} />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )
              )}
            </View>
          ) : null}

          {/* Service categories — below time-based picks; filters stalls + Today's Specials */}
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

          {/* Stalls */}
          <View style={styles.mealsHeader}>
            <Text style={styles.sectionTitle}>Stalls</Text>
            <TouchableOpacity onPress={fetchDashboardData} accessibilityLabel="Refresh stalls and meals">
              <MaterialCommunityIcons name="refresh" size={20} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          {loadingStalls ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 6 }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.stallsScroll}
              contentContainerStyle={styles.stallsScrollContent}>
              {filteredStalls.map((stall: any) => {
                const isOpen = stall.status === 'Open';
                const isClosed = stall.status === 'Closed';
                const heroUri =
                  stall.coverPhoto ||
                  stall.profilePhoto ||
                  'https://via.placeholder.com/400?text=Stall';
                return (
                  <TouchableOpacity
                    key={stall._id}
                    style={styles.stallBrowseCard}
                    onPress={() => router.push(`/user/stall/${stall._id}`)}
                    activeOpacity={0.92}>
                    <View style={styles.stallBrowseImageWrap}>
                      <Image source={{ uri: heroUri }} style={styles.stallBrowseImage} resizeMode="cover" />
                      <View style={styles.stallBrowseScrim} />
                      <View
                        style={[
                          styles.stallBrowseStatus,
                          isOpen
                            ? styles.stallBrowseStatusOpen
                            : isClosed
                              ? styles.stallBrowseStatusClosed
                              : styles.stallBrowseStatusNeutral,
                        ]}>
                        <View
                          style={[
                            styles.stallBrowseStatusDot,
                            {
                              backgroundColor: isOpen
                                ? '#10AC84'
                                : isClosed
                                  ? '#EE5253'
                                  : TEXT_GRAY,
                            },
                          ]}
                        />
                        <Text style={styles.stallBrowseStatusText}>
                          {isOpen ? 'Open' : isClosed ? 'Closed' : stall.status || '—'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stallBrowseBody}>
                      <Text style={styles.stallBrowseTitle} numberOfLines={2}>
                        {stall.name}
                      </Text>
                      {stall.address ? (
                        <View style={styles.stallBrowseLocRow}>
                          <MaterialCommunityIcons name="map-marker-outline" size={14} color={TEXT_GRAY} />
                          <Text style={styles.stallBrowseAddress} numberOfLines={2}>
                            {stall.address}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.stallBrowseFooter}>
                        <Text style={styles.stallBrowseCta}>View menu</Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={PRIMARY} />
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.mealsScroll}
              contentContainerStyle={styles.mealsScrollContent}>
              {filteredMeals.map((meal) => {
                const sid = getMealStallId(meal);
                const stallName =
                  (typeof meal?.stall === 'object' && meal.stall?.name
                    ? String(meal.stall.name)
                    : sid
                      ? stallById[String(sid)]?.name
                      : '') || '';
                const category = meal?.category ? String(meal.category).trim() : '';
                const qty = Number(meal?.quantity ?? 0);
                return (
                  <TouchableOpacity
                    key={meal._id}
                    style={styles.specialCard}
                    onPress={() => handleViewMeal(meal)}
                    activeOpacity={0.92}>
                    <View style={styles.specialCardImageWrap}>
                      <Image
                        source={{ uri: meal.image || 'https://via.placeholder.com/300' }}
                        style={styles.specialCardImage}
                        resizeMode="cover"
                      />
                      <View style={styles.specialCardImageScrim} />
                      {category ? (
                        <View style={styles.specialBadge}>
                          <Text style={styles.specialBadgeText}>{category}</Text>
                        </View>
                      ) : (
                        <View style={[styles.specialBadge, styles.specialBadgeHighlight]}>
                          <MaterialCommunityIcons name="chef-hat" size={13} color={PRIMARY} />
                          <Text style={[styles.specialBadgeText, styles.specialBadgeTextDark]}>Featured</Text>
                        </View>
                      )}
                      <View style={styles.specialPricePill}>
                        <Text style={styles.specialPricePillText}>Rs. {meal.price}</Text>
                      </View>
                    </View>
                    <View style={styles.specialCardBody}>
                      <Text style={styles.specialTitle} numberOfLines={2}>
                        {meal.name}
                      </Text>
                      {(meal.description && String(meal.description).trim()) ? (
                        <Text style={styles.specialDesc} numberOfLines={2}>
                          {String(meal.description).trim()}
                        </Text>
                      ) : null}
                      <View style={styles.specialMetaRow}>
                        <View style={styles.specialStallRow}>
                          <MaterialCommunityIcons name="storefront-outline" size={15} color={TEXT_GRAY} />
                          <Text style={styles.specialStallName} numberOfLines={1}>
                            {stallName || 'Campus stall'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.specialFooterRow}>
                        <View style={[styles.stockDot, qty > 0 ? styles.stockDotIn : styles.stockDotOut]} />
                        <Text style={styles.stockLabel}>
                          {qty > 10 ? 'In stock' : qty > 0 ? `${qty} left` : 'Out of stock'}
                        </Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={PRIMARY} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => router.push('/user/meals')}
          accessibilityLabel="All meals">
          <MaterialCommunityIcons name="silverware-fork-knife" size={22} color={TEXT_GRAY} />
          <Text style={styles.tabLabel}>All meals</Text>
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
  headerIconBtnAfter: {
    marginLeft: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconInner: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCartBadge: {
    position: 'absolute',
    top: -8,
    right: -14,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: '#FF4757',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  headerCartBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
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

  rightNowZone: {
    marginTop: 22,
    marginBottom: 4,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    marginHorizontal: -4,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.12)',
  },
  rightNowZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rightNowIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.12)',
  },
  rightNowKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_GRAY,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rightNowTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -0.3,
  },
  rightNowSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_GRAY,
    lineHeight: 18,
  },
  rightNowChevronWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.12)',
  },
  rightNowEmpty: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  rightNowMealsRail: {
    marginLeft: 0,
  },
  rightNowMealsContent: {
    paddingLeft: 0,
    paddingRight: 8,
    paddingBottom: 4,
    gap: 0,
  },

  stallsScroll: {
    marginLeft: -20,
    marginTop: 2,
  },
  stallsScrollContent: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 14,
  },
  stallBrowseCard: {
    width: 176,
    marginRight: 14,
    backgroundColor: SURFACE,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.09)',
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  stallBrowseImageWrap: {
    height: 118,
    width: '100%',
    backgroundColor: PRIMARY_SOFT,
    position: 'relative',
  },
  stallBrowseImage: {
    width: '100%',
    height: '100%',
  },
  stallBrowseScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 40, 38, 0.14)',
    pointerEvents: 'none',
  },
  stallBrowseStatus: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  stallBrowseStatusOpen: {
    backgroundColor: 'rgba(220, 245, 237, 0.95)',
    borderColor: 'rgba(16, 172, 132, 0.35)',
  },
  stallBrowseStatusClosed: {
    backgroundColor: 'rgba(253, 236, 236, 0.95)',
    borderColor: 'rgba(238, 82, 83, 0.35)',
  },
  stallBrowseStatusNeutral: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(15, 91, 87, 0.12)',
  },
  stallBrowseStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  stallBrowseStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: 0.2,
  },
  stallBrowseBody: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
  },
  stallBrowseTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT_DARK,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  stallBrowseLocRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stallBrowseAddress: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_GRAY,
    lineHeight: 17,
  },
  stallBrowseFooter: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 91, 87, 0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stallBrowseCta: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.2,
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
  },
  mealsScrollContent: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 14,
    gap: 0,
  },
  specialCard: {
    width: 176,
    marginRight: 14,
    backgroundColor: SURFACE,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.09)',
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  specialCardImageWrap: {
    height: 124,
    width: '100%',
    backgroundColor: PRIMARY_SOFT,
    position: 'relative',
  },
  specialCardImage: {
    width: '100%',
    height: '100%',
  },
  specialCardImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 40, 38, 0.12)',
    pointerEvents: 'none',
  },
  specialBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.12)',
  },
  specialBadgeHighlight: {
    gap: 4,
  },
  specialBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.2,
  },
  specialBadgeTextDark: {
    color: PRIMARY_DARK,
  },
  specialPricePill: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  specialPricePillText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.2,
  },
  specialCardBody: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
    gap: 0,
  },
  specialTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: TEXT_DARK,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  specialDesc: {
    marginTop: 6,
    fontSize: 12,
    color: TEXT_GRAY,
    lineHeight: 17,
    fontWeight: '600',
  },
  specialMetaRow: {
    marginTop: 10,
  },
  specialStallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specialStallName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_GRAY,
  },
  specialFooterRow: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 91, 87, 0.10)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },
  stockDotIn: {
    backgroundColor: '#10AC84',
  },
  stockDotOut: {
    backgroundColor: '#EE5253',
  },
  stockLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  noMealsText: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontStyle: 'italic',
    marginTop: 10,
  }
});
