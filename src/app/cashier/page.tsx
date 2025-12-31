'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  addDoc,
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
  MessageSquare, Truck, CheckCircle, Upload, QrCode, Barcode,
  History, X, Trash2, LayoutGrid, List
} from 'lucide-react';

// Types
type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  barcode?: string;
  image?: string; // Menampung URL Foto
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
  items: any[];
  total: number;
  paymentMethod: string;
  deliveryMethod: string;
  status: string;
  createdAt: any;
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // State View Mode
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Transaksi States
  const [transactionType, setTransactionType] = useState<'toko' | 'online'>('toko');
  const [deliveryMethod, setDeliveryMethod] = useState('Ambil di Toko');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [change, setChange] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + shippingCost;

  // 1. Load LocalStorage Cart & Auth
  useEffect(() => {
    const savedCart = localStorage.getItem('pos-cart');
    if (savedCart) setCart(JSON.parse(savedCart));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'cashier' && userDoc.data()?.role !== 'admin') {
        router.push('/profil'); return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Simpan Cart ke LocalStorage
  useEffect(() => {
    localStorage.setItem('pos-cart', JSON.stringify(cart));
  }, [cart]);

  // 3. Shortcut Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 4. Fetch Products Realtime (Updated with Image Mapping)
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
          // Mendeteksi berbagai kemungkinan nama field foto
          image: data.image || data.imageUrl || data.photo || null 
        } as Product;
      });
      setProducts(p);
      setFilteredProducts(p);
    });
    return () => unsubscribe();
  }, [loading]);

  // 5. Fetch Completed Orders
  useEffect(() => {
    if (activeTab !== 'orders') return;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCompletedOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });
    return () => unsubscribe();
  }, [activeTab]);

  // 6. Barcode & Search Logic
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
  }, [searchQuery, products]);

  // 7. Notifikasi Pesanan Online
  useEffect(() => {
    if (loading) return;
    const q = query(collection(db, 'orders'), where('status', '==', 'MENUNGGU'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setNewOrderCount(snapshot.docs.length);
      if (!snapshot.empty) {
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 5000);
      }
    });
    return () => unsubscribe();
  }, [loading]);

  // 8. Logika Ongkir & Kembalian
  useEffect(() => {
    const rates: any = { 'Ambil di Toko': 0, 'Kurir Toko': 15000, 'OJOL': 0 };
    setShippingCost(rates[deliveryMethod] || 0);
  }, [deliveryMethod]);

  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setChange((parseFloat(cashGiven) || 0) - total);
    } else { setChange(0); }
  }, [cashGiven, total, paymentMethod]);

  // Functions
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert("Stok habis!");
    setCart(prev => {
      const exist = prev.find(i => i.id === product.id);
      if (exist) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, unit: product.unit }];
    });
  };

  const updateQuantity = (id: string, q: number) => {
    if (q <= 0) setCart(cart.filter(i => i.id !== id));
    else setCart(cart.map(i => i.id === id ? { ...i, quantity: q } : i));
  };

  const handleTransaction = async () => {
    if (cart.length === 0) return;
    if ((paymentMethod === 'QRIS' || paymentMethod === 'TRANSFER') && !paymentProof) return alert('Wajib upload bukti!');
    if (paymentMethod === 'CASH' && change < 0) return alert('Uang kurang!');

    setIsProcessing(true);
    const batch = writeBatch(db);

    try {
      let proofUrl = null;
      if (paymentProof) {
        const sRef = ref(storage, `payment-proofs/${Date.now()}`);
        await uploadBytes(sRef, paymentProof);
        proofUrl = await getDownloadURL(sRef);
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

  const printReceipt = (order: any) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><body style="font-family:monospace;width:80mm;padding:5px;">
        <center><b>ATAYATOKO</b><br>Kediri - 085853161174<br>--------------------------</center>
        ${order.items.map((i:any) => `<div>${i.name}<br>${i.quantity}x @${i.price.toLocaleString()} = ${(i.price*i.quantity).toLocaleString()}</div>`).join('')}
        --------------------------<br>
        TOTAL: Rp${order.total.toLocaleString()}<br>
        BAYAR: ${order.paymentMethod}<br>
        --------------------------<br>
        <center>Terima Kasih</center>
      </body></html>
    `);
    w.document.close();
    w.print();
    w.close();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Memuat Kasir...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black italic text-green-600">ATAYATOKO <span className="text-gray-400 not-italic font-medium text-sm">POS</span></h1>
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
          {/* Kiri: Produk */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="bg-green-50 p-2 rounded-xl text-green-600"><Search size={20}/></div>
              <input 
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari Produk atau Scan Barcode [F1]..." 
                className="flex-1 outline-none font-medium text-gray-700"
              />
              {/* Toggle View Mode */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setViewMode('grid')} className={`p-1 rounded ${viewMode === 'grid' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><LayoutGrid size={18}/></button>
                <button onClick={() => setViewMode('list')} className={`p-1 rounded ${viewMode === 'list' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}><List size={18}/></button>
              </div>
            </div>

            <div className={viewMode === 'grid' 
              ? "grid grid-cols-2 md:grid-cols-4 gap-3 overflow-y-auto pr-2" 
              : "flex flex-col gap-2 overflow-y-auto pr-2"} 
              style={{ maxHeight: 'calc(100vh - 200px)' }}
            >
              {filteredProducts.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className={`bg-white border border-gray-100 shadow-sm hover:border-green-500 transition-all text-left flex ${
                    viewMode === 'grid' ? 'flex-col p-3 rounded-2xl' : 'flex-row items-center p-2 rounded-xl gap-4'
                  }`}
                >
                  <div className={`${viewMode === 'grid' ? 'w-full aspect-square mb-3' : 'w-14 h-14'} bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center text-gray-300 relative`}>
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : (
                      p.barcode ? <Barcode size={24}/> : <Package size={24}/>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-gray-800 line-clamp-2 uppercase">{p.name}</h3>
                    <p className="text-green-600 font-black text-sm">Rp{(p.price || 0).toLocaleString()}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400">{p.unit}</span>
                      <span className={`text-[10px] font-bold ${p.stock < 10 ? 'text-red-500' : 'text-gray-400'}`}>Stok: {p.stock}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Kanan: Keranjang */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
            {/* Indikator Mode Transaksi */}
            <div className={`p-4 rounded-2xl text-white font-black text-center text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg ${
              transactionType === 'online' ? 'bg-blue-600 animate-pulse' : 'bg-green-600'
            }`}>
              {transactionType === 'online' ? <><Truck size={14}/> MODE PESANAN ONLINE</> : <><CheckCircle size={14}/> MODE TRANSAKSI TOKO</>}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
              <div className="p-5 border-b flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className={transactionType === 'online' ? 'text-blue-600' : 'text-green-600'} />
                  <h2 className="font-black text-xs uppercase tracking-widest text-gray-700">Keranjang</h2>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => setTransactionType(transactionType === 'toko' ? 'online' : 'toko')} className="text-[10px] font-bold bg-gray-200 px-3 py-1 rounded-full hover:bg-gray-300">GANTI MODE</button>
                   <button onClick={() => setCart([])} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20"><ShoppingCart size={48} /><p className="text-[10px] font-black uppercase mt-2">Kosong</p></div>
                ) : cart.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-gray-700 uppercase">{item.name}</p>
                      <p className="text-xs font-black text-green-600 ml-2">Rp{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                         <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 bg-white border rounded-lg"><Minus size={12}/></button>
                         <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                         <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 bg-white border rounded-lg"><Plus size={12}/></button>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-white border-t space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'QRIS', 'TRANSFER'].map(m => (
                    <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2 rounded-xl text-[10px] font-black border transition-all ${paymentMethod === m ? (transactionType === 'online' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-green-600 border-green-600 text-white') : 'bg-white text-gray-400'}`}>{m}</button>
                  ))}
                </div>

                {paymentMethod === 'CASH' ? (
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <label className="text-[10px] font-black text-gray-400 uppercase">Bayar Tunai</label>
                    <input type="number" value={cashGiven} onChange={e => setCashGiven(e.target.value)} className="w-full bg-transparent font-black text-lg outline-none" placeholder="0" />
                    {change >= 0 && <p className="text-[10px] font-bold text-green-600 mt-1">Kembali: Rp{change.toLocaleString()}</p>}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl h-24 bg-gray-50 cursor-pointer overflow-hidden relative">
                    {proofPreview ? <img src={proofPreview} className="absolute inset-0 w-full h-full object-cover" /> : <><Upload size={20} className="text-gray-300"/><span className="text-[10px] font-black text-gray-400 mt-1 uppercase">Bukti Bayar</span></>}
                    <input type="file" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) { setPaymentProof(file); setProofPreview(URL.createObjectURL(file)); }
                    }} />
                  </label>
                )}

                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-black text-gray-400 uppercase">Total</span>
                  <span className={`text-xl font-black ${transactionType === 'online' ? 'text-blue-600' : 'text-green-600'}`}>Rp{total.toLocaleString()}</span>
                </div>

                <button 
                  disabled={isProcessing || cart.length === 0}
                  onClick={handleTransaction}
                  className={`w-full py-4 rounded-2xl font-black uppercase text-xs text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-200 ${
                    transactionType === 'online' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-green-600 hover:bg-green-700 shadow-green-100'
                  }`}
                >
                  {isProcessing ? 'Proses...' : <><Printer size={16}/> {transactionType === 'online' ? 'Simpan Pesanan Online' : 'Selesaikan Transaksi'}</>}
                </button>
              </div>
            </div>
          </div>
        </main>
      ) : (
        /* RIWAYAT ORDER */
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="font-black text-xl text-gray-800 flex items-center gap-2"><History/> 20 Transaksi Terakhir</h2>
            {completedOrders.map(order => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-xl ${order.transactionType === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}><CheckCircle size={24}/></div>
                  <div>
                    <p className="text-xs font-black text-gray-800 uppercase">Order #{order.id.slice(-6)} ({order.transactionType || 'toko'})</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(order.createdAt?.seconds * 1000).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-green-600">Rp{(order.total || 0).toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{order.paymentMethod} • {order.items?.length || 0} ITEM</p>
                </div>
                <button onClick={() => printReceipt(order)} className="ml-4 p-2 hover:bg-gray-100 rounded-lg text-gray-400"><Printer size={18}/></button>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* DRAWER PESANAN ONLINE (Floating) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <h2 className="font-black uppercase tracking-widest flex items-center gap-2"><ShoppingCart/> Pesanan Masuk</h2>
              <button onClick={() => setIsDrawerOpen(false)}><X/></button>
            </div>
            <div className="p-4 overflow-y-auto h-full pb-20 space-y-4">
              {recentOrders.length === 0 ? <p className="text-center text-gray-400 mt-20 font-bold uppercase text-[10px]">Kosong</p> : recentOrders.map(o => (
                <div key={o.id} className="bg-gray-50 border rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-xs uppercase">{o.customerName || 'Customer'}</p>
                      <p className="text-[10px] font-bold text-gray-400">{o.customerPhone}</p>
                    </div>
                    <span className="bg-red-100 text-red-600 text-[8px] font-black px-2 py-1 rounded uppercase">Masuk</span>
                  </div>
                  <div className="space-y-1">
                    {o.items?.map((i:any, idx:number) => <p key={idx} className="text-[10px] font-bold text-gray-500">• {i.name} ({i.quantity}x)</p>)}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <p className="font-black text-blue-600 text-sm">Rp{(o.total || 0).toLocaleString()}</p>
                    <div className="flex gap-2">
                      <a href={`https://wa.me/${o.customerPhone}`} target="_blank" className="p-2 bg-green-50 text-green-600 rounded-lg"><MessageSquare size={16}/></a>
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