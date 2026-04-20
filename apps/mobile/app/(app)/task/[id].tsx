import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { tasksApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];
const statusLabel = (s: string) => ({ pending: 'Ожидает', in_progress: 'В работе', completed: 'Готова', cancelled: 'Отменена', active: 'Активна' }[s] || s);
const statusColor = (s: string) => ({ pending: COLORS.yellow, in_progress: COLORS.orange, completed: COLORS.green, cancelled: COLORS.sub, active: COLORS.green }[s] || COLORS.sub);

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isManagerOrHigher } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    tasksApi.getById(id).then(setTask).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const changeStatus = async (status: string) => {
    setUpdating(true);
    try {
      const updated = await tasksApi.update(id, { status });
      setTask(updated);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally { setUpdating(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  if (!task) return <View style={s.center}><Text style={s.sub}>Задача не найдена</Text></View>;

  return (
    <ScrollView style={s.container}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Назад</Text>
      </TouchableOpacity>
      <View style={s.card}>
        <View style={[s.badge, { backgroundColor: statusColor(task.status), alignSelf: 'flex-start', marginBottom: 12 }]}>
          <Text style={s.badgeText}>{statusLabel(task.status)}</Text>
        </View>
        <Text style={s.title}>{task.title}</Text>
        {task.description && <Text style={s.desc}>{task.description}</Text>}
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>Информация</Text>
        {task.project?.name && <View style={s.row}><Text style={s.label}>Проект</Text><Text style={s.value}>{task.project.name}</Text></View>}
        {task.assignee?.name && <View style={s.row}><Text style={s.label}>Исполнитель</Text><Text style={s.value}>{task.assignee.name}</Text></View>}
        {task.deadline && <View style={s.row}><Text style={s.label}>Дедлайн</Text><Text style={s.value}>{new Date(task.deadline).toLocaleDateString('ru')}</Text></View>}
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>Сменить статус</Text>
        <View style={s.statusGrid}>
          {STATUS_OPTIONS.map(st => (
            <TouchableOpacity
              key={st}
              style={[s.statusBtn, task.status === st && { backgroundColor: statusColor(st) }]}
              onPress={() => changeStatus(st)}
              disabled={updating}
            >
              <Text style={[s.statusBtnText, task.status === st && { color: '#fff' }]}>{statusLabel(st)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
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
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  title: { color: COLORS.text, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  desc: { color: COLORS.sub, fontSize: 14, marginTop: 8, lineHeight: 20 },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: COLORS.sub, fontSize: 13 },
  value: { color: COLORS.text, fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  sub: { color: COLORS.sub, fontSize: 14 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: COLORS.border },
  statusBtnText: { color: COLORS.sub, fontSize: 13, fontWeight: '500' },
});