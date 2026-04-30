import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { COLORS } from '../../../theme/colors';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

const COLOR_OPEN = COLORS.success;
const COLOR_CLOSED = COLORS.danger;

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

  const fetchAll = useCallback(async () => {
    if (!stallId) return;
    const [stallRes, mealsRes] = await Promise.all([api.get(`/stalls/${stallId}`), api.get(`/meals/stall/${stallId}`)]);
    setStall(stallRes.data);
    setMeals(Array.isArray(mealsRes.data) ? mealsRes.data : []);
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

  const coverTop = Math.max(insets.top, 12) + 8;
  const coverUri = stall?.coverPhoto || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000';
  const profileUri = stall?.profilePhoto || 'https://via.placeholder.com/150';

  const sortedMeals = useMemo(() => {
    const m = [...meals];
    m.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    return m;
  }, [meals]);

  const openMeal = (meal: any) => {
    setSelectedMeal(meal);
    setMealVisible(true);
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

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }>
        <View style={styles.coverWrap}>
          <Image source={{ uri: coverUri }} style={styles.coverPhoto} />
          <View style={styles.coverOverlay} />

          <Pressable style={[styles.roundIconBtn, { top: coverTop, left: 16 }]} onPress={() => router.back()} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              <Image source={{ uri: profileUri }} style={styles.avatar} />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.stallName} numberOfLines={2}>
                {stall.name}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusPillText, { color: statusColor }]}>{isOpen ? 'Open' : 'Closed'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCards}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconBg}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardLabel}>Location</Text>
              <Text style={styles.infoCardValue} numberOfLines={3}>
                {stall.address}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.infoIconBg}>
                <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardLabel}>Status</Text>
              <Text style={styles.infoCardValue}>{stall.status || 'Unknown'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>Description</Text>
            <View style={styles.descCard}>
              <Text style={styles.descText}>{stall.description || 'No description provided.'}</Text>
            </View>
          </View>

          <View style={styles.menuHeader}>
            <View>
              <Text style={styles.menuTitle}>Meals</Text>
              <Text style={styles.menuSubtitle}>{sortedMeals.length} offered</Text>
            </View>
          </View>

          <View style={styles.mealsList}>
            {sortedMeals.map((meal) => (
              <Pressable key={meal._id} style={styles.mealRow} onPress={() => openMeal(meal)}>
                <Image source={{ uri: meal.image || 'https://via.placeholder.com/160' }} style={styles.mealThumb} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.mealName} numberOfLines={1}>
                    {meal.name}
                  </Text>
                  <Text style={styles.mealDesc} numberOfLines={2}>
                    {meal.description}
                  </Text>
                  <View style={styles.mealMeta}>
                    <Text style={styles.mealPrice}>Rs. {meal.price}</Text>
                    <View style={styles.qtyPill}>
                      <Text style={styles.qtyPillText}>{meal.quantity ?? 0} left</Text>
                    </View>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textGray} />
              </Pressable>
            ))}

            {sortedMeals.length === 0 && (
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="food-outline" size={44} color={COLORS.border} />
                <Text style={styles.emptyTitle}>No meals yet</Text>
                <Text style={styles.emptySub}>This stall hasn’t listed any items.</Text>
              </View>
            )}
          </View>

          <View style={{ height: 30 }} />
        </View>
      </ScrollView>

      <MealDetailsModal visible={mealVisible} onClose={() => setMealVisible(false)} meal={selectedMeal} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, fontSize: 15, color: COLORS.textGray },

  coverWrap: { height: 230, width: '100%', backgroundColor: COLORS.primarySoft },
  coverPhoto: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 40, 38, 0.35)' },
  roundIconBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sheet: {
    marginTop: -28,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: 16, opacity: 0.85 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: { width: 88, height: 88, borderRadius: 22, padding: 3, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.primarySoft },
  avatar: { width: '100%', height: '100%', borderRadius: 18, backgroundColor: COLORS.primarySoft },
  titleBlock: { flex: 1, minWidth: 0 },
  stallName: { fontSize: 22, fontWeight: '900', color: COLORS.textDark, letterSpacing: -0.2, marginBottom: 10 },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontSize: 14, fontWeight: '800' },

  infoCards: { flexDirection: 'row', gap: 12, marginTop: 14, marginBottom: 18 },
  infoCard: { flex: 1, backgroundColor: COLORS.background, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  infoIconBg: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  infoCardLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textGray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  infoCardValue: { fontSize: 14, color: COLORS.textDark, fontWeight: '600', lineHeight: 20 },

  section: { marginBottom: 16 },
  sectionEyebrow: { fontSize: 11, fontWeight: '800', color: COLORS.textGray, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  descCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  descText: { fontSize: 15, color: COLORS.textGray, lineHeight: 22 },

  menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  menuTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textDark },
  menuSubtitle: { marginTop: 4, fontSize: 13, color: COLORS.textGray },
  mealsList: { gap: 10 },

  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mealThumb: { width: 66, height: 66, borderRadius: 14, backgroundColor: COLORS.primarySoft },
  mealName: { fontSize: 15, fontWeight: '900', color: COLORS.textDark },
  mealDesc: { marginTop: 4, fontSize: 13, color: COLORS.textGray, lineHeight: 18 },
  mealMeta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealPrice: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  qtyPill: { backgroundColor: COLORS.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  qtyPillText: { fontSize: 11, fontWeight: '800', color: COLORS.textGray },

  emptyWrap: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  emptySub: { marginTop: 6, fontSize: 14, color: COLORS.textGray, textAlign: 'center', lineHeight: 20 },
});

