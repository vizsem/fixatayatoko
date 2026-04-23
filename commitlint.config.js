module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Fitur baru
        'fix',      // Bug fix
        'docs',     // Dokumentasi
        'style',    // Formatting, missing semi colons, etc
        'refactor', // Refactoring code
        'test',     // Menambah atau memperbaiki test
        'chore',    // Maintenance, dependencies
        'perf',     // Performance improvement
        'ci',       // CI/CD changes
        'build',    // Build system changes
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};
