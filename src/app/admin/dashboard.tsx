import React, { useEffect, useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  SafeAreaView, 
  Alert, 
  StatusBar,
  Text as RNText, // Renamed to avoid collision
  Platform,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import * as SecureStore from 'expo-secure-store';

const ORANGE_PRIMARY = '#FF6F3C'; 
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const COLOR_OPEN = '#10AC84';
const COLOR_CLOSED = '#EE5253';

export default function AdminDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const userStr = await SecureStore.getItemAsync('user');
      if (userStr) setUserName(JSON.parse(userStr).name);
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
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
      ]
    );
  };

  const stalls = [
    { id: 1, name: 'Burger Palace', location: 'Building A, Floor 1', status: 'Open', color: COLOR_OPEN, icon: 'hamburger' },
    { id: 2, name: 'Pizza Corner', location: 'Building B, Floor 2', status: 'Closed', color: COLOR_CLOSED, icon: 'pizza' },
    { id: 3, name: 'Fresh Greens', location: 'Building C, Floor 1', status: 'Open', color: COLOR_OPEN, icon: 'leaf' },
  ];

  // Fix: Unified Text component
  const Text = (props: any) => <RNText {...props} style={[styles.baseText, props.style]} />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Stall Management</Text>
          <Text style={styles.headerSubtitle}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.profileButton}>
           <View style={styles.profileIconBg}>
              <MaterialCommunityIcons name="account" size={24} color="#fff" />
           </View>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {stalls.map((stall) => (
            <View key={stall.id} style={styles.stallCard}>
              <View style={styles.stallIconContainer}>
                 <MaterialCommunityIcons name={stall.icon as any} size={28} color={ORANGE_PRIMARY} />
              </View>
              
              <View style={styles.stallMainInfo}>
                <Text style={styles.stallName}>{stall.name}</Text>
                <Text style={styles.stallLocation}>{stall.location}</Text>
                <View style={styles.statusRow}>
                   <View style={[styles.statusDot, { backgroundColor: stall.color }]} />
                   <Text style={[styles.statusLabel, { color: stall.color }]}>{stall.status}</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                 <TouchableOpacity style={styles.editBtn}>
                    <MaterialCommunityIcons name="pencil-outline" size={20} color={ORANGE_PRIMARY} />
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.deleteBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EE5253" />
                 </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab}>
        <MaterialCommunityIcons name="plus" size={32} color="#fff" />
      </TouchableOpacity>

      <View style={styles.bottomTab}>
         <TouchableOpacity style={styles.tabItem}>
            <MaterialCommunityIcons name="storefront-outline" size={24} color={ORANGE_PRIMARY} />
            <Text style={[styles.tabLabel, { color: ORANGE_PRIMARY }]}>Stalls</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem}>
            <MaterialCommunityIcons name="chart-bar" size={24} color={TEXT_GRAY} />
            <Text style={styles.tabLabel}>Analytics</Text>
         </TouchableOpacity>
         <TouchableOpacity style={styles.tabItem}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={TEXT_GRAY} />
            <Text style={styles.tabLabel}>Settings</Text>
         </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  baseText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  headerSubtitle: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginTop: 2,
  },
  profileButton: {
    padding: 2,
  },
  profileIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2D3436',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 120,
  },
  content: {
    padding: 20,
  },
  stallCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  stallIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#FFF5F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  stallMainInfo: {
    flex: 1,
  },
  stallName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  stallLocation: {
    fontSize: 13,
    color: TEXT_GRAY,
    marginVertical: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    padding: 8,
    backgroundColor: '#FFF5F2',
    borderRadius: 8,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#FFF2F2',
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ORANGE_PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  bottomTab: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  tabItem: {
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    color: TEXT_GRAY,
  },
});
