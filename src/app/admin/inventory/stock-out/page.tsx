'use client';

import { useState, useEffect, useCallback } from 'react';
import { deductStockFEFO } from '@/lib/inventory';
import { postJournal } from '@/lib/ledger';
import { ArrowLeft, ArrowUpCircle, Search, Package, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import * as Sentry from '@sentry/nextjs';
import { Product } from '@/lib/types';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { isAuthorizedAdmin } from '@/lib/auth-helpers';
export default function StockOutPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState('Barang Rusak');

  const [selectedUnitCode, setSelectedUnitCode] = useState<string>('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin/login'); return; }
      if (!isAuthorizedAdmin(user)) {
        notify.aksesDitolakAdmin();
        router.push('/profil');
        return;
      }
      setAdminId(user.id);
    };
    checkAuth();
  }, [router]);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, name, stock, unit, raw_data')
        .or('is_active.eq.true,is_active.is.null')
        .order('name', { ascending: true })
        .limit(500);
      if (error) throw error;
      setProducts((data || []).map(p => ({
        id: p.id,
        name: p.name,
        stock: Number(p.stock ?? p.raw_data?.stock ?? 0),
        unit: p.unit || p.raw_data?.unit || 'pcs',
        units: Array.isArray(p.raw_data?.units) ? p.raw_data.units : [],
        stockByWarehouse: p.raw_data?.stockByWarehouse || {},
      } as any)));
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat produk");
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Satuan yang tersedia untuk produk terpilih
  const availableUnits = selectedProduct ? [
    { code: (selectedProduct.unit || 'PCS').toUpperCase(), contains: 1 },
    ...(((selectedProduct as any).units || []).map((u: any) => ({
      code: (u.code || u.unit || '').toUpperCase(),
      contains: Number(u.contains || 1)
    }))).filter((u: any) => u.code && u.code !== (selectedProduct.unit || 'PCS').toUpperCase())
  ] : [];

  const currentUnitObj = availableUnits.find(u => u.code === selectedUnitCode) || availableUnits[0] || { code: 'PCS', contains: 1 };
  const totalPcsToDeduct = Math.max(0, qty) * (currentUnitObj.contains || 1);
  const isOutOfStock = selectedProduct ? totalPcsToDeduct > selectedProduct.stock : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || qty <= 0) return;
    if (totalPcsToDeduct > selectedProduct.stock) {
      return notify.admin.error(`Stok tidak mencukupi! Tersedia: ${selectedProduct.stock} ${selectedProduct.unit}, Diminta keluar: ${totalPcsToDeduct} ${selectedProduct.unit}`);
    }

    setLoading(true);
    const t = notify.admin.loading("Memproses pengeluaran stok...");
    try {
      const { data: prodData } = await supabaseAdmin
        .from('products')
        .select('cost_price, raw_data')
        .eq('id', selectedProduct.id)
        .single();
      const costPrice = Number(prodData?.cost_price ?? prodData?.raw_data?.Modal ?? 0);
      const lossValue = costPrice * totalPcsToDeduct;

      const result = await deductStockFEFO({
        productId: selectedProduct.id,
        amount: totalPcsToDeduct,
        warehouseId: 'auto',
        adminId,
        source: 'MANUAL',
        notes: `Manual Out: ${reason} (${qty} ${currentUnitObj.code} = ${totalPcsToDeduct} ${selectedProduct.unit})`,
      });

      if (!result.success) {
        notify.admin.error(`Gagal: ${result.error}`, { id: t });
        return;
      }

      if (lossValue > 0) {
        await postJournal({
          debitAccount: 'LossOnInventory',
          creditAccount: 'Inventory',
          amount: lossValue,
          memo: `Inventory Loss: ${reason} (${totalPcsToDeduct} units)`,
          refType: 'STOCK_OUT',
          refId: selectedProduct.id
        });
      }

      notify.admin.success('Stok berhasil dikurangi!', { id: t });
      setQty(0);
      setSelectedProduct(null);
      setSelectedUnitCode('');
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
            <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mt-1">Manual inventory deduction</p>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 md:p-10 shadow-sm border border-slate-100 relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Select Product SKU</label>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                <input type="text" placeholder="Type product name..." className="w-full pl-14 pr-6 py-5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                {searchTerm && !selectedProduct && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden max-h-60 overflow-y-auto py-2">
                    {filtered.map(p => (
                      <button key={p.id} type="button" onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); }} className="w-full text-left px-6 py-4 hover:bg-slate-50 flex justify-between items-center transition-colors">
                        <span className="text-xs font-black text-slate-800 uppercase">{p.name}</span>
                        <span className="text-xs font-black bg-rose-50 text-rose-600 px-3 py-1 rounded-full uppercase">Stock: {p.stock}</span>
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
                      <p className="text-xs font-black text-rose-500 uppercase mt-1 tracking-widest">Available: {selectedProduct.stock} {selectedProduct.unit}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedProduct(null)} className="p-2 text-slate-400 hover:text-rose-600 transition-all"><X size={18} /></button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Jumlah Pengeluaran</label>
                  {availableUnits.length > 1 && (
                    <span className="text-[10px] font-bold text-slate-400">Pilih Satuan:</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0"
                    className="flex-1 px-6 py-5 bg-slate-50 border-none rounded-2xl text-2xl font-black text-center outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    value={qty || ''}
                    onChange={e => setQty(Math.max(0, Number(e.target.value)))}
                  />
                  {availableUnits.length > 1 ? (
                    <select
                      value={selectedUnitCode || availableUnits[0]?.code}
                      onChange={e => setSelectedUnitCode(e.target.value)}
                      className="px-4 py-5 bg-slate-100 rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {availableUnits.map(u => (
                        <option key={u.code} value={u.code}>
                          {u.code} {u.contains > 1 ? `(${u.contains} pcs)` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-6 py-5 bg-slate-100 rounded-2xl font-black text-xs uppercase flex items-center justify-center text-slate-600">
                      {selectedProduct?.unit || 'PCS'}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Alasan Pengeluaran</label>
                <select className="w-full px-6 py-5 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-50 transition-all appearance-none h-[68px]" value={reason} onChange={e => setReason(e.target.value)}>
                  <option value="Barang Rusak">Barang Rusak / Rusak Display</option>
                  <option value="Kadaluarsa">Kadaluarsa / Expired</option>
                  <option value="Hilang / Selisih">Hilang / Selisih Fisik</option>
                  <option value="Retur ke Supplier">Retur ke Supplier</option>
                  <option value="Dipakai Keperluan Toko">Dipakai Operasional Toko</option>
                </select>
              </div>
            </div>

            {/* LIVE CONVERSION & STOCK SUMMARY */}
            {selectedProduct && qty > 0 && (
              <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
                isOutOfStock
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex justify-between items-center font-bold">
                  <span>Total Kuantitas yang Dikeluarkan:</span>
                  <span className="font-black text-sm">
                    {qty} {currentUnitObj.code} {currentUnitObj.contains > 1 ? `(= ${totalPcsToDeduct} ${selectedProduct.unit})` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200/60">
                  <span>Sisa Stok Setelah Pengeluaran:</span>
                  <span className={`font-bold ${isOutOfStock ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {selectedProduct.stock - totalPcsToDeduct} {selectedProduct.unit}
                  </span>
                </div>
                {isOutOfStock && (
                  <p className="text-[11px] font-black text-rose-600 pt-1">
                    ⚠️ Pengeluaran melebihi stok yang tersedia ({selectedProduct.stock} {selectedProduct.unit})! Transaksi ditolak untuk mencegah stok minus.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedProduct || qty <= 0 || isOutOfStock}
              className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed group"
            >
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
