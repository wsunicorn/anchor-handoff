import { Text, TextInput, type TextInputProps, useColorScheme, View } from 'react-native';

import { palette } from '@/theme/tokens';

type Props = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'keyboardType'
  | 'autoComplete'
  | 'textContentType'
  | 'autoCapitalize'
  | 'autoFocus'
  | 'maxLength'
  | 'editable'
  | 'onSubmitEditing'
  | 'returnKeyType'
> & {
  label: string;
  /** Thông báo lỗi đặt ngay dưới ô — nói chuyện gì và làm gì tiếp (DESIGN §7). */
  error?: string | undefined;
};

/** Ô nhập chuẩn: nhãn trên, viền `rule`, lỗi dùng màu `unsupported` (màu lỗi theo DESIGN §2). */
export function TextField({ label, error, ...input }: Props) {
  // placeholderTextColor là prop, không phải style, nên NativeWind không đổi theo dark mode hộ.
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <View>
      <Text className="type-label text-ink-muted mb-xs">{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={palette[mode].inkMuted}
        className={`type-ui min-h-[44px] rounded-card border bg-surface px-md text-ink ${
          error ? 'border-unsupported' : 'border-rule'
        }`}
      />
      {error ? <Text className="type-label text-unsupported mt-xs">{error}</Text> : null}
    </View>
  );
}
