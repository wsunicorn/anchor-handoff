/* eslint-disable import/no-named-as-default-member -- i18next là một instance; gọi method trên nó là đúng API */
import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';
import vi from './vi';

/** Hai ngôn ngữ v1 (SPEC §8). Thêm ngôn ngữ = thêm file + thêm vào đây + qua check-i18n. */
export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  vi: { translation: vi },
  en: { translation: en },
} as const;

function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

/** Ngôn ngữ giao diện theo máy; máy không phải vi/en thì về en. */
export function detectDeviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return isAppLanguage(code) ? code : 'en';
}

void i18next.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    // React đã escape; escape lần nữa sẽ biến dấu nháy trong tiếng Việt thành &#39;.
    escapeValue: false,
  },
  returnNull: false,
});

/** Đổi ngôn ngữ trong Cài đặt (SPEC §8). Lưu lựa chọn là việc của màn Cài đặt. */
export function setAppLanguage(lang: AppLanguage): Promise<unknown> {
  return i18next.changeLanguage(lang);
}

export default i18next;
