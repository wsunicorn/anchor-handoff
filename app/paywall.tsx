import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorState, LoadingState } from '@/components/ScreenState';
import {
  PurchaseFlowError,
  purchasesConfigured,
  trialDaysLeft,
  useEntitlement,
  useOfferings,
  usePurchase,
  useRestore,
  useStartTrial,
} from '@/features/billing/api';

const TRIAL_DAYS = 21;

type PlanKey = 'monthly' | 'yearly' | 'lifetime';
/** Gói hiển thị cố định theo ADR-0001 §5; giá thật lấy từ RevenueCat khi có, không thì để trống. */
const PLANS: { key: PlanKey; rcType: string; product: string }[] = [
  { key: 'yearly', rcType: 'ANNUAL', product: 'anchor_pro_yearly' },
  { key: 'monthly', rcType: 'MONTHLY', product: 'anchor_pro_monthly' },
  { key: 'lifetime', rcType: 'LIFETIME', product: 'anchor_pro_lifetime' },
];

/**
 * Paywall (G6.2, G6.7): cứng sau onboarding, kèm dùng thử 21 ngày không cần thẻ. Ba gói, gói năm đứng
 * đầu (ADR-0001 §5). Lỗi thanh toán dịch thành câu nói được; có Khôi phục giao dịch.
 */
export default function PaywallScreen() {
  const { t } = useTranslation();
  const ent = useEntitlement();
  const offerings = useOfferings();
  const startTrial = useStartTrial();
  const purchase = usePurchase();
  const restore = useRestore();
  const [notice, setNotice] = useState<string>();

  const e = ent.data;
  const isPro = e?.entitlement === 'pro' || e?.entitlement === 'lifetime';
  const trialLeft = trialDaysLeft(e);
  const trialUsed = Boolean(e?.trial_ends_at);
  const canStartTrial = e?.entitlement === 'none' && !trialUsed;

  const pkgFor = (plan: (typeof PLANS)[number]): PurchasesPackage | undefined =>
    offerings.data?.availablePackages.find(
      (p) => p.packageType === plan.rcType || p.product.identifier === plan.product,
    );

  const onError = (err: unknown) => {
    const code = err instanceof PurchaseFlowError ? err.code : 'unknown';
    setNotice(
      code === 'cancelled'
        ? t('paywall.errCancelled')
        : code === 'network'
          ? t('paywall.errNetwork')
          : code === 'pending'
            ? t('paywall.errPending')
            : code === 'store'
              ? t('paywall.errStore')
              : code === 'not_configured'
                ? t('paywall.notConfigured')
                : t('paywall.errUnknown'),
    );
  };

  const buy = (plan: (typeof PLANS)[number]) => {
    const pkg = pkgFor(plan);
    if (!pkg) {
      setNotice(t('paywall.notConfigured'));
      return;
    }
    setNotice(undefined);
    purchase.mutate(pkg, { onSuccess: () => router.back(), onError });
  };

  const priceLabel = (plan: (typeof PLANS)[number]) => {
    const pkg = pkgFor(plan);
    if (!pkg) return '';
    const price = pkg.product.priceString;
    return plan.key === 'monthly'
      ? t('paywall.perMonth', { price })
      : plan.key === 'yearly'
        ? t('paywall.perYear', { price })
        : t('paywall.once', { price });
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {ent.isPending ? (
        <LoadingState />
      ) : ent.error ? (
        <ErrorState onRetry={() => void ent.refetch()} />
      ) : (
        <ScrollView contentContainerClassName="px-screen py-xxl gap-lg">
          <Text className="type-screenTitle text-ink" testID="paywall-title">
            {t('paywall.title')}
          </Text>
          <Text className="type-docBody text-ink">{t('paywall.subtitle')}</Text>

          {isPro ? (
            <View className="rounded-card border border-rule bg-surface p-lg">
              <Text className="type-uiMedium text-verified">{t('paywall.proActive')}</Text>
            </View>
          ) : canStartTrial ? (
            <View className="gap-sm rounded-card border border-rule bg-surface p-lg">
              <Text className="type-ui text-ink-muted">
                {t('paywall.trialBody', { days: TRIAL_DAYS })}
              </Text>
              <Button
                label={t('paywall.trial', { days: TRIAL_DAYS })}
                busy={startTrial.isPending}
                testID="paywall-trial"
                onPress={() => startTrial.mutate(undefined, { onSuccess: () => router.back() })}
              />
            </View>
          ) : (
            <Text className="type-uiMedium text-ink-muted" testID="paywall-trial-state">
              {trialLeft > 0
                ? t('paywall.trialActive', { days: trialLeft })
                : t('paywall.trialEnded')}
            </Text>
          )}

          {!isPro ? (
            <View className="gap-sm">
              {PLANS.map((plan) => (
                <Pressable
                  key={plan.key}
                  accessibilityRole="button"
                  accessibilityLabel={t(`paywall.${plan.key}`)}
                  testID={`plan-${plan.key}`}
                  disabled={purchase.isPending}
                  onPress={() => buy(plan)}
                  className={`flex-row items-center rounded-card border p-lg active:opacity-80 ${
                    plan.key === 'yearly' ? 'border-ink bg-surface' : 'border-rule bg-surface'
                  }`}
                >
                  <View className="flex-1 gap-xs">
                    <View className="flex-row items-center gap-sm">
                      <Text className="type-uiMedium text-ink">{t(`paywall.${plan.key}`)}</Text>
                      {plan.key === 'yearly' ? (
                        <Text className="type-label rounded-card bg-ink px-sm text-paper">
                          {t('paywall.yearlyBadge')}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="type-label text-ink-muted">{priceLabel(plan)}</Text>
                  </View>
                  <Text className="type-uiMedium text-ink">
                    {purchase.isPending ? t('paywall.buying') : t('paywall.buy')}
                  </Text>
                </Pressable>
              ))}
              {!purchasesConfigured ? (
                <Text className="type-label text-ink-muted">{t('paywall.notConfigured')}</Text>
              ) : null}
            </View>
          ) : null}

          {notice ? (
            <Text className="type-label text-unsupported" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}

          <View className="gap-sm">
            {!isPro && !canStartTrial ? (
              <Button
                label={t('paywall.continueFree')}
                variant="secondary"
                testID="paywall-continue-free"
                onPress={() => router.back()}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                restore.mutate(undefined, {
                  onSuccess: (ok) =>
                    setNotice(ok ? t('paywall.restoredOk') : t('paywall.restoredNone')),
                  onError,
                })
              }
              className="min-h-[44px] items-center justify-center"
            >
              <Text className="type-label text-ink underline">
                {restore.isPending ? t('paywall.restoring') : t('paywall.restore')}
              </Text>
            </Pressable>
            <Text className="type-label text-ink-muted text-center">{t('paywall.terms')}</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
