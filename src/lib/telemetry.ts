import * as Sentry from '@sentry/react-native';
import * as Crypto from 'expo-crypto';
import PostHog from 'posthog-react-native';

/**
 * Crash (Sentry) và funnel (PostHog). Hai quy tắc:
 *  - Không bao giờ gửi email hay nội dung tài liệu. Định danh người dùng là một mã giả danh
 *    (SHA-256 của uuid Supabase + tiền tố), ổn định để đếm nhưng không nối ngược về DB
 *    nếu chỉ có dashboard.
 *  - Thiếu khoá (dev local, CI) thì cả hai SDK tắt hẳn — không lỗi, không gọi mạng.
 */
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  // Không tự gắn IP, cookie, user agent đầy đủ.
  sendDefaultPii: false,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.1,
});

export const posthog: PostHog | null = posthogKey
  ? new PostHog(posthogKey, {
      host: posthogHost,
      // Chỉ sự kiện gọi tường minh — không tự ghi mọi cú chạm (nội dung tài liệu có thể lọt vào tên phần tử).
      captureAppLifecycleEvents: true,
      disableGeoip: true,
    })
  : null;

/** Mã giả danh ổn định theo tài khoản; không phải uuid Supabase, không phải email. */
export async function pseudonymFor(userId: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `anchor:${userId}`);
}

/** Gọi khi có session: gắn cùng một mã giả danh cho cả Sentry lẫn PostHog. */
export async function identifyUser(userId: string): Promise<void> {
  const id = await pseudonymFor(userId);
  if (__DEV__)
    console.log(
      `[telemetry] identify ${id.slice(0, 8)}… sentry=${Boolean(sentryDsn)} posthog=${Boolean(posthog)}`,
    );
  Sentry.setUser({ id });
  posthog?.identify(id);
}

/** Gọi khi đăng xuất: tách sự kiện sau đó khỏi tài khoản cũ. */
export function resetUser(): void {
  Sentry.setUser(null);
  posthog?.reset();
}

/** Sự kiện funnel. Tên viết snake_case; thuộc tính không chứa văn bản người dùng. */
export function track(event: string, properties?: Record<string, string | number | boolean>): void {
  posthog?.capture(event, properties);
}

/** Bọc root layout để Sentry bắt lỗi render và điều hướng. */
export const wrapRoot = Sentry.wrap;

/** Chỉ để kiểm đường ống ở G0.8: một exception lên Sentry và một event lên PostHog. */
export function captureTestError(): void {
  Sentry.captureException(new Error('G0.8 telemetry smoke test'));
  track('telemetry_smoke_test');
}
