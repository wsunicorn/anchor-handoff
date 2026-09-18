import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ScreenState';
import { signOut, useSession } from '@/features/auth/session';
import { trialDaysLeft, useEntitlement } from '@/features/billing/api';
import { useProfile, useSetAiConsent } from '@/features/consent/api';

/** Tôi: tài khoản, gói, và công tắc tính năng AI (SPEC §9: tắt được, không chôn trong cài đặt). */
export default function MeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const email = useSession((s) => s.session?.user.email);
  const profile = useProfile();
  const setConsent = useSetAiConsent();
  const ent = useEntitlement();
  const aiOn = profile.data?.ai_consent_at !== null && profile.data !== undefined;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="px-screen pt-lg">
        <Text className="type-screenTitle text-ink">{t('me.title')}</Text>
        {profile.error ? <ErrorState onRetry={() => void profile.refetch()} /> : null}

        <View className="mt-block rounded-card border border-rule bg-surface p-lg">
          <Text className="type-label text-ink-muted">{t('me.account')}</Text>
          <Text className="type-ui text-ink mt-xs" numberOfLines={1}>
            {email}
          </Text>
          <Text className="type-label text-ink-muted mt-xs" testID="me-tier">
            {t('me.tier', { tier: ent.data?.tier ?? '…' })}
            {ent.data?.entitlement === 'trial'
              ? ` · ${t('paywall.trialActive', { days: trialDaysLeft(ent.data) })}`
              : ''}
          </Text>
          <View className="mt-sm">
            <Button
              label={t('paywall.title')}
              variant="secondary"
              testID="me-paywall"
              onPress={() => router.push('/paywall')}
            />
          </View>
          <View className="mt-lg">
            <Button label={t('auth.signOut')} variant="secondary" onPress={() => void signOut()} />
          </View>
        </View>

        <View className="mt-block rounded-card border border-rule bg-surface p-lg">
          <Text className="type-label text-ink-muted">{t('me.aiSection')}</Text>
          <Text className="type-ui text-ink mt-xs">{aiOn ? t('me.aiOn') : t('me.aiOff')}</Text>
          <View className="mt-lg">
            {aiOn ? (
              <Button
                label={t('me.aiRevoke')}
                variant="secondary"
                busy={setConsent.isPending}
                onPress={() => setConsent.mutate(false)}
              />
            ) : (
              <Button
                label={t('me.aiEnable')}
                variant="secondary"
                disabled={profile.isPending}
                onPress={() => router.push('/consent')}
              />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
