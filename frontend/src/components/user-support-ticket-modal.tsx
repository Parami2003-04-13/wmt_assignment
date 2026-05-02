import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { ensureRemoteImageUrl } from '../services/uploadImage';
import { COLORS } from '../theme/colors';

const formatSLTime = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type Props = {
  visible: boolean;
  onClose: () => void;
  stallId: string;
};

export default function UserSupportTicketModal({ visible, onClose, stallId }: Props) {
  const [supportTickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const loadTickets = async () => {
    if (!stallId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/support-tickets/user/${stallId}`);
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadTickets();
      resetForm();
    }
  }, [visible, stallId]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setScreenshot(null);
  };

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert('Validation', 'Title cannot be empty');
    if (description.trim().length < 10) return Alert.alert('Validation', 'Description must be at least 10 characters');

    try {
      const trimmedShot = typeof screenshot === 'string' ? screenshot.trim() : '';
      let screenshotUrl: string | null = trimmedShot || null;
      if (screenshotUrl) {
        try {
          screenshotUrl = await ensureRemoteImageUrl(screenshotUrl, 'support/screenshots');
        } catch (uploadErr: any) {
          console.error(uploadErr);
          Alert.alert(
            'Upload failed',
            uploadErr?.response?.data?.message ||
              uploadErr?.message ||
              'Could not upload the screenshot.'
          );
          return;
        }
      } else {
        screenshotUrl = null;
      }

      if (editingId) {
        await api.put(`/support-tickets/${editingId}`, {
          title,
          description,
          screenshot: screenshotUrl,
        });
      } else {
        await api.post('/support-tickets', {
          stallId,
          title,
          description,
          screenshot: screenshotUrl,
        });
      }
      resetForm();
      loadTickets();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save ticket');
    }
  };

  const handleEdit = (ticket: any) => {
    if (ticket.reply) {
      return Alert.alert('Cannot Edit', 'This ticket already has a reply.');
    }
    setEditingId(ticket._id);
    setTitle(ticket.title);
    setDescription(ticket.description);
    setScreenshot(ticket.screenshot || null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to choose a screenshot.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      const a = result.assets[0];
      const uri =
        a.base64 != null ? `data:image/jpeg;base64,${a.base64}` : a.uri != null ? a.uri : null;
      if (uri) {
        setScreenshot(uri);
      }
    }
  };

  const handleDelete = (id: string, hasReply: boolean) => {
    if (hasReply) {
      return Alert.alert('Cannot Delete', 'This ticket already has a reply.');
    }
    Alert.alert('Delete Ticket', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/support-tickets/${id}`);
            loadTickets();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete ticket');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Support Tickets</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                <Text style={styles.formTitle}>{editingId ? 'Edit Ticket' : 'Raise a Ticket'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Issue Title"
                  value={title}
                  onChangeText={setTitle}
                  placeholderTextColor={COLORS.textGray}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Issue Description"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={COLORS.textGray}
                />

                <TouchableOpacity style={styles.imgPickBtn} onPress={pickImage}>
                  <MaterialCommunityIcons name="camera-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.imgPickText}>{screenshot ? 'Change Screenshot' : 'Attach Screenshot of Issue'}</Text>
                </TouchableOpacity>

                {screenshot && (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: screenshot }} style={styles.previewImg} />
                    <TouchableOpacity style={styles.previewClear} onPress={() => setScreenshot(null)}>
                      <MaterialCommunityIcons name="close-circle" size={24} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.formActions}>
                  {editingId && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Submit'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.divider} />
              <Text style={styles.listTitle}>Previous Tickets</Text>

              {loading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
              ) : supportTickets.length === 0 ? (
                <Text style={styles.empty}>No supportTickets raised yet.</Text>
              ) : (
                supportTickets.map(t => (
                  <View key={t._id} style={styles.supportTicketCard}>
                    <View style={styles.supportTicketHeader}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.supportTicketTitle}>{t.title}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: t.reply ? '#DCF5ED' : '#FEF3C7' }]}>
                        <Text style={[styles.statusText, { color: t.reply ? COLORS.success : '#D97706' }]}>
                          {t.reply ? 'Solved' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.supportTicketDesc}>{t.description}</Text>

                    {t.screenshot ? (
                      <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(t.screenshot)}>
                        <Image source={{ uri: t.screenshot }} style={styles.listImg} />
                      </TouchableOpacity>
                    ) : null}

                    <View style={styles.dateContainer}>
                      <Text style={styles.footerDate}>
                        {t.userEditedAt ? `Edited: ${formatSLTime(t.userEditedAt)}` : formatSLTime(t.createdAt)}
                      </Text>
                    </View>

                    {t.reply && (
                      <View style={styles.replyBox}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <MaterialCommunityIcons name="account-tie" size={16} color={COLORS.primary} />
                          <Text style={styles.replyLabel}>
                            {t.repliedBy?.name ? `Staff Reply (${t.repliedBy.name}):` : 'Staff Reply:'}
                          </Text>
                        </View>
                        <Text style={[styles.replyDate, { marginBottom: 6 }]}>
                          {t.replyEditedAt ? `Replied (Edited): ${formatSLTime(t.replyEditedAt)}` : t.repliedAt ? `Replied: ${formatSLTime(t.repliedAt)}` : ''}
                        </Text>
                        <Text style={styles.replyText}>{t.reply}</Text>
                      </View>
                    )}

                    <View style={styles.actionsRow}>
                      {!t.reply && (
                        <>
                          <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(t)}>
                            <MaterialCommunityIcons name="pencil" size={16} color={COLORS.primary} />
                            <Text style={styles.actionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(t._id, !!t.reply)}>
                            <MaterialCommunityIcons name="trash-can" size={16} color={COLORS.danger} />
                            <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>

      {fullScreenImage && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
          <View style={styles.fullScreenOverlay}>
            <TouchableOpacity style={styles.fullScreenClose} onPress={() => setFullScreenImage(null)}>
              <MaterialCommunityIcons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImage} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, flex: 0.9 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textDark },
  scroll: { flex: 1 },
  form: { marginBottom: 20 },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 15, color: COLORS.textDark },
  textArea: { minHeight: 80 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 12, borderRadius: 12, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.textDark, fontWeight: '600' },
  saveBtn: { padding: 12, borderRadius: 12, backgroundColor: COLORS.primary },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  listTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 12 },
  empty: { color: COLORS.textGray, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  supportTicketCard: { backgroundColor: COLORS.background, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  supportTicketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  supportTicketTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '800' },
  supportTicketDesc: { fontSize: 14, color: COLORS.textGray, lineHeight: 20 },
  replyBox: { marginTop: 12, padding: 12, backgroundColor: COLORS.primarySoft, borderRadius: 12 },
  replyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  replyLabel: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  replyDate: { fontSize: 11, color: COLORS.primary, fontWeight: '600', opacity: 0.8 },
  replyText: { fontSize: 14, color: COLORS.textDark },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 14, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  dateContainer: { marginTop: 10, alignItems: 'flex-end' },
  footerDate: { fontSize: 11, color: COLORS.textGray, fontWeight: '600' },
  imgPickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: COLORS.primarySoft, marginBottom: 12 },
  imgPickText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  previewWrap: { position: 'relative', width: 120, height: 120, marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  previewImg: { width: '100%', height: '100%', backgroundColor: COLORS.border },
  previewClear: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12 },
  listImg: { width: '100%', height: 150, borderRadius: 12, marginTop: 10, backgroundColor: COLORS.primarySoft },
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenClose: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 },
  fullScreenImage: { width: '100%', height: '80%' },
});
