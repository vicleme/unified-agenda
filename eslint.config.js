import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Framework-free modules: no React here
  {
    files: ['src/core/**/*.ts', 'src/filters/**/*.ts', 'src/storage/**/*.ts', 'src/sync/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'This module must stay framework-free.',
            },
            {
              group: ['**/ui/**', '**/views/**'],
              message: 'This module cannot import from the interface layers.',
            },
          ],
        },
      ],
    },
  },
  // The core also must not depend on the layers above it
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'The core must stay framework-free.',
            },
            {
              group: ['**/ui/**', '**/views/**', '**/storage/**', '**/sync/**'],
              message: 'The core cannot import from ui, views, storage or sync.',
            },
          ],
        },
      ],
    },
  },
);
