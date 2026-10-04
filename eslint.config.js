import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist', 'dev-dist', 'coverage', 'public/models'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Hard requirement: the math engine must never use eval-like constructs
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // Main-thread code gets browser globals...
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    ignores: ['src/workers/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    // ...workers get worker globals, so `window` or `document` there is a lint error
    files: ['src/workers/**/*.ts'],
    languageOptions: { globals: globals.worker },
  },
  prettier,
);
