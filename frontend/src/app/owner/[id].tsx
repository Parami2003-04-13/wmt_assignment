import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Text as RNText,
  Platform,
  ActivityIndicator,
  StatusBar,
  Alert,
  RefreshControl,
  Pressable,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api, { clearAuthStorage, getStoredUser } from '../../services/api';
import MealModal from '../../components/meal-modal';
import StallEditModal from '../../components/stall-edit-modal';
import AddStaffModal from '../../components/add-staff-modal';
import StaffTicketModal from '../../components/staff-ticket-modal';
import { COLORS } from '../../theme/colors';

/** Matches meal modal / backend Meal.category enum */
const MEAL_CATEGORY_OPTIONS = ['Breakfast', 'Lunch', 'Snacks', 'Drinks'] as const;
const MANAGE_UNCATEGORIZED = '__uncategorized__';

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
  const [addStaffVisible, setAddStaffVisible] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [menuManageOpen, setMenuManageOpen] = useState(false);
  const [selectedManageCategory, setSelectedManageCategory] = useState<string | null>(null);
  const [availBusyId, setAvailBusyId] = useState<string | null>(null);

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

  const fetchUnread = useCallback(async () => {
    if (!stallId) return;
    try {
      const response = await api.get(`/tickets/unread-count/staff/${stallId}`);
      setUnreadTickets(response.data.count);
    } catch (err) {
      console.error('Fetch unread error');
    }
  }, [stallId]);

  useEffect(() => {
    setLoading(true);
    fetchStallDetails();
    fetchMeals();
    fetchUnread();
  }, [stallId, fetchStallDetails, fetchMeals, fetchUnread]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getStoredUser();
      if (alive) setCurrentUser(u);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!stallId || !currentUser?.staffStallId) return;
    if (currentUser.role !== 'stall staff') return;
    if (String(currentUser.staffStallId) !== String(stallId)) {
      Alert.alert('Wrong stall', 'Opening the stall assigned to your account.', [
        {
          text: 'OK',
          onPress: () => router.replace(`/owner/${currentUser.staffStallId}`),
        },
      ]);
    }
  }, [stallId, currentUser, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchStallDetails(), fetchMeals(), fetchUnread()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchStallDetails, fetchMeals, fetchUnread]);

  const handleStaffLogout = async () => {
    await clearAuthStorage();
    router.replace('/login');
  };

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

  const manageCategoryTabs = useMemo(() => {
    const hasUncategorized = meals.some((m) => !(m?.category != null ? String(m.category).trim() : ''));
    const extras = new Set<string>();
    meals.forEach((m) => {
      const c = m?.category != null ? String(m.category).trim() : '';
      if (c && !(MEAL_CATEGORY_OPTIONS as readonly string[]).includes(c)) {
        extras.add(c);
      }
    });
    const tabs: string[] = ['All Items', ...MEAL_CATEGORY_OPTIONS];
    Array.from(extras)
      .sort((a, b) => a.localeCompare(b))
      .forEach((c) => tabs.push(c));
    if (hasUncategorized) tabs.push('Uncategorized');
    return tabs;
  }, [meals]);

  const filteredManageMeals = useMemo(() => {
    let list = [...meals];
    if (selectedManageCategory === MANAGE_UNCATEGORIZED) {
      list = list.filter((meal) => !(meal.category || '').trim());
    } else if (selectedManageCategory) {
      list = list.filter((meal) => (meal.category || '').trim() === selectedManageCategory);
    }
    list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    return list;
  }, [meals, selectedManageCategory]);

  const toggleMealAvailability = async (meal: any, available: boolean) => {
    if (!meal?._id || availBusyId) return;
    setAvailBusyId(meal._id);
    try {
      const current = Number(meal.quantity) || 0;
      const nextQty = available ? (current > 0 ? current : 25) : 0;
      await api.patch(`/meals/${meal._id}`, { quantity: nextQty });
      await fetchMeals();
    } catch {
      Alert.alert('Error', 'Could not update availability.');
    } finally {
      setAvailBusyId(null);
    }
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

  const managerId =
    typeof stall.manager === 'object' && stall.manager && stall.manager._id != null
      ? String(stall.manager._id)
      : stall.manager != null
        ? String(stall.manager)
        : '';

  const isStaffViewer =
    currentUser?.role === 'stall staff' && String(currentUser.staffStallId) === String(stallId);
  const isStallOwner =
    currentUser?.role === 'stall owner' &&
    !!managerId &&
    String(currentUser.id) === managerId;

  const canAccessCustomerSupport = isStaffViewer || isStallOwner;

  const openCustomerSupport = async () => {
    setTicketModalVisible(true);
    if (unreadTickets > 0 && stallId) {
      try {
        await api.put(`/tickets/mark-seen/staff/${stallId}`);
        setUnreadTickets(0);
      } catch {
        /* ignore */
      }
    }
  };

  const manageCoverUri =
    stall.coverPhoto ||
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} translucent={false} />

      {menuManageOpen ? (
        <ScrollView
          style={styles.manageRootScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.manageScrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }>
          <View style={styles.coverWrap}>
            <Image source={{ uri: manageCoverUri }} style={styles.coverPhoto} />
            <View style={styles.coverOverlay} />
            <Pressable
              style={[styles.roundIconBtn, { top: coverTop, left: 16 }]}
              onPress={() => setMenuManageOpen(false)}
              hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
            </Pressable>
            {canAccessCustomerSupport ? (
              <Pressable
                style={[styles.roundIconBtn, { top: coverTop, right: 16 }]}
                onPress={openCustomerSupport}
                hitSlop={12}>
                <View style={{ position: 'relative' }}>
                  <MaterialCommunityIcons name="headset" size={22} color="#fff" />
                  {unreadTickets > 0 ? <View style={styles.unreadDot} /> : null}
                </View>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={[styles.profileRow, { marginBottom: 14 }]}>
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
                <Text style={styles.menuSubtitle}>
                  Manage menu items · {meals.length} {meals.length === 1 ? 'meal' : 'meals'} total
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.managePrimaryBtn}
              onPress={handleAddMeal}
              activeOpacity={0.88}>
              <MaterialCommunityIcons name="plus" size={22} color="#fff" />
              <Text style={styles.managePrimaryBtnText}>Add meal</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionEyebrow, { marginTop: 4 }]}>Categories</Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.manageCategoriesScroll}
              contentContainerStyle={styles.manageCategoriesRow}>
              {manageCategoryTabs.map((tab) => {
                const isAll = tab === 'All Items';
                const isUncat = tab === 'Uncategorized';
                const value = isAll ? null : isUncat ? MANAGE_UNCATEGORIZED : tab;
                const active = isAll
                  ? selectedManageCategory == null
                  : selectedManageCategory === value;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.manageChip, active && styles.manageChipActive]}
                    onPress={() => setSelectedManageCategory(value)}
                    activeOpacity={0.85}>
                    <Text style={[styles.manageChipText, active && styles.manageChipTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.hoursMeta}>
              {selectedManageCategory == null
                ? `${meals.length} ${meals.length === 1 ? 'item' : 'items'} shown`
                : `${filteredManageMeals.length} of ${meals.length} with this category`}
            </Text>

            <View style={[styles.menuSectionHeader, { marginTop: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Your dishes</Text>
                <Text style={styles.menuSubtitle}>
                  {filteredManageMeals.length} listed · Toggle availability or edit details
                </Text>
              </View>
            </View>

            <View style={styles.manageMealsList}>
              {filteredManageMeals.map((meal) => {
                const available = (Number(meal.quantity) || 0) > 0;
                const qty = Number(meal.quantity) || 0;
                return (
                  <View key={meal._id} style={styles.manageMealCard}>
                    <View style={styles.manageMealTop}>
                      <Image
                        source={{ uri: meal.image || 'https://via.placeholder.com/150' }}
                        style={styles.manageMealThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.manageMealInfo}>
                        <Text style={styles.manageMealName} numberOfLines={2}>
                          {meal.name}
                        </Text>
                        <Text style={styles.manageMealDesc} numberOfLines={2}>
                          {meal.description || 'No description'}
                        </Text>
                        <View style={styles.manageMealMeta}>
                          <Text style={styles.manageMealPrice}>Rs. {meal.price}</Text>
                          <View style={styles.manageMealQtyPill}>
                            <Text style={styles.manageMealQtyText}>{qty} left</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    {(meal.category || '').trim() ? (
                      <View style={styles.manageMealCategoryRow}>
                        <View style={styles.manageMealCatTag}>
                          <Text style={styles.manageMealCatTagText}>{String(meal.category).trim()}</Text>
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.manageMealActions}>
                      <View style={styles.manageMealSwitchRow}>
                        <Switch
                          value={available}
                          onValueChange={(v) => toggleMealAvailability(meal, v)}
                          disabled={availBusyId === meal._id}
                          trackColor={{ false: COLORS.border, true: COLORS.primary }}
                          thumbColor="#fff"
                          ios_backgroundColor={COLORS.border}
                        />
                        <Text style={[styles.manageMealSwitchLabel, !available && styles.manageMealSwitchLabelOff]}>
                          {available ? 'Available' : 'Unavailable'}
                        </Text>
                      </View>
                      <View style={styles.manageMealIconRow}>
                        <TouchableOpacity style={styles.aboutEditBtn} onPress={() => handleEditMeal(meal)} activeOpacity={0.85}>
                          <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.primary} />
                          <Text style={styles.aboutEditBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.manageDeleteBtn}
                          onPress={() => handleDeleteMeal(meal._id)}
                          activeOpacity={0.85}>
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.danger} />
                          <Text style={styles.manageDeleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {filteredManageMeals.length === 0 ? (
              <View style={styles.manageEmptyWrap}>
                <MaterialCommunityIcons name="food-outline" size={42} color={COLORS.border} />
                <Text style={styles.manageEmptyTitle}>No meals here</Text>
                <Text style={styles.manageEmptySub}>
                  Try another category or tap Add meal to create one.
                </Text>
              </View>
            ) : null}

            <View style={{ height: Math.max(insets.bottom, 20) }} />
          </View>
        </ScrollView>
      ) : (
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
              onPress={() => router.canGoBack() ? router.back() : router.replace('/owner/owner_dashboard')}
              hitSlop={12}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
            </Pressable>

            {isStaffViewer ? (
              <Pressable
                style={[styles.roundIconBtn, { top: coverTop, right: 16 }]}
                onPress={handleStaffLogout}
                hitSlop={12}>
                <MaterialCommunityIcons name="logout" size={22} color="#fff" />
              </Pressable>
            ) : null}
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
                <View style={styles.titleToolbar}>
                  <View style={styles.titleStack}>
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
                  {isStallOwner && (
                    <TouchableOpacity
                      style={styles.addStaffBtn}
                      onPress={() => setAddStaffVisible(true)}
                      activeOpacity={0.85}>
                      <MaterialCommunityIcons name="account-plus-outline" size={22} color={COLORS.primary} />
                      <Text style={styles.addStaffBtnLabel}>Add staff</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <Text style={styles.hintTapStatus}>
              {isStaffViewer
                ? 'Staff: you can toggle Open/Closed during service and manage the menu. Payments are handled outside the app (cash, card at the stall).'
                : 'Tap status for manual Open/Closed. With business hours set, scheduling updates automatically whenever you refresh or save details (Asia/Colombo).'}
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
              {isStaffViewer ? (
                <>
                  <Text style={styles.sectionEyebrow}>About</Text>
                  <View style={styles.descCard}>
                    <Text style={styles.descText}>
                      {stall.description || 'No description provided.'}
                    </Text>
                  </View>
                  <View style={styles.staffInfoBanner}>
                    <MaterialCommunityIcons name="shield-account-outline" size={22} color={COLORS.primary} />
                    <Text style={styles.staffInfoBannerText}>
                      Staff account: editing description, phone, hours, and stall photos requires the stall owner&apos;s login.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.aboutHeader}>
                    <Text style={[styles.sectionEyebrow, styles.aboutEyebrowNoMb]}>About</Text>
                    <TouchableOpacity
                      style={styles.aboutEditBtn}
                      activeOpacity={0.85}
                      onPress={() => setStallEditVisible(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialCommunityIcons name="cog-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.aboutEditBtnText}>Stall settings</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.descCard}>
                    <Text style={styles.descText}>
                      {stall.description ||
                        'No description yet. Open Stall settings to describe what you serve.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stallEditLink}
                    activeOpacity={0.85}
                    onPress={() => setStallEditVisible(true)}>
                    <MaterialCommunityIcons name="store-edit-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.stallEditLinkText}>Hours, photos, phone & address</Text>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textGray} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            <View style={styles.menuSectionHeader}>
              <View>
                <Text style={styles.menuTitle}>Menu</Text>
                <Text style={styles.menuSubtitle}>
                  {meals.length} {meals.length === 1 ? 'item' : 'items'}
                  {isStaffViewer ? ' · staff: menu & stock' : ' · open Manage meals to edit'}
                </Text>
              </View>
              <View style={styles.menuActions}>
                <TouchableOpacity
                  style={styles.menuActionBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedManageCategory(null);
                    setMenuManageOpen(true);
                  }}>
                  <MaterialCommunityIcons name="silverware-fork-knife" size={18} color={COLORS.primary} />
                  <Text style={styles.menuActionText}>Manage meals</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuActionBtn}
                  activeOpacity={0.85}
                  onPress={() => router.push({
                    pathname: '/owner/manage-orders',
                    params: { stallId: stallId, stallName: stall.name }
                  })}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.menuActionText}>Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuActionBtn}
                  activeOpacity={0.85}
                  onPress={() => setStallEditVisible(true)}>
                  <MaterialCommunityIcons name="bank-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.menuActionText}>Edit Details</Text>
                </TouchableOpacity>
                {canAccessCustomerSupport ? (
                  <TouchableOpacity
                    style={styles.menuActionBtn}
                    activeOpacity={0.85}
                    onPress={openCustomerSupport}>
                    <View style={{ position: 'relative' }}>
                      <MaterialCommunityIcons name="headset" size={18} color={COLORS.primary} />
                      {unreadTickets > 0 ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text style={styles.menuActionText}>Customer support</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {meals.length === 0 ? (
              <TouchableOpacity
                style={styles.menuEmptyCta}
                activeOpacity={0.88}
                onPress={() => {
                  setSelectedManageCategory(null);
                  setMenuManageOpen(true);
                }}>
                <MaterialCommunityIcons name="silverware-fork-knife" size={36} color={COLORS.primary} />
                <Text style={styles.menuEmptyCtaTitle}>No menu items yet</Text>
                <Text style={styles.menuEmptyCtaSub}>Tap Manage meals above to add your first item.</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      )}

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
              profilePhoto: stall.profilePhoto ?? '',
              coverPhoto: stall.coverPhoto ?? '',
              bankName: stall.bankName ?? '',
              accountNumber: stall.accountNumber ?? '',
              accountName: stall.accountName ?? '',
              branchName: stall.branchName ?? '',
            }
            : null
        }
      />

      <AddStaffModal
        visible={addStaffVisible}
        stallId={stallId ?? null}
        onClose={() => setAddStaffVisible(false)}
        onChanged={() => { }}
      />
      <StaffTicketModal
        visible={ticketModalVisible}
        onClose={() => setTicketModalVisible(false)}
        stallId={stallId as string}
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

  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  titleToolbar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
  },
  titleStack: { flex: 1, minWidth: 0 },
  addStaffBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    maxWidth: 92,
    minWidth: 80,
    gap: 4,
  },
  addStaffBtnLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
  },
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
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  aboutEyebrowNoMb: { marginBottom: 0 },
  aboutEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aboutEditBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textGray,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    flexShrink: 0,
  },
  descCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  descText: { fontSize: 15, color: COLORS.textGray, lineHeight: 22 },
  stallEditLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  stallEditLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  staffInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  staffInfoBannerText: { flex: 1, fontSize: 13, color: COLORS.textDark, lineHeight: 19, fontWeight: '600' },

  menuSectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  menuTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textDark },
  menuSubtitle: { marginTop: 4, fontSize: 13, color: COLORS.textGray },
  menuActions: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  menuActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuActionText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  menuEmptyCta: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.background,
  },
  menuEmptyCtaTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
  },
  menuEmptyCtaSub: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  /** Menu management — same cover + sheet stack as main stall detail */
  manageRootScroll: { flex: 1, backgroundColor: COLORS.background },
  manageScrollContent: { flexGrow: 1, paddingBottom: 0 },
  managePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  managePrimaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  /** Match `user/stall` category chips */
  manageCategoriesScroll: {
    marginBottom: 6,
    marginLeft: -20,
    marginRight: -20,
  },
  manageCategoriesRow: {
    paddingLeft: 20,
    paddingRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingVertical: 4,
  },
  manageChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 10,
    backgroundColor: COLORS.surface,
  },
  manageChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  manageChipText: { fontSize: 13, fontWeight: '700', color: COLORS.textGray },
  manageChipTextActive: { color: '#fff' },
  manageMealsList: { gap: 10, marginTop: 4 },
  /** Match `user/stall` meal row + owner action row */
  manageMealCard: {
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  manageMealTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  manageMealThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
  },
  manageMealInfo: { flex: 1, minWidth: 0 },
  manageMealName: { fontSize: 15, fontWeight: '900', color: COLORS.textDark },
  manageMealDesc: { marginTop: 4, fontSize: 13, color: COLORS.textGray, lineHeight: 18 },
  manageMealMeta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  manageMealPrice: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  manageMealQtyPill: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  manageMealQtyText: { fontSize: 11, fontWeight: '800', color: COLORS.textGray },
  manageMealCategoryRow: { marginTop: 10 },
  manageMealCatTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  manageMealCatTagText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  manageMealActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  manageMealSwitchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  manageMealSwitchLabel: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  manageMealSwitchLabelOff: { color: COLORS.textGray },
  manageMealIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  manageDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  manageDeleteBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.danger },
  manageEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  manageEmptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  manageEmptySub: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
});
