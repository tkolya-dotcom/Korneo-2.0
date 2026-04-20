import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { COLORS } from '@/src/theme/colors';

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.text,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.sub,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarLabel: 'Главная',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Проекты',
          tabBarLabel: 'Проекты',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📁</Text>,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Задачи',
          tabBarLabel: 'Задачи',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✅</Text>,
        }}
      />
      <Tabs.Screen
        name="installations"
        options={{
          title: 'Монтажи',
          tabBarLabel: 'Монтажи',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🔧</Text>,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Люди',
          tabBarLabel: 'Люди',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
      {/* Hidden screens (no tab bar) */}
      <Tabs.Screen name="project/[id]" options={{ href: null }} />
      <Tabs.Screen name="project/create" options={{ href: null }} />
      <Tabs.Screen name="task/[id]" options={{ href: null }} />
      <Tabs.Screen name="task/create" options={{ href: null }} />
      <Tabs.Screen name="task/[id]/comments" options={{ href: null }} />
      <Tabs.Screen name="installation/[id]" options={{ href: null }} />
      <Tabs.Screen name="installation/create" options={{ href: null }} />
      <Tabs.Screen name="installation/[id]/comments" options={{ href: null }} />
      <Tabs.Screen name="purchase-requests" options={{ href: null }} />
    </Tabs>
  );
}
