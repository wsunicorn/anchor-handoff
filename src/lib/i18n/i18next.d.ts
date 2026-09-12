import type vi from './vi';

/**
 * Khoá dịch có kiểu: `t('library.titel')` là lỗi TypeScript, không đợi runtime.
 * Lấy vi.ts làm chuẩn vì tiếng Việt là ngôn ngữ chính; en.ts phải khớp qua check-i18n.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof vi };
    returnNull: false;
  }
}
