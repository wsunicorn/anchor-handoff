/**
 * Thanh toán (G6): RevenueCat cho gói trả tiền, server cho dùng thử. Nguồn sự thật về quyền lợi là
 * Postgres (`my_entitlement()`), do webhook RevenueCat ghi — app không tự đặt tier.
 *
 * Chưa có khoá RevenueCat (dev, CI): mọi thứ vẫn chạy — paywall hiện gói nhưng nút mua báo "chưa cấu hình",
 * dùng thử vẫn bắt đầu được (RPC `start_trial`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';

import { useSession } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

const RC_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export const purchasesConfigured = Boolean(RC_KEY);
let configuredFor: string | null = null;

/** Gọi khi có session: RevenueCat app_user_id = uuid Supabase để webhook ánh xạ được. */
export function configurePurchases(userId: string): void {
  if (!RC_KEY || configuredFor === userId) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: RC_KEY, appUserID: userId });
  configuredFor = userId;
}

export type Entitlement = {
  entitlement: 'none' | 'trial' | 'pro' | 'lifetime';
  trial_ends_at: string | null;
  tier: 'free' | 'pro';
};

export const entitlementKey = ['entitlement'] as const;

export function useEntitlement() {
  const userId = useSession((s) => s.session?.user.id);
  return useQuery({
    queryKey: entitlementKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<Entitlement> => {
      const { data, error } = await supabase.rpc('my_entitlement');
      if (error) throw error;
      const row = data?.[0];
      return {
        entitlement: (row?.entitlement as Entitlement['entitlement']) ?? 'none',
        trial_ends_at: row?.trial_ends_at ?? null,
        tier: row?.tier === 'pro' ? 'pro' : 'free',
      };
    },
  });
}

/** Còn bao nhiêu ngày dùng thử (0 nếu hết hoặc chưa bắt đầu). */
export function trialDaysLeft(e: Entitlement | undefined): number {
  if (!e?.trial_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(e.trial_ends_at).getTime() - Date.now()) / 86_400_000));
}

export function useStartTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('start_trial');
      if (error) throw error;
      track('trial_started');
      return data;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: entitlementKey }),
  });
}

export function useOfferings() {
  return useQuery({
    queryKey: ['offerings'],
    enabled: purchasesConfigured,
    queryFn: async () => (await Purchases.getOfferings()).current,
    staleTime: 5 * 60_000,
  });
}

export class PurchaseFlowError extends Error {
  constructor(
    readonly code: 'cancelled' | 'not_configured' | 'store' | 'network' | 'pending' | 'unknown',
    message: string,
  ) {
    super(message);
  }
}

/** Đổi lỗi RevenueCat thành mã ổn định để UI dịch ra câu nói được (G6.7). */
function classify(e: unknown): PurchaseFlowError {
  const err = e as PurchasesError & { userCancelled?: boolean };
  if (err?.userCancelled || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)
    return new PurchaseFlowError('cancelled', 'Đã huỷ.');
  if (err?.code === PURCHASES_ERROR_CODE.NETWORK_ERROR)
    return new PurchaseFlowError('network', 'Lỗi mạng.');
  if (err?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR)
    return new PurchaseFlowError('pending', 'Thanh toán đang chờ.');
  if (
    err?.code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR ||
    err?.code === PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR ||
    err?.code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR
  )
    return new PurchaseFlowError('store', 'Cửa hàng từ chối.');
  return new PurchaseFlowError('unknown', String(err?.message ?? e));
}

/** Webhook ghi entitlement bất đồng bộ — đợi tối đa ~10 s cho DB khớp với cửa hàng. */
async function waitForEntitlement(qc: ReturnType<typeof useQueryClient>): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await qc.invalidateQueries({ queryKey: entitlementKey });
    const e = qc.getQueryData<Entitlement>(entitlementKey);
    if (e && e.entitlement !== 'none' && e.entitlement !== 'trial') return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function hasPro(info: CustomerInfo): boolean {
  return Object.keys(info.entitlements.active).length > 0;
}

export function usePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      if (!purchasesConfigured) throw new PurchaseFlowError('not_configured', 'Chưa cấu hình.');
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        track('purchase_completed', { product: pkg.product.identifier });
        if (hasPro(customerInfo)) await waitForEntitlement(qc);
        return customerInfo;
      } catch (e) {
        throw classify(e);
      }
    },
  });
}

/** G6.7 — khôi phục giao dịch (đổi máy, cài lại). */
export function useRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!purchasesConfigured) throw new PurchaseFlowError('not_configured', 'Chưa cấu hình.');
      try {
        const info = await Purchases.restorePurchases();
        track('purchase_restored', { active: hasPro(info) });
        if (hasPro(info)) await waitForEntitlement(qc);
        return hasPro(info);
      } catch (e) {
        throw classify(e);
      }
    },
  });
}
