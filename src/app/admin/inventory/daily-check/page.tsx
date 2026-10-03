'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck, Search, CheckCircle2, AlertTriangle, RefreshCw,
  ArrowLeft, ArrowUpDown, Save, Barcode, Calendar, History,
  Sparkles, Check, AlertCircle, ShieldCheck, ChevronRight, Layers,
  ExternalLink, Info
} from 'lucide-react';
import notify from '@/lib/notify';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getUserAndRole, sbInsertDoc, sbGetDocs } from '@/lib/supabase-helpers';

import { TableSkeleton } from '@/components/admin/InventorySkeleton';

interface SamplingProduct {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  category: string;
  unit: string;
  systemStock: number;
  physicalStock: number | '';
  isSensitive: boolean;
  costPrice: number;
  lastChecked?: string;
  notes?: string;
}

interface SamplingHistory {
  id: string;
  date: string;
  adminEmail: string;
  totalChecked: number;
  totalMatched: number;
  totalDiscrepancy: number;
  items: Array<{
    name: string;
    systemStock: number;
    physicalStock: number;
    difference: number;
  }>;
  generalNotes?: string;
}

// Keyword indikator barang sensitif / bernilai tinggi / perputaran cepat
const SENSITIVE_KEYWORDS = [
  'minyak', 'goreng', 'beras', 'rokok', 'mie', 'indomie', 'sedap',
  'sedaap', 'gula', 'telur', 'susu', 'kopi', 'teh', 'sabun', 'deterjen',
  'karton', 'dus', 'slop', 'karung', 'gas', 'aqua', 'le minerale'
];

