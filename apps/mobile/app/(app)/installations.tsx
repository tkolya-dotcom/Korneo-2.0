import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { installationsApi } from '@/src/lib/supabase';

// Cyberpunk theme - cyan colors
const C = { bg: '#0A0A0F', card: '#1A1A2E', accent: '#00D9FF', text: '#E0E0E0', sub: '#8892a0', border: 'rgba(0, 217, 255, 0.15)', green: '#00FF88', orange: '#FFA500' };

const STATUS_COLORS: Record<string, string> = {
  new: '#3399ff',
  in_progress: '#00D9FF',
  on_hold: '#ff00cc',
  completed: '#00FF88',
  archived: '#8892a0',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  on_hold: 'На паузе',
  completed: 'Готов',
  archived: 'Архив',
};

export default function InstallationsScreen() {
  const { user, canCreateTasks } = useAuth();
  const router = useRouter();
  const [installations, setInstallations] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const filters = canCreateTasks ? {} : { assignee_id: user?.id };
      const data = await installationsApi.getAll(filters);
      setInstallations(data || []);
      setFiltered(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(installations.filter(i => i.address?.toLowerCase().includes(q) || i.project?.name?.toLowerCase().includes(q)));
  }, [search, installations]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const getEquipmentCount = (item: any) => {
    let count = 0;
    for (let i = 0; i <= 6; i++) {
      const suffix = i === 0 ? '' : i;
      if (item[`id_sk${suffix}`] || item[`naimenovanie_sk${suffix}`]) count++;
    }
    return count;
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Монтажи</Text>
        <Text style={s.count}>{filtered.length}</Text>
      </View>

      <TextInput style={s.search} placeholder="Поиск..." placeholderTextColor={C.sub} value={search} onChangeText={setSearch} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={<Text style={s.empty}>Монтажей нет</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => router.push({ pathname: '/(app)/installation/[id]', params: { id: item.id } } as any)}>
            <View style={s.cardHeader}>
              <Text style={s.cardAddress} numberOfLines={1}>{item.address}</Text>
              <View style={[s.badge, { backgroundColor: STATUS_COLORS[item.status] || C.sub }]}>
                <Text style={s.badgeText}>{STATUS_LABELS[item.status] || item.status}</Text>
              </View>
            </View>

            {item.project?.name && <Text style={s.sub}>📋 {item.project.name}</Text>}
            {item.assignee?.name && <Text style={s.sub}>👤 {item.assignee.name}</Text>}
            
            <View style={s.cardFooter}>
<Text style={s.equipment}>🔧 {getEquipmentCount(item)} ед. оборудования</Text>
              {item.planned_date && (
                <Text style={s.date}>📅 {new Date(item.planned_date).toLocaleDateString('ru')}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      {canCreateTasks && (
        <TouchableOpacity style={s.fab} onPress={() => router.push('/(app)/installation/create')}>
          <Text style={s.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
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
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: C.green },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardAddress: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  sub: { color: C.sub, fontSize: 12, marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  equipment: { color: C.accent, fontSize: 11 },
  date: { color: C.sub, fontSize: 11 },
  empty: { color: C.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  fabIcon: { color: C.bg, fontSize: 28, fontWeight: '600' },
});