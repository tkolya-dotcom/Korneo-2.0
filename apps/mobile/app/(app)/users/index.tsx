import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { authApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const ROLE_LABELS: Record<string, string> = {
  worker: 'Монтажник',
  engineer: 'Инженер',
  manager: 'Менеджер',
  deputy_head: 'Зам. руководителя',
  admin: 'Админ',
};

const ROLE_COLORS: Record<string, string> = {
  worker: '#94a3b8',
  engineer: '#3399ff',
  manager: '#00D9FF',
  deputy_head: '#8B5CF6',
  admin: '#FF3366',
};

export default function UsersScreen() {
  const { user, isManagerOrHigher } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await authApi.getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error('Ошибка загрузки:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Сотрудники</Text>
        <Text style={s.count}>{users.length}</Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Сотрудников нет</Text>}
        renderItem={({ item }) => (
          <View style={[s.userCard, item.id === user?.id && s.userCardSelf]}>
            <View style={[s.avatar, { backgroundColor: ROLE_COLORS[item.role] || COLORS.sub }]}>
              <Text style={s.avatarText}>{getInitials(item.name || item.email)}</Text>
              {item.is_online && <View style={s.onlineDot} />}
            </View>
            <View style={s.userInfo}>
              <Text style={s.userName}>
                {item.name || item.email?.split('@')[0]}
                {item.id === user?.id && <Text style={s.youLabel}> (Вы)</Text>}
              </Text>
              <Text style={s.userEmail}>{item.email}</Text>
              <View style={[s.roleBadge, { borderColor: ROLE_COLORS[item.role] || COLORS.sub }]}>
                <Text style={[s.roleText, { color: ROLE_COLORS[item.role] || COLORS.sub }]}>
                  {ROLE_LABELS[item.role] || item.role}
                </Text>
              </View>
            </View>
            {item.is_online && (
              <View style={s.onlineStatus}>
                <Text style={s.onlineText}>🟢</Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50 },
title: { color: COLORS.accent, fontSize: 26, fontWeight: '700' },
  count: { color: COLORS.sub, fontSize: 16 },
  userCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center' },
  userCardSelf: { borderWidth: 1, borderColor: COLORS.accent },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759', borderWidth: 2, borderColor: COLORS.card },
  userInfo: { flex: 1, marginLeft: 14 },
  userName: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  youLabel: { color: COLORS.accent, fontSize: 12 },
  userEmail: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  roleText: { fontSize: 11, fontWeight: '600' },
  onlineStatus: { padding: 4 },
  onlineText: { fontSize: 16 },
  empty: { color: COLORS.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
});