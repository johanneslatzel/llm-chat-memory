import js from '@eslint/js';
import tseslintParser from '@typescript-eslint/parser';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    js.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslintParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: true
            },
            globals: {}
        },
        plugins: {
            '@typescript-eslint': tseslintPlugin
        },
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-deprecated': 'warn'
        }
    },
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'vitest.config.ts'
        ]
    },
    eslintConfigPrettier
];
