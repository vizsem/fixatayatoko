# Marketpleace - Sistem Manajemen Marketplace

Sistem manajemen marketplace lengkap dengan dashboard admin, manajemen produk, inventory, penjualan, notifikasi multi-channel, dan real-time chat support.

## 🚀 Fitur Utama

### Admin Dashboard
- ✅ Manajemen Produk & Kategori
- ✅ Manajemen Inventory & Stok
- ✅ Manajemen Supplier & Gudang
- ✅ Manajemen Promosi & Voucher
- ✅ Manajemen Pengguna & Karyawan
- ✅ Laporan Keuangan & Penjualan
- ✅ Manajemen Pesanan & Pembelian
- ✅ **Real-time Chat Support** - Komunikasi langsung dengan pelanggan

### Customer Features
- ✅ Pencarian dan Filter Produk
- ✅ Keranjang Belanja & Checkout
- ✅ Sistem Poin & Reward
- ✅ Wishlist & Favorit
- ✅ Riwayat Transaksi
- ✅ **Floating Chat Button** - Chat customer support kapan saja

### Notification System
- ✅ **Email Notifications** - Order confirmation, password reset, shipping updates
- ✅ **SMS Notifications** - OTP, order updates, payment reminders
- 🚧 **Push Notifications (FCM)** - Belum aktif; masih stub di `src/lib/fcm.ts`
- ✅ **Multi-channel Delivery** - Email (`emailService.ts`) & SMS (`smsService.ts`)

### Teknologi
- **Framework**: Next.js 16.1.6 dengan App Router (React 19)
- **Database**: Supabase Postgres (data layer utama)
- **Authentication**: Supabase Auth
- **ORM**: Prisma (skema ERP di `prisma/schema.prisma`)
- **Styling**: Tailwind CSS 3.4
- **Testing**: Vitest, Playwright
- **Notifications**: React Hot Toast, Nodemailer, Twilio
- **PWA**: Next-PWA
- **Error Tracking**: Sentry
- **Code Quality**: ESLint, Prettier, Husky, Commitlint

> ⚠️ **Status migrasi**: kode masih mengakses Supabase melalui *compatibility bridge*
> Firestore di `src/lib/firebase.ts`. Paket `firebase` sudah tidak terpasang.
> Lihat [docs/MIGRATION_STATUS.md](./docs/MIGRATION_STATUS.md) untuk detail dan rencana.

## 🛠️ Setup Development

