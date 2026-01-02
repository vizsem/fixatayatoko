'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShoppingCart, Trash2, Package, Truck, Store, MapPin, 
  CreditCard, Upload, User, Send, Bike, Box, Info, 
  AlertCircle, CheckCircle2, ChevronLeft, Plus, Minus, 
  Clock, Loader2 
} from 'lucide-react';
import { addDoc, collection, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';

// Fungsi Kompresi Gambar
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.7);
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

const generateOrderId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return `ATY-${result}`;
};

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [courierType, setCourierType] = useState<'toko' | 'ojol' | 'ekspedisi'>('toko');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- LOGIKA SINKRONISASI ---
  useEffect(() => {
    const fetchCombinedCart = async (uid: string | null) => {
      // 1. Ambil data Lokal (Key 'cart')
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
      
      // 2. Ambil data Cloud
      let cloudItems: any[] = [];
      const currentUid = uid || localStorage.getItem('temp_user_id');
      if (currentUid) {
        setUserId(currentUid);
        try {
          const cartSnap = await getDoc(doc(db, 'carts', currentUid));
          if (cartSnap.exists()) cloudItems = cartSnap.data().items || [];
        } catch (e) { console.error("Cloud error:", e); }
      }

      // 3. Merging
      const merged = [...cloudItems];
      localCart.forEach((lItem: any) => {
        const idToMatch = lItem.id || lItem.productId;
        const exists = merged.find(m => (m.productId === idToMatch || m.id === idToMatch));
        if (!exists) merged.push({ ...lItem, productId: idToMatch });
      });

      setCart(merged);
      setIsLoaded(true);
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userSnap.exists()) setSavedAddresses(userSnap.data().addresses || []);
        fetchCombinedCart(firebaseUser.uid);
      } else {
        fetchCombinedCart(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Helper Sync & Dispatch Event
  const syncAndNotify = (newCart: any[]) => {
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cart-updated')); // Kabari Beranda
    
    const currentUid = userId || localStorage.getItem('temp_user_id');
    if (currentUid) {
      setDoc(doc(db, 'carts', currentUid), {
        userId: currentUid,
        items: newCart,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  };

  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    const newQty = newCart[index].quantity + delta;
    if (newQty > 0) {
      newCart[index].quantity = newQty;
      syncAndNotify(newCart);
    } else if (confirm("Hapus produk?")) {
      newCart.splice(index, 1);
      syncAndNotify(newCart);
    }
  };

  const getItemPrice = (item: any) => {
    const priceGrosir = item.wholesalePrice || item.priceGrosir;
    const minGrosir = item.minWholesale || item.minGrosir || 10;
    return (priceGrosir && item.quantity >= minGrosir) ? priceGrosir : item.price;
  };

  const subtotal = cart.reduce((t, i) => t + (getItemPrice(i) * i.quantity), 0);
  const isGrosirTotal = subtotal >= 500000;

  const opStatus = (() => {
    const hour = new Date().getHours();
    return (hour < 7 || hour >= 21) 
      ? { ok: false, msg: "Toko Tutup (Buka 07:00-21:00)" } 
      : { ok: true, msg: "Toko Buka & Siap Kirim" };
  })();

  const validation = (() => {
    if (cart.length === 0) return { ok: false, msg: "Keranjang Kosong" };
    if (deliveryMethod === 'pickup') return { ok: true, msg: "Ambil di Toko Ataya" };
    if (deliveryMethod === 'delivery' && courierType === 'toko') {
      if (!isGrosirTotal && subtotal < 100000) return { ok: false, msg: "Min. Belanja Kurir Toko 100rb" };
    }
    return { ok: true, msg: "Siap dipesan" };
  })();

  const handleCheckout = async () => {
    if (paymentMethod !== 'cash' && !paymentProof) return toast.error("Upload bukti transfer!");
    setIsSubmitting(true);
    const orderId = generateOrderId();

    try {
      let proofUrl = "";
      if (paymentProof) {
        const compressed = await compressImage(paymentProof);
        const sRef = ref(storage, `payments/${orderId}`);
        const snap = await uploadBytes(sRef, compressed);
        proofUrl = await getDownloadURL(snap.ref);
      }

      await addDoc(collection(db, 'orders'), {
        orderId, name: customerName || 'Pelanggan Umum', phone: customerPhone || '-', 
        items: cart, total: subtotal,
        delivery: { method: deliveryMethod, type: courierType, address: customerAddress || 'Ambil di Toko' },
        payment: { method: paymentMethod, proof: proofUrl },
        status: 'PENDING', createdAt: serverTimestamp(), userId: userId || 'guest'
      });

      if (userId) await setDoc(doc(db, 'carts', userId), { items: [], updatedAt: serverTimestamp() });

      const itemText = cart.map(i => `• ${i.name}\n  ${i.quantity}x @Rp${getItemPrice(i).toLocaleString()} = Rp${(getItemPrice(i)*i.quantity).toLocaleString()}`).join('\n\n');
      const waMsg = `*STRUK PESANAN ATAYA TOKO*\n------------------------------------------\n*ID:* ${orderId}\n*PELANGGAN:* ${customerName || 'Umum'}\n------------------------------------------\n\n*RINCIAN:*\n${itemText}\n\n*TOTAL: Rp${subtotal.toLocaleString()}*\n*METODE:* ${paymentMethod.toUpperCase()}\n\n_Mohon tunggu konfirmasi Admin._`;

      window.open(`https://wa.me/6285853161174?text=${encodeURIComponent(waMsg)}`, '_blank');
      localStorage.removeItem('cart');
      window.dispatchEvent(new Event('cart-updated'));
      router.push(`/success?id=${orderId}`);
    } catch (e) { 
      toast.error("Gagal memproses pesanan."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-green-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <Toaster position="top-center" />
      <header className="bg-white/80 backdrop-blur-md p-4 shadow-sm flex items-center gap-4 sticky top-0 z-50 border-b">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft /></button>
        <h1 className="font-black text-green-600 uppercase text-sm tracking-widest">Konfirmasi Checkout</h1>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Status Toko */}
          <div className={`p-4 rounded-3xl flex items-center gap-4 border-2 ${opStatus.ok ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
            <Clock size={24} className="flex-shrink-0" />
            <div className="text-xs uppercase font-black tracking-wider">
                <p className="opacity-60 mb-0.5">Status Toko</p>
                <p>{opStatus.msg}</p>
            </div>
          </div>

          {/* List Items */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/60 overflow-hidden">
            <h2 className="font-black mb-5 flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-slate-400"><Package size={16}/> Item Dalam Keranjang</h2>
            {cart.length > 0 ? (
              <div className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                      <div key={idx} className="flex gap-4 py-4 items-center group">
                          <div className="relative">
                              <img src={item.image} className="w-16 h-16 rounded-2xl object-cover bg-slate-100" />
                              <span className="absolute -top-2 -right-2 bg-green-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{item.quantity}</span>
                          </div>
                          <div className="flex-1">
                              <h3 className="text-sm font-black text-slate-800 leading-tight mb-1">{item.name}</h3>
                              <p className="font-black text-xs text-green-600">Rp{getItemPrice(item).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                              <button onClick={()=>updateQty(idx, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-rose-500 shadow-sm"><Minus size={14}/></button>
                              <button onClick={()=>updateQty(idx, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-green-600 shadow-sm"><Plus size={14}/></button>
                          </div>
                      </div>
                  ))}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase">Keranjang Anda Kosong</div>
            )}
          </div>

          {/* Informasi Pengiriman */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/60 space-y-6">
            <h2 className="font-black flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-slate-400"><Truck size={16}/> Informasi Pengiriman</h2>
            
            {savedAddresses.length > 0 && (
              <div className="bg-emerald-50/60 p-5 rounded-3xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-700 uppercase mb-4 tracking-widest flex items-center gap-2"><MapPin size={12}/> Pilih Alamat Tersimpan</p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {savedAddresses.map((addr) => (
                    <button key={addr.id} onClick={() => {
                      setCustomerName(addr.receiverName);
                      setCustomerPhone(addr.receiverPhone);
                      setCustomerAddress(addr.address);
                      setDeliveryMethod('delivery');
                    }} className="flex-shrink-0 w-64 p-5 text-left bg-white border-2 border-transparent hover:border-green-500 rounded-[1.5rem] shadow-sm transition-all">
                      <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md mb-2 inline-block">{addr.label}</span>
                      <p className="text-xs font-black text-slate-800 uppercase mb-1">{addr.receiverName}</p>
                      <p className="text-[10px] text-slate-500 font-bold line-clamp-2">{addr.address}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative flex items-center">
                    <User size={16} className="absolute left-4 text-slate-400" />
                    <input placeholder="Nama Penerima" value={customerName} onChange={e=>setCustomerName(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none" />
                </div>
                <div className="relative flex items-center">
                    <Send size={16} className="absolute left-4 text-slate-400" />
                    <input placeholder="No. WhatsApp" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none" />
                </div>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-3 rounded-[1rem] text-[10px] font-black tracking-widest transition-all ${deliveryMethod === 'pickup' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>AMBIL SENDIRI</button>
              <button onClick={() => setDeliveryMethod('delivery')} className={`flex-1 py-3 rounded-[1rem] text-[10px] font-black tracking-widest transition-all ${deliveryMethod === 'delivery' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>DIANTAR</button>
            </div>

            {deliveryMethod === 'delivery' && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-3 gap-2">
                    {['toko', 'ojol', 'ekspedisi'].map((type) => (
                        <button key={type} onClick={()=>setCourierType(type as any)} className={`p-4 border-2 rounded-2xl flex flex-col items-center gap-2 ${courierType === type ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                            {type === 'toko' ? <Truck size={20}/> : type === 'ojol' ? <Bike size={20}/> : <Box size={20}/>}
                            <span className="text-[9px] font-black uppercase">{type}</span>
                        </button>
                    ))}
                </div>
                <textarea placeholder="Alamat Lengkap..." value={customerAddress} onChange={e=>setCustomerAddress(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-32 text-xs font-black outline-none" />
              </div>
            )}

            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${validation.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
              {validation.ok ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
              <span className="text-[10px] font-black uppercase tracking-widest">{validation.msg}</span>
            </div>
          </div>
        </div>

        {/* Sidebar Payment */}
        <div className="space-y-5">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl sticky top-24 border border-slate-100">
            <h2 className="font-black flex items-center mb-8 text-slate-700 text-[10px] tracking-[0.2em] uppercase"><CreditCard size={18} className="mr-3 text-green-600"/> Metode Bayar</h2>
            <div className="space-y-3 mb-8">
              {['cash', 'transfer', 'qris'].map(m => (
                <button key={m} onClick={()=>setPaymentMethod(m as any)} className={`w-full p-4 border-2 rounded-2xl text-left transition-all ${paymentMethod === m ? 'border-green-600 bg-green-50/50 text-green-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">{m === 'cash' ? '💵 Bayar Ditempat' : m === 'transfer' ? '🏦 Transfer Bank' : '📱 QRIS / E-Wallet'}</span>
                </button>
              ))}
            </div>
            {paymentMethod !== 'cash' && (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem] p-6 cursor-pointer h-44 mb-8 bg-slate-50/50">
                {proofPreview ? <img src={proofPreview} className="h-full object-contain" /> : <><Upload size={20} className="text-slate-400 mb-3" /><span className="text-[9px] font-black text-slate-400 uppercase">Upload Bukti</span></>}
                <input type="file" hidden accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPaymentProof(file);
                    setProofPreview(URL.createObjectURL(file));
                  }
                }} />
              </label>
            )}
            <div className="space-y-4 border-t border-slate-50 pt-6">
                <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] font-black uppercase">Subtotal</span>
                    <span className="text-xs font-bold">Rp{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-900 uppercase">Total Bayar</span>
                    <span className="text-3xl font-black text-green-600">Rp{subtotal.toLocaleString()}</span>
                </div>
            </div>
            <button onClick={handleCheckout} disabled={!validation.ok || isSubmitting} className="w-full bg-green-600 text-white py-5 rounded-[1.5rem] font-black mt-8 shadow-lg disabled:bg-slate-200 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest">
              {isSubmitting ? <><Loader2 className="animate-spin" size={20}/><span>Memproses...</span></> : <><Send size={18} /><span>Konfirmasi Pesanan</span></>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}