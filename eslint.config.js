import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    // fixtures/ and evals/hidden/ belong to the chat-mini app, which has its own tsconfig.
    ignores: ['dist/**', '.spec/**', 'plugin/scripts/**', 'node_modules/**', 'fixtures/**', 'tests/core/lint-cases/**', 'evals/results/**', 'evals/hidden/**', '.claude/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // src/core is pure: no file system, process, network or clock access.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(node:)?(fs|fs/promises|child_process|net|http|https|dgram|dns|os|process|worker_threads|readline|tty)$',
              message: 'src/core is pure; do I/O in src/io or src/cli.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'process', 'fetch', 'setTimeout', 'setInterval'],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'src/core has no clock access.' },
        { selector: "MemberExpression[object.name='Date']", message: 'src/core has no clock access.' },
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'src/core is deterministic.' },
        { selector: "CallExpression[callee.property.name='localeCompare']", message: 'localeCompare is locale-dependent; use compareIds or compareStrings.' },
      ],
    },
  },
  {
    // Plain JavaScript: this config and the example adapters, which projects copy as they are.
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { process: 'readonly' } },
  },
);
