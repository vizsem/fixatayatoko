'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '@/lib/firebase';
import { transferStockTx } from '@/lib/inventory';
import { collection, getDocs, doc, query, orderBy, runTransaction, getDoc } from 'firebase/firestore';
import { ArrowRightLeft, Search, AlertCircle, CheckCircle2, Package, ArrowRight, X, Warehouse } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/nextjs';
import { Product } from '@/lib/types';

type WarehouseType = { id: string; name: string; };

export default function StockTransferPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [qty, setQty] = useState<number>(0);

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

  const fetchData = useCallback(async () => {
    try {
      const pSnap = await getDocs(query(collection(db, 'products'), orderBy('name', 'asc')));
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)).filter(p => (p as any).isActive !== false));

      const whSnap = await getDocs(collection(db, 'warehouses'));
      setWarehouses(whSnap.docs.map(d => ({ id: d.id, name: d.data().name } as WarehouseType)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat data");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !fromWarehouse || !toWarehouse || qty <= 0) return;
    if (fromWarehouse === toWarehouse) return notify.error("Gudang asal & tujuan sama");

    const currentStock = selectedProduct.stockByWarehouse?.[fromWarehouse] || 0;
    if (qty > currentStock) return notify.error(`Stok tidak cukup (${currentStock} available)`);

    setLoading(true);
    const t = notify.admin.loading("Memproses mutasi...");
    try {
      await runTransaction(db, async (tx) => {
        await transferStockTx(tx, {
          productId: selectedProduct.id,
          amount: qty,
          fromWarehouseId: fromWarehouse,
          toWarehouseId: toWarehouse,
          adminId: auth.currentUser?.uid || 'system',
          source: 'TRANSFER',
          note: `Transfer dari ${warehouses.find(w => w.id === fromWarehouse)?.name} ke ${warehouses.find(w => w.id === toWarehouse)?.name}`
        });
      });
      notify.admin.success('Mutasi stok berhasil!', { id: t });
      setQty(0);
      setSelectedProduct(null);
      setSearchTerm('');
      fetchData();
    } catch (err: any) {
      Sentry.captureException(err);
      notify.admin.error(err.message || 'Gagal mutasi', { id: t });
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
          <div className="p-4 bg-blue-50 text-blue-600 rounded-[1.5rem] shadow-sm">
            <ArrowRightLeft size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock Mutation</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Intra-warehouse distribution</p>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-slate-100 relative overflow-hidden">
          <form onSubmit={handleTransfer} className="space-y-8 relative z-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Inventory SKU</label>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="text" placeholder="Type product name..." className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                {searchTerm && !selectedProduct && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden max-h-60 overflow-y-auto py-2">
                    {filtered.map(p => (
                      <button key={p.id} type="button" onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); }} className="w-full text-left px-6 py-4 hover:bg-slate-50 flex justify-between items-center transition-colors">
                        <span className="text-xs font-black text-slate-800 uppercase">{p.name}</span>
                        <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">Total: {p.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-[2rem] flex items-center justify-between animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600"><Package size={20} /></div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedProduct.name}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(selectedProduct.stockByWarehouse || {}).map(([id, s]) => (
                          <span key={id} className="text-[8px] font-black bg-white/80 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-50 uppercase">{warehouses.find(w => w.id === id)?.name || id}: {s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedProduct(null)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={18} /></button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Node</label>
                <div className="relative">
                   <Warehouse className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <select required className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-50 appearance-none" value={fromWarehouse} onChange={e => setFromWarehouse(e.target.value)}>
                      <option value="">FROM WAREHOUSE...</option>
                      {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name.toUpperCase()}</option>)}
                   </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Node</label>
                <div className="relative">
                   <Warehouse className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                   <select required className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-50 appearance-none" value={toWarehouse} onChange={e => setToWarehouse(e.target.value)}>
                      <option value="">TO WAREHOUSE...</option>
                      {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name.toUpperCase()}</option>)}
                   </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Mutation Quantity</label>
              <div className="bg-slate-50 rounded-[2.5rem] p-4 flex items-center gap-6">
                 <button type="button" onClick={() => setQty(q => Math.max(0, q - 1))} className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-2xl font-black text-slate-300 active:scale-90 transition-all">-</button>
                 <input type="number" required placeholder="0" className="flex-1 bg-transparent border-none text-4xl font-black text-center outline-none" value={qty} onChange={e => setQty(Number(e.target.value))} />
                 <button type="button" onClick={() => setQty(q => q + 1)} className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-2xl font-black text-slate-300 active:scale-90 transition-all">+</button>
              </div>
            </div>

            <button type="submit" disabled={loading || !selectedProduct} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 group">
              {loading ? 'Processing...' : <><ArrowRightLeft size={16}/> Execute Mutation <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform"/></>}
            </button>
          </form>

          <div className="absolute -bottom-20 -right-20 text-slate-50 opacity-20 pointer-events-none rotate-12">
             <ArrowRightLeft size={300} />
          </div>
        </div>
      </div>
    </div>
  );
}
