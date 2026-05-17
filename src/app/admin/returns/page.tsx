'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { RefreshCcw, CheckCircle, XCircle } from 'lucide-react';
import { addStockTx, deductStockTx } from '@/lib/inventory';
import { postJournal } from '@/lib/ledger';
import notify from '@/lib/notify';
import { Search, Plus, Trash2 } from 'lucide-react';
import { Product } from '@/lib/types';
import { getDocs, addDoc } from 'firebase/firestore';
import Link from 'next/link';

type ReturnReq = {
  id: string;
  type: 'SALES_RETURN' | 'PURCHASE_RETURN';
  refId: string; // Order ID or Purchase ID
  customerOrSupplierName: string;
  items: { productId: string; productName: string; quantity: number; price: number }[];
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  totalValue: number;
  createdAt: any;
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchProduct, setSearchProduct] = useState('');

  // Form State
  const [newReturn, setNewReturn] = useState<Partial<ReturnReq>>({
    type: 'SALES_RETURN',
    refId: '',
    customerOrSupplierName: '',
    items: [],
    reason: '',
    status: 'PENDING',
    totalValue: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'returns'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReturns(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReturnReq)));
      setLoading(false);
    });

    const fetchProducts = async () => {
      const pSnap = await getDocs(collection(db, 'products'));
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    };
    fetchProducts();

    return unsub;
  }, []);

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchProduct.toLowerCase())
  ).slice(0, 5);

  const addItem = (p: Product) => {
    const existing = newReturn.items?.find(i => i.productId === p.id);
    if (existing) return;
    
    const newItem = { productId: p.id, productName: p.name, quantity: 1, price: p.price || 0 };
    setNewReturn({
      ...newReturn,
      items: [...(newReturn.items || []), newItem],
      totalValue: (newReturn.totalValue || 0) + newItem.price
    });
    setSearchProduct('');
  };

  const removeItem = (productId: string) => {
    const updatedItems = (newReturn.items || []).filter(i => i.productId !== productId);
    const newVal = updatedItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    setNewReturn({ ...newReturn, items: updatedItems, totalValue: newVal });
  };

  const handleSaveReturn = async () => {
    if (!newReturn.refId || !newReturn.customerOrSupplierName || (newReturn.items || []).length === 0) {
      return notify.error("Lengkapi data retur");
    }

    try {
      await addDoc(collection(db, 'returns'), {
        ...newReturn,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      notify.admin.success("Request retur berhasil dibuat");
      setIsModalOpen(false);
      setNewReturn({ type: 'SALES_RETURN', refId: '', customerOrSupplierName: '', items: [], reason: '', status: 'PENDING', totalValue: 0 });
    } catch (e) {
      notify.admin.error("Gagal membuat retur");
    }
  };

  const handleProcess = async (ret: ReturnReq, action: 'APPROVE' | 'REJECT') => {
    if (!confirm(`Yakin ingin ${action === 'APPROVE' ? 'menyetujui' : 'menolak'} retur ini?`)) return;

    try {
      if (action === 'REJECT') {
        await updateDoc(doc(db, 'returns', ret.id), { status: 'REJECTED', updatedAt: serverTimestamp() });
        notify.admin.success('Retur ditolak');
        return;
      }

      // APPROVE Logic
      await runTransaction(db, async (tx) => {
        const retRef = doc(db, 'returns', ret.id);
        const retSnap = await tx.get(retRef);
        if (!retSnap.exists() || retSnap.data().status !== 'PENDING') {
          throw new Error('Retur sudah diproses atau tidak ditemukan.');
        }

        if (ret.type === 'SALES_RETURN') {
          // Sales Return: Barang kembali ke gudang (addStock)
          for (const item of ret.items) {
            await addStockTx(tx, {
              productId: item.productId,
              amount: item.quantity,
              warehouseId: 'gudang-utama',
              adminId: auth.currentUser?.uid || 'system',
              note: `Retur Penjualan #${ret.refId}`,
              source: 'MANUAL' // Adjust if needed
            });
          }
          // Ledger: Debit Sales Return (or Sales), Credit CustomerWallet/Cash
          await postJournal({
            debitAccount: 'Sales', // Idealnya Sales Return account
            creditAccount: 'CustomerWallet', // Asumsi refund masuk ke dompet
            amount: ret.totalValue,
            memo: `Refund Retur Penjualan #${ret.refId}`,
            refType: 'RETURN',
            refId: ret.id
          }, tx);

        } else if (ret.type === 'PURCHASE_RETURN') {
          // Purchase Return: Barang keluar dari gudang (deductStock)
          for (const item of ret.items) {
            await deductStockTx(tx, {
              productId: item.productId,
              amount: item.quantity,
              mainWarehouseId: 'gudang-utama',
              adminId: auth.currentUser?.uid || 'system',
              note: `Retur Pembelian #${ret.refId}`,
              source: 'MANUAL'
            });
          }
          // Ledger: Debit Cash/AccountsPayable, Credit Inventory
          await postJournal({
            debitAccount: 'Cash', // Asumsi uang dikembalikan tunai
            creditAccount: 'Inventory',
            amount: ret.totalValue,
            memo: `Refund Retur Pembelian #${ret.refId}`,
            refType: 'RETURN',
            refId: ret.id
          }, tx);
        }

        tx.update(retRef, { status: 'APPROVED', updatedAt: serverTimestamp() });
      });

      notify.admin.success('Retur disetujui dan stok disesuaikan.');
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err.message || 'Gagal memproses retur.');
    }
  };

  if (loading) return <div className="p-8 text-center">Memuat...</div>;

  return (
    <div className="p-3 md:p-4 min-h-screen bg-gray-50 text-slate-800">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <RefreshCcw size={22} className="text-purple-600" /> Manajemen Retur
            </h1>
            <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">Kelola pengembalian barang dari Penjualan dan ke Pembelian.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all"
          >
            <Plus size={16} /> Buat Retur Manual
          </button>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Buat Permintaan Retur</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Input manual barang kembali</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all"><XCircle size={24} className="text-slate-300" /></button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipe Retur</label>
                    <select 
                      value={newReturn.type}
                      onChange={e => setNewReturn({...newReturn, type: e.target.value as any})}
                      className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-purple-500 transition-all"
                    >
                      <option value="SALES_RETURN">RETUR PENJUALAN (Dari Customer)</option>
                      <option value="PURCHASE_RETURN">RETUR PEMBELIAN (Ke Supplier)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">No. Referensi (ID Order/Beli)</label>
                    <input 
                      type="text"
                      placeholder="Contoh: ORD-123..."
                      value={newReturn.refId}
                      onChange={e => setNewReturn({...newReturn, refId: e.target.value})}
                      className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nama Customer / Supplier</label>
                  <input 
                    type="text"
                    placeholder="Nama lengkap..."
                    value={newReturn.customerOrSupplierName}
                    onChange={e => setNewReturn({...newReturn, customerOrSupplierName: e.target.value})}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pilih Produk</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text"
                      placeholder="Cari nama produk..."
                      value={searchProduct}
                      onChange={e => setSearchProduct(e.target.value)}
                      className="w-full bg-slate-50 p-4 pl-12 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-purple-500 transition-all"
                    />
                    {searchProduct && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-10 overflow-hidden divide-y divide-slate-50">
                        {filteredProducts.map(p => (
                          <button 
                            key={p.id}
                            onClick={() => addItem(p)}
                            className="w-full p-4 text-left hover:bg-slate-50 transition-all flex justify-between items-center"
                          >
                            <span className="text-xs font-black text-slate-800 uppercase">{p.name}</span>
                            <span className="text-[10px] font-bold text-slate-400">Rp {p.price?.toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-100/50">
                        <tr>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase">Produk</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase text-center w-20">Qty</th>
                          <th className="px-4 py-3 font-black text-slate-400 uppercase text-right">Subtotal</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(newReturn.items || []).map((item, idx) => (
                          <tr key={idx} className="bg-white/50">
                            <td className="px-4 py-3 font-black text-slate-700 uppercase">{item.productName}</td>
                            <td className="px-4 py-3">
                              <input 
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={e => {
                                  const qty = Math.max(1, Number(e.target.value));
                                  const updated = (newReturn.items || []).map((it, i) => i === idx ? {...it, quantity: qty} : it);
                                  const newVal = updated.reduce((acc, i) => acc + (i.price * i.quantity), 0);
                                  setNewReturn({...newReturn, items: updated, totalValue: newVal});
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-black text-center outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-black text-slate-900">Rp {(item.price * item.quantity).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => removeItem(item.productId)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Alasan Retur</label>
                  <textarea 
                    placeholder="Contoh: Barang cacat produksi / Salah kirim..."
                    value={newReturn.reason}
                    onChange={e => setNewReturn({...newReturn, reason: e.target.value})}
                    className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-purple-500 transition-all h-20 resize-none"
                  />
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Nilai Retur</p>
                  <p className="text-xl font-black text-slate-900">Rp {newReturn.totalValue?.toLocaleString()}</p>
                </div>
                <button 
                  onClick={handleSaveReturn}
                  className="bg-purple-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-100 hover:bg-purple-700 active:scale-95 transition-all"
                >
                  Simpan Request
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Tanggal</th>
                <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Tipe / Ref</th>
                <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Pihak</th>
                <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Alasan</th>
                <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Total (Rp)</th>
                <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {returns.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Tidak ada data retur.</td></tr>
              ) : returns.map(ret => (
                <tr key={ret.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-[10px] font-bold text-slate-600">{ret.createdAt ? new Date(ret.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg ${ret.type === 'SALES_RETURN' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {ret.type === 'SALES_RETURN' ? 'RETUR JUAL' : 'RETUR BELI'}
                    </span>
                    <Link href={`/admin/orders/${ret.refId}`} className="mt-0.5 text-[10px] font-mono font-bold text-blue-600 block hover:underline">
                      #{ret.refId.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[11px] font-black text-slate-800">{ret.customerOrSupplierName}</td>
                  <td className="px-3 py-2 text-[10px] font-medium text-slate-600 max-w-xs">{ret.reason}</td>
                  <td className="px-3 py-2 text-[11px] font-black text-slate-900">Rp {ret.totalValue.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg ${
                      ret.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      ret.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {ret.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {ret.status === 'PENDING' && (
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => handleProcess(ret, 'APPROVE')} className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"><CheckCircle size={14} /></button>
                        <button onClick={() => handleProcess(ret, 'REJECT')} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><XCircle size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
