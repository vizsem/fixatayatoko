'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  AlertTriangle, Package, Clock, CreditCard, ChevronLeft, 
  MapPin, Phone, User, Calendar, Truck, CheckCircle2, 
  Zap, Ticket, Printer, MessageCircle
} from 'lucide-react';
import Link from 'next/link';

export default function DetailTransaksiPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'orders', id));
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('Data pesanan tidak ditemukan di sistem kami.');
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Gagal menghubungkan ke server.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-green-600 border-opacity-20 border-t-green-600 mx-auto"></div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Menyusun Struk...</p>
      </div>
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl text-center max-w-sm border border-slate-100">
        <AlertTriangle className="h-16 w-16 text-rose-500 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-slate-900 uppercase italic">Terjadi Kendala</h2>
        <p className="text-xs font-bold text-slate-400 mt-2 mb-8 uppercase leading-relaxed">{error}</p>
        <button onClick={() => router.back()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Kembali</button>
      </div>
    </div>
  );

  const getStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'SELESAI': return 'bg-emerald-500 text-white';
      case 'DIKIRIM': return 'bg-blue-500 text-white';
      case 'DIPROSES': return 'bg-amber-500 text-white';
      default: return 'bg-rose-500 text-white';
    }
  };

  const formattedDate = order.createdAt?.toDate 
    ? order.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '-';

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <div className="max-w-2xl mx-auto px-4 pt-8">
        
        {/* TOP ACTION */}
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-green-600 transition-all">
            <ChevronLeft size={18} /> Kembali
          </button>
          <div className="flex gap-2">
             <button onClick={() => window.print()} className="p-3 bg-white rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100"><Printer size={18}/></button>
          </div>
        </div>

        {/* MAIN RECEIPT CARD */}
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-white overflow-hidden print:shadow-none print:border-none">
          
          {/* RECEIPT HEADER */}
          <div className="p-10 text-center border-b border-dashed border-slate-100 relative">
            <div className={`absolute top-0 right-10 px-6 py-2 rounded-b-2xl text-[10px] font-black uppercase tracking-widest ${getStatusStyle(order.status)}`}>
              {order.status || 'PENDING'}
            </div>
            <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic">
              {order.orderId || `INV-${order.id.slice(0,8).toUpperCase()}`}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.2em]">{formattedDate} WIB</p>
          </div>

          {/* CUSTOMER & SHIPPING INFO */}
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/50">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm"><User size={16}/></div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Penerima</p>
                  <p className="text-xs font-black text-slate-900 uppercase italic">{order.name || order.customerName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm"><Phone size={16}/></div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Kontak</p>
                  <p className="text-xs font-black text-slate-900">{order.phone || order.customerPhone || '-'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white rounded-xl text-slate-400 shadow-sm"><MapPin size={16}/></div>
                <div className="flex-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Alamat Pengiriman</p>
                  <p className="text-xs font-bold text-slate-600 uppercase leading-relaxed">
                    {order.delivery?.address || order.customerAddress || 'Ambil di Toko'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ITEM LIST */}
          <div className="p-10">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Package size={16} className="text-green-600" /> Rincian Belanja
            </h3>
            <div className="space-y-6">
              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center group">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-[10px] font-black text-slate-400 uppercase italic">
                      {item.quantity}x
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase italic group-hover:text-green-600 transition-colors">{item.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-tight">Rp{item.price.toLocaleString()} / {item.unit || 'Pcs'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900 italic tracking-tighter">Rp{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CALCULATION & LOYALTY */}
          <div className="p-10 border-t border-dashed border-slate-100 space-y-3">
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Subtotal</span>
              <span className="text-slate-900">Rp{(order.subtotal || 0).toLocaleString()}</span>
            </div>
            
            {order.shippingCost > 0 && (
              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Ongkos Kirim</span>
                <span className="text-slate-900">Rp{order.shippingCost.toLocaleString()}</span>
              </div>
            )}

            {/* Loyalty & Vouchers Detail */}
            {(order.pointsUsed > 0) && (
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-2 text-blue-600">
                   <Zap size={14} fill="currentColor"/>
                   <span className="text-[9px] font-black uppercase italic tracking-widest">Potongan Poin</span>
                </div>
                <span className="text-xs font-black text-blue-600 italic">-Rp{order.pointsUsed.toLocaleString()}</span>
              </div>
            )}

            {order.appliedVoucher && (
              <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-600">
                   <Ticket size={14} fill="currentColor"/>
                   <span className="text-[9px] font-black uppercase italic tracking-widest">Voucher: {order.appliedVoucher.name}</span>
                </div>
                <span className="text-xs font-black text-emerald-600 italic">-Rp{(order.voucherDiscount || 0).toLocaleString()}</span>
              </div>
            )}

            {/* GRAND TOTAL */}
            <div className="pt-6 mt-4 border-t-2 border-slate-900 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1">Total Pembayaran</p>
                <div className="flex items-center gap-2">
                   <CreditCard size={16} className="text-green-600" />
                   <span className="text-xs font-black text-slate-800 uppercase italic">{order.payment?.method || 'CASH'}</span>
                </div>
              </div>
              <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter">Rp{order.total?.toLocaleString()}</h2>
            </div>
          </div>

          {/* FOOTER MESSAGE */}
          <div className="p-10 bg-slate-900 text-white text-center">
             <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 opacity-50">ATAYAMARKET • Hemat Terpercaya</p>
             <Link 
              href={`https://wa.me/6285790565666?text=Halo Admin, Saya ingin bertanya tentang pesanan ${order.orderId || order.id}`}
              className="inline-flex items-center gap-2 bg-green-600 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-green-500 transition-all active:scale-95"
             >
              <MessageCircle size={16} /> Hubungi Admin
             </Link>
          </div>
        </div>

        <div className="mt-10 text-center">
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Simpan struk digital ini sebagai bukti transaksi yang sah</p>
        </div>
      </div>
    </div>
  );
}