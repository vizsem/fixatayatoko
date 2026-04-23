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
- ✅ **Push Notifications (FCM)** - Real-time notifications di browser/mobile
- ✅ **Multi-channel Delivery** - Kirim melalui email, SMS, atau push notification

### Teknologi
- **Framework**: Next.js 16.1.1 dengan App Router
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS
- **Testing**: Vitest, Playwright
- **Notifications**: React Hot Toast, Nodemailer, Twilio, FCM
- **PWA**: Next-PWA
- **Error Tracking**: Sentry
- **Code Quality**: ESLint, Prettier, Husky, Commitlint

## 🛠️ Setup Development

### Prerequisites
- Node.js 18+
- Firebase Project
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
   # Firebase Configuration (Client-side)
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   
   # Firebase Admin (untuk server-side operations)
   FIREBASE_ADMIN_CLIENT_EMAIL=your_admin_email
   FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   
   # Email Configuration (SMTP)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM_EMAIL=noreply@atayatoko.com
   
   # SMS Configuration (Twilio)
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   
   # Application URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Setup Firebase**
   - Buat project di [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication, Firestore Database, Storage, Cloud Messaging
   - Tambahkan web app dan dapatkan config
   - Download service account key untuk admin operations
   - Generate Web Push Certificate untuk FCM

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
│   ├── emailService.ts           # Email notifications
│   ├── smsService.ts             # SMS notifications
│   ├── pushNotificationService.ts # FCM push notifications
│   ├── notificationService.ts    # Unified notification layer
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

### Push Notifications (FCM)
- Real-time order updates
- Chat message notifications
- Promotional campaigns

**Usage:**
```typescript
import { sendOrderConfirmationPush } from '@/lib/pushNotificationService';

await sendOrderConfirmationPush(userId, order);
```

### Unified Notification Service
Kirim melalui multiple channels sekaligus:

```typescript
import notificationService from '@/lib/notificationService';

const results = await notificationService.sendOrderConfirmationNotification({
  id: 'ORDER123',
  userId: 'user-uid',
  customerEmail: 'customer@example.com',
  customerPhone: '+6281234567890',
  customerName: 'John Doe',
  total: 150000,
  items: [...],
  paymentStatus: 'LUNAS'
});

// Results: { email: true, sms: true, push: true }
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

### Firebase Rules & Indexes
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 📚 Documentation

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
