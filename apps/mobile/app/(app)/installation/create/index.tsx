import React, { useEffect, useMemo, useState } from 'react';
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
import { authApi, installationsApi, jobsApi, projectsApi } from '@/src/lib/supabase';
import { searchAddressSuggestions } from '@/src/lib/addressSearch';
import AddressSuggestionCard, {
  buildAddressSummary,
  normalizeAddressForDisplay,
} from '@/src/components/AddressSuggestionCard';

const C = {
  bg: '#0A0A0F',
  card: '#1A1A2E',
  accent: '#00D9FF',
  text: '#E0E0E0',
  sub: '#8892a0',
  border: 'rgba(0, 217, 255, 0.15)',
  danger: '#FF3366',
  green: '#00FF88',
};

type AddressItem = Record<string, any>;
type EquipmentOption = {
  key: string;
  id: string;
  name: string;
  brand?: string;
  model?: string;
  serial?: string;
  inventory?: string;
};

const getAddressEquipmentOptions = (item: AddressItem | null): EquipmentOption[] => {
  if (!item) {
    return [];
  }

  const rows = Array.isArray(item.sk_items)
    ? item.sk_items
    : Array.isArray(item.equipment_items)
      ? item.equipment_items
      : [];

  const sourceRows = rows
    .map((entry: Record<string, unknown>, index: number) => {
      const id = String(entry.id || '').trim();
      const name = String(entry.name || '').trim();
      const key = String(entry.key || `${index + 1}|${id}|${name}`).trim();
      if (!id && !name) {
        return null;
      }
      return {
        key,
        id,
        name: name || `СК ${index + 1}`,
        brand: String(entry.brand || '').trim() || undefined,
        model: String(entry.model || '').trim() || undefined,
        serial: String(entry.serial || '').trim() || undefined,
        inventory: String(entry.inventory || '').trim() || undefined,
      } as EquipmentOption;
    })
    .filter(Boolean) as EquipmentOption[];

  if (sourceRows.length === 0) {
    const fallbackName = String(item.sk_name || '').trim();
    if (fallbackName) {
      sourceRows.push({
        key: `fallback|${fallbackName}`,
        id: '',
        name: fallbackName,
      });
    }
  }

  const seen = new Set<string>();
  return sourceRows
    .filter((entry) => {
      const dedupeKey = `${entry.id}|${entry.name}`.toLowerCase().trim();
      if (!dedupeKey || seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    })
    .slice(0, 7);
};

const formatEquipmentOptionMeta = (item: EquipmentOption) =>
  [item.brand, item.model, item.serial ? `S/N ${item.serial}` : null, item.inventory ? `INV ${item.inventory}` : null]
    .filter(Boolean)
    .join(' • ');

export default function InstallationCreateScreen() {
  const { canCreateInstallations } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);

  const [address, setAddress] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<AddressItem | null>(null);
  const [selectedEquipmentKeys, setSelectedEquipmentKeys] = useState<string[]>([]);
  const [manualEquipment, setManualEquipment] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!canCreateInstallations) {
      Alert.alert(
        '\u041e\u0448\u0438\u0431\u043a\u0430',
        '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u044f \u043c\u043e\u043d\u0442\u0430\u0436\u0430'
      );
      router.back();
      return;
    }
    void loadData();
  }, [canCreateInstallations, router]);

  const loadData = async () => {
    try {
      setMetaLoading(true);
      const [projData, usersData, addressData] = await Promise.all([
        projectsApi.getAll().catch(() => []),
        authApi.getUsers().catch(() => []),
        jobsApi.getAddresses().catch(() => []),
      ]);
      setProjects(projData || []);
      setUsers(usersData || []);
      setAddresses(addressData || []);
    } catch (error) {
      console.error('Failed to load installation create data:', error);
    } finally {
      setMetaLoading(false);
    }
  };

  const filteredAddresses = useMemo(() => {
    return searchAddressSuggestions(addresses, address, 20);
  }, [address, addresses]);
  const addressEquipmentOptions = useMemo(
    () => getAddressEquipmentOptions(selectedAddress),
    [selectedAddress]
  );

  useEffect(() => {
    if (!selectedAddress) {
      setSelectedEquipmentKeys([]);
      return;
    }
    setSelectedEquipmentKeys(addressEquipmentOptions.map((option) => option.key));
    setManualEquipment([]);
  }, [selectedAddress, addressEquipmentOptions]);

  const toggleAddressEquipment = (key: string) => {
    setSelectedEquipmentKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      const currentTotal = prev.length + manualEquipment.length;
      if (currentTotal >= 7) {
        Alert.alert(
          '\u041e\u0448\u0438\u0431\u043a\u0430',
          '\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c 7 \u0435\u0434\u0438\u043d\u0438\u0446 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f'
        );
        return prev;
      }
      return [...prev, key];
    });
  };

  const addManualEquipment = () => {
    const selectedFromAddress = selectedEquipmentKeys.length;
    if (selectedFromAddress + manualEquipment.length >= 7) {
      Alert.alert(
        '\u041e\u0448\u0438\u0431\u043a\u0430',
        '\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c 7 \u0435\u0434\u0438\u043d\u0438\u0446 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f'
      );
      return;
    }
    setManualEquipment((prev) => [...prev, { id: '', name: '' }]);
  };

  const updateManualEquipment = (index: number, field: 'id' | 'name', value: string) => {
    setManualEquipment((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeManualEquipment = (index: number) => {
    setManualEquipment((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const normalizedAddress = normalizeAddressForDisplay(address);
    if (!normalizedAddress) {
      Alert.alert('\u041e\u0448\u0438\u0431\u043a\u0430', '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441');
      return;
    }

    setLoading(true);
    try {
      const selectedFromAddress = addressEquipmentOptions
        .filter((option) => selectedEquipmentKeys.includes(option.key))
        .map((option) => ({
          id: option.id.trim(),
          name: option.name.trim(),
          brand: option.brand,
          model: option.model,
          serial: option.serial,
          inventory: option.inventory,
        }));
      const selectedManual = manualEquipment
        .map((item) => ({
          id: item.id.trim(),
          name: item.name.trim(),
          brand: undefined,
          model: undefined,
          serial: undefined,
          inventory: undefined,
        }))
        .filter((item) => item.id || item.name);

      const dedupe = new Set<string>();
      const equipment = [...selectedFromAddress, ...selectedManual]
        .filter((item) => item.id || item.name)
        .filter((item) => {
          const key = `${item.id}|${item.name}`.toLowerCase().trim();
          if (!key || dedupe.has(key)) {
            return false;
          }
          dedupe.add(key);
          return true;
        })
        .slice(0, 7);

      const payload: Record<string, unknown> = {
        address: normalizedAddress,
        project_id: projectId || null,
        assignee_id: assigneeId || null,
        planned_date: plannedDate || null,
        description: description.trim() || null,
        status: 'new',
      };

      equipment.forEach((eq, i) => {
        const suffix = i === 0 ? '' : String(i + 1);
        if (eq.id) payload[`id_sk${suffix}`] = eq.id;
        if (eq.name) payload[`naimenovanie_sk${suffix}`] = eq.name;
        if (eq.brand) payload[`marka_sk${suffix}`] = eq.brand;
        if (eq.model) payload[`model_sk${suffix}`] = eq.model;
        if (eq.serial) payload[`seriynyy_nomer${suffix}`] = eq.serial;
        if (eq.inventory) payload[`inventarnyy_nomer${suffix}`] = eq.inventory;
      });

      await installationsApi.create(payload);
      Alert.alert(
        '\u0423\u0441\u043f\u0435\u0445',
        '\u041c\u043e\u043d\u0442\u0430\u0436 \u0441\u043e\u0437\u0434\u0430\u043d',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(
        '\u041e\u0448\u0438\u0431\u043a\u0430',
        error?.message ||
          '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043c\u043e\u043d\u0442\u0430\u0436'
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedSummary = buildAddressSummary(selectedAddress);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>{'\u2190 \u041d\u0430\u0437\u0430\u0434'}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{'\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043c\u043e\u043d\u0442\u0430\u0436'}</Text>
      </View>

      <View style={s.form}>
        <Text style={s.label}>{'\u0410\u0434\u0440\u0435\u0441 *'}</Text>
        <TextInput
          style={s.input}
          placeholder={
            '\u041f\u043e\u0438\u0441\u043a \u0430\u0434\u0440\u0435\u0441\u0430 \u0438\u0437 \u0431\u0430\u0437\u044b \u0410\u0422\u0421\u0421/\u041a\u0410\u0421\u0418\u041f'
          }
          placeholderTextColor={C.sub}
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            if (
              selectedAddress &&
              normalizeAddressForDisplay(value) !==
                normalizeAddressForDisplay(String(selectedAddress.address || ''))
            ) {
              setSelectedAddress(null);
            }
          }}
        />

        {metaLoading ? (
          <View style={s.addressLoading}>
            <ActivityIndicator color={C.accent} />
          </View>
        ) : filteredAddresses.length > 0 ? (
          <View style={s.addressList}>
            {filteredAddresses.map((item) => (
              <AddressSuggestionCard
                key={`${item.source}:${item.source_id}`}
                item={item}
                onPress={() => {
                  const nextAddress = normalizeAddressForDisplay(String(item.address || ''));
                  setAddress(nextAddress);
                  setSelectedAddress(item);
                }}
                actionLabel={'\u0412\u044b\u0431\u0440\u0430\u0442\u044c'}
              />
            ))}
          </View>
        ) : null}

        {selectedAddress ? (
          <View style={s.selectedHint}>
            <Text style={s.selectedHintText}>{`\u0412\u044b\u0431\u0440\u0430\u043d\u043e: ${
              selectedSummary.address || '\u0430\u0434\u0440\u0435\u0441 \u0438\u0437 \u0431\u0430\u0437\u044b'
            }`}</Text>
            {selectedSummary.meta ? <Text style={s.selectedHintSub}>{selectedSummary.meta}</Text> : null}
          </View>
        ) : null}

        <Text style={s.label}>{'\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435'}</Text>
        <TextInput
          style={[s.input, s.textarea]}
          placeholder={'\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0440\u0430\u0431\u043e\u0442'}
          placeholderTextColor={C.sub}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={s.label}>{'\u041f\u0440\u043e\u0435\u043a\u0442'}</Text>
        <View style={s.selectWrap}>
          <TouchableOpacity
            style={s.select}
            onPress={() => {
              Alert.alert(
                '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u043e\u0435\u043a\u0442',
                '',
                [
                  ...projects.map((p) => ({ text: p.name, onPress: () => setProjectId(String(p.id)) })),
                  { text: '\u041e\u0442\u043c\u0435\u043d\u0430', style: 'cancel' as const },
                ]
              );
            }}
          >
            <Text style={s.selectText}>
              {projects.find((p) => String(p.id) === projectId)?.name ||
                '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u043e\u0435\u043a\u0442'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>{'\u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439'}</Text>
        <View style={s.selectWrap}>
          <TouchableOpacity
            style={s.select}
            onPress={() => {
              Alert.alert(
                '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e',
                '',
                [
                  ...users.map((u) => ({ text: u.name || u.email, onPress: () => setAssigneeId(String(u.id)) })),
                  { text: '\u041e\u0442\u043c\u0435\u043d\u0430', style: 'cancel' as const },
                ]
              );
            }}
          >
            <Text style={s.selectText}>
              {users.find((u) => String(u.id) === assigneeId)?.name ||
                '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>{'\u041f\u043b\u0430\u043d\u043e\u0432\u0430\u044f \u0434\u0430\u0442\u0430'}</Text>
        <TextInput
          style={s.input}
          placeholder={'YYYY-MM-DD'}
          placeholderTextColor={C.sub}
          value={plannedDate}
          onChangeText={setPlannedDate}
        />

        <View style={s.sectionHeader}>
          <Text style={s.label}>{'\u041e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435 (\u0421\u041a)'}</Text>
          <TouchableOpacity onPress={addManualEquipment}>
            <Text style={s.addBtn}>{`+ \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0435\u0449\u0435 (${selectedEquipmentKeys.length + manualEquipment.length}/7)`}</Text>
          </TouchableOpacity>
        </View>

        {addressEquipmentOptions.length > 0 ? (
          <View style={s.equipmentSourceCard}>
            <Text style={s.equipmentSourceTitle}>
              {'\u041e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435 \u0438\u0437 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u0430\u0434\u0440\u0435\u0441\u0430'}
            </Text>
            {addressEquipmentOptions.map((option) => {
              const checked = selectedEquipmentKeys.includes(option.key);
              const optionMeta = formatEquipmentOptionMeta(option);
              return (
                <TouchableOpacity
                  key={option.key}
                  style={s.checkboxRow}
                  onPress={() => toggleAddressEquipment(option.key)}
                >
                  <View style={[s.checkbox, checked && s.checkboxChecked]}>
                    <Text style={s.checkboxMark}>{checked ? '✓' : ''}</Text>
                  </View>
                  <View style={s.checkboxTextWrap}>
                    <Text style={s.checkboxTitle} numberOfLines={2}>
                      {option.name}
                      {option.id ? ` (ID ${option.id})` : ''}
                    </Text>
                    {optionMeta ? (
                      <Text style={s.checkboxMeta} numberOfLines={2}>
                        {optionMeta}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={s.noEquipmentHint}>
            {'\u041f\u043e \u0430\u0434\u0440\u0435\u0441\u0443 \u0441\u043f\u0438\u0441\u043e\u043a \u0421\u041a \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d. \u041c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432\u0440\u0443\u0447\u043d\u0443\u044e.'}
          </Text>
        )}

        {manualEquipment.map((eq, index) => (
          <View key={`${index}-${eq.id}-${eq.name}`} style={s.equipmentRow}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              placeholder={`ID \u0421\u041a ${index + 1}`}
              placeholderTextColor={C.sub}
              value={eq.id}
              onChangeText={(v) => updateManualEquipment(index, 'id', v)}
            />
            <TextInput
              style={[s.input, { flex: 2, marginBottom: 0 }]}
              placeholder={'\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435'}
              placeholderTextColor={C.sub}
              value={eq.name}
              onChangeText={(v) => updateManualEquipment(index, 'name', v)}
            />
            <TouchableOpacity onPress={() => removeManualEquipment(index)} style={s.removeBtn}>
              <Text style={s.removeBtnText}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={s.btnText}>{'\u0421\u041e\u0417\u0414\u0410\u0422\u042c \u041c\u041e\u041d\u0422\u0410\u0416'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 50 },
  backBtn: { color: C.accent, fontSize: 16 },
  title: { color: C.accent, fontSize: 22, fontWeight: '700', marginLeft: 20 },
  form: { padding: 20 },
  label: { color: C.accent, fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5 },
  input: {
    backgroundColor: C.card,
    color: C.text,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  selectWrap: { marginBottom: 16 },
  select: { backgroundColor: C.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border },
  selectText: { color: C.text, fontSize: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  addBtn: { color: C.green, fontSize: 13, fontWeight: '600' },
  equipmentSourceCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    marginBottom: 12,
    paddingVertical: 6,
  },
  equipmentSourceTitle: {
    color: C.sub,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    borderColor: C.accent,
    backgroundColor: 'rgba(0,217,255,0.18)',
  },
  checkboxMark: {
    color: C.accent,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  checkboxTextWrap: { flex: 1 },
  checkboxTitle: { color: C.text, fontSize: 13, fontWeight: '600' },
  checkboxMeta: { color: C.sub, fontSize: 11, marginTop: 3 },
  noEquipmentHint: {
    color: C.sub,
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 18,
  },
  equipmentRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  removeBtn: { padding: 10 },
  removeBtnText: { color: C.danger, fontSize: 16 },
  addressLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 36,
  },
  addressList: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: C.card,
  },
  selectedHint: {
    marginBottom: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(0,217,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedHintText: { color: C.accent, fontSize: 12, fontWeight: '600' },
  selectedHintSub: { color: C.sub, fontSize: 11, marginTop: 4 },
  btn: { backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: C.bg, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
});
