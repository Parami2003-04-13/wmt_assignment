import React, { useEffect, useMemo, useState } from 'react';
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
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import LeafletMap from '../../components/leaflet_map';
import api, { clearAuthStorage, getStoredUser } from '../../services/api';
import { COLORS } from '../../theme/colors';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

export default function AdminApprovalDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [stalls, setStalls] = useState<any[]>([]);
  const [selectedStall, setSelectedStall] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  useEffect(() => {
    //check if user is admin
    let isMounted = true;
    const checkRole = async () => {
      const user = await getStoredUser();
      if (isMounted) {
        if (user) {
          if (user.role !== 'stall manager') {
            router.replace('/login');
            return;
          }
          setUserName(user.name);
          fetchAllStalls();
        } else {
          router.replace('/login');
        }
        setLoading(false);
      }
    };
    checkRole();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    //set edit phone and address
    if (selectedStall) {
      setEditPhone(String(selectedStall.phone ?? ''));
      setEditAddress(String(selectedStall.address ?? ''));
    }
  }, [selectedStall]);

  //fetch all stalls
  const fetchAllStalls = async () => {
    try {
      const response = await api.get('/stalls');
      setStalls(response.data);
    } catch (error) {
      console.error('Fetch all stalls error:', error);
    }
  };
//handle reject
  const handleReject = async () => {
    if (!selectedStall) return;
    
    Alert.alert('Reject Stall', 'Are you sure you want to reject and remove this stall?', [
        { text: 'Cancel', style: 'cancel' },
        { 
            text: 'Yes, Reject', 
            style: 'destructive',
            onPress: async () => {
                try {
                  await api.delete(`/stalls/${selectedStall._id}`);
                  Alert.alert('Rejected', `Stall "${selectedStall.name}" has been rejected.`);
                  setModalVisible(false);
                  fetchAllStalls();
                } catch (error) {
                  Alert.alert('Error', 'Rejection failed.');
                }
            }
        }
    ]);
  };

  //handle approve
  const handleApprove = async () => {
    if (!selectedStall) return;
    setApproving(true);
    try {
      await api.patch(`/stalls/${selectedStall._id}/approve`);
      Alert.alert('Approved', `Stall "${selectedStall.name}" has been approved.`);
      setModalVisible(false);
      fetchAllStalls();
    } catch (error) {
      Alert.alert('Error', 'Approval failed. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  //handle open stall
  const handleOpenStall = (stall: any) => {
    setSelectedStall(stall);
    setModalVisible(true);
  };

  //handle save contact
  const handleSaveContact = async () => {
    if (!selectedStall) return;
    const phone = editPhone.trim();
    const address = editAddress.trim();
    if (!phone || !address) {
      Alert.alert('Required', 'Phone and address cannot be empty.');
      return;
    }
//save contact
    setSavingContact(true);
    try {
      const { data } = await api.patch(`/stalls/${selectedStall._id}`, {
        phone,
        address,
      });
      const updated = { ...selectedStall, ...data };
      setSelectedStall(updated);
      setStalls((prev) => prev.map((s) => (s._id === updated._id ? { ...s, phone: updated.phone, address: updated.address } : s)));
      Alert.alert('Saved', 'Phone and address have been updated.');
    } catch (e: any) {
      Alert.alert('Save failed', e.response?.data?.message || 'Could not update stall.');
    } finally {
      setSavingContact(false);
    }
  };

  //handle logout
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

  const pendingStalls = useMemo(() => stalls.filter((s) => !s.isApproved), [stalls]);
  const approvedStalls = useMemo(() => stalls.filter((s) => s.isApproved), [stalls]);

  const pendingCount = pendingStalls.length;
  const approvedCount = approvedStalls.length;

  const firstName = userName.trim().split(/\s+/)[0] || userName;

  //loading
  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading approvals…</Text>
      </View>
    );
  }

  //admin approval dashboard
  return (
    //admin approval dashboard
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} translucent={false} />
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>Operations</Text>
            <Text style={styles.heroTitle}>Hi, {firstName}</Text>
            <Text style={styles.heroSubtitle}>Review and approve stall registrations</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.heroIconBtn} accessibilityLabel="Logout">
            <MaterialCommunityIcons name="logout" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{approvedCount}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{pendingCount + approvedCount}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
        <View style={styles.tabsWrap}>
          <Pressable
            onPress={() => setActiveTab('pending')}
            style={[styles.tabBtn, activeTab === 'pending' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
              Pending
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('approved')}
            style={[styles.tabBtn, activeTab === 'approved' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'approved' && styles.tabTextActive]}>
              Approved
            </Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {activeTab === 'pending' ? (
            <>
              <Text style={styles.sectionTitle}>Pending approvals</Text>
              {pendingStalls.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconRing}>
                    <MaterialCommunityIcons name="shield-check-outline" size={34} color={COLORS.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>All caught up</Text>
                  <Text style={styles.emptyText}>No pending verification requests right now.</Text>
                </View>
              ) : (
                pendingStalls.map((stall) => (
                  <TouchableOpacity
                    key={stall._id}
                    style={styles.stallCard}
                    onPress={() => handleOpenStall(stall)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.stallAvatarWrap}>
                      <Image source={{ uri: stall.profilePhoto }} style={styles.stallAvatar} />
                    </View>
                    <View style={styles.stallMainInfo}>
                      <Text style={styles.stallName} numberOfLines={1}>{stall.name}</Text>
                      <Text style={styles.stallMeta} numberOfLines={1}>
                        Owner: {stall.manager?.name || 'Unknown'}
                      </Text>
                      <View style={styles.pillPending}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color="#8B6914" />
                        <Text style={styles.pillPendingText}> Under review</Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#B2BEC3" />
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Approved stalls</Text>
              {approvedStalls.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconRing}>
                    <MaterialCommunityIcons name="store-check-outline" size={34} color={COLORS.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>No approved stalls yet</Text>
                  <Text style={styles.emptyText}>Once you approve stalls, they’ll show up here.</Text>
                </View>
              ) : (
                approvedStalls.map((stall) => (
                  <TouchableOpacity
                    key={stall._id}
                    style={styles.stallCard}
                    onPress={() => handleOpenStall(stall)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.stallAvatarWrap}>
                      <Image source={{ uri: stall.profilePhoto }} style={styles.stallAvatar} />
                    </View>
                    <View style={styles.stallMainInfo}>
                      <Text style={styles.stallName} numberOfLines={1}>{stall.name}</Text>
                      <Text style={styles.stallMeta} numberOfLines={2}>{stall.address}</Text>
                      <View style={styles.pillApproved}>
                        <MaterialCommunityIcons name="check-circle-outline" size={14} color={COLORS.success} />
                        <Text style={styles.pillApprovedText}> Approved</Text>
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#B2BEC3" />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}

          <View style={{ height: 28 }} />
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.detailRoot} edges={['top', 'left', 'right']}>
          <View style={styles.detailTopBar}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.detailCloseHit}>
              <MaterialCommunityIcons name="close" size={26} color={COLORS.textDark} />
            </TouchableOpacity>
            <Text style={styles.detailTopTitle}>Stall details</Text>
            <View style={{ width: 44 }} />
          </View>

          {selectedStall && (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Image
                source={{ uri: selectedStall.coverPhoto || selectedStall.profilePhoto }}
                style={styles.detailCover}
              />

              <View style={styles.detailBody}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailAvatarWrap}>
                    <Image source={{ uri: selectedStall.profilePhoto }} style={styles.detailIcon} />
                  </View>
                  <View style={{ marginLeft: 14, flex: 1 }}>
                    <Text style={styles.detailName}>{selectedStall.name}</Text>
                    <View style={styles.detailSubRow}>
                      <MaterialCommunityIcons name="phone-outline" size={16} color={COLORS.textGray} />
                      <Text style={styles.detailPhone}>{editPhone.trim() ? editPhone.trim() : '—'}</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.infoSection, styles.managerEditCard]}>
                    <Text style={styles.managerEditTitle}>Contact & location (manager)</Text>
                    <Text style={styles.managerEditHint}>Add or fix phone and address before approving or for approved stalls.</Text>
                    <Text style={[styles.managerFieldLabel]}>Phone</Text>
                    <TextInput
                        value={editPhone}
                        onChangeText={setEditPhone}
                        placeholder="07x xxx xxxx"
                        keyboardType="phone-pad"
                        placeholderTextColor={COLORS.textGray}
                        style={styles.managerInput}
                    />
                    <Text style={[styles.managerFieldLabel, { marginTop: 12 }]}>Address</Text>
                    <TextInput
                        value={editAddress}
                        onChangeText={setEditAddress}
                        placeholder="Full street address"
                        placeholderTextColor={COLORS.textGray}
                        multiline
                        style={[styles.managerInput, styles.managerInputMulti]}
                    />
                    <TouchableOpacity
                      style={[styles.saveContactBtn, savingContact && { opacity: 0.7 }]}
                      onPress={handleSaveContact}
                      disabled={savingContact}
                    >
                      {savingContact ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveContactBtnText}>Save phone & address</Text>
                      )}
                    </TouchableOpacity>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Owner Information</Text>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="account-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.infoText}>{selectedStall.manager?.name} ({selectedStall.manager?.email})</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="card-account-details-outline" size={20} color={COLORS.primary} />
                        <Text style={styles.infoText}>NIC: {selectedStall.manager?.nic || 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Address & Location</Text>
                    <Text style={styles.infoText}>{editAddress.trim() || selectedStall.address}</Text>
                    
                    <View style={styles.mapPreviewContainer}>
                        <LeafletMap 
                           latitude={selectedStall.latitude || 6.9271} 
                           longitude={selectedStall.longitude || 79.8612} 
                           onLocationSelect={() => {}} 
                        />
                    </View>
                    <View style={styles.coordsBadge}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={14} color={COLORS.primary} />
                        <Text style={styles.coordsText}>
                            {selectedStall.latitude?.toFixed(6)}, {selectedStall.longitude?.toFixed(6)}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>University Approval Document</Text>
                    {selectedStall.approvedDocument ? (
                        <View style={styles.docView}>
                            <MaterialCommunityIcons name="file-document-outline" size={40} color={COLORS.primary} />
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <Text style={styles.docTitle}>Verification_Document.jpg</Text>
                                <TouchableOpacity style={styles.viewDocLink} onPress={() => setViewerVisible(true)}>
                                    <Text style={styles.viewDocText}>Click to view full image</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <Text style={{ color: '#EE5253' }}>No document uploaded.</Text>
                    )}
                </View>

                {!selectedStall.isApproved && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, approving && { opacity: 0.7 }]}
                      onPress={handleReject}
                      disabled={approving}
                    >
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, approving && { opacity: 0.7 }]}
                      onPress={handleApprove}
                      disabled={approving}
                    >
                      {approving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.approveBtnText}>Approve</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <View style={{ height: 40 }} />
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Full Screen Image Viewer Modal */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade">
        <View style={styles.viewerContainer}>
            <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerVisible(false)}>
                <MaterialCommunityIcons name="close-circle" size={40} color="#fff" />
            </TouchableOpacity>
            {selectedStall?.approvedDocument && (
                <Image 
                    source={{ uri: selectedStall.approvedDocument }} 
                    style={styles.fullImage} 
                    resizeMode="contain" 
                />
            )}
        </View>
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
    paddingHorizontal: 28,
  },
  loadingText: { marginTop: 14, fontSize: 15, color: COLORS.textGray, textAlign: 'center' },

  hero: {
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 6, letterSpacing: -0.3 },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 6, lineHeight: 20, maxWidth: 290 },
  heroIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },

  tabsWrap: {
    marginTop: 14,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 14 },
  tabBtnActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.75)' },
  tabTextActive: { color: COLORS.primaryDark },

  scroll: { paddingBottom: 40 },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 14 },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  emptyText: { marginTop: 8, fontSize: 14, color: COLORS.textGray, textAlign: 'center', lineHeight: 20 },

  stallCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    gap: 12,
  },
  stallAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.primarySoft,
  },
  stallAvatar: { width: '100%', height: '100%' },
  stallMainInfo: { flex: 1, minWidth: 0 },
  stallName: { fontSize: 16, fontWeight: '800', color: COLORS.textDark },
  stallMeta: { marginTop: 4, fontSize: 13, color: COLORS.textGray, lineHeight: 18 },
  pillPending: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warningSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillPendingText: { fontSize: 12, fontWeight: '800', color: '#8B6914' },
  pillApproved: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DCF5ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillApprovedText: { fontSize: 12, fontWeight: '800', color: COLORS.success },

  detailRoot: { flex: 1, backgroundColor: COLORS.background },
  detailTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  detailCloseHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  detailTopTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textDark },
  detailCover: { width: '100%', height: 210 },
  detailBody: { padding: 20, paddingTop: 18 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  detailAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  detailIcon: { width: '100%', height: '100%' },
  detailName: { fontSize: 22, fontWeight: '900', color: COLORS.textDark },
  detailSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  detailPhone: { fontSize: 14, color: COLORS.textGray },

  infoSection: { marginBottom: 18 },
  infoLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textGray,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { fontSize: 15, color: COLORS.textGray, marginLeft: 10, flex: 1, lineHeight: 20 },
  docView: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E1E4E8' },
  docTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.textDark },
  viewDocLink: { marginTop: 4 },
  viewDocText: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  approveBtn: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  rejectBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  rejectBtnText: { color: COLORS.danger, fontSize: 16, fontWeight: '900' },
  viewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  viewerClose: { position: 'absolute', top: 50, right: 25, zIndex: 10 },
  fullImage: { width: '100%', height: '80%' },
  mapPreviewContainer: { 
    height: 180, 
    borderRadius: 12, 
    overflow: 'hidden', 
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E1E4E8'
  },
  coordsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10
  },
  coordsText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 5,
    fontWeight: '600'
  },
  managerEditCard: {
    backgroundColor: COLORS.primarySoft,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 91, 87, 0.18)',
  },
  managerEditTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textDark, marginBottom: 6 },
  managerEditHint: { fontSize: 13, color: COLORS.textGray, marginBottom: 14, lineHeight: 18 },
  managerFieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textDark, marginBottom: 6 },
  managerInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
    backgroundColor: COLORS.surface,
    color: COLORS.textDark,
  },
  managerInputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
  },
  saveContactBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveContactBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
