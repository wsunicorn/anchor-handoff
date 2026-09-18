import { Linking } from 'react-native';

import { isSharedFileUrl, useShareIntent } from './shareIntent';

/**
 * G7.5 — nguồn thứ hai đổ vào `useShareIntent` (xem shareIntent.ts): gọi thẳng `Linking.getInitialURL()`
 * vì Expo Router chỉ chờ nó 150 ms khi khởi động lạnh. Tách file để shareIntent.ts không kéo react-native
 * vào unit test. Gọi một lần ở root layout; trả về hàm huỷ đăng ký.
 */
export function listenShareIntent(): () => void {
  const push = (url: string | null) => {
    if (url && isSharedFileUrl(url)) useShareIntent.getState().set(url);
  };
  void Linking.getInitialURL().then(push, () => undefined);
  const sub = Linking.addEventListener('url', ({ url }) => push(url));
  return () => sub.remove();
}
