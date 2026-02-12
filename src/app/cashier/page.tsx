'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  serverTimestamp,
  getDoc,
  limit,
  writeBatch
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import {
  Package, ShoppingCart, Search, Plus, Minus, Printer, Bell,
  MessageSquare, Truck, CheckCircle, Upload, Barcode,
  History, X, Trash2, LayoutGrid, List, Edit
} from 'lucide-react';
import imageCompression from 'browser-image-compression'; // TAMBAHAN: Library Kompresi

// Types
type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  barcode?: string;
  image?: string;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  deliveryMethod: string;
  status: string;
  createdAt?: { seconds: number } | Date;
  subtotal: number;
  shippingCost: number;
  transactionType: string;
};


export default function CashierPOS() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pos' | 'orders'>('pos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  // const [showNotification, setShowNotification] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  // Transaksi States
  const [transactionType, setTransactionType] = useState<'toko' | 'online'>('toko');
  const [deliveryMethod] = useState('Ambil di Toko');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // No redundant state for calculated values


  // --- TAMBAHAN: LOGIKA KOMPRESI PHOTO ---
  const compressImage = useCallback(async (file: File) => {
    const options = {
      maxSizeMB: 0.2, // Maks 200KB agar database tidak bengkak
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Compression error:", error);
      return file;
    }
  }, []);

  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) return alert("Stok habis!");
    setCart(prev => {
      const exist = prev.find(i => i.id === product.id);
      if (exist) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, unit: product.unit }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, q: number) => {
    if (q <= 0) setCart(prev => prev.filter(i => i.id !== id));
    else setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: q } : i));
  }, []);

  const updatePrice = useCallback((id: string, newTotal: number, quantity: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, price: newTotal / quantity } : i));
    setEditingPriceId(null);
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

  const shippingCost = useMemo(() => {
    const rates: Record<string, number> = { 'Ambil di Toko': 0, 'Kurir Toko': 15000, 'OJOL': 0 };
    return rates[deliveryMethod] || 0;
  }, [deliveryMethod]);

  const total = useMemo(() => subtotal + shippingCost, [subtotal, shippingCost]);

  const change = useMemo(() => {
    if (paymentMethod === 'CASH') {
      return (parseFloat(cashGiven) || 0) - total;
    }
    return 0;
  }, [cashGiven, total, paymentMethod]);

  useEffect(() => {
    // Detect Offline Status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    setIsOffline(!navigator.onLine);

    const savedCart = localStorage.getItem('pos-cart');
    if (savedCart) setCart(JSON.parse(savedCart));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      
      // Jika offline, kita asumsikan user valid jika sudah ada di auth (karena persistence)
      if (navigator.onLine) {
         try {
           const userDoc = await getDoc(doc(db, 'users', user.uid));
           if (userDoc.data()?.role !== 'cashier' && userDoc.data()?.role !== 'admin') {
             router.push('/profil'); return;
           }
         } catch (e) { console.log("Offline or error fetching user role", e); }
      }
      
      setLoading(false);
    });
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [router]);

  useEffect(() => {
    localStorage.setItem('pos-cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (loading) return;
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const p = snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'TANPA NAMA',
          price: data.price || 0,
          unit: data.unit || 'pcs',
          stock: data.stock || 0,
          barcode: data.barcode || '',
          image: data.image || data.imageUrl || data.photo || null
        } as Product;
      });
      setProducts(p);
      setFilteredProducts(p);
    });
    return () => unsubscribe();
  }, [loading]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCompletedOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });
    return () => unsubscribe();
  }, [activeTab]);

  useEffect(() => {
    const filtered = products.filter(p =>
      (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      p.barcode === searchQuery
    );
    setFilteredProducts(filtered);

    const exactMatch = products.find(p => p.barcode === searchQuery);
    if (exactMatch && searchQuery.length >= 3) {
      addToCart(exactMatch);
      setSearchQuery('');
    }
  }, [searchQuery, products, addToCart]);

  useEffect(() => {
    if (loading) return;
    const q = query(collection(db, 'orders'), where('status', '==', 'MENUNGGU'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setNewOrderCount(snapshot.docs.length);
      if (!snapshot.empty) {
        // setShowNotification(true);
        // setTimeout(() => setShowNotification(false), 5000);
      }
    });
    return () => unsubscribe();
  }, [loading]);


  // --- HANDLE TRANSACTION (DIUBAH UNTUK KOMPRESI) ---
  const handleTransaction = async () => {
    if (cart.length === 0) return;
    if ((paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') && !paymentProof && !isOffline) return alert('Wajib upload bukti!');
    if (paymentMethod === 'CASH' && change < 0) return alert('Uang kurang!');
    
    // Jika offline, blokir metode yang butuh upload kecuali dipaksa (tapi di sini kita warning saja)
    if (isOffline && (paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER')) {
       if (!confirm("Anda sedang OFFLINE. Bukti transfer tidak akan terupload. Lanjutkan?")) return;
    }

    setIsProcessing(true);
    const batch = writeBatch(db);

    try {
      let proofUrl = null;
      if (paymentProof && !isOffline) {
        // PROSES KOMPRESI SEBELUM UPLOAD
        const compressedFile = await compressImage(paymentProof);
        const sRef = ref(storage, `payment-proofs/${Date.now()}`);
        await uploadBytes(sRef, compressedFile);
        proofUrl = await getDownloadURL(sRef);
      } else if (paymentProof && isOffline) {
         console.warn("Offline: Skipping image upload");
         // Bisa simpan di indexedDB jika mau canggih, tapi untuk sekarang skip
      }

      const orderData = {
        customerName: transactionType === 'online' ? 'Pelanggan Online' : 'Pelanggan Toko',
        items: cart,
        subtotal, shippingCost, total,
        paymentMethod, paymentProofUrl: proofUrl,
        deliveryMethod, transactionType,
        status: 'SELESAI',
        createdAt: serverTimestamp(),
      };

      const newOrderRef = doc(collection(db, 'orders'));
      batch.set(newOrderRef, orderData);

      for (const item of cart) {
        const pRef = doc(db, 'products', item.id);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          batch.update(pRef, { stock: (pSnap.data().stock || 0) - item.quantity });
        }
      }

      await batch.commit();
      printReceipt({ ...orderData, id: newOrderRef.id, createdAt: new Date() });
      setCart([]);
      localStorage.removeItem('pos-cart');
      setCashGiven('');
      setPaymentProof(null);
      setProofPreview(null);
      alert('Transaksi Berhasil!');
    } catch (e) {
      console.error(e);
      alert('Gagal Transaksi');
    } finally { setIsProcessing(false); }
  };

  const printReceipt = useCallback((order: Partial<Order>) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><body style="font-family:monospace;width:80mm;padding:5px;">
        <center><b>ATAYATOKO</b><br>Kediri - 085853161174<br>--------------------------</center>
        ${order.items?.map((i: CartItem) => `<div>${i.name}<br>${i.quantity}x @${i.price.toLocaleString()} = ${(i.price * i.quantity).toLocaleString()}</div>`).join('')}
        --------------------------<br>
        TOTAL: Rp${order.total?.toLocaleString()}<br>
        BAYAR: ${order.paymentMethod}<br>
        --------------------------<br>
        <center>Terima Kasih</center>
      </body></html>
    `);
    w.document.close();
    w.print();
    w.close();
  }, []);


  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat Kasir...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black italic text-green-600">ATAYATOKO <span className="text-gray-400 not-italic font-medium text-sm">POS</span></h1>
          {isOffline && (
            <div className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
              <span className="w-2 h-2 bg-red-600 rounded-full"></span> OFFLINE MODE
            </div>
          )}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setActiveTab('pos')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'pos' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>Kasir</button>
            <button onClick={() => setActiveTab('orders')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${activeTab === 'orders' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>Riwayat Order</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="relative p-2 bg-gray-100 rounded-full hover:bg-blue-50 group transition-colors">
            <Bell size={20} className="group-hover:text-blue-600" />
            {newOrderCount > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">{newOrderCount}</span>}
          </button>
        </div>
      </nav>

      {activeTab === 'pos' ? (
        <main className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="bg-green-50 p-2 rounded-xl text-green-600"><Search size={20} /></div>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari Produk atau Scan Barcode [F1]..."
                className="flex-1 outline-none font-medium text-gray-700"
              />
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('grid')} className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><List size={18} /></button>
              </div>
            </div>

            <div className={viewMode === 'grid' ? "grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto pr-2" : "flex flex-col gap-2 overflow-y-auto pr-2"} style={{ maxHeight: 'calc(100vh - 200px)' }}>
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className={`bg-white border border-gray-100 shadow-sm hover:border-green-500 transition-all text-left flex ${viewMode === 'grid' ? 'flex-col p-3 rounded-2xl' : 'flex-row items-center p-2 rounded-xl gap-4'}`}>
                  <div className={`${viewMode === 'grid' ? 'w-full aspect-square mb-3' : 'w-14 h-14'} bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center text-gray-300 relative`}>
                  {p.image ? (
                    <Image 
                      src={p.image} 
                      alt={p.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : p.barcode ? <Barcode size={24} /> : <Package size={24} />}
                </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-gray-800 line-clamp-2 uppercase">{p.name}</h3>
                    <p className="text-green-600 font-black text-sm">Rp{p.price.toLocaleString()}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">{p.unit}</span>
                      <span className={`text-[10px] font-bold ${p.stock < 10 ? 'text-red-500' : 'text-gray-400'}`}>Stok: {p.stock}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
            <div className={`p-4 rounded-2xl text-white font-black text-center text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg ${transactionType === 'online' ? 'bg-blue-600 animate-pulse' : 'bg-green-600'}`}>
              {transactionType === 'online' ? <><Truck size={14} /> MODE PESANAN ONLINE</> : <><CheckCircle size={14} /> MODE TRANSAKSI TOKO</>}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
              <div className="p-5 border-b flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className={transactionType === 'online' ? 'text-blue-600' : 'text-green-600'} />
                  <h2 className="font-black text-xs uppercase tracking-widest text-gray-700">Keranjang</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setTransactionType(transactionType === 'toko' ? 'online' : 'toko')} className="text-[10px] font-bold bg-gray-200 px-3 py-1 rounded-full hover:bg-gray-300">GANTI MODE</button>
                  <button onClick={() => setCart([])} className="text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-gray-700 uppercase">{item.name}</p>
                      {editingPriceId === item.id ? (
                        <input
                          autoFocus
                          type="number"
                          className="w-24 p-1 text-xs font-black text-right border rounded outline-none focus:ring-2 focus:ring-green-500"
                          value={editPriceValue}
                          onChange={(e) => setEditPriceValue(e.target.value)}
                          onBlur={() => updatePrice(item.id, parseFloat(editPriceValue) || 0, item.quantity)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updatePrice(item.id, parseFloat(editPriceValue) || 0, item.quantity);
                          }}
                        />
                      ) : (
                        <div 
                          onClick={() => {
                            setEditingPriceId(item.id);
                            setEditPriceValue((item.price * item.quantity).toString());
                          }}
                          className="flex items-center gap-1 cursor-pointer group"
                        >
                          <Edit size={10} className="text-gray-300 group-hover:text-green-600" />
                          <p className="text-xs font-black text-green-600">
                            Rp{(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 bg-white border rounded-lg"><Minus size={12} /></button>
                        <input 
                          type="number" 
                          min="1"
                          className="w-10 text-center text-xs font-black bg-transparent outline-none p-0 appearance-none"
                          value={item.quantity} 
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val > 0) updateQuantity(item.id, val);
                          }}
                        />
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 bg-white border rounded-lg"><Plus size={12} /></button>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-white border-t space-y-4">
                <div className="grid grid-cols-4 gap-2">
                  {['CASH', 'QRIS', 'TRANSFER', 'TEMPO'].map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2 rounded-xl text-[10px] font-black border transition-all ${paymentMethod === m ? (transactionType === 'online' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-green-600 border-green-600 text-white') : 'bg-white text-gray-400'}`}>{m}</button>
                  ))}
                </div>

                {paymentMethod === 'CASH' ? (
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Bayar Tunai</label>
                    <input type="number" value={cashGiven} onChange={e => setCashGiven(e.target.value)} className="w-full bg-transparent font-black text-lg outline-none" placeholder="0" />
                    {change >= 0 && <p className="text-[10px] font-bold text-green-600 mt-1">Kembali: Rp{change.toLocaleString()}</p>}
                  </div>
                ) : paymentMethod === 'TEMPO' ? (
                   <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100">
                     <p className="text-[10px] font-black text-orange-600 uppercase flex items-center gap-2">
                       <History size={14}/> Pembayaran Tempo
                     </p>
                     <p className="text-[9px] text-gray-500 mt-1">Transaksi ini akan dicatat sebagai piutang pelanggan.</p>
                   </div>
                ) : (
                  <div className="space-y-1">
                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl h-24 bg-gray-50 cursor-pointer overflow-hidden relative">
                      {proofPreview ? (
                        <Image 
                          src={proofPreview} 
                          alt="Bukti Transfer"
                          fill
                          className="object-cover"
                        />
                      ) : <><Upload size={20} className="text-gray-300" /><span className="text-[10px] font-black text-gray-400 mt-1 uppercase">Upload Bukti</span></>}
                      <input type="file" className="hidden" accept="image/*" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) { setPaymentProof(file); setProofPreview(URL.createObjectURL(file)); }
                      }} />
                    </label>
                    <p className="text-[8px] text-center text-gray-400 font-bold uppercase">Auto-Compress to 200KB</p>
                  </div>
                )}

                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-black text-gray-400 uppercase">Total</span>
                  <span className={`text-xl font-black ${transactionType === 'online' ? 'text-blue-600' : 'text-green-600'}`}>Rp{total.toLocaleString()}</span>
                </div>

                <button
                  disabled={isProcessing || cart.length === 0}
                  onClick={handleTransaction}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-200 ${transactionType === 'online' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-green-600 hover:bg-green-700 shadow-green-100'
                    }`}
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>PROSES KOMPRESI...</span>
                    </div>
                  ) : <><Printer size={16} /> {transactionType === 'online' ? 'Simpan Pesanan Online' : 'Selesaikan Transaksi'}</>}
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="font-black text-xl text-gray-800 flex items-center gap-2"><History /> 20 Transaksi Terakhir</h2>
            {completedOrders.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-xl ${order.transactionType === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}><CheckCircle size={24} /></div>
                  <div>
                    <p className="text-xs font-black text-gray-800 uppercase">Order #{order.id.slice(-6)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                      {order.createdAt
                        ? ('seconds' in order.createdAt
                          ? new Date(order.createdAt.seconds * 1000).toLocaleString('id-ID')
                          : order.createdAt.toLocaleString('id-ID'))
                        : '-'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-green-600">Rp{order.total?.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{order.paymentMethod}</p>
                </div>
                <button onClick={() => printReceipt(order)} className="ml-4 p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Printer size={18} /></button>
              </div>
            ))}
          </div>
        </main>
      )}

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <h2 className="font-black uppercase tracking-widest flex items-center gap-2"><ShoppingCart /> Pesanan Masuk</h2>
              <button onClick={() => setIsDrawerOpen(false)}><X /></button>
            </div>
            <div className="p-4 overflow-y-auto h-full pb-20 space-y-4">
              {recentOrders.map(o => (
                <div key={o.id} className="bg-gray-50 border rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-xs uppercase">{o.customerName}</p>
                      <p className="text-[10px] font-bold text-gray-400">{o.customerPhone}</p>
                    </div>
                    <span className="bg-red-100 text-red-600 text-[8px] font-black px-2 py-1 rounded uppercase">Masuk</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <p className="font-black text-blue-600 text-sm">Rp{o.total?.toLocaleString()}</p>
                    <div className="flex gap-2">
                      <a href={`https://wa.me/${o.customerPhone}`} target="_blank" className="p-2 bg-green-50 text-green-600 rounded-lg"><MessageSquare size={16} /></a>
                      <button onClick={async () => {
                        await updateDoc(doc(db, 'orders', o.id), { status: 'DIPROSES' });
                        alert('Order Diproses');
                      }} className="bg-blue-600 text-white text-[10px] font-black px-4 py-2 rounded-lg uppercase">Proses</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
