import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

/**
 * Client duy nhất của app. Chỉ dùng khoá anon (EXPO_PUBLIC_*); mọi lời gọi LLM đi qua
 * Edge Function, không bao giờ có khoá nhà cung cấp ở đây (CLAUDE.md quy tắc 1).
 *
 * Local: `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` + `adb reverse tcp:54321 tcp:54321`
 * để emulator/máy thật qua USB gọi được máy dev và link trong email mở đúng.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Thiếu EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — xem .env.example',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Mở deep link tự tay ở app/auth/callback.tsx; supabase-js không tự đọc URL trên native.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/** Deep link mà email magic link trỏ về (khớp `scheme` trong app.json và allow-list Supabase). */
export const AUTH_REDIRECT_URL = 'anchor://auth/callback';

// Chỉ làm mới token khi app đang ở foreground — tiết kiệm pin, tránh gọi khi không cần.
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
