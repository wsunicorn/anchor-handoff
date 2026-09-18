import { create } from 'zustand';

/**
 * G7.5 — PDF tới từ app khác. Android: intent VIEW `content://…` (app.json `intentFilters`). iOS: "Open in Anchor"
 * qua `CFBundleDocumentTypes` (app.json) — hệ thống chép file vào Inbox rồi mở app với `file://…`; chưa kiểm trên
 * iPhone. URI được cất vào đây; Thư viện lấy ra (`take`) và nạp khi đã có đồng ý AI.
 *
 * Hai nguồn cùng đổ vào: `app/+native-intent.ts` (Expo Router) và `listenShareIntent()` (shareIntentListener.ts) gọi thẳng
 * `Linking.getInitialURL()`. Cần nguồn thứ hai vì Expo Router chỉ chờ `getInitialURL` 150 ms khi
 * khởi động lạnh (expo-router/fork/useLinking.native.js) — bản release 2026-09-18 mở từ intent VIEW
 * quá hạn đó nên router không thấy URL. `seen` khử trùng lặp giữa hai nguồn.
 */
type ShareIntentState = {
  pendingUri: string | null;
  seen: Set<string>;
  set: (uri: string) => void;
  take: () => string | null;
};

export const useShareIntent = create<ShareIntentState>((set, get) => ({
  pendingUri: null,
  seen: new Set(),
  set: (uri) => {
    const { seen } = get();
    if (seen.has(uri)) return;
    seen.add(uri);
    set({ pendingUri: uri });
  },
  take: () => {
    const uri = get().pendingUri;
    if (uri) set({ pendingUri: null });
    return uri;
  },
}));

export function isSharedFileUrl(url: string): boolean {
  return /^(content|file):\/\//.test(url);
}

/**
 * Tên tài liệu từ URI. URI của DocumentsProvider mã hoá cả đường dẫn trong đoạn cuối
 * ("primary%3ADownload%2Fa.pdf") → giải mã trước rồi mới lấy phần sau dấu '/' hoặc ':' cuối cùng.
 */
export function documentNameFromUri(uri: string, fallback = 'Tài liệu.pdf'): string {
  let decoded = uri.replace(/[?#].*$/, '');
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // URI mã hoá hỏng: giữ nguyên, vẫn lấy được đoạn cuối
  }
  const name = decoded.split(/[/:]/).pop()?.trim() || fallback;
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}
