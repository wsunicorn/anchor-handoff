// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  {
    // CLAUDE.md: không `any` nếu chưa hỏi. Plugin typescript-eslint đã được eslint-config-expo nạp.
    files: ['**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // File cấu hình của Metro/Babel/Tailwind là CommonJS.
    files: ['*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __filename: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    ignores: [
      'android/**',
      'ios/**',
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'supabase/functions/**',
    ],
  },
]);
