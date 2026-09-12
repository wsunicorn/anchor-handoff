/**
 * Logic thuần của cổng chặn song ngữ (CLAUDE.md): mọi khoá phải có ở cả hai ngôn ngữ,
 * không rỗng, và placeholder `{{name}}` của cùng khoá phải giống nhau. Tách khỏi
 * check-i18n.ts để unit test được.
 */
export type Tree = { readonly [key: string]: string | Tree };

export function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

export function placeholders(text: string): string {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');
}

export function findProblems(vi: Tree, en: Tree): string[] {
  const flatVi = flatten(vi);
  const flatEn = flatten(en);
  const problems: string[] = [];

  for (const key of flatVi.keys()) if (!flatEn.has(key)) problems.push(`thiếu ở en.ts: ${key}`);
  for (const key of flatEn.keys()) if (!flatVi.has(key)) problems.push(`thiếu ở vi.ts: ${key}`);

  for (const [key, viText] of flatVi) {
    const enText = flatEn.get(key);
    if (enText === undefined) continue;
    if (viText.trim() === '') problems.push(`chuỗi rỗng ở vi.ts: ${key}`);
    if (enText.trim() === '') problems.push(`chuỗi rỗng ở en.ts: ${key}`);
    const pVi = placeholders(viText);
    const pEn = placeholders(enText);
    if (pVi !== pEn) problems.push(`placeholder lệch ở ${key}: vi {${pVi}} ≠ en {${pEn}}`);
  }
  return problems;
}
