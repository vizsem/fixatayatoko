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
   ```

4. **Setup Firebase**
   - Buat project di [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication, Firestore Database, Storage
   - Tambahkan web app dan dapatkan config

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
├── lib/                   # Utilities & Services
│   ├── firebase.ts        # Firebase Configuration
│   ├── auth.ts           # Authentication Helpers
│   ├── notify.ts         # Notification System
│   └── types.ts          # TypeScript Definitions
└── utils/                 # Utility Functions
```

## 🧪 Testing

### Unit Tests
```bash
npm test           # Run all tests
npm run test:unit  # Run unit tests only
```

### E2E Tests
```bash
npm run test:e2e   # Run Playwright tests
```

### Coverage
```bash
npm run test:coverage  # Generate coverage report
```

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

- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Production server
- `npm run lint` - ESLint checking
- `npm run typecheck` - TypeScript checking
- `npm test` - Run all tests
- `npm run test:unit` - Run unit tests
- `npm run test:e2e` - Run E2E tests

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

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see LICENSE file for details.

## 🆘 Support

Untuk pertanyaan dan support:
- Buat issue di GitHub
- Email: support@marketpleace.com
- Documentation: [Docs](https://docs.marketpleace.com)

---

**Dibangun dengan ❤️ menggunakan Next.js dan Firebase**
