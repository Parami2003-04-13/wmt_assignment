import React, { useCallback, useEffect, useState } from 'react';
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
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import MealModal from '../../components/meal-modal';
import StallEditModal from '../../components/stall-edit-modal';
import { COLORS } from '../../theme/colors';

const { width } = Dimensions.get('window');
const GRID_GAP = 10;
const CARD_W = (width - 40 - GRID_GAP) / 2;
const COLOR_OPEN = COLORS.success;
const COLOR_CLOSED = COLORS.danger;

const Text = (props: any) => (
  <RNText
    {...props}
    style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]}
  />
);

export default function StallManagement() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stall, setStall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [meals, setMeals] = useState<any[]>([]);
  const [mealModalVisible, setMealModalVisible] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<any>(null);
  const [stallEditVisible, setStallEditVisible] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const stallId = Array.isArray(id) ? id[0] : id;

  const fetchStallDetails = useCallback(async () => {
    if (!stallId) return;
    try {
      const response = await api.get(`/stalls/${stallId}`);
      setStall(response.data);
    } catch {
      Alert.alert('Error', 'Failed to load stall details');
    } finally {
      setLoading(false);
    }
  }, [stallId]);

  const fetchMeals = useCallback(async () => {
    if (!stallId) return;
    try {
      const response = await api.get(`/meals/stall/${stallId}`);
      setMeals(response.data);
    } catch {
      console.error('Fetch meals error');
    }
  }, [stallId]);

  useEffect(() => {
    setLoading(true);
    fetchStallDetails();
    fetchMeals();
  }, [stallId, fetchStallDetails, fetchMeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchStallDetails(), fetchMeals()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchStallDetails, fetchMeals]);

  const handleDeleteMeal = (mealId: string) => {
    Alert.alert('Delete meal', 'Remove this item from your menu?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/meals/${mealId}`);
            Alert.alert('Removed', 'Meal deleted successfully');
            fetchMeals();
          } catch {
            Alert.alert('Error', 'Failed to delete meal');
          }
        },
      },
    ]);
  };

  const handleEditMeal = (meal: any) => {
    setSelectedMeal(meal);
    setMealModalVisible(true);
  };

  const handleAddMeal = () => {
    setSelectedMeal(null);
    setMealModalVisible(true);
  };

  const confirmToggleStatus = () => {
    if (!stall || statusBusy) return;
    const isOpen = stall.status === 'Open';
    const next = isOpen ? 'Closed' : 'Open';
    Alert.alert(
      `${isOpen ? 'Close' : 'Open'} stall?`,
      'Manual mode pauses automatic open/closed from business hours until you save hours again in Edit stall details.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next,
          onPress: async () => {
            setStatusBusy(true);
            try {
              const { data } = await api.patch(`/stalls/${stallId}/status`, { status: next });
              setStall((s: any) => (s ? { ...s, ...data } : data));
            } catch {
              Alert.alert('Error', 'Could not update status');
            } finally {
              setStatusBusy(false);
            }
          },
        },
      ]
    );
  };

  const coverTop = Math.max(insets.top, 12) + 8;

  if (loading && !stall) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading stall…</Text>
      </View>
    );
  }

  if (!stall) return null;

  const isOpen = stall.status === 'Open';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }>
        <View style={styles.coverWrap}>
          <Image
            source={{
              uri:
                stall.coverPhoto ||
                'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000',
            }}
            style={styles.coverPhoto}
          />
          <View style={styles.coverOverlay} />

          <Pressable
            style={[styles.roundIconBtn, { top: coverTop, left: 16 }]}
            onPress={() => router.back()}
            hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </Pressable>

          <Pressable
            style={[styles.roundIconBtn, { top: coverTop, right: 16 }]}
            onPress={onRefresh}
            hitSlop={12}>
            <MaterialCommunityIcons name="refresh" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.profileRow}>
            <View style={styles.avatarRing}>
              <Image
                source={{
                  uri: stall.profilePhoto || 'https://via.placeholder.com/150',
                }}
                style={styles.avatar}
              />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.stallName} numberOfLines={2}>
                {stall.name}
              </Text>
              <TouchableOpacity
                style={[styles.statusPill, { backgroundColor: isOpen ? '#DCF5ED' : '#FDECEC' }]}
                onPress={confirmToggleStatus}
                disabled={statusBusy}
                activeOpacity={0.85}>
                {statusBusy ? (
                  <ActivityIndicator size="small" color={isOpen ? COLOR_OPEN : COLOR_CLOSED} />
                ) : (
                  <>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isOpen ? COLOR_OPEN : COLOR_CLOSED },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isOpen ? COLOR_OPEN : COLOR_CLOSED },
                      ]}>
                      {isOpen ? 'Open' : 'Closed'}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={16}
                      color={isOpen ? COLOR_OPEN : COLOR_CLOSED}
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.hintTapStatus}>
            Tap status for manual Open/Closed. With business hours set, scheduling updates automatically whenever you refresh
            or save details (Asia/Colombo).
          </Text>

          {stall.openingTime && stall.closingTime ? (
            <View style={styles.hoursBanner}>
              <MaterialCommunityIcons name="clock-outline" size={22} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.hoursTime}>
                  {stall.openingTime} – {stall.closingTime}
                </Text>
                <Text style={styles.hoursMeta}>
                  {stall.hoursAuto ? 'Scheduled · Asia/Colombo · auto updates on refresh/save' : 'Hours saved · manual status'}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoCards}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconBg}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardLabel}>Address</Text>
              <Text style={styles.infoCardValue} numberOfLines={3}>
                {stall.address}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <View style={styles.infoIconBg}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.infoCardLabel}>Phone</Text>
              <Text style={styles.infoCardValue}>{stall.phone}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionEyebrow}>About</Text>
            <View style={styles.descCard}>
              <Text style={styles.descText}>
                {stall.description ||
                  'No description yet. Tap Edit stall details to tell customers what you serve.'}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.9} onPress={() => setStallEditVisible(true)}>
            <MaterialCommunityIcons name="store-edit-outline" size={20} color={COLORS.primary} />
            <Text style={styles.secondaryBtnText}>Edit stall details</Text>
          </TouchableOpacity>

          <View style={styles.menuSectionHeader}>
            <View>
              <Text style={styles.menuTitle}>Menu</Text>
              <Text style={styles.menuSubtitle}>{meals.length} items</Text>
            </View>
          </View>

          <View style={styles.mealsGrid}>
            <TouchableOpacity style={styles.addCard} onPress={handleAddMeal} activeOpacity={0.9}>
              <View style={styles.addIconRing}>
                <MaterialCommunityIcons name="plus" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.addLabel}>Add meal</Text>
            </TouchableOpacity>

            {meals.map((meal) => (
              <View key={meal._id} style={styles.mealCard}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => handleEditMeal(meal)}>
                  <View style={styles.mealImageWrap}>
                    <Image
                      source={{
                        uri: meal.image || 'https://via.placeholder.com/150',
                      }}
                      style={styles.mealImg}
                    />
                    <View style={styles.mealActions}>
                      <Pressable
                        style={styles.mealActBtn}
                        onPress={() => handleEditMeal(meal)}
                        hitSlop={8}>
                        <MaterialCommunityIcons name="pencil" size={16} color={COLORS.primary} />
                      </Pressable>
                      <Pressable
                        style={styles.mealActBtn}
                        onPress={() => handleDeleteMeal(meal._id)}
                        hitSlop={8}>
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={COLORS.danger} />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.mealBody}>
                    <Text style={styles.mealTitle} numberOfLines={2}>
                      {meal.name}
                    </Text>
                    <View style={styles.mealFooter}>
                      <Text style={styles.mealPrice}>Rs. {meal.price}</Text>
                      <View style={styles.qtyPill}>
                        <Text style={styles.qtyPillText}>{meal.quantity} left</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {meals.length === 0 && (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="food-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No meals yet</Text>
              <Text style={styles.emptySub}>Add your first item to appear on CampusBites.</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      <MealModal
        visible={mealModalVisible}
        onClose={() => setMealModalVisible(false)}
        onSave={fetchMeals}
        stallId={stallId as string}
        meal={selectedMeal}
      />

      <StallEditModal
        visible={stallEditVisible}
        onClose={() => setStallEditVisible(false)}
        onSaved={() => {
          fetchStallDetails();
        }}
        stallId={stallId as string}
        initial={
          stall
            ? {
                phone: stall.phone ?? '',
                description: stall.description ?? '',
                openingTime: stall.openingTime ?? '',
                closingTime: stall.closingTime ?? '',
              }
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: { marginTop: 12, fontSize: 15, color: COLORS.textGray },
  scrollContent: { paddingBottom: 0 },

  coverWrap: {
    height: 220,
    width: '100%',
    backgroundColor: COLORS.primarySoft,
  },
  coverPhoto: { width: '100%', height: '100%' },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 40, 38, 0.35)',
  },
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
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 16,
    opacity: 0.85,
  },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 22,
    padding: 3,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
  },
  titleBlock: { flex: 1, minWidth: 0 },

  stallName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textDark,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillText: { fontSize: 14, fontWeight: '800' },
  hintTapStatus: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textGray,
    marginBottom: 12,
    lineHeight: 17,
  },

  hoursBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hoursTime: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  hoursMeta: { marginTop: 4, fontSize: 12, color: COLORS.textGray, lineHeight: 16 },

  infoCards: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoCardValue: {
    fontSize: 14,
    color: COLORS.textDark,
    fontWeight: '600',
    lineHeight: 20,
  },

  section: { marginBottom: 16 },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textGray,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  descCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  descText: { fontSize: 15, color: COLORS.textGray, lineHeight: 22 },

  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    marginBottom: 22,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },

  menuSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  menuTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textDark },
  menuSubtitle: { marginTop: 4, fontSize: 13, color: COLORS.textGray },

  mealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GRID_GAP / 2,
  },
  addCard: {
    width: CARD_W,
    margin: GRID_GAP / 2,
    aspectRatio: 0.88,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addIconRing: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addLabel: { fontSize: 14, fontWeight: '800', color: COLORS.textGray },

  mealCard: {
    width: CARD_W,
    margin: GRID_GAP / 2,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  mealImageWrap: { position: 'relative', height: 118, backgroundColor: COLORS.background },
  mealImg: { width: '100%', height: '100%' },
  mealActions: {
    position: 'absolute',
    right: 8,
    top: 8,
    gap: 8,
    flexDirection: 'column',
  },
  mealActBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mealBody: { padding: 12 },
  mealTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textDark, minHeight: 38 },
  mealFooter: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealPrice: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  qtyPill: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyPillText: { fontSize: 11, fontWeight: '800', color: COLORS.textGray },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  emptySub: { marginTop: 6, fontSize: 14, color: COLORS.textGray, textAlign: 'center', lineHeight: 20 },
});