### Prerequisites
- Node.js 18+
- Supabase Project
- Email Service (Gmail SMTP atau lainnya)
- SMS Service (Twilio)
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
   # Supabase (Data layer utama - WAJIB)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxx

   # Kunci rahasia untuk operasi server-side (bypass RLS). JANGAN beri prefix NEXT_PUBLIC_
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxxxxxx

   # Koneksi Postgres langsung (Prisma & tooling migrasi)
   DATABASE_URL=postgresql://postgres:password@db.your-project-ref.supabase.co:5432/postgres

   # Email Configuration (SMTP - prefix WAJIB SMTP_)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM_EMAIL="ATAYATOKO <noreply@atayatoko.com>"

   # SMS Configuration (Twilio)
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890

   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```
   
   Lihat `.env.example` untuk daftar lengkap beserta komentar.
   
   **🔥 Verifikasi koneksi Supabase:**
   ```bash
   npm run verify:schema
   ```
   Perintah ini membandingkan tabel yang didefinisikan di `supabase/migrations/`
   dengan yang benar-benar ada di project Supabase remote.

4. **Setup Supabase**
   - Buat project di [Supabase Dashboard](https://supabase.com/dashboard)
   - Ambil URL + API keys di **Project Settings → API Keys**
   - Apply migrasi yang ada di `supabase/migrations/`:
     - **Opsi A (tercepat):** buka **SQL Editor**, tempel isi tiap file migrasi, klik **Run**
     - **Opsi B (CLI):** `supabase link --project-ref <ref>` lalu `supabase db push`
   - Enable Storage bucket untuk upload gambar produk
   - Jalankan `npm run verify:schema` sampai semua tabel berstatus ada

5. **Setup Email (Gmail Example)**
   - Enable 2-Factor Authentication di Google Account
   - Generate App Password: https://myaccount.google.com/apppasswords
   - Gunakan App Password di `SMTP_PASS`

6. **Setup SMS (Twilio)**
   - Daftar di https://www.twilio.com/
   - Beli phone number
   - Get Account SID dan Auth Token dari Console

7. **Test Notifications**
   ```bash
   # Test email
   npm run test:email
   
   # Test SMS
   npm run test:sms
   ```

8. **Run development server**
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
│   │   ├── settings/      # Pengaturan
│   │   └── chat/          # Admin Chat Interface
│   ├── cart/              # Keranjang Belanja
│   ├── products/          # Halaman Produk
│   ├── profil/            # Autentikasi User
│   ├── chat/              # Customer Chat Page
│   └── api/               # API Routes
├── components/            # Shared Components
│   ├── AdminChatInterface.tsx    # Admin chat UI
│   ├── CustomerChat.tsx          # Customer chat UI
│   ├── FloatingChatButton.tsx    # Floating chat widget
│   ├── ErrorBoundary.tsx         # React error boundary
│   └── LoadingFallback.tsx       # Loading states
├── lib/                   # Business Logic & Services
│   ├── emailService.ts           # Email notifications (butuh SMTP_* env)
│   ├── smsService.ts             # SMS notifications (Twilio)
│   ├── fcm.ts                    # FCM push - STUB, belum diimplementasikan
│   ├── notify.ts                 # Toast/UI notification helpers (react-hot-toast)
│   ├── inventory.ts              # Inventory management
│   ├── ledger.ts                 # Accounting
│   └── types.ts                  # TypeScript types
├── utils/                 # Utility Functions
│   └── retry.ts                  # Retry mechanism
└── hooks/                 # Custom React Hooks
```

## 🔔 Notification System

### Email Notifications
- Order confirmation
- Password reset
- Shipping updates
- Order delivered
- Welcome emails

**Usage:**
```typescript
import { sendOrderConfirmation } from '@/lib/emailService';

await sendOrderConfirmation({
  id: 'ORDER123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  total: 150000,
  items: [...],
  paymentStatus: 'LUNAS'
});
```

### SMS Notifications
- Order confirmation
- OTP verification
- Payment reminders
- Shipping updates

**Usage:**
```typescript
import { sendOTPSMS } from '@/lib/smsService';

await sendOTPSMS('+6281234567890', '123456');
```

### Push Notifications (FCM) - 🚧 BELUM AKTIF
Fitur ini **belum diimplementasikan**. `src/lib/fcm.ts` hanya berisi stub yang
mengembalikan `null`, dan paket `firebase` tidak terpasang. `FCMManager` di
`src/components/` saat ini tidak melakukan apa pun.

```typescript
// src/lib/fcm.ts - kondisi saat ini
export const requestForToken = async (_force = false) => null;
export const onMessageListener = () => new Promise(() => { /* no-op */ });
```

Untuk mengaktifkan kembali, perlu: pasang paket `firebase`, isi `NEXT_PUBLIC_FIREBASE_*`,
dan implementasikan `requestForToken` / `onMessageListener`.

### Unified Notification Service
> Tidak ada satu service terpadu yang mengirim email + SMS sekaligus.
> Panggil service yang sesuai secara langsung.

**Email** - `src/lib/emailService.ts` (butuh env `SMTP_*`):
```typescript
import {
  sendEmail,
  sendOrderConfirmation,
  sendPasswordReset,
  sendShippingNotification,
  sendOrderDelivered,
  sendWelcomeEmail,
} from '@/lib/emailService';

await sendOrderConfirmation(order);
await sendPasswordReset('user@example.com', resetToken);
```

