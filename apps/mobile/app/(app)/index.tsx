import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { installationsApi, projectsApi, purchaseRequestsApi, tasksApi } from '@/src/lib/supabase';

const C = {
  bg: '#0A0A0F',
  card: '#1A1A2E',
  accent: '#00D9FF',
  text: '#E0E0E0',
  sub: '#8892a0',
  border: 'rgba(0, 217, 255, 0.15)',
  success: '#00FF88',
  warning: '#F59E0B',
};

const statusLabels: Record<string, string> = {
  new: 'Новая',
  planned: 'Запланирована',
  in_progress: 'В работе',
  waiting_materials: 'Ждет материалы',
  done: 'Выполнена',
  postponed: 'Отложена',
};

const statusColors: Record<string, string> = {
  new: '#3399ff',
  planned: '#00D9FF',
  in_progress: '#F59E0B',
  waiting_materials: '#FF6B00',
  done: '#00FF88',
  postponed: '#8892a0',
};

const StatCard = ({
  label,
  value,
  color,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={[s.statCard, { borderLeftColor: color }]} onPress={onPress}>
    <Text style={[s.statValue, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function DashboardScreen() {
  const { user, isManager, logout } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    projects: 0,
    tasks: 0,
    installations: 0,
    pendingRequests: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [recentInstallations, setRecentInstallations] = useState<any[]>([]);

  const load = async () => {
    try {
      const [projects, tasks, installations, requests] = await Promise.all([
        projectsApi.getAll().catch(() => []),
        tasksApi.getAll().catch(() => []),
        installationsApi.getAll().catch(() => []),
        purchaseRequestsApi.getAll().catch(() => []),
      ]);

      const normalizedTasks = Array.isArray(tasks) ? tasks : [];
      const normalizedInstallations = Array.isArray(installations) ? installations : [];
      const normalizedRequests = Array.isArray(requests) ? requests : [];

      setStats({
        projects: Array.isArray(projects) ? projects.length : 0,
        tasks: normalizedTasks.length,
        installations: normalizedInstallations.length,
        pendingRequests: normalizedRequests.filter((item) => item.status === 'pending').length,
      });
      setRecentTasks(normalizedTasks.slice(0, 4));
      setRecentInstallations(normalizedInstallations.slice(0, 4));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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

  if (loading) {
    return (
      <View style={s.center}>
        <Text style={s.loadingLogo}>KORNEO</Text>
        <ActivityIndicator color={C.accent} size="large" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Добро пожаловать,</Text>
          <Text style={s.name}>{user?.name || user?.email?.split('@')[0] || 'Пользователь'}</Text>
          <Text style={s.role}>{isManager ? 'Руководитель' : 'Исполнитель'}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statsGrid}>
        <StatCard label="Проекты" value={stats.projects} color={C.accent} onPress={() => router.push('/(app)/projects')} />
        <StatCard label="Задачи" value={stats.tasks} color={C.success} onPress={() => router.push('/(app)/tasks')} />
        <StatCard
          label="Монтажи"
          value={stats.installations}
          color={C.warning}
          onPress={() => router.push('/(app)/installations')}
        />
        <StatCard
          label="Заявки"
          value={stats.pendingRequests}
          color={C.accent}
          onPress={() => router.push('/(app)/purchase-requests')}
        />
      </View>

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Последние задачи</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/tasks')}>
            <Text style={s.sectionLink}>Все</Text>
          </TouchableOpacity>
        </View>

        {recentTasks.length === 0 ? (
          <Text style={s.empty}>Задач пока нет</Text>
        ) : (
          recentTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={s.itemCard}
              onPress={() => router.push({ pathname: '/(app)/task/[id]', params: { id: task.id } } as any)}
            >
              <View style={s.itemTop}>
                <Text style={s.itemTitle}>{task.title}</Text>
                <View style={[s.badge, { backgroundColor: statusColors[task.status] || C.sub }]}>
                  <Text style={s.badgeText}>{statusLabels[task.status] || task.status}</Text>
                </View>
              </View>
              <Text style={s.itemSub}>{task.project?.name || 'Без проекта'}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Последние монтажи</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/installations')}>
            <Text style={s.sectionLink}>Все</Text>
          </TouchableOpacity>
        </View>

        {recentInstallations.length === 0 ? (
          <Text style={s.empty}>Монтажей пока нет</Text>
        ) : (
          recentInstallations.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={s.itemCard}
              onPress={() =>
                router.push({ pathname: '/(app)/installation/[id]', params: { id: item.id } } as any)
              }
            >
              <View style={s.itemTop}>
                <Text style={s.itemTitle}>{item.title || item.address || 'Монтаж'}</Text>
                <View style={[s.badge, { backgroundColor: statusColors[item.status] || C.sub }]}>
                  <Text style={s.badgeText}>{statusLabels[item.status] || item.status}</Text>
                </View>
              </View>
              <Text style={s.itemSub}>{item.project?.name || item.address || 'Без проекта'}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Навигация</Text>
        <View style={s.linksGrid}>
          <TouchableOpacity style={s.linkCard} onPress={() => router.push('/(app)/projects')}>
            <Text style={s.linkTitle}>Проекты</Text>
            <Text style={s.linkSub}>Список и карточки проектов</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkCard} onPress={() => router.push('/(app)/tasks')}>
            <Text style={s.linkTitle}>Задачи</Text>
            <Text style={s.linkSub}>Текущие работы и статусы</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkCard} onPress={() => router.push('/(app)/installations')}>
            <Text style={s.linkTitle}>Монтажи</Text>
            <Text style={s.linkSub}>Планирование и выполнение</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkCard} onPress={() => router.push('/(app)/purchase-requests')}>
            <Text style={s.linkTitle}>Заявки</Text>
            <Text style={s.linkSub}>Закупка материалов</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkCard} onPress={() => router.push('/(app)/archive')}>
            <Text style={s.linkTitle}>Архив</Text>
            <Text style={s.linkSub}>Завершенные записи</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  loadingLogo: { color: C.accent, fontSize: 30, fontWeight: '800', letterSpacing: 3 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 48,
  },
  greeting: { color: C.sub, fontSize: 14 },
  name: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 4 },
  role: { color: C.accent, fontSize: 13, marginTop: 8, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: 'rgba(0, 217, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  logoutText: { color: C.accent, fontSize: 13, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  statCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    flex: 1,
    minWidth: '42%',
    borderLeftWidth: 3,
  },
  statValue: { fontSize: 30, fontWeight: '800' },
  statLabel: { color: C.sub, marginTop: 4, fontSize: 12 },
  section: { marginTop: 22, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  sectionLink: { color: C.accent, fontSize: 13, fontWeight: '600' },
  itemCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitle: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 10 },
  itemSub: { color: C.sub, marginTop: 6, fontSize: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#081018', fontSize: 10, fontWeight: '700' },
  empty: { color: C.sub, fontSize: 14, paddingVertical: 12 },
  linksGrid: { gap: 10, paddingBottom: 28 },
  linkCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  linkTitle: { color: C.accent, fontSize: 15, fontWeight: '700' },
  linkSub: { color: C.sub, fontSize: 12, marginTop: 4 },
});
