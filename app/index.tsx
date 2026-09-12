import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { signOut, useSession } from '@/features/auth/session';
import { captureTestError } from '@/lib/telemetry';
import { type as typeScale } from '@/theme/tokens';

/**
 * Màn hình tạm chứng minh G0.1–G0.3: Router, NativeWind, token, và font tiếng Việt.
 * Mỗi vai chữ in hai dòng: dòng trên có chữ có đuôi (g, y, p), dòng dưới mở đầu bằng
 * chữ hoa có dấu chồng (Ố, Ằ, Ễ) — cách nhanh nhất để lộ lỗi dấu chạm chân dòng trên.
 * Sẽ được thay bằng màn Thư viện ở G1.6. Chuỗi hardcode ở đây được phép vì i18n dựng ở G0.4.
 */
const SAMPLE_VI = 'Quy gọn gõ phím, gợi ý sẵn.\nỐc Ằng Ễnh — Ổn định, Ấn Độ, Ứng dụng.';
const SAMPLE_EN = 'Typography quickly judged by page.\nAnswers that point back to your page.';

const roles = Object.keys(typeScale) as (keyof typeof typeScale)[];

const typeClass: Record<keyof typeof typeScale, string> = {
  screenTitle: 'type-screenTitle',
  sectionTitle: 'type-sectionTitle',
  docBody: 'type-docBody',
  answerBody: 'type-answerBody',
  ui: 'type-ui',
  uiMedium: 'type-uiMedium',
  label: 'type-label',
};

export default function Index() {
  const { t, i18n } = useTranslation();
  const email = useSession((s) => s.session?.user.email);
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="px-screen py-lg">
        <Text className="type-screenTitle text-ink">{t('library.title')}</Text>
        <Text className="type-label text-ink-muted mt-xs">
          G0.4 — i18n · {i18n.language} · {t('study.due', { count: 3 })}
        </Text>
        <Text className="type-ui text-ink-muted mt-sm">{t('library.empty')}</Text>
        <View className="mt-lg flex-row items-center gap-md">
          <Text className="type-label text-ink-muted flex-1" numberOfLines={1}>
            {email}
          </Text>
          <Button label={t('auth.signOut')} variant="secondary" onPress={() => void signOut()} />
        </View>
        {__DEV__ ? (
          <View className="mt-sm self-start">
            {/* Chỉ bản dev: kiểm G0.8 — một event lên Sentry + PostHog. Màn này thay ở G1.6. */}
            <Button label="Bắn lỗi thử (dev)" variant="secondary" onPress={captureTestError} />
          </View>
        ) : null}

        {roles.map((role) => {
          const t = typeScale[role];
          return (
            <View key={role} className="mt-block rounded-card border border-rule bg-surface p-lg">
              <Text className="type-label text-ink-muted">
                {role} · {t.family} · {t.size}/{t.lineHeight} · {t.weight}
              </Text>
              <Text className={`${typeClass[role]} text-ink mt-sm`}>{SAMPLE_VI}</Text>
              <Text className={`${typeClass[role]} text-ink-muted mt-sm`}>{SAMPLE_EN}</Text>
            </View>
          );
        })}

        <View className="mt-block rounded-card border border-rule bg-surface p-lg">
          <Text className="type-label text-ink-muted">docBody · italic</Text>
          <Text className="type-docBody italic text-ink mt-sm">{SAMPLE_VI}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
