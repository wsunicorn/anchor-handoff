// Nguồn sự thật là src/theme/tokens.ts (sinh từ docs/DESIGN.md). File này chỉ ánh xạ
// token sang class Tailwind — không viết hex ở đây. tokens.ts là TypeScript nên nạp qua jiti.
const { createJiti } = require('jiti');
const plugin = require('tailwindcss/plugin');

const jiti = createJiti(__filename);
const { palette, font, type, space, radius, anchorRail } = jiti('./src/theme/tokens.ts');

/** #RRGGBB + alpha → rgba(...) để highlighter luôn đi kèm alpha đúng theo DESIGN §2. */
function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Biến CSS cho một chế độ màu. Tên biến = tên token, dạng kebab-case. */
function cssVars(mode) {
  const p = palette[mode];
  return {
    '--color-ink': p.ink,
    '--color-ink-muted': p.inkMuted,
    '--color-paper': p.paper,
    '--color-surface': p.surface,
    '--color-rule': p.rule,
    '--color-verified': p.verified,
    '--color-inferred': p.inferred,
    '--color-unsupported': p.unsupported,
    '--color-highlighter': withAlpha(p.highlighter, p.highlighterAlpha),
  };
}

/**
 * Thang chữ DESIGN §3 → utility `type-<vai>` gồm đủ họ chữ, cỡ, giãn dòng, weight.
 * RN không kế thừa font, nên một class phải mang cả bốn thứ — không tách `font-sans` riêng.
 */
const typeUtilities = Object.fromEntries(
  Object.entries(type).map(([name, t]) => [
    `.type-${name}`,
    {
      // Đặt trong ngoặc kép: "Source Serif 4" có số nên nếu không quote, CSS coi là không hợp lệ.
      fontFamily: JSON.stringify(t.family),
      fontSize: `${t.size}px`,
      lineHeight: `${t.lineHeight}px`,
      fontWeight: t.weight,
    },
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    // Không mở rộng bảng màu mặc định: mọi màu trong app phải là token.
    colors: {
      transparent: 'transparent',
      ink: 'var(--color-ink)',
      'ink-muted': 'var(--color-ink-muted)',
      paper: 'var(--color-paper)',
      surface: 'var(--color-surface)',
      rule: 'var(--color-rule)',
      verified: 'var(--color-verified)',
      inferred: 'var(--color-inferred)',
      unsupported: 'var(--color-unsupported)',
      highlighter: 'var(--color-highlighter)',
    },
    fontFamily: {
      sans: [JSON.stringify(font.sans)],
      serif: [JSON.stringify(font.serif)],
    },
    // Không có `text-lg`/`text-sm`: cỡ chữ chỉ đi theo vai qua `type-*`.
    fontSize: {},
    fontWeight: {},
    borderRadius: {
      none: '0px',
      card: `${radius.card}px`,
      sheet: `${radius.sheet}px`,
      page: `${radius.page}px`,
      full: '9999px',
    },
    extend: {
      // Lưới 4pt mặc định của Tailwind (1 = 4px) giữ nguyên; thêm tên theo DESIGN §5.
      spacing: {
        xs: `${space.xs}px`,
        sm: `${space.sm}px`,
        md: `${space.md}px`,
        lg: `${space.lg}px`,
        xl: `${space.xl}px`,
        xxl: `${space.xxl}px`,
        screen: `${space.xl}px`,
        block: `${space.lg}px`,
        'rail-gap': `${anchorRail.gap}px`,
      },
      borderWidth: {
        rail: `${anchorRail.width}px`,
      },
    },
  },
  plugins: [
    plugin(({ addBase, addUtilities }) => {
      addBase({
        ':root': cssVars('light'),
        '@media (prefers-color-scheme: dark)': { ':root': cssVars('dark') },
      });
      addUtilities(typeUtilities);
    }),
  ],
};
