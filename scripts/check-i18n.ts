/**
 * Cổng chặn song ngữ (CLAUDE.md). Sai thì exit 1 để CI đỏ.
 *
 *   pnpm check-i18n
 */
import en from '../src/lib/i18n/en';
import vi from '../src/lib/i18n/vi';
import { findProblems, flatten } from './i18n-parity';

const problems = findProblems(vi, en);

if (problems.length > 0) {
  console.error(`check-i18n: ${problems.length} lỗi`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`check-i18n: OK — ${flatten(vi).size} khoá khớp ở vi và en`);
