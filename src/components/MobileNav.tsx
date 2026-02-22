'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Grid3X3,
  ShoppingCart,
  FileText,
  User,
} from 'lucide-react';

export default function MobileNav() {
  const pathname = usePathname() || '/';
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const updateCartCount = () => {
      try {
        const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
        const count = savedCart.reduce(
          (sum: number, item: { quantity: number | string }) =>
            sum + (Number(item.quantity) || 0),
          0
        );
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };

    updateCartCount();
    window.addEventListener('cart-updated', updateCartCount);
    return () => window.removeEventListener('cart-updated', updateCartCount);
  }, []);

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cashier') ||
    pathname === '/profil/login' ||
    pathname === '/profil/register'
  ) {
    return null;
  }

  const navItems = [
    { href: '/', label: 'Beranda', icon: Home },
    { href: '/semua-kategori', label: 'Kategori', icon: Grid3X3 },
    { href: '/orders', label: 'Pesanan', icon: FileText },
    { href: '/cart', label: 'Keranjang', icon: ShoppingCart },
    { href: '/profil', label: 'Akun', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-8px_24px_rgba(15,23,42,0.10)] md:hidden page-fade">
      <div className="max-w-4xl mx-auto px-3 py-1.5 flex items-center justify-between gap-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-slate-500'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  size={18}
                  className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'}
                />
                {item.href === '/cart' && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-black text-white flex items-center justify-center border border-white">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-black uppercase tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
