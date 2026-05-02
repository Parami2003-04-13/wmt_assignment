import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@ant-design/react-native';
import { getStoredToken, getStoredUser } from '../services/api';
import { COLORS } from '../theme/colors';

export default function Initializer() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await getStoredToken();
        const user = await getStoredUser();

        if (!token || !user) {
          router.replace('/login');
          return;
        }

        if (user.role === 'stall manager') {
          router.replace('/admin/admin_approval_dashboard');
        } else if (user.role === 'stall owner') {
          router.replace('/owner/owner_dashboard');
        } else if (user.role === 'stall staff' && user.staffStallId) {
          router.replace(`/owner/${user.staffStallId}`);
        } else {
          router.replace('/user/dashboard');
        }

      } catch (e) {
        console.error('Auth check error', e);
        router.replace('/login');
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />
      <Text style={styles.appTitle}>CampusBites</Text>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>Loading your experience...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  appTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 15,
    color: '#666',
    fontSize: 16,
  },
});
