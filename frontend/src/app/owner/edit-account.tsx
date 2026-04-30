import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Text as RNText,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { getStoredUser, setStoredUser } from '../../services/api';
import { COLORS } from '../../theme/colors';

const Text = (props: any) => (
  <RNText
    {...props}
    style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]}
  />
);

export default function OwnerEditAccount() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = await getStoredUser();
      if (!mounted) return;
      if (!user || user.role !== 'stall owner') {
        router.replace('/login');
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? '');
      setName(user.name ?? '');
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Missing name', 'Please enter your display name.');
      return;
    }

    const parts = trimmed.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    setSaving(true);
    try {
      const { data } = await api.patch(`/users/${userId}`, {
        name: trimmed,
        firstName,
        lastName,
      });

      const u = data.user;
      await setStoredUser({
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.name,
      });

      Alert.alert('Saved', 'Your account details were updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Update failed', e.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backHit} onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={26} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Edit account</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={COLORS.textGray}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSp]}>Email</Text>
          <View style={[styles.input, styles.readonly]}>
            <MaterialCommunityIcons name="email-outline" size={18} color={COLORS.textGray} style={{ marginRight: 10 }} />
            <Text style={styles.readonlyText} numberOfLines={1}>
              {email}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backHit: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textGray },
  labelSp: { marginTop: 20 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    backgroundColor: COLORS.surface,
    color: COLORS.textDark,
  },
  readonly: { flexDirection: 'row', alignItems: 'center', opacity: 0.95 },
  readonlyText: { flex: 1, fontSize: 15, color: COLORS.textDark },
  saveBtn: {
    marginTop: 28,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
