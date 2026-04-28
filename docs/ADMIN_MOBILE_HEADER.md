# Admin Mobile Header - Modern Navigation

## 📱 Deskripsi

Komponen **AdminMobileHeader** adalah navigasi mobile modern untuk admin dashboard yang terinspirasi dari desain TikTok/Lark. Komponen ini memberikan pengalaman pengguna yang lebih baik di perangkat mobile dengan fitur-fitur canggih.

## ✨ Fitur Utama

### 1. **Fixed Header dengan Search Bar Prominent**
- Header fixed di bagian atas layar
- Search bar yang mudah diakses untuk mencari menu
- Notifikasi badge real-time
- User profile dropdown

### 2. **Full-Screen Menu Modal**
- Animasi slide-up yang smooth
- Quick stats overview (Orders, Revenue, Stock)
- Menu items terorganisir berdasarkan kategori:
  - Overview
  - Sales
  - Inventory
  - Finance
  - Marketing
  - Communication
  - System

### 3. **Real-time Features**
- Unread message counter
- User profile integration
- Active route highlighting
- Search suggestions

### 4. **Modern UI/UX**
- Gradient backgrounds
- Smooth animations
- Touch-friendly buttons
- Glassmorphism effects
- Responsive design

## 🎨 Design Elements

### Header Structure
```
┌─────────────────────────────────────┐
│ [Menu] [Logo Admin] [Search ____] 🔔 👤 │
└─────────────────────────────────────┘
```

### Menu Modal Structure
```
┌─────────────────────────────────────┐
│  Menu Admin                    [X]  │
│  admin@example.com                  │
├─────────────────────────────────────┤
│  [Orders:24] [Revenue:8.2M] [Stock:12] │
├─────────────────────────────────────┤
│  OVERVIEW                           │
│  → Dashboard                        │
│  → Analytics                        │
│                                     │
│  SALES                              │
│  → Orders                           │
│  → Marketplace                      │
│  → Purchases                        │
│  ...                                │
├─────────────────────────────────────┤
│  Settings                           │
│  Logout                             │
└─────────────────────────────────────┘
```

## 🔧 Cara Penggunaan

Komponen sudah terintegrasi otomatis di `/admin/layout.tsx`:

```tsx
import AdminMobileHeader from '@/components/AdminMobileHeader';

export default function AdminLayout({ children }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex">...</aside>
      
      {/* Main Content */}
      <main>{children}</main>
      
      {/* Mobile Header */}
      <AdminMobileHeader />
    </div>
  );
}
```

## 📊 Menu Items

Total **20+ menu items** yang terorganisir dalam 7 kategori:

### Overview
- Dashboard (`/admin`)
- Analytics (`/admin/reports`)

### Sales
- Orders (`/admin/orders`)
- Marketplace (`/admin/marketplace-orders`)
- Purchases (`/admin/purchases`)

### Inventory
- Products (`/admin/products`)
- Inventory (`/admin/inventory`)
- Warehouses (`/admin/warehouses`)

### Finance
- Finance (`/admin/capital`)
- Wallet (`/admin/wallet`)
- Expenses (`/admin/operational-expenses`)

### Marketing
- Customers (`/admin/customers`)
- Promotions (`/admin/promotions`)
- Points (`/admin/points`)

### Communication
- Messages (`/admin/messages`)
- Notifications (`/admin/notifications`)

### System
- Audit Logs (`/admin/audit-logs`)
- Settings (`/admin/settings`)

## 🎯 Interaksi

### Search Functionality
1. Ketik di search bar header
2. Dropdown muncul dengan hasil pencarian
3. Klik item untuk navigasi langsung
4. Otomatis close setelah navigasi

### Menu Modal
1. Tap menu icon (☰) atau user avatar
2. Modal slide-up dari bawah
3. Scroll untuk melihat semua menu
4. Tap menu item untuk navigasi
5. Tap backdrop atau [X] untuk close

### Quick Stats
Menampilkan ringkasan real-time:
- **Orders**: Jumlah order baru
- **Revenue**: Total penjualan hari ini
- **Stock**: Produk dengan stok rendah

