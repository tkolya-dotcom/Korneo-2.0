import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { purchaseRequestsApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const statusColor = (s: string) => ({ pending: COLORS.yellow, approved: COLORS.green, rejected: COLORS.red, completed: COLORS.accent, cancelled: COLORS.sub }[s] || COLORS.sub);
const statusLabel = (s: string) => ({ pending: 'Ожидает', approved: 'Одобрена', rejected: 'Отклонена', completed: 'Готова', cancelled: 'Отменена' }[s] || s);

export default function PurchaseRequestsScreen() {
  const { user, isManagerOrHigher } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await purchaseRequestsApi.getAll();
      setItems(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const approve = async (id: string) => {
    try {
      await purchaseRequestsApi.updateStatus(id, 'approved');
      load();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  };

  const reject = async (id: string) => {
    try {
      await purchaseRequestsApi.updateStatus(id, 'rejected');
      load();
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Заявки</Text>
        <Text style={s.count}>{items.length}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Заявок нет</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => router.push({ pathname: '/(app)/purchase-request/[id]', params: { id: item.id } } as any)}>
            <View style={s.row}>
              <Text style={s.cardTitle} numberOfLines={2}>{item.description || 'Заявка #' + item.id.slice(0, 8)}</Text>
              <View style={[s.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={s.badgeText}>{statusLabel(item.status)}</Text>
              </View>
            </View>
            {item.installation?.title && <Text style={s.sub}>🔧 {item.installation.title || item.installation.address}</Text>}
            {item.creator?.name && <Text style={s.sub}>👤 {item.creator.name}</Text>}
            {isManagerOrHigher && item.status === 'pending' && (
              <View style={s.actions}>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.green + '22' }]} onPress={() => approve(item.id)}>
                  <Text style={[s.actionBtnText, { color: COLORS.green }]}>Одобрить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.red + '22' }]} onPress={() => reject(item.id)}>
                  <Text style={[s.actionBtnText, { color: COLORS.red }]}>Отклонить</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 48 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '700' },
  count: { color: COLORS.sub, fontSize: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  sub: { color: COLORS.sub, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { color: COLORS.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
});