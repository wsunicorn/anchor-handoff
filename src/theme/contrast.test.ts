import { describe, expect, it } from 'vitest';

import { palette } from './tokens';

/** WCAG 2.1 độ tương phản (tỉ lệ độ chói), AA chữ thường ≥ 4,5, chữ lớn/UI ≥ 3. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// G7.3 — mọi cặp chữ/nền thật sự dùng trong app (DESIGN §2). Đổi token là đổi test này.
const CASES: { fg: string; bg: string; min: number }[] = [];
for (const mode of ['light', 'dark'] as const) {
  const p = palette[mode];
  for (const bg of [p.paper, p.surface]) {
    CASES.push({ fg: p.ink, bg, min: 4.5 });
    CASES.push({ fg: p.inkMuted, bg, min: 4.5 });
    CASES.push({ fg: p.verified, bg, min: 4.5 });
    CASES.push({ fg: p.inferred, bg, min: 4.5 });
    CASES.push({ fg: p.unsupported, bg, min: 4.5 });
  }
  // Chữ trên nút chính (paper trên ink) và thanh neo 2pt (đồ hoạ, ≥ 3).
  CASES.push({ fg: p.paper, bg: p.ink, min: 4.5 });
  CASES.push({ fg: p.rule, bg: p.surface, min: 1.2 }); // đường kẻ chỉ cần thấy được
}

describe('tương phản AA (G7.3)', () => {
  it.each(CASES)('$fg trên $bg ≥ $min', ({ fg, bg, min }) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });
});
