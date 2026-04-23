import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { avrApi } from '@/src/lib/supabase';

const C = {
  bg: '#0A0A0F',
  card: '#1A1A2E',
  accent: '#00D9FF',
  text: '#E0E0E0',
  sub: '#8892a0',
  border: 'rgba(0, 217, 255, 0.15)',
  success: '#00FF88',
};

const TYPES = [
  { id: 'AVR', label: 'АВР' },
  { id: 'NRD', label: 'НРД' },
  { id: 'TECH_TASK', label: 'Тех. задача' },
] as const;

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function AvrCreateScreen() {
  const router = useRouter();
  const { isManagerOrHigher } = useAuth();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]['id']>('AVR');
  const [description, setDescription] = useState('');
  const [addressText, setAddressText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      Alert.alert('Проверьте данные', 'Введите название заявки');
      return;
    }

    try {
      setSaving(true);
      const created = await avrApi.create({
        title: normalizedTitle,
        type,
        description: description.trim() || null,
        address_text: addressText.trim() || null,
        date_from: dateFrom.trim() || null,
        date_to: dateTo.trim() || null,
      });

      Alert.alert('Готово', 'Заявка создана');
      router.replace({
        pathname: '/(app)/avr/[id]',
        params: { id: String((created as any).id) },
      } as any);
    } catch (error) {
      Alert.alert('Ошибка', errorText(error, 'Не удалось создать заявку'));
    } finally {
      setSaving(false);
    }
  };

  if (!isManagerOrHigher) {
    return (
      <View style={s.center}>
        <Text style={s.denied}>Недостаточно прав для создания АВР</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Новая заявка АВР / НРД</Text>

      <Text style={s.label}>Тип заявки</Text>
      <View style={s.typeRow}>
        {TYPES.map((item) => {
          const active = type === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[s.typeChip, active && s.typeChipActive]}
              onPress={() => setType(item.id)}
            >
              <Text style={[s.typeText, active && s.typeTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.label}>Название *</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={s.input}
        placeholder="Например: Монтаж узла связи"
        placeholderTextColor={C.sub}
      />

      <Text style={s.label}>Адрес / площадка</Text>
      <TextInput
        value={addressText}
        onChangeText={setAddressText}
        style={s.input}
        placeholder="Адрес или описание площадки"
        placeholderTextColor={C.sub}
      />

      <Text style={s.label}>Дата начала</Text>
      <TextInput
        value={dateFrom}
        onChangeText={setDateFrom}
        style={s.input}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={C.sub}
      />

      <Text style={s.label}>Дата окончания</Text>
      <TextInput
        value={dateTo}
        onChangeText={setDateTo}
        style={s.input}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={C.sub}
      />

      <Text style={s.label}>Описание</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[s.input, s.multiline]}
        placeholder="Подробности заявки"
        placeholderTextColor={C.sub}
        multiline
      />

      <TouchableOpacity style={[s.submitBtn, saving && s.submitDisabled]} onPress={() => void create()} disabled={saving}>
        {saving ? <ActivityIndicator color="#04120d" /> : <Text style={s.submitText}>Создать заявку</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingTop: 22, paddingBottom: 30 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  denied: { color: C.sub, fontSize: 15, textAlign: 'center' },
  title: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 14 },
  label: { color: C.sub, fontSize: 12, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  typeChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipActive: { borderColor: C.accent, backgroundColor: 'rgba(0,217,255,0.15)' },
  typeText: { color: C.sub, fontSize: 12, fontWeight: '600' },
  typeTextActive: { color: C.accent },
  submitBtn: {
    marginTop: 18,
    backgroundColor: C.success,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 46,
  },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: '#04120d', fontSize: 14, fontWeight: '700' },
});
