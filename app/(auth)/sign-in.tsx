import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { sendMagicLink, verifyEmailCode } from '@/features/auth/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'email' | 'code';

/**
 * Đăng nhập bằng email: gửi một email chứa cả link (mở app qua deep link) lẫn mã 6 số.
 * Người dùng có thể mở link hoặc gõ mã — hai đường cùng về một session.
 */
export default function SignIn() {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const send = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await sendMagicLink(trimmed);
      setEmail(trimmed);
      setStep('code');
    } catch {
      setError(t('auth.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) {
      setError(t('auth.invalidCode'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await verifyEmailCode(email, code);
      // Session đổi → root layout tự chuyển sang màn chính; không điều hướng ở đây.
    } catch {
      setError(t('auth.invalidCode'));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-screen"
      >
        <Text className="type-screenTitle text-ink">{t('auth.title')}</Text>

        {step === 'email' ? (
          <View className="mt-block">
            <TextField
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              testID="signin-email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={send}
              editable={!busy}
              error={error}
            />
            <View className="mt-lg">
              <Button
                label={t('auth.sendLink')}
                testID="signin-send"
                busyLabel={t('auth.sending')}
                busy={busy}
                onPress={send}
              />
            </View>
          </View>
        ) : (
          <View className="mt-block">
            <Text className="type-ui text-ink-muted">{t('auth.sentTo', { email })}</Text>
            <View className="mt-lg">
              <TextField
                label={t('auth.codeLabel')}
                testID="signin-code"
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={verify}
                editable={!busy}
                error={error}
              />
            </View>
            <View className="mt-lg gap-sm">
              <Button
                label={t('auth.verify')}
                testID="signin-verify"
                busyLabel={t('auth.verifying')}
                busy={busy}
                onPress={verify}
              />
              <Button
                label={t('auth.changeEmail')}
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(undefined);
                }}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
