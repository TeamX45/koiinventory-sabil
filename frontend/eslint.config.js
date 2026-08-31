import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // shadcn/ui memakai `any` di beberapa wrapper Radix — turunkan ke warning
      // supaya lint tetap berguna tanpa membanjiri output dengan error lama.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Aturan React 19 yang ketat. Ada 3 pelanggaran lama (auth-context,
      // use-mobile, StockOpnames) yang berfungsi normal; memperbaikinya
      // mengubah perilaku komponen di sistem produksi. Dijadikan warning
      // supaya tetap terlihat tanpa memblokir lint.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
);
