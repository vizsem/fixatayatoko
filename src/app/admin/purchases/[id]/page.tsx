'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ChevronLeft, Printer, Truck, Calendar, CreditCard, 
  Package, Store, CheckCircle2, Clock, XCircle, AlertCircle,
  Download, History, Receipt
} from 'lucide-react';
import Link from 'next/link';

export default function PurchaseDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        const docRef = doc(db, 'purchases', id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setPurchase({ id: snap.id, ...snap.data() });
        } else {
          router.push('/admin/purchases');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchase();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs">Loading Order Details...</div>;
  if (!purchase) return null;

  const dateFormatted = purchase.createdAt?.toDate 
    ? purchase.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A';

  return (
    <div className="p-4 lg:p-10 bg-[#FBFBFE] min-h-screen pb-32 font-sans">
      
      {/* Top Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/purchases" className="p-4 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
              Order Details
            </h1>
            <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1 italic">
              Transaction ID: #{purchase.id}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => window.print()} className="flex-1 md:flex-none bg-white border border-gray-200 text-gray-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all">
            <Printer size={18} /> Print Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: PRODUCT LIST */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                    <Package size={14} /> Itemized List
                </h3>
                <span className="text-[10px] font-black uppercase px-3 py-1 bg-blue-50 text-blue-600 rounded-lg">
                    {purchase.items?.length || 0} Items
                </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-8 py-4 text-[9px] font-black text-gray-400 uppercase">Product Name</th>
                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase text-center">Qty</th>
                    <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase">Unit Price</th>
                    <th className="px-8 py-4 text-[9px] font-black text-gray-400 uppercase text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {purchase.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-all">
                      <td className="px-8 py-5">
                        <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{item.name}</span>
                        <p className="text-[8px] text-gray-400 font-bold uppercase mt-0.5">Product ID: {item.id.slice(0,8)}</p>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-black text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">
                            {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-xs font-bold text-gray-600">
                        Rp {item.purchasePrice.toLocaleString()}
                      </td>
                      <td className="px-8 py-5 text-right text-xs font-black text-gray-800">
                        Rp {(item.quantity * item.purchasePrice).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Calculation */}
            <div className="p-8 bg-gray-50/30 space-y-3 border-t border-gray-100">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Total Items Cost</span>
                <span>Rp {purchase.subtotal?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase">
                <span>Shipping & Handling</span>
                <span>Rp {purchase.shippingCost?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-sm font-black uppercase tracking-tighter text-gray-800">Total Amount</span>
                <span className="text-xl font-black text-green-600">Rp {purchase.total?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {purchase.notes && (
            <div className="bg-white p-8 rounded-[2rem] border border-gray-100 flex gap-4 items-start">
                <AlertCircle size={20} className="text-gray-300" />
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Order Notes</h4>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">{purchase.notes}</p>
                </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: INFO & STATUS */}
        <div className="space-y-6">
          
          {/* Status Card */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                <History size={14} /> Transaction Status
            </h3>
            
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${purchase.status === 'DITERIMA' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                        {purchase.status === 'DITERIMA' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Order Status</p>
                        <p className="text-sm font-black text-gray-800 uppercase">{purchase.status}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${purchase.paymentStatus === 'LUNAS' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Payment ({purchase.paymentMethod})</p>
                        <p className="text-sm font-black text-gray-800 uppercase">{purchase.paymentStatus}</p>
                    </div>
                </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <Receipt className="absolute -right-4 -top-4 opacity-10" size={120} />
            <div className="relative z-10 space-y-6">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
                        <Store size={14} /> Supplier & Delivery
                    </h3>
                    <p className="text-lg font-black uppercase leading-tight">{purchase.supplierName}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest italic">{dateFormatted}</p>
                </div>

                <div className="pt-6 border-t border-white/10">
                    <div className="flex items-start gap-3">
                        <Truck size={18} className="text-blue-400" />
                        <div>
                            <p className="text-[9px] font-black text-gray-500 uppercase">Target Warehouse</p>
                            <p className="text-xs font-bold uppercase">{purchase.warehouseName}</p>
                        </div>
                    </div>
                </div>

                {purchase.dueDate && purchase.paymentStatus === 'HUTANG' && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                    <Calendar size={18} className="text-red-500" />
                    <div>
                        <p className="text-[8px] font-black text-red-300 uppercase">Hutang Jatuh Tempo</p>
                        <p className="text-[10px] font-black text-red-500 uppercase">{purchase.dueDate}</p>
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Log Info */}
          <div className="px-8 py-2">
             <p className="text-[8px] font-bold text-gray-400 uppercase text-center tracking-[0.3em]">
                Verified by System on {dateFormatted}
             </p>
          </div>

        </div>
      </div>
    </div>
  );
}