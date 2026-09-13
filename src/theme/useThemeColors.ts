import { useColorScheme } from 'react-native';

import { palette } from '@/theme/tokens';

/**
 * Một số prop của thư viện native (màu icon, tabBarStyle, placeholderTextColor) không nhận
 * className. Lấy đúng bảng màu theo chế độ sáng/tối từ đây — vẫn là token, không hex rời.
 */
export function useThemeColors() {
  const scheme = useColorScheme();
  return palette[scheme === 'dark' ? 'dark' : 'light'];
}
