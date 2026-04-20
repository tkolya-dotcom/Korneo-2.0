import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { installationsApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const statusColor = (s: string) => ({ active: COLORS.green, pending: COLORS.yellow, in_progress: COLORS.orange, completed: COLORS.accent, cancelled: COLORS.sub }[s] || COLORS.sub);
const statusLabel = (s: string) => ({ active: 'Активный', pending: 'Ожидает', in_progress: 'В работе', completed: 'Завершён', cancelled: 'Отменён' }[s] || s);

export default function InstallationsScreen() {
  const { user, isManagerOrHigher } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await installationsApi.getAll(isManagerOrHigher ? {} : { assignee_id: user?.id });
      setItems(data || []);
      setFiltered(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(items.filter(i => i.title?.toLowerCase().includes(q) || i.address?.toLowerCase().includes(q) || i.project?.name?.toLowerCase().includes(q)));
  }, [search, items]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Монтажи</Text>
        <Text style={s.count}>{filtered.length}</Text>
      </View>
      <TextInput style={s.search} placeholder="Поиск..." placeholderTextColor={COLORS.sub} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Монтажей нет</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => router.push({ pathname: '/(app)/installation/[id]', params: { id: item.id } } as any)}>
            <View style={s.row}>
              <Text style={s.cardTitle} numberOfLines={2}>{item.title || item.address || 'Без названия'}</Text>
              <View style={[s.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={s.badgeText}>{statusLabel(item.status)}</Text>
              </View>
            </View>
            {item.address && <Text style={s.sub}>📍 {item.address}</Text>}
            {item.project?.name && <Text style={s.sub}>📋 {item.project.name}</Text>}
            {item.assignee?.name && <Text style={s.sub}>👤 {item.assignee.name}</Text>}
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
  search: { backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 10, margin: 16, marginTop: 0, padding: 12, fontSize: 14 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  sub: { color: COLORS.sub, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { color: COLORS.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
});