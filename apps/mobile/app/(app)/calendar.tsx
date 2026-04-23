import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/src/providers/AuthProvider';
import { calendarApi } from '@/src/lib/supabase';

const C = {
  bg: '#0A0A0F',
  card: '#1A1A2E',
  accent: '#00D9FF',
  text: '#E0E0E0',
  sub: '#8892a0',
  border: 'rgba(0, 217, 255, 0.15)',
  green: '#00FF88',
  orange: '#FF6B00',
};

const monthName = (date: Date) =>
  date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

const toDateKey = (value?: string | null) => {
  if (!value) return '';
  return value.slice(0, 10);
};

const dayStartKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const formatDayLabel = (dateKey: string) => {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
};

const getMonthGrid = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
};

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export default function CalendarScreen() {
  const router = useRouter();
  const { user, isEngineer } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => dayStartKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [showInstallations, setShowInstallations] = useState(true);
  const [showAvr, setShowAvr] = useState(true);
  const [data, setData] = useState<{ tasks: any[]; installations: any[]; avr: any[] }>({
    tasks: [],
    installations: [],
    avr: [],
  });

  const load = useCallback(async () => {
    try {
      const next = await calendarApi.getMonthData(cursor.getFullYear(), cursor.getMonth(), {
        assignee_id: isEngineer && user?.id ? user.id : undefined,
        executor_id: isEngineer && user?.id ? user.id : undefined,
      });
      setData(next);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    }
  }, [cursor, isEngineer, user?.id]);

  useEffect(() => {
    let active = true;
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return undefined;
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    if (showTasks) {
      data.tasks.forEach((task) => {
        const key = toDateKey(task.due_date);
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    }

    if (showInstallations) {
      data.installations.forEach((installation) => {
        const key = toDateKey(installation.scheduled_at);
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    }

    if (showAvr) {
      data.avr.forEach((avr) => {
        const fromKey = toDateKey(avr.date_from);
        const toKey = toDateKey(avr.date_to) || fromKey;
        if (!fromKey || !toKey) return;

        const fromDate = parseDateKey(fromKey);
        const toDate = parseDateKey(toKey);
        if (!fromDate || !toDate) return;

        for (let current = new Date(fromDate); current <= toDate; current = addDays(current, 1)) {
          const key = dayStartKey(current);
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    }

    return counts;
  }, [data.avr, data.installations, data.tasks, showAvr, showInstallations, showTasks]);

  const selectedEvents = useMemo(() => {
    const events: Array<
      { id: string; type: 'task' | 'installation' | 'avr'; title: string; status: string; subtitle?: string }
    > = [];

    if (showTasks) {
      data.tasks.forEach((task) => {
        if (toDateKey(task.due_date) !== selectedDay) return;
        events.push({
          id: task.id,
          type: 'task',
          title: task.title,
          status: task.status,
          subtitle: 'Задача',
        });
      });
    }

    if (showInstallations) {
      data.installations.forEach((installation) => {
        if (toDateKey(installation.scheduled_at) !== selectedDay) return;
        events.push({
          id: installation.id,
          type: 'installation',
          title: installation.title || installation.address || 'Монтаж',
          status: installation.status,
          subtitle: 'Монтаж',
        });
      });
    }

    if (showAvr) {
      data.avr.forEach((avr) => {
        const from = toDateKey(avr.date_from);
        const to = toDateKey(avr.date_to) || from;
        if (!from || !to) return;
        if (selectedDay < from || selectedDay > to) return;
        events.push({
          id: avr.id,
          type: 'avr',
          title: avr.title,
          status: avr.status,
          subtitle: 'АВР',
        });
      });
    }

    return events;
  }, [data.avr, data.installations, data.tasks, selectedDay, showAvr, showInstallations, showTasks]);

  const monthGrid = useMemo(() => getMonthGrid(cursor), [cursor]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 24 }}
    >
      <View style={s.headerRow}>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <Text style={s.navText}>◀</Text>
        </TouchableOpacity>
        <Text style={s.monthTitle}>{monthName(cursor)}</Text>
        <TouchableOpacity
          style={s.navBtn}
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        >
          <Text style={s.navText}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={s.calendar}>
        <View style={s.typeFiltersRow}>
          <TouchableOpacity
            style={[s.typeChip, showTasks && s.typeChipActive]}
            onPress={() => setShowTasks((prev) => !prev)}
          >
            <Text style={[s.typeChipText, showTasks && s.typeChipTextActive]}>Задачи</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.typeChip, showInstallations && s.typeChipActive]}
            onPress={() => setShowInstallations((prev) => !prev)}
          >
            <Text style={[s.typeChipText, showInstallations && s.typeChipTextActive]}>Монтажи</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.typeChip, showAvr && s.typeChipActive]}
            onPress={() => setShowAvr((prev) => !prev)}
          >
            <Text style={[s.typeChipText, showAvr && s.typeChipTextActive]}>АВР</Text>
          </TouchableOpacity>
        </View>

        <View style={s.weekRow}>
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
            <Text key={day} style={s.weekDay}>
              {day}
            </Text>
          ))}
        </View>

        <View style={s.grid}>
          {monthGrid.map((date) => {
            const key = dayStartKey(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            const isSelected = key === selectedDay;
            const isToday = key === dayStartKey(new Date());
            const count = dayCounts[key] || 0;

            return (
              <TouchableOpacity
                key={key}
                style={[
                  s.dayCell,
                  !inMonth && s.dayOtherMonth,
                  isSelected && s.daySelected,
                  isToday && s.dayToday,
                ]}
                onPress={() => setSelectedDay(key)}
              >
                <Text style={[s.dayText, !inMonth && s.dayOtherText]}>{date.getDate()}</Text>
                {count > 0 ? <Text style={s.dayBadge}>{count}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={s.eventsCard}>
        <Text style={s.eventsTitle}>События на {formatDayLabel(selectedDay)}</Text>
        {selectedEvents.length === 0 ? (
          <Text style={s.empty}>Нет запланированных событий</Text>
        ) : (
          selectedEvents.map((event) => (
            <TouchableOpacity
              key={`${event.type}-${event.id}`}
              style={s.eventRow}
              onPress={() => {
                if (event.type === 'task') {
                  router.push({ pathname: '/(app)/task/[id]', params: { id: event.id } } as any);
                  return;
                }
                if (event.type === 'installation') {
                  router.push({ pathname: '/(app)/installation/[id]', params: { id: event.id } } as any);
                  return;
                }
                router.push({ pathname: '/(app)/avr/[id]', params: { id: event.id } } as any);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.eventTitle}>{event.title}</Text>
                <Text style={s.eventSub}>{event.subtitle}</Text>
              </View>
              <Text style={s.eventStatus}>{event.status}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { color: C.accent, fontSize: 16, fontWeight: '700' },
  monthTitle: { color: C.text, fontSize: 18, fontWeight: '700', textTransform: 'capitalize' },
  calendar: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeFiltersRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeChip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeChipActive: { borderColor: C.accent, backgroundColor: 'rgba(0,217,255,0.16)' },
  typeChipText: { color: C.sub, fontSize: 11, fontWeight: '600' },
  typeChipTextActive: { color: C.accent },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekDay: { flex: 1, textAlign: 'center', color: C.sub, fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  dayOtherMonth: { opacity: 0.4 },
  daySelected: { backgroundColor: 'rgba(0,217,255,0.18)', borderWidth: 1, borderColor: C.border },
  dayToday: { borderWidth: 1, borderColor: C.green },
  dayText: { color: C.text, fontSize: 13, fontWeight: '600' },
  dayOtherText: { color: C.sub },
  dayBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    color: C.accent,
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: 'rgba(0,217,255,0.12)',
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  eventsCard: {
    marginTop: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  eventsTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  empty: { color: C.sub, fontSize: 13 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 9,
    marginTop: 9,
  },
  eventTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  eventSub: { color: C.sub, fontSize: 11, marginTop: 3 },
  eventStatus: { color: C.orange, fontSize: 11, fontWeight: '600', marginLeft: 8 },
});
