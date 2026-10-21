'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useAdminAuth from '@/lib/hooks/useAdminAuth';
import {
  Grid, Plus, Search, Edit, Trash2, Package, ChevronRight, X, Download,
  Layers, Save, Activity, RefreshCw, Zap, CheckCircle2, Sparkles,
  AlertTriangle, Filter, ExternalLink, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/nextjs';
import { InventorySkeleton } from '@/components/admin/InventorySkeleton';
import { supabase } from '@/lib/supabase';
import { sbDeleteDoc, sbGetDocs, sbInsertDoc, sbUpdateDoc } from '@/lib/supabase-helpers';
import {
  syncMarketplaceCategories,
  autoClassifyProductsAction
} from '@/lib/actions/product.actions';
import { MARKETPLACE_CATEGORIES } from '@/lib/marketplace-categories';

type Category = {
  id: string;
  name: string;
  slug: string;
  code?: string;
  icon?: string;
  group?: string;
  shopeeKat?: 'A' | 'B' | 'C' | 'D' | 'E' | 'X';
  shopeeStarAdmin?: number;
  shopeeMallAdmin?: number;
  tiktokGroup?: string;
  tiktokKomisi?: number;
  isMarketplace?: boolean;
  description?: string;
  productCount: number;
  createdAt: any;
};

export default function AdminCategories() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-classification modal state
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [autoScope, setAutoScope] = useState<'generic' | 'all'>('generic');
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<{
    scanned: number;
    updated: number;
    skipped: number;
    categoryStats: Record<string, number>;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    code: '',
    icon: '📦',
    group: 'makanan',
    shopeeKat: 'B' as 'A' | 'B' | 'C' | 'D' | 'E' | 'X',
    shopeeStarAdmin: 9.0,
    tiktokGroup: '1',
    tiktokKomisi: 5.25
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const catSnap = await sbGetDocs({ table: 'categories' });

      // Hitung jumlah produk per kategori secara efisien dalam 1 query batch
      const countMap: Record<string, number> = {};
      try {
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data: prods, error: pErr } = await supabase
            .from('products')
            .select('category')
            .range(from, from + pageSize - 1);
          if (pErr || !prods || prods.length === 0) break;
          for (const p of prods) {
            if (p.category) {
              const k = p.category.trim().toLowerCase();
              countMap[k] = (countMap[k] || 0) + 1;
            }
          }
          if (prods.length < pageSize) break;
          from += pageSize;
        }
      } catch (err) {
        console.warn('Failed to aggregate product counts:', err);
      }

      const categoryList: Category[] = catSnap.docs.map((doc) => {
        const data = doc.data();
        const raw = data.raw_data || {};
        const catName = data.name || raw.name || 'Untitled';
        const exactCount = countMap[catName.toLowerCase()] || 0;

        // Cek kecocokan di master marketplace jika belum ada di raw_data
        const mpMatch = MARKETPLACE_CATEGORIES.find(
          m => m.name.toLowerCase() === catName.toLowerCase() ||
               (m.code && catName.includes(`(${m.code})`))
        );

        return {
          id: doc.id,
          name: catName,
          slug: data.slug || raw.slug || '',
          code: raw.code || mpMatch?.code || (catName.match(/\((\d+)\)/)?.[1]),
          icon: raw.icon || mpMatch?.icon || '📦',
          group: raw.group || mpMatch?.group || 'makanan',
          shopeeKat: raw.shopeeKat || mpMatch?.shopeeKat || (catName.includes('(820368)') ? 'B' : 'A'),
          shopeeStarAdmin: raw.shopeeStarAdmin ?? mpMatch?.shopeeStarAdmin ?? (catName.includes('(820368)') ? 9.0 : 10.0),
          shopeeMallAdmin: raw.shopeeMallAdmin ?? mpMatch?.shopeeMallAdmin ?? (catName.includes('(820368)') ? 10.2 : 11.7),
          tiktokGroup: raw.tiktokGroup || mpMatch?.tiktokGroup || (catName.includes('(820368)') ? 'B' : '1'),
          tiktokKomisi: raw.tiktokKomisi ?? mpMatch?.tiktokKomisi ?? (catName.includes('(820368)') ? 9.5 : 5.25),
          isMarketplace: Boolean(raw.isMarketplace || mpMatch || raw.code || catName.includes('(')),
          description: data.description || raw.description || mpMatch?.description || '',
          productCount: exactCount,
          createdAt: data.createdAt || raw.createdAt
        };
      });

      setCategories(categoryList.sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name)));
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat kategori");
    } finally {
      setLoading(false);
    }
  }, []);

  const { authLoading, adminId } = useAdminAuth({ allowedRoles: ['admin'] as any });

  useEffect(() => {
    if (authLoading) return;
    if (adminId) {
      fetchData();
    }
  }, [authLoading, adminId, fetchData]);

  // Handle Sync Marketplace Categories
  const handleSyncMarketplace = async () => {
    try {
      setIsSyncing(true);
      notify.admin.info("Menyinkronkan kategori dengan standar Shopee & TikTok Shop...");
      const res = await syncMarketplaceCategories();
      if (res.success && res.data) {
        notify.admin.success(
          `Kategori marketplace berhasil disinkronkan! (+${res.data.insertedCount} baru, ${res.data.updatedCount} diperbarui)`
        );
        await fetchData();
      } else {
        notify.admin.error(res.error || "Gagal sinkronisasi kategori marketplace");
      }
    } catch (err: any) {
      notify.admin.error(err?.message || "Gagal sinkronisasi");
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle Run Auto-Classification
  const handleRunAutoClassify = async () => {
    try {
      setIsClassifying(true);
      setClassifyResult(null);
      const res = await autoClassifyProductsAction({
        onlyGeneric: autoScope === 'generic'
      });
      if (res.success && res.data) {
        setClassifyResult(res.data);
        notify.admin.success(
          `Penempatan otomatis selesai! ${res.data.updated} produk berhasil dialokasikan ke kategori marketplace.`
        );
        await fetchData();
      } else {
        notify.admin.error(res.error || "Gagal menjalankan klasifikasi otomatis");
      }
    } catch (err: any) {
      notify.admin.error(err?.message || "Terjadi kesalahan");
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      if (editId) {
        await sbUpdateDoc('categories', editId, {
          name: formData.name,
          slug,
          raw_data: {
            ...formData,
            slug,
            updatedAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        });
      } else {
        await sbInsertDoc('categories', {
          name: formData.name,
          slug,
          raw_data: {
            ...formData,
            slug,
            createdAt: new Date().toISOString()
          },
          createdAt: new Date().toISOString()
        });
      }
      setFormData({
        name: '',
        description: '',
        code: '',
        icon: '📦',
        group: 'makanan',
        shopeeKat: 'B',
        shopeeStarAdmin: 9.0,
        tiktokGroup: '1',
        tiktokKomisi: 5.25
      });
      setEditId(null);
      setShowModal(false);
      fetchData();
      notify.admin.success(editId ? "Kategori diperbarui" : "Kategori dibuat");
    } catch (err) {
      Sentry.captureException(err);
      notify.admin.error("Gagal menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string, count: number) => {
    if (count > 0) return notify.admin.error(`Kategori "${name}" masih memiliki ${count} produk terdaftar.`);
    if (!confirm(`Hapus kategori "${name}"?`)) return;
    try {
      await sbDeleteDoc('categories', id);
      setCategories(prev => prev.filter(c => c.id !== id));
      notify.admin.success("Kategori berhasil dihapus");
    } catch (err) {
      Sentry.captureException(err);
      notify.admin.error("Gagal menghapus kategori");
    }
  };

  const handleExport = () => {
    const data = categories.map(c => ({
      Nama: c.name,
      Slug: c.slug,
      'Kode Marketplace': c.code || '-',
      'Shopee Kat': c.shopeeKat || '-',
      'Shopee Admin (%)': c.shopeeStarAdmin ? `${c.shopeeStarAdmin}%` : '-',
      'TikTok Grup': c.tiktokGroup || '-',
      'TikTok Komisi (%)': c.tiktokKomisi ? `${c.tiktokKomisi}%` : '-',
      'Jumlah Produk': c.productCount,
      Deskripsi: c.description
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kategori Marketplace");
    XLSX.writeFile(wb, "Kategori_Marketplace_Ataya.xlsx");
  };

  // Filter Categories
  const filtered = useMemo(() => {
    return categories.filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.code && c.code.includes(searchTerm)) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;

      if (selectedGroup === 'all') return true;
      if (selectedGroup === 'marketplace') return c.isMarketplace;
      if (selectedGroup === 'makanan') return c.group === 'makanan' || c.name.toLowerCase().includes('makan') || c.name.toLowerCase().includes('snack') || c.name.toLowerCase().includes('kue') || c.name.toLowerCase().includes('kopi') || c.name.toLowerCase().includes('teh');
      if (selectedGroup === 'sembako') return c.group === 'sembako' || c.name.toLowerCase().includes('beras') || c.name.toLowerCase().includes('minyak') || c.name.toLowerCase().includes('gula') || c.name.toLowerCase().includes('bumbu');
      if (selectedGroup === 'perawatan') return c.group === 'perawatan' || c.group === 'bayi' || c.name.toLowerCase().includes('sabun') || c.name.toLowerCase().includes('shampo') || c.name.toLowerCase().includes('popok');
      if (selectedGroup === 'kebersihan') return c.group === 'kebersihan' || c.name.toLowerCase().includes('deterjen') || c.name.toLowerCase().includes('bersih');
      return true;
    });
  }, [categories, searchTerm, selectedGroup]);

  // Overall Stats
  const totalProductsClassified = useMemo(() => {
    return categories.reduce((acc, c) => acc + c.productCount, 0);
  }, [categories]);

  const marketplaceCatsCount = useMemo(() => {
    return categories.filter(c => c.isMarketplace).length;
  }, [categories]);

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-6 space-y-8">
      <Toaster position="top-right" />

      {/* ── HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wider uppercase">
              <Sparkles size={14} className="text-amber-400 animate-pulse" />
              SINKRONISASI RESMI SHOPEE & TIKTOK SHOP 2026
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Layers className="text-blue-400" size={36} /> Category Matrix
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed font-normal">
              Kelola kategori inventaris toko yang diselaraskan dengan skema komisi & potongan resmi marketplace agar penetapan harga dan kalkulator profit tidak boncos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sync Marketplace Categories */}
            <button
              onClick={handleSyncMarketplace}
              disabled={isSyncing}
              className="px-4 py-3.5 bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-400/40 rounded-2xl text-xs font-black tracking-wider text-white flex items-center gap-2 shadow-lg active:scale-95 transition-all"
              title="Tambahkan semua kategori resmi marketplace yang belum ada di database"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "MENYINKRONKAN..." : "SYNC MARKETPLACE"}
            </button>

            {/* Auto Classify Products */}
            <button
              onClick={() => {
                setClassifyResult(null);
                setShowAutoModal(true);
              }}
              className="px-5 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-2xl text-xs tracking-wider flex items-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Zap size={16} className="fill-slate-950" />
              OTOMATISASI PENEMPATAN
            </button>

            {/* Export Excel */}
            <button
              onClick={handleExport}
              className="p-3.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-slate-200 hover:text-white transition-all shadow-sm"
              title="Unduh data kategori (Excel)"
            >
              <Download size={18} />
            </button>

            {/* New Category */}
            <button
              onClick={() => {
                setEditId(null);
                setFormData({
                  name: '',
                  description: '',
                  code: '',
                  icon: '📦',
                  group: 'makanan',
                  shopeeKat: 'B',
                  shopeeStarAdmin: 9.0,
                  tiktokGroup: '1',
                  tiktokKomisi: 5.25
                });
                setShowModal(true);
              }}
              className="px-5 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl text-xs font-black tracking-wider flex items-center gap-2 shadow-xl active:scale-95 transition-all"
            >
              <Plus size={16} /> KATEGORI BARU
            </button>
          </div>
        </div>

        {/* Quick Stat Ribbon */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Kategori</span>
            <p className="text-2xl font-black text-white mt-0.5">{categories.length}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Marketplace Official</span>
            <p className="text-2xl font-black text-amber-400 mt-0.5">{marketplaceCatsCount} <span className="text-xs font-semibold text-slate-400">kategori</span></p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Terkategori</span>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{totalProductsClassified.toLocaleString('id-ID')} <span className="text-xs font-semibold text-slate-400">SKU</span></p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Komisi Bakpia & Roti</span>
            <p className="text-2xl font-black text-orange-400 mt-0.5">Shopee 9% · TikTok 9.5%</p>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute -bottom-16 -right-16 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-16 -left-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* ── FILTER & SEARCH CONTROLS ── */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'Semua', count: categories.length },
            { id: 'marketplace', label: 'Official Marketplace', count: marketplaceCatsCount },
            { id: 'makanan', label: '🍪 Snack & Makanan' },
            { id: 'sembako', label: '🛒 Sembako & Dapur' },
            { id: 'perawatan', label: '🧴 Perawatan & Bayi' },
            { id: 'kebersihan', label: '🧼 Kebersihan & Rumah' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedGroup(tab.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black tracking-wider whitespace-nowrap transition-all ${
                selectedGroup === tab.id
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${
                  selectedGroup === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari kategori, ID (#820368), atau kata kunci..."
            className="w-full pl-13 pr-4 py-3 bg-white border border-slate-200/80 rounded-2xl text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* ── CATEGORY GRID ── */}
      {loading ? (
        <InventorySkeleton />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm">
          <Layers size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Tidak ada kategori ditemukan</h3>
          <p className="text-slate-500 text-xs mt-1">Coba sesuaikan kata kunci pencarian atau klik tombol Sync Marketplace untuk memuat kategori resmi.</p>
          <button
            onClick={handleSyncMarketplace}
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black tracking-wider hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all inline-flex items-center gap-2"
          >
            <RefreshCw size={14} /> SINKRONKAN KATEGORI MARKETPLACE
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-[2rem] p-7 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Header Card: Icon + Category Name + Actions */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-3 bg-slate-50 border border-slate-100 rounded-2xl group-hover:scale-110 transition-transform">
                      {cat.icon || '📦'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                          {cat.name}
                        </h3>
                      </div>
                      {cat.code && (
                        <span className="inline-block text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md mt-1 tracking-wider uppercase">
                          ID: #{cat.code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditId(cat.id);
                        setFormData({
                          name: cat.name,
                          description: cat.description || '',
                          code: cat.code || '',
                          icon: cat.icon || '📦',
                          group: cat.group || 'makanan',
                          shopeeKat: cat.shopeeKat || 'B',
                          shopeeStarAdmin: cat.shopeeStarAdmin || 9.0,
                          tiktokGroup: cat.tiktokGroup || '1',
                          tiktokKomisi: cat.tiktokKomisi || 5.25
                        });
                        setShowModal(true);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                      title="Edit Kategori"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name, cat.productCount)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Hapus Kategori"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 font-medium line-clamp-2 mb-5 h-8 leading-relaxed">
                  {cat.description || 'Kategori produk terdaftar dalam katalog inventaris Ataya Toko.'}
                </p>

                {/* Marketplace Commission Rates Badges */}
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {/* Shopee Badge */}
                  <div className="bg-orange-50 border border-orange-200/70 p-2.5 rounded-xl flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-orange-800 tracking-wider uppercase">Shopee</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-200 text-orange-900">
                        Kat {cat.shopeeKat || 'A'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-orange-950 mt-0.5">
                      {cat.shopeeStarAdmin ? `${cat.shopeeStarAdmin}%` : '10.0%'}
                      <span className="text-[10px] font-normal text-orange-700 ml-1">Star</span>
                    </span>
                  </div>

                  {/* TikTok Badge */}
                  <div className="bg-pink-50 border border-pink-200/70 p-2.5 rounded-xl flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-pink-800 tracking-wider uppercase">TikTok</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-pink-200 text-pink-900">
                        Grup {cat.tiktokGroup || '1'}
                      </span>
                    </div>
                    <span className="text-xs font-black text-pink-950 mt-0.5">
                      {cat.tiktokKomisi ? `${cat.tiktokKomisi}%` : '5.25%'}
                      <span className="text-[10px] font-normal text-pink-700 ml-1">Komisi</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer: SKU Count + Link */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                    <Package size={14} />
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {cat.productCount.toLocaleString('id-ID')}
                    <span className="text-slate-400 font-bold text-[10px] uppercase ml-1">Produk</span>
                  </span>
                </div>

                <Link
                  href={`/admin/products?category=${encodeURIComponent(cat.name)}`}
                  className="text-[11px] font-black text-blue-600 hover:text-blue-700 tracking-wider uppercase flex items-center gap-1 hover:gap-2 transition-all"
                >
                  LIHAT SKU <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: OTOMATISASI PENEMPATAN KATEGORI ── */}
      {showAutoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => !isClassifying && setShowAutoModal(false)} />
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-6 md:p-9 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
                  <Zap size={24} className="fill-amber-500" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Otomatisasi Penempatan Kategori</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Klasifikasi Cerdas Marketplace</p>
                </div>
              </div>
              <button
                disabled={isClassifying}
                onClick={() => setShowAutoModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Explanation */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 mb-6 text-xs text-slate-600 space-y-2">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <HelpCircle size={14} className="text-blue-600" /> Bagaimana cara kerja penempatan otomatis?
              </p>
              <p className="leading-relaxed">
                Algoritma akan memindai nama setiap produk dan mencocokkannya ke kategori marketplace yang paling tepat berdasarkan kata kunci:
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] font-semibold text-slate-700">
                <li className="flex items-center gap-1.5">🍪 Bakpia, Abon, Roti → Kue & Pastri</li>
                <li className="flex items-center gap-1.5">🍜 Indomie, Mie, Bihun → Mie Instan</li>
                <li className="flex items-center gap-1.5">☕ Kopi, Kapal Api → Kopi</li>
                <li className="flex items-center gap-1.5">🍳 Minyak, Bimoli → Minyak Goreng</li>
                <li className="flex items-center gap-1.5">🧼 Rinso, SoKlin, Downy → Deterjen</li>
                <li className="flex items-center gap-1.5">🧴 Lifebuoy, Biore → Sabun Mandi</li>
              </ul>
            </div>

            {/* Scope Selection */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">Pilih Lingkup Produk:</label>
              
              <div
                onClick={() => !isClassifying && setAutoScope('generic')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  autoScope === 'generic' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={autoScope === 'generic'}
                  onChange={() => setAutoScope('generic')}
                  disabled={isClassifying}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900">Hanya Produk Tanpa Kategori / Kategori Umum</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.2 font-black rounded-full">REKOMENDASI</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Memperbaiki produk yang berlabel generic seperti &quot;Semua&quot;, &quot;Lain-lain&quot;, &quot;Pokok&quot;, atau kosong (~2.000+ produk) tanpa mengubah kategori produk yang sudah rapi.
                  </p>
                </div>
              </div>

              <div
                onClick={() => !isClassifying && setAutoScope('all')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                  autoScope === 'all' ? 'border-amber-500 bg-amber-50/50' : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={autoScope === 'all'}
                  onChange={() => setAutoScope('all')}
                  disabled={isClassifying}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-black text-slate-900">Seluruh Katalog Produk (Penuh)</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Memindai dan mengkalibrasi ulang seluruh produk (5.600+ SKU) ke kategori marketplace paling akurat.
                  </p>
                </div>
              </div>
            </div>

            {/* Results Display */}
            {classifyResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-sm mb-3">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  Penempatan Kategori Selesai!
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Dipindai</span>
                    <p className="text-base font-black text-slate-900">{classifyResult.scanned}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Berhasil Dialihkan</span>
                    <p className="text-base font-black text-emerald-600">+{classifyResult.updated}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tetap / Lewati</span>
                    <p className="text-base font-black text-slate-600">{classifyResult.skipped}</p>
                  </div>
                </div>

                {Object.keys(classifyResult.categoryStats).length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-emerald-200/60">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Top Kategori Baru Ditempatkan:</span>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                      {Object.entries(classifyResult.categoryStats)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([catName, count]) => (
                          <span key={catName} className="text-[10px] bg-white border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-slate-700">
                            {catName}: <strong className="text-emerald-700 font-black">{count}</strong>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isClassifying}
                onClick={() => setShowAutoModal(false)}
                className="flex-1 py-4 text-xs font-black tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
              >
                {classifyResult ? "TUTUP" : "BATAL"}
              </button>

              <button
                type="button"
                disabled={isClassifying}
                onClick={handleRunAutoClassify}
                className="flex-[2] py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black rounded-2xl text-xs tracking-wider shadow-xl shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isClassifying ? (
                  <>
                    <Activity className="animate-spin" size={16} />
                    MEMPROSES PENEMPATAN OTOMATIS...
                  </>
                ) : (
                  <>
                    <Zap size={16} className="fill-slate-950" />
                    MULAI PENEMPATAN OTOMATIS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT CATEGORY ── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => !isSaving && setShowModal(false)} />
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 md:p-8 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editId ? 'Edit Kategori' : 'Kategori Baru'}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Pengaturan Klasifikasi & Tarif Marketplace</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name & Icon */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1 space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Emoji</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3.5 text-center text-xl outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nama Kategori</label>
                  <input
                    required
                    placeholder="e.g. Kue Camilan & Roti Pastri (820368)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              {/* Code ID & Group */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Kode ID Marketplace</label>
                  <input
                    placeholder="e.g. 820368"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Grup Sektor</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                  >
                    <option value="makanan">🍪 Makanan & Snack</option>
                    <option value="sembako">🛒 Sembako & Dapur</option>
                    <option value="perawatan">🧴 Perawatan & Kecantikan</option>
                    <option value="bayi">🍼 Bayi & Anak</option>
                    <option value="kebersihan">🧼 Kebersihan & Rumah</option>
                    <option value="lainnya">📦 Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Marketplace Rates Mapping */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-blue-600" /> Tarif Komisi Marketplace (Verified 2026)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-orange-800 uppercase">Shopee Kategori</label>
                    <select
                      className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold mt-1"
                      value={formData.shopeeKat}
                      onChange={(e) => {
                        const kat = e.target.value as any;
                        const rates: Record<string, number> = { A: 10.0, B: 9.0, C: 6.75, D: 5.25, E: 4.25, X: 2.5 };
                        setFormData({ ...formData, shopeeKat: kat, shopeeStarAdmin: rates[kat] || 9.0 });
                      }}
                    >
                      <option value="B">Kat B · Snack/Bakpia/Kosmetik (9.0%)</option>
                      <option value="A">Kat A · Makanan Umum/Sembako (10.0%)</option>
                      <option value="C">Kat C · Susu/Vitamin (6.75%)</option>
                      <option value="D">Kat D · Elektronik (5.25%)</option>
                      <option value="E">Kat E · Logam Mulia (4.25%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-pink-800 uppercase">TikTok Shop Komisi</label>
                    <select
                      className="w-full bg-white border border-pink-200 rounded-xl px-3 py-2 text-xs font-bold mt-1"
                      value={formData.tiktokGroup}
                      onChange={(e) => {
                        const grp = e.target.value;
                        const rates: Record<string, number> = { B: 9.5, '1': 5.25, '2': 6.30, '3': 3.15, D: 6.97 };
                        setFormData({ ...formData, tiktokGroup: grp, tiktokKomisi: rates[grp] || 5.25 });
                      }}
                    >
                      <option value="B">Grup B · Bakpia/Snack/Roti (9.5%)</option>
                      <option value="1">Grup 1 · Makanan & Sembako Umum (5.25%)</option>
                      <option value="2">Grup 2 · Kesehatan & Elektronik (6.30%)</option>
                      <option value="3">Grup 3 · Gadget & Komputer (3.15%)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Deskripsi</label>
                <textarea
                  rows={2}
                  placeholder="Detail singkat tentang kategori ini..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 text-xs font-black tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black tracking-wider shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Activity className="animate-spin" size={16} /> : <><Save size={16} /> SIMPAN</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
