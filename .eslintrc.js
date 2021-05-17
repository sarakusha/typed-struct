module.exports = {
  extends: '.eslintrc-prod.js',
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-console': 'off',
  },
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
};
