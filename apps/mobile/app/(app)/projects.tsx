import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { projectsApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const statusColor = (s: string) => ({ active: COLORS.green, pending: COLORS.yellow, completed: COLORS.accent, cancelled: COLORS.sub }[s] || COLORS.sub);
const statusLabel = (s: string) => ({ active: 'Активный', pending: 'Ожидает', completed: 'Завершён', cancelled: 'Отменён' }[s] || s);

export default function ProjectsScreen() {
  const { isManager } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await projectsApi.getAll();
      setProjects(data || []);
      setFiltered(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(projects.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)));
  }, [search, projects]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Проекты</Text>
        <Text style={s.count}>{filtered.length}</Text>
      </View>
      <TextInput style={s.search} placeholder="Поиск..." placeholderTextColor={COLORS.sub} value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Проектов нет</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => router.push({ pathname: '/(app)/project/[id]', params: { id: item.id } } as any)}>
            <View style={s.row}>
              <Text style={s.cardTitle} numberOfLines={2}>{item.name}</Text>
              <View style={[s.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={s.badgeText}>{statusLabel(item.status)}</Text>
              </View>
            </View>
            {item.description && <Text style={s.sub} numberOfLines={2}>{item.description}</Text>}
            {item.manager?.name && <Text style={s.sub}>👔 {item.manager.name}</Text>}
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
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  sub: { color: COLORS.sub, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { color: COLORS.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
});