'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Package, Truck, Store, MapPin, CreditCard, Upload, User, Printer, Send, Bike, Box, Info, AlertCircle, CheckCircle2, ChevronLeft, X, Plus, Minus, Clock, Loader2, FileText } from 'lucide-react';
import { addDoc, collection, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import imageCompression from 'browser-image-compression';

const TOKO_LAT = -7.8014;
const TOKO_LNG = 111.8139;

const generateOrderId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ATY-${result}`;
};

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Data Form (Opsional)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  
  // State Alamat Tersimpan
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [courierType, setCourierType] = useState<'toko' | 'ojol' | 'ekspedisi'>('toko');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  
  const [distance, setDistance] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('atayatoko-cart');
    if (saved) setCart(JSON.parse(saved));

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setSavedAddresses(userData.addresses || []);
        }
      }
      setIsLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectAddress = (addr: any) => {
    setCustomerName(addr.receiverName);
    setCustomerPhone(addr.receiverPhone);
    setCustomerAddress(addr.address);
    setDeliveryMethod('delivery');
    setCourierType('toko');
  };

  useEffect(() => {
    if (!paymentProof) { setProofPreview(null); return; }
    const url = URL.createObjectURL(paymentProof);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [paymentProof]);

  const compressImage = async (file: File) => {
    const options = { maxSizeMB: 0.1, maxWidthOrHeight: 1024, useWebWorker: true };
    try { return await imageCompression(file, options); } catch (e) { return file; }
  };

  const updateQty = (index: number, delta: number) => {
    const newCart = [...cart];
    const newQty = newCart[index].quantity + delta;
    if (newQty > 0) {
      newCart[index].quantity = newQty;
      setCart(newCart);
      localStorage.setItem('atayatoko-cart', JSON.stringify(newCart));
    } else if (confirm("Hapus produk?")) {
      newCart.splice(index, 1);
      setCart(newCart);
      localStorage.setItem('atayatoko-cart', JSON.stringify(newCart));
    }
  };

  const getItemPrice = (item: any) => {
    if (item.priceGrosir && item.quantity >= (item.minGrosir || 10)) return item.priceGrosir;
    return item.price;
  };

  const subtotal = cart.reduce((t, i) => t + (getItemPrice(i) * i.quantity), 0);
  const isGrosirTotal = subtotal >= 500000;

  const opStatus = (() => {
    const hour = new Date().getHours();
    if (hour < 7 || hour >= 21) return { ok: false, msg: "Toko Tutup (Buka 07:00-21:00)" };
    return { ok: true, msg: "Toko Buka & Siap Kirim" };
  })();

  const validation = (() => {
    if (deliveryMethod === 'pickup') return { ok: true, msg: "Ambil di Toko Ataya" };
    if (deliveryMethod === 'delivery' && courierType === 'toko') {
      if (distance !== null) {
         if (isGrosirTotal && distance > 10) return { ok: false, msg: "Jarak Grosir Maks 10km" };
         if (!isGrosirTotal && distance > 3) return { ok: false, msg: "Jarak Ecer Maks 3km" };
      }
      if (!isGrosirTotal && subtotal < 100000) return { ok: false, msg: "Min. Belanja Kurir Toko 100rb" };
    }
    return { ok: true, msg: "Siap dipesan" };
  })();

  const handleCheckout = async () => {
    if (paymentMethod !== 'cash' && !paymentProof) return alert("Upload bukti transfer!");
    
    setIsSubmitting(true);
    const orderId = generateOrderId();
    const finalName = customerName || 'Pelanggan Umum';
    const finalPhone = customerPhone || '-';

    try {
      let proofUrl = "";
      if (paymentProof) {
        const compressed = await compressImage(paymentProof);
        const sRef = ref(storage, `payments/${orderId}`);
        const snap = await uploadBytes(sRef, compressed);
        proofUrl = await getDownloadURL(snap.ref);
      }

      await addDoc(collection(db, 'orders'), {
        orderId, name: finalName, phone: finalPhone, items: cart, total: subtotal,
        delivery: { method: deliveryMethod, type: courierType, address: customerAddress || 'Ambil di Toko' },
        payment: { method: paymentMethod, proof: proofUrl },
        status: 'PENDING', createdAt: serverTimestamp(), userId: user?.uid || 'guest'
      });

      // --- STRUK WHATSAPP PROFESIONAL ---
      const line = "------------------------------------------";
      const itemText = cart.map(i => `• ${i.name}\n  ${i.quantity}x @Rp${getItemPrice(i).toLocaleString()} = Rp${(getItemPrice(i)*i.quantity).toLocaleString()}`).join('\n\n');
      
      const waMsg = `*STRUK PESANAN ATAYA TOKO*\n${line}\n*ID:* ${orderId}\n*TANGGAL:* ${new Date().toLocaleString('id-ID')}\n${line}\n*PELANGGAN:* ${finalName}\n*WHATSAPP:* ${finalPhone}\n${line}\n\n*RINCIAN PESANAN:*\n${itemText}\n\n${line}\n*TOTAL BAYAR: Rp${subtotal.toLocaleString()}*\n${line}\n*METODE:* ${paymentMethod.toUpperCase()}\n*PENGIRIMAN:* ${deliveryMethod.toUpperCase()} (${courierType.toUpperCase()})\n*ALAMAT:* ${customerAddress || 'Ambil di Toko'}\n\n_Mohon tunggu konfirmasi Admin. Terima kasih!_`;

      window.open(`https://wa.me/6285853161174?text=${encodeURIComponent(waMsg)}`, '_blank');
      localStorage.removeItem('atayatoko-cart');
      router.push(`/success?id=${orderId}`);
    } catch (e) { alert("Error simpan data."); } finally { setIsSubmitting(false); }
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-green-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
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

          {/* List Barang */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/60 overflow-hidden">
            <h2 className="font-black mb-5 flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-slate-400"><Package size={16}/> Item Dalam Keranjang</h2>
            <div className="divide-y divide-slate-100">
                {cart.map((item, idx) => (
                    <div key={idx} className="flex gap-4 py-4 items-center group">
                        <div className="relative">
                            <img src={item.image} className="w-16 h-16 rounded-2xl object-cover bg-slate-100 group-hover:scale-105 transition-transform" />
                            <span className="absolute -top-2 -right-2 bg-green-600 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{item.quantity}</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-black text-slate-800 leading-tight mb-1">{item.name}</h3>
                            <p className="font-black text-xs text-green-600 tracking-wide">Rp{getItemPrice(item).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                            <button onClick={()=>updateQty(idx, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-rose-500 shadow-sm active:scale-90 transition-all"><Minus size={14}/></button>
                            <button onClick={()=>updateQty(idx, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-green-600 shadow-sm active:scale-90 transition-all"><Plus size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* Pengiriman & Alamat */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200/60 space-y-6">
            <h2 className="font-black flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-slate-400"><Truck size={16}/> Informasi Pengiriman</h2>
            
            {savedAddresses.length > 0 && (
              <div className="bg-emerald-50/60 p-5 rounded-3xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-700 uppercase mb-4 tracking-widest flex items-center gap-2"><MapPin size={12}/> Pilih Alamat Tersimpan</p>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {savedAddresses.map((addr) => (
                    <button key={addr.id} type="button" onClick={() => handleSelectAddress(addr)} className="flex-shrink-0 w-64 p-5 text-left bg-white border-2 border-transparent hover:border-green-500 rounded-[1.5rem] shadow-sm transition-all hover:shadow-md focus:border-green-500 active:scale-95 group">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md">{addr.label}</span>
                        <CheckCircle2 size={16} className="text-green-500 opacity-0 group-focus:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs font-black text-slate-800 uppercase mb-1">{addr.receiverName}</p>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed line-clamp-2">{addr.address}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Identitas Penerima (Opsional)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative flex items-center">
                        <User size={16} className="absolute left-4 text-slate-400" />
                        <input placeholder="Nama Penerima" value={customerName} onChange={e=>setCustomerName(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" />
                    </div>
                    <div className="relative flex items-center">
                        <Send size={16} className="absolute left-4 text-slate-400" />
                        <input placeholder="No. WhatsApp" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" />
                    </div>
                </div>
            </div>

            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
              <button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-3 rounded-[1rem] text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-2 ${deliveryMethod === 'pickup' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400 hover:text-slate-600'}`}><Store size={14}/> AMBIL SENDIRI</button>
              <button onClick={() => setDeliveryMethod('delivery')} className={`flex-1 py-3 rounded-[1rem] text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-2 ${deliveryMethod === 'delivery' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400 hover:text-slate-600'}`}><Truck size={14}/> DIANTAR</button>
            </div>

            {deliveryMethod === 'delivery' && (
              <div className="space-y-4 pt-2 animate-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-3 gap-2">
                    {['toko', 'ojol', 'ekspedisi'].map((type) => (
                        <button key={type} onClick={()=>setCourierType(type as any)} className={`p-4 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95 ${courierType === type ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>
                            {type === 'toko' ? <Truck size={20}/> : type === 'ojol' ? <Bike size={20}/> : <Box size={20}/>}
                            <span className="text-[9px] font-black uppercase tracking-tighter">{type}</span>
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <MapPin size={18} className="absolute top-4 left-4 text-slate-300" />
                    <textarea placeholder="Alamat Lengkap & Patokan Rumah (Wajib jika diantar)..." value={customerAddress} onChange={e=>setCustomerAddress(e.target.value)} className="w-full pl-12 p-4 bg-slate-50 border border-slate-100 rounded-2xl h-32 text-xs font-black outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" />
                </div>
              </div>
            )}
            
            <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-colors ${validation.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
              {validation.ok ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}
              <span className="text-[10px] font-black uppercase tracking-widest">{validation.msg}</span>
            </div>
          </div>
        </div>

        {/* Payment Sidebar */}
        <div className="space-y-5">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl sticky top-24 border border-slate-100">
            <h2 className="font-black flex items-center mb-8 text-slate-700 text-[10px] tracking-[0.2em] uppercase"><CreditCard size={18} className="mr-3 text-green-600"/> Metode Bayar</h2>
            
            <div className="space-y-3 mb-8">
              {['cash', 'transfer', 'qris'].map(m => (
                <button key={m} onClick={()=>setPaymentMethod(m as any)} className={`w-full p-4 border-2 rounded-2xl text-left transition-all flex items-center justify-between ${paymentMethod === m ? 'border-green-600 bg-green-50/50 text-green-700 shadow-sm' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">{m === 'cash' ? '💵 Bayar Ditempat' : m === 'transfer' ? '🏦 Transfer Bank' : '📱 QRIS / E-Wallet'}</span>
                  {paymentMethod === m && <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />}
                </button>
              ))}
            </div>

            {paymentMethod !== 'cash' && (
              <div className="mb-8 animate-in zoom-in-95 duration-300">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem] p-6 cursor-pointer h-44 hover:border-green-400 hover:bg-green-50/30 transition-all relative overflow-hidden bg-slate-50/50 group">
                  {proofPreview ? (
                    <img src={proofPreview} className="h-full w-full object-contain p-2" />
                  ) : (
                    <>
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                            <Upload size={20} className="text-slate-400" />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Klik Upload Bukti</span>
                    </>
                  )}
                  <input type="file" hidden accept="image/*" onChange={e=>setPaymentProof(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}

            <div className="space-y-4 border-t border-slate-50 pt-6">
                <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-widest">Subtotal Barang</span>
                    <span className="text-xs font-bold">Rp{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Total Bayar</span>
                    <span className="text-3xl font-black text-green-600">Rp{subtotal.toLocaleString()}</span>
                </div>
            </div>

            <button onClick={handleCheckout} disabled={!validation.ok || isSubmitting} className="w-full bg-green-600 text-white py-5 rounded-[1.5rem] font-black mt-8 shadow-[0_15px_30px_-10px_rgba(22,163,74,0.4)] disabled:bg-slate-200 disabled:shadow-none hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.1em]">
              {isSubmitting ? (
                 <>
                   <Loader2 className="animate-spin" size={20}/>
                   <span>Memproses...</span>
                 </>
              ) : (
                 <><Send size={18} /><span>Konfirmasi Pesanan</span></>
              )}
            </button>

            <p className="text-[8px] text-slate-400 text-center mt-5 font-bold uppercase tracking-widest px-4">Dengan mengklik tombol diatas, pesanan akan diteruskan ke WhatsApp Admin.</p>
          </div>
        </div>
      </main>
    </div>
  );
}