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
import api from '../services/api';

const ORANGE_PRIMARY = '#FF6F3C';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';

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
        email,
        password,
        role: 'stall owner',
        name: `${firstName} ${lastName}`,
        firstName,
        lastName,
        nic
      });
      
      Alert.alert('Success', 'Account created! Please login now.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT_DARK} />
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
  appTitle: { fontSize: 26, fontWeight: 'bold', color: TEXT_DARK },
  subtitle: { fontSize: 14, color: TEXT_GRAY, marginTop: 4 },
  form: {},
  row: { flexDirection: 'row' },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: TEXT_DARK, marginBottom: 8 },
  inputRow: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E1E4E8',
    paddingHorizontal: 15, height: 50, fontSize: 15, color: TEXT_DARK
  },
  signupBtn: {
    backgroundColor: ORANGE_PRIMARY, height: 56, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
    shadowColor: ORANGE_PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  signupBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
