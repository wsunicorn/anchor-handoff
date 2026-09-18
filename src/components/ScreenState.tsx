import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/Button';

/**
 * Ba trạng thái dùng chung cho mọi màn (G7.2, DESIGN §7): đang tải nói đang làm gì; lỗi nói việc gì hỏng và
 * làm gì tiếp (có nút thử lại); rỗng là lời mời làm việc, không phải xin lỗi.
 */
export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-screen" testID="state-loading">
      <ActivityIndicator className="text-ink" />
      <Text className="type-label text-ink-muted mt-sm">{label ?? t('common.loading')}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  testID = 'state-error',
}: {
  message?: string;
  onRetry?: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-md px-screen" testID={testID}>
      <Text className="type-ui text-ink text-center" accessibilityLiveRegion="polite">
        {message ?? t('common.loadFailed')}
      </Text>
      {onRetry ? <Button label={t('common.retry')} variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-md px-screen" testID="state-empty">
      <Text className="type-docBody text-ink-muted text-center">{message}</Text>
      {action}
    </View>
  );
}
