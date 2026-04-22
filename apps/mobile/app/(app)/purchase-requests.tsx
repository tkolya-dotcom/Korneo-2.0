import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { purchaseRequestsApi } from '@/src/lib/supabase';

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  accent: '#02d7ff',
  text: '#e8f1ff',
  sub: '#9ab0c5',
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
};

const statusColor = (status: string) =>
  ({
    draft: C.sub,
    pending: C.yellow,
    approved: C.green,
    rejected: C.red,
    completed: C.accent,
    cancelled: C.sub,
  }[status] || C.sub);

const statusLabel = (status: string) =>
  ({
    draft: 'Черновик',
    pending: 'Ожидает',
    approved: 'Одобрена',
    rejected: 'Отклонена',
    completed: 'Готова',
    cancelled: 'Отменена',
  }[status] || status);

export default function PurchaseRequestsScreen() {
  const { isManagerOrHigher } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await purchaseRequestsApi.getAll();
      setItems(data || []);
    } catch (error) {
      console.error('Failed to load purchase requests:', error);
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await purchaseRequestsApi.updateStatus(id, status);
      await load();
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось обновить заявку');
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Заявки</Text>
        <Text style={s.count}>{items.length}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Заявок нет</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() =>
              router.push({
                pathname: '/(app)/purchase-request/[id]',
                params: { id: item.id },
              } as any)
            }
          >
            <View style={s.row}>
              <Text style={s.cardTitle} numberOfLines={2}>
                {item.comment || `Заявка #${item.id.slice(0, 8)}`}
              </Text>
              <View style={[s.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={s.badgeText}>{statusLabel(item.status)}</Text>
              </View>
            </View>

            {(item.installation?.title || item.installation?.address) && (
              <Text style={s.sub}>🔧 {item.installation.title || item.installation.address}</Text>
            )}

            {(item.creator?.name || item.creator?.email) && (
              <Text style={s.sub}>👤 {item.creator?.name || item.creator?.email}</Text>
            )}

            {isManagerOrHigher && item.status === 'pending' && (
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: C.green }]}
                  onPress={() => updateStatus(item.id, 'approved')}
                >
                  <Text style={s.actionBtnText}>Одобрить</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: C.red }]}
                  onPress={() => updateStatus(item.id, 'rejected')}
                >
                  <Text style={s.actionBtnText}>Отклонить</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 48 },
  title: { color: C.text, fontSize: 26, fontWeight: '700' },
  count: { color: C.sub, fontSize: 16 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  sub: { color: C.sub, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { color: C.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
