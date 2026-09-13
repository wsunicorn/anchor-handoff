import { Image, View } from 'react-native';
import { ResumableZoom } from 'react-native-zoom-toolkit';

import type { BBox, PageWithUrl } from '@/features/reader/api';

type Props = {
  page: PageWithUrl;
  /** Bề rộng hiển thị (thường = bề rộng màn hình). Chiều cao theo tỉ lệ ảnh gốc. */
  width: number;
  /** bbox theo pixel ảnh gốc (`page.width × page.height`) cần tô highlight. */
  highlights?: BBox[];
};

/**
 * Một trang tài liệu: ảnh trang + lớp phủ highlight (G1.7–G1.8), phóng to bằng pinch/double-tap.
 * Highlight nằm trong cùng khối zoom với ảnh nên phóng to vẫn trùng dòng.
 * Trang giấy không bo góc, không đổ bóng (DESIGN §5).
 */
export function PageView({ page, width, highlights = [] }: Props) {
  const scale = width / page.width;
  const height = Math.round(page.height * scale);
  return (
    <View className="bg-surface" style={{ width, height }}>
      <ResumableZoom maxScale={4} pinchMode="free">
        <View style={{ width, height }}>
          <Image
            source={{ uri: page.url }}
            style={{ width, height }}
            resizeMode="contain"
            accessibilityLabel={`page ${page.page_no}`}
          />
          {highlights.map(([x0, y0, x1, y1], i) => (
            <View
              key={i}
              pointerEvents="none"
              className="absolute bg-highlighter"
              style={{
                left: x0 * scale,
                top: y0 * scale,
                width: (x1 - x0) * scale,
                height: (y1 - y0) * scale,
              }}
            />
          ))}
        </View>
      </ResumableZoom>
    </View>
  );
}
