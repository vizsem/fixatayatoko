'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Trash2, Package, Truck, Store, MapPin, CreditCard, Upload, User, Printer, Send, Bike, Box, Info, AlertCircle, CheckCircle2, ChevronLeft, X, Plus, Minus, Clock } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import imageCompression from 'browser-image-compression'; // TAMBAHAN: Library Kompresi

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
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
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
    setCustomerName(localStorage.getItem('atayatoko-customer-name') || '');
    setCustomerPhone(localStorage.getItem('atayatoko-customer-phone') || '');
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!paymentProof) { setProofPreview(null); return; }
    const url = URL.createObjectURL(paymentProof);
    setProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [paymentProof]);

  // --- TAMBAHAN: LOGIKA KOMPRESI ---
  const compressImage = async (file: File) => {
    const options = {
      maxSizeMB: 0.2, // Maks 200KB
      maxWidthOrHeight: 1024,
      useWebWorker: true,
      fileType: 'image/jpeg'
    };
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error("Compression error:", error);
      return file; // Kirim file asli jika kompresi gagal
    }
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

  const getOperationalStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    const isOpen = hour >= 7 && hour < 21;
    const isDeliveryTime = hour >= 8 && hour < 16;

    if (!isOpen) return { ok: false, msg: "Toko Tutup (Buka 07:00 - 21:00)", type: 'closed' };
    if (deliveryMethod === 'delivery' && !isDeliveryTime) {
      return { ok: true, msg: "Order diterima, dikirim besok pagi (Jadwal: 08:00 - 16:00)", type: 'delay' };
    }
    return { ok: true, msg: "Toko Buka & Siap Kirim", type: 'open' };
  };
  const opStatus = getOperationalStatus();

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  useEffect(() => {
    if (deliveryMethod === 'delivery' && courierType === 'toko' && isLoaded) {
      const initMap = () => {
        const win = window as any;
        const googleObj = win.google;
        if (!googleObj || !mapRef.current) return;
        const map = new googleObj.maps.Map(mapRef.current, {
          center: { lat: TOKO_LAT, lng: TOKO_LNG },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        });
        markerRef.current = new googleObj.maps.Marker({
          position: { lat: TOKO_LAT, lng: TOKO_LNG },
          map,
          draggable: true
        });
        markerRef.current.addListener('dragend', () => {
          const pos = markerRef.current.getPosition();
          const dist = calculateDistance(TOKO_LAT, TOKO_LNG, pos.lat(), pos.lng());
          setDistance(dist);
        });
      };
      if (!(window as any).google) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDV5Oz_zphv8UatLlZssdLkrbHSIZ8fOZI`;
        script.async = true;
        script.onload = initMap;
        document.head.appendChild(script);
      } else {
        initMap();
      }
    }
  }, [deliveryMethod, courierType, isLoaded]);

  const getStatus = () => {
  // 1. Jam operasional HANYA pesan, tidak memblokir tombol (Hapus pengecekan opStatus.ok di sini)
  
  if (deliveryMethod === 'pickup') return { ok: true, msg: "Ambil di Toko Ataya" };
  
  if (deliveryMethod === 'delivery' && courierType === 'toko') {
    // Cek Jarak hanya jika menggunakan Kurir Toko
    if (distance !== null) {
       if (isGrosirTotal && distance > 10) return { ok: false, msg: "Jarak Grosir Maks 10km" };
       if (!isGrosirTotal && distance > 3) return { ok: false, msg: "Jarak Ecer Maks 3km" };
    }
    // Cek Minimal Belanja hanya jika menggunakan Kurir Toko
    if (!isGrosirTotal && subtotal < 100000) return { ok: false, msg: "Min. Belanja Kurir Toko 100rb" };
  }

  // Jika semua pengecekan di atas lewat, maka tombol AKTIF
  return { ok: true, msg: "Data Lengkap, Siap Dipesan" };
};

  const validation = getStatus();

  // --- HANDLE CHECKOUT (DIUBAH UNTUK KOMPRESI) ---
  const handleCheckout = async () => {
    if (!customerName || !customerPhone) return alert("Isi Nama & No WA");
    if (paymentMethod !== 'cash' && !paymentProof) return alert("Mohon upload bukti pembayaran!");
    
    setIsSubmitting(true);
    const orderId = generateOrderId();

    try {
      let proofUrl = "";
      if (paymentProof) {
        // PROSES KOMPRESI SEBELUM UPLOAD
        const compressedFile = await compressImage(paymentProof);
        
        const sRef = ref(storage, `payments/${orderId}`);
        const snap = await uploadBytes(sRef, compressedFile); // Upload file terkompres
        proofUrl = await getDownloadURL(snap.ref);
      }

      const orderData = {
        orderId, name: customerName, phone: customerPhone, items: cart, total: subtotal,
        delivery: { method: deliveryMethod, type: courierType, address: customerAddress, distance: distance?.toFixed(2) || "N/A" },
        payment: { method: paymentMethod, proof: proofUrl },
        status: 'PENDING', createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderData);

      let itemNote = cart.map((i, idx) => `  ${idx + 1}. ${i.name} (${i.quantity}x) = Rp${(getItemPrice(i) * i.quantity).toLocaleString()}`).join('\n');
      const waMsg = `*PESANAN BARU - ${orderId}*\n------------------\n*Nama:* ${customerName}\n*WA:* ${customerPhone}\n*Metode:* ${deliveryMethod} (${courierType})\n*Bayar:* ${paymentMethod.toUpperCase()}\n------------------\n*PRODUK:*\n${itemNote}\n------------------\n*TOTAL: Rp${subtotal.toLocaleString()}*\n------------------\n*Alamat:* ${customerAddress || '-'}\n*Status:* ${opStatus.msg}`;

      window.open(`https://wa.me/6285853161174?text=${encodeURIComponent(waMsg)}`, '_blank');
      localStorage.removeItem('atayatoko-cart');
      router.push(`/success?id=${orderId}`);
    } catch (e) { 
      console.error(e);
      alert("Terjadi kesalahan saat upload/simpan data."); 
    } finally { setIsSubmitting(false); }
  };

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans pb-20">
      <header className="bg-white p-4 shadow-sm flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => router.back()}><ChevronLeft /></button>
        <h1 className="font-bold text-green-600">Checkout</h1>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          
          <div className={`p-4 rounded-2xl flex items-center gap-3 border ${opStatus.ok ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
            <Clock size={20}/>
            <div className="text-xs">
                <p className="font-bold uppercase tracking-tight">Informasi Operasional</p>
                <p className="opacity-80">{opStatus.msg}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-xs tracking-widest uppercase text-gray-400"><Package size={18} className="text-green-600"/> Item Pesanan</h2>
            <div className="space-y-4">
                {cart.map((item, idx) => {
                    const isGrosir = item.priceGrosir && item.quantity >= (item.minGrosir || 10);
                    const price = isGrosir ? item.priceGrosir : item.price;
                    return (
                        <div key={idx} className="flex gap-4 py-3 border-b border-gray-50 last:border-0 items-center">
                            <img src={item.image} className="w-14 h-14 rounded-lg object-cover bg-gray-100" />
                            <div className="flex-1">
                                <h3 className="text-sm font-bold">{item.name}</h3>
                                <div className="flex items-center gap-2">
                                    <p className={`font-bold text-xs ${isGrosir ? 'text-blue-600' : 'text-green-600'}`}>Rp{price.toLocaleString()}</p>
                                    {isGrosir && <span className="text-[8px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-black">GROSIR</span>}
                                </div>
                            </div>
                            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-2">
                                <button onClick={()=>updateQty(idx, -1)} className="bg-white p-1 rounded shadow-sm text-red-500 hover:bg-gray-50"><Minus size={14}/></button>
                                <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                <button onClick={()=>updateQty(idx, 1)} className="bg-green-600 p-1 rounded shadow-sm text-white hover:bg-green-700"><Plus size={14}/></button>
                            </div>
                        </div>
                    );
                })}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="font-bold flex items-center gap-2 text-xs tracking-widest uppercase text-gray-400"><Truck size={18} className="text-green-600"/> Pengiriman</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Nama Penerima" value={customerName} onChange={e=>setCustomerName(e.target.value)} className="p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-green-500 transition-all" />
              <input placeholder="Nomor WhatsApp" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} className="p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-green-500 transition-all" />
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${deliveryMethod === 'pickup' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>AMBIL SENDIRI</button>
              <button onClick={() => setDeliveryMethod('delivery')} className={`flex-1 py-3 rounded-lg text-xs font-black transition-all ${deliveryMethod === 'delivery' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>DIANTAR KURIR</button>
            </div>

            {deliveryMethod === 'delivery' && (
              <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={()=>setCourierType('toko')} className={`p-3 border rounded-xl flex flex-col items-center gap-1 ${courierType === 'toko' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-100 text-gray-400'}`}><Truck size={20}/><span className="text-[10px] font-bold">Kurir Toko</span></button>
                    <button onClick={()=>setCourierType('ojol')} className={`p-3 border rounded-xl flex flex-col items-center gap-1 ${courierType === 'ojol' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-100 text-gray-400'}`}><Bike size={20}/><span className="text-[10px] font-bold">Ojol</span></button>
                    <button onClick={()=>setCourierType('ekspedisi')} className={`p-3 border rounded-xl flex flex-col items-center gap-1 ${courierType === 'ekspedisi' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-100 text-gray-400'}`}><Box size={20}/><span className="text-[10px] font-bold">Ekspedisi</span></button>
                </div>
                <textarea placeholder="Alamat & Patokan Rumah..." value={customerAddress} onChange={e=>setCustomerAddress(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl h-20 text-sm outline-none focus:border-green-500 transition-all" />
                {courierType === 'toko' && (
                   <div className="relative border rounded-xl overflow-hidden shadow-inner">
                      <div ref={mapRef} className="h-40 w-full bg-gray-100" />
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] px-2 py-1 rounded-md uppercase font-bold tracking-widest">GESER MARKER JIKA INGIN CEK JARAK</div>
                   </div>
                )}
              </div>
            )}
            
            <div className={`p-3 rounded-xl border text-[10px] font-black uppercase flex items-center gap-2 tracking-wider ${validation.ok ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {validation.ok ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>} {validation.msg}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-xl sticky top-24 border border-gray-50">
            <h2 className="font-bold flex items-center mb-6 text-gray-700 text-xs tracking-widest uppercase"><CreditCard size={18} className="text-green-600 mr-2"/> Metode Bayar</h2>
            <div className="space-y-2 mb-6">
              {['cash', 'transfer', 'qris'].map(m => (
                <button key={m} onClick={()=>setPaymentMethod(m as any)} className={`w-full p-4 border rounded-2xl text-left transition-all ${paymentMethod === m ? 'border-green-600 bg-green-50 text-green-600 font-bold ring-1 ring-green-600' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}>
                  <span className="text-[10px] uppercase tracking-widest">{m === 'cash' ? '💵 Bayar di Tempat' : m === 'transfer' ? '🏦 Transfer Bank' : '📱 QRIS / E-Wallet'}</span>
                </button>
              ))}
            </div>

            {paymentMethod !== 'cash' && (
              <div className="mb-6 animate-in zoom-in-95 duration-200">
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-4 cursor-pointer relative overflow-hidden h-36 hover:border-green-400 transition-all bg-gray-50/50">
                  {proofPreview ? (
                    <>
                      <img src={proofPreview} className="w-full h-full object-contain" />
                      <div onClick={(e)=>{e.preventDefault(); setPaymentProof(null)}} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform"><X size={14}/></div>
                    </>
                  ) : (
                    <><Upload size={24} className="text-gray-300 mb-2"/><span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">KLIK UNTUK UPLOAD BUKTI</span></>
                  )}
                  <input type="file" hidden accept="image/*" onChange={e=>setPaymentProof(e.target.files?.[0] || null)} />
                </label>
                {/* TAMBAHAN INFO KOMPRESI */}
                <p className="text-[9px] text-center text-gray-400 mt-2 font-bold uppercase tracking-widest">Foto auto-compress ke 200KB</p>
              </div>
            )}

            <div className="flex justify-between items-end border-t pt-6">
              <span className="text-xs font-bold text-gray-400 tracking-tighter uppercase">Total Bayar</span>
              <span className="text-3xl font-black text-green-600">Rp{subtotal.toLocaleString()}</span>
            </div>

            <button onClick={handleCheckout} disabled={!validation.ok || isSubmitting} className="w-full bg-green-600 text-white py-5 rounded-2xl font-black mt-8 shadow-lg shadow-green-100 disabled:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2">
              {isSubmitting ? (
                 <>
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   <span className="text-xs">MENGOPTIMALKAN GAMBAR...</span>
                 </>
              ) : (
                 <><Send size={18} /><span>KONFIRMASI PESANAN</span></>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}