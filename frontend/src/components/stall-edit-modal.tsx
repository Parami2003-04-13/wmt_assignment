import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
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

function dateToHHmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hhmmOrDefault(hm: string | undefined | null, defaultHour: number, defaultMin: number): Date {
  const d = new Date();
  const n = hm && hm.trim() ? normalizeClientTime(hm) : null;
  if (n && n !== false) {
    const [h, mm] = n.split(':').map(Number);
    d.setHours(h, mm, 0, 0);
    return d;
  }
  d.setHours(defaultHour, defaultMin, 0, 0);
  return d;
}

export interface StallEditPayload {
  phone: string;
  description: string;
  openingTime: string;
  closingTime: string;
  profilePhoto?: string | null;
  coverPhoto?: string | null;
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
  const [profilePhoto, setProfilePhoto] = useState('');
  const [coverPhoto, setCoverPhoto] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'open' | 'close' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !initial) return;
    setPhone(initial.phone ?? '');
    setDescription(initial.description ?? '');
    setOpeningTime(initial.openingTime?.trim?.() ?? '');
    setClosingTime(initial.closingTime?.trim?.() ?? '');
    setProfilePhoto((initial.profilePhoto && String(initial.profilePhoto).trim()) || '');
    setCoverPhoto((initial.coverPhoto && String(initial.coverPhoto).trim()) || '');
    setPickerTarget(null);
  }, [visible, initial]);

  const pickPhoto = async (kind: 'profile' | 'cover') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to change images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'profile' ? [1, 1] : [16, 9],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      if (kind === 'profile') setProfilePhoto(uri);
      else setCoverPhoto(uri);
    }
  };

  const pickerValue =
    pickerTarget === 'close'
      ? hhmmOrDefault(closingTime, 17, 0)
      : hhmmOrDefault(openingTime, 9, 0);

  const handleTimePick = (event: DateTimePickerEvent, selected?: Date) => {
    const targetField = pickerTarget;
    if (event.type === 'dismissed') {
      setPickerTarget(null);
      return;
    }
    if (Platform.OS === 'android') {
      setPickerTarget(null);
    }
    if (!selected || !targetField) return;

    const hm = dateToHHmm(selected);
    if (targetField === 'open') {
      setOpeningTime(hm);
    } else {
      setClosingTime(hm);
    }
  };

  const clearScheduledHours = () => {
    setOpeningTime('');
    setClosingTime('');
    setPickerTarget(null);
  };

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
      Alert.alert('Hours', 'Set both opening and closing time with the pickers, or clear scheduled hours.');
      return;
    }

    const payload: Record<string, string | null> = {
      phone: p,
      description: description.trim(),
    };

    const prof = profilePhoto.trim();
    const cov = coverPhoto.trim();
    if (prof) payload.profilePhoto = prof;
    if (cov) payload.coverPhoto = cov;

    if (!oTrim && !cTrim) {
      payload.openingTime = '';
      payload.closingTime = '';
    } else {
      const nO = normalizeClientTime(oTrim);
      const nC = normalizeClientTime(cTrim);
      if (nO === false || nC === false) {
        Alert.alert('Invalid time', 'Something went wrong with the selected times. Please pick again.');
        return;
      }
      if (!nO || !nC) {
        Alert.alert('Hours', 'Opening and closing times are required when schedules are enabled.');
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

  const showWebFallback = Platform.OS === 'web';

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

          <Text style={[styles.label, styles.mt]}>Stall images</Text>
          <Text style={styles.hint}>Choose how your stall looks on the storefront: wide cover first, then a square logo.</Text>

          <Text style={[styles.subLabel, styles.photoBlockLabel]}>Cover banner · wide (16∶9)</Text>
          <TouchableOpacity
            style={styles.coverPick}
            activeOpacity={0.85}
            onPress={() => pickPhoto('cover')}
            accessibilityRole="button"
            accessibilityLabel="Change cover banner image">
            {coverPhoto ? (
              <Image source={{ uri: coverPhoto }} style={styles.coverPickImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverPickEmpty}>
                <MaterialCommunityIcons name="panorama-horizontal" size={34} color={COLORS.primary} />
                <Text style={styles.photoEmptyTitle}>Add cover photo</Text>
                <Text style={styles.photoEmptySub}>Landscape banner · tap to choose</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={[styles.subLabel, styles.photoBlockLabel]}>Profile photo · square (1∶1)</Text>
          <View style={styles.profilePickRow}>
            <TouchableOpacity
              style={styles.profilePick}
              activeOpacity={0.85}
              onPress={() => pickPhoto('profile')}
              accessibilityRole="button"
              accessibilityLabel="Change profile stall image">
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.profilePickImage} resizeMode="cover" />
              ) : (
                <View style={styles.profilePickEmpty}>
                  <MaterialCommunityIcons name="storefront-outline" size={30} color={COLORS.primary} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profilePickMeta}>
              <Text style={styles.profilePickTitle}>{profilePhoto ? 'Change logo' : 'Add stall logo'}</Text>
              <Text style={styles.profilePickHint}>Square crop · used in lists and on your header</Text>
              <TouchableOpacity onPress={() => pickPhoto('profile')} hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.profilePickLink}>Choose from library</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.label, styles.mt]}>Business hours</Text>
          <Text style={styles.hint}>
            Pick open and close times (24h). If you set both, status follows the Asia/Colombo clock. Tap “Clear scheduled
            hours” to use manual status only. Manual toggle disables auto until you save hours again.
          </Text>

          {showWebFallback ? (
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.subLabel}>Opens</Text>
                <TextInput
                  value={openingTime}
                  onChangeText={setOpeningTime}
                  placeholder="09:00"
                  placeholderTextColor={COLORS.textGray}
                  style={styles.input}
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
                />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.subLabel}>Opens</Text>
                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() =>
                      setPickerTarget((prev) => (prev === 'open' ? null : 'open'))
                    }
                    activeOpacity={0.85}>
                    <MaterialCommunityIcons name="clock-outline" size={22} color={COLORS.primary} />
                    <Text style={[styles.timeBtnText, !openingTime && styles.timePlaceholder]}>
                      {openingTime || 'Choose time'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={22} color={COLORS.textGray} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.subLabel}>Closes</Text>
                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() =>
                      setPickerTarget((prev) => (prev === 'close' ? null : 'close'))
                    }
                    activeOpacity={0.85}>
                    <MaterialCommunityIcons name="clock-outline" size={22} color={COLORS.primary} />
                    <Text style={[styles.timeBtnText, !closingTime && styles.timePlaceholder]}>
                      {closingTime || 'Choose time'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={22} color={COLORS.textGray} />
                  </TouchableOpacity>
                </View>
              </View>

              {pickerTarget !== null && (
                <View style={styles.pickerWrap}>
                  {Platform.OS === 'ios' && (
                    <View style={styles.pickerIosBar}>
                      <TouchableOpacity onPress={() => setPickerTarget(null)}>
                        <Text style={styles.pickerDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <DateTimePicker
                    value={pickerValue}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    is24Hour
                    {...(Platform.OS === 'ios' ? { accentColor: COLORS.primary } : {})}
                    onChange={handleTimePick}
                  />
                </View>
              )}

              {Platform.OS === 'ios' && pickerTarget !== null && (
                <TouchableOpacity style={styles.iosDismissPad} onPress={() => setPickerTarget(null)}>
                  <Text style={styles.iosDismissText}>Dismiss picker</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity style={styles.clearLink} onPress={clearScheduledHours}>
            <Text style={styles.clearLinkText}>Clear scheduled hours</Text>
          </TouchableOpacity>

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
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: COLORS.background,
  },
  timeBtnText: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textDark, fontVariant: ['tabular-nums'] },
  timePlaceholder: { color: COLORS.textGray, fontWeight: '600' },
  pickerWrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  pickerIosBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  pickerDone: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },
  iosDismissPad: { marginTop: 8, alignSelf: 'center', paddingVertical: 8 },
  iosDismissText: { fontSize: 13, fontWeight: '600', color: COLORS.textGray },
  clearLink: {
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  clearLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  saveBtn: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  photoBlockLabel: { marginTop: 4, marginBottom: 10 },
  coverPick: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    backgroundColor: COLORS.background,
    marginBottom: 4,
  },
  coverPickImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  coverPickEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 8,
  },
  photoEmptyTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textDark },
  photoEmptySub: { fontSize: 13, color: COLORS.textGray, fontWeight: '600' },
  profilePickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  profilePick: {
    width: 108,
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth + 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  profilePickImage: { width: '100%', height: '100%' },
  profilePickEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 108,
    backgroundColor: COLORS.surface,
  },
  profilePickMeta: { flex: 1, justifyContent: 'center', gap: 4 },
  profilePickTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textDark },
  profilePickHint: { fontSize: 13, color: COLORS.textGray, lineHeight: 18, fontWeight: '600' },
  profilePickLink: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
