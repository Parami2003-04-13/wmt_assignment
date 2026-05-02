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
import api from '../services/api';
import { COLORS } from '../theme/colors';
import DateTimePicker from '@react-native-community/datetimepicker';

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

export default function StaffSupportTicketModal({ visible, onClose, stallId }: Props) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Reply form states
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  // Filter states
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadTickets = async () => {
    if (!stallId) return;
    setLoading(true);
    try {
      const dateParam = filterDate ? `?date=${filterDate.toISOString()}` : '';
      const { data } = await api.get(`/support-tickets/stall/${stallId}${dateParam}`);
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
      cancelReply();
    }
  }, [visible, stallId, filterDate]);

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const handleSaveReply = async () => {
    if (!replyText.trim()) return Alert.alert('Validation', 'Reply cannot be empty');

    try {
      await api.put(`/support-tickets/${replyingTo._id}/reply`, { reply: replyText });
      cancelReply();
      loadTickets();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save reply');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFilterDate(selectedDate);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Customer Tickets</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textDark} />
              </TouchableOpacity>
            </View>

            {!replyingTo && (
              <View style={styles.filterRow}>
                <TouchableOpacity 
                  style={styles.filterBtn} 
                  onPress={() => setShowDatePicker(true)}
                >
                  <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
                  <Text style={styles.filterBtnText}>
                    {filterDate ? filterDate.toLocaleDateString() : 'Filter by Date'}
                  </Text>
                </TouchableOpacity>
                {filterDate && (
                  <TouchableOpacity 
                    onPress={() => setFilterDate(null)}
                    style={styles.clearBtn}
                  >
                    <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.textGray} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={filterDate || new Date()}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {replyingTo ? (
                <View style={styles.replyForm}>
                  <Text style={styles.formTitle}>Replying to {replyingTo.user?.name || 'Customer'}</Text>
                  <View style={styles.ticketCard}>
                    <Text style={styles.ticketTitle}>{replyingTo.title}</Text>
                    <Text style={styles.ticketDesc}>{replyingTo.description}</Text>
                    {replyingTo.screenshot ? (
                      <TouchableOpacity activeOpacity={0.8} onPress={() => setFullScreenImage(replyingTo.screenshot)}>
                        <Image source={{ uri: replyingTo.screenshot }} style={styles.listImg} />
                      </TouchableOpacity>
                    ) : null}
                    <View style={styles.cardFooter}>
                      <Text style={styles.footerDate}>
                        {replyingTo.userEditedAt ? `Edited: ${formatSLTime(replyingTo.userEditedAt)}` : formatSLTime(replyingTo.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Type your reply here..."
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                    textAlignVertical="top"
                    placeholderTextColor={COLORS.textGray}
                  />
                  <View style={styles.formActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={cancelReply}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveReply}>
                      <Text style={styles.saveBtnText}>
                        {replyingTo.reply ? 'Update Reply' : 'Send Reply'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  {loading ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
                  ) : tickets.length === 0 ? (
                    <Text style={styles.empty}>
                      {filterDate 
                        ? `No tickets found for ${filterDate.toLocaleDateString()}` 
                        : 'No tickets from customers yet.'}
                    </Text>
                  ) : (
                    tickets.map(t => (
                      <TouchableOpacity 
                        key={t._id} 
                        style={styles.ticketCard}
                        activeOpacity={0.7}
                        onPress={() => {
                          setReplyingTo(t);
                          setReplyText(t.reply || '');
                        }}
                      >
                        <View style={styles.ticketHeader}>
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.ticketTitle} numberOfLines={1}>{t.title}</Text>
                          </View>
                          <View style={[styles.statusPill, { backgroundColor: t.reply ? '#DCF5ED' : '#FEF3C7' }]}>
                            <Text style={[styles.statusText, { color: t.reply ? COLORS.success : '#D97706' }]}>
                              {t.reply ? 'Solved' : 'Pending'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.userLabel}>From: {t.user?.name || 'Unknown'}</Text>
                        <Text style={styles.footerDate}>
                          {t.userEditedAt ? `Edited: ${formatSLTime(t.userEditedAt)}` : formatSLTime(t.createdAt)}
                        </Text>

                        <View style={styles.actionsRow}>
                          <Text style={styles.actionText}>{t.reply ? 'View & Edit Reply' : 'View & Reply'}</Text>
                          <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.primary} />
                        </View>
                        <View style={styles.cardFooter}>
                          {(t.repliedAt || t.replyEditedAt) && (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.replyDateText}>
                                {t.replyEditedAt ? `Replied (Edited): ${formatSLTime(t.replyEditedAt)}` : `Replied: ${formatSLTime(t.repliedAt)}`}
                              </Text>
                              {t.repliedBy?.name && (
                                <Text style={styles.repliedByText}>By: {t.repliedBy.name}</Text>
                              )}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
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
  replyForm: { marginBottom: 20 },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 15, color: COLORS.textDark },
  textArea: { minHeight: 120 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 12, borderRadius: 12, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  cancelBtnText: { color: COLORS.textDark, fontWeight: '600' },
  saveBtn: { padding: 12, borderRadius: 12, backgroundColor: COLORS.primary },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  empty: { color: COLORS.textGray, fontStyle: 'italic', textAlign: 'center', marginTop: 10 },
  ticketCard: { backgroundColor: COLORS.background, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  ticketTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '800' },
  userLabel: { fontSize: 13, color: COLORS.textDark, marginBottom: 2, fontWeight: '600' },
  ticketDesc: { fontSize: 14, color: COLORS.textGray, lineHeight: 20 },
  replyBox: { marginTop: 12, padding: 12, backgroundColor: COLORS.primarySoft, borderRadius: 12 },
  replyLabel: { fontSize: 12, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  replyText: { fontSize: 14, color: COLORS.textDark },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  cardFooter: { marginTop: 8, alignItems: 'flex-end' },
  footerDate: { fontSize: 11, color: COLORS.textGray, fontWeight: '600' },
  replyDateText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  repliedByText: { fontSize: 10, color: COLORS.primary, fontWeight: '700', fontStyle: 'italic' },
  listImg: { width: '100%', height: 150, borderRadius: 12, marginTop: 10, backgroundColor: COLORS.primarySoft },
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenClose: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 10 },
  fullScreenImage: { width: '100%', height: '80%' },
  filterRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16, 
    gap: 8 
  },
  filterBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    backgroundColor: COLORS.primarySoft, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '20'
  },
  filterBtnText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: COLORS.primary 
  },
  clearBtn: {
    padding: 4
  }
});
