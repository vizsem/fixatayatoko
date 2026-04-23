# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- React Error Boundary component untuk menangkap runtime errors secara graceful
- Retry mechanism dengan exponential backoff untuk API calls (`src/utils/retry.ts`)
- Loading fallback components untuk berbagai contexts (page, card, table, form, skeleton)
- Prettier configuration untuk code formatting consistency
- Husky + lint-staged pre-commit hooks untuk automated code quality checks
- Commitlint dengan conventional commits enforcement
- Database migration script (`scripts/migrate.js`) dengan version tracking dan rollback support
- Comprehensive database seeding script (`scripts/seed-database.js`)
- Backup and restore scripts untuk Firestore collections
- Complete backup strategy documentation (`docs/BACKUP_STRATEGY.md`)
- Developer tools documentation (`docs/DEVELOPER_TOOLS.md`)
- New npm scripts: `format`, `lint:fix`, `migrate`, `seed`, `backup:*`, `restore`

### Changed
- Removed console.error from purchases page error handling (production best practice)
- Updated README.md dengan comprehensive developer tools documentation
- Enhanced package.json dengan new dependencies dan scripts

### Improved
- Error handling sekarang menggunakan Sentry integration untuk production monitoring
- User-friendly error messages dengan retry options
- Automated code quality enforcement via pre-commit hooks

## [0.2.1] - 2024-01-15

### Fixed
- Purchase status update error handling
- Console error cleanup in admin pages

## [0.2.0] - 2024-01-10

### Added
- Purchase order management system
- Inventory tracking with atomic operations
- Double-entry bookkeeping for financial transactions
- Payment tracking with partial payment support
- Supplier management
- Warehouse management

### Improved
- Performance optimization for large datasets
- Firebase transaction handling

## [0.1.0] - 2024-01-01

### Added
- Initial project setup with Next.js 16
- Firebase integration (Auth, Firestore, Storage)
- Admin dashboard with product management
- Customer-facing storefront
- Shopping cart functionality
- Order management
- Basic inventory system
- PWA support
- Mobile-responsive design
- Authentication system
- Role-based access control (admin, cashier, customer)

---

## Version Guidelines

### Semantic Versioning

Given a version number MAJOR.MINOR.PATCH:

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backward compatible manner
- **PATCH** version when you make backward compatible bug fixes

### Pre-release Versions

Additional labels for pre-release and build metadata are available as extensions to the MAJOR.MINOR.PATCH format.

Examples:
- `1.0.0-alpha.1`
- `1.0.0-beta.2`
- `1.0.0-rc.3`

---

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages which allows us to automatically generate changelogs.

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries
- `ci`: Changes to CI configuration files and scripts

### Examples

```
feat: add retry mechanism for API calls
fix(purchases): remove console.error from error handling
docs: update backup strategy documentation
refactor(auth): simplify authentication flow
test: add unit tests for inventory module
chore: update dependencies
```

---

**For maintainers**: Remember to update this changelog with every release, following the format above.
