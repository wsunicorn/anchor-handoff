import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { configurePurchases } from '@/features/billing/api';
import i18next from '@/lib/i18n';
import { AUTH_REDIRECT_URL, supabase } from '@/lib/supabase';
import { identifyUser, resetUser, track } from '@/lib/telemetry';

type SessionState = {
  /** `undefined` = chưa đọc xong từ bộ nhớ; `null` = chưa đăng nhập. */
  session: Session | null | undefined;
  setSession: (session: Session | null) => void;
};

export const useSession = create<SessionState>((set) => ({
  session: undefined,
  setSession: (session) => set({ session }),
}));

/** Gọi một lần ở root layout: nạp session đã lưu rồi theo dõi thay đổi. */
export function bootstrapSession(): () => void {
  void supabase.auth
    .getSession()
    .then(({ data }) => useSession.getState().setSession(data.session));
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    useSession.getState().setSession(session);
    // Gắn/tách định danh giả danh cho crash + funnel theo vòng đời session.
    if (session?.user) {
      void identifyUser(session.user.id);
      configurePurchases(session.user.id); // app_user_id = uuid Supabase để webhook ánh xạ (G6.1)
    }
    if (event === 'SIGNED_OUT') resetUser();
    if (event === 'SIGNED_IN') track('signed_in');
  });
  return () => data.subscription.unsubscribe();
}

/** Gửi email chứa link + mã OTP. Kèm ngôn ngữ giao diện để trigger tạo profiles đúng locale. */
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: AUTH_REDIRECT_URL, data: { locale: i18next.language } },
  });
  if (error) throw error;
}

/** Đường dự phòng: người dùng gõ mã 6 số trong email. */
export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

/** Đường chính: deep link `anchor://auth/callback?code=…` (PKCE). */
export async function exchangeCode(code: string): Promise<void> {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