**SMS** - `src/lib/smsService.ts` (butuh env `TWILIO_*`):
```typescript
import {
  sendSMS,
  sendOrderConfirmationSMS,
  sendShippingSMS,
  sendOTPSMS,
  sendPaymentReminderSMS,
  sendDeliveryConfirmationSMS,
  sendPromotionalSMS,
} from '@/lib/smsService';

await sendOTPSMS('+6281234567890', '123456');
```

**Toast UI** - `src/lib/notify.ts` (react-hot-toast, bukan pengiriman notifikasi):
```typescript
import { notify } from '@/lib/notify';

notify.success('Data berhasil disimpan!');
notify.admin.error('Gagal menyimpan produk.');
```

## 💬 Chat System

### Customer Chat
- Floating chat button di bottom-right corner
- Real-time messaging dengan admin
- Image upload support (coming soon)
- Responsive design (mobile & desktop)
- Modal interface untuk quick access

### Admin Chat Interface
- Multi-thread management
- Real-time message updates
- Browser notifications untuk pesan baru
- Sound alerts
- Unread message tracking
- Search conversations

**Access:**
- Customers: Klik floating chat button atau kunjungi `/chat`
- Admins: Kunjungi `/admin/chat`

## 📊 Testing & Quality

### Run Tests
```bash
# Unit tests
npm run test:unit

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage

# Test email configuration
npm run test:email

# Test SMS configuration
npm run test:sms
```

### Code Quality
```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Format code
npm run format

# Check formatting
npm run format:check
```

## 🗄️ Database Management

### Migrations
```bash
# Run pending migrations
npm run migrate up

# Rollback last migration
npm run migrate down

# Check migration status
npm run migrate status
```

### Seeding
```bash
# Seed all data
npm run seed all

# Seed specific collection
npm run seed categories
npm run seed products

# Clear collection
npm run seed clear products

# Clear all (dangerous!)
CONFIRM_CLEAR_ALL=yes npm run seed clear-all
```

### Backup & Restore
```bash
# Full backup
npm run backup:full

# Backup specific collections
npm run backup:collection users orders products

# Restore from backup
npm run restore all ./backups/2026-04-24_12-00-00/
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
vercel --prod
```

### Supabase Migrations & Schema
```bash
# Verifikasi tabel di Supabase remote vs file migrasi
npm run verify:schema

# Apply migrasi via CLI (butuh link ke project)
supabase link --project-ref <project-ref>
supabase db push
```
Alternatif tanpa CLI: buka **Supabase Dashboard → SQL Editor**, tempel isi file
di `supabase/migrations/`, lalu **Run**.

## 📚 Documentation

- **[Migration Status](docs/MIGRATION_STATUS.md)** - Status & rencana migrasi Firebase → Supabase
- **[Notification & Chat System](docs/NOTIFICATION_AND_CHAT_SYSTEM.md)** - Complete guide untuk notifikasi dan chat
- **[Developer Tools](docs/DEVELOPER_TOOLS.md)** - Developer tools dan utilities
- **[Backup Strategy](docs/BACKUP_STRATEGY.md)** - Backup dan recovery procedures
- **[Contributing Guide](CONTRIBUTING.md)** - Cara berkontribusi ke project

## 🔧 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type check |
| `npm run format` | Format code with Prettier |
| `npm run test:unit` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:email` | Test email configuration |
| `npm run test:sms` | Test SMS configuration |
| `npm run migrate up` | Run database migrations |
| `npm run seed all` | Seed database with sample data |
| `npm run backup:full` | Backup all collections |
| `npm run restore` | Restore from backup |

## 🤝 Contributing

Kami menerima kontribusi! Silakan baca [Contributing Guide](CONTRIBUTING.md) untuk detailnya.

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detailnya.

## 👥 Support

Untuk pertanyaan atau bantuan:
- 📖 Baca dokumentasi di folder `docs/`
- 🐛 Report issues di GitHub Issues
- 💬 Diskusi di GitHub Discussions

---

**Dibuat dengan ❤️ oleh ATAYATOKO Team**
