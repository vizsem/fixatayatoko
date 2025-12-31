'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Package, Truck, Store, MapPin, CreditCard, Upload, User, Printer, Send, Bike, Box, Info, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';

const TOKO_LAT = -7.8014;
const TOKO_LNG = 111.8139;

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Data Pembeli
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  
  // State Pengiriman & Pembayaran (Default sudah diisi agar tidak kosong)
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('delivery');
  const [courierType, setCourierType] = useState<'toko' | 'ojol' | 'ekspedisi'>('toko');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'qris'>('cash');
  
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);

  // Load Data awal
  useEffect(() => {
    const saved = localStorage.getItem('atayatoko-cart');
    if (saved) setCart(JSON.parse(saved));
    setCustomerName(localStorage.getItem('atayatoko-customer-name') || '');
    setCustomerPhone(localStorage.getItem('atayatoko-customer-phone') || '');
    setIsLoaded(true);
  }, []);

  // Inisialisasi Google Maps
  useEffect(() => {
    if (deliveryMethod === 'delivery' && courierType === 'toko' && isLoaded) {
      const initMap = () => {
        // PERBAIKAN: Cast window ke any untuk menghindari error TypeScript build
        const googleObj = (window as any).google;
        
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

      // PERBAIKAN: Cast window ke any di sini juga
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

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const subtotal = cart.reduce((t, i) => t + (i.price * i.quantity), 0);
  const isGrosir = subtotal >= 500000;

  const getStatus = () => {
    if (deliveryMethod === 'pickup') return { ok: true, msg: "Ambil Sendiri ke Toko Ataya" };
    if (courierType === 'toko') {
      if (!distance) return { ok: false, msg: "Geser marker peta ke lokasi Anda" };
      if (isGrosir) return distance <= 10 ? { ok: true, msg: "Lokasi Grosir Terjangkau (Max 10km)" } : { ok: false, msg: "Jarak Grosir maksimal 10km" };
      if (subtotal < 100000) return { ok: false, msg: "Minimal belanja 100rb untuk kurir toko" };
      return distance <= 3 ? { ok: true, msg: "Lokasi Ecer Terjangkau (Max 3km)" } : { ok: false, msg: "Jarak Ecer maksimal 3km" };
    }
    return { ok: true, msg: `Siap dikirim melalui ${courierType.toUpperCase()}` };
  };

  const status = getStatus();

  const handleCheckout = async () => {
    if (!customerName || !customerPhone) return alert("Isi Nama & No WA!");
    setIsSubmitting(true);
    try {
      let url = "";
      if (paymentProof) {
        const refFile = ref(storage, `bukti/${Date.now()}`);
        await uploadBytes(refFile, paymentProof);
        url = await getDownloadURL(refFile);
      }

      const listProduk = cart.map((i, index) => `${index+1}. ${i.name} (${i.quantity}x) = Rp${(i.price*i.quantity).toLocaleString()}`).join('\n');
      const textWA = `*PESANAN BARU - ATAYATOKO*\n\n*Nama:* ${customerName}\n*WA:* ${customerPhone}\n*Metode:* ${deliveryMethod} (${courierType})\n*Pembayaran:* ${paymentMethod.toUpperCase()}\n\n*DAFTAR PRODUK:*\n${listProduk}\n\n*TOTAL: Rp${subtotal.toLocaleString()}*\n\nAlamat: ${customerAddress}`;

      await addDoc(collection(db, 'orders'), { 
        customerName, items: cart, total: subtotal, status: 'BARU', createdAt: serverTimestamp() 
      });

      window.open(`https://wa.me/6285853161174?text=${encodeURIComponent(textWA)}`, '_blank');
      localStorage.removeItem('atayatoko-cart');
      router.push('/success');
    } catch (e) { alert("Error simpan data"); } finally { setIsSubmitting(false); }
  };

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-gray-50 text-black pb-20">
      <header className="bg-white p-4 shadow-sm flex items-center gap-4 sticky top-0 z-50 font-bold text-green-600">
        <button onClick={() => router.back()} className="text-black"><ChevronLeft /></button>
        KERANJANG SAYA
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* SECTION 1: PRODUK */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-bold flex items-center gap-2 mb-4 text-sm uppercase tracking-wider"><Package size={18}/> Produk</h2>
          {cart.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center py-3 border-b last:border-0">
              <div className="text-sm">
                <p className="font-bold">{item.name}</p>
                <p className="text-green-600 text-xs font-bold">Rp{item.price.toLocaleString()}</p>
              </div>
              <p className="text-xs font-black bg-gray-100 px-3 py-1 rounded-full">{item.quantity} {item.unit}</p>
            </div>
          ))}
        </div>

        {/* SECTION 2: PENGIRIMAN (3 PILIHAN KURIR) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider"><Truck size={18}/> Pengiriman</h2>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Nama Anda" value={customerName} onChange={e=>setCustomerName(e.target.value)} className="p-3 bg-gray-50 border rounded-xl w-full" />
            <input placeholder="No WhatsApp" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} className="p-3 bg-gray-50 border rounded-xl w-full" />
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setDeliveryMethod('pickup')} className={`flex-1 py-3 rounded-lg text-xs font-black ${deliveryMethod === 'pickup' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>AMBIL SENDIRI</button>
            <button onClick={() => setDeliveryMethod('delivery')} className={`flex-1 py-3 rounded-lg text-xs font-black ${deliveryMethod === 'delivery' ? 'bg-white shadow text-green-600' : 'text-gray-400'}`}>DIANTAR KURIR</button>
          </div>

          {deliveryMethod === 'delivery' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={()=>setCourierType('toko')} className={`p-3 border rounded-xl flex flex-col items-center gap-1 ${courierType === 'toko' ? 'border-green-600 bg-green-50 text-green-600' : 'text-gray-400'}`}><Truck size={20}/><span className="text-[10px] font-bold">Kurir Toko</span></button>
                <button onClick={()=>setCourierType('ojol')} className={`p-3 border rounded-xl flex flex-col items-center gap-1 ${courierType === 'ojol' ? 'border-green-600 bg-green-50 text-green-600' : 'text-gray-400'}`}><Bike size={20}/><span className="text-[10px] font-bold">Ojol</span></button>
                <button onClick={()=>setCourierType('ekspedisi')} className={`p-3 border rounded-xl flex flex-col items-center gap-1 ${courierType === 'ekspedisi' ? 'border-green-600 bg-green-50 text-green-600' : 'text-gray-400'}`}><Box size={20}/><span className="text-[10px] font-bold">Ekspedisi</span></button>
              </div>
              <textarea placeholder="Alamat lengkap & patokan..." value={customerAddress} onChange={e=>setCustomerAddress(e.target.value)} className="w-full p-3 bg-gray-50 border rounded-xl h-20 text-sm" />
              {courierType === 'toko' && <div ref={mapRef} className="h-48 bg-gray-200 rounded-xl overflow-hidden" />}
            </div>
          )}

          <div className={`p-3 rounded-xl border flex items-center gap-2 ${status.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {status.ok ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
            <span className="text-[10px] font-bold uppercase">{status.msg}</span>
          </div>
        </div>

        {/* SECTION 3: PEMBAYARAN (COD, TRANSFER, QRIS) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider"><CreditCard size={18}/> Pembayaran</h2>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={()=>setPaymentMethod('cash')} className={`p-3 border rounded-xl text-[10px] font-black ${paymentMethod === 'cash' ? 'border-green-600 bg-green-50 text-green-600' : 'text-gray-400'}`}>COD / TUNAI</button>
            <button onClick={()=>setPaymentMethod('transfer')} className={`p-3 border rounded-xl text-[10px] font-black ${paymentMethod === 'transfer' ? 'border-green-600 bg-green-50 text-green-600' : 'text-gray-400'}`}>TRANSFER</button>
            <button onClick={()=>setPaymentMethod('qris')} className={`p-3 border rounded-xl text-[10px] font-black ${paymentMethod === 'qris' ? 'border-green-600 bg-green-50 text-green-600' : 'text-gray-400'}`}>QRIS</button>
          </div>

          {paymentMethod !== 'cash' && (
            <div className="border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-gray-400">
              <Upload size={24} />
              <p className="text-[10px] font-bold uppercase">Upload Bukti Bayar</p>
              <input type="file" onChange={e=>setPaymentProof(e.target.files?.[0] || null)} className="text-[10px] w-full" />
            </div>
          )}
        </div>

        {/* SECTION 4: TOTAL & ORDER */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-100">
          <div className="flex justify-between items-center mb-6">
            <span className="font-bold text-gray-400 uppercase text-xs">Total Belanja</span>
            <span className="text-2xl font-black text-green-600">Rp{subtotal.toLocaleString()}</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={!status.ok || isSubmitting}
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-green-200 disabled:bg-gray-200"
          >
            {isSubmitting ? "SEDANG MEMPROSES..." : "PESAN SEKARANG VIA WA"}
          </button>
        </div>
      </main>
    </div>
  );
}