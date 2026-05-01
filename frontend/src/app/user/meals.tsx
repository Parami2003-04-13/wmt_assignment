import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MealDetailsModal from '../../components/meal-details-modal';
import api from '../../services/api';
import { COLORS } from '../../theme/colors';

const PRIMARY = COLORS.primary;
const PRIMARY_DARK = COLORS.primaryDark;
const PRIMARY_SOFT = COLORS.primarySoft;
const TEXT_DARK = COLORS.textDark;
const TEXT_GRAY = COLORS.textGray;
const SURFACE = COLORS.surface;
const BG = COLORS.background;
const CHIP_BORDER = '#C5E8E6';
/** Matches backend `Meal.category` and owner menu UI */
const PRESET_MEAL_CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Drinks'] as const;
const UNCATEGORIZED_LABEL = 'Uncategorized';
const CHIP_INACTIVE_BG = '#E8F4F3';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

function getMealStallId(meal: any): string | null {
  if (!meal) return null;
  if (typeof meal.stall === 'string') return meal.stall;
  return meal.stall?._id != null ? String(meal.stall._id) : null;
}

export default function AllMealsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [meals, setMeals] = useState<any[]>([]);
  const [stalls, setStalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const [stallsRes, mealsRes] = await Promise.all([api.get('/stalls'), api.get('/meals')]);
      const approved = Array.isArray(stallsRes.data) ? stallsRes.data.filter((s: any) => s?.isApproved) : [];
      setStalls(approved);
      setMeals(Array.isArray(mealsRes.data) ? mealsRes.data : []);
    } catch {
      setStalls([]);
      setMeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const stallById = useMemo(() => {
    const map: Record<string, any> = {};
    stalls.forEach((s: any) => {
      if (s?._id != null) map[String(s._id)] = s;
    });
    return map;
  }, [stalls]);

  const approvedIds = useMemo(() => new Set(Object.keys(stallById)), [stallById]);

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);

  const baseMeals = useMemo(
    () =>
      meals.filter((m: any) => {
        const sid = getMealStallId(m);
        return sid != null && approvedIds.has(String(sid));
      }),
    [meals, approvedIds],
  );

  const categoryChips = useMemo(() => {
    const presets = [...PRESET_MEAL_CATEGORIES];
    const extras = new Set<string>();
    let hasUncategorized = false;
    baseMeals.forEach((m: any) => {
      const c = String(m?.category ?? '').trim();
      if (!c) hasUncategorized = true;
      else if (!(PRESET_MEAL_CATEGORIES as readonly string[]).includes(c)) extras.add(c);
    });
    const extraSorted = Array.from(extras).sort((a, b) => a.localeCompare(b));
    const tail = [...extraSorted];
    if (hasUncategorized) tail.push(UNCATEGORIZED_LABEL);
    return ['All', ...presets, ...tail];
  }, [baseMeals]);

  const listMeals = useMemo(() => {
    let rows = [...baseMeals];
    if (normalizedQuery) {
      rows = rows.filter((m: any) => {
        const sid = getMealStallId(m);
        const st = sid ? stallById[String(sid)] : null;
        const pop =
          typeof m?.stall === 'object' && m.stall
            ? `${m.stall.name ?? ''} ${m.stall.description ?? ''}`
            : '';
        const bundle = `${m?.name ?? ''} ${m?.description ?? ''} ${String(m?.price ?? '')} ${String(m?.category ?? '')} ${st?.name ?? ''} ${pop}`;
        return bundle.toLowerCase().includes(normalizedQuery);
      });
    }
    if (selectedCategory === UNCATEGORIZED_LABEL) {
      rows = rows.filter((m: any) => !String(m?.category ?? '').trim());
    } else if (selectedCategory) {
      rows = rows.filter((m: any) => String(m?.category ?? '').trim() === selectedCategory);
    }
    rows.sort((a: any, b: any) => {
      const sa = stallById[String(getMealStallId(a) || '')]?.name || '';
      const sb = stallById[String(getMealStallId(b) || '')]?.name || '';
      const cmp = String(sa).localeCompare(String(sb));
      if (cmp !== 0) return cmp;
      return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
    });
    return rows;
  }, [baseMeals, stallById, normalizedQuery, selectedCategory]);

  const openMeal = (meal: any) => {
    setSelectedMeal(meal);
    setModalVisible(true);
  };

  const stallLabel = (meal: any) => {
    const sid = getMealStallId(meal);
    if (typeof meal?.stall === 'object' && meal.stall?.name) return String(meal.stall.name);
    return (sid && stallById[String(sid)]?.name) || 'Campus stall';
  };

  const headerPadTop = Math.max(insets.top, 12);

  const renderCard = ({ item: meal }: { item: any }) => {
    const qty = Number(meal?.quantity ?? 0);
    const category = meal?.category ? String(meal.category).trim() : '';
    const desc = meal?.description ? String(meal.description).trim() : '';
    const uri = meal.image || 'https://via.placeholder.com/600';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openMeal(meal)}
        activeOpacity={0.92}
      >
        <View style={styles.cardImageWrap}>
          <Image source={{ uri }} style={styles.cardImage} resizeMode="cover" />
          <View style={styles.cardScrim} />
          {category ? (
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>{category}</Text>
            </View>
          ) : (
            <View style={[styles.cardBadge, styles.cardBadgeGhost]}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={12} color={PRIMARY} />
              <Text style={[styles.cardBadgeText, styles.cardBadgeTextMuted]}>Dish</Text>
            </View>
          )}
          <View style={styles.cardPricePill}>
            <Text style={styles.cardPricePillText}>Rs. {meal.price}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {meal.name}
          </Text>
          {desc ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {desc}
            </Text>
          ) : null}

          <View style={styles.cardStallRow}>
            <MaterialCommunityIcons name="storefront-outline" size={16} color={TEXT_GRAY} />
            <Text style={styles.cardStallName} numberOfLines={1}>
              {stallLabel(meal)}
            </Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.cardFooter}>
            <View style={styles.stockGroup}>
              <View style={[styles.stockDot, qty > 0 ? styles.stockDotIn : styles.stockDotOut]} />
              <Text style={styles.stockLabel}>
                {qty > 10 ? 'In stock' : qty > 0 ? `${qty} left` : 'Unavailable'}
              </Text>
            </View>
            <View style={styles.tapHint}>
              <Text style={styles.tapHintText}>View</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={PRIMARY} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const emptyState = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBg}>
        <MaterialCommunityIcons name="food-variant" size={40} color={PRIMARY} />
      </View>
      <Text style={styles.emptyTitle}>
        {meals.length === 0 ? 'No meals yet' : 'No matches'}
      </Text>
      <Text style={styles.emptySub}>
        {meals.length === 0
          ? 'Approved stalls haven’t published items, or the list couldn’t load.'
          : 'Try another category filter, adjust your search, or reset filters below.'}
      </Text>
      {(normalizedQuery.length > 0 || selectedCategory != null) && baseMeals.length > 0 ? (
        <TouchableOpacity
          style={styles.clearSearchBtn}
          onPress={() => {
            setQuery('');
            setSelectedCategory(null);
          }}
          activeOpacity={0.85}>
          <Text style={styles.clearSearchBtnText}>Clear search & filters</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} translucent={false} />

      <View style={[styles.hero, { paddingTop: headerPadTop }]}>
        <View style={styles.heroTop}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroTitles}>
            <Text style={styles.heroTitle}>All meals</Text>
            <Text style={styles.heroSubtitle}>Full campus menu · tap a card for details</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="rgba(255,255,255,0.88)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, stall, category…"
            placeholderTextColor="rgba(255,255,255,0.58)"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <MaterialCommunityIcons name="close-circle" size={20} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          ) : null}
        </View>

        {!loading ? (
          <Text style={styles.metaLine}>
            Showing {listMeals.length} {listMeals.length === 1 ? 'dish' : 'dishes'} · {stalls.length}{' '}
            {stalls.length === 1 ? 'stall' : 'stalls'}
            {selectedCategory ? ` · ${selectedCategory === UNCATEGORIZED_LABEL ? 'Uncategorized' : selectedCategory}` : ''}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loaderText}>Loading menus…</Text>
        </View>
      ) : (
        <>
          <View style={styles.filterSection}>
            <Text style={styles.filterEyebrow}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipScroll}
              nestedScrollEnabled>
              {categoryChips.map((label) => {
                const isAll = label === 'All';
                const isActive = isAll ? selectedCategory === null : selectedCategory === label;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => {
                      if (isAll) setSelectedCategory(null);
                      else setSelectedCategory(isActive ? null : label);
                    }}
                    activeOpacity={0.85}>
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <FlatList
            data={listMeals}
            keyExtractor={(item) => String(item._id)}
            renderItem={renderCard}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 28 },
              listMeals.length === 0 && styles.listContentEmpty,
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} colors={[PRIMARY]} />
            }
            ListEmptyComponent={emptyState}
          />
        </>
      )}

      <MealDetailsModal visible={modalVisible} onClose={() => setModalVisible(false)} meal={selectedMeal} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  hero: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    marginLeft: -8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitles: {
    flex: 1,
    paddingTop: 2,
    paddingRight: 8,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 0,
    fontWeight: '600',
  },
  metaLine: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.2,
  },

  filterSection: {
    backgroundColor: BG,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 91, 87, 0.08)',
  },
  filterEyebrow: {
    marginLeft: 16,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '800',
    color: TEXT_GRAY,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
  },
  filterChipScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingBottom: 2,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 10,
    backgroundColor: CHIP_INACTIVE_BG,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
  },
  filterChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
  },
  filterChipTextActive: {
    color: SURFACE,
  },

  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  loaderText: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_GRAY,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  card: {
    marginBottom: 20,
    backgroundColor: SURFACE,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.09)',
    shadowColor: PRIMARY_DARK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  cardImageWrap: {
    height: 168,
    width: '100%',
    backgroundColor: PRIMARY_SOFT,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 40, 38, 0.12)',
  },
  cardBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: CHIP_BORDER,
    gap: 4,
  },
  cardBadgeGhost: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: 0.2,
  },
  cardBadgeTextMuted: {
    color: PRIMARY_DARK,
  },
  cardPricePill: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  cardPricePillText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.2,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  cardDesc: {
    marginTop: 8,
    fontSize: 14,
    color: TEXT_GRAY,
    lineHeight: 20,
    fontWeight: '600',
  },
  cardStallRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardStallName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_GRAY,
  },
  cardDivider: {
    marginTop: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 91, 87, 0.12)',
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  stockDotIn: {
    backgroundColor: COLORS.success,
  },
  stockDotOut: {
    backgroundColor: COLORS.danger,
  },
  stockLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_GRAY,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_SOFT,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHIP_BORDER,
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
    marginRight: 2,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIconBg: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: PRIMARY_SOFT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CHIP_BORDER,
  },
  emptyTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 10,
    fontSize: 15,
    color: TEXT_GRAY,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
  },
  clearSearchBtn: {
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: PRIMARY,
  },
  clearSearchBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
