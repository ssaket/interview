module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Relaxed style rules - let Prettier handle formatting
    'indent': 'off', // Let Prettier handle indentation
    'linebreak-style': ['error', 'unix'],
    'quotes': 'off', // Let Prettier handle quotes
    'semi': 'off', // Let Prettier handle semicolons

    // Core ESLint rules for code quality
    'no-console': 'off', // Allow console.log for debugging
    'no-unused-vars': 'warn', // Warn instead of error
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-unreachable': 'warn',

    // Electron specific
    'no-process-exit': 'off',

    // Allow require() calls
    'no-global-assign': 'error',

    // Best practices (warnings only to avoid breaking existing code)
    'eqeqeq': 'warn',
    'curly': 'off', // Allow single-line if statements
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-with': 'error',
    'no-delete-var': 'error',

    // Turn off all formatting rules - let Prettier handle them
    'max-len': 'off',
    'object-curly-spacing': 'off',
    'space-before-function-paren': 'off',
    'comma-dangle': 'off',
    'brace-style': 'off',
    'key-spacing': 'off',
    'keyword-spacing': 'off',
    'space-infix-ops': 'off',
    'space-before-blocks': 'off',
    'array-bracket-spacing': 'off',
  },
  globals: {
    // Electron globals
    '__dirname': 'readonly',
    '__filename': 'readonly',
    'process': 'readonly',
    'global': 'readonly',
    'Buffer': 'readonly',

    // Node.js globals
    'require': 'readonly',
    'module': 'readonly',
    'exports': 'readonly',
    'console': 'readonly',

    // Browser/Electron renderer globals
    'window': 'readonly',
    'document': 'readonly',
    'navigator': 'readonly',
    'localStorage': 'readonly',
    'sessionStorage': 'readonly',
  },
  ignorePatterns: [
    'node_modules/**',
    'dist/**',
    '*.min.js',
    'conversation-history*.html',
  ],
};