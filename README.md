# Marketpleace - Sistem Manajemen Marketplace

Sistem manajemen marketplace lengkap dengan dashboard admin, manajemen produk, inventory, penjualan, dan laporan.

## 🚀 Fitur Utama

### Admin Dashboard
- ✅ Manajemen Produk & Kategori
- ✅ Manajemen Inventory & Stok
- ✅ Manajemen Supplier & Gudang
- ✅ Manajemen Promosi & Voucher
- ✅ Manajemen Pengguna & Karyawan
- ✅ Laporan Keuangan & Penjualan
- ✅ Manajemen Pesanan & Pembelian

### Customer Features
- ✅ Pencarian dan Filter Produk
- ✅ Keranjang Belanja & Checkout
- ✅ Sistem Poin & Reward
- ✅ Wishlist & Favorit
- ✅ Riwayat Transaksi

### Teknologi
- **Framework**: Next.js 16.1.1 dengan App Router
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS
- **Testing**: Vitest, Playwright
- **Notifications**: React Hot Toast
- **PWA**: Next-PWA
- **Error Tracking**: Sentry
- **Code Quality**: ESLint, Prettier, Husky, Commitlint

## 🛠️ Setup Development

### Prerequisites
- Node.js 18+
- Firebase Project
- Environment Variables

### Installation

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd marketpleace-new
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   
   Ini akan otomatis setup Husky pre-commit hooks via `prepare` script.

3. **Setup environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Isi variabel environment di `.env.local`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   
   # Firebase Admin (untuk server-side operations)
   FIREBASE_ADMIN_CLIENT_EMAIL=your_admin_email
   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

4. **Setup Firebase**
   - Buat project di [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication, Firestore Database, Storage
   - Tambahkan web app dan dapatkan config
   - Download service account key untuk admin operations

5. **Run development server**
   ```bash
   npm run dev
   ```

## 📁 Struktur Project

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # Dashboard Admin
│   │   ├── products/      # Manajemen Produk
│   │   ├── inventory/     # Manajemen Inventory
│   │   ├── orders/        # Manajemen Pesanan
│   │   ├── reports/       # Laporan
│   │   └── settings/      # Pengaturan
│   ├── cart/              # Keranjang Belanja
│   ├── products/          # Halaman Produk
│   ├── profil/            # Autentikasi User
│   └── api/               # API Routes
├── components/            # Shared Components
│   ├── ErrorBoundary.tsx  # React Error Boundary
│   ├── LoadingFallback.tsx # Loading State Components
│   └── ...
├── lib/                   # Utilities & Services
│   ├── firebase.ts        # Firebase Configuration
│   ├── auth.ts           # Authentication Helpers
│   ├── notify.ts         # Notification System
│   └── types.ts          # TypeScript Definitions
├── utils/                 # Utility Functions
│   └── retry.ts          # Retry Mechanism with Exponential Backoff
└── test/                  # Test Setup
    └── setup.ts
scripts/
├── migrate.js            # Database Migration Script
├── seed-database.js      # Comprehensive Seeding Script
├── backup.js             # Backup Script
└── restore.js            # Restore Script
docs/
├── BACKUP_STRATEGY.md    # Backup & Recovery Documentation
└── DEVELOPER_TOOLS.md    # Developer Tools Documentation
```

## 🧪 Testing

### Unit Tests
```bash
npm test           # Run all tests in watch mode
npm run test:unit  # Run unit tests once
```

### E2E Tests
```bash
npm run test:e2e   # Run Playwright tests
```

### Coverage
```bash
npm run test:unit -- --coverage  # Generate coverage report
```

## 🔧 Developer Tools

### Code Quality

#### Prettier - Code Formatter
```bash
npm run format        # Format all files
npm run format:check  # Check formatting
```

#### ESLint - Linter
```bash
npm run lint          # Run linter
npm run lint:fix      # Auto-fix issues
```

#### Pre-commit Hooks (Husky + lint-staged)
Otomatis run linter dan formatter sebelum commit:
```bash
git add .
git commit -m "feat: add new feature"
# Husky akan auto-run lint-staged
```

#### Conventional Commits (Commitlint)
Format commit message yang enforced:
```bash
git commit -m "feat: add retry mechanism"
git commit -m "fix(purchases): handle error gracefully"
git commit -m "docs: update README"
```

**Types**: feat, fix, docs, style, refactor, test, chore, perf, ci, build

---

### Database Management

#### Migrations
```bash
npm run migrate up      # Run pending migrations
npm run migrate down    # Rollback last migration
npm run migrate status  # Check migration status
```

#### Seeding
```bash
npm run seed all                # Seed all data
npm run seed products           # Seed products only
npm run seed categories         # Seed categories only
npm run seed clear products     # Clear specific collection
```

#### Backup & Restore
```bash
# Backup
npm run backup:full                          # Backup all collections
npm run backup:collection products orders    # Backup specific collections

# Restore
npm run restore products ./backups/.../products.json
npm run restore all ./backups/2024-01-15_14-30-00/
```

📖 **Lengkap**: Lihat [Developer Tools Documentation](./docs/DEVELOPER_TOOLS.md) dan [Backup Strategy](./docs/BACKUP_STRATEGY.md)

---

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Firestore Rules
Project ini menggunakan `firestore.rules` untuk membatasi akses:
- User hanya bisa membaca pesanan miliknya sendiri.
- User tidak bisa mengubah status pembayaran (diupdate oleh server/webhook).

Jika kamu memakai Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

### Environment Variables Production
Pastikan semua environment variables sudah diset untuk production:
- `NEXT_PUBLIC_*` variables untuk frontend
- Firebase service account untuk backend

## 📊 Scripts Available

### Development
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Production server

### Code Quality
- `npm run lint` - ESLint checking
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - TypeScript type checking

### Testing
- `npm test` - Run all tests in watch mode
- `npm run test:unit` - Run unit tests once
- `npm run test:e2e` - Run E2E tests

### Database
- `npm run migrate up` - Run database migrations
- `npm run migrate down` - Rollback migrations
- `npm run migrate status` - Check migration status
- `npm run seed all` - Seed database with sample data
- `npm run backup:full` - Backup all collections
- `npm run restore` - Restore from backup

## 🔧 Configuration

### Firebase Setup
1. Enable Email/Password authentication
2. Setup Firestore Database rules
3. Configure Storage security rules
4. Setup Indexes untuk query yang kompleks

### PWA Configuration
Project sudah configured sebagai PWA dengan:
- Offline support
- Push notifications
- Install to home screen

### Error Handling
- **React Error Boundary**: Menangkap runtime errors di komponen
- **Retry Mechanism**: Automatic retry untuk failed API calls dengan exponential backoff
- **Sentry Integration**: Error tracking dan monitoring
- **User-friendly Fallbacks**: Loading states dan error UI yang informatif

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run quality checks:
   ```bash
   npm run lint:fix
   npm run format
   npm run typecheck
   npm run test:unit
   ```
5. Commit dengan conventional commits:
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🆘 Support

Untuk pertanyaan dan support:
- Buat issue di GitHub
- Email: support@marketpleace.com
- Documentation: 
  - [Developer Tools Guide](./docs/DEVELOPER_TOOLS.md)
  - [Backup Strategy](./docs/BACKUP_STRATEGY.md)

---

**Dibangun dengan ❤️ menggunakan Next.js, Firebase, dan modern developer tools**
