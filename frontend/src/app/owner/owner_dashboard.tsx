import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Alert,
  StatusBar,
  Text as RNText,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LeafletMap from '../../components/leaflet_map';
import api, { clearAuthStorage, getStoredUser } from '../../services/api';
import { COLORS } from '../../theme/colors';

const COLOR_OPEN = COLORS.success;
const COLOR_CLOSED = COLORS.danger;

const Text = (props: any) => (
  <RNText
    {...props}
    style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]}
  />
);

export default function OwnerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [stallData, setStallData] = useState({
    name: '',
    address: '',
    phone: '',
    description: '',
    profilePhoto: null as string | null,
    coverPhoto: null as string | null,
    approvedDocument: null as string | null,
  });

  const [region, setRegion] = useState({
    latitude: 6.9271,
    longitude: 79.8612,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [userId, setUserId] = useState('');
  const [stalls, setStalls] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);

  const approvedCount = useMemo(() => stalls.filter((s) => s.isApproved).length, [stalls]);
  const pendingCount = useMemo(() => stalls.filter((s) => !s.isApproved).length, [stalls]);

  const fetchMyStalls = useCallback(async (id: string) => {
    try {
      const response = await api.get(`/stalls/manager/${id}`);
      setStalls(response.data);
    } catch (error) {
      console.error('Fetch stalls error:', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await fetchMyStalls(userId);
    } finally {
      setRefreshing(false);
    }
  }, [userId, fetchMyStalls]);

  useEffect(() => {
    let isMounted = true;
    const checkRole = async () => {
      const user = await getStoredUser();
      if (isMounted) {
        if (user) {
          if (user.role !== 'stall owner') {
            router.replace('/login');
            return;
          }
          setUserName(user.name);
          setUserId(user.id);
          fetchMyStalls(user.id);
        } else {
          router.replace('/login');
        }
        setLoading(false);
      }
    };
    checkRole();
    return () => {
      isMounted = false;
    };
  }, [fetchMyStalls, router]);

  const handleSaveStall = async () => {
    if (
      !stallData.name ||
      !stallData.address ||
      !stallData.phone ||
      !stallData.profilePhoto ||
      !stallData.approvedDocument
    ) {
      Alert.alert('Error', 'Please fill in all required fields and upload the approval document.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/stalls', {
        ...stallData,
        latitude: region.latitude,
        longitude: region.longitude,
        managerId: userId,
      });

      Alert.alert('Submitted', 'We will verify your stall and notify via email.');
      setModalVisible(false);
      fetchMyStalls(userId);
      setStallData({
        name: '',
        address: '',
        phone: '',
        description: '',
        profilePhoto: null,
        coverPhoto: null,
        approvedDocument: null,
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to save stall.');
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (type: 'profile' | 'cover' | 'doc') => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : type === 'cover' ? [16, 9] : undefined,
      quality: 1,
    });

    if (!result.canceled) {
      if (type === 'profile') setStallData({ ...stallData, profilePhoto: result.assets[0].uri });
      else if (type === 'cover')
        setStallData({ ...stallData, coverPhoto: result.assets[0].uri });
      else setStallData({ ...stallData, approvedDocument: result.assets[0].uri });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 2) {
        performDynamicSearch();
      } else {
        setSearchResults([]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performDynamicSearch = async () => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        { headers: { 'User-Agent': 'CampusBites-App', Accept: 'application/json' } }
      );
      const text = await response.text();
      if (response.ok) {
        const data = JSON.parse(text);
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    setRegion({ ...region, latitude: lat, longitude: lon });
    setSearchResults([]);
    setSearchQuery(item.display_name);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    performDynamicSearch();
  };

  const handleLogout = () => {
    setAccountMenuVisible(false);
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await clearAuthStorage();
          router.replace('/login');
        },
        style: 'destructive',
      },
    ]);
  };

  const firstName = userName.trim().split(/\s+/)[0] || userName;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  const showFab = stalls.length > 0 && stalls.some((s) => s.isApproved);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} translucent={false} />

      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>Partner hub</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              Hi, {firstName}
            </Text>
            <Text style={styles.heroSubtitle}>
              Your stalls, approvals, and registrations in one place.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAccountMenuVisible(true)}
            style={styles.logoutChip}
            accessibilityRole="button"
            accessibilityLabel="Account menu">
            <MaterialCommunityIcons name="account-circle-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {stalls.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconBadge}>
                <MaterialCommunityIcons name="storefront-outline" size={19} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stalls.length}</Text>
              <Text style={styles.statLabel}>Stalls</Text>
            </View>
            <View style={[styles.statCard, styles.statCardAccent]}>
              <View style={[styles.statIconBadge, styles.statIconBadgeLive]}>
                <MaterialCommunityIcons name="check-bold" size={20} color="#0B3F3C" />
              </View>
              <Text style={styles.statValue}>{approvedCount}</Text>
              <Text style={styles.statLabel}>Live</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconBadge}>
                <MaterialCommunityIcons name="clock-outline" size={19} color="#E8D48B" />
              </View>
              <Text style={styles.statValue}>{pendingCount}</Text>
              <Text style={styles.statLabel}>Review</Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }>
        {stalls.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconRing}>
              <MaterialCommunityIcons name="store-plus-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No stalls yet</Text>
            <Text style={styles.emptyBody}>
              Register your stall, upload proof, and pin your location—we’ll notify you once it’s verified.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setModalVisible(true)}>
              <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#fff" />
              <Text style={styles.primaryBtnText}>Register your stall</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Your stalls</Text>

            {stalls.map((stall) => {
              if (!stall.isApproved) {
                return (
                  <View key={stall._id} style={styles.pendingCard}>
                    <View style={styles.pendingAccent} />
                    <View style={styles.pendingInner}>
                      <View style={styles.pendingBadgeRow}>
                        <View style={styles.pendingPill}>
                          <MaterialCommunityIcons name="shield-search" size={16} color="#B8860B" />
                          <Text style={styles.pendingPillText}> Under review</Text>
                        </View>
                      </View>
                      <Text style={styles.pendingStallName} numberOfLines={1}>
                        {stall.name}
                      </Text>
                      <Text style={styles.pendingBody}>
                        We’re verifying your details. You’ll get an email when {stall.name} is approved or if we need more
                        information.
                      </Text>
                    </View>
                  </View>
                );
              }

              const open = stall.status === 'Open';
              return (
                <TouchableOpacity
                  key={stall._id}
                  style={styles.stallCard}
                  onPress={() => router.push(`/owner/${stall._id}` as any)}
                  activeOpacity={0.75}>
                  {stall.coverPhoto ? (
                    <Image source={{ uri: stall.coverPhoto }} style={styles.stallCover} resizeMode="cover" />
                  ) : (
                    <View style={[styles.stallCover, styles.stallCoverPlaceholder]} />
                  )}
                  <View style={styles.stallCardBody}>
                    <View style={styles.stallAvatarWrap}>
                      {stall.profilePhoto ? (
                        <Image source={{ uri: stall.profilePhoto }} style={styles.stallAvatar} />
                      ) : (
                        <View style={[styles.stallAvatar, styles.stallAvatarFallback]}>
                          <MaterialCommunityIcons name="food" size={26} color={COLORS.primary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.stallInfo}>
                      <Text style={styles.stallName} numberOfLines={1}>
                        {stall.name}
                      </Text>
                      <View style={styles.stallAddrRow}>
                        <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.textGray} />
                        <Text style={styles.stallLocation} numberOfLines={2}>
                          {stall.address}
                        </Text>
                      </View>
                      <View style={styles.stallFooterRow}>
                        <View style={[styles.statusPill, { backgroundColor: open ? '#DCF5ED' : '#FDECEC' }]}>
                          <View
                            style={[
                              styles.statusDotSmall,
                              { backgroundColor: open ? COLOR_OPEN : COLOR_CLOSED },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusPillText,
                              { color: open ? COLOR_OPEN : COLOR_CLOSED },
                            ]}>
                            {stall.status ?? 'Closed'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textGray} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: showFab ? Math.max(insets.bottom, 24) + 76 : Math.max(insets.bottom, 16) + 16 }} />
      </ScrollView>

      <Modal
        visible={accountMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountMenuVisible(false)}>
        <View style={styles.accountMenuRoot} pointerEvents="box-none">
          <Pressable style={styles.accountMenuBackdrop} onPress={() => setAccountMenuVisible(false)} />
          <View
            style={[
              styles.accountMenuCard,
              { top: Math.max(insets.top, 12) + 44, right: Math.max(insets.right, 16) + 4 },
            ]}
            pointerEvents="box-none">
            <Pressable
              android_ripple={{ color: 'rgba(15,91,87,0.12)' }}
              style={styles.accountMenuItem}
              onPress={() => {
                setAccountMenuVisible(false);
                router.push('/owner/manage-account' as any);
              }}>
              <MaterialCommunityIcons name="account-edit-outline" size={22} color={COLORS.textDark} />
              <Text style={styles.accountMenuItemText}>Manage account</Text>
            </Pressable>
            <View style={styles.accountMenuDivider} />
            <Pressable
              android_ripple={{ color: 'rgba(238,82,83,0.12)' }}
              style={styles.accountMenuItem}
              onPress={handleLogout}>
              <MaterialCommunityIcons name="logout-variant" size={22} color={COLORS.danger} />
              <Text style={[styles.accountMenuItemText, { color: COLORS.danger }]}>Log out</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {showFab && (
        <TouchableOpacity
          style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 12 }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.9}>
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
          <Text style={styles.fabLabel}>New stall</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalRoot} edges={['top']}>
          <View style={styles.modalHero}>
            <View>
              <Text style={styles.modalEyebrow}>New application</Text>
              <Text style={styles.modalTitle}>Register a stall</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseHit}
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <MaterialCommunityIcons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Basics</Text>
            <Text style={styles.inputLabel}>
              Stall name <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              placeholder="e.g. Campus Bites – Block A"
              placeholderTextColor={COLORS.textGray}
              style={styles.modalInput}
              onChangeText={(text) => setStallData({ ...stallData, name: text })}
            />
            <Text style={styles.inputLabel}>
              Address <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              placeholder="Full street / building name"
              placeholderTextColor={COLORS.textGray}
              style={[styles.modalInput, styles.modalInputMulti]}
              multiline
              onChangeText={(text) => setStallData({ ...stallData, address: text })}
            />
            <Text style={styles.inputLabel}>
              Phone <Text style={styles.req}>*</Text>
            </Text>
            <TextInput
              placeholder="07x xxx xxxx"
              placeholderTextColor={COLORS.textGray}
              style={styles.modalInput}
              keyboardType="phone-pad"
              onChangeText={(text) => setStallData({ ...stallData, phone: text })}
            />

            <Text style={[styles.sectionLabel, styles.sectionLabelSpacer]}>Branding</Text>
            <View style={styles.photoGrid}>
              <TouchableOpacity style={styles.photoTile} onPress={() => pickImage('profile')}>
                {stallData.profilePhoto ? (
                  <Image source={{ uri: stallData.profilePhoto }} style={styles.photoPreviewFull} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialCommunityIcons name="account-circle-outline" size={28} color={COLORS.primary} />
                    <Text style={styles.photoPlaceholderText}>Profile photo *</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoTile} onPress={() => pickImage('cover')}>
                {stallData.coverPhoto ? (
                  <Image source={{ uri: stallData.coverPhoto }} style={styles.photoPreviewFull} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialCommunityIcons name="panorama-horizontal" size={26} color={COLORS.primary} />
                    <Text style={styles.photoPlaceholderText}>Cover (optional)</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.docCard} onPress={() => pickImage('doc')}>
              <View style={styles.docIconBg}>
                <MaterialCommunityIcons name="file-upload-outline" size={26} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>
                  University approval document <Text style={styles.req}>*</Text>
                </Text>
                <Text style={styles.docSub}>
                  {stallData.approvedDocument ? 'Document selected ✓' : 'PDF or clear photo of approval'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textGray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.locCard}
              onPress={() => {
                setMapModalVisible(true);
              }}>
              <View style={styles.locIconBg}>
                <MaterialCommunityIcons name="map-marker-radius" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locTitle}>Pin on map</Text>
                <Text style={styles.locCoords}>
                  {region.latitude.toFixed(5)}, {region.longitude.toFixed(5)}
                </Text>
              </View>
              <Text style={styles.locAction}>Adjust</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.7 }]}
              onPress={handleSaveStall}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send-outline" size={22} color="#fff" />
                  <Text style={styles.submitBtnText}>Submit for verification</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>

          <Modal visible={mapModalVisible} animationType="fade" onRequestClose={() => setMapModalVisible(false)}>
            <SafeAreaView style={styles.mapRoot}>
              <View style={styles.mapPickerHeader}>
                <TouchableOpacity onPress={() => setMapModalVisible(false)} style={styles.backBtn}>
                  <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.textDark} />
                </TouchableOpacity>
                <View style={styles.searchBarContainer}>
                  <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textGray} />
                  <TextInput
                    placeholder="Search location…"
                    style={styles.searchBarInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    placeholderTextColor={COLORS.textGray}
                  />
                  {isSearching && (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 10 }} />
                  )}
                </View>
              </View>

              {searchResults.length > 0 && (
                <View style={styles.searchResultsDropdown}>
                  <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {searchResults.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.searchResultItem}
                        onPress={() => handleSelectLocation(item)}>
                        <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.textGray} />
                        <Text style={styles.searchResultLabel} numberOfLines={1}>
                          {item.display_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <LeafletMap
                  latitude={region.latitude}
                  longitude={region.longitude}
                  onLocationSelect={(lat: number, lng: number) =>
                    setRegion({ ...region, latitude: lat, longitude: lng })
                  }
                />
                <View style={styles.mapCenterPointer} pointerEvents="none">
                  <MaterialCommunityIcons name="map-marker" size={40} color={COLORS.primary} />
                </View>
              </View>

              <View style={styles.mapPickerFooter}>
                <View style={styles.selectedCoords}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={18} color={COLORS.primary} />
                  <Text style={styles.coordsText}>
                    {region.latitude.toFixed(6)}, {region.longitude.toFixed(6)}
                  </Text>
                </View>
                <TouchableOpacity style={styles.setLocBtn} onPress={() => setMapModalVisible(false)}>
                  <Text style={styles.setLocBtnText}>Use this location</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 32,
  },
  loadingText: { marginTop: 14, fontSize: 15, color: COLORS.textGray, textAlign: 'center' },

  hero: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroTextBlock: { flex: 1, paddingRight: 12 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 8,
    letterSpacing: -0.45,
    lineHeight: 30,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
    fontWeight: '500',
  },
  logoutChip: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  statCardAccent: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  statIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statIconBadgeLive: {
    backgroundColor: '#C8F0E8',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  scroll: { paddingHorizontal: 20, paddingTop: 18 },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textDark, letterSpacing: -0.2 },
  emptyBody: {
    fontSize: 14,
    color: COLORS.textGray,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  listSection: { paddingBottom: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textDark,
    marginBottom: 14,
    letterSpacing: -0.25,
  },

  pendingCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.warningSoft,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  pendingAccent: {
    width: 5,
    backgroundColor: '#F4C430',
  },
  pendingInner: { flex: 1, padding: 16 },
  pendingBadgeRow: { flexDirection: 'row', marginBottom: 8 },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pendingPillText: { fontSize: 12, fontWeight: '700', color: '#8B6914' },
  pendingStallName: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  pendingBody: { fontSize: 14, color: COLORS.textGray, marginTop: 8, lineHeight: 20 },

  stallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  stallCover: { width: '100%', height: 96 },
  stallCoverPlaceholder: { backgroundColor: COLORS.primarySoft },
  stallCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  stallAvatarWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stallAvatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
  },
  stallAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  stallInfo: { flex: 1, minWidth: 0 },
  stallName: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  stallAddrRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, gap: 4 },
  stallLocation: { flex: 1, fontSize: 13, color: COLORS.textGray, lineHeight: 18 },
  stallFooterRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  statusDotSmall: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 12, fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    gap: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  fabLabel: { color: '#fff', fontWeight: '800', fontSize: 15 },

  modalRoot: { flex: 1, backgroundColor: COLORS.background },
  modalHero: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  modalEyebrow: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  modalCloseHit: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: COLORS.textGray, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionLabelSpacer: { marginTop: 22, marginBottom: 4 },

  req: { color: COLORS.danger },
  inputLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 8, marginTop: 14 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    backgroundColor: COLORS.surface,
    color: COLORS.textDark,
  },
  modalInputMulti: { minHeight: 88, textAlignVertical: 'top', paddingTop: 14 },

  photoGrid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  photoTile: {
    flex: 1,
    height: 118,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  photoPreviewFull: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textGray,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 12,
  },
  docIconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textDark },
  docSub: { fontSize: 13, color: COLORS.textGray, marginTop: 4 },

  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    gap: 12,
  },
  locIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(15,91,87,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  locCoords: { fontSize: 12, color: COLORS.textGray, marginTop: 4, fontVariant: ['tabular-nums'] },
  locAction: { fontWeight: '800', fontSize: 14, color: COLORS.primary },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 26,
    gap: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  mapRoot: { flex: 1, backgroundColor: COLORS.surface },
  mapPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: 10 },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchBarInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.textDark,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 76,
    left: 15,
    right: 15,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  searchResultLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.textDark,
    flex: 1,
  },
  mapCenterPointer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    zIndex: 10,
  },
  mapPickerFooter: {
    padding: 18,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  selectedCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    justifyContent: 'center',
  },
  coordsText: {
    marginLeft: 8,
    color: COLORS.textGray,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  setLocBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  setLocBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },

  accountMenuRoot: { flex: 1 },
  accountMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 20, 25, 0.45)',
  },
  accountMenuCard: {
    position: 'absolute',
    zIndex: 20,
    minWidth: 216,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  accountMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  accountMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginLeft: 52,
  },
  accountMenuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
  },
});
