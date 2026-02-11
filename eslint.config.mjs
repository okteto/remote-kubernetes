import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Enforce modern variable declarations
      'no-var': 'error',
      'prefer-const': 'warn',

      // Enforce strict equality
      eqeqeq: ['error', 'always'],

      // Require curly braces for all control structures
      curly: 'error',

      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: ['dist/', 'out/', 'node_modules/', '*.js', '*.mjs'],
  },
);
