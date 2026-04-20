import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { tasksAvrApi, authApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

const STATUS_COLORS: Record<string, string> = {
  new: '#3399ff',
  in_progress: '#00D9FF',
  completed: '#00FF88',
  on_hold: '#ff00cc',
};

export default function AVRScreen() {
  const { canCreateTasks } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  
  // Форма создания
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [oldEquipment, setOldEquipment] = useState('');
  const [newEquipment, setNewEquipment] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await tasksAvrApi.getAll();
      setTasks(data || []);
    } catch (e) {
      console.error('Ошибка загрузки:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await authApi.getUsers();
      setUsers(data || []);
    } catch (e) {
      console.error('Ошибка загрузки пользователей:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!address.trim()) {
      Alert.alert('Ошибка', 'Введите адрес');
      return;
    }
    try {
      await tasksAvrApi.create({
        address: address.trim(),
        description: description.trim(),
        old_equipment: oldEquipment.trim(),
        new_equipment: newEquipment.trim(),
        reason: reason.trim(),
        status: 'new',
      });
      Alert.alert('Успех', 'Задача АВР создана');
      setShowCreate(false);
      setAddress(''); setDescription(''); setOldEquipment(''); setNewEquipment(''); setReason('');
      loadTasks();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>АВР</Text>
        {canCreateTasks && (
          <TouchableOpacity onPress={() => setShowCreate(!showCreate)}>
            <Text style={s.addBtn}>+ Создать</Text>
          </TouchableOpacity>
        )}
      </View>

      {showCreate && (
        <View style={s.createForm}>
          <Text style={s.formTitle}>Новая задача АВР</Text>
          <TextInput style={s.input} placeholder="Адрес *" placeholderTextColor={COLORS.sub} value={address} onChangeText={setAddress} />
          <TextInput style={s.input} placeholder="Описание" placeholderTextColor={COLORS.sub} value={description} onChangeText={setDescription} />
          <TextInput style={s.input} placeholder="Старое оборудование" placeholderTextColor={COLORS.sub} value={oldEquipment} onChangeText={setOldEquipment} />
          <TextInput style={s.input} placeholder="Новое оборудование" placeholderTextColor={COLORS.sub} value={newEquipment} onChangeText={setNewEquipment} />
          <TextInput style={s.input} placeholder="Причина замены" placeholderTextColor={COLORS.sub} value={reason} onChangeText={setReason} />
          <View style={s.formBtns}>
            <TouchableOpacity style={s.submitBtn} onPress={handleCreate}>
              <Text style={s.submitBtnText}>Создать</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={s.cancelBtn}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={tasks}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Задач АВР нет</Text>}
        renderItem={({ item }) => (
          <View style={s.taskCard}>
            <View style={s.taskHeader}>
              <Text style={s.taskId}>{item.short_id || item.id?.slice(0, 8)}</Text>
              <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || COLORS.sub }]}>
                <Text style={s.statusText}>{item.status}</Text>
              </View>
            </View>
            <Text style={s.taskAddress}>{item.address}</Text>
            {item.description && <Text style={s.taskDesc}>{item.description}</Text>}
            {item.old_equipment && <Text style={s.equip}>↓ {item.old_equipment}</Text>}
            {item.new_equipment && <Text style={s.equip}>↑ {item.new_equipment}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent:'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  title: { color: COLORS.accent, fontSize: 26, fontWeight: '700' },
  addBtn: { color: COLORS.green, fontSize: 14, fontWeight: '600' },
  createForm: { backgroundColor: COLORS.card, padding: 16, margin: 16, borderRadius: 12 },
  formTitle: { color: COLORS.accent, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  formBtns: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  submitBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  submitBtnText: { color: COLORS.bg, fontWeight: '700' },
  cancelBtn: { color: COLORS.sub, marginLeft: 16 },
  taskCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: COLORS.orange },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  taskId: { color: COLORS.orange, fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  taskAddress: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  taskDesc: { color: COLORS.sub, fontSize: 13, marginTop: 4 },
  equip: { color: COLORS.sub, fontSize: 12, marginTop: 2, fontFamily: 'monospace' },
  empty: { color: COLORS.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
});