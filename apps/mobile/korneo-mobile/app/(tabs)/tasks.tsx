import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../../src/config/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { TaskStatus, Task } from '../../../../packages/domain/types';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all');
  const { session } = useAuth();

  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (session?.role === 'worker') {
        query = query.eq('assignee_id', session.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Tasks error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TouchableOpacity className="bg-gradient-card p-4 mb-3 rounded-xl border border-border shadow-card hover:shadow-glow-cyan">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-lg font-orbitron text-accent font-semibold">
          #{item.short_id} {item.title}
        </Text>
        <View className={`status status-${item.status}`}>
          {item.status === 'new' && 'NEW'}
          {item.status === 'in_progress' && 'В РАБОТЕ'}
          {item.status === 'done' && 'СДЕЛАНО'}
        </View>
      </View>
      <Text className="text-text-muted text-sm">
        {new Date(item.created_at).toLocaleDateString('ru-RU')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-primary p-6">
      <Text className="text-2xl font-orbitron text-accent mb-6">Задачи</Text>

      {/* Filter */}
      <View className="flex-row space-x-2 mb-6">
        {(['all', 'new', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
          <TouchableOpacity
            key={status}
            className={`px-4 py-2 rounded-full ${statusFilter === status ? 'bg-accent text-primary' : 'bg-secondary text-accent'}`}
            onPress={() => setStatusFilter(status)}
          >
            <Text className="font-semibold text-sm">
              {status === 'all' ? 'Все' : status.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#00D9FF" />
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

