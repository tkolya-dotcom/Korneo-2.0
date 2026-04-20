import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { purchaseRequestsApi } from '@/src/lib/supabase';

// Cyberpunk theme - cyan colors
const C = { bg: '#0A0A0F', card: '#1A1A2E', accent: '#00D9FF', text: '#E0E0E0', sub: '#8892a0', border: 'rgba(0, 217, 255, 0.15)', green: '#00FF88', orange: '#FFA500', danger: '#FF3366' };

const STATUS_COLORS: Record<string, string> = {
  draft: '#8892a0',
  pending: '#FFA500',
  approved: '#00FF88',
  in_order: '#3399ff',
  ready_for_receipt: '#FFA500',
  received: '#8B5CF6',
  rejected: '#FF3366',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  pending: 'Ожидает',
  approved: 'Одобрено',
  in_order: 'В заказе',
  ready_for_receipt: 'Готов к получению',
  received: 'Получено',
  rejected: 'Отклонено',
};

export default function PurchaseRequestsScreen() {
  const { user, canApproveRequests } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await purchaseRequestsApi.getAll();
      setRequests(data || []);
      setFiltered(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(requests.filter(r => r.id?.toLowerCase().includes(q) || r.installation?.address?.toLowerCase().includes(q)));
  }, [search, requests]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleApprove = async (id: string) => {
    try {
      await purchaseRequestsApi.updateStatus(id, 'approved');
      load();
    } catch (e) {
      console.error('Ошибка:', e);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Заявки</Text>
        <Text style={s.count}>{filtered.length}</Text>
      </View>

      <TextInput style={s.search} placeholder="Поиск..." placeholderTextColor={C.sub} value={search} onChangeText={setSearch} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Заявок нет</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardId}>{item.id?.slice(0, 8)}</Text>
              <View style={[s.badge, { backgroundColor: STATUS_COLORS[item.status] || C.sub }]}>
                <Text style={s.badgeText}>{STATUS_LABELS[item.status] || item.status}</Text>
              </View>
            </View>

            {item.installation?.address && <Text style={s.address}>📍 {item.installation.address}</Text>}
            {item.creator?.name && <Text style={s.sub}>👤 {item.creator.name}</Text>}
            
            {canApproveRequests && item.status === 'pending' && (
              <View style={s.actions}>
                <TouchableOpacity style={s.approveBtn} onPress={() => handleApprove(item.id)}>
                  <Text style={s.approveBtnText}>✓ Одобрить</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.rejectBtn}>
                  <Text style={s.rejectBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50 },
  title: { color: C.accent, fontSize: 26, fontWeight: '700' },
  count: { color: C.sub, fontSize: 16 },
  search: { backgroundColor: C.card, color: C.text, borderRadius: 10, margin: 16, marginTop: 0, padding: 12, fontSize: 14, borderWidth: 1, borderColor: C.border },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: C.orange },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardId: { color: C.orange, fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  address: { color: C.text, fontSize: 13, marginTop: 6 },
  sub: { color: C.sub, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  approveBtn: { backgroundColor: C.green, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  approveBtnText: { color: C.bg, fontSize: 13, fontWeight: '600' },
  rejectBtn: { backgroundColor: 'rgba(255, 51, 102, 0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  rejectBtnText: { color: C.danger, fontSize: 16 },
  empty: { color: C.sub, textAlign: 'center', marginTop:60, fontSize: 16 },
});