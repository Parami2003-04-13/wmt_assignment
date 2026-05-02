import React, { useCallback, useState } from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import api from '../../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const PRIMARY = '#0F5B57';
const TEXT_DARK = '#2D3436';
const TEXT_GRAY = '#636E72';
const BG = '#F5F7F7';
const SURFACE = '#FFFFFF';

const Text = (props: any) => (
  <RNText {...props} style={[{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' }, props.style]} />
);

export default function UserNotificationsScreen() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const reload = async (isPull: boolean) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('notifications');
      setList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Fetch notifications error:', err);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const res = await api.get('notifications');
          if (!cancelled) {
            setList(Array.isArray(res.data) ? res.data : []);
          }
        } catch (err) {
          console.error('Fetch notifications error:', err);
          if (!cancelled) setList([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onRefresh = () => {
    reload(true);
  };

  const markOneReadIfNeeded = async (n: any) => {
    if (!n?._id || n.read) return;
    try {
      await api.patch(`notifications/${n._id}/read`);
      setList((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    } catch {
      /* ignore */
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch('notifications/read-all');
      setList((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Mark all read error:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const openRow = (n: any) => {
    void markOneReadIfNeeded(n);
    router.push('/user/orders');
  };

  const unreadCount = list.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => markAllRead()} disabled={markingAll} hitSlop={8}>
            <Text style={styles.markAllText}>{markingAll ? '…' : 'Mark all read'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 88 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-off-outline" size={56} color={TEXT_GRAY} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySub}>We’ll notify you when your order status changes.</Text>
          </View>
        ) : (
          list.map((n) => (
            <TouchableOpacity
              key={n._id}
              style={[styles.row, !n.read && styles.rowUnread]}
              activeOpacity={0.85}
              onPress={() => openRow(n)}>
              <View style={[styles.dot, !n.read && styles.dotUnread]} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{n.title}</Text>
                <Text style={styles.rowBodyText}>{n.body}</Text>
                {n.orderIdDisplay ? (
                  <Text style={styles.rowMeta}>Order · {n.orderIdDisplay}</Text>
                ) : null}
                <Text style={styles.rowTime}>{dayjs(n.createdAt).fromNow()}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={TEXT_GRAY} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: SURFACE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8ECF0',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: TEXT_DARK },
  markAllText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  scroll: { padding: 16, paddingBottom: 32 },
  empty: {
    alignItems: 'center',
    marginTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { marginTop: 16, fontSize: 17, fontWeight: '800', color: TEXT_DARK },
  emptySub: { marginTop: 8, fontSize: 14, color: TEXT_GRAY, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8ECF0',
    gap: 10,
  },
  rowUnread: {
    borderColor: PRIMARY + '44',
    backgroundColor: PRIMARY + '08',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: 'transparent',
  },
  dotUnread: { backgroundColor: PRIMARY },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: TEXT_DARK },
  rowBodyText: { marginTop: 4, fontSize: 14, color: TEXT_DARK, lineHeight: 20 },
  rowMeta: { marginTop: 6, fontSize: 12, fontWeight: '700', color: TEXT_GRAY },
  rowTime: { marginTop: 6, fontSize: 12, color: TEXT_GRAY },
});
