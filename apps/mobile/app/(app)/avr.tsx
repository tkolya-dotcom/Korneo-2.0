import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/providers/AuthProvider';
import { avrApi } from '@/src/lib/supabase';

const C = {
  bg: '#0A0A0F',
  card: '#1A1A2E',
  accent: '#00D9FF',
  text: '#E0E0E0',
  sub: '#8892a0',
  border: 'rgba(0, 217, 255, 0.15)',
};

type AvrStatus = 'all' | 'new' | 'planned' | 'in_progress' | 'completed' | 'cancelled';

const statusLabel = (status: string) =>
  ({
    draft: 'Черновик',
    new: 'Новая',
    planned: 'Запланирована',
    in_progress: 'В работе',
    completed: 'Выполнена',
    cancelled: 'Отменена',
  }[status] || status);

const statusColor = (status: string) =>
  ({
    draft: '#8892a0',
    new: '#F59E0B',
    planned: '#FF6B00',
    in_progress: '#00D9FF',
    completed: '#00FF88',
    cancelled: '#EF4444',
  }[status] || C.sub);

const typeLabel = (type: string) =>
  ({
    AVR: 'АВР',
    NRD: 'НРД',
    TECH_TASK: 'Тех. задача',
  }[type] || type || 'Заявка');

export default function AvrScreen() {
  const { user, isManagerOrHigher } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AvrStatus>('all');
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await avrApi.getAll({
        executor_id: isManagerOrHigher || !user?.id ? undefined : user.id,
        include_completed: true,
      });
      setItems(data || []);
    } catch (error) {
      console.error('Failed to load AVR:', error);
    }
  }, [isManagerOrHigher, user?.id]);

  useEffect(() => {
    let active = true;
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      const shortId = item.short_id ? String(item.short_id).padStart(4, '0') : '';
      const haystack = [
        item.title,
        item.description,
        item.address_text,
        shortId,
        item.project?.name,
        item.executor?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [items, search, statusFilter]);

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
        <Text style={s.title}>АВР / НРД</Text>
        <View style={s.headerRight}>
          <Text style={s.count}>{filtered.length}</Text>
          {isManagerOrHigher ? (
            <TouchableOpacity style={s.createBtn} onPress={() => router.push('/(app)/avr/create')}>
              <Text style={s.createBtnText}>+ Создать</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <TextInput
        style={s.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Поиск по номеру или названию"
        placeholderTextColor={C.sub}
      />

      <View style={s.filtersRow}>
        {[
          ['all', 'Все'],
          ['new', 'Новые'],
          ['planned', 'План'],
          ['in_progress', 'В работе'],
          ['completed', 'Готово'],
          ['cancelled', 'Отмена'],
        ].map(([id, label]) => {
          const active = statusFilter === id;
          return (
            <TouchableOpacity
              key={id}
              style={[s.filterChip, active && s.filterChipActive]}
              onPress={() => setStatusFilter(id as AvrStatus)}
            >
              <Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
        }
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Заявок нет</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() =>
              router.push({
                pathname: '/(app)/avr/[id]',
                params: { id: item.id },
              } as any)
            }
          >
            <View style={s.row}>
              <Text style={s.cardTitle} numberOfLines={2}>
                {item.short_id ? `#${String(item.short_id).padStart(4, '0')} ` : ''}
                {item.title}
              </Text>
              <View style={[s.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={s.badgeText}>{statusLabel(item.status)}</Text>
              </View>
            </View>

            <Text style={s.sub}>
              {typeLabel(item.type)} {item.address_text ? `• ${item.address_text}` : ''}
            </Text>
            {item.executor?.name ? <Text style={s.sub}>👷 {item.executor.name}</Text> : null}
            {item.project?.name ? <Text style={s.sub}>📁 {item.project.name}</Text> : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 48,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: C.text, fontSize: 26, fontWeight: '700' },
  count: { color: C.sub, fontSize: 16 },
  createBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.accent,
    backgroundColor: 'rgba(0,217,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  createBtnText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  search: {
    backgroundColor: C.card,
    color: C.text,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  filterChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: { borderColor: C.accent, backgroundColor: 'rgba(0,217,255,0.15)' },
  filterText: { color: C.sub, fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: C.accent },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#081018', fontSize: 10, fontWeight: '700' },
  sub: { color: C.sub, fontSize: 12, marginTop: 5 },
  empty: { color: C.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
});
