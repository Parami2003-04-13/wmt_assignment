import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api, { clearAuthStorage, getStoredUser, setStoredUser } from '../../services/api';
import { COLORS } from '../../theme/colors';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

export default function UserProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = await getStoredUser();
      if (!mounted) return;
      if (!user || user.role !== 'user') {
        router.replace('/login');
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? '');
      setName(user.name ?? '');
      setPhone(typeof user.phone === 'string' ? user.phone : '');
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Missing name', 'Please enter your name.');
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
        phone: phone.trim(),
      });

      const u = data.user;
      await setStoredUser({
        id: u.id,
        email: u.email,
        role: u.role,
        name: u.name,
        phone: u.phone ?? '',
      });

      Alert.alert('Saved', 'Your profile was updated.');
    } catch (e: any) {
      Alert.alert('Update failed', e.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Sign out of CampusBites?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearAuthStorage();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently removes your CampusBites account. Orders are not tracked in-app yet — this removes your login and saved profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you sure?',
              'There is no way to undo this. Your login will stop working immediately.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete my account',
                  style: 'destructive',
                  onPress: confirmDeleteAccount,
                },
              ],
            ),
        },
      ],
    );
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${userId}`);
      await clearAuthStorage();
      router.replace('/login');
    } catch (e: any) {
      Alert.alert('Delete failed', e.response?.data?.message || 'Could not delete account. Try again.');
    } finally {
      setDeleting(false);
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
        <Text style={styles.topTitle}>Profile</Text>
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
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={COLORS.textGray}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSp]}>Phone</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07x xxx xxxx"
            placeholderTextColor={COLORS.textGray}
            style={styles.input}
            keyboardType="phone-pad"
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <MaterialCommunityIcons name="logout" size={20} color={COLORS.primary} />
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>

          <View style={styles.dangerSection}>
            <Text style={styles.dangerTitle}>Danger zone</Text>
            <Text style={styles.dangerBody}>
              Deleting your account removes your profile from CampusBites and signs you out. This cannot be undone.
            </Text>
            <TouchableOpacity
              style={[styles.deleteBtn, (deleting || saving) && { opacity: 0.65 }]}
              onPress={handleDeleteAccount}
              disabled={deleting || saving}>
              {deleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="account-remove-outline" size={22} color="#fff" />
                  <Text style={styles.deleteBtnText}>Delete account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
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
  logoutBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  logoutBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },

  dangerSection: {
    marginTop: 36,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5C6C6',
    backgroundColor: '#FFF5F5',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.danger,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dangerBody: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
  },
  deleteBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
  },
  deleteBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
