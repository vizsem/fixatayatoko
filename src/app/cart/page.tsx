'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextImage from 'next/image';
import {
  CheckCircle2, ChevronLeft, Coins, CreditCard,
  Loader2, MapPin, Package, Send,
  Snowflake, Ticket, Upload
} from 'lucide-react';


import { collection, doc, getDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';
import { CartItem, UserProfile, Voucher } from '@/lib/types';





// ... (Fungsi compressImage dan generateOrderId tetap sama seperti sebelumnya) ...
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

// Order ID dihasilkan di server

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);



  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');





  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [courierType] = useState<'toko' | 'ojol' | 'ekspedisi'>('toko');


  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  // STATE POIN & VOUCHER
  const [usePoints, setUsePoints] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [promoProduct, setPromoProduct] = useState<CartItem | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch Promo Product (Minyak atau produk lain untuk tebus murah)
    const fetchPromo = async () => {
       try {
         // Cari produk yang namanya mengandung "Minyak"
         const q = query(collection(db, 'products'), where('Nama', '>=', 'Minyak'), where('Nama', '<=', 'Minyak\uf8ff'), limit(1));
         const snap = await getDocs(q);
         if (!snap.empty) {
            const d = snap.docs[0].data();
            setPromoProduct({ id: snap.docs[0].id, ...d } as CartItem);
         } else {
            // Fallback cari sembarang produk jika tidak ada Minyak (untuk demo)
            const q2 = query(collection(db, 'products'), limit(1));
            const snap2 = await getDocs(q2);
            if (!snap2.empty) {
               const d = snap2.docs[0].data();
               setPromoProduct({ id: snap2.docs[0].id, ...d } as CartItem);
            }
         }
       } catch (e) { console.log("Promo fetch error", e); }
    };
    fetchPromo();

    const fetchCombinedCart = async (uid: string | null) => {
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
      let cloudItems: CartItem[] = [];

      const currentUid = uid || localStorage.getItem('temp_user_id');
      if (currentUid) {
        setUserId(currentUid);
        try {
          const cartSnap = await getDoc(doc(db, 'carts', currentUid));
          if (cartSnap.exists()) cloudItems = cartSnap.data().items || [];
          const userSnap = await getDoc(doc(db, 'users', currentUid));
          if (userSnap.exists()) setUserData(userSnap.data() as UserProfile);

        } catch { }

      }
      const merged = [...cloudItems];
      localCart.forEach((lItem: CartItem) => {
        const idToMatch = lItem.id || lItem.ID;
        const exists = merged.find(m => (m.id === idToMatch || m.ID === idToMatch));
        if (!exists) merged.push({ ...lItem });

      });
      setCart(merged);
      setIsLoaded(true);
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userSnap.exists()) {
          setUserData(userSnap.data() as UserProfile);
        }


        fetchCombinedCart(firebaseUser.uid);
      } else {
        fetchCombinedCart(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // LOGIKA HITUNG HARGA
  const getItemPrice = (item: CartItem) => {
    if (item.promoType === 'TEBUS_MURAH') return 10000;
    const priceGrosir = item.Grosir;
    const minGrosir = item.Min_Grosir || 10;
    return (priceGrosir && item.quantity >= minGrosir) ? priceGrosir : (item.Ecer || item.price || 0);
  };


  const subtotal = cart.reduce((t, i) => t + (getItemPrice(i) * i.quantity), 0);

  const isGrosirTotal = cart.some(item => {
    const minGrosir = item.Min_Grosir || 10;
    return item.quantity >= minGrosir;
  });


  // HITUNG DISKON POIN (Maks 50% dari Subtotal)
  const userPoints = userData?.points || 0;
  const isFrozen = userData?.isPointsFrozen || false;
  const maxRedeemable = subtotal * 0.5;
  const pointsToUse = usePoints ? Math.min(userPoints, maxRedeemable) : 0;

  // HITUNG DISKON VOUCHER
  const voucherDiscount = appliedVoucher ? appliedVoucher.value : 0;

  // TOTAL AKHIR
  const totalBayar = Math.max(0, subtotal - pointsToUse - voucherDiscount);

  // FUNGSI CEK VOUCHER
  const handleCheckVoucher = async () => {
    if (!voucherCode) return toast.error("Masukkan kode voucher!");
    if (!userId) return toast.error("Silakan login untuk menggunakan voucher");

    try {
      const q = query(collection(db, 'user_vouchers'),
        where('userId', '==', userId),
        where('code', '==', voucherCode.toUpperCase()),
        where('status', '==', 'ACTIVE')
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error("Voucher tidak valid atau sudah digunakan");
      } else {
        const docSnap = snap.docs[0];
        const vData = { id: docSnap.id, ...docSnap.data() } as Voucher;

        setAppliedVoucher(vData);
        toast.success(`Voucher Berhasil: ${vData.name}`);

      }
    } catch {
      toast.error("Gagal memeriksa voucher");
    }
  };

  // Tambahkan ini di dalam fungsi CartPage, sebelum bagian return
  const validation = (() => {
    if (cart.length === 0) return { ok: false, msg: "Keranjang Kosong" };

    // Validasi Pengiriman
    if (deliveryMethod === 'delivery' && courierType === 'toko') {
      if (!isGrosirTotal && subtotal < 100000) {
        return { ok: false, msg: "Min. Belanja Kurir Toko 100rb" };
      }
    }

    // Jika semua oke
    return { ok: true, msg: "Siap dipesan" };
  })();
  const handleCheckout = async () => {
    if (paymentMethod !== 'cash' && !paymentProof) return toast.error("Upload bukti transfer!");
    setIsSubmitting(true);
    // const orderId = generateOrderId(); // Generated on server now

    try {
      let proofUrl = "";
      if (paymentProof) {
        // Upload proof first (client-side upload is fine for now, URL passed to server)
        const compressed = await compressImage(paymentProof);
        // We need a temp ID for filename since we don't have orderId yet, or generate one client side just for filename
        const tempId = `proof-${Date.now()}`;
        const sRef = ref(storage, `payments/${tempId}`);
        const snap = await uploadBytes(sRef, compressed);
        proofUrl = await getDownloadURL(snap.ref);
      }

      // CALL SECURE API
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({ id: item.id || item.ID, quantity: item.quantity })),
          customer: {
            name: customerName,
            phone: customerPhone,
            address: customerAddress
          },
          delivery: {
            method: deliveryMethod,
            type: courierType,
            address: customerAddress
          },
          payment: {
            method: paymentMethod,
            proof: proofUrl
          },
          userId,
          voucherCode: appliedVoucher?.code,
          usePoints
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal memproses pesanan');
      }

      // Success Logic handled by API (DB updates), just local cleanup here
      localStorage.removeItem('cart');
      window.dispatchEvent(new Event('cart-updated'));
      router.push(`/success?id=${result.orderId}`);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gagal memproses pesanan.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 page-fade">
        <Loader2 className="animate-spin text-green-600 mb-3" size={28} />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Memuat keranjang...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 page-fade">
      <Toaster position="top-center" />
      <header className="bg-white/80 backdrop-blur-md p-4 shadow-sm flex items-center gap-4 sticky top-0 z-50 border-b">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft /></button>
        <h1 className="font-black text-green-600 uppercase text-sm tracking-widest italic underline decoration-yellow-400">Checkout</h1>
        <div className="ml-auto">
          <NextImage src="/logo-atayatoko.png" alt="Logo" width={100} height={24} className="h-6 w-auto" />
        </div>
      </header>


      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* PROMO BANNER TEBUS MURAH */}
          {subtotal >= 50000 && promoProduct && !cart.some(i => i.promoType === 'TEBUS_MURAH') && (
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden mb-6 animate-in slide-in-from-top-4">
               <div className="relative z-10 flex items-center justify-between">
                  <div className="flex-1 pr-4">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[9px] font-black uppercase mb-2 inline-block animate-pulse">🎉 Spesial Offer</span>
                    <h3 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">Tebus Murah Cuma 10rb!</h3>
                    <p className="text-xs font-bold opacity-90 mb-4 line-clamp-1">{promoProduct.Nama || promoProduct.name} (Normal: Rp{(promoProduct.Ecer || promoProduct.price || 0).toLocaleString()})</p>
                    <button 
                      onClick={() => {
                        const newItem = { ...promoProduct, quantity: 1, promoType: 'TEBUS_MURAH', price: 10000 };
                        const newCart = [...cart, newItem];
                        setCart(newCart);
                        localStorage.setItem('cart', JSON.stringify(newCart));
                        window.dispatchEvent(new Event('cart-updated'));
                        toast.success('Promo berhasil diambil!');
                      }}
                      className="bg-white text-red-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all hover:bg-gray-100"
                    >
                      Ambil Sekarang
                    </button>
                  </div>
                  <div className="w-20 h-20 bg-white rounded-2xl p-1 rotate-6 shadow-2xl flex-shrink-0">
                     <NextImage src={promoProduct.Link_Foto || promoProduct.image || '/logo-atayatoko.png'} width={100} height={100} className="w-full h-full object-cover rounded-xl" alt="" />
                  </div>
               </div>
               <div className="absolute -right-4 -bottom-10 opacity-10 rotate-12">
                 <Package size={140} />
               </div>
            </div>
          )}

          {/* CART ITEMS (Tampilan ringkas) */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <h2 className="font-black mb-5 flex items-center gap-2 text-[10px] tracking-widest uppercase text-slate-400"><Package size={16} /> Daftar Belanja</h2>
            <div className="space-y-4">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <NextImage
                      src={item.Link_Foto || item.image || '/logo-atayatoko.png'}
                      alt={item.Nama || item.name || 'Produk'}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl object-cover shadow-sm"
                    />
                    <div>
                      <p className="text-[10px] font-black uppercase leading-tight">{item.Nama || item.name}</p>
                      <p className="text-[9px] font-bold text-green-600 uppercase">Rp{getItemPrice(item).toLocaleString()} x {item.quantity}</p>
                    </div>
                  </div>

                  <p className="text-xs font-black italic">Rp{(getItemPrice(item) * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* WIDGET POIN & VOUCHER (Kombinasi Baru) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box Poin */}
            <div className={`p-6 rounded-[2rem] border-2 transition-all ${usePoints ? 'bg-blue-50 border-blue-200 shadow-lg shadow-blue-100' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${isFrozen ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {isFrozen ? <Snowflake size={20} /> : <Coins size={20} />}
                  </div>
                  <div>
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saldo Poin</h3>
                    <p className="text-sm font-black italic">{userPoints.toLocaleString()}</p>
                  </div>
                </div>
                {!isFrozen && userId && (
                  <button onClick={() => setUsePoints(!usePoints)} className={`w-12 h-6 rounded-full transition-all relative ${usePoints ? 'bg-blue-600 shadow-inner' : 'bg-slate-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${usePoints ? 'left-7' : 'left-1'}`} />
                  </button>
                )}
              </div>
              {isFrozen && <p className="text-[8px] font-black text-red-500 uppercase italic mt-3">* Poin dibekukan Admin</p>}
            </div>

            {/* Box Input Voucher */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100">
              <div className="flex items-center gap-3 mb-3 text-slate-400">
                <Ticket size={20} />
                <span className="text-[9px] font-black uppercase tracking-widest">Gunakan Voucher</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="KODE..."
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-green-400"
                />
                <button onClick={handleCheckVoucher} className="bg-black text-white px-4 rounded-xl text-[10px] font-black uppercase transition-transform active:scale-90">CEK</button>
              </div>
              {appliedVoucher && (
                <div className="mt-2 bg-emerald-50 p-2 rounded-xl flex items-center justify-between border border-emerald-100">
                  <span className="text-[8px] font-black text-emerald-600 uppercase">🎟️ {appliedVoucher.name}</span>
                  <button onClick={() => setAppliedVoucher(null)} className="text-[8px] font-black text-rose-500">BATAL</button>
                </div>
              )}
            </div>
          </div>

          {/* INFORMASI PENGIRIMAN (Form Ringkas) */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><MapPin size={16} /> Tujuan Pengantaran</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nama</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-slate-50 focus:bg-white focus:border-green-400" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">WhatsApp</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-slate-50 focus:bg-white focus:border-green-400" />
              </div>
            </div>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${deliveryMethod === 'pickup' ? 'bg-white shadow-md text-green-600' : 'text-slate-400'}`}>Ambil Sendiri</button>
              <button onClick={() => setDeliveryMethod('delivery')} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase ${deliveryMethod === 'delivery' ? 'bg-white shadow-md text-green-600' : 'text-slate-400'}`}>Kirim Ke Rumah</button>
            </div>
            {deliveryMethod === 'delivery' && (
              <textarea placeholder="Tulis alamat lengkap Anda..." value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full p-5 bg-slate-50 rounded-[1.5rem] text-xs font-black h-28 outline-none border border-slate-50 focus:bg-white focus:border-green-400" />
            )}
          </div>
        </div>

        {/* SIDEBAR PAYMENT & TOTAL */}
        <div className="space-y-5">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 sticky top-24">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2"><CreditCard size={18} /> Metode Bayar</h2>
            <div className="grid grid-cols-1 gap-2 mb-8">
              {(['cash', 'transfer', 'qris'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)} className={`p-4 border-2 rounded-2xl text-left transition-all flex items-center justify-between ${paymentMethod === m ? 'border-green-600 bg-green-50 text-green-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                  <span className="text-[10px] font-black uppercase">{m}</span>
                  {paymentMethod === m && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>

            {paymentMethod !== 'cash' && (
              <label className="block bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-4 text-center cursor-pointer mb-8">
                {proofPreview ? (
                  <NextImage src={proofPreview} alt="Bukti Transfer" width={200} height={128} className="h-32 mx-auto rounded-xl object-contain" />
                ) : (
                  <div className="py-4">
                    <Upload size={20} className="mx-auto text-slate-400 mb-2" />
                    <span className="text-[9px] font-black uppercase text-slate-400">Bukti Transfer</span>
                  </div>
                )}
                <input type="file" hidden accept="image/*" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) { setPaymentProof(file); setProofPreview(URL.createObjectURL(file)); }
                }} />
              </label>
            )}

            <div className="space-y-3 pt-6 border-t border-slate-50">
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                <span>Subtotal</span>
                <span>Rp{subtotal.toLocaleString()}</span>
              </div>
              {pointsToUse > 0 && (
                <div className="flex justify-between text-[10px] font-black uppercase text-blue-600 italic">
                  <span>- Diskon Poin</span>
                  <span>Rp{pointsToUse.toLocaleString()}</span>
                </div>
              )}
              {voucherDiscount > 0 && (
                <div className="flex justify-between text-[10px] font-black uppercase text-emerald-600 italic">
                  <span>- Voucher</span>
                  <span>Rp{voucherDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-4">
                <span className="text-[11px] font-black uppercase italic">Total Akhir</span>
                <span className="text-3xl font-black text-green-600 italic tracking-tighter shadow-green-100 drop-shadow-sm">Rp{totalBayar.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={!validation.ok || isSubmitting}
              className="w-full bg-green-600 text-white py-5 rounded-[2rem] font-black mt-8 shadow-xl shadow-green-200 disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center justify-center gap-3 uppercase text-xs"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />}
              {isSubmitting ? "Processing..." : "Konfirmasi & Bayar"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
