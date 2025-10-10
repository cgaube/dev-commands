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
    name: 'app/prettier',
  },
  {
    name: 'app/globals',
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // You can add any custom rule overrides here
    },
  }
)
