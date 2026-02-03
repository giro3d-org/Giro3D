/*
 * Copyright (c) 2015-2018, IGN France.
 * Copyright (c) 2018-2026, Giro3D team.
 * SPDX-License-Identifier: MIT
 */

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vitest from '@vitest/eslint-plugin';
import licenseHeader from 'eslint-plugin-license-header';
import perfectionist from 'eslint-plugin-perfectionist';
import prettier from 'eslint-plugin-prettier';
import tsdoc from 'eslint-plugin-tsdoc';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: [
            'node_modules',
            'build/**/*.js',
            '**/public/',
            'examples/data',
            'test/data',
            './license-header.js',
        ],
    },
    ...compat.extends(
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ),
    {
        plugins: {
            '@typescript-eslint': typescriptEslint,
            tsdoc,
            prettier,
            perfectionist,
            'license-header': licenseHeader,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.amd,
                ...globals.commonjs,
            },

            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: 'module',

            parserOptions: {
                project: './tsconfig.eslint.json',

                ecmaFeatures: {
                    impliedStrict: true,
                },
            },
        },

        settings: {
            'import/ignore': ['\\.(coffee|scss|css|less|hbs|svg|json)$'],
        },

        rules: {
            'license-header/header': ['error', './license-header.js'],

            curly: 'error',
            'tsdoc/syntax': 'warn',
            'no-console': 'off',
            'no-shadow': 'error',
            eqeqeq: ['error', 'smart'],
            'no-plusplus': 'off',
            'arrow-parens': ['error', 'as-needed'],
            '@typescript-eslint/lines-between-class-members': 'off',
            '@typescript-eslint/consistent-type-definitions': 'error',
            'one-var': ['error', 'never'],
            'import/extensions': 'off',
            'no-underscore-dangle': 'off',
            'no-continue': 'off',
            'no-param-reassign': 'off',
            'no-use-before-define': ['error', 'nofunc'],

            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: ['**/api'],
                            message:
                                'API barrel files (api.ts) are reserved for API documentation generation. They must not be used by actual code.',
                        },
                    ],
                },
            ],

            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ForInStatement',
                    message:
                        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
                },
                {
                    selector: 'LabeledStatement',
                    message:
                        'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
                },
                {
                    selector: 'WithStatement',
                    message:
                        '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
                },
            ],

            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'classProperty',
                    format: ['camelCase'],
                    trailingUnderscore: 'forbid',
                },
                {
                    selector: 'classProperty',
                    modifiers: ['private'],
                    format: ['camelCase'],
                    leadingUnderscore: 'require',
                },
                {
                    selector: 'classProperty',
                    modifiers: ['protected'],
                    format: ['camelCase'],
                    leadingUnderscore: 'require',
                },
                {
                    selector: 'classProperty',
                    modifiers: ['public'],
                    format: ['camelCase'],
                    leadingUnderscore: 'forbid',
                },
            ],

            'prefer-destructuring': 'off',
            'no-bitwise': 'off',
            'max-classes-per-file': 'off',

            'perfectionist/sort-imports': [
                'error',
                {
                    internalPattern: ['^~/.+', '^@/.+', '^@giro3d/.*'],
                },
            ],
        },
    },
    {
        files: ['**/*.js', '**/*.mjs'],

        rules: {
            'tsdoc/syntax': 'off',
            'import/no-named-as-default': 'off',
            '@typescript-eslint/naming-convention': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/default-param-last': 'off',
        },
    },
    {
        files: ['tasks/*.mjs'],

        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['**/*.ts'],

        rules: {
            '@typescript-eslint/explicit-member-accessibility': 'error',
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'error',

            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        files: ['test/**/*.ts'],
        plugins: {
            vitest,
        },
        rules: {
            ...vitest.configs.recommended.rules,
            '@typescript-eslint/explicit-member-accessibility': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            'vitest/max-nested-describe': ['error', { max: 3 }],
        },
    },
    {
        files: ['**/api.{js,ts}'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
];
