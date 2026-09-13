import { Tabs } from 'expo-router';
import { BookOpen, Layers, UserRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { font } from '@/theme/tokens';
import { useThemeColors } from '@/theme/useThemeColors';

/** Ba tab theo DESIGN §5. Hỏi đáp không phải tab — mở từ trong tài liệu. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ink,
        tabBarInactiveTintColor: c.inkMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.rule },
        tabBarLabelStyle: { fontFamily: font.sans, fontSize: 13, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: t('tabs.study'),
          tabBarIcon: ({ color, size }) => <Layers color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: t('tabs.me'),
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
