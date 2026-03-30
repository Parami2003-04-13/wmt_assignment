import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Text } from '@ant-design/react-native';

const ORANGE_PRIMARY = '#FF8C00';

export default function Initializer() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const userStr = await SecureStore.getItemAsync('user');

        if (!token || !userStr) {
          // No token, redirect to login after a small delay
          setTimeout(() => router.replace('/login'), 1500);
          return;
        }

        const user = JSON.parse(userStr);
        
        // Brief delay for splash effect
        setTimeout(() => {
          if (user.role === 'admin') {
            router.replace('/admin/dashboard');
          } else {
            router.replace('/user/dashboard');
          }
        }, 1500);

      } catch (e) {
        console.error('Auth check error', e);
        router.replace('/login');
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>CampusBites</Text>
      <ActivityIndicator size="large" color={ORANGE_PRIMARY} />
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
    color: ORANGE_PRIMARY,
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 15,
    color: '#666',
    fontSize: 16,
  },
});
