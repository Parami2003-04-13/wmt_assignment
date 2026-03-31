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

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => {
    const domainPart = email.split('@')[1];
    return domainPart === 'my.sliit.lk' || domainPart === 'sliit.lk';
  };

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please use your university email (@my.sliit.lk or @sliit.lk).');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', { 
        name, 
        email: email.toLowerCase(), 
        password,
        role: 'user' // Default to student/user role
      });
      
      Alert.alert('Success', 'Account created successfully! Please login.', [
        { text: 'OK', onPress: () => router.push('/login') }
      ]);
    } catch (error: any) {
      Alert.alert('Signup Failed', error.response?.data?.message || 'Something went wrong. Please try again.');
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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={28} color={TEXT_DARK} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
             <Image 
              source={{ uri: 'file:///C:/Users/malsh/.gemini/antigravity/brain/55884d5d-4c4e-4152-aaec-d5b451480081/campusbites_logo_1774873960810.png' }} 
              style={styles.logo} 
            />
          </View>
          <Text style={styles.appTitle}>Create Account</Text>
          <Text style={styles.subtitle}>Join CampusBites today</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Full Name</Text>
             <View style={styles.inputRow}>
                <MaterialCommunityIcons name="account-outline" size={20} color="#A0A0A0" style={styles.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={(v) => setName(v)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#A0A0A0"
                  style={styles.input}
                />
             </View>
          </View>

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>University Email</Text>
             <View style={styles.inputRow}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#A0A0A0" style={styles.inputIcon} />
                <TextInput
                  value={email}
                  onChangeText={(v) => setEmail(v)}
                  placeholder="name@my.sliit.lk"
                  placeholderTextColor="#A0A0A0"
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
             </View>
             <Text style={styles.hintText}>Only @my.sliit.lk or @sliit.lk allowed</Text>
          </View>

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Password</Text>
             <View style={styles.inputRow}>
                <MaterialCommunityIcons name="lock-outline" size={20} color="#A0A0A0" style={styles.inputIcon} />
                <TextInput
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => setPassword(v)}
                  placeholder="Create a password"
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

          <View style={styles.inputWrapper}>
             <Text style={styles.inputLabel}>Confirm Password</Text>
             <View style={styles.inputRow}>
                <MaterialCommunityIcons name="lock-check-outline" size={20} color="#A0A0A0" style={styles.inputIcon} />
                <TextInput
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(v) => setConfirmPassword(v)}
                  placeholder="Repeat your password"
                  placeholderTextColor="#A0A0A0"
                  style={styles.input}
                />
             </View>
          </View>

          <TouchableOpacity 
            style={[styles.signupBtn, loading && { opacity: 0.7 }]} 
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupBtnText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
    paddingHorizontal: 25,
  },
  backBtn: {
    position: 'absolute',
    left: 25,
    top: -10,
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: ORANGE_PRIMARY,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
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
    marginBottom: 18,
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
  hintText: {
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 4,
    marginLeft: 4,
  },
  signupBtn: {
    backgroundColor: ORANGE_PRIMARY,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: ORANGE_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  signupBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  footerText: {
    color: TEXT_GRAY,
    fontSize: 14,
  },
  loginLink: {
    color: ORANGE_PRIMARY,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
