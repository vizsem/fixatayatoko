'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  Search, 
  Bell, 
  User, 
  ChevronDown,
  X,
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Users,
  Settings,
  BarChart3,
  MessageCircle,
  CreditCard,
  History,
  Wallet,
  Star,
  Truck,
  Tag,
  Database,
  Warehouse,
  RefreshCcw,
  ArrowUpCircle,
  ArrowDownCircle,
  Banknote,
  Landmark,
  AlertTriangle
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import notify from '@/lib/notify';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  category?: string;
}

const navItems: NavItem[] = [
  // Dashboard & Overview
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, category: 'Overview' },
  { label: 'Analytics', href: '/admin/reports', icon: BarChart3, category: 'Overview' },
  
  // Orders & Sales
  { label: 'Orders', href: '/admin/orders', icon: ShoppingCart, category: 'Sales' },
  { label: 'Marketplace', href: '/admin/marketplace-orders', icon: ShoppingBag, category: 'Sales' },
  { label: 'Purchases', href: '/admin/purchases', icon: Truck, category: 'Sales' },
  
  // Products & Inventory
  { label: 'Products', href: '/admin/products', icon: Package, category: 'Inventory' },
  { label: 'Inventory', href: '/admin/inventory', icon: Database, category: 'Inventory' },
  { label: 'Warehouses', href: '/admin/warehouses', icon: Warehouse, category: 'Inventory' },
  
  // Finance
  { label: 'Finance', href: '/admin/capital', icon: Banknote, category: 'Finance' },
  { label: 'Wallet', href: '/admin/wallet', icon: Wallet, category: 'Finance' },
  { label: 'Expenses', href: '/admin/operational-expenses', icon: CreditCard, category: 'Finance' },
  
  // Customers & Marketing
  { label: 'Customers', href: '/admin/customers', icon: Users, category: 'Marketing' },
  { label: 'Promotions', href: '/admin/promotions', icon: Tag, category: 'Marketing' },
  { label: 'Points', href: '/admin/points', icon: Star, category: 'Marketing' },
  
  // Communication
  { label: 'Messages', href: '/admin/messages', icon: MessageCircle, category: 'Communication' },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell, category: 'Communication' },
  
  // System
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: History, category: 'System' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, category: 'System' },
];

export default function AdminMobileHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filteredItems, setFilteredItems] = useState<NavItem[]>([]);

  // Debug state changes
  useEffect(() => {
    console.log('AdminMobileHeader - isMenuOpen changed:', isMenuOpen);
  }, [isMenuOpen]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      }
    };
    fetchUserProfile();
  }, []);

  // Listen to unread messages
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'messages'),
      where('read', '==', false),
      where('recipientId', '==', auth.currentUser.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsub();
  }, []);

  // Filter items based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = navItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems([]);
    }
  }, [searchQuery]);

  if (!pathname || !pathname.startsWith('/admin')) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = '/profil/login';
    } catch (error) {
      notify.admin.error('Gagal logout');
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-[70] bg-white border-b border-gray-100 shadow-sm md:hidden">
        <div className="nav__inner flex items-center justify-between px-4 h-16">
          
          {/* Left Section: Menu Button + Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(true);
              }}
              className="nav__menu-button p-2 hover:bg-gray-50 rounded-xl transition-all active:scale-95 touch-manipulation relative z-[80]"
              aria-label="Menu"
            >
              <Menu size={24} className="text-gray-700" />
            </button>
            
            <Link href="/admin" className="nav__brand flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              <span className="font-black text-sm text-gray-900 tracking-tight">Admin</span>
            </Link>
          </div>

          {/* Center: Search Bar */}
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <input
                type="search"
                placeholder="Cari menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-green-500 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            </div>
          </div>

          {/* Right Section: Notifications + Profile */}
          <div className="flex items-center gap-2">
            <Link
              href="/admin/notifications"
              className="relative p-2 hover:bg-gray-50 rounded-xl transition-all"
              aria-label="Notifications"
            >
              <Bell size={20} className="text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(true);
              }}
              className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-xl transition-all relative z-[80]"
              aria-label="User menu"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Search Results Dropdown */}
        {isSearchOpen && searchQuery && (
          <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-lg max-h-96 overflow-y-auto">
            {filteredItems.length > 0 ? (
              <div className="p-2">
                {filteredItems.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all"
                  >
                    <item.icon size={18} className="text-gray-600" />
                    <div>
                      <div className="text-xs font-bold text-gray-900">{item.label}</div>
                      <div className="text-[10px] text-gray-400">{item.category}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Search size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400 font-bold">Tidak ada hasil ditemukan</p>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Full Screen Menu Modal */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Menu Content */}
          <div className="absolute inset-x-0 bottom-0 top-0 bg-white rounded-t-3xl overflow-hidden animate-slide-up flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">Menu Admin</h2>
                <p className="text-xs text-gray-400 font-bold mt-0.5">
                  {userProfile?.email || 'Admin User'}
                </p>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 hover:bg-gray-50 rounded-xl transition-all"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            {/* Quick Stats */}
            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Orders</div>
                  <div className="text-lg font-black text-green-600">24</div>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Revenue</div>
                  <div className="text-lg font-black text-blue-600">Rp8.2M</div>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stock</div>
                  <div className="text-lg font-black text-orange-600">12</div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto pb-24">
              {['Overview', 'Sales', 'Inventory', 'Finance', 'Marketing', 'Communication', 'System'].map((category) => {
                const categoryItems = navItems.filter(item => item.category === category);
                if (categoryItems.length === 0) return null;

                return (
                  <div key={category} className="px-4 py-3">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-2">
                      {category}
                    </h3>
                    <div className="space-y-1">
                      {categoryItems.map((item, idx) => {
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={idx}
                            href={item.href}
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                              isActive
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <item.icon size={20} className={isActive ? 'text-green-600' : 'text-gray-500'} />
                            <span className="text-xs font-bold flex-1">{item.label}</span>
                            <ChevronRight size={16} className="text-gray-400" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Actions */}
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4 space-y-2">
              <Link
                href="/admin/settings"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-xl transition-all"
              >
                <Settings size={20} className="text-gray-600" />
                <span className="text-xs font-bold text-gray-700">Settings</span>
              </Link>
              
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 hover:bg-red-50 rounded-xl transition-all text-red-600"
              >
                <ArrowUpCircle size={20} className="rotate-180" />
                <span className="text-xs font-bold">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for fixed header */}
      <div className="h-16 md:hidden" />
    </>
  );
}
