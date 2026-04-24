import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/theme/colors';

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
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.accent,
        headerTitleStyle: { fontWeight: '700', color: COLORS.text },
        headerShadowVisible: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 66,
          paddingTop: 4,
          paddingBottom: 8,
        },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.sub,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '700', marginBottom: 2 },
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
