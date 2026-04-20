import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { materialsApi } from '@/src/lib/supabase';
import { COLORS } from '@/src/theme/colors';

export default function WarehouseScreen() {
  const { isManagerOrHigher } = useAuth();
  const router = useRouter();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isManagerOrHigher) {
      router.replace('/(app)');
      return;
    }
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const data = await materialsApi.getAll();
      setMaterials(data || []);
    } catch (e) {
      console.error('Ошибка загрузки:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMaterials();
    setRefreshing(false);
  };

  const filtered = materials.filter(m => 
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.category?.toLowerCase().includes(search.toLowerCase())
  );

  const getStockColor = (qty: number) => {
    if (qty <= 0) return COLORS.danger;
    if (qty < 10) return '#FFA500';
    return COLORS.green;
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={COLORS.accent} size="large" /></View>;
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Склад</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/warehouse/issue')}>
          <Text style={s.issueBtn}>📤 Выдать</Text>
        </TouchableOpacity>
      </View>

      <TextInput style={s.search} placeholder="Поиск..." placeholderTextColor={COLORS.sub}
        value={search} onChangeText={setSearch} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={s.empty}>Материалов нет</Text>}
        renderItem={({ item }) => (
          <View style={s.materialCard}>
            <View style={s.materialInfo}>
              <Text style={s.materialName}>{item.name}</Text>
              {item.category && <Text style={s.materialCategory}>{item.category}</Text>}
              {item.unit && <Text style={s.materialUnit}>ед: {item.unit}</Text>}
            </View>
            <View style={s.stockSection}>
              <Text style={[s.stockQty, { color: getStockColor(item.quantity) }]}>{item.quantity}</Text>
              <Text style={s.stockLabel}>остаток</Text>
            </View>
          </View>
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
  issueBtn: { color: COLORS.green, fontSize: 14, fontWeight: '600' },
  search: { backgroundColor: COLORS.card, color: COLORS.text, borderRadius: 10, margin: 16, marginTop: 0, padding:12, fontSize: 14 },
  materialCard: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 10 },
  materialInfo: { flex: 1 },
  materialName: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  materialCategory: { color: COLORS.sub, fontSize: 12, marginTop: 4 },
  materialUnit: { color: COLORS.sub, fontSize: 11, marginTop: 2 },
  stockSection: { alignItems: 'center', justifyContent: 'center' },
  stockQty: { fontSize: 24, fontWeight: '700' },
  stockLabel: { color: COLORS.sub, fontSize: 10 },
  empty: { color: COLORS.sub, textAlign: 'center', marginTop: 60, fontSize: 16 },
});