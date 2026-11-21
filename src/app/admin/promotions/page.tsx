// src/app/admin/promotions/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useAdminAuth from '@/lib/hooks/useAdminAuth';
import Link from 'next/link';
import {
  Plus, Edit, Trash2, Gift, Tag, Calendar,
  AlertTriangle, Zap, Layers, Clock, ShieldCheck,
  ShieldAlert, Sparkles, ShoppingBag, DollarSign,
  BarChart3, CheckCircle2, Power, Search, Filter, RefreshCw
} from 'lucide-react';
import notify from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { sbDeleteDoc, sbGetDocs, sbInsertDoc, sbUpdateDoc } from '@/lib/supabase-helpers';
import { PromoType } from './add/page';

type Promotion = {
  id: string;
  name: string;
  type: PromoType;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetId?: string;
  targetName?: string;
  code?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  // Anti-Boncos Guardrails:
  minPurchase?: number;
  maxDiscount?: number;
  quota?: number;
  usageCount?: number;
  maxUsagePerUser?: number;
  promoStockQuota?: number;
  buyQty?: number;
  freeQty?: number;
  bundleProductIds?: string[];
  bundlePrice?: number;
  allowStacking?: boolean;
  allowLossLeader?: boolean;
  // Khusus Min. Qty (Grosir):
  minQty?: number;
  customTierPrice?: number;
  tierLabel?: string;
  tierRules?: Array<{ minQty: number; price?: number; label?: string }>;
  applyToProductTiers?: boolean;
  minQtyPricingMode?: 'fixed' | 'nominal_cut' | 'percentage';
};

const idr = (n: number) => `Rp${Math.abs(n).toLocaleString('id-ID')}`;

