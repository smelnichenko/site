import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import testingLibrary from 'eslint-plugin-testing-library';
import vitest from '@vitest/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';

// Flat config. Type-aware rules are enabled on purpose: `tsc --noEmit` already runs in CI, so the
// value ESLint adds is the checks the compiler does NOT do — a promise left unawaited, an `any`
// leaking out of a cast, a hook dependency that silently re-subscribes a WebSocket every render.
//
// The `lint` script pins `--max-warnings 0`: a warning that passes CI is a warning nobody ever reads.
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'public/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  jsxA11y.flatConfigs.recommended,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser },
    },
    plugins: {
      sonarjs,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // SonarQube's gate (0 new issues) applies these on every PR; running them here keeps the gate from being the first to see them
      ...sonarjs.configs.recommended.rules,
      // Sonar's S7735 (a `!x ? a : b` ternary or if/else with a negated test) is not in the sonarjs plugin; ESLint core has it
      'no-negated-condition': 'error',
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // An unawaited promise swallows its rejection: a failed markChannelRead() or publish() would
      // vanish instead of surfacing. Allow the explicit `void fn()` marker the codebase already uses.
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } }, // onClick={async () => ...} is idiomatic React
      ],

      // `_`-prefixed args are a deliberate "unused on purpose" marker, mirroring Java's `catch (X _)`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Config and build files run in Node and are not part of the app's tsconfig program.
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Tests: Testing Library + Vitest discipline. `getByRole` over `getByText` is the point — a node
  // reachable only by its text has no accessible name, and that is the bug the query hides.
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
    plugins: { 'testing-library': testingLibrary, vitest },
    languageOptions: { globals: { ...vitest.environments.env.globals } },
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      ...vitest.configs.recommended.rules,
      'sonarjs/no-clear-text-protocols': 'off', // fixture URLs, not a protocol choice
      '@typescript-eslint/unbound-method': 'off', // vi.mocked(x.y) is not an unbound call
    },
  },

  prettier, // must stay last: turns off every rule that would fight the formatter
);
