import React from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

const PRIMARY = '#0F5B57';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const BG = '#F5F7F7';
const SURFACE = '#FFFFFF';
const SUCCESS = '#27AE60';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="check-circle" size={100} color={SUCCESS} />
        </View>

        <Text style={styles.title}>Order Placed Successfully!</Text>
        <Text style={styles.subtitle}>
          Your order has been received and is being processed.
        </Text>

        <View style={styles.orderIdCard}>
          <Text style={styles.orderIdLabel}>Order ID</Text>
          <Text style={styles.orderIdValue}>{orderId || 'ORD-000-000'}</Text>
        </View>

        <Text style={styles.infoText}>
          Please show this Order ID at the canteen counter when you pickup your meal.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.doneBtn} 
          onPress={() => router.replace('/user/dashboard')}
        >
          <Text style={styles.doneBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.ordersBtn} 
          onPress={() => {
            // Future: Navigate to My Orders screen
            router.replace('/user/dashboard');
          }}
        >
          <Text style={styles.ordersBtnText}>View My Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    marginBottom: 24,
    shadowColor: SUCCESS,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_GRAY,
    textAlign: 'center',
    marginTop: 12,
  },
  orderIdCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginTop: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  orderIdLabel: {
    fontSize: 14,
    color: TEXT_GRAY,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  orderIdValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY,
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  doneBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ordersBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ordersBtnText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
