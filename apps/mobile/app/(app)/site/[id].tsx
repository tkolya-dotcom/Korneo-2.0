import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/providers/AuthProvider';
import { sitesApi } from '@/src/lib/supabase';

const C = {
  bg: '#0A0A0F',
  card: '#1A1A2E',
  accent: '#00D9FF',
  text: '#E0E0E0',
  sub: '#8892A0',
  border: 'rgba(0, 217, 255, 0.15)',
  ok: '#00D9FF',
  warn: '#F59E0B',
  danger: '#EF4444',
};

const RU = {
  siteNotFound: '\u041f\u043b\u043e\u0449\u0430\u0434\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430',
  unknownSite: '\u041f\u043b\u043e\u0449\u0430\u0434\u043a\u0430',
  noData: '\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445',
  emptyDash: '\u2014',
  status: '\u0421\u0442\u0430\u0442\u0443\u0441',
  id: 'ID',
  mainInfo: '\u041e\u0441\u043d\u043e\u0432\u043d\u0430\u044f \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f',
  type: '\u0422\u0438\u043f',
  segment: '\u0421\u0435\u0433\u043c\u0435\u043d\u0442',
  district: '\u0420\u0430\u0439\u043e\u043d',
  connection: '\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435',
  commissioned: '\u0412\u0432\u043e\u0434 \u0432 \u044d\u043a\u0441\u043f\u043b.',
  synced: '\u0421\u0438\u043d\u0445\u0440\u043e\u043d\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043d\u043e',
  heat: '\u0422\u0435\u043f\u043b\u043e\u0432\u044b\u0434\u0435\u043b\u0435\u043d\u0438\u0435',
  contacts: '\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b',
  cabinets: '\u0428\u043a\u0430\u0444\u044b',
  equipmentPower: '\u041e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435 (\u0442\u0435\u043f\u043b\u043e)',
  airConditioners: '\u041a\u043e\u043d\u0434\u0438\u0446\u0438\u043e\u043d\u0435\u0440\u044b',
  floor: '\u042d\u0442\u0430\u0436',
  room: '\u041f\u043e\u043c\u0435\u0449\u0435\u043d\u0438\u0435',
  powerLegend:
    '\ud83d\udfe2 bi.sats.spb.ru   \ud83d\udd35 \u0438\u043d\u0442\u0435\u0440\u043d\u0435\u0442   \ud83d\udfe1 \u0432\u0440\u0443\u0447\u043d\u0443\u044e   \u2014 \u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445',
  setPower: '\u002b \u0443\u043a\u0430\u0437\u0430\u0442\u044c',
  setPowerTitle: '\u0423\u043a\u0430\u0437\u0430\u0442\u044c \u043c\u043e\u0449\u043d\u043e\u0441\u0442\u044c',
  setPowerHint:
    '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0431\u0443\u0434\u0435\u0442 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u043e \u043a\u043e \u0432\u0441\u0435\u043c \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430\u043c \u0441 \u044d\u0442\u043e\u0439 \u043c\u043e\u0434\u0435\u043b\u044c\u044e.',
  powerWatts: '\u041c\u043e\u0449\u043d\u043e\u0441\u0442\u044c, \u0412\u0442',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  saved: '\u0413\u043e\u0442\u043e\u0432\u043e',
  savedBody: '\u041c\u043e\u0449\u043d\u043e\u0441\u0442\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430',
  powerInvalid:
    '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u043c\u043e\u0449\u043d\u043e\u0441\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 0',
};

const asArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const toMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const formatDate = (value?: string | null) => {
  if (!value) return RU.emptyDash;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU');
};

