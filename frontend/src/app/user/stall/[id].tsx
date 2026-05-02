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
import UserTicketModal from '../../../components/user-ticket-modal';
import { COLORS } from '../../../theme/colors';

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
const CALORIE_ORANGE_BG = '#FFF4ED';
const CALORIE_ORANGE_TEXT = '#C45C31';

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
  const [ticketVisible, setTicketVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!stallId) return;
    const [stallRes, mealsRes, unreadRes] = await Promise.all([
      api.get(`/stalls/${stallId}`),
      api.get(`/meals/stall/${stallId}`),
      api.get(`/tickets/unread-count/user/${stallId}`),
    ]);
    setStall(stallRes.data);
    setMeals(Array.isArray(mealsRes.data) ? mealsRes.data : []);
    setUnreadTickets(unreadRes.data.count);
  }, [stallId]);

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

  const isOpen = stall?.status === 'Open';
  const statusColor = isOpen ? COLOR_OPEN : COLOR_CLOSED;
  const statusBg = isOpen ? '#DCF5ED' : '#FDECEC';

  const coverUri =
    stall?.coverPhoto ||
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000';
  const profileUri = stall?.profilePhoto || 'https://via.placeholder.com/150';

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
    if (unreadTickets > 0) {
      try {
        await api.put(`/tickets/mark-seen/user/${stallId}`);
        setUnreadTickets(0);
      } catch {
        /* ignore */
      }
    }
  };

  const dialStall = () => {
    const raw = stall?.phone;
    if (!raw || typeof raw !== 'string') return;
    const digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return;
    Linking.openURL(`tel:${digits}`).catch(() => {});
  };

  const renderMealCard = (meal: any) => {
    const soldOut = (meal.quantity ?? 0) <= 0;
    return (
      <View key={meal._id} style={styles.mealCard}>
        <Pressable style={styles.mealCardMain} onPress={() => openMeal(meal)}>
          <Image
            source={{ uri: meal.image || 'https://via.placeholder.com/160' }}
            style={styles.mealThumb}
          />
          <View style={styles.mealCardBody}>
            <View style={styles.mealTitleRow}>
              <Text style={styles.mealName} numberOfLines={1}>
                {meal.name}
              </Text>
              <Text style={styles.mealPrice}>Rs. {meal.price}</Text>
            </View>
            <Text style={styles.mealDesc} numberOfLines={2}>
              {meal.description || ' '}
            </Text>
            <View style={styles.mealCardFooter}>
              <View style={styles.mealMetaLeft}>
                {String(meal?.category ?? '').trim() ? (
                  <View style={styles.mealCatTag}>
                    <Text style={styles.mealCatTagText}>{String(meal.category).trim()}</Text>
                  </View>
                ) : (
                  <View style={[styles.mealCatTag, styles.mealCatTagMuted]}>
                    <Text style={styles.mealCatTagTextMuted}>{UNCATEGORIZED_LABEL}</Text>
                  </View>
                )}
                <View style={[styles.stockPill, soldOut && styles.stockPillMuted]}>
                  <Text style={[styles.stockPillText, soldOut && styles.stockPillTextMuted]}>
                    {soldOut ? 'Sold out' : `${meal.quantity} left`}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Pressable>
        <Pressable style={styles.viewPill} onPress={() => openMeal(meal)}>
          <Text style={styles.viewPillText}>View</Text>
        </Pressable>
      </View>
    );
  };

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
            {unreadTickets > 0 && <View style={styles.supportDot} />}
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
          <View style={styles.ratingPill}>
            <MaterialCommunityIcons name="star" size={16} color="#FFB800" />
            <Text style={styles.ratingPillText}>Ratings on dishes</Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              <Image source={{ uri: profileUri }} style={styles.profileAvatar} />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.stallTitle} numberOfLines={2}>
                {stall.name}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusPillText, { color: statusColor }]}>{isOpen ? 'Open' : 'Closed'}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.stallTagline}>{stall.description || 'No description provided.'}</Text>

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
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={COLORS.textGray} />
              <Text style={styles.locationText} numberOfLines={2}>
                {stall.address}
              </Text>
            </View>
          )}

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
                <View style={styles.mealsList}>{list.map((m) => renderMealCard(m))}</View>
              </View>
            ))
          ) : (
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionTitle}>{selectedCategory || 'Menu'}</Text>
              <View style={styles.mealsList}>{filteredSortedMeals.map((m) => renderMealCard(m))}</View>
            </View>
          )}
        </View>
      </ScrollView>

      <MealDetailsModal visible={mealVisible} onClose={() => setMealVisible(false)} meal={selectedMeal} />
      <UserTicketModal visible={ticketVisible} onClose={() => setTicketVisible(false)} stallId={stallId as string} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.surface },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: COLORS.textGray },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  topBarSide: {
    width: 112,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarSideRight: { justifyContent: 'flex-end', gap: 2 },
  topBarIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmarkWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.3,
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
    height: 200,
    width: '100%',
    backgroundColor: COLORS.primarySoft,
    position: 'relative',
  },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 91, 87, 0.18)' },
  ratingPill: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  ratingPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textDark,
  },

  sheet: {
    marginTop: -24,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 14,
    opacity: 0.85,
  },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 20,
    padding: 3,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  profileAvatar: { width: '100%', height: '100%', borderRadius: 16, backgroundColor: COLORS.primarySoft },
  titleBlock: { flex: 1, minWidth: 0 },
  stallTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '800' },

  stallTagline: {
    fontSize: 15,
    color: COLORS.textGray,
    lineHeight: 22,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaTextCol: { flex: 1, minWidth: 0 },
  metaLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textGray, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  metaValue: { fontSize: 15, color: COLORS.textDark, fontWeight: '700', lineHeight: 20 },
  metaValueLink: { color: COLORS.primary },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  locationText: { flex: 1, fontSize: 14, color: COLORS.textGray, fontWeight: '600', lineHeight: 20 },

  categoriesScroll: { marginHorizontal: -20, marginBottom: 6 },
  categoriesScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    backgroundColor: CHIP_INACTIVE_BG,
    marginRight: 10,
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

  menuSection: { marginBottom: 8 },
  menuSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 12,
    marginTop: 4,
  },

  mealsList: { gap: 12 },

  mealCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  mealCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minWidth: 0,
  },
  mealThumb: { width: 72, height: 72, borderRadius: 14, backgroundColor: COLORS.primarySoft },
  mealCardBody: { flex: 1, minWidth: 0 },
  mealTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  mealName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primary,
  },
  mealPrice: { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  mealDesc: { marginTop: 4, fontSize: 13, color: COLORS.textGray, lineHeight: 18 },
  mealCardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  mealMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealCatTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
  },
  mealCatTagMuted: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
  },
  mealCatTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  mealCatTagTextMuted: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textGray,
  },
  stockPill: {
    alignSelf: 'flex-start',
    backgroundColor: CALORIE_ORANGE_BG,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stockPillMuted: {
    backgroundColor: COLORS.background,
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: CALORIE_ORANGE_TEXT,
  },
  stockPillTextMuted: { color: COLORS.textGray },

  viewPill: {
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  viewPillText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

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
