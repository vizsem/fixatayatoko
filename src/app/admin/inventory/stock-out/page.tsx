'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { deductStockTx } from '@/lib/inventory';
import { postJournal } from '@/lib/ledger';
import {
  collection, getDocs, doc, serverTimestamp, runTransaction, getDoc
} from 'firebase/firestore';
import { ArrowLeft, ArrowUpCircle, Search, AlertCircle, CheckCircle2, Package, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import * as Sentry from '@sentry/nextjs';
import { Product } from '@/lib/types';

export default function StockOutPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState('Barang Rusak');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
    });
    return () => unsubAuth();
  }, [router]);

  const fetchProducts = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat produk");
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || qty <= 0) return;
    if (qty > selectedProduct.stock) return notify.admin.error('Stok tidak mencukupi!');

    setLoading(true);
    const t = notify.admin.loading("Memproses pengeluaran stok...");
    try {
      await runTransaction(db, async (tx) => {
        const pRef = doc(db, 'products', selectedProduct.id);
        const pSnap = await tx.get(pRef);
        const costPrice = Number(pSnap.data()?.Modal || pSnap.data()?.purchasePrice || 0);
        const lossValue = costPrice * qty;

        await deductStockTx(tx, {
          productId: selectedProduct.id,
          amount: qty,
          adminId: auth.currentUser?.uid || 'system',
          source: 'MANUAL',
          note: `Manual Out: ${reason}`,
          mainWarehouseId: 'gudang-utama'
        });

        if (lossValue > 0) {
          await postJournal({
            debitAccount: 'LossOnInventory',
            creditAccount: 'Inventory',
            amount: lossValue,
            memo: `Inventory Loss: ${reason} (${qty} units)`,
            refType: 'STOCK_OUT',
            refId: selectedProduct.id
          }, tx);
        }
      });

      notify.admin.success('Stok berhasil dikurangi!', { id: t });
      setQty(0);
      setSelectedProduct(null);
      setSearchTerm('');
      fetchProducts();
    } catch (err) {
      Sentry.captureException(err);
      notify.admin.error('Terjadi kesalahan sistem.', { id: t });
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <Toaster position="top-right" />
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-10">
          <Link href="/admin/inventory" className="p-3 bg-white rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 transition-all shadow-sm">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <ArrowUpCircle className="text-rose-600" /> Stock Outflow
            </h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Manual inventory deduction</p>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-slate-100 relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Product SKU</label>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="text" placeholder="Type product name..." className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                {searchTerm && !selectedProduct && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden max-h-60 overflow-y-auto py-2">
                    {filtered.map(p => (
                      <button key={p.id} type="button" onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); }} className="w-full text-left px-6 py-4 hover:bg-slate-50 flex justify-between items-center transition-colors">
                        <span className="text-xs font-black text-slate-800 uppercase">{p.name}</span>
                        <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-full uppercase">Stock: {p.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="p-6 bg-rose-50/50 border border-rose-100 rounded-[2rem] flex items-center justify-between animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-rose-600"><Package size={20} /></div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedProduct.name}</p>
                      <p className="text-[10px] font-black text-rose-500 uppercase mt-1 tracking-widest">Available: {selectedProduct.stock} {selectedProduct.unit}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedProduct(null)} className="p-2 text-slate-400 hover:text-rose-600 transition-all"><X size={18} /></button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                <input type="number" required placeholder="0" className="w-full px-6 py-5 bg-slate-50 border-none rounded-2xl text-2xl font-black text-center outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={qty} onChange={e => setQty(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason / Category</label>
                <select className="w-full px-6 py-5 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-50 transition-all appearance-none h-[68px]" value={reason} onChange={e => setReason(e.target.value)}>
                  <option value="Barang Rusak">Damaged Goods</option>
                  <option value="Kadaluarsa">Expired</option>
                  <option value="Hilang / Selisih">Missing / Difference</option>
                  <option value="Retur ke Supplier">Return to Supplier</option>
                  <option value="Dipakai Keperluan Toko">Store Usage</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading || !selectedProduct} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 group">
              {loading ? 'Processing...' : <><ArrowUpCircle size={16}/> Execute Outflow <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform"/></>}
            </button>
          </form>

          <div className="absolute -bottom-20 -right-20 text-slate-50 opacity-20 pointer-events-none rotate-12">
             <ArrowUpCircle size={300} />
          </div>
        </div>
      </div>
    </div>
  );
}
