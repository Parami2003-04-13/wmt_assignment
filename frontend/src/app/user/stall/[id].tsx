import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../../../services/api';
import MealDetailsModal from '../../../components/meal-details-modal';
import StallLocationMapView from '../../../components/stall-location-map-view';
import UserSupportTicketModal from '../../../components/user-support-ticket-modal';
import { COLORS } from '../../../theme/colors';
import { hasValidStallCoordinates, openStallInMaps } from '../../../utils/stallLocation';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

const COLOR_OPEN = COLORS.success;
const COLOR_CLOSED = COLORS.danger;

/** Same options as backend `Meal.category` enum and owner Manage meals UI */
const PRESET_MEAL_CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Drinks'] as const;

const UNCATEGORIZED_LABEL = 'Uncategorized';

const CHIP_INACTIVE_BG = '#E8F4F3';
const CHIP_BORDER = '#C5E8E6';

/** Display "HH:mm" (24h) as a short readable time. */
function formatOpenTime(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return raw.trim();
  let h = parseInt(m[1], 10);
  const min = m[2];
  if (Number.isNaN(h) || h < 0 || h > 23) return raw.trim();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}
 
//stalls details page
export default function UserStallDetails() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const stallId = Array.isArray(id) ? id[0] : id;

  const [stall, setStall] = useState<any>(null);
  const [meals, setMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [mealVisible, setMealVisible] = useState(false);
  const [supportTicketVisible, setTicketVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [unreadSupportTickets, setUnreadTickets] = useState(0);

  
  const fetchAll = useCallback(async () => {
    if (!stallId) return;
    const [stallRes, mealsRes, unreadRes] = await Promise.all([
      api.get(`/stalls/${stallId}`),
      api.get(`/meals/stall/${stallId}`),
      api.get(`/support-tickets/unread-count/user/${stallId}`),
    ]);
    setStall(stallRes.data);
    setMeals(Array.isArray(mealsRes.data) ? mealsRes.data : []);
    setUnreadTickets(unreadRes.data.count);
  }, [stallId]);

  //fetch all data for stall page
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!stallId) return;
      setLoading(true);
      try {
        await fetchAll();
      } catch (e: any) {
        if (!alive) return;
        Alert.alert('Error', e?.response?.data?.message || 'Could not load stall.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [stallId, fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  //check if stall is open or closed
  const isOpen = stall?.status === 'Open';
  const statusColor = isOpen ? COLOR_OPEN : COLOR_CLOSED;

  //cover and profile image
  const coverUri =
    stall?.coverPhoto ||
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000';
  const profileUri = stall?.profilePhoto || 'https://via.placeholder.com/150';

  //meal category buckets
  const mealCategoryBuckets = useMemo(() => {
    const extras = new Set<string>();
    let hasUncategorized = false;
    meals.forEach((m) => {
      const c = String(m?.category ?? '').trim();
      if (!c) hasUncategorized = true;
      else if (!(PRESET_MEAL_CATEGORIES as readonly string[]).includes(c)) extras.add(c);
    });
    return {
      extras: Array.from(extras).sort((a, b) => a.localeCompare(b)),
      hasUncategorized,
    };
  }, [meals]);

  /** Chip order: all preset types, then any custom labels on meals, then Uncategorized if needed */
  const categoryChips = useMemo(() => {
    const list = [...PRESET_MEAL_CATEGORIES, ...mealCategoryBuckets.extras];
    if (mealCategoryBuckets.hasUncategorized) list.push(UNCATEGORIZED_LABEL);
    return list;
  }, [mealCategoryBuckets]);

  //filtered sorted meals
  const filteredSortedMeals = useMemo(() => {
    let m = [...meals];
    if (selectedCategory === UNCATEGORIZED_LABEL) {
      m = m.filter((meal) => !String(meal?.category ?? '').trim());
    } else if (selectedCategory) {
      m = m.filter((meal) => String(meal?.category ?? '').trim() === selectedCategory);
    }
    m.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    return m;
  }, [meals, selectedCategory]);

  //grouped entries
  const groupedEntries = useMemo(() => {
    if (selectedCategory) return [] as [string, any[]][];
    const map: Record<string, any[]> = {};
    filteredSortedMeals.forEach((meal) => {
      const trimmed = String(meal?.category ?? '').trim();
      const k = trimmed || UNCATEGORIZED_LABEL;
      if (!map[k]) map[k] = [];
      map[k].push(meal);
    });
    const rank = (c: string) => {
      const i = (PRESET_MEAL_CATEGORIES as readonly string[]).indexOf(c);
      if (i >= 0) return i;
      if (c === UNCATEGORIZED_LABEL) return 1000;
      return 400 + (c.charCodeAt(0) || 0);
    };
    return Object.entries(map).sort((a, b) => {
      const d = rank(a[0]) - rank(b[0]);
      return d !== 0 ? d : a[0].localeCompare(b[0]);
    });
  }, [filteredSortedMeals, selectedCategory]);

  const hoursLine = useMemo(() => {
    const o = stall?.openingTime;
    const c = stall?.closingTime;
    if (o && c) return `${formatOpenTime(o)} – ${formatOpenTime(c)}`;
    if (o) return `From ${formatOpenTime(o)}`;
    if (c) return `Until ${formatOpenTime(c)}`;
    return '';
  }, [stall?.openingTime, stall?.closingTime]);

  const openMeal = (meal: any) => {
    setSelectedMeal(meal);
    setMealVisible(true);
  };

  const openSupport = async () => {
    setTicketVisible(true);
    if (unreadSupportTickets > 0) {
      try {
        await api.put(`/support-tickets/mark-seen/user/${stallId}`);
        setUnreadTickets(0);
      } catch {
        /* ignore */
      }
    }
  };

  //dial stall phone number
  const dialStall = () => {
    const raw = stall?.phone;
    if (!raw || typeof raw !== 'string') return;
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return;
    Linking.openURL(`tel:${digits}`).catch(() => {});
  };

  //meal row
  const renderMealRow = (meal: any, isLast: boolean) => {
    const soldOut = (meal.quantity ?? 0) <= 0;
    const qty = Number(meal.quantity ?? 0);
    const desc =
      (typeof meal.description === 'string' && meal.description.trim()) || '';
    return (
      <React.Fragment key={meal._id}>
        <Pressable
          style={({ pressed }) => [styles.mealRow, pressed && styles.mealRowPressed]}
          onPress={() => openMeal(meal)}
          android_ripple={{ color: 'rgba(15, 91, 87, 0.06)' }}
        >
          <Image
            source={{ uri: meal.image || 'https://via.placeholder.com/160' }}
            style={styles.mealThumb}
          />
          <View style={styles.mealRowBody}>
            <Text style={styles.mealName} numberOfLines={2}>
              {meal.name}
            </Text>
            <Text style={styles.mealPriceRow}>Rs. {meal.price}</Text>
            {desc ? (
              <Text style={styles.mealDescRow} numberOfLines={1}>
                {desc}
              </Text>
            ) : null}
            <Text
              style={[styles.mealStockRow, soldOut && styles.mealStockRowMuted]}
              numberOfLines={1}>
              {soldOut ? 'Sold out' : `${qty} available`}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.border} />
        </Pressable>
        {!isLast ? <View style={styles.mealRowDivider} /> : null}
      </React.Fragment>
    );
  };

  //loading
  if (loading && !stall) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading stall…</Text>
      </View>
    );
  }

  if (!stall) return null;

  const bottomReserve = Math.max(insets.bottom, 12) + 24;

  return (
    //stalls details page
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} translucent={false} />

      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.topBarSide}>
          <Pressable style={styles.topBarIcon} onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.primary} />
          </Pressable>
        </View>
        <View style={styles.wordmarkWrap} pointerEvents="none">
          <Text style={styles.wordmark}>CampusBites</Text>
        </View>
        <View style={[styles.topBarSide, styles.topBarSideRight]}>
          <Pressable style={styles.topBarIcon} onPress={openSupport} hitSlop={10}>
            <MaterialCommunityIcons name="headset" size={22} color={COLORS.primary} />
            {unreadSupportTickets > 0 && <View style={styles.supportDot} />}
          </Pressable>
        </View>
      </View>

    
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomReserve }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.heroWrap}>
          <Image source={{ uri: coverUri }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
        </View>

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.profileHeader}>
            <View style={styles.avatarRing}>
              <Image source={{ uri: profileUri }} style={styles.profileAvatar} />
            </View>
            <View style={styles.titleColumn}>
              <View style={styles.titleStatusRow}>
                <Text style={styles.stallTitle} numberOfLines={2}>
                  {stall.name}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    isOpen ? styles.statusPillOpen : styles.statusPillClosed,
                  ]}>
                  
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusPillText, { color: statusColor }]}>
                    {isOpen ? 'Open' : 'Closed'}
                  </Text>
                </View>
              </View>
              <Text style={styles.stallTagline} numberOfLines={4}>
                {(typeof stall.description === 'string' && stall.description.trim()) ||
                  'No description provided.'}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.metaRow}>
              <View style={styles.metaIconBg}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Open hours</Text>
                <Text style={styles.metaValue}>{hoursLine || 'Hours not listed'}</Text>
              </View>
            </View>

            {!!stall.phone && (
              <Pressable style={styles.metaRow} onPress={dialStall}>
                <View style={styles.metaIconBg}>
                  <MaterialCommunityIcons name="phone-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>Phone</Text>
                  <Text style={[styles.metaValue, styles.metaValueLink]}>{stall.phone}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textGray} />
              </Pressable>
            )}

            {!!stall.address && (
              <View style={styles.metaRow}>
                <View style={styles.metaIconBg}>
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>Address</Text>
                  <Text style={styles.metaValue}>{stall.address}</Text>
                </View>
              </View>
            )}
          </View>

          {hasValidStallCoordinates(stall.latitude, stall.longitude) ? (
            <View style={styles.mapSection}>
              <Text style={styles.sectionHeading}>Location map</Text>
              <View style={styles.mapCard}>
                <View style={styles.mapEmbed}>
                  <StallLocationMapView
                    latitude={Number(stall.latitude)}
                    longitude={Number(stall.longitude)}
                    zoom={16}
                  />
                </View>
                <Pressable
                  style={styles.openMapsBtn}
                  onPress={() =>
                    Linking.openURL(
                      openStallInMaps(Number(stall.latitude), Number(stall.longitude))
                    )
                  }
                >
                  <MaterialCommunityIcons name="map-search-outline" size={20} color="#fff" />
                  <Text style={styles.openMapsBtnText}>Open in Maps</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Text style={styles.sectionHeading}>Menu</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesScrollContent}
            nestedScrollEnabled
          >
            <Pressable
              style={[styles.categoryChip, selectedCategory === null && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryText, selectedCategory === null && styles.categoryTextActive]}>
                All Menu
              </Text>
            </Pressable>
            {categoryChips.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(isActive ? null : cat)}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>{cat}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {filteredSortedMeals.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="food-outline" size={44} color={COLORS.border} />
              <Text style={styles.emptyTitle}>{meals.length === 0 ? 'No meals yet' : 'Nothing in this category'}</Text>
              <Text style={styles.emptySub}>
                {meals.length === 0
                  ? 'This stall hasn’t listed any items.'
                  : 'Try another category or check back later.'}
              </Text>
            </View>
          ) : selectedCategory === null ? (
            groupedEntries.map(([cat, list]) => (
              <View key={cat} style={styles.menuSection}>
                <Text style={styles.menuSectionTitle}>{cat}</Text>
                <View style={styles.menuGroupSurface}>
                  {list.map((m, idx) => renderMealRow(m, idx === list.length - 1))}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>{selectedCategory || 'Menu'}</Text>
              <View style={styles.menuGroupSurface}>
                {filteredSortedMeals.map((m, idx) =>
                  renderMealRow(m, idx === filteredSortedMeals.length - 1)
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <MealDetailsModal visible={mealVisible} onClose={() => setMealVisible(false)} meal={selectedMeal} />
      <UserSupportTicketModal visible={supportTicketVisible} onClose={() => setTicketVisible(false)} stallId={stallId as string} />
    </View>
  );
}

//css styles

const styles = StyleSheet.create({
  //screen
  screen: { flex: 1, backgroundColor: COLORS.background },
  //loading container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: COLORS.textGray },

  //top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 91, 87, 0.08)',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  //top bar side
  topBarSide: {
    width: 112,
    flexDirection: 'row',
    alignItems: 'center',
  },
  //top bar side right
  topBarSideRight: { justifyContent: 'flex-end', gap: 2 },
  //top bar icon
  topBarIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  //wordmark wrap
  wordmarkWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.4,
  },
  supportDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    borderWidth: 1,
    borderColor: COLORS.surface,
  },

  heroWrap: {
    height: 228,
    width: '100%',
    backgroundColor: COLORS.primarySoft,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 63, 60, 0.22)' },

  sheet: {
    marginTop: -28,
    marginHorizontal: 10,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 91, 87, 0.1)',
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 99,
    backgroundColor: '#D8DCDE',
    marginBottom: 16,
  },

  /** Logo left + title, badge & tagline in column — matches stall header reference */
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 2,
    marginBottom: 4,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 18,
    padding: 2,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileAvatar: { width: '100%', height: '100%', borderRadius: 15, backgroundColor: COLORS.primarySoft },
  titleColumn: { flex: 1, minWidth: 0, paddingTop: 2 },
  titleStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  stallTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: -0.4,
    marginRight: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  statusPillOpen: {
    backgroundColor: '#DCF5ED',
    borderWidth: 1,
    borderColor: 'rgba(16, 172, 132, 0.28)',
  },
  statusPillClosed: {
    backgroundColor: '#FDEDF0',
    borderWidth: 1,
    borderColor: 'rgba(238, 82, 83, 0.22)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '800' },

  stallTagline: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 16,
  },

  infoCard: {
    gap: 10,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaIconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaTextCol: { flex: 1, minWidth: 0 },
  metaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaValue: { fontSize: 15, color: COLORS.textDark, fontWeight: '700', lineHeight: 20 },
  metaValueLink: { color: COLORS.primary },

  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: -0.2,
    marginTop: 20,
    marginBottom: 12,
  },

  mapSection: {
    marginBottom: 4,
  },
  mapCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  mapEmbed: {
    height: 200,
    width: '100%',
    backgroundColor: '#dfe8e7',
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 17,
  },
  openMapsBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },

  categoriesScroll: { marginHorizontal: -18, marginTop: -4, marginBottom: 10 },
  categoriesScrollContent: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    backgroundColor: CHIP_INACTIVE_BG,
    marginRight: 10,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  categoryTextActive: { color: '#fff' },

  menuSection: { marginBottom: 18 },
  menuSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 10,
    marginTop: 6,
    letterSpacing: -0.25,
  },

  menuGroupSurface: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 91, 87, 0.12)',
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },

  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    backgroundColor: COLORS.surface,
  },
  mealRowPressed: {
    backgroundColor: 'rgba(15, 91, 87, 0.045)',
  },
  mealThumb: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
  },
  mealRowBody: { flex: 1, minWidth: 0 },
  mealName: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textDark,
    letterSpacing: -0.2,
    lineHeight: 20,
    marginBottom: 2,
  },
  mealPriceRow: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 2,
  },
  mealDescRow: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textGray,
    lineHeight: 18,
    marginBottom: 2,
  },
  mealStockRow: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(15, 91, 87, 0.65)',
    letterSpacing: 0.1,
  },
  mealStockRowMuted: {
    color: COLOR_CLOSED,
    fontWeight: '600',
  },
  mealRowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16 + 68 + 14,
    backgroundColor: 'rgba(15, 91, 87, 0.1)',
  },

  emptyWrap: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  emptySub: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
});
