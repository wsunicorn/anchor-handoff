import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useSetAiConsent } from '@/features/consent/api';

/** Nhà cung cấp hiện tại — đổi nhà cung cấp là phải cập nhật màn này (ADR-0001 §7). */
const PROVIDER = 'Google (Gemini)';

/**
 * Màn đồng ý AI (G1.9, SPEC §9): nêu tên bên thứ ba, dữ liệu gửi đi, cách tắt — trước lời gọi
 * đầu tiên. Không có đường tắt: server (ingest, Edge Function) từ chối khi `ai_consent_at` rỗng.
 */
export default function ConsentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setConsent = useSetAiConsent();

  const decide = (granted: boolean) => {
    if (!granted) {
      router.back();
      return;
    }
    setConsent.mutate(true, { onSuccess: () => router.back() });
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="px-screen py-xxl">
        <Text className="type-screenTitle text-ink">{t('consent.title')}</Text>
        <Text className="type-docBody text-ink mt-block">
          {t('consent.body', { provider: PROVIDER })}
        </Text>

        <View className="mt-block gap-sm">
          {(['provider', 'dataSent', 'notSent', 'howToOff', 'noTraining'] as const).map((k) => (
            <View key={k} className="flex-row gap-sm">
              <Text className="type-ui text-ink-muted">•</Text>
              <Text className="type-ui text-ink flex-1">{t(`consentScreen.${k}`)}</Text>
            </View>
          ))}
        </View>

        <View className="mt-xxl gap-sm">
          <Button
            label={t('consent.accept')}
            busy={setConsent.isPending}
            onPress={() => decide(true)}
          />
          <Button label={t('consent.decline')} variant="secondary" onPress={() => decide(false)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
