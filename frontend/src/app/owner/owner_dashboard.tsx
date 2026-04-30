import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Alert, 
  StatusBar,
  Text as RNText,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeafletMap from '../../components/leaflet_map';
import api, { clearAuthStorage, getStoredUser } from '../../services/api';
import { COLORS } from '../../theme/colors';

const COLOR_OPEN = COLORS.success;
const COLOR_CLOSED = COLORS.danger;

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

export default function OwnerDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
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
    return () => { isMounted = false; };
  }, []);

  const fetchMyStalls = async (id: string) => {
    try {
      const response = await api.get(`/stalls/manager/${id}`);
      setStalls(response.data);
    } catch (error) {
      console.error('Fetch stalls error:', error);
    }
  };

  const handleSaveStall = async () => {
    if (!stallData.name || !stallData.address || !stallData.phone || !stallData.profilePhoto || !stallData.approvedDocument) {
      Alert.alert('Error', 'Please fill in all required fields and upload the approval document.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/stalls', {
        ...stallData,
        latitude: region.latitude,
        longitude: region.longitude,
        managerId: userId
      });

      Alert.alert('Submitted', 'We will verify your stall and notify via email.');
      setModalVisible(false);
      fetchMyStalls(userId);
      setStallData({
        name: '', address: '', phone: '', description: '',
        profilePhoto: null, coverPhoto: null, approvedDocument: null
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
      aspect: type === 'profile' ? [1, 1] : (type === 'cover' ? [16, 9] : undefined),
      quality: 1,
    });

    if (!result.canceled) {
      if (type === 'profile') setStallData({ ...stallData, profilePhoto: result.assets[0].uri });
      else if (type === 'cover') setStallData({ ...stallData, coverPhoto: result.assets[0].uri });
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
        { headers: { 'User-Agent': 'CampusBites-App', 'Accept': 'application/json' } }
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
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Ok', 
        onPress: async () => {
          await clearAuthStorage();
          router.replace('/login');
        },
        style: 'destructive'
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Welcome, {userName}!</Text>
          <Text style={styles.headerSubtitle}>Stall Owner Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.profileButton}>
           <View style={styles.profileIconBg}>
              <MaterialCommunityIcons name="account" size={24} color="#fff" />
           </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {stalls.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
               <MaterialCommunityIcons name="store-plus-outline" size={80} color={COLORS.textGray} />
               <Text style={{ color: COLORS.textGray, marginTop: 15, fontSize: 16 }}>No stalls found. Start your business today!</Text>
               <TouchableOpacity style={styles.initialAddBtn} onPress={() => setModalVisible(true)}>
                  <Text style={styles.initialAddBtnText}>Add Your Stall</Text>
               </TouchableOpacity>
            </View>
          ) : stalls.map((stall) => {
            if (!stall.isApproved) {
                return (
                    <View key={stall._id} style={styles.pendingCard}>
                        <View style={styles.pendingIconBg}>
                            <MaterialCommunityIcons name="clock-time-eight-outline" size={40} color={COLORS.primary} />
                        </View>
                        <Text style={styles.pendingTitle}>Verification in Progress</Text>
                        <Text style={styles.pendingText}>
                           We are currently verifying "{stall.name}". You will receive an email once it's approved.
                        </Text>
                        <View style={styles.pendingStatusBadge}>
                            <Text style={styles.pendingStatusText}>STATUS: PENDING</Text>
                        </View>
                    </View>
                );
            }

            return (
              <TouchableOpacity 
                key={stall._id} 
                style={styles.stallCard}
                onPress={() => router.push(`/owner/${stall._id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.stallIconContainer}>
                   <Image source={{ uri: stall.profilePhoto }} style={styles.stallIcon} />
                </View>
                <View style={styles.stallMainInfo}>
                  <Text style={styles.stallName}>{stall.name}</Text>
                  <Text style={styles.stallLocation}>{stall.address}</Text>
                  <View style={styles.statusRow}>
                     <View style={[styles.statusDot, { backgroundColor: stall.status === 'Open' ? COLOR_OPEN : COLOR_CLOSED }]} />
                     <Text style={[styles.statusLabel, { color: stall.status === 'Open' ? COLOR_OPEN : COLOR_CLOSED }]}>{stall.status}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                   <View style={styles.editBtn}>
                      <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.primary} />
                   </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {stalls.length > 0 && stalls.some(s => s.isApproved) && (
          <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
            <MaterialCommunityIcons name="plus" size={32} color="#fff" />
          </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Your Stall</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <MaterialCommunityIcons name="close" size={28} color={COLORS.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.inputLabel}>Stall Name <Text style={{ color: '#EE5253' }}>*</Text></Text>
            <TextInput 
              placeholder="e.g. Campus Bites main" 
              style={styles.modalInput}
              onChangeText={(text) => setStallData({ ...stallData, name: text })}
            />
            <Text style={styles.inputLabel}>Address <Text style={{ color: '#EE5253' }}>*</Text></Text>
            <TextInput 
              placeholder="Full location address" 
              style={styles.modalInput}
              onChangeText={(text) => setStallData({ ...stallData, address: text })}
            />
            <Text style={styles.inputLabel}>Phone Number <Text style={{ color: '#EE5253' }}>*</Text></Text>
            <TextInput 
              placeholder="07x xxx xxxx" 
              style={styles.modalInput}
              keyboardType="phone-pad"
              onChangeText={(text) => setStallData({ ...stallData, phone: text })}
            />
            
            <Text style={styles.inputLabel}>Photos</Text>
            <View style={styles.photoContainer}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage('profile')}>
                {stallData.profilePhoto ? (
                   <Image source={{ uri: stallData.profilePhoto }} style={styles.photoPreview} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera" size={24} color={COLORS.primary} />
                    <Text style={styles.photoBtnText}>Profile Photo *</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage('cover')}>
                {stallData.coverPhoto ? (
                   <Image source={{ uri: stallData.coverPhoto }} style={styles.photoPreview} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="image" size={24} color={COLORS.primary} />
                    <Text style={styles.photoBtnText}>Cover Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>University Approval Document <Text style={{ color: '#EE5253' }}>*</Text></Text>
            <TouchableOpacity style={styles.docUploadBtn} onPress={() => pickImage('doc')}>
                <MaterialCommunityIcons name="file-pdf-box" size={32} color={COLORS.primary} />
                <Text style={[styles.docUploadBtnText, stallData.approvedDocument && { color: COLORS.textDark }]}>
                    {stallData.approvedDocument ? "Document Selected ✓" : "Upload Approval Document"}
                </Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.locationPickerBtn} 
                onPress={() => {
                    console.log('Opening Map Picker...');
                    setMapModalVisible(true);
                }}
            >
                <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color={COLORS.primary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.locationPickerText}>Select location on map</Text>
                  <Text style={styles.locationPickerSubtext}>{region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSaveStall} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Submit for Verification</Text>}
            </TouchableOpacity>
            <View style={{ height: 50 }} />
          </ScrollView>

          {/* Full Screen Location Picker Modal - Moved INSIDE for better stacking */}
          <Modal visible={mapModalVisible} animationType="fade" onRequestClose={() => setMapModalVisible(false)}>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={styles.mapPickerHeader}>
                <TouchableOpacity onPress={() => setMapModalVisible(false)} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color={COLORS.textDark} />
                </TouchableOpacity>
                <View style={styles.searchBarContainer}>
                    <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textGray} />
                    <TextInput 
                    placeholder="Search location..." 
                    style={styles.searchBarInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    />
                    {isSearching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 10 }} />}
                </View>
            </View>

            {searchResults.length > 0 && (
                <View style={styles.searchResultsDropdown}>
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                    {searchResults.map((item, index) => (
                        <TouchableOpacity 
                        key={index} 
                        style={styles.searchResultItem}
                        onPress={() => handleSelectLocation(item)}
                        >
                        <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.textGray} />
                        <Text style={styles.searchResultLabel} numberOfLines={1}>{item.display_name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                </View>
            )}

            <View style={{ flex: 1 }}>
                <LeafletMap 
                latitude={region.latitude} 
                longitude={region.longitude} 
                onLocationSelect={(lat: number, lng: number) => setRegion({ ...region, latitude: lat, longitude: lng })} 
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
                <TouchableOpacity 
                style={styles.setLocBtn} 
                onPress={() => setMapModalVisible(false)}
                >
                <Text style={styles.setLocBtnText}>Set location</Text>
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
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  headerSubtitle: { fontSize: 13, color: COLORS.textGray, marginTop: 2 },
  profileButton: { padding: 2 },
  profileIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2D3436', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 100 },
  content: { padding: 20 },
  initialAddBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12, marginTop: 25 },
  initialAddBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pendingCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 35, alignItems: 'center',
    borderWidth: 1, borderColor: '#FFEAA7', elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10,
  },
  pendingIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  pendingTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  pendingText: { fontSize: 14, color: COLORS.textGray, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  pendingStatusBadge: { backgroundColor: '#FFEAA7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 20 },
  pendingStatusText: { fontSize: 12, fontWeight: 'bold', color: '#D6A31E' },
  stallCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 16, alignItems: 'center', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10,
  },
  stallIconContainer: { width: 60, height: 60, borderRadius: 14, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  stallIcon: { width: '100%', height: '100%', borderRadius: 14 },
  stallMainInfo: { flex: 1 },
  stallName: { fontSize: 17, fontWeight: 'bold', color: COLORS.textDark },
  stallLocation: { fontSize: 13, color: COLORS.textGray, marginVertical: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8 },
  editBtn: { padding: 8, backgroundColor: COLORS.primarySoft, borderRadius: 8 },
  fab: {
    position: 'absolute', bottom: 30, right: 25, width: 60, height: 60,
    borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark },
  modalInput: { borderWidth: 1, borderColor: '#E1E4E8', borderRadius: 12, padding: 15, marginBottom: 20, fontSize: 16, backgroundColor: '#F9FAFB' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textDark, marginBottom: 8, marginLeft: 4 },
  photoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  photoBtn: { flex: 0.48, height: 100, borderRadius: 12, borderWidth: 1, borderColor: '#E1E4E8', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  photoBtnText: { fontSize: 12, fontWeight: '500', color: COLORS.textGray, marginTop: 8 },
  photoPreview: { width: '100%', height: '100%', borderRadius: 12 },
  docUploadBtn: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E1E4E8', borderStyle: 'dashed', marginBottom: 20 },
  docUploadBtnText: { fontSize: 14, color: COLORS.textGray, marginLeft: 15, fontWeight: '500' },
  locationPickerBtn: {
    flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.primarySoft, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(15, 91, 87, 0.2)', marginBottom: 25
  },
  locationPickerText: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  locationPickerSubtext: { fontSize: 12, color: COLORS.textGray, marginTop: 2 },
  saveBtn: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  mapPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { marginRight: 10 },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 45,
  },
  searchBarInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 75,
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchResultLabel: {
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.textDark,
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
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  selectedCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    justifyContent: 'center',
  },
  coordsText: {
    marginLeft: 8,
    color: COLORS.textGray,
    fontSize: 13,
  },
  setLocBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  setLocBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
