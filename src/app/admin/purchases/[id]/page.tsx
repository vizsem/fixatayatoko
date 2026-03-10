'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';


import {
  Printer, Truck, Calendar, CreditCard,
  Package, Store, CheckCircle2, Clock, AlertCircle,
  History, Receipt, Edit, Save, X, Trash2
} from 'lucide-react';

 

interface PurchaseItem { id: string; name: string; purchasePrice: number; quantity: number; unit: string; }
interface PurchaseData { id: string; supplierName: string; warehouseName: string; items: PurchaseItem[]; subtotal: number; shippingCost: number; total: number; status: string; paymentStatus: string; paymentMethod: string; notes?: string; dueDate?: string; createdAt?: Timestamp | { toDate: () => Date } | null; }




export default function PurchaseDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<PurchaseData | null>(null);
  const [editDate, setEditDate] = useState('');

  const handleEditClick = () => {
    if (!purchase) return;
    setEditForm(JSON.parse(JSON.stringify(purchase)));
    
    let date = new Date();
    // @ts-ignore
    if (purchase.createdAt?.toDate) date = purchase.createdAt.toDate();
    // @ts-ignore
    else if (purchase.createdAt?.seconds) date = new Date(purchase.createdAt.seconds * 1000);
    
    setEditDate(date.toISOString().slice(0, 16)); // datetime-local format
    setIsEditing(true);
  };

  const handleItemChange = (idx: number, field: keyof PurchaseItem, value: any) => {
    if (!editForm) return;
    const newItems = [...editForm.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setEditForm({ ...editForm, items: newItems });
  };

  const handleDeleteItem = (idx: number) => {
    if (!editForm) return;
    const newItems = editForm.items.filter((_, i) => i !== idx);
    setEditForm({ ...editForm, items: newItems });
  };

  const handleSave = async () => {
    if (!editForm || !purchase) return;
    
    try {
      // Recalculate totals
      const newSubtotal = editForm.items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.purchasePrice)), 0);
      const newTotal = newSubtotal + (Number(editForm.shippingCost) || 0);

      // Determine Payment Status
      let paymentStatus = 'LUNAS';
      if (editForm.paymentMethod === 'HUTANG') {
        paymentStatus = 'HUTANG'; // Or 'BELUM LUNAS' depending on your convention
      } else if (editForm.paymentMethod === 'TEMPO') {
        paymentStatus = 'TEMPO';
      }

      const updateData = {
        items: editForm.items.map(i => ({
          ...i,
          quantity: Number(i.quantity),
          purchasePrice: Number(i.purchasePrice)
        })),
        paymentMethod: editForm.paymentMethod,
        paymentStatus: paymentStatus, // Explicitly update status
        // Convert to Firestore Timestamp correctly
        createdAt: editDate ? Timestamp.fromDate(new Date(editDate)) : purchase.createdAt,
        subtotal: newSubtotal,
        total: newTotal
      };

      await updateDoc(doc(db, 'purchases', purchase.id), updateData);
      
      // Update local state with the same structure as Firestore returns
      // We need to ensure dateFormatted updates correctly too
      const updatedPurchase = { 
        ...purchase, 
        ...updateData,
        // Ensure items is correct
        // @ts-ignore
        items: updateData.items
      };
      
      setPurchase(updatedPurchase);
      
      setIsEditing(false);
      toast.success('Transaksi diperbarui!');
      
      // Force a small delay to ensure React state updates are perceived visually or just to be safe
      setTimeout(() => {
         // Optional: Reload data from server to be 100% sure
         // router.refresh(); // This might be too heavy, local state update should be enough if correct
      }, 100);

    } catch (error) {
      console.error(error);
      toast.error('Gagal menyimpan perubahan');
    }
  };

  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        const docRef = doc(db, 'purchases', id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setPurchase({ id: snap.id, ...snap.data() } as PurchaseData);
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
  }, [id, router]);


  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs">Loading Order Details...</div>;
  if (!purchase) return null;

  const dateFormatted = purchase.createdAt?.toDate
    ? purchase.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A';

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen pb-32 font-sans text-black">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <Toaster position="top-right" />
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
            <Receipt size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Detail Pembelian</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction ID: #{purchase.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEditClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all"
          >
            <Edit size={16} /> Edit
          </button>
          <button
            onClick={() => window.print()}
            className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <Printer size={16} /> Cetak
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
            <div className="md:hidden space-y-3 px-4 pb-4">
              {purchase.items?.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight line-clamp-2">{item.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1">Product ID: {item.id.slice(0, 8)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subtotal</p>
                      <p className="text-sm font-black text-gray-900">
                        Rp {(item.quantity * item.purchasePrice).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Qty</p>
                      <p className="text-sm font-black text-gray-900">{item.quantity} {item.unit}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Unit Price</p>
                      <p className="text-sm font-black text-gray-900">Rp {item.purchasePrice.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
              <table className="w-full text-left min-w-[680px] md:min-w-0">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase">Product Name</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-center">Qty</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase">Unit Price</th>
                    <th className="px-3 md:px-8 py-3 md:py-4 text-[9px] font-black text-gray-400 uppercase text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {purchase.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-all">
                      <td className="px-3 md:px-8 py-3 md:py-5">
                        <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{item.name}</span>
                        <p className="text-[8px] text-gray-400 font-bold uppercase mt-0.5">Product ID: {item.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-5 text-center">
                        <span className="text-xs font-black text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-3 md:py-5 text-xs font-bold text-gray-600">
                        Rp {item.purchasePrice.toLocaleString()}
                      </td>
                      <td className="px-3 md:px-8 py-3 md:py-5 text-right text-xs font-black text-gray-800">
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

      {/* EDIT MODAL */}
      {isEditing && editForm && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-gray-800">
                <Edit size={20} className="text-blue-600" /> Edit Transaksi
              </h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Tanggal Transaksi</label>
                  <input 
                    type="datetime-local" 
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 border-transparent border transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Metode Pembayaran</label>
                  <select 
                    value={editForm.paymentMethod}
                    onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                    className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase border-transparent border transition-all appearance-none"
                  >
                    <option value="CASH">CASH</option>
                    <option value="TRANSFER">TRANSFER</option>
                    <option value="HUTANG">HUTANG</option>
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black uppercase text-gray-400 block tracking-widest">Item Produk ({editForm.items.length})</label>
                </div>
                
                <div className="space-y-3">
                  {editForm.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black uppercase truncate text-gray-800">{item.name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 bg-white inline-block px-2 py-0.5 rounded">{item.unit}</p>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="w-24">
                          <label className="text-[8px] font-bold uppercase text-gray-400 block mb-1">Qty</label>
                          <input 
                            type="number" 
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full p-2 bg-white rounded-xl text-sm font-black text-center border border-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                        <div className="w-36">
                          <label className="text-[8px] font-bold uppercase text-gray-400 block mb-1">Harga Beli</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">Rp</span>
                            <input 
                              type="number" 
                              value={item.purchasePrice}
                              onChange={(e) => handleItemChange(idx, 'purchasePrice', e.target.value)}
                              className="w-full pl-8 p-2 bg-white rounded-xl text-sm font-black text-right border border-gray-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                          </div>
                        </div>
                        <div className="w-10 pt-4 flex justify-end">
                          <button 
                            onClick={() => handleDeleteItem(idx)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Hapus Item"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {editForm.items.length === 0 && (
                    <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                      <p className="text-xs font-bold text-gray-400 uppercase">Tidak ada item</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Summary */}
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-600 uppercase">Estimasi Total Baru</span>
                  <span className="text-xl font-black text-blue-800">
                    Rp {(
                      editForm.items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.purchasePrice)), 0) + 
                      (Number(editForm.shippingCost) || 0)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 rounded-xl font-bold text-xs uppercase text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="px-8 py-3 rounded-xl font-black text-xs uppercase bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <span className="animate-spin">⏳</span> : <Save size={16} />}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