const formatDateTime = (value?: string | null) => {
  if (!value) return RU.emptyDash;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPowerSourceMarker = (source: string | null | undefined) => {
  if (source === 'sats') return { icon: '\ud83d\udfe2', color: C.ok, label: 'bi.sats.spb.ru' };
  if (source === 'web') return { icon: '\ud83d\udd35', color: '#3B82F6', label: 'web' };
  if (source === 'manual') return { icon: '\ud83d\udfe1', color: C.warn, label: 'manual' };
  return { icon: '', color: C.sub, label: RU.noData };
};

export default function SiteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isManagerOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState<{ site: any; equipment: any[]; heat: any } | null>(null);

  const [manualVisible, setManualVisible] = useState(false);
  const [manualModel, setManualModel] = useState('');
  const [manualWatts, setManualWatts] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await sitesApi.getById(id);
      setPayload(data);
    } catch (error) {
      console.error('Failed to load site detail:', error);
      setPayload(null);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const contacts = useMemo(() => asArray(payload?.site?.contacts), [payload?.site?.contacts]);
  const cabinets = useMemo(() => asArray(payload?.site?.cabinets), [payload?.site?.cabinets]);
  const powerEquipment = useMemo(
    () => (payload?.equipment || []).filter((item) => item.device_category !== 'ac'),
    [payload?.equipment]
  );
  const acEquipment = useMemo(
    () => (payload?.equipment || []).filter((item) => item.device_category === 'ac'),
    [payload?.equipment]
  );

  const openManualPower = (model: string | null | undefined) => {
    const normalized = String(model || '').trim();
    if (!normalized) {
      Alert.alert('\u041e\u0448\u0438\u0431\u043a\u0430', '\u0414\u043b\u044f \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430 \u043c\u043e\u0434\u0435\u043b\u044c');
      return;
    }
    setManualModel(normalized);
    setManualWatts('');
    setManualVisible(true);
  };

  const saveManualPower = async () => {
    if (manualSaving) return;
    const value = Number.parseFloat(manualWatts.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('\u041e\u0448\u0438\u0431\u043a\u0430', RU.powerInvalid);
      return;
    }

    try {
      setManualSaving(true);
      await sitesApi.setManualPower(manualModel, value);
      setManualVisible(false);
      Alert.alert(RU.saved, RU.savedBody);
      await load();
    } catch (error) {
      Alert.alert('\u041e\u0448\u0438\u0431\u043a\u0430', toMessage(error, RU.noData));
    } finally {
      setManualSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  if (!payload?.site) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>{RU.siteNotFound}</Text>
      </View>
    );
  }

  const { site, heat } = payload;
  const statusValue = site.status || RU.emptyDash;
  const statusColor =
    String(statusValue).toLowerCase().includes('\u0430\u043a\u0442\u0438\u0432') ||
    String(statusValue).toLowerCase().includes('active')
      ? C.ok
      : C.sub;

  return (
    <>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 26 }}
      >
        <View style={s.card}>
          <View style={s.rowTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>
                {site.emts_code ? `[${site.emts_code}] ` : ''}
                {site.address || site.name || RU.unknownSite}
              </Text>
              <Text style={s.meta}>
                {RU.id}: {site.emts_id || RU.emptyDash}
              </Text>
            </View>
            <Text style={[s.statusBadge, { color: statusColor, borderColor: statusColor }]}>
              {statusValue}
            </Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{RU.mainInfo}</Text>
          <View style={s.grid}>
            <View style={s.gridCell}>
              <Text style={s.gridLabel}>{RU.type}</Text>
              <Text style={s.gridValue}>{site.type || RU.emptyDash}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.gridLabel}>{RU.segment}</Text>
              <Text style={s.gridValue}>{site.segment || RU.emptyDash}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.gridLabel}>{RU.status}</Text>
              <Text style={s.gridValue}>{statusValue}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.gridLabel}>{RU.district}</Text>
              <Text style={s.gridValue}>{site.district || RU.emptyDash}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.gridLabel}>{RU.connection}</Text>
              <Text style={s.gridValue}>{site.connection_type || RU.emptyDash}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.gridLabel}>{RU.commissioned}</Text>
              <Text style={s.gridValue}>{formatDate(site.commissioned_at)}</Text>
            </View>
          </View>
          <Text style={s.metaTiny}>
            {RU.synced}: {formatDateTime(site.synced_at)}
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{RU.heat}</Text>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statValue}>{heat?.total_power_watts ?? 0}</Text>
              <Text style={s.statLabel}>\u0412\u0442</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{heat?.heat_kw ?? 0}</Text>
              <Text style={s.statLabel}>\u043a\u0412\u0442</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statValue}>{heat?.heat_kcal_per_hour ?? 0}</Text>
              <Text style={s.statLabel}>\u043a\u043a\u0430\u043b/\u0447</Text>
            </View>
          </View>
          <Text style={s.metaTiny}>{RU.powerLegend}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{RU.contacts}</Text>
          {contacts.length === 0 ? (
            <Text style={s.meta}>{RU.noData}</Text>
          ) : (
            contacts.map((contact, index) => (
              <View key={`contact-${index}`} style={s.row}>
                <Text style={s.itemTitle}>{contact.phone || RU.emptyDash}</Text>
                <Text style={s.itemSub}>{contact.name || RU.emptyDash}</Text>
              </View>
            ))
          )}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{RU.cabinets}</Text>
          {cabinets.length === 0 ? (
            <Text style={s.meta}>{RU.noData}</Text>
          ) : (
            cabinets.map((cabinet, index) => (
              <View key={`cabinet-${index}`} style={s.row}>
                <Text style={s.itemTitle}>{cabinet.name || '\u0428\u043a\u0430\u0444'}</Text>
                <Text style={s.itemSub}>
                  {RU.floor} {cabinet.floor || RU.emptyDash} {'\u2022'} {RU.room} {cabinet.room || RU.emptyDash}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{RU.equipmentPower}</Text>
          {powerEquipment.length === 0 ? (
            <Text style={s.meta}>{RU.noData}</Text>
          ) : (
            powerEquipment.map((item) => {
              const watts =
                typeof item.effective_power_watts === 'number'
                  ? item.effective_power_watts
                  : typeof item.power_watts === 'number'
                    ? item.power_watts
                    : null;
              const source = getPowerSourceMarker(item.power_source);
              const canSetManual = isManagerOrHigher && !watts && item.model;

              return (
                <View key={item.id} style={s.row}>
                  <Text style={s.itemTitle}>{item.name || item.model || '\u0423\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u043e'}</Text>
                  <Text style={s.itemSub}>
                    {item.model || RU.emptyDash} {'\u2022'} {item.device_type || RU.emptyDash}
                  </Text>
                  <View style={s.powerRow}>
                    {watts ? (
                      <>
                        <Text style={s.powerValue}>
                          {watts} \u0412\u0442 {source.icon}
                        </Text>
                        <Text style={[s.sourceHint, { color: source.color }]}>{source.label}</Text>
                      </>
                    ) : canSetManual ? (
                      <TouchableOpacity style={s.manualBtn} onPress={() => openManualPower(item.model)}>
                        <Text style={s.manualBtnText}>{RU.setPower}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={s.sourceHint}>{RU.noData}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>
            {RU.airConditioners} ({acEquipment.length})
          </Text>
          {acEquipment.length === 0 ? (
            <Text style={s.meta}>{RU.noData}</Text>
          ) : (
            acEquipment.map((item) => (
              <View key={item.id} style={s.row}>
                <Text style={s.itemTitle}>{item.name || item.model || '\u041a\u043e\u043d\u0434\u0438\u0446\u0438\u043e\u043d\u0435\u0440'}</Text>
                <Text style={s.itemSub}>
                  {item.model || RU.emptyDash} {'\u2022'} {item.serial_number || RU.emptyDash}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={manualVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualVisible(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>{RU.setPowerTitle}</Text>
            <Text style={s.modalModel}>{manualModel || RU.emptyDash}</Text>
            <Text style={s.modalHint}>{RU.setPowerHint}</Text>
            <Text style={s.modalLabel}>{RU.powerWatts}</Text>
            <TextInput
              style={s.modalInput}
              value={manualWatts}
              onChangeText={setManualWatts}
              keyboardType="decimal-pad"
              placeholder="43"
              placeholderTextColor={C.sub}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setManualVisible(false)}>
                <Text style={s.modalBtnGhostText}>{RU.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, manualSaving && s.modalBtnDisabled]}
                onPress={() => {
                  void saveManualPower();
                }}
                disabled={manualSaving}
              >
                <Text style={s.modalBtnPrimaryText}>{manualSaving ? '\u2026' : RU.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  empty: { color: C.sub, fontSize: 16 },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 10,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { color: C.text, fontSize: 17, fontWeight: '700' },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 120,
    textAlign: 'center',
  },
  meta: { color: C.sub, fontSize: 12, marginTop: 6 },
  metaTiny: { color: C.sub, fontSize: 11, marginTop: 10 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  gridCell: { width: '50%', paddingHorizontal: 4, marginBottom: 8 },
  gridLabel: { color: C.sub, fontSize: 10, textTransform: 'uppercase' },
  gridValue: { color: C.text, fontSize: 13, marginTop: 3, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(0,217,255,0.08)',
    padding: 10,
    alignItems: 'center',
  },
  statValue: { color: C.accent, fontSize: 18, fontWeight: '700' },
  statLabel: { color: C.sub, fontSize: 11, marginTop: 2 },
  row: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    marginTop: 8,
  },
  itemTitle: { color: C.text, fontSize: 13, fontWeight: '600' },
  itemSub: { color: C.sub, fontSize: 11, marginTop: 3 },
  powerRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  powerValue: { color: C.accent, fontSize: 12, fontWeight: '700' },
  sourceHint: { color: C.sub, fontSize: 10 },
  manualBtn: {
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  manualBtnText: { color: C.warn, fontSize: 11, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  modalTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  modalModel: { color: C.accent, fontSize: 13, marginTop: 6, fontWeight: '600' },
  modalHint: { color: C.sub, fontSize: 12, marginTop: 8, lineHeight: 18 },
  modalLabel: { color: C.sub, fontSize: 11, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: 'rgba(0,217,255,0.08)',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'transparent',
  },
  modalBtnPrimary: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(0,217,255,0.15)',
  },
  modalBtnDisabled: { opacity: 0.7 },
  modalBtnGhostText: { color: C.sub, fontSize: 13, fontWeight: '700' },
  modalBtnPrimaryText: { color: C.accent, fontSize: 13, fontWeight: '700' },
});
