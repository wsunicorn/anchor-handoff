import { describe, expect, it } from 'vitest';

import { documentNameFromUri, isSharedFileUrl, useShareIntent } from './shareIntent';

describe('isSharedFileUrl', () => {
  it('nhận content:// (Android) và file:// (iOS Inbox)', () => {
    expect(isSharedFileUrl('content://com.android.providers.downloads.documents/document/1')).toBe(
      true,
    );
    expect(isSharedFileUrl('file:///private/var/mobile/Inbox/a.pdf')).toBe(true);
  });
  it('bỏ qua deep link và route', () => {
    expect(isSharedFileUrl('anchor://documents/1')).toBe(false);
    expect(isSharedFileUrl('/')).toBe(false);
  });
});

describe('documentNameFromUri', () => {
  it('giải mã đoạn cuối của DocumentsProvider trước khi cắt (lỗi thấy 18/9: "primary:Download/a")', () => {
    expect(
      documentNameFromUri(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fmo-bang-anchor.pdf',
      ),
    ).toBe('mo-bang-anchor.pdf');
  });
  it('giữ dấu tiếng Việt, thêm .pdf khi thiếu, bỏ query', () => {
    expect(documentNameFromUri('file:///tmp/%C4%90%E1%BB%81%20c%C6%B0%C6%A1ng?x=1')).toBe(
      'Đề cương.pdf',
    );
  });
  it('rơi về tên mặc định khi URI không có đoạn cuối', () => {
    expect(documentNameFromUri('content://x/')).toBe('Tài liệu.pdf');
  });
});

describe('useShareIntent', () => {
  it('khử trùng lặp cùng URI từ hai nguồn, take() chỉ trả một lần', () => {
    const s = useShareIntent.getState();
    s.set('content://a/1');
    s.set('content://a/1'); // +native-intent và Linking.getInitialURL cùng đưa vào
    expect(useShareIntent.getState().pendingUri).toBe('content://a/1');
    expect(s.take()).toBe('content://a/1');
    expect(s.take()).toBeNull();
    s.set('content://a/1');
    expect(useShareIntent.getState().pendingUri).toBeNull(); // đã nạp rồi, không nạp lại
    s.set('content://a/2');
    expect(s.take()).toBe('content://a/2');
  });
});
