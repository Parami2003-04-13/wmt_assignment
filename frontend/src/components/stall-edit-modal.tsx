import React, { useEffect, useState } from 'react';
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

function normalizeClientTime(raw: string): string | null | false {
  const s = raw.trim();
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return false;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export interface StallEditPayload {
  phone: string;
  description: string;
  openingTime: string;
  closingTime: string;
}

interface StallEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  stallId: string;
  initial: StallEditPayload | null;
}

export default function StallEditModal({ visible, onClose, onSaved, stallId, initial }: StallEditModalProps) {
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !initial) return;
    setPhone(initial.phone ?? '');
    setDescription(initial.description ?? '');
    setOpeningTime(initial.openingTime?.trim?.() ?? '');
    setClosingTime(initial.closingTime?.trim?.() ?? '');
  }, [visible, initial]);

  const handleSave = async () => {
    const p = phone.trim();
    if (!p) {
      Alert.alert('Required', 'Please enter a phone number.');
      return;
    }

    const oTrim = openingTime.trim();
    const cTrim = closingTime.trim();
    const hasO = oTrim.length > 0;
    const hasC = cTrim.length > 0;

    if (hasO !== hasC) {
      Alert.alert('Hours', 'Enter both opening and closing time, or leave both empty for manual status only.');
      return;
    }

    let payload: Record<string, string | null> = {
      phone: p,
      description: description.trim(),
    };

    if (!oTrim && !cTrim) {
      payload.openingTime = '';
      payload.closingTime = '';
    } else {
      const nO = normalizeClientTime(oTrim);
      const nC = normalizeClientTime(cTrim);
      if (nO === false || nC === false) {
        Alert.alert('Invalid time', 'Use 24-hour format HH:mm (e.g. 08:30, 21:00).');
        return;
      }
      if (!nO || !nC) {
        Alert.alert('Hours', 'Opening and closing time are both required when you set business hours.');
        return;
      }
      payload.openingTime = nO;
      payload.closingTime = nC;
    }

    setSaving(true);
    try {
      await api.patch(`/stalls/${stallId}`, payload);
      onSaved();
      Alert.alert('Saved', 'Stall details were updated.');
      onClose();
    } catch (e: any) {
      Alert.alert('Save failed', e.response?.data?.message || 'Could not update stall.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit stall details</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>
            Phone <Text style={styles.req}>*</Text>
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="07x xxx xxxx"
            placeholderTextColor={COLORS.textGray}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={[styles.label, styles.mt]}>About</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your stall for customers"
            placeholderTextColor={COLORS.textGray}
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={[styles.label, styles.mt]}>Business hours</Text>
          <Text style={styles.hint}>
            Use 24-hour times (Asia/Colombo). If you set both, open/closed status updates automatically. Leave both blank
            to use manual status only. Manual toggle disables auto until you save hours again.
          </Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.subLabel}>Opens</Text>
              <TextInput
                value={openingTime}
                onChangeText={setOpeningTime}
                placeholder="09:00"
                placeholderTextColor={COLORS.textGray}
                style={styles.input}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.subLabel}>Closes</Text>
              <TextInput
                value={closingTime}
                onChangeText={setClosingTime}
                placeholder="17:30"
                placeholderTextColor={COLORS.textGray}
                style={styles.input}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving} onPress={handleSave}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
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
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
  subLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textGray, marginBottom: 8 },
  req: { color: COLORS.danger },
  hint: {
    fontSize: 13,
    color: COLORS.textGray,
    lineHeight: 19,
    marginBottom: 12,
  },
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
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: Platform.OS === 'ios' ? 13 : 10 },
  row: { flexDirection: 'row', marginBottom: 8 },
  mt: { marginTop: 18 },
  saveBtn: {
    marginTop: 22,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
