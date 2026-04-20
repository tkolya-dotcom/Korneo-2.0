import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { projectsApi, tasksApi, installationsApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const statusColor = (s: string) => ({ active: COLORS.green, pending: COLORS.yellow, completed: COLORS.accent, cancelled: COLORS.sub, in_progress: COLORS.orange }[s] || COLORS.sub);
const statusLabel = (s: string) => ({ active: 'Активный', pending: 'Ожидает', completed: 'Завершён', cancelled: 'Отменён', in_progress: 'В работе' }[s] || s);

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      projectsApi.getById(id),
      tasksApi.getAll({ project_id: id }),
      installationsApi.getAll({ project_id: id }),
    ]).then(([p, t, i]) => {
      setProject(p); setTasks(t || []); setInstallations(i || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  if (!project) return <View style={s.center}><Text style={s.sub}>Проект не найден</Text></View>;

  return (
    <ScrollView style={s.container}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Назад</Text>
      </TouchableOpacity>
      <View style={s.card}>
        <View style={[s.badge, { backgroundColor: statusColor(project.status), alignSelf: 'flex-start', marginBottom: 12 }]}>
          <Text style={s.badgeText}>{statusLabel(project.status)}</Text>
        </View>
        <Text style={s.title}>{project.name}</Text>
        {project.description && <Text style={s.desc}>{project.description}</Text>}
        {project.manager?.name && <Text style={s.managerText}>👔 {project.manager.name}</Text>}
      </View>

      {tasks.length > 0 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Задачи ({tasks.length})</Text>
          {tasks.map(t => (
            <TouchableOpacity key={t.id} style={s.listItem} onPress={() => router.push({ pathname: '/(app)/task/[id]', params: { id: t.id } } as any)}>
              <Text style={s.itemTitle} numberOfLines={1}>{t.title}</Text>
              <View style={[s.badge, { backgroundColor: statusColor(t.status) }]}>
                <Text style={s.badgeText}>{statusLabel(t.status)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {installations.length > 0 && (
        <View style={s.card}>
          <Text style={s.sectionTitle}>Монтажи ({installations.length})</Text>
          {installations.map(i => (
            <TouchableOpacity key={i.id} style={s.listItem} onPress={() => router.push({ pathname: '/(app)/installation/[id]', params: { id: i.id } } as any)}>
              <Text style={s.itemTitle} numberOfLines={1}>{i.title || i.address}</Text>
              <View style={[s.badge, { backgroundColor: statusColor(i.status) }]}>
                <Text style={s.badgeText}>{statusLabel(i.status)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  backBtn: { padding: 16, paddingTop: 48 },
  backText: { color: COLORS.accent, fontSize: 16 },
  card: { backgroundColor: COLORS.card, margin: 16, marginTop: 0, borderRadius: 16, padding: 16, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '700', lineHeight: 28 },
  desc: { color: COLORS.sub, fontSize: 14, marginTop: 8, lineHeight: 20 },
  managerText: { color: COLORS.sub, fontSize: 13, marginTop: 8 },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  itemTitle: { color: COLORS.text, fontSize: 13, flex: 1, marginRight: 8 },
  sub: { color: COLORS.sub, fontSize: 14 },
});