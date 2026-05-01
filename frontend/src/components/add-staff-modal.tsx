import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text as RNText,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api';
import { COLORS } from '../theme/colors';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

export type StaffMemberBrief = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  visible: boolean;
  stallId: string | null;
  onClose: () => void;
  onChanged?: () => void;
};

export default function AddStaffModal({ visible, stallId, onClose, onChanged }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<StaffMemberBrief[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loadStaff = useCallback(async () => {
    if (!stallId || !visible) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/stalls/${stallId}/staff`);
      setStaff(Array.isArray(data) ? data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [stallId, visible]);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setEmail('');
    setPassword('');
    loadStaff();
  }, [visible, loadStaff]);

  const handleAdd = async () => {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    if (!n || !e || password.length < 6) {
      Alert.alert(
        'Check form',
        'Enter name and email plus a password of at least 6 characters so your staff member can log in.'
      );
      return;
    }
    if (!stallId) return;
    setSaving(true);
    try {
      await api.post(`/stalls/${stallId}/staff`, { name: n, email: e, password });
      setName('');
      setEmail('');
      setPassword('');
      await loadStaff();
      onChanged?.();
      Alert.alert('Staff added', 'They can log in with this email and password. Permissions: menu items and stall open/closed only.');
    } catch (err: any) {
      Alert.alert('Could not add staff', err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (member: StaffMemberBrief) => {
    if (!stallId) return;
    Alert.alert(
      'Remove staff',
      `Remove access for ${member.name} (${member.email})? They will no longer be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/stalls/${stallId}/staff/${member.id}`);
              await loadStaff();
              onChanged?.();
              Alert.alert('Removed', `${member.name} no longer has access.`);
            } catch (err: any) {
              Alert.alert('Remove failed', err.response?.data?.message || 'Could not remove.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Stall staff</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Staff can add and edit meals, update stock, and switch the stall Open/Closed. They cannot change
            descriptions, phone, business hours, or profile/cover images.
          </Text>

          <Text style={[styles.label, styles.mt]}>Current team</Text>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} />
          ) : staff.length === 0 ? (
            <Text style={styles.emptyTeam}>No extra staff yet. Add someone below.</Text>
          ) : (
            staff.map((m) => (
              <View key={m.id} style={styles.staffRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.staffName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={styles.staffEmail} numberOfLines={1}>
                    {m.email}
                  </Text>
                </View>
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(m)} hitSlop={8}>
                  <MaterialCommunityIcons name="account-remove-outline" size={22} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={[styles.label, styles.mt]}>Add staff member</Text>
          <Text style={styles.hint}>Creates a CampusBites login for this stall only.</Text>

          <Text style={styles.subLabel}>Full name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name shown to you"
            placeholderTextColor={COLORS.textGray}
            style={styles.input}
          />

          <Text style={[styles.subLabel, styles.mtSmall]}>Email (login)</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={COLORS.textGray}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={[styles.subLabel, styles.mtSmall]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={COLORS.textGray}
            secureTextEntry
            style={styles.input}
          />

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.72 }]} disabled={saving} onPress={handleAdd}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Add staff member</Text>}
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 20, fontWeight: '900', color: COLORS.textDark },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  intro: {
    fontSize: 14,
    color: COLORS.textGray,
    lineHeight: 20,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
  subLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textGray, marginBottom: 6 },
  hint: {
    fontSize: 13,
    color: COLORS.textGray,
    lineHeight: 18,
    marginBottom: 12,
  },
  mt: { marginTop: 18 },
  mtSmall: { marginTop: 12 },
  emptyTeam: { fontSize: 14, color: COLORS.textGray, fontStyle: 'italic', marginBottom: 8 },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginBottom: 8,
    gap: 10,
  },
  staffName: { fontSize: 15, fontWeight: '800', color: COLORS.textDark },
  staffEmail: { fontSize: 13, color: COLORS.textGray, marginTop: 4 },
  removeBtn: { padding: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 16,
    backgroundColor: COLORS.background,
    color: COLORS.textDark,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
