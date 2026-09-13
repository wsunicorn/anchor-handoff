import '../global.css';
import '@/lib/i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { bootstrapSession, useSession } from '@/features/auth/session';
import { wrapRoot } from '@/lib/telemetry';

// Giữ splash cho tới khi biết đã đăng nhập hay chưa — tránh nháy màn đăng nhập rồi biến mất.
void SplashScreen.preventAutoHideAsync();

// Server state (TanStack Query). UI state dùng Zustand — hai loại tách rõ (README).
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

function RootLayout() {
  const session = useSession((s) => s.session);

  useEffect(() => bootstrapSession(), []);

  useEffect(() => {
    if (session !== undefined) void SplashScreen.hideAsync();
  }, [session]);

  if (session === undefined) return null;

  return (
    <GestureHandlerRootView className="flex-1">
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={session !== null}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="documents/[id]/index" />
            <Stack.Screen name="documents/[id]/chunks" />
            <Stack.Screen name="documents/[id]/ask" />
            <Stack.Screen name="consent" options={{ presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={session === null}>
            <Stack.Screen name="(auth)/sign-in" />
          </Stack.Protected>
          {/* Deep link từ email phải mở được ở mọi trạng thái. */}
          <Stack.Screen name="auth/callback" />
        </Stack>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default wrapRoot(RootLayout);
