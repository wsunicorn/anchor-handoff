import '../global.css';
import '@/lib/i18n';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { bootstrapSession, useSession } from '@/features/auth/session';
import { wrapRoot } from '@/lib/telemetry';

// Giữ splash cho tới khi biết đã đăng nhập hay chưa — tránh nháy màn đăng nhập rồi biến mất.
void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const session = useSession((s) => s.session);

  useEffect(() => bootstrapSession(), []);

  useEffect(() => {
    if (session !== undefined) void SplashScreen.hideAsync();
  }, [session]);

  if (session === undefined) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={session !== null}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={session === null}>
          <Stack.Screen name="(auth)/sign-in" />
        </Stack.Protected>
        {/* Deep link từ email phải mở được ở mọi trạng thái. */}
        <Stack.Screen name="auth/callback" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default wrapRoot(RootLayout);
