import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  Image, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Alert,
  ActivityIndicator,
  Text as RNText
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import api, { API_BASE_URL } from '../services/api';
import { COLORS } from '../theme/colors';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

export default function SignupOwnerScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    nic: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    const { firstName, lastName, email, nic, password, confirmPassword } = formData;

    if (!firstName || !lastName || !email || !nic || !password) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        role: 'stall owner',
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nic: nic.trim()
      });
      
      Alert.alert('Success', 'Account created! Please login now.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    } catch (error: any) {
      const data = error.response?.data;
      const message =
        (typeof data === 'object' && data?.message != null ? String(data.message) : '') ||
        (typeof data === 'string' ? data : '') ||
        (error.code === 'ECONNABORTED'
          ? `Request timed out. Try again or check API: ${API_BASE_URL}`
          : error.request && !error.response
            ? `Cannot reach backend at ${API_BASE_URL}. Check internet and Expo env (restart with npx expo start -c).`
            : '') ||
        error.message ||
        'Something went wrong.';
      console.error('Stall owner signup failed:', {
        baseURL: API_BASE_URL,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
      });
      Alert.alert('Signup Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textDark} />
            </TouchableOpacity>
          <Text style={styles.appTitle}>Stall Owner Signup</Text>
          <Text style={styles.subtitle}>Join CampusBites as a partner</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                    placeholder="John"
                    style={styles.inputRow}
                    onChangeText={(v) => setFormData({ ...formData, firstName: v })}
                />
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                    placeholder="Doe"
                    style={styles.inputRow}
                    onChangeText={(v) => setFormData({ ...formData, lastName: v })}
                />
            </View>
          </View>

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Email</Text>
             <TextInput
                placeholder="your@email.com"
                style={styles.inputRow}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(v) => setFormData({ ...formData, email: v })}
             />
          </View>

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>NIC Number</Text>
             <TextInput
                placeholder="1999xxxxxxx"
                style={styles.inputRow}
                onChangeText={(v) => setFormData({ ...formData, nic: v })}
             />
          </View>

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Password</Text>
             <TextInput
                placeholder="••••••••"
                style={styles.inputRow}
                secureTextEntry
                onChangeText={(v) => setFormData({ ...formData, password: v })}
             />
          </View>

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Confirm Password</Text>
             <TextInput
                placeholder="••••••••"
                style={styles.inputRow}
                secureTextEntry
                onChangeText={(v) => setFormData({ ...formData, confirmPassword: v })}
             />
          </View>

          <TouchableOpacity 
            style={[styles.signupBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signupBtnText}>Create Account</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { padding: 25, paddingVertical: 50 },
  header: { marginBottom: 30 },
  backBtn: { marginBottom: 20 },
  appTitle: { fontSize: 26, fontWeight: 'bold', color: COLORS.textDark },
  subtitle: { fontSize: 14, color: COLORS.textGray, marginTop: 4 },
  form: {},
  row: { flexDirection: 'row' },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textDark, marginBottom: 8 },
  inputRow: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E1E4E8',
    paddingHorizontal: 15, height: 50, fontSize: 15, color: COLORS.textDark
  },
  signupBtn: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
    shadowColor: COLORS.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  signupBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
