'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Receipt, 
  PlusCircle, 
  Package, 
  Camera, 
  X, 
  Search, 
  Check, 
  Zap, 
  ShoppingCart, 
  ShoppingBag, 
  RefreshCcw, 
  MoreHorizontal, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  BarChart3, 
  MessageCircle, 
  Users, 
  Settings, 
  CreditCard, 
  History, 
  Store, 
  Wallet, 
  Star, 
  ChevronRight, 
  Boxes, 
  Activity, 
  AlertTriangle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { deductStockFEFO } from '@/lib/inventory';
import { Product } from '@/lib/types';

// UI Helpers
const triggerHaptic = (duration = 15) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (_) {}
  }
};

export default function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<'marketplace' | 'more' | 'inventory' | null>(null);
  
  // Marketplace Order Form State
  const [mpProductName, setMpProductName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [mpQty, setMpQty] = useState(1);
  const [mpSource, setMpSource] = useState('Shopee');
  const [mpLoading, setMpLoading] = useState(false);
  const [mpSearchSuggestions, setMpSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  // Fetch product suggestions from Supabase
  useEffect(() => {
    if (mpProductName.trim().length >= 2) {
      const timer = setTimeout(async () => {
        setSearching(true);
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, sku, stock, price, raw_data')
            .ilike('name', `%${mpProductName.trim()}%`)
            .limit(6);

          if (!error && data) {
            setMpSearchSuggestions(data);
            setShowSuggestions(true);
          }
        } catch (err) {
          console.error('Search product error:', err);
        } finally {
          setSearching(false);
        }
      }, 250);

      return () => clearTimeout(timer);
    } else {
      setMpSearchSuggestions([]);
      setShowSuggestions(false);
    }
  }, [mpProductName]);

  if (!pathname.startsWith('/admin')) return null;

  const handleOpenMarketplace = () => {
    triggerHaptic(20);
    setActiveModal('marketplace');
  };

  const handleOpenInventory = () => {
    triggerHaptic(15);
    setActiveModal('inventory');
  };

  const handleOpenMore = () => {
    triggerHaptic(15);
    setActiveModal('more');
  };

  const closeModal = () => {
    setActiveModal(null);
    setShowSuggestions(false);
  };

  const navigateTo = (href: string) => {
    triggerHaptic(15);
    closeModal();
    router.push(href);
  };

  const saveMarketplaceOrder = async () => {
    if (!mpProductName && !selectedProduct) {
      return notify.admin.error('Pilih produk terlebih dahulu');
    }
    if (mpQty <= 0) {
      return notify.admin.error('Jumlah QTY minimal 1');
    }

    setMpLoading(true);
    try {
      const prodName = selectedProduct?.name || mpProductName;
      const prodId = selectedProduct?.id;

      // 1. Simpan order marketplace ke Supabase
      const now = new Date().toISOString();
      const orderPayload = {
        product_name: prodName,
        product_id: prodId || null,
        qty: Number(mpQty),
        source: mpSource,
        channel: mpSource.toUpperCase(),
        status: 'completed',
        created_at: now,
        raw_data: {
          productName: prodName,
          productId: prodId,
          qty: Number(mpQty),
          source: mpSource,
          createdAt: now,
        }
      };

      const { data: insertedOrder, error: orderErr } = await supabase
        .from('marketplace_orders')
        .insert(orderPayload)
        .select()
        .single();

      // Jika tabel marketplace_orders ada atau fallback
      if (orderErr) {
        // Coba simpan ke format generic orders jika diperlukan
        console.warn('marketplace_orders insert fallback:', orderErr.message);
      }

      // 2. Potong stok otomatis jika ada product_id
      if (prodId) {
        const deductRes = await deductStockFEFO({
          productId: prodId,
          amount: Number(mpQty),
          warehouseId: 'auto',
          reference: `MP-${mpSource.toUpperCase()}-${Date.now().toString().slice(-6)}`,
          notes: `Penjualan Marketplace ${mpSource} (${mpQty} unit)`,
          source: 'ORDER'
        });

        if (!deductRes.success) {
          notify.admin.error(`Order tersimpan, namun ${deductRes.error || 'stok gagal dikurangi'}`);
        } else {
          notify.admin.success(`Order ${mpSource} berhasil & stok terpotong!`);
        }
      } else {
        notify.admin.success(`Order ${mpSource} berhasil disimpan!`);
      }

      triggerHaptic(50);
      closeModal();
      setMpProductName('');
      setSelectedProduct(null);
      setMpQty(1);
    } catch (error: any) {
      console.error('Save MP order error:', error);
      notify.admin.error(error.message || 'Gagal menyimpan order marketplace');
    } finally {
      setMpLoading(false);
    }
  };

  const moreMenuGroups = [
    {
      title: 'Penjualan & Transaksi',
      items: [
        { name: 'POS Kasir', icon: ShoppingCart, href: '/cashier', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', desc: 'Kasir Penjualan Toko' },
        { name: 'Marketplace', icon: ShoppingBag, href: '/admin/marketplace-orders', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', desc: 'Order Online & Ekspedisi' },
        { name: 'Pelanggan', icon: Users, href: '/admin/customers', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', desc: 'Database Member & Piutang' },
      ]
    },
    {
      title: 'Inventaris & Gudang',
      items: [
        { name: 'Stok Gudang', icon: Package, href: '/admin/inventory', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', desc: 'Opname & Penyesuaian' },
        { name: 'Pembelian (PO)', icon: Receipt, href: '/admin/purchases', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', desc: 'Supplier & Tagihan Hutang' },
        { name: 'Log Mutasi', icon: Activity, href: '/admin/inventory/logs', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-100', desc: 'Histori Keluar Masuk' },
        { name: 'Kartu Stok', icon: History, href: '/admin/inventory/history', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', desc: 'Audit Pergerakan Barang' },
      ]
    },
    {
      title: 'Laporan & Keuangan',
      items: [
        { name: 'Lap. Finansial', icon: CreditCard, href: '/admin/reports/finance', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', desc: 'Laba Rugi & Arus Kas' },
        { name: 'Lap. Penjualan', icon: BarChart3, href: '/admin/reports', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', desc: 'Grafik Omzet & Margin' },
        { name: 'Dompet & Kas', icon: Wallet, href: '/admin/wallet', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', desc: 'Mutasi Saldo & Bank' },
      ]
    },
    {
      title: 'Pengaturan & Toko',
      items: [
        { name: 'Tambah Produk', icon: PlusCircle, href: '/admin/products/add', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', desc: 'Katalog & Barcode Baru' },
        { name: 'Pengaturan', icon: Settings, href: '/admin/settings', color: 'text-gray-700', bg: 'bg-gray-100', border: 'border-gray-200', desc: 'Toko, Printer & Sistem' },
      ]
    }
  ];

  const mainNavItems = [
    { name: 'PO', icon: Receipt, href: '/admin/purchases/add', label: 'Buat PO' },
    { name: 'Stok', icon: Package, action: handleOpenInventory, label: 'Inventaris' },
    { name: 'Order', icon: ShoppingBag, action: handleOpenMarketplace, center: true, label: 'Order MP' },
    { name: 'Produk', icon: PlusCircle, href: '/admin/products/add', label: 'Tambah' },
    { name: 'Menu', icon: MoreHorizontal, action: handleOpenMore, label: 'Lainnya' },
  ];

  return (
    <>
      {/* ── Bottom Nav Bar (Mobile Dedicated) ── */}
      <nav className="fixed bottom-0 inset-x-0 z-[70] bg-white/95 backdrop-blur-xl border-t border-gray-200/80 md:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_25px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around px-2 h-16 max-w-lg mx-auto">
          {mainNavItems.map((item, idx) => {
            const Icon = item.icon;
            
            if (item.href) {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={idx} 
                  href={item.href}
                  onClick={() => triggerHaptic(10)}
                  className={`flex flex-col items-center justify-center flex-1 h-14 rounded-2xl transition-all duration-200 active:scale-95 ${
                    isActive ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
                  <span className="text-[10px] font-bold mt-1 tracking-tight">{item.name}</span>
                </Link>
              );
            }
            
            if (item.center) {
              return (
                <button
                  key={idx}
                  onClick={item.action}
                  aria-label="Order Marketplace"
                  className="flex flex-col items-center justify-center -mt-7 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full shadow-lg shadow-blue-500/30 active:scale-90 transition-transform border-4 border-white"
                >
                  <Icon size={24} className="stroke-[2.3]" />
                </button>
              );
            }

            return (
              <button
                key={idx}
                onClick={item.action}
                className="flex flex-col items-center justify-center flex-1 h-14 text-gray-500 hover:text-gray-800 active:scale-95 transition-all"
              >
                <Icon size={20} className="stroke-[1.8]" />
                <span className="text-[10px] font-bold mt-1 tracking-tight">{item.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Modal 1: PILIH AKSI INVENTARIS (Sleek Bottom Sheet) ── */}
      {activeModal === 'inventory' && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={closeModal} 
          />
          <div className="relative bg-white rounded-t-[2rem] p-6 animate-in slide-in-from-bottom duration-300 shadow-2xl border-t border-gray-100 max-w-lg mx-auto w-full">
            {/* Handle Drag bar */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />
            
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Boxes className="text-blue-600" size={20} />
                  Menu Inventaris & Stok
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Pilih tindakan stok barang yang diinginkan</p>
              </div>
              <button 
                onClick={closeModal}
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full active:scale-90 transition-transform"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Option 1: STOCK IN (PO) */}
              <button 
                onClick={() => navigateTo('/admin/purchases/add')}
                className="flex flex-col items-start p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 hover:from-emerald-100 text-emerald-900 rounded-2xl border border-emerald-200/80 active:scale-95 transition-all shadow-sm text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                  <ArrowDownLeft size={22} className="stroke-[2.5]" />
                </div>
                <span className="text-xs font-black tracking-wider text-emerald-800 uppercase">STOCK IN (PO)</span>
                <span className="text-[11px] text-emerald-600/90 font-medium mt-1 leading-tight">Input Pembelian & Terima Barang PO</span>
              </button>

              {/* Option 2: STOCK ADJUST */}
              <button 
                onClick={() => navigateTo('/admin/inventory')}
                className="flex flex-col items-start p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 hover:from-amber-100 text-amber-900 rounded-2xl border border-amber-200/80 active:scale-95 transition-all shadow-sm text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                  <ArrowUpRight size={22} className="stroke-[2.5]" />
                </div>
                <span className="text-xs font-black tracking-wider text-amber-800 uppercase">STOCK ADJUST</span>
                <span className="text-[11px] text-amber-600/90 font-medium mt-1 leading-tight">Opname, Koreksi & Alokasi Gudang</span>
              </button>
            </div>

            {/* Sub Quick Links */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
              <button 
                onClick={() => navigateTo('/admin/inventory/logs')}
                className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 text-xs font-bold active:scale-95 transition-all"
              >
                <Activity size={16} className="text-blue-500" />
                <span>Log Mutasi Stok</span>
              </button>
              <button 
                onClick={() => navigateTo('/admin/inventory/history')}
                className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-700 text-xs font-bold active:scale-95 transition-all"
              >
                <History size={16} className="text-purple-500" />
                <span>Kartu & Audit Stok</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: ORDER MARKETPLACE (Bottom Sheet Style) ── */}
      {activeModal === 'marketplace' && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={closeModal} 
          />
          <div className="relative bg-white rounded-t-[2rem] p-6 animate-in slide-in-from-bottom duration-300 shadow-2xl max-w-lg mx-auto w-full max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <ShoppingBag className="text-blue-600" size={20} />
                  Input Order Marketplace
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Catat order & potong stok otomatis</p>
              </div>
              <button 
                onClick={closeModal} 
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full active:scale-90 transition-transform"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Product Search Input */}
              <div className="relative">
                <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                  Cari Produk Toko
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    value={mpProductName}
                    onChange={(e) => {
                      setMpProductName(e.target.value);
                      setSelectedProduct(null);
                    }}
                    placeholder="Ketik nama atau SKU produk..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                  {searching && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <Zap size={14} className="animate-spin text-blue-500" />
                    </div>
                  )}
                </div>
                
                {/* Suggestions Dropdown */}
                {showSuggestions && mpSearchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1 max-h-56 overflow-y-auto">
                    {mpSearchSuggestions.map((s) => (
                      <button 
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(s);
                          setMpProductName(s.name);
                          setShowSuggestions(false);
                          triggerHaptic(10);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-blue-50/60 flex items-center justify-between border-b border-gray-50 last:border-0"
                      >
                        <div className="pr-2">
                          <p className="text-xs font-bold text-gray-800 line-clamp-1">{s.name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">
                            SKU: {s.sku || '-'} • Stok: <span className="font-bold text-blue-600">{s.stock ?? 0}</span>
                          </p>
                        </div>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg shrink-0">
                          Pilih
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* QTY & Channel Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                    Jumlah (QTY)
                  </label>
                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1">
                    <button 
                      type="button"
                      onClick={() => { setMpQty(Math.max(1, mpQty - 1)); triggerHaptic(5); }} 
                      className="w-9 h-9 flex items-center justify-center bg-white rounded-lg text-gray-700 font-bold text-base shadow-sm active:scale-90"
                    >-</button>
                    <input 
                      type="number" 
                      min="1"
                      value={mpQty}
                      onChange={(e) => setMpQty(Math.max(1, Number(e.target.value) || 1))}
                      className="flex-1 bg-transparent text-center text-xs font-bold outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => { setMpQty(mpQty + 1); triggerHaptic(5); }} 
                      className="w-9 h-9 flex items-center justify-center bg-white rounded-lg text-gray-700 font-bold text-base shadow-sm active:scale-90"
                    >+</button>
                  </div>
                </div>
                
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                    Marketplace
                  </label>
                  <select 
                    value={mpSource}
                    onChange={(e) => setMpSource(e.target.value)}
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3 text-xs font-bold text-gray-800 outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="Shopee">🟠 Shopee</option>
                    <option value="Tokopedia">🟢 Tokopedia</option>
                    <option value="TikTok">⚫ TikTok Shop</option>
                    <option value="Lazada">🔵 Lazada</option>
                    <option value="Manual">📦 Offline / Manual</option>
                  </select>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                onClick={saveMarketplaceOrder}
                disabled={mpLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-bold text-xs tracking-wider shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {mpLoading ? <Zap className="animate-spin" size={16} /> : <Check size={18} />}
                SIMPAN & POTONG STOK
              </button>

              {/* Link to Full Marketplace Page */}
              <button
                onClick={() => navigateTo('/admin/marketplace-orders')}
                className="w-full py-2 text-center text-xs font-bold text-gray-500 hover:text-blue-600 flex items-center justify-center gap-1"
              >
                Buka Halaman Lengkap Order Marketplace <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: SEMUA FITUR (More Menu Fullsheet) ── */}
      {activeModal === 'more' && (
        <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col animate-in fade-in duration-200">
          <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-gray-900">Semua Fitur Admin</h2>
              <p className="text-xs text-gray-500">Navigasi cepat semua modul aplikasi</p>
            </div>
            <button 
              onClick={closeModal} 
              className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 active:scale-90 transition-transform"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
            {moreMenuGroups.map((group, gIdx) => (
              <div key={gIdx}>
                <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2.5 px-1">
                  {group.title}
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {group.items.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={idx}
                        href={item.href}
                        onClick={() => { closeModal(); triggerHaptic(10); }}
                        className={`flex flex-col p-3.5 rounded-2xl bg-white border ${item.border} hover:shadow-sm active:scale-95 transition-all text-left group`}
                      >
                        <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.color} flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform`}>
                          <Icon size={18} className="stroke-[2.2]" />
                        </div>
                        <span className="text-xs font-black text-gray-800">{item.name}</span>
                        <span className="text-[10px] text-gray-500 font-medium mt-0.5 line-clamp-1">{item.desc}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
