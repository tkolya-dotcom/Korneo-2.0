import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const THEME = {
  card: '#1A1A2E',
  accent: '#00D9FF',
  text: '#E0E0E0',
  sub: '#8892a0',
  border: 'rgba(0, 217, 255, 0.15)',
};

const icon = (value: string) => ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 18 }}>{value}</Text>
);

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: THEME.card },
        headerTintColor: THEME.accent,
        headerTitleStyle: { fontWeight: '600', color: THEME.text },
        tabBarStyle: {
          backgroundColor: THEME.card,
          borderTopColor: THEME.border,
          borderTopWidth: 1,
          height: 58,
        },
        tabBarActiveTintColor: THEME.accent,
        tabBarInactiveTintColor: THEME.sub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarLabel: 'Главная',
          tabBarIcon: icon('⌂'),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Проекты',
          tabBarLabel: 'Проекты',
          tabBarIcon: icon('▣'),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Задачи',
          tabBarLabel: 'Задачи',
          tabBarIcon: icon('✓'),
        }}
      />
      <Tabs.Screen
        name="installations"
        options={{
          title: 'Монтажи',
          tabBarLabel: 'Монтажи',
          tabBarIcon: icon('⌘'),
        }}
      />
      <Tabs.Screen
        name="purchase-requests"
        options={{
          title: 'Заявки',
          tabBarLabel: 'Заявки',
          tabBarIcon: icon('¤'),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarLabel: 'Профиль',
          tabBarIcon: icon('◉'),
        }}
      />

      <Tabs.Screen name="archive" options={{ href: null }} />
      <Tabs.Screen name="project" options={{ href: null }} />
      <Tabs.Screen name="task" options={{ href: null }} />
      <Tabs.Screen name="installation" options={{ href: null }} />
      <Tabs.Screen name="purchase-request" options={{ href: null }} />
    </Tabs>
  );
}