export default function DailyCheckPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'checklist' | 'history'>('checklist');
  const [products, setProducts] = useState<SamplingProduct[]>([]);
  const [filterMode, setFilterMode] = useState<'SENSITIVE' | 'ALL' | 'DISCREPANCY'>('SENSITIVE');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [generalNotes, setGeneralNotes] = useState('');
  const [samplingHistories, setSamplingHistories] = useState<SamplingHistory[]>([]);

  // Auth verification
  useEffect(() => {
    (async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) return router.push('/admin/login');
      if (!isAdmin) {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
    })();
  }, [router]);

  // Load products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .or('is_active.eq.true,is_active.is.null')
        .order('name', { ascending: true })
        .limit(1000);

      if (error) throw error;

      const items: SamplingProduct[] = (data || []).map((p: any) => {
        const raw = p.raw_data || {};
        const name = (p.name || raw.Nama || '').toLowerCase();
        const cat = (p.category || raw.Kategori || '').toLowerCase();
        const stk = Number(p.stock ?? raw.Stok ?? raw.stock ?? 0);
        const cost = Number(p.cost_price ?? raw.Modal ?? 0);

        const isSensitive = SENSITIVE_KEYWORDS.some(kw => name.includes(kw) || cat.includes(kw)) || cost >= 100000;

        return {
          id: p.id,
          name: p.name || raw.Nama || 'Tanpa Nama',
          barcode: p.barcode || raw.Barcode || '',
          sku: p.sku || raw.ID || p.id,
          category: p.category || raw.Kategori || 'UMUM',
          unit: (p.unit || raw.Satuan || 'PCS').toUpperCase(),
          systemStock: stk,
          physicalStock: '', // Default kosong, wajib diinput user
          isSensitive,
          costPrice: cost,
        };
      });

      setProducts(items);

      // Fetch histories
      try {
        const snap = await sbGetDocs({
          table: 'inventory_logs',
          orderBy: [{ field: 'createdAt', direction: 'desc' }],
          limit: 50,
        });
        const dailyLogs: SamplingHistory[] = [];
        snap.docs.forEach(d => {
          const dt = d.data();
          if (dt.source === 'DAILY_SAMPLING' || dt.type === 'DAILY_SAMPLING') {
            dailyLogs.push({
              id: d.id,
              date: dt.createdAt?.toDate ? dt.createdAt.toDate().toISOString() : (dt.createdAt || new Date().toISOString()),
              adminEmail: dt.adminEmail || 'admin',
              totalChecked: dt.totalChecked || (dt.items?.length || 0),
              totalMatched: dt.totalMatched || 0,
              totalDiscrepancy: dt.totalDiscrepancy || 0,
              items: dt.items || [],
              generalNotes: dt.notes || '',
            });
          }
        });
        setSamplingHistories(dailyLogs);
      } catch (err) {
        console.warn('Gagal load history sampling:', err);
      }

    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Gagal memuat produk');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Update physical stock input
  const handlePhysicalStockChange = (productId: string, val: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          physicalStock: val === '' ? '' : Math.max(0, Number(val)),
        };
      }
      return p;
    }));
  };

  // Quick fill matched: isi physicalStock sama dengan systemStock
  const handleQuickMatch = (productId: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return {
          ...p,
          physicalStock: p.systemStock,
        };
      }
      return p;
    }));
  };

  // Filtered Products
  const displayedProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter(p => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      
      let matchFilter = true;
      if (filterMode === 'SENSITIVE') matchFilter = p.isSensitive;
      else if (filterMode === 'DISCREPANCY') {
        matchFilter = p.physicalStock !== '' && p.physicalStock !== p.systemStock;
      }

      return matchSearch && matchFilter;
    });
  }, [products, search, filterMode]);

  // Evaluated stats
  const checkStats = useMemo(() => {
    let checkedCount = 0;
    let matchCount = 0;
    let diffCount = 0;
    let totalSensitive = 0;

    products.forEach(p => {
      if (p.isSensitive) totalSensitive++;
      if (p.physicalStock !== '') {
        checkedCount++;
        if (p.physicalStock === p.systemStock) matchCount++;
        else diffCount++;
      }
    });

    return { checkedCount, matchCount, diffCount, totalSensitive };
  }, [products]);

  // Submit Sampling Record
  const handleSubmitSampling = async () => {
    const filledItems = products.filter(p => p.physicalStock !== '');
    if (filledItems.length === 0) {
      return notify.error('Belum ada stok fisik yang diisi. Isi minimal 1 produk sampling.');
    }

    setSaving(true);
    try {
      const userRes = await supabase.auth.getUser();
      const adminEmail = userRes.data.user?.email || 'admin';
      const adminId = userRes.data.user?.id || 'system';
      const now = new Date();

      const itemsPayload = filledItems.map(p => {
        const phys = Number(p.physicalStock);
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          systemStock: p.systemStock,
          physicalStock: phys,
          difference: phys - p.systemStock,
          unit: p.unit,
        };
      });

      const matched = itemsPayload.filter(i => i.difference === 0).length;
      const discrepancies = itemsPayload.filter(i => i.difference !== 0);

      // Simpan log ke Supabase
      await sbInsertDoc('inventory_logs', {
        type: 'DAILY_SAMPLING',
        source: 'DAILY_SAMPLING',
        createdAt: now.toISOString(),
        date: now.toISOString(),
        adminEmail,
        adminId,
        totalChecked: itemsPayload.length,
        totalMatched: matched,
        totalDiscrepancy: discrepancies.length,
        items: itemsPayload,
        notes: generalNotes || 'Sampling harian selesai.',
      });

      // Update stok produk di database untuk barang yang selisih & sinkronisasi
      for (const item of discrepancies) {
        // Update Supabase
        const { data: cur } = await supabaseAdmin.from('products').select('raw_data').eq('id', item.productId).single();
        const raw = cur?.raw_data || {};
        await supabaseAdmin.from('products').update({
          stock: item.physicalStock,
          raw_data: {
            ...raw,
            Stok: item.physicalStock,
            stock: item.physicalStock,
            lastOpnameDate: now.toISOString(),
          },
          updated_at: now.toISOString(),
        }).eq('id', item.productId);
      }

      notify.success(`Sampling selesai! ${itemsPayload.length} barang divalidasi. (${discrepancies.length} selisih disinkronkan).`);
      setGeneralNotes('');
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Gagal menyimpan hasil sampling');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/inventory" className="text-slate-400 hover:text-slate-800 transition-colors p-1.5 hover:bg-slate-100 rounded-xl">
                <ArrowLeft size={18} />
              </Link>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                SOP Harian 5 Menit
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <ClipboardCheck className="text-emerald-600" />
              Checklist Sampling Stok Harian
            </h1>
            <p className="text-xs md:text-sm text-slate-400 font-bold mt-1">
              Validasi fisik acak barang sensitif & cepat laku (minyak, rokok, beras, mie instan) agar stok toko & website selalu sinkron.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchProducts}
              disabled={loading}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-xs font-black transition-all flex items-center gap-2"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleSubmitSampling}
              disabled={saving || checkStats.checkedCount === 0}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50"
            >
              <Save size={16} />
              Selesaikan Sampling ({checkStats.checkedCount})
            </button>
          </div>
        </div>

        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Target Sensitif</span>
            <p className="text-2xl md:text-3xl font-black text-slate-900">{checkStats.totalSensitive}</p>
            <p className="text-[11px] font-bold text-slate-400">Barang prioritas dicek</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Sudah Divalidasi</span>
            <p className="text-2xl md:text-3xl font-black text-blue-600">{checkStats.checkedCount}</p>
            <p className="text-[11px] font-bold text-slate-400">Barang telah dihitung fisik</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Stok Sesuai (Match)</span>
            <p className="text-2xl md:text-3xl font-black text-emerald-600">{checkStats.matchCount}</p>
            <p className="text-[11px] font-bold text-slate-400">Fisik cocok dengan sistem</p>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">Ditemukan Selisih</span>
            <p className={`text-2xl md:text-3xl font-black ${checkStats.diffCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {checkStats.diffCount}
            </p>
            <p className="text-[11px] font-bold text-slate-400">Akan otomatis disinkronkan</p>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 px-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'checklist'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <ClipboardCheck size={16} />
            Lembar Sampling Hari Ini ({displayedProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-2 text-xs md:text-sm font-black uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <History size={16} />
            Riwayat Sampling ({samplingHistories.length})
          </button>
        </div>

        {/* TAB 1: CHECKLIST FORM */}
        {activeTab === 'checklist' && (
          <div className="space-y-4">
            
            {/* TOOLBAR */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Scan barcode atau cari nama barang sensitif..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterMode('SENSITIVE')}
                  className={`px-3 py-2 rounded-2xl text-xs font-black transition-all ${
                    filterMode === 'SENSITIVE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🔥 Barang Sensitif ({checkStats.totalSensitive})
                </button>
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`px-3 py-2 rounded-2xl text-xs font-black transition-all ${
                    filterMode === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Semua Produk ({products.length})
                </button>
                {checkStats.diffCount > 0 && (
                  <button
                    onClick={() => setFilterMode('DISCREPANCY')}
                    className={`px-3 py-2 rounded-2xl text-xs font-black transition-all ${
                      filterMode === 'DISCREPANCY'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    ⚠️ Selisih ({checkStats.diffCount})
                  </button>
                )}
              </div>
            </div>

            {/* CHECKLIST TABLE */}
            {loading ? (
              <TableSkeleton />
            ) : displayedProducts.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <ShieldCheck size={36} className="mx-auto text-emerald-300" />
                <p className="text-sm font-black text-slate-700">Tidak ada produk dalam daftar ini</p>
                <p className="text-xs text-slate-400">Pilih opsi "Semua Produk" atau sesuaikan pencarian.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 uppercase tracking-widest font-black">
                        <th className="py-4 px-6">Produk & Barcode</th>
                        <th className="py-4 px-4 text-center">Stok Sistem</th>
                        <th className="py-4 px-4 text-center">Stok Fisik Hari Ini</th>
                        <th className="py-4 px-4 text-center">Status Selisih</th>
                        <th className="py-4 px-6 text-center">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayedProducts.map(p => {
                        const hasInput = p.physicalStock !== '';
                        const physNum = Number(p.physicalStock);
                        const diff = hasInput ? physNum - p.systemStock : null;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                            
                            {/* Produk */}
                            <td className="py-4 px-6">
                              <div className="space-y-0.5">
                                <p className="font-black text-slate-900 uppercase line-clamp-1">{p.name}</p>
                                <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                                  {p.barcode && <span>Barcode: {p.barcode}</span>}
                                  <span>SKU: {p.sku}</span>
                                  {p.isSensitive && (
                                    <span className="bg-amber-50 text-amber-700 font-bold px-1.5 py-0.2 rounded font-sans">
                                      Sensitif
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Stok Sistem */}
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-black text-slate-800">{p.systemStock}</span>
                              <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">{p.unit}</span>
                            </td>

                            {/* Input Stok Fisik */}
                            <td className="py-4 px-4 text-center">
                              <div className="inline-flex items-center justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Hitung..."
                                  value={p.physicalStock}
                                  onChange={e => handlePhysicalStockChange(p.id, e.target.value)}
                                  className={`w-24 px-3 py-2 rounded-xl text-center font-black text-sm border focus:outline-none transition-all ${
                                    hasInput
                                      ? (diff === 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800')
                                      : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-blue-500'
                                  }`}
                                />
                              </div>
                            </td>

                            {/* Status Selisih */}
                            <td className="py-4 px-4 text-center">
                              {!hasInput ? (
                                <span className="text-[11px] font-bold text-slate-400 italic">Belum dihitung</span>
                              ) : diff === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase bg-emerald-50 text-emerald-600">
                                  <CheckCircle2 size={13} /> Cocok (0)
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase ${
                                  (diff || 0) < 0 ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                                }`}>
                                  <AlertTriangle size={13} />
                                  {(diff || 0) > 0 ? `+${diff}` : diff} {p.unit}
                                </span>
                              )}
                            </td>

                            {/* Quick Button */}
                            <td className="py-4 px-6 text-center">
                              <button
                                onClick={() => handleQuickMatch(p.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-[11px] transition-colors"
                                title="Salin stok sistem ke fisik jika sudah dicek dan persis"
                              >
                                Sesuai ({p.systemStock})
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* GENERAL NOTES & SUBMIT BAR */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Catatan sampling hari ini (misal: ada 1 mie sobek, rokok sesuai, dll.)..."
                  value={generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={handleSubmitSampling}
                  disabled={saving || checkStats.checkedCount === 0}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shadow-emerald-200 disabled:opacity-50"
                >
                  <Save size={15} />
                  Simpan & Sinkronkan ({checkStats.checkedCount} Produk)
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: RIWAYAT SAMPLING */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Riwayat Sampling Harian</h3>
              <p className="text-xs text-slate-400 font-bold">Catatan kedisiplinan pemeriksaan fisik barang per tanggal.</p>
            </div>

            {samplingHistories.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl">
                Belum ada arsip riwayat sampling harian.
              </div>
            ) : (
              <div className="space-y-3">
                {samplingHistories.map(h => (
                  <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                          <ClipboardCheck size={16} />
                        </span>
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            {new Date(h.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">Petugas: {h.adminEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-black">
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                          {h.totalChecked} Diperiksa
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                          {h.totalMatched} Cocok
                        </span>
                        {h.totalDiscrepancy > 0 && (
                          <span className="bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full">
                            {h.totalDiscrepancy} Selisih
                          </span>
                        )}
                      </div>
                    </div>

                    {h.generalNotes && (
                      <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                        {h.generalNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
