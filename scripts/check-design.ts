/**
 * G7.1 — rà UI theo docs/DESIGN.md bằng máy (chạy trong CI cùng check-i18n):
 *   1. Không hex màu rời ngoài src/theme/tokens.ts (màu chỉ từ token).
 *   2. Không chữ hiển thị hardcode trong JSX (mọi chuỗi qua t('…')): JsxText có chữ cái, hoặc
 *      literal chuỗi làm con trực tiếp của <Text>.
 *   3. Tiếp cận (G7.3): mọi <Pressable> có accessibilityRole; không có <Text> con thì phải có
 *      accessibilityLabel (nút chỉ có icon → TalkBack đọc được).
 * Bỏ qua: comment, chuỗi chỉ có ký hiệu/số (·, /, %, 1/2…), className, testID, accessibilityRole.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import ts from 'typescript';

const ROOT = process.cwd();
const DIRS = ['app', 'src'];
const TOKENS = 'src/theme/tokens.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const HAS_LETTER = /\p{L}/u;
const HEX = /#[0-9a-fA-F]{3,8}\b/;

type Issue = { file: string; line: number; kind: 'hex' | 'raw-text' | 'a11y'; text: string };
const issues: Issue[] = [];

for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const src = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

    const visit = (node: ts.Node) => {
      // 1. Hex trong chuỗi (kể cả template) — trừ file token.
      if (
        rel !== TOKENS &&
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        HEX.test(node.text)
      ) {
        issues.push({ file: rel, line: lineOf(node), kind: 'hex', text: node.text.slice(0, 60) });
      }
      // 2. Chữ hardcode trong JSX.
      if (ts.isJsxText(node) && HAS_LETTER.test(node.text)) {
        issues.push({ file: rel, line: lineOf(node), kind: 'raw-text', text: node.text.trim() });
      }
      if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) {
        const parent = node.parent;
        const inText =
          ts.isJsxElement(parent) &&
          ts.isIdentifier(parent.openingElement.tagName) &&
          parent.openingElement.tagName.text === 'Text';
        if (inText && HAS_LETTER.test(node.expression.text)) {
          issues.push({
            file: rel,
            line: lineOf(node),
            kind: 'raw-text',
            text: node.expression.text.slice(0, 60),
          });
        }
      }
      // 3. Pressable: role + (label hoặc Text con).
      if (
        (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
        ts.isIdentifier(ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName) &&
        (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText() ===
          'Pressable'
      ) {
        const attrs = (ts.isJsxElement(node) ? node.openingElement : node).attributes.properties
          .filter(ts.isJsxAttribute)
          .map((a) => a.name.getText());
        const hasText = node.getText().includes('<Text');
        if (!attrs.includes('accessibilityRole'))
          issues.push({
            file: rel,
            line: lineOf(node),
            kind: 'a11y',
            text: 'Pressable thiếu accessibilityRole',
          });
        if (!attrs.includes('accessibilityLabel') && !hasText)
          issues.push({
            file: rel,
            line: lineOf(node),
            kind: 'a11y',
            text: 'Pressable chỉ có icon mà thiếu accessibilityLabel',
          });
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

if (issues.length) {
  for (const i of issues) console.log(`${i.file}:${i.line}  ${i.kind}  ${JSON.stringify(i.text)}`);
  console.error(`\ncheck-design: ${issues.length} vi phạm DESIGN.md (hex rời / chữ hardcode).`);
  process.exit(1);
}
console.log(
  'check-design: OK — không hex rời, không chữ hardcode, Pressable có role/label trong app/ và src/.',
);
