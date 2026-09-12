/**
 * Nguồn sự thật về hình thức. Mọi màu, cỡ chữ, khoảng cách trong app lấy từ đây.
 * Viết hex rời trong component là lỗi review — xem docs/DESIGN.md.
 */

export const palette = {
  light: {
    ink: '#17233B',
    inkMuted: '#5A6880',
    paper: '#F4F6F8',
    surface: '#FFFFFF',
    rule: '#C9D2DC',
    verified: '#1F6B4F',
    inferred: '#A66A00',
    unsupported: '#9B2F45',
    highlighter: '#F6E96B',
    highlighterAlpha: 0.35,
  },
  dark: {
    ink: '#E7ECF3',
    inkMuted: '#8C9BB2',
    paper: '#0F1622',
    surface: '#16202E',
    rule: '#2C3A4D',
    verified: '#3F9E77',
    inferred: '#D4941F',
    unsupported: '#D4607A',
    highlighter: '#F6E96B',
    highlighterAlpha: 0.28,
  },
} as const;

/** Ba màu này CHỈ dùng cho trạng thái kiểm chứng. Không dùng cho nút hay nhãn khác. */
export const verdictColor = {
  grounded: 'verified',
  inferred: 'inferred',
  unsupported: 'unsupported',
} as const;

/**
 * Tên họ chữ đúng như trong file TTF (name table). Font nhúng native qua plugin `expo-font`
 * trong app.json: iOS lấy tên họ từ file, Android đăng ký cùng tên qua ReactFontManager —
 * nhờ vậy một `fontFamily` + `fontWeight` chọn đúng mặt chữ trên cả hai nền tảng.
 * File nằm ở assets/fonts/, giấy phép OFL kèm theo.
 */
export const font = {
  /** Chữ của tài liệu và văn bản trả lời */
  serif: 'Source Serif 4',
  /** Mọi thành phần giao diện — chọn vì dấu tiếng Việt ở cỡ nhỏ */
  sans: 'Be Vietnam Pro',
} as const;

export const type = {
  screenTitle: { family: font.sans, size: 28, lineHeight: 34, weight: '600' },
  sectionTitle: { family: font.sans, size: 20, lineHeight: 28, weight: '600' },
  docBody: { family: font.serif, size: 17, lineHeight: 28, weight: '400' },
  answerBody: { family: font.serif, size: 16, lineHeight: 26, weight: '400' },
  ui: { family: font.sans, size: 15, lineHeight: 22, weight: '400' },
  uiMedium: { family: font.sans, size: 15, lineHeight: 22, weight: '500' },
  label: { family: font.sans, size: 13, lineHeight: 18, weight: '500' },
} as const;

/** Lưới 4pt */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 } as const;

export const radius = {
  card: 12,
  sheet: 20,
  /** Trang giấy không bo góc */
  page: 0,
} as const;

export const anchorRail = {
  width: 2,
  gap: 12,
  tickLength: 8,
} as const;

export const motion = {
  answerFade: 180,
  pageRise: 260,
  highlightBloom: 200,
  highlightDelay: 120,
  /** Khi hệ điều hành bật "giảm chuyển động": thay mọi thứ bằng mờ dần */
  reducedFade: 100,
} as const;

export const a11y = {
  minTouchTarget: 44,
} as const;
