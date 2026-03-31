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
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeafletMap from '../../components/leaflet_map';
import api from '../../services/api';

const ORANGE_PRIMARY = '#FF6F3C'; 
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';

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

  useEffect(() => {
    let isMounted = true;
    const checkRole = async () => {
      const userStr = await SecureStore.getItemAsync('user');
      if (isMounted) {
        if (userStr) {
          const user = JSON.parse(userStr);
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

  const fetchAllStalls = async () => {
    try {
      const response = await api.get('/stalls');
      setStalls(response.data);
    } catch (error) {
      console.error('Fetch all stalls error:', error);
    }
  };

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

  const handleOpenStall = (stall: any) => {
    setSelectedStall(stall);
    setModalVisible(true);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Ok', 
        onPress: async () => {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('user');
          router.replace('/login');
        },
        style: 'destructive'
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={ORANGE_PRIMARY} />
      </View>
    );
  }

  const pendingStalls = stalls.filter(s => !s.isApproved);
  const approvedStalls = stalls.filter(s => s.isApproved);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Welcome, {userName}!</Text>
          <Text style={styles.headerSubtitle}>Admin Approval Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.profileButton}>
           <View style={styles.profileIconBg}>
              <MaterialCommunityIcons name="account-cog" size={24} color="#fff" />
           </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Pending Approvals ({pendingStalls.length})</Text>
          {pendingStalls.length === 0 ? (
            <View style={styles.emptyCard}>
               <Text style={styles.emptyText}>No pending verification requests.</Text>
            </View>
          ) : pendingStalls.map((stall) => (
            <TouchableOpacity key={stall._id} style={styles.stallCard} onPress={() => handleOpenStall(stall)}>
              <View style={styles.stallIconContainer}>
                 <Image source={{ uri: stall.profilePhoto }} style={styles.stallIcon} />
              </View>
              <View style={styles.stallMainInfo}>
                <Text style={styles.stallName}>{stall.name}</Text>
                <Text style={styles.stallOwner}>Owner: {stall.manager?.name || 'Unknown'}</Text>
                <View style={styles.pendingBadge}>
                   <Text style={styles.pendingBadgeText}>PENDING</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={TEXT_GRAY} />
            </TouchableOpacity>
          ))}

          <View style={{ height: 20 }} />
          <Text style={styles.sectionTitle}>Approved Stalls ({approvedStalls.length})</Text>
          {approvedStalls.map((stall) => (
            <TouchableOpacity key={stall._id} style={[styles.stallCard, { opacity: 0.8 }]} onPress={() => handleOpenStall(stall)}>
              <View style={styles.stallIconContainer}>
                 <Image source={{ uri: stall.profilePhoto }} style={styles.stallIcon} />
              </View>
              <View style={styles.stallMainInfo}>
                <Text style={styles.stallName}>{stall.name}</Text>
                <Text style={styles.stallOwner}>{stall.address}</Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={24} color="#10AC84" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={28} color={TEXT_DARK} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Stall Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {selectedStall && (
            <ScrollView style={{ flex: 1 }}>
              <Image source={{ uri: selectedStall.coverPhoto || selectedStall.profilePhoto }} style={styles.detailCover} />
              
              <View style={{ padding: 25 }}>
                <View style={styles.detailHeader}>
                    <Image source={{ uri: selectedStall.profilePhoto }} style={styles.detailIcon} />
                    <View style={{ marginLeft: 15, flex: 1 }}>
                        <Text style={styles.detailName}>{selectedStall.name}</Text>
                        <Text style={styles.detailPhone}>{selectedStall.phone}</Text>
                    </View>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Owner Information</Text>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="account-outline" size={20} color={ORANGE_PRIMARY} />
                        <Text style={styles.infoText}>{selectedStall.manager?.name} ({selectedStall.manager?.email})</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="card-account-details-outline" size={20} color={ORANGE_PRIMARY} />
                        <Text style={styles.infoText}>NIC: {selectedStall.manager?.nic || 'N/A'}</Text>
                    </View>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>Address & Location</Text>
                    <Text style={styles.infoText}>{selectedStall.address}</Text>
                    
                    <View style={styles.mapPreviewContainer}>
                        <LeafletMap 
                           latitude={selectedStall.latitude || 6.9271} 
                           longitude={selectedStall.longitude || 79.8612} 
                           onLocationSelect={() => {}} 
                        />
                    </View>
                    <View style={styles.coordsBadge}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={14} color={ORANGE_PRIMARY} />
                        <Text style={styles.coordsText}>
                            {selectedStall.latitude?.toFixed(6)}, {selectedStall.longitude?.toFixed(6)}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoLabel}>University Approval Document</Text>
                    {selectedStall.approvedDocument ? (
                        <View style={styles.docView}>
                            <MaterialCommunityIcons name="file-document-outline" size={40} color={ORANGE_PRIMARY} />
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                    <TouchableOpacity 
                      style={[styles.rejectBtn, approving && { opacity: 0.7 }]} 
                      onPress={handleReject}
                      disabled={approving}
                    >
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.approveBtn, { flex: 1, marginLeft: 15 }, approving && { opacity: 0.7 }]} 
                      onPress={handleApprove}
                      disabled={approving}
                    >
                      {approving ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveBtnText}>Approve Stall</Text>}
                    </TouchableOpacity>
                  </View>
                )}
                <View style={{ height: 50 }} />
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
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_DARK },
  headerSubtitle: { fontSize: 13, color: TEXT_GRAY, marginTop: 2 },
  profileButton: { padding: 2 },
  profileIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE_PRIMARY, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 50 },
  content: { padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: TEXT_DARK, marginBottom: 15, marginLeft: 4 },
  emptyCard: { padding: 30, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0', borderStyle: 'dashed', marginBottom: 20 },
  emptyText: { color: TEXT_GRAY, fontSize: 14 },
  stallCard: { 
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 15, 
    marginBottom: 12, alignItems: 'center', elevation: 2, shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 
  },
  stallIconContainer: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#FFF5F2', marginRight: 15, overflow: 'hidden' },
  stallIcon: { width: '100%', height: '100%' },
  stallMainInfo: { flex: 1 },
  stallName: { fontSize: 16, fontWeight: 'bold', color: TEXT_DARK },
  stallOwner: { fontSize: 12, color: TEXT_GRAY, marginTop: 2 },
  pendingBadge: { backgroundColor: '#FFEAA7', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 5 },
  pendingBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#D6A31E' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  closeBtn: { padding: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: TEXT_DARK },
  detailCover: { width: '100%', height: 200 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  detailIcon: { width: 70, height: 70, borderRadius: 15, borderWidth: 3, borderColor: '#fff' },
  detailName: { fontSize: 22, fontWeight: 'bold', color: TEXT_DARK },
  detailPhone: { fontSize: 14, color: TEXT_GRAY, marginTop: 2 },
  infoSection: { marginBottom: 25 },
  infoLabel: { fontSize: 14, fontWeight: 'bold', color: TEXT_DARK, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  infoText: { fontSize: 15, color: TEXT_GRAY, marginLeft: 10 },
  docView: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E1E4E8' },
  docTitle: { fontSize: 14, fontWeight: 'bold', color: TEXT_DARK },
  viewDocLink: { marginTop: 4 },
  viewDocText: { fontSize: 12, color: ORANGE_PRIMARY, fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#10AC84', padding: 18, borderRadius: 14, alignItems: 'center' },
  approveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  rejectBtn: { backgroundColor: '#F8F9FA', padding: 18, borderRadius: 14, alignItems: 'center', flex: 0.4, borderWidth: 2, borderColor: '#EE5253' },
  rejectBtnText: { color: '#EE5253', fontSize: 16, fontWeight: 'bold' },
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
    backgroundColor: '#FFF5F2',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10
  },
  coordsText: {
    fontSize: 12,
    color: ORANGE_PRIMARY,
    marginLeft: 5,
    fontWeight: '600'
  }
});
