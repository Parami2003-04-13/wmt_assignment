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
  Text as RNText // Renamed for helper
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import api, { setAuthToken } from '../services/api';
import * as SecureStore from 'expo-secure-store';

const ORANGE_PRIMARY = '#FF6F3C';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';

const Text = (props: any) => <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Helper text component

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      await setAuthToken(token);
      await SecureStore.setItemAsync('user', JSON.stringify(user));
      
      if (user.role === 'stall manager') {
        router.replace('/admin/stall_manager_dashboard');
      } else {
        router.replace('/user/dashboard');
      }
    } catch (error: any) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Check your internet or credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: 'file:///C:/Users/malsh/.gemini/antigravity/brain/55884d5d-4c4e-4152-aaec-d5b451480081/campusbites_logo_1774873960810.png' }} 
              style={styles.logo} 
            />
          </View>
          <Text style={styles.appTitle}>CampusBites</Text>
          <Text style={styles.subtitle}>Your campus dining companion</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Email</Text>
             <View style={styles.inputRow}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#A0A0A0" style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={(v) => setEmail(v)}
                  placeholder="Enter your university email"
                  placeholderTextColor="#A0A0A0"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
             </View>
          </View>

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Password</Text>
             <View style={styles.inputRow}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#A0A0A0" style={styles.inputIcon} />
                <TextInput
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => setPassword(v)}
                  placeholder="Enter your password"
                  placeholderTextColor="#A0A0A0"
                  style={styles.input}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialCommunityIcons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color="#A0A0A0" 
                  />
                </TouchableOpacity>
             </View>
          </View>

          <TouchableOpacity 
            style={[styles.loginBtn, loading && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  baseText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 100,
    height: 100,
    backgroundColor: ORANGE_PRIMARY,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: TEXT_DARK,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    marginTop: 4,
  },
  form: {
    paddingHorizontal: 25,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E4E8',
    paddingHorizontal: 15,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: TEXT_DARK,
    height: '100%',
  },
  loginBtn: {
    backgroundColor: ORANGE_PRIMARY,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotText: {
    color: ORANGE_PRIMARY,
    fontWeight: '600',
    fontSize: 14,
  },
});