## 🎨 Styling

### Color Palette
- **Primary**: Green gradient (#10b981 → #059669)
- **User Avatar**: Blue-purple gradient (#3b82f6 → #9333ea)
- **Notifications**: Red badge (#ef4444)
- **Background**: White with subtle shadows

### Animations
```css
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Breakpoints
- **Mobile**: < 768px (md:hidden)
- **Desktop**: ≥ 768px (sidebar visible)

## 🔔 Notifikasi

Badge notifikasi menampilkan jumlah pesan belum dibaca:
- Counter real-time via Firebase Firestore listener
- Badge merah dengan angka
- Auto-hide jika count = 0
- Max display: "9+" untuk > 9 pesan

## 👤 User Profile

Menampilkan informasi user yang login:
- Email address dari Firestore
- Avatar dengan gradient background
- Quick access ke Settings & Logout

## 🚀 Performance Optimizations

1. **Conditional Rendering**: Hanya render di `/admin` routes
2. **Efficient Listeners**: Cleanup Firebase subscriptions
3. **Memoized Filters**: Search results cached
4. **Lazy Loading**: Menu modal hanya load saat dibuka

## 📱 Responsive Behavior

| Element | Mobile (<768px) | Desktop (≥768px) |
|---------|----------------|------------------|
| Header | ✅ Visible | ❌ Hidden |
| Menu Modal | ✅ Full-screen | ❌ N/A (use sidebar) |
| Search Bar | ✅ Prominent | ❌ In sidebar |
| Quick Stats | ✅ Top of menu | ❌ In dashboard |
| Sidebar | ❌ Hidden | ✅ Visible |

## 🛠️ Customization

### Adding New Menu Items
Edit array `navItems` di `AdminMobileHeader.tsx`:

```typescript
const navItems: NavItem[] = [
  { 
    label: 'New Feature', 
    href: '/admin/new-feature', 
    icon: NewIcon, 
    category: 'Category' 
  },
  // ... existing items
];
```

### Changing Categories
Update array categories di JSX:
```typescript
['Overview', 'Sales', 'Inventory', 'Finance', 'Marketing', 'Communication', 'System']
```

### Modifying Quick Stats
Edit section "Quick Stats" untuk menampilkan data berbeda:
```tsx
<div className="grid grid-cols-3 gap-3">
  {/* Custom stats here */}
</div>
```

## 🐛 Troubleshooting

**Masalah**: Menu tidak muncul
- **Solusi**: Pastikan pathname dimulai dengan `/admin`

**Masalah**: Search tidak berfungsi
- **Solusi**: Cek console untuk error, pastikan navItems terisi

**Masalah**: Notifikasi badge tidak update
- **Solusi**: Verifikasi Firebase connection dan query messages

**Masalah**: Animasi tidak smooth
- **Solusi**: Cek browser support untuk CSS animations

## 📚 Related Components

- [`AdminMobileNav`](./AdminMobileNav.tsx) - Versi lama (deprecated)
- [`Sidebar`](../app/admin/layout.tsx) - Desktop navigation
- [`ErrorBoundary`](./ErrorBoundary.tsx) - Error handling

## 🎯 Best Practices

1. **Keep it Simple**: Jangan tambah terlalu banyak menu items
2. **Prioritize Speed**: Animasi harus < 300ms
3. **Touch Targets**: Minimum 44x44px untuk buttons
4. **Accessibility**: Semua interactive elements harus punya aria-labels
5. **Performance**: Avoid heavy computations in render

## 🔄 Migration from Old Component

Jika masih menggunakan `AdminMobileNav`:

1. Hapus import lama:
   ```tsx
   // Remove: import AdminMobileNav from '@/components/AdminMobileNav';
   ```

2. Tambah import baru:
   ```tsx
   import AdminMobileHeader from '@/components/AdminMobileHeader';
   ```

3. Ganti component usage:
   ```tsx
   // Change: <AdminMobileNav />
   // To: <AdminMobileHeader />
   ```

---

**Created**: 2026-04-28  
**Last Updated**: 2026-04-28  
**Version**: 1.0.0
