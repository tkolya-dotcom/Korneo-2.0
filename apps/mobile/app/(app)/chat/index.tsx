import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { chatsApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

export default function ChatListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatName, setNewChatName] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const data = await chatsApi.getAll();
      setChats(data || []);
    } catch (e) {
      console.error('Ошибка загрузки чатов:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  const createChat = async () => {
    if (!newChatName.trim()) return;
    try {
      const chat = await chatsApi.createChat(newChatName.trim(), 'group');
      setShowNewChat(false);
      setNewChatName('');
      router.push({ pathname: '/(app)/chat/[id]', params: { id: chat.id } } as any);
    } catch (e) {
      console.error('Ошибка создания чата:', e);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Чат</Text>
        <TouchableOpacity onPress={() => setShowNewChat(true)}>
          <Text style={s.addIcon}>✏️</Text>
        </TouchableOpacity>
      </View>

      {showNewChat && (
        <View style={s.newChatBox}>
          <TextInput style={s.newChatInput} placeholder="Название чата" placeholderTextColor={COLORS.sub}
            value={newChatName} onChangeText={setNewChatName} autoFocus />
          <TouchableOpacity style={s.createBtn} onPress={createChat}>
            <Text style={s.createBtnText}>Создать</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowNewChat(false)}>
            <Text style={s.cancelBtn}>Отмена</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={chats}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Нет чатов</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.chatItem} onPress={() => router.push({ pathname: '/(app)/chat/[id]', params: { id: item.id } } as any)}>
            <View style={[s.avatar, item.type === 'group' && s.groupAvatar]}>
              <Text style={s.avatarText}>{getInitials(item.name)}</Text>
            </View>
            <View style={s.chatInfo}>
              <Text style={s.chatName} numberOfLines={1}>{item.name || 'Чат'}</Text>
              <Text style={s.chatType}>{item.type === 'group' ? 'Группа' : 'Личный'}</Text>
            </View>
            <Text style={s.chatTime}>{item.updated_at ? formatTime(item.updated_at) : ''}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50 },
  title: { color: COLORS.accent, fontSize: 26, fontWeight: '700' },
  addIcon: { fontSize: 24 },
  newChatBox: { flexDirection: 'row', padding: 12, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  newChatInput: { flex: 1, backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 8, padding: 10, fontSize: 14 },
  createBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginLeft: 8 },
  createBtnText: { color: COLORS.bg, fontWeight: '600' },
  cancelBtn: { color: COLORS.sub, paddingHorizontal: 12, paddingVertical: 10 },
  chatItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  groupAvatar: { backgroundColor: '#8B5CF6' },
  avatarText: { color: COLORS.bg, fontSize: 16, fontWeight: '700' },
  chatInfo: { flex: 1, marginLeft: 12 },
  chatName: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  chatType: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
  chatTime: { color: COLORS.sub, fontSize: 11 },
  empty: { color: COLORS.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
});