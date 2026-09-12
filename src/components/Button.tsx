import { ActivityIndicator, Pressable, Text } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  /** Đang chờ mạng: khoá nút, hiện vòng xoay, đổi nhãn nếu có `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
};

/**
 * Nút chuẩn của app: vùng chạm ≥ 44pt (DESIGN §8), màu chỉ từ token, không đổ bóng.
 * Không dùng màu nhãn kiểm chứng (verified/inferred/unsupported) cho nút — DESIGN §2.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  busyLabel,
  disabled = false,
}: Props) {
  const inactive = busy || disabled;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      className={`min-h-[44px] flex-row items-center justify-center rounded-card px-lg ${
        primary ? 'bg-ink' : 'border border-rule bg-surface'
      } ${inactive ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {busy ? <ActivityIndicator className={primary ? 'text-paper' : 'text-ink'} /> : null}
      <Text
        className={`type-uiMedium ${primary ? 'text-paper' : 'text-ink'} ${busy ? 'ml-sm' : ''}`}
      >
        {busy && busyLabel ? busyLabel : label}
      </Text>
    </Pressable>
  );
}
