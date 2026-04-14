'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ScanBarcode,
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
  ChevronLeft
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where, 
  limit, 
  updateDoc, 
  doc, 
  increment,
  orderBy
} from 'firebase/firestore';
import { Html5QrcodeScanner } from 'html5-qrcode';
import notify from '@/lib/notify';

// UI Helpers
const triggerHaptic = (duration = 15) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(duration);
  }
};

export default function AdminMobileNav() {
  const pathname = usePathname();
  const [activeModal, setActiveModal] = useState<'marketplace' | 'scanner' | 'addProduct' | 'more' | 'inventory' | null>(null);
  const [scannerType, setScannerType] = useState<'po' | 'update' | null>(null);
  
  // Marketplace Order Form State
  const [mpProductName, setMpProductName] = useState('');
  const [mpQty, setMpQty] = useState(1);
  const [mpSource, setMpSource] = useState('Shopee');
  const [mpLoading, setMpLoading] = useState(false);
  const [mpSearchSuggestions, setMpSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Quick Adjust State
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState(0);

  // Add Product State
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch Suggestions
  useEffect(() => {
    if (mpProductName.length > 2) {
      const fetchSuggestions = async () => {
        const q = query(
          collection(db, 'products'),
          where('name', '>=', mpProductName.toUpperCase()),
          where('name', '<=', mpProductName.toUpperCase() + '\uf8ff'),
          limit(5)
        );
        const snap = await getDocs(q);
        setMpSearchSuggestions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setShowSuggestions(true);
      };
      fetchSuggestions();
    } else {
      setShowSuggestions(false);
    }
  }, [mpProductName]);

  if (!pathname.startsWith('/admin')) return null;

  const handleOpenMarketplace = () => {
    triggerHaptic(20);
    setActiveModal('marketplace');
  };

  const handleOpenScanner = (type: 'po' | 'update') => {
    triggerHaptic(15);
    setScannerType(type);
    setActiveModal('scanner');
  };

  const handleOpenAddProduct = () => {
    triggerHaptic(15);
    setActiveModal('addProduct');
    startCamera();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      notify.admin.error('Gagal mengakses kamera');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      setCapturedImage(canvas.toDataURL('image/jpeg'));
      triggerHaptic(30);
    }
  };

  const saveMarketplaceOrder = async () => {
    if (!mpProductName) return notify.admin.error('Nama produk wajib diisi');
    setMpLoading(true);
    try {
      await addDoc(collection(db, 'marketplace_orders'), {
        productName: mpProductName,
        qty: Number(mpQty),
        source: mpSource,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      
      notify.admin.success('Order Tersimpan & Stok Berkurang');
      triggerHaptic(50);
      setActiveModal(null);
      setMpProductName('');
      setMpQty(1);
    } catch (error) {
      notify.admin.error('Gagal menyimpan order');
    } finally {
      setMpLoading(false);
    }
  };

  const moreMenuItems = [
    { name: 'POS', icon: ShoppingCart, href: '/cashier', color: 'text-red-600', bg: 'bg-red-50' },
    { name: 'Reports', icon: BarChart3, href: '/admin/reports', color: 'text-purple-600', bg: 'bg-purple-50' },
    { name: 'Finance', icon: CreditCard, href: '/admin/finance', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Customers', icon: Users, href: '/admin/customers', color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'History', icon: History, href: '/admin/inventory/history', color: 'text-orange-600', bg: 'bg-orange-50' },
    { name: 'Wallet', icon: Wallet, href: '/admin/wallet', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Chat', icon: MessageCircle, href: '/admin/chat', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { name: 'Promotions', icon: Star, href: '/admin/promotions', color: 'text-pink-600', bg: 'bg-pink-50' },
    { name: 'Settings', icon: Settings, href: '/admin/settings', color: 'text-gray-600', bg: 'bg-gray-50' },
  ];

  const mainNavItems = [
    { name: 'PO', icon: Receipt, href: '/purchases/add' },
    { name: 'Stok', icon: Package, action: () => setActiveModal('inventory') },
    { name: 'Order', icon: ShoppingBag, action: handleOpenMarketplace, center: true },
    { name: 'New', icon: Camera, action: handleOpenAddProduct },
    { name: 'More', icon: MoreHorizontal, action: () => { triggerHaptic(10); setActiveModal('more'); } },
  ];

  return (
    <>
      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/80 backdrop-blur-xl border-t border-gray-100 md:hidden pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around px-2 h-16">
          {mainNavItems.map((item, idx) => {
            const Icon = item.icon;
            if (item.href) {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={idx} 
                  href={item.href}
                  onClick={() => triggerHaptic(10)}
                  className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all ${isActive ? 'text-green-600' : 'text-gray-400'}`}
                >
                  <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
                  <span className="text-[8px] font-black mt-1 uppercase tracking-tighter">{item.name}</span>
                </Link>
              );
            }
            
            if (item.center) {
              return (
                <button
                  key={idx}
                  onClick={item.action}
                  className="flex flex-col items-center justify-center -mt-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200 active:scale-90 transition-transform border-4 border-white"
                >
                  <Icon size={24} />
                </button>
              );
            }

            return (
              <button
                key={idx}
                onClick={item.action}
                className="flex flex-col items-center justify-center w-12 h-12 text-gray-400 active:scale-90 transition-transform"
              >
                <Icon size={20} />
                <span className="text-[8px] font-black mt-1 uppercase tracking-tighter">{item.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Inventory Options Modal */}
      {activeModal === 'inventory' && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative bg-white rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
            <h2 className="text-xl font-black tracking-tighter mb-6">Pilih Aksi Inventaris</h2>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleOpenScanner('po')}
                className="flex flex-col items-center gap-4 p-6 bg-green-50 text-green-600 rounded-[2rem] border border-green-100 active:scale-95 transition-all"
              >
                <ArrowDownLeft size={32} />
                <span className="text-xs font-black tracking-widest">STOCK IN (PO)</span>
              </button>
              <button 
                onClick={() => handleOpenScanner('update')}
                className="flex flex-col items-center gap-4 p-6 bg-orange-50 text-orange-600 rounded-[2rem] border border-orange-100 active:scale-95 transition-all"
              >
                <ArrowUpRight size={32} />
                <span className="text-xs font-black tracking-widest">STOCK ADJUST</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* More Menu Modal */}
      {activeModal === 'more' && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in fade-in duration-300">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tighter">Semua Fitur</h2>
            <button onClick={() => setActiveModal(null)} className="p-3 bg-gray-50 rounded-2xl text-gray-400">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-4">
              {moreMenuItems.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  onClick={() => { setActiveModal(null); triggerHaptic(10); }}
                  className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] ${item.bg} ${item.color} active:scale-95 transition-all`}
                >
                  <item.icon size={28} />
                  <span className="text-[10px] font-black tracking-widest uppercase">{item.name}</span>
                </Link>
              ))}
            </div>
            
            <div className="mt-12 p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100">
              <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-600" /> Ringkasan Hari Ini
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-gray-400">Total Penjualan</p>
                  <p className="text-lg font-black text-gray-800">Rp 0</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400">Order Baru</p>
                  <p className="text-lg font-black text-gray-800">0</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Marketplace Modal (Bottom Sheet Style) */}
      {activeModal === 'marketplace' && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end transform transition-all duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative bg-white rounded-t-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black tracking-tighter text-gray-800">Order Marketplace</h2>
              <button onClick={() => setActiveModal(null)} className="p-2 bg-gray-50 rounded-full text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2 block">Nama Produk</label>
                <div className="relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    value={mpProductName}
                    onChange={(e) => setMpProductName(e.target.value)}
                    placeholder="Cari produk..."
                    className="w-full bg-gray-50 border-none rounded-2xl pl-14 pr-6 py-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                
                {showSuggestions && mpSearchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden py-2">
                    {mpSearchSuggestions.map((s) => (
                      <button 
                        key={s.id}
                        onClick={() => {
                          setMpProductName(s.name);
                          setShowSuggestions(false);
                          triggerHaptic(10);
                        }}
                        className="w-full px-6 py-3 text-left hover:bg-gray-50 flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-xs font-black text-gray-800">{s.name}</p>
                          <p className="text-[9px] font-bold text-gray-400">{s.sku} • {s.stock} unit</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2 block">QTY</label>
                  <div className="flex items-center bg-gray-50 rounded-2xl p-1">
                    <button onClick={() => { setMpQty(Math.max(1, mpQty - 1)); triggerHaptic(5); }} className="w-12 h-12 flex items-center justify-center text-gray-400 font-bold text-xl">-</button>
                    <input 
                      type="number" 
                      value={mpQty}
                      onChange={(e) => setMpQty(Number(e.target.value))}
                      className="flex-1 bg-transparent text-center text-sm font-black outline-none"
                    />
                    <button onClick={() => { setMpQty(mpQty + 1); triggerHaptic(5); }} className="w-12 h-12 flex items-center justify-center text-gray-400 font-bold text-xl">+</button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2 block">Source</label>
                  <select 
                    value={mpSource}
                    onChange={(e) => setMpSource(e.target.value)}
                    className="w-full h-14 bg-gray-50 border-none rounded-2xl px-4 text-xs font-bold outline-none font-black"
                  >
                    <option>Shopee</option>
                    <option>Tokped</option>
                    <option>TikTok</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={saveMarketplaceOrder}
                disabled={mpLoading}
                className="w-full bg-blue-600 text-white h-16 rounded-3xl font-black text-sm tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3 mt-4"
              >
                {mpLoading ? <Zap className="animate-spin" size={18} /> : <Check size={20} />}
                SIMPAN ORDER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner & Quick Adjust Modal */}
      {activeModal === 'scanner' && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-white text-xl font-black tracking-tight">
                {scannerType === 'po' ? 'Stock In (Barcode)' : 'Quick Adjust'}
              </h2>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Arahkan kamera ke barcode</p>
            </div>
            <button 
              onClick={() => {
                setActiveModal(null);
                setScannedProduct(null);
              }} 
              className="p-3 bg-white/10 rounded-2xl text-white"
            >
              <X size={24} />
            </button>
          </div>

          {!scannedProduct ? (
            <div className="flex-1 flex flex-col">
              <div className="aspect-square bg-gray-900 rounded-[3rem] border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden relative">
                <BarcodeScanner onResult={(code) => {
                  triggerHaptic(20);
                  fetchProductBySku(code);
                }} />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-green-500/50 rounded-3xl" />
                  <div className="absolute w-full h-[2px] bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)] animate-scan" />
                </div>
              </div>
              <div className="mt-8">
                <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase mb-2 block">Atau Input SKU Manual</label>
                <div className="flex gap-2">
                  <input className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-xs font-bold outline-none" placeholder="Ketik SKU..." />
                  <button className="bg-white text-black px-6 rounded-2xl font-black text-[10px]">CARI</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 animate-in zoom-in-95 duration-300">
              <div className="bg-white rounded-[3rem] p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center text-gray-300">
                    <Package size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">{scannedProduct.name}</h3>
                    <p className="text-[10px] font-bold text-gray-400">{scannedProduct.sku} • {scannedProduct.stock} unit</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-4 block text-center">
                      {scannerType === 'po' ? 'Stok Masuk' : 'Adjust Stok'}
                    </label>
                    <div className="flex items-center justify-center gap-8">
                      <button 
                        onClick={() => { setAdjustQty(adjustQty - 1); triggerHaptic(10); }}
                        className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-2xl font-black text-gray-400 active:bg-gray-200"
                      >-</button>
                      <span className="text-5xl font-black tracking-tighter w-24 text-center">
                        {scannerType === 'po' ? `+${adjustQty}` : (adjustQty > 0 ? `+${adjustQty}` : adjustQty)}
                      </span>
                      <button 
                        onClick={() => { setAdjustQty(adjustQty + 1); triggerHaptic(10); }}
                        className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-2xl font-black text-gray-400 active:bg-gray-200"
                      >+</button>
                    </div>
                  </div>

                  <button 
                    onClick={saveStockUpdate}
                    className="w-full bg-black text-white h-20 rounded-[2rem] font-black tracking-[0.2em] text-xs shadow-xl active:scale-95 transition-all"
                  >
                    UPDATE STOK REAL-TIME
                  </button>
                  <button onClick={() => setScannedProduct(null)} className="w-full py-4 text-[10px] font-black text-gray-400">RESET SCAN</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Product Modal */}
      {activeModal === 'addProduct' && (
        <div className="fixed inset-0 z-[70] bg-gray-50 flex flex-col">
          <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tighter">Tambah Produk Baru</h2>
            <button onClick={() => { setActiveModal(null); stopCamera(); }} className="p-2 bg-gray-100 rounded-full text-gray-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Camera View */}
            <div className="aspect-square bg-gray-100 rounded-[3rem] overflow-hidden relative border-2 border-white shadow-lg">
              {!capturedImage ? (
                <>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-end justify-center pb-8">
                    <button 
                      onClick={capturePhoto}
                      className="w-16 h-16 rounded-full bg-white border-4 border-gray-200 flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
                    >
                      <div className="w-12 h-12 bg-red-500 rounded-full" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img src={capturedImage} className="w-full h-full object-cover" />
                  <div className="absolute top-4 right-4">
                    <button onClick={() => setCapturedImage(null)} className="p-3 bg-black/50 backdrop-blur-md rounded-2xl text-white">
                      <RefreshCcw size={20} />
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest mb-2 block">NAMA PRODUK</label>
                <input 
                  type="text" 
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Mis: Keripik Singkong Level 10"
                  className="w-full bg-white border border-gray-100 rounded-2xl px-6 py-4 text-xs font-bold outline-none"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-gray-400 tracking-widest mb-2 block">HARGA DASAR (MODAL)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Rp</span>
                  <input 
                    type="number" 
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-2xl pl-12 pr-6 py-4 text-xs font-bold outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <button className="w-full bg-green-600 text-white h-16 rounded-3xl font-black text-sm tracking-widest shadow-xl shadow-green-100 active:scale-95 transition-all mt-4">
                SIMPAN PRODUK & MASUK GUDANG
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </>
  );

  async function fetchProductBySku(sku: string) {
    try {
      const q = query(collection(db, 'products'), where('sku', '==', sku), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setScannedProduct({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        notify.admin.error('Produk tidak ditemukan');
      }
    } catch (e) {
      notify.admin.error('Error mencari produk');
    }
  }

  async function saveStockUpdate() {
    if (!scannedProduct) return;
    try {
      const newStock = scannedProduct.stock + adjustQty;
      await updateDoc(doc(db, 'products', scannedProduct.id), {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
      
      notify.admin.success(`Stok berhasil diupdate ke ${newStock}`);
      triggerHaptic(50);
      setActiveModal(null);
      setScannedProduct(null);
      setAdjustQty(0);
    } catch (e) {
      notify.admin.error('Gagal update stok');
    }
  }
}

function BarcodeScanner({ onResult }: { onResult: (code: string) => void }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner("reader", { 
      fps: 10, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    }, false);
    
    scanner.render((result) => {
      scanner.clear().then(() => onResult(result));
    }, (err) => {
      // Ignore errors for continuous scanning
    });

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onResult]);

  return <div id="reader" className="w-full" />;
}
