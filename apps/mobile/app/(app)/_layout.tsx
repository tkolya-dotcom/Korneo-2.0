import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';
import { useAuth } from '@/src/providers/AuthProvider';

type TabIconName = keyof typeof Ionicons.glyphMap;

const labels = {
  home: 'Главная',
  projects: 'Проекты',
  tasks: 'Задачи',
  installations: 'Монтажи',
  requests: 'Заявки',
  chats: 'Чаты',
};

const tabIcon =
  (name: TabIconName) =>
  ({ color, size }: { color: string; size: number }) =>
    <Ionicons name={name} color={color} size={size} />;

export default function AppTabsLayout() {
  const { loading, session, user } = useAuth();
  const hasActiveSession = Boolean(session?.access_token && session?.user?.id && user?.id);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (!hasActiveSession) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.accent,
        headerTitleStyle: { fontWeight: '700', color: COLORS.text },
        headerShadowVisible: false,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 82 : 64,
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 18 : 8,
        },
        tabBarItemStyle: { paddingVertical: 2, minWidth: 0 },
        tabBarIconStyle: { marginTop: 1 },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.sub,
        tabBarLabelStyle: { fontSize: 10, lineHeight: 12, fontWeight: '700', marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: labels.home,
          tabBarLabel: labels.home,
          tabBarIcon: tabIcon('home-outline'),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: labels.projects,
          tabBarLabel: labels.projects,
          tabBarIcon: tabIcon('folder-open-outline'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: labels.tasks,
          tabBarLabel: labels.tasks,
          tabBarIcon: tabIcon('checkbox-outline'),
        }}
      />
      <Tabs.Screen
        name="installations"
        options={{
          title: labels.installations,
          tabBarLabel: labels.installations,
          tabBarIcon: tabIcon('construct-outline'),
        }}
      />
      <Tabs.Screen
        name="purchase-requests"
        options={{
          title: labels.requests,
          tabBarLabel: labels.requests,
          tabBarIcon: tabIcon('cart-outline'),
        }}
      />
      <Tabs.Screen
        name="messenger"
        options={{
          title: labels.chats,
          tabBarLabel: labels.chats,
          tabBarIcon: tabIcon('chatbubbles-outline'),
        }}
      />

      <Tabs.Screen name="archive" options={{ href: null }} />
      <Tabs.Screen name="project/[id]" options={{ href: null }} />
      <Tabs.Screen name="task/[id]" options={{ href: null }} />
      <Tabs.Screen name="task/create/index" options={{ href: null }} />
      <Tabs.Screen name="task/[id]/comments/index" options={{ href: null }} />
      <Tabs.Screen name="installation/[id]" options={{ href: null }} />
      <Tabs.Screen name="installation/create/index" options={{ href: null }} />
      <Tabs.Screen name="installation/[id]/comments/index" options={{ href: null }} />
      <Tabs.Screen name="purchase-request/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null }} />
      <Tabs.Screen name="warehouse" options={{ href: null }} />
      <Tabs.Screen name="avr" options={{ href: null }} />
      <Tabs.Screen name="avr/create" options={{ href: null }} />
      <Tabs.Screen name="avr/[id]" options={{ href: null }} />
      <Tabs.Screen name="calendar" options={{ href: null }} />
      <Tabs.Screen name="sites" options={{ href: null }} />
      <Tabs.Screen name="site/[id]" options={{ href: null }} />
      <Tabs.Screen name="users" options={{ href: null }} />
      <Tabs.Screen name="atss" options={{ href: null }} />
    </Tabs>
  );
}
