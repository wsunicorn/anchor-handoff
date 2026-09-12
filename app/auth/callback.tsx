import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { exchangeCode } from '@/features/auth/session';

/**
 * Đích của deep link `anchor://auth/callback?code=…` từ email magic link (PKCE).
 * Đổi `code` lấy session; root layout thấy session → tự chuyển vào app.
 * Link hỏng/hết hạn → nói rõ và đưa về màn đăng nhập để gửi mã mới.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { code, error_description: errorDescription } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
  }>();
  const [failed, setFailed] = useState(Boolean(errorDescription) || !code);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code) return;
    exchangeCode(code)
      .then(() => setDone(true))
      .catch(() => setFailed(true));
  }, [code]);

  if (done) return <Redirect href="/" />;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center px-screen">
        {failed ? (
          <>
            <Text className="type-ui text-ink text-center">{t('auth.linkFailed')}</Text>
            <View className="mt-lg self-stretch">
              <Button label={t('auth.sendLink')} onPress={() => setDone(true)} />
            </View>
          </>
        ) : (
          <>
            <ActivityIndicator className="text-ink" />
            <Text className="type-ui text-ink-muted mt-sm">{t('auth.signingIn')}</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
