# Troubleshooting AdminMobileHeader

## 🐛 Masalah: Menu Mobile Tidak Muncul

### Gejala:
- Tombol menu hamburger (☰) terlihat tapi tidak bisa diklik
- Menu modal tidak muncul saat tombol ditekan
- Header mobile tidak tampil sama sekali

### Solusi:

#### 1. **Pastikan Komponen Render di Route yang Benar**

Komponen `AdminMobileHeader` hanya render di route `/admin`:

```typescript
if (!pathname || !pathname.startsWith('/admin')) {
  return null;
}
```

**Cek:** Buka browser console dan pastikan pathname dimulai dengan `/admin`.

#### 2. **Periksa Z-Index Layering**

Menu modal menggunakan `z-[9999]` untuk memastikan berada di atas semua elemen lain:

```tsx
<div className="fixed inset-0 z-[9999] md:hidden">
```

**Jika masih tertutup:**
- Cek apakah ada elemen dengan z-index lebih tinggi
- Pastikan tidak ada `position: relative/absolute` parent yang membatasi stacking context

#### 3. **Debug State Changes**

Komponen sudah dilengkapi debug log:

```javascript
useEffect(() => {
  console.log('AdminMobileHeader - isMenuOpen changed:', isMenuOpen);
}, [isMenuOpen]);
```

**Cara cek:**
1. Buka browser DevTools (F12)
2. Buka tab Console
3. Klik tombol menu hamburger
4. Lihat log: "AdminMobileHeader - isMenuOpen changed: true"

#### 4. **Periksa Event Handler**

Tombol menu memiliki handler:

```tsx
<button
  type="button"
  onClick={() => setIsMenuOpen(true)}
  className="... touch-manipulation"
>
```

**Class `touch-manipulation`:** Mencegah double-tap zoom di mobile browsers.

#### 5. **Cek Responsive Breakpoint**

Header hanya tampil di mobile (< 768px):

```tsx
<header className="... md:hidden">
```

**Test:**
- Resize browser window ke < 768px
- Atau gunakan Device Toolbar di Chrome DevTools (Ctrl+Shift+M)

#### 6. **Clear Cache & Hard Reload**

Kadang browser cache menyebabkan komponen lama masih digunakan:

```bash
# Di browser:
# Chrome: Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac)
# Firefox: Ctrl+F5
```

#### 7. **Periksa Firebase Auth**

Komponen mencoba fetch user profile dari Firestore:

```typescript
useEffect(() => {
  const fetchUserProfile = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      // ...
    }
  };
  fetchUserProfile();
}, []);
```

**Jika error:** Cek console untuk error Firebase permission denied.

### Debugging Checklist:

- [ ] Browser console tidak ada error merah
- [ ] Pathname URL dimulai dengan `/admin`
- [ ] Viewport width < 768px (mobile)
- [ ] Tombol menu visible dan clickable
- [ ] Console log menunjukkan state change saat klik
- [ ] Tidak ada overlay element yang menutupi header
- [ ] User sudah login (auth.currentUser !== null)

### Quick Fix Commands:

```bash
# Rebuild project
npm run build

# Clear Next.js cache
rm -rf .next

# Restart dev server
npm run dev

# Check for TypeScript errors
npx tsc --noEmit
```

### Alternative: Test dengan Component Sederhana

Jika masih bermasalah, test dengan versi minimal:

```tsx
export default function TestMobileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-red-500 p-4 z-50">
      <button onClick={() => setIsOpen(!isOpen)}>
        Toggle Menu: {isOpen ? 'OPEN' : 'CLOSED'}
      </button>
      {isOpen && <div className="mt-4 bg-white p-4">MENU CONTENT</div>}
    </div>
  );
}
```

Jika versi sederhana ini bekerja, berarti masalahnya ada di logic kompleks AdminMobileHeader.

---

**Last Updated:** 2026-04-28
