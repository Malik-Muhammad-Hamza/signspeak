import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    // Build outputs
    'dist/**',
    'dist-ssr/**',
    // Dependencies
    'node_modules/**',
    // Python environments
    'training/.venv/**',
    'training/.venv-export/**',
    'training/**/__pycache__/**',
    // ML model artefacts (generated files)
    'models/**',
    'export_upload/**',
    'public/v2/model/model.json',
    'public/v2/model/*.bin',
    // Legacy Node.js CJS script — not part of the ESM app bundle
    'patch_model.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Allow catch-clause variable shadowing when re-thrown with cause
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
])
