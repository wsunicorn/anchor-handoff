import { isSharedFileUrl, useShareIntent } from '@/features/library/shareIntent';

/**
 * Expo Router gọi hàm này cho mọi URL hệ điều hành đưa vào app (deep link, intent VIEW…).
 * URL kiểu `content://…` không phải route: cất lại cho Thư viện nạp, đưa router về "/" thay vì
 * màn "Unmatched Route" (đo trên bản release 2026-09-18).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (isSharedFileUrl(path)) {
    useShareIntent.getState().set(path);
    return '/';
  }
  return path;
}
