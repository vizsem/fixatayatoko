# Developer Tools & Scripts Documentation

Dokumen ini menjelaskan semua developer tools, scripts, dan utilities yang tersedia dalam proyek ATAYATOKO.

## 📋 Daftar Isi
- [Code Quality Tools](#code-quality-tools)
- [Database Management](#database-management)
- [Backup & Recovery](#backup--recovery)
- [Testing](#testing)
- [Development Workflow](#development-workflow)

---

## Code Quality Tools

### 1. Prettier - Code Formatter

**Tujuan**: Menjaga konsistensi formatting code di seluruh project.

**Usage**:
```bash
# Format semua files
npm run format

# Check formatting tanpa mengubah files
npm run format:check
```

**Configuration**: `.prettierrc`
- Single quotes
- Trailing commas (ES5)
- Print width: 100 characters
- Tab width: 2 spaces
- Semicolons required

**Files Ignored**: Lihat `.prettierignore`

---

### 2. ESLint - Linter

**Tujuan**: Menangkap potential bugs dan enforce coding standards.

**Usage**:
```bash
# Run linter
npm run lint

# Auto-fix fixable issues
npm run lint:fix
```

---

### 3. Husky + lint-staged - Pre-commit Hooks

**Tujuan**: Otomatis run linter dan formatter sebelum commit untuk mencegah code quality issues masuk ke repository.

**Cara Kerja**:
1. Developer stage changes (`git add`)
2. Developer commit (`git commit -m "message"`)
3. Husky triggers pre-commit hook
4. lint-staged runs ESLint dan Prettier hanya pada staged files
5. Jika ada errors, commit dibatalkan
6. Jika success, commit proceeds

**Setup** (otomatis saat install dependencies):
```bash
npm install
# Husky akan otomatis setup via "prepare" script
```

**Configuration**:
- `.husky/pre-commit` - Runs lint-staged
- `.husky/commit-msg` - Validates commit message format
- `lint-staged.config.json` - Defines which tools run on which files

---

### 4. Commitlint - Conventional Commits

**Tujuan**: Enforce consistent commit message format untuk changelog generation dan better collaboration.

**Format**:
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Allowed Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc (no code change)
- `refactor`: Code refactoring
- `test`: Adding or fixing tests
- `chore`: Maintenance tasks, dependencies
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes

**Examples**:
```bash
✅ Good:
git commit -m "feat: add retry mechanism for API calls"
git commit -m "fix(purchases): remove console.error from error handling"
git commit -m "docs: update backup strategy documentation"

❌ Bad:
git commit -m "fix stuff"
git commit -m "update"
git commit -m "WIP"
```

**Validation**:
Commit message akan divalidasi otomatis oleh Husky hook. Jika format salah, commit akan ditolak dengan error message yang jelas.

---

## Database Management

### 1. Migration Scripts

**File**: `scripts/migrate.js`

**Tujuan**: Manage database schema changes secara versioned dan reversible.

**Usage**:
```bash
# Run all pending migrations
npm run migrate up

# Rollback last migration
npm run migrate down

# Check migration status
npm run migrate status
```

**Adding New Migration**:

Edit `scripts/migrate.js` dan tambahkan ke array `migrations`:

```javascript
{
  id: '003-your-migration-name',
  description: 'Deskripsi apa yang dilakukan migration',
  up: async () => {
    // Code untuk apply migration
    const productsRef = db.collection('products');
    // ... your logic
  },
  down: async () => {
    // Code untuk rollback migration
    // ... your rollback logic
  },
}
```

**Best Practices**:
- ✅ Selalu test migration di staging environment dulu
- ✅ Pastikan `down()` function bisa rollback perubahan
- ✅ Gunakan batch operations untuk large datasets
- ✅ Add proper error handling
- ✅ Document changes in migration description

**Tracking**:
Migration status disimpan di collection `migrations` di Firestore.

---

### 2. Seeding Scripts

**File**: `scripts/seed-database.js`

**Tujuan**: Populate database dengan sample data untuk development dan testing.

**Usage**:
```bash
# Seed all data
npm run seed all

# Seed specific collections
npm run seed categories
npm run seed warehouses
npm run seed suppliers
npm run seed products
npm run seed settings

# Clear specific collection
npm run seed clear products

# Clear ALL data (DANGEROUS - requires confirmation)
CONFIRM_CLEAR_ALL=yes npm run seed clear-all
```

**Sample Data Included**:
- **Categories**: 10 product categories (sembako, minyak, beras, dll)
- **Warehouses**: 2 warehouse locations
- **Suppliers**: 3 sample suppliers dengan contact info
- **Products**: 5 sample products dengan inventory layers
- **Settings**: Store configuration, payment methods, shipping info

**Customizing Seed Data**:

Edit arrays di bagian atas file `scripts/seed-database.js`:

```javascript
const categories = [
  // Add your categories here
];

const sampleProducts = [
  // Add your products here
];
```

**Use Cases**:
- 🆕 Fresh development environment setup
- 🧪 Testing new features
- 🎓 Onboarding new developers
- 🔄 Resetting staging environment

---

## Backup & Recovery

### 1. Backup Script

**File**: `scripts/backup.js`

**Tujuan**: Create JSON backups of Firestore collections untuk disaster recovery.

**Usage**:
```bash
# Backup all critical collections
npm run backup:full

# Backup specific collections
npm run backup:collection products orders customers
```

**Output**:
Backups disimpan di `./backups/YYYY-MM-DD_HH-MM-SS/` dengan struktur:
```
backups/
└── 2024-01-15_14-30-00/
    ├── products.json
    ├── orders.json
    ├── customers.json
    └── metadata.json
```

**Metadata File**:
```json
{
  "timestamp": "2024-01-15T14:30:00.000Z",
  "totalDocuments": 1234,
  "collections": ["products", "orders", "customers"],
  "failedCollections": [],
  "backupLocation": "./backups/2024-01-15_14-30-00"
}
```

**Automated Backups**:
Untuk production, setup automated daily backups dengan:
- Firebase native point-in-time recovery (enabled by default)
- Cloud Storage exports via Cloud Scheduler (lihat `docs/BACKUP_STRATEGY.md`)

---

### 2. Restore Script

**File**: `scripts/restore.js`

**Tujuan**: Restore data dari backup files ke Firestore.

**Usage**:
```bash
# Restore single collection
npm run restore products ./backups/2024-01-15_14-30-00/products.json

# Restore all collections from backup directory
npm run restore all ./backups/2024-01-15_14-30-00/
```

**Safety Features**:
- ⚠️ Confirmation prompt sebelum overwrite data
- 📊 Progress tracking selama restore
- 🔄 Batch processing (500 docs per batch) untuk memory efficiency
- ❌ Error handling dengan detailed logging
- ✅ Timestamp conversion (ISO string ↔ Firestore Timestamp)

**Recovery Scenarios**:
Lihat `docs/BACKUP_STRATEGY.md` untuk detailed recovery procedures.

---

## Testing

### Unit Tests (Vitest)

**Usage**:
```bash
# Run all tests in watch mode
npm run test

# Run tests once
npm run test:unit

# Run with coverage
npm run test:unit -- --coverage
```

**Test Files Location**: `src/**/*.test.ts`, `src/**/*.spec.ts`

**Coverage Thresholds**:
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

---

### E2E Tests (Playwright)

**Usage**:
```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run with UI mode
npx playwright test --ui
```

**Test Files Location**: `e2e/*.spec.ts`

**Tests Included**:
- Authentication flows
- Admin navigation
- Purchase and transfer workflows

---

## Development Workflow

### Daily Development

```bash
# 1. Start development server
npm run dev

# 2. Make your changes
# Edit files...

# 3. Format code (auto-run on commit, but can run manually)
npm run format

# 4. Run linter
npm run lint

# 5. Run tests
npm run test:unit

# 6. Commit changes (hooks will auto-validate)
git add .
git commit -m "feat: add new feature X"

# 7. Push to GitHub
git push origin main
```

### Before Pull Request

```bash
# Ensure everything is clean
npm run lint:fix
npm run format
npm run typecheck
npm run test:unit
npm run build

# All should pass without errors
```

### Database Changes

```bash
# 1. Create migration
# Edit scripts/migrate.js, add new migration

# 2. Test migration locally
npm run migrate up

# 3. Verify changes
# Check Firestore console

# 4. Commit migration
git add scripts/migrate.js
git commit -m "feat: add migration for new field Y"

# 5. For rollback capability
npm run migrate down  # Test rollback works
npm run migrate up    # Re-apply
```

### Seeding Fresh Database

```bash
# For new developer onboarding or reset
npm run seed all

# Verify data
# Check Firestore console
```

### Backup Before Major Changes

```bash
# Before risky operations (schema changes, bulk updates)
npm run backup:full

# Verify backup exists
ls -la backups/
```

---

## Troubleshooting

### Husky Hooks Not Working

```bash
# Reinstall husky
rm -rf .husky
npm install

# Verify hooks are executable
chmod +x .husky/*
```

### Commit Message Rejected

```bash
# Check commitlint config
cat commitlint.config.js

# Use correct format
git commit -m "type: description"
# Examples: feat, fix, docs, style, refactor, test, chore
```

### Migration Fails

```bash
# Check which migrations completed
npm run migrate status

# Fix the issue, then retry
npm run migrate up

# If needed, rollback
npm run migrate down
```

### Backup/Restore Issues

```bash
# Check Firebase Admin credentials
ls -la serviceAccountKey.json

# Verify .env.local has correct variables
cat .env.local | grep FIREBASE

# Check backup directory permissions
ls -la backups/
```

---

## Best Practices

### Git Workflow
1. ✅ Always pull latest before starting work
2. ✅ Create feature branches for new work
3. ✅ Write descriptive commit messages
4. ✅ Run tests before pushing
5. ✅ Backup before major changes

### Database Management
1. ✅ Always test migrations on staging first
2. ✅ Create rollback plans for migrations
3. ✅ Backup before schema changes
4. ✅ Document all schema changes
5. ✅ Monitor migration impact on performance

### Code Quality
1. ✅ Write tests for new features
2. ✅ Keep functions small and focused
3. ✅ Use TypeScript strictly (no `any`)
4. ✅ Follow existing code patterns
5. ✅ Review PRs thoroughly

---

## Additional Resources

- [Backup Strategy Documentation](./BACKUP_STRATEGY.md)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Last Updated**: January 2024  
**Maintained By**: Development Team
