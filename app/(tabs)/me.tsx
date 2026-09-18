import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ScreenState';
import { signOut, useSession } from '@/features/auth/session';
import { trialDaysLeft, useEntitlement } from '@/features/billing/api';
import { deleteAccount, useProfile, useSetAiConsent } from '@/features/consent/api';

/** Địa chỉ công khai của chính sách/điều khoản (docs/legal). Đổi khi có domain thật (TASKS #11). */
const LEGAL_URL = {
  privacy: 'https://github.com/wsunicorn/anchor-handoff/blob/main/docs/legal/privacy.vi.md',
  terms: 'https://github.com/wsunicorn/anchor-handoff/blob/main/docs/legal/terms.vi.md',
} as const;

/** Tôi: tài khoản, gói, công tắc tính năng AI (SPEC §9), riêng tư/điều khoản và xoá tài khoản (G7.6). */
export default function MeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const email = useSession((s) => s.session?.user.email);
  const profile = useProfile();
  const setConsent = useSetAiConsent();
  const ent = useEntitlement();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  // G7.6 — xác nhận hai bước bằng hộp thoại hệ thống; xoá xong đăng xuất, root layout tự về màn đăng nhập.
  const confirmDelete = () =>
    Alert.alert(t('me.deleteTitle'), t('me.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('me.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          setDeleteError(undefined);
          deleteAccount().catch(() => {
            setDeleteError(t('me.deleteFailed'));
            setDeleting(false);
          });
        },
      },
    ]);
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

        <View className="mt-block rounded-card border border-rule bg-surface p-lg">
          <Text className="type-label text-ink-muted">{t('me.legal')}</Text>
          <View className="mt-xs flex-row gap-lg">
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(LEGAL_URL.privacy)}
              className="min-h-[44px] justify-center"
            >
              <Text className="type-ui text-ink underline">{t('me.privacy')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(LEGAL_URL.terms)}
              className="min-h-[44px] justify-center"
            >
              <Text className="type-ui text-ink underline">{t('me.terms')}</Text>
            </Pressable>
          </View>
          <View className="mt-lg">
            <Button
              label={deleting ? t('me.deleting') : t('me.deleteAccount')}
              variant="secondary"
              busy={deleting}
              testID="me-delete-account"
              onPress={confirmDelete}
            />
          </View>
          {deleteError ? (
            <Text className="type-label text-unsupported mt-xs" accessibilityLiveRegion="polite">
              {deleteError}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
