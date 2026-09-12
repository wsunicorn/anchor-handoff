import { describe, expect, it } from 'vitest';

import en from '../src/lib/i18n/en';
import vi from '../src/lib/i18n/vi';
import { findProblems, placeholders } from './i18n-parity';

describe('i18n parity', () => {
  it('vi.ts và en.ts hiện tại khớp nhau', () => {
    expect(findProblems(vi, en)).toEqual([]);
  });

  it('bắt khoá thiếu ở một bên, kể cả khoá lồng', () => {
    const a = { x: { y: 'a', z: 'b' } };
    const b = { x: { y: 'a' }, w: 'c' };
    expect(findProblems(a, b)).toEqual(['thiếu ở en.ts: x.z', 'thiếu ở vi.ts: w']);
  });

  it('bắt chuỗi rỗng', () => {
    expect(findProblems({ k: ' ' }, { k: 'ok' })).toEqual(['chuỗi rỗng ở vi.ts: k']);
  });

  it('bắt placeholder lệch, không phân biệt thứ tự và khoảng trắng', () => {
    expect(findProblems({ k: '{{a}} {{ b }}' }, { k: '{{b}} {{a}}' })).toEqual([]);
    expect(findProblems({ k: 'trang {{page}}' }, { k: 'page {{pg}}' })).toEqual([
      'placeholder lệch ở k: vi {page} ≠ en {pg}',
    ]);
  });

  it('placeholders() chuẩn hoá thành danh sách đã sắp xếp', () => {
    expect(placeholders('{{z}} và {{ a }}')).toBe('a,z');
    expect(placeholders('không có')).toBe('');
  });
});