export default function PromotionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | PromoType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Proteksi admin
  const { authLoading, adminId } = useAdminAuth({ allowedRoles: ['admin'] as any });

  useEffect(() => {
    if (authLoading) return;
    if (adminId) {
      setLoading(false);
    }
  }, [authLoading, adminId]);

  // Helper untuk mengekstrak aturan minQty dari produk
  const extractProductMinQtyTiers = (p: any) => {
    const raw = p.raw_data || p;
    let tiers: Array<{ minQty: number; price: number; label?: string }> = [];

    if (Array.isArray(raw.priceTiers) && raw.priceTiers.length > 0) {
      tiers = raw.priceTiers
        .filter((t: any) => Number(t.minQty) > 1 && Number(t.price) > 0)
        .map((t: any) => ({
          minQty: Number(t.minQty),
          price: Number(t.price),
          label: t.label || `Opening min ${t.minQty}`,
        }))
        .sort((a: any, b: any) => a.minQty - b.minQty);
    }

    if (tiers.length === 0) {
      const grosir = Number(raw.Grosir ?? raw.wholesalePrice ?? raw.priceGrosir ?? 0);
      const minG = Number(raw.Min_Grosir ?? raw.minWholesale ?? raw.minGrosir ?? raw.minQty ?? 0);
      if (grosir > 0 && minG > 1) {
        tiers = [
          {
            minQty: minG,
            price: grosir,
            label: `Opening min ${minG}`,
          },
        ];
      }
    }

    if (tiers.length === 0 && Array.isArray(raw.units)) {
      for (const u of raw.units) {
        if (u && Number(u.minQty) > 1 && Number(u.price) > 0) {
          tiers.push({
            minQty: Number(u.minQty),
            price: Number(u.price),
            label: u.label || `Opening min ${u.minQty}`,
          });
        }
      }
      tiers.sort((a, b) => a.minQty - b.minQty);
    }

    return tiers;
  };

  // Sinkronisasi produk yang sudah memiliki minQty ke tabel promotions
  const syncMinQtyProducts = async (isManual = false) => {
    setSyncing(true);
    try {
      const [promoSnap, prodSnap] = await Promise.all([
        sbGetDocs({ table: 'promotions' }),
        sbGetDocs({ table: 'products' }),
      ]);

      const existingPromos = promoSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Promotion[];

      const existingMinQtyTargetIds = new Set(
        existingPromos
          .filter((p) => p.type === 'min-qty' && p.targetId)
          .map((p) => p.targetId)
      );

      const newlyAdded: Promotion[] = [];

      for (const d of prodSnap.docs) {
        const prodData = d.data() as any;
        const raw = prodData.raw_data || prodData;
        const prodId = d.id;
        const prodName = String(prodData.name || raw.Nama || raw.name || 'Produk');

        if (existingMinQtyTargetIds.has(prodId)) continue;

        const tiers = extractProductMinQtyTiers(prodData);
        if (tiers.length > 0) {
          const primary = tiers[0];
          const additional = tiers.slice(1);

          const promoPayload: Omit<Promotion, 'id'> = {
            name: `Opening - ${prodName}`,
            type: 'min-qty',
            discountType: 'fixed',
            discountValue: primary.price,
            customTierPrice: primary.price,
            minQty: primary.minQty,
            tierLabel: primary.label || `Opening min ${primary.minQty}`,
            tierRules: additional,
            targetId: prodId,
            targetName: prodName,
            startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
            endDate: '2099-12-31T23:59:59.000Z',
            isActive: prodData.is_active !== false && raw.isActive !== false,
            createdAt: prodData.created_at || new Date().toISOString(),
            applyToProductTiers: true,
            minQtyPricingMode: 'fixed',
          };

          try {
            const ref = await sbInsertDoc('promotions', promoPayload);
            newlyAdded.push({ id: ref.id, ...promoPayload });
            existingMinQtyTargetIds.add(prodId);
          } catch (e) {
            console.warn('Gagal insert sync promo:', e);
            // Tetap tambahkan ke in-memory jika gagal insert agar tampil di UI
            newlyAdded.push({ id: `promo_${prodId}`, ...promoPayload });
          }
        }
      }

      const allPromos = [...existingPromos, ...newlyAdded];
      allPromos.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPromotions(allPromos);

      if (isManual) {
        if (newlyAdded.length > 0) {
          notify.admin.success(`Berhasil memunculkan ${newlyAdded.length} produk program Opening Min. Qty!`);
        } else {
          notify.admin.info('Semua produk dengan Min. Qty sudah sinkron di program promosi.');
        }
      }
    } catch (err) {
      console.error('Error syncing promotions:', err);
      if (isManual) notify.admin.error('Gagal menyinkronkan produk promosi.');
    } finally {
      setSyncing(false);
    }
  };

  // Fetch promosi & auto-sync saat halaman pertama kali dimuat
  useEffect(() => {
    if (loading) return;

    syncMinQtyProducts(false);

    const channel = supabase
      .channel('admin_promotions_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promotions' },
        () => {
          sbGetDocs({ table: 'promotions' }).then((snap) => {
            const list = snap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Promotion[];
            list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setPromotions(list);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loading]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus promosi "${name}" secara permanen?`)) return;
    try {
      const promo = promotions.find(p => p.id === id);
      await sbDeleteDoc('promotions', id);
      // Jika promo bertipe min-qty dan memiliki targetId, bersihkan priceTiers di produk
      if (promo && promo.type === 'min-qty' && promo.targetId) {
        try {
          await sbUpdateDoc('products', promo.targetId, { priceTiers: [] });
        } catch {}
      }
      notify.admin.success('Promosi berhasil dihapus.');
    } catch {
      notify.admin.error('Gagal menghapus promosi.');
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      const nextActive = !promo.isActive;
      await sbUpdateDoc('promotions', promo.id, {
        isActive: nextActive,
        updatedAt: new Date().toISOString(),
      });
      // Sinkronkan status aktif ke produk jika min-qty
      if (promo.type === 'min-qty' && promo.targetId) {
        try {
          if (!nextActive) {
            await sbUpdateDoc('products', promo.targetId, { priceTiers: [] });
          } else {
            const primaryTier = {
              minQty: Number(promo.minQty || 3),
              price: Number(promo.customTierPrice || promo.discountValue || 0),
              label: promo.tierLabel || `Grosir min ${promo.minQty || 3}`,
            };
            const additional = (promo.tierRules || []).map(t => ({
              minQty: Number(t.minQty),
              price: Number(t.price || 0),
              label: t.label || `Grosir min ${t.minQty}`,
            }));
            await sbUpdateDoc('products', promo.targetId, {
              priceTiers: [primaryTier, ...additional].sort((a, b) => a.minQty - b.minQty),
            });
          }
        } catch {}
      }
      notify.admin.success(`Promosi ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch {
      notify.admin.error('Gagal mengubah status promosi');
    }
  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

  const isActiveNow = (promo: Promotion) => {
    if (!promo.isActive) return false;
    const now = new Date();
    const start = new Date(promo.startDate);
    const end = new Date(promo.endDate);
    return now >= start && now <= end;
  };

  // Metrics
  const stats = useMemo(() => {
    const total = promotions.length;
    const running = promotions.filter((p) => isActiveNow(p)).length;
    const guarded = promotions.filter(
      (p) => (p.minPurchase && p.minPurchase > 0) || (p.maxDiscount && p.maxDiscount > 0) || (p.quota && p.quota > 0)
    ).length;
    const totalUsage = promotions.reduce((s, p) => s + (p.usageCount || 0), 0);
    return { total, running, guarded, totalUsage };
  }, [promotions]);

  // Filtered List
  const filteredPromos = useMemo(() => {
    return promotions.filter((p) => {
      if (activeTab !== 'ALL' && p.type !== activeTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = p.name.toLowerCase().includes(q);
        const mCode = (p.code || '').toLowerCase().includes(q);
        const mTarget = (p.targetName || '').toLowerCase().includes(q);
        if (!mName && !mCode && !mTarget) return false;
      }
      return true;
    });
  }, [promotions, activeTab, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-slate-800 font-bold uppercase tracking-widest text-xs">
            Memuat Marketing Center...
          </p>
        </div>
      </div>
    );
  }

  const tabOptions: { id: 'ALL' | PromoType; label: string; icon: any }[] = [
    { id: 'ALL', label: 'Semua Promo', icon: Gift },
    { id: 'coupon', label: 'Kupon / Voucher', icon: Gift },
    { id: 'flash-sale', label: 'Flash Sale', icon: Zap },
    { id: 'product', label: 'Diskon Produk', icon: Tag },
    { id: 'category', label: 'Kategori', icon: Layers },
    { id: 'bundle', label: 'Bundling', icon: ShoppingBag },
    { id: 'buy-x-get-y', label: 'Beli X Gratis Y', icon: Sparkles },
    { id: 'min-purchase', label: 'Min. Belanja', icon: DollarSign },
    { id: 'min-qty', label: 'Grosir Min. Qty', icon: Layers },
  ];

  return (
    <div className="p-3 md:p-6 bg-[#F4F6FA] text-slate-800 font-sans">
      {/* Top Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200">
            <Gift size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Marketing Center & Promosi
            </h1>
            <p className="text-xs font-bold text-slate-400">
              Kelola diskon, kupon, flash sale, dan bundel dengan pengaman modal anti-boncos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMinQtyProducts(true)}
            disabled={syncing}
            className="px-4 py-2.5 bg-white text-violet-700 hover:bg-violet-50 border border-violet-200 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
            title="Pindai dan munculkan produk yang sudah disetting Min. Qty / Grosir sebagai program promosi Opening"
          >
            <RefreshCw size={15} className={`text-violet-600 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Grosir Min. Qty'}</span>
          </button>
          <Link
            href="/admin/reports/promotions"
            className="px-4 py-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-black transition-all flex items-center gap-2"
          >
            <BarChart3 size={15} className="text-emerald-600" />
            <span>Laporan Efektivitas</span>
          </Link>
          <Link
            href="/admin/promotions/add"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span>Buat Promo Baru</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100 flex items-center gap-3 text-xs font-bold">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Total Program</p>
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600"><Gift size={14} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900">{stats.total}</p>
          <p className="text-xs font-bold text-slate-400 mt-0.5">Semua jenis promosi</p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Sedang Berjalan</p>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600"><Clock size={14} /></div>
          </div>
          <p className="text-2xl font-black text-emerald-600">{stats.running}</p>
          <p className="text-xs font-bold text-emerald-600/70 mt-0.5">Aktif dan dalam periode</p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Proteksi Anti-Boncos</p>
            <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><ShieldCheck size={14} /></div>
          </div>
          <p className="text-2xl font-black text-blue-600">{stats.guarded}</p>
          <p className="text-xs font-bold text-slate-400 mt-0.5">Dibatasi Min. Belanja/Cap</p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Total Penggunaan</p>
            <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600"><CheckCircle2 size={14} /></div>
          </div>
          <p className="text-2xl font-black text-purple-600">{stats.totalUsage}</p>
          <p className="text-xs font-bold text-slate-400 mt-0.5">Kali promo ditukarkan</p>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {tabOptions.map((t) => {
            const Icon = t.icon;
            const isSelected = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={13} />
                <span>{t.label}</span>
                {t.id !== 'ALL' && promotions.some((p) => p.type === t.id) && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {promotions.filter((p) => p.type === t.id).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau kode promo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* PROMOTIONS LIST (Desktop Table + Mobile Cards) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-800 text-sm">Daftar Program Promosi</h3>
          <span className="text-xs font-bold text-slate-400">{filteredPromos.length} program ditemukan</span>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredPromos.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold text-xs">
              Tidak ada program promosi di kategori ini
            </div>
          ) : (
            filteredPromos.map((promo) => {
              const expired = isExpired(promo.endDate);
              const activeNow = isActiveNow(promo);

              return (
                <div key={promo.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{promo.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase ${
                          promo.type === 'min-qty' ? 'bg-violet-100 text-violet-800 border border-violet-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {promo.type === 'min-qty' ? 'Grosir Min. Qty' : promo.type}
                        </span>
                        {promo.code && (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-purple-50 text-purple-700 border border-purple-200">
                            {promo.code}
                          </span>
                        )}
                      </div>
                    </div>
                    {expired ? (
                      <span className="px-2 py-0.5 text-xs font-black bg-rose-50 text-rose-600 rounded-lg">
                        Kedaluwarsa
                      </span>
                    ) : activeNow ? (
                      <span className="px-2 py-0.5 text-xs font-black bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Berjalan
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-black bg-orange-50 text-orange-600 rounded-lg">
                        Terjadwal
                      </span>
                    )}
                  </div>

                  {/* Guardrail Badges */}
                  <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg">
                      {promo.type === 'min-qty'
                        ? `Beli Min. ${promo.minQty || 3} pcs → ${promo.customTierPrice ? idr(promo.customTierPrice) : (promo.discountType === 'percentage' ? `${promo.discountValue}%` : idr(promo.discountValue))}`
                        : promo.type === 'buy-x-get-y'
                        ? `Beli ${promo.buyQty || 2} Gratis ${promo.freeQty || 1}`
                        : `Potongan: ${promo.discountType === 'percentage' ? `${promo.discountValue}%` : idr(promo.discountValue)}`}
                    </span>
                    {promo.minPurchase ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg">
                        Min: {idr(promo.minPurchase)}
                      </span>
                    ) : null}
                    {promo.maxDiscount ? (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg">
                        Cap: {idr(promo.maxDiscount)}
                      </span>
                    ) : null}
                    {promo.quota ? (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">
                        Kuota: {promo.usageCount || 0}/{promo.quota}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-xs">
                    <button
                      onClick={() => handleToggleActive(promo)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 ${
                        promo.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Power size={12} />
                      <span>{promo.isActive ? 'Aktif' : 'Non-Aktif'}</span>
                    </button>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/promotions/edit/${promo.id}`}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl"
                      >
                        <Edit size={14} />
                      </Link>
                      <button
                        onClick={() => handleDelete(promo.id, promo.name)}
                        className="p-2 bg-rose-50 text-rose-600 rounded-xl"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/70">
              <tr>
                {['Program Promosi', 'Model & Target', 'Diskon', 'Pengaman Finansial (Guardrail)', 'Periode', 'Status', 'Aksi'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-xs font-black uppercase tracking-widest text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPromos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 font-bold text-xs">
                    Tidak ada program promosi yang sesuai filter
                  </td>
                </tr>
              ) : (
                filteredPromos.map((promo) => {
                  const expired = isExpired(promo.endDate);
                  const activeNow = isActiveNow(promo);

                  return (
                    <tr key={promo.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-xs font-black text-slate-900">{promo.name}</div>
                        {promo.code && (
                          <div className="mt-1">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-black bg-purple-50 text-purple-700 border border-purple-200">
                              KODE: {promo.code}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black uppercase ${
                            promo.type === 'min-qty' ? 'bg-violet-100 text-violet-800 border border-violet-200' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {promo.type === 'min-qty' ? 'Grosir Min. Qty' : promo.type}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-500 mt-1 line-clamp-1">
                          {promo.targetName || (promo.type === 'coupon' ? 'Semua Belanja' : '—')}
                        </p>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-black ${promo.type === 'min-qty' ? 'text-violet-700' : 'text-emerald-600'}`}>
                          {promo.type === 'min-qty' ? (
                            <span>
                              Min. {promo.minQty || 3} pcs → {promo.customTierPrice ? idr(promo.customTierPrice) : (promo.discountType === 'percentage' ? `${promo.discountValue}%` : idr(promo.discountValue))}
                            </span>
                          ) : promo.type === 'buy-x-get-y' ? (
                            `Beli ${promo.buyQty || 2} Gratis ${promo.freeQty || 1}`
                          ) : promo.discountType === 'percentage' ? (
                            `${promo.discountValue}%`
                          ) : (
                            idr(promo.discountValue)
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 text-xs">
                          {promo.type === 'min-qty' && (
                            <span className="text-violet-700 font-bold">
                              ⚡ {promo.tierLabel || `Grosir min ${promo.minQty || 3}`}
                              {promo.tierRules && promo.tierRules.length > 0 && ` (+${promo.tierRules.length} tier)`}
                            </span>
                          )}
                          {promo.minPurchase && promo.minPurchase > 0 ? (
                            <span className="text-blue-700 font-bold">🛡️ Min. Belanja {idr(promo.minPurchase)}</span>
                          ) : (
                            <span className="text-slate-400">Tanpa min. belanja</span>
                          )}
                          {promo.maxDiscount && promo.maxDiscount > 0 ? (
                            <span className="text-indigo-700 font-bold">🛑 Max Potongan {idr(promo.maxDiscount)}</span>
                          ) : null}
                          {promo.quota && promo.quota > 0 ? (
                            <span className="text-slate-600 font-bold">
                              👥 Kuota: {promo.usageCount || 0}/{promo.quota} terpakai
                            </span>
                          ) : null}
                          {promo.type === 'flash-sale' && promo.promoStockQuota ? (
                            <span className="text-orange-600 font-bold">
                              ⚡ Stok Flash Sale: {promo.promoStockQuota} pcs
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="text-xs font-bold text-slate-500">
                          <div>{new Date(promo.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
                          <div className="text-slate-400">s/d {new Date(promo.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {expired ? (
                          <span className="px-2 py-1 text-xs font-black bg-rose-50 text-rose-600 rounded-lg">
                            Kedaluwarsa
                          </span>
                        ) : activeNow ? (
                          <span className="px-2 py-1 text-xs font-black bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            Berjalan
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-black bg-orange-50 text-orange-600 rounded-lg">
                            Terjadwal
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleActive(promo)}
                            className={`p-2 rounded-xl transition-colors ${
                              promo.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                            }`}
                            title={promo.isActive ? 'Non-aktifkan' : 'Aktifkan'}
                          >
                            <Power size={15} />
                          </button>
                          <Link
                            href={`/admin/promotions/edit/${promo.id}`}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors"
                            title="Edit Program"
                          >
                            <Edit size={15} />
                          </Link>
                          <button
                            onClick={() => handleDelete(promo.id, promo.name)}
                            className="p-2 hover:bg-rose-50 text-rose-600 rounded-xl transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
