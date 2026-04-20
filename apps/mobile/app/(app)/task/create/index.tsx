import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { tasksApi, projectsApi, authApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новая', color: '#3399ff' },
  { value: 'in_progress', label: 'В работе', color: '#00D9FF' },
  { value: 'on_hold', label: 'На паузе', color: '#ff00cc' },
  { value: 'completed', label: 'Готова', color: '#00FF88' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Низкий' },
  { value: 'normal', label: 'Обычный' },
  { value: 'high', label: 'Высокий' },
  { value: 'urgent', label: 'Срочный' },
];

export default function TaskCreateScreen() {
  const { user, canCreateTasks } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('normal');
  const [address, setAddress] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!canCreateTasks) {
      Alert.alert('Ошибка', 'Недостаточно прав для создания задач');
      router.back();
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projData, usersData] = await Promise.all([
        projectsApi.getAll(),
        authApi.getUsers()
      ]);
      setProjects(projData || []);
      setUsers(usersData || []);
    } catch (e) {
      console.error('Ошибка загрузки:', e);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Введите название задачи');
      return;
    }

    setLoading(true);
    try {
      const task = {
        title: title.trim(),
        description: description.trim(),
        project_id: projectId || null,
        assignee_id: assigneeId || null,
        priority,
        address: address.trim(),
        due_date: dueDate || null,
        status: 'new',
      };
      
      await tasksApi.create(task);
      Alert.alert('Успех', 'Задача создана', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать задачу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>← Назад</Text>
        </TouchableOpacity>
        <Text style={s.title}>Создать задачу</Text>
      </View>

      <View style={s.form}>
        <Text style={s.label}>Название *</Text>
        <TextInput style={s.input} placeholder="Введите название" placeholderTextColor={COLORS.sub}
          value={title} onChangeText={setTitle} />

        <Text style={s.label}>Описание</Text>
        <TextInput style={[s.input, s.textarea]} placeholder="Описание задачи" placeholderTextColor={COLORS.sub}
          value={description} onChangeText={setDescription} multiline numberOfLines={4} />

        <Text style={s.label}>Проект</Text>
        <View style={s.selectWrap}>
          <TouchableOpacity style={s.select} onPress={() => {
            Alert.alert('Выберите проект', '', [
              ...projects.map(p => ({ text: p.name, onPress: () => setProjectId(p.id) })),
              { text: 'Отмена', style: 'cancel' }
            ]);
          }}>
            <Text style={s.selectText}>{projects.find(p => p.id === projectId)?.name || 'Выберите проект'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Исполнитель</Text>
        <View style={s.selectWrap}>
          <TouchableOpacity style={s.select} onPress={() => {
            Alert.alert('Выберите исполнителя', '', [
              ...users.map(u => ({ text: u.name || u.email, onPress: () => setAssigneeId(u.id) })),
              { text: 'Отмена', style: 'cancel' }
            ]);
          }}>
            <Text style={s.selectText}>{users.find(u => u.id === assigneeId)?.name || users.find(u => u.id === assigneeId)?.email || 'Выберите исполнителя'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Приоритет</Text>
        <View style={s.optionsRow}>
          {PRIORITY_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.value} style={[s.option, priority === opt.value && s.optionActive]}
              onPress={() => setPriority(opt.value)}>
              <Text style={[s.optionText, priority === opt.value && s.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Адрес</Text>
        <TextInput style={s.input} placeholder="Адрес выполнения" placeholderTextColor={COLORS.sub}
          value={address} onChangeText={setAddress} />

        <Text style={s.label}>Дедлайн</Text>
        <TextInput style={s.input} placeholder="ГГГГ-ММ-ДД" placeholderTextColor={COLORS.sub}
          value={dueDate} onChangeText={setDueDate} />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.btnText}>СОЗДАТЬ ЗАДАЧУ</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50 },
  backBtn: { color: COLORS.accent, fontSize: 16 },
  title: { color: COLORS.accent, fontSize: 22, fontWeight: '700', marginLeft: 20 },
  form: { padding: 20 },
  label: { color: COLORS.accent, fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 15, borderWidth: 1, borderColor: COLORS.border },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  selectWrap: { marginBottom: 16 },
  select: { backgroundColor: COLORS.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  selectText: { color: COLORS.text, fontSize: 15 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  option: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  optionActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(0, 217, 255, 0.1)' },
  optionText: { color: COLORS.sub, fontSize: 13 },
  optionTextActive: { color: COLORS.accent },
  btn: { backgroundColor: COLORS.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.bg, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
});