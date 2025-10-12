// @ts-check

import tsEslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import eslint from '@eslint/js'

export default defineConfig(
  eslint.configs.recommended,
  tsEslint.configs.recommended,
  {
    ...prettierConfig,
    name: 'prettier/recommended',
  },
  {
    name: 'app/globals',
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
