// src/app/admin/promotions/add/page.tsx
'use client';

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Gift, Tag, Percent, Zap, Layers, ShoppingBag,
  AlertTriangle, ShieldCheck, ShieldAlert, Sparkles,
  Check, ArrowLeft, Plus, Trash2, Clock, Calendar,
  HelpCircle, AlertCircle, TrendingDown, DollarSign
} from 'lucide-react';
import notify from '@/lib/notify';
import {
  addDoc, auth, collection, db, doc, getDoc,
  getDocs, onAuthStateChanged, updateDoc
} from '@/lib/firebase';
import { isAdminRole } from '@/lib/auth-helpers';

/* ================= TYPES ================= */

export type PromoType =
  | 'product'
  | 'category'
  | 'coupon'
  | 'flash-sale'
  | 'bundle'
  | 'buy-x-get-y'
  | 'min-purchase';

export type PromotionData = {
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
  // Anti-Boncos Guardrails:
  minPurchase?: number;       // Minimal belanja (Rp)
  maxDiscount?: number;       // Maksimal potongan (Rp)
  quota?: number;             // Kuota pemakaian total
  usageCount?: number;        // Jumlah pemakaian
  maxUsagePerUser?: number;   // Batas per user
  promoStockQuota?: number;   // Batas kuota stok (khusus flash sale)
  buyQty?: number;            // Beli X
  freeQty?: number;           // Gratis Y
  bundleProductIds?: string[];// Produk paket bundle
  bundlePrice?: number;       // Harga khusus paket bundle
  allowStacking?: boolean;    // Boleh ditumpuk promo lain
  allowLossLeader?: boolean;  // Konfirmasi jika sengaja jual rugi
};

type Product = {
  id: string;
  name: string;
  category?: string;
  price: number;
  costPrice: number;
  stock: number;
  imageUrl?: string;
};

const idr = (n: number) => `Rp${Math.abs(n).toLocaleString('id-ID')}`;

const getInitialPromotion = (): PromotionData => {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    name: '',
    type: 'product',
    discountType: 'percentage',
    discountValue: 10,
    startDate: now.toISOString().split('T')[0],
    endDate: nextWeek.toISOString().split('T')[0],
    isActive: true,
    minPurchase: 0,
    maxDiscount: 0,
    quota: 100,
    usageCount: 0,
    maxUsagePerUser: 1,
    promoStockQuota: 20,
    buyQty: 2,
    freeQty: 1,
    bundleProductIds: [],
    bundlePrice: 0,
    allowStacking: false,
    allowLossLeader: false,
  };
};

function AddPromotionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromotionData>(getInitialPromotion());
  const [saving, setSaving] = useState(false);

  /* ================= LOAD MASTER DATA ================= */

  const loadSupportingData = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: String(data.name || data.Nama || 'Produk'),
          category: String(data.category || data.Kategori || 'Umum'),
          price: Number(data.priceEcer ?? data.price ?? data.Ecer ?? 0),
          costPrice: Number(data.Modal ?? data.purchasePrice ?? data.costPrice ?? data.modal ?? 0),
          stock: Number(data.stock ?? data.Stok ?? 0),
          imageUrl: String(data.imageUrl || data.image || data.Link_Foto || ''),
        };
      });

      setProducts(list);
      const uniqueCategories = new Set(list.map((p) => p.category).filter(Boolean));
      setCategories(Array.from(uniqueCategories) as string[]);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }, []);

  /* ================= AUTH & INIT ================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || !isAdminRole(userDoc.data()?.role)) {
        notify.admin.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      await loadSupportingData();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, loadSupportingData]);

  /* ================= LOAD EDIT DATA ================= */

  useEffect(() => {
    if (!editId) return;

    const loadPromotion = async () => {
      try {
        const snap = await getDoc(doc(db, 'promotions', editId));
        if (snap.exists()) {
          const d = snap.data() as any;
          setFormData({
            name: d.name || '',
            type: d.type || 'product',
            discountType: d.discountType || 'percentage',
            discountValue: Number(d.discountValue || 0),
            targetId: d.targetId || '',
            targetName: d.targetName || '',
            code: d.code || '',
            startDate: d.startDate || '',
            endDate: d.endDate || '',
            isActive: d.isActive !== undefined ? d.isActive : true,
            minPurchase: Number(d.minPurchase || 0),
            maxDiscount: Number(d.maxDiscount || 0),
            quota: Number(d.quota || 0),
            usageCount: Number(d.usageCount || 0),
            maxUsagePerUser: Number(d.maxUsagePerUser || 1),
            promoStockQuota: Number(d.promoStockQuota || 0),
            buyQty: Number(d.buyQty || 2),
            freeQty: Number(d.freeQty || 1),
            bundleProductIds: Array.isArray(d.bundleProductIds) ? d.bundleProductIds : [],
            bundlePrice: Number(d.bundlePrice || 0),
            allowStacking: Boolean(d.allowStacking),
            allowLossLeader: Boolean(d.allowLossLeader),
          });
        }
      } catch (err) {
        console.error('Error loading promo:', err);
      }
    };

    loadPromotion();
  }, [editId]);

  /* ================= HANDLERS ================= */

  const handleTypeChange = (type: PromoType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      targetId: undefined,
      targetName: undefined,
      code: type === 'coupon' ? `HEMAT${Date.now().toString().slice(-4)}` : undefined,
    }));
  };

  // Selected product for single product/flash sale simulation
  const selectedProduct = useMemo(() => {
    if (formData.targetId && (formData.type === 'product' || formData.type === 'flash-sale')) {
      return products.find((p) => p.id === formData.targetId);
    }
    return null;
  }, [formData.targetId, formData.type, products]);

  // Real-Time Profit & Margin Simulator
  const marginSimulation = useMemo(() => {
    if (!selectedProduct) return null;

    const normalPrice = selectedProduct.price;
    const modalHPP = selectedProduct.costPrice;

    let promoPrice = normalPrice;
    let potongDiskon = 0;

    if (formData.discountType === 'percentage') {
      potongDiskon = (normalPrice * formData.discountValue) / 100;
      if (formData.maxDiscount && formData.maxDiscount > 0) {
        potongDiskon = Math.min(potongDiskon, formData.maxDiscount);
      }
      promoPrice = Math.max(0, normalPrice - potongDiskon);
    } else {
      potongDiskon = formData.discountValue;
      promoPrice = Math.max(0, normalPrice - potongDiskon);
    }

    const labaBersihPerUnit = promoPrice - modalHPP;
    const marginPersen = promoPrice > 0 ? (labaBersihPerUnit / promoPrice) * 100 : 0;
    const isBoncos = labaBersihPerUnit < 0;
    const isMarginTipis = !isBoncos && marginPersen < 10;

    return {
      normalPrice,
      modalHPP,
      potongDiskon,
      promoPrice,
      labaBersihPerUnit,
      marginPersen,
      isBoncos,
      isMarginTipis,
    };
  }, [selectedProduct, formData.discountType, formData.discountValue, formData.maxDiscount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Nama program promosi wajib diisi');
      return;
    }

    // Validation per type
    if (formData.type !== 'bundle' && formData.type !== 'buy-x-get-y') {
      if (formData.discountValue <= 0) {
        setError('Nilai diskon harus lebih dari 0');
        return;
      }
      if (formData.discountType === 'percentage' && formData.discountValue > 100) {
        setError('Diskon persentase tidak boleh lebih dari 100%');
        return;
      }
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setError('Tanggal berakhir harus setelah tanggal mulai');
      return;
    }

    // Target checks
    if ((formData.type === 'product' || formData.type === 'flash-sale') && !formData.targetId) {
      setError('Silakan pilih produk yang ingin dipromosikan');
      return;
    }

    if (formData.type === 'category' && !formData.targetName) {
      setError('Silakan pilih kategori produk yang ingin dipromosikan');
      return;
    }

    if (formData.type === 'coupon' && !formData.code?.trim()) {
      setError('Kode kupon/voucher tidak boleh kosong');
      return;
    }

    // Anti-boncos confirmation
    if (marginSimulation?.isBoncos && !formData.allowLossLeader) {
      setError(
        `PERINGATAN BONCOS: Harga diskon (Rp${marginSimulation.promoPrice.toLocaleString('id-ID')}) di bawah Modal HPP (Rp${marginSimulation.modalHPP.toLocaleString('id-ID')}). Anda akan rugi Rp${Math.abs(marginSimulation.labaBersihPerUnit).toLocaleString('id-ID')} per pcs! Centang persetujuan di bawah jika ini disengaja sebagai strategi pancingan (Loss Leader).`
      );
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        type: formData.type,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue || 0),
        targetId: formData.targetId || null,
        targetName: formData.targetName || null,
        code: formData.code ? formData.code.toUpperCase().trim() : null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isActive: formData.isActive,
        minPurchase: Number(formData.minPurchase || 0),
        maxDiscount: Number(formData.maxDiscount || 0),
        quota: Number(formData.quota || 0),
        usageCount: Number(formData.usageCount || 0),
        maxUsagePerUser: Number(formData.maxUsagePerUser || 1),
        promoStockQuota: Number(formData.promoStockQuota || 0),
        buyQty: Number(formData.buyQty || 2),
        freeQty: Number(formData.freeQty || 1),
        bundleProductIds: formData.bundleProductIds || [],
        bundlePrice: Number(formData.bundlePrice || 0),
        allowStacking: Boolean(formData.allowStacking),
        allowLossLeader: Boolean(formData.allowLossLeader),
        updatedAt: new Date().toISOString(),
      };

      if (editId) {
        await updateDoc(doc(db, 'promotions', editId), payload);
        notify.admin.success('Program promosi berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'promotions'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        notify.admin.success('Program promosi berhasil diterbitkan!');
      }

      router.push('/admin/promotions');
    } catch (err) {
      console.error('Error saving promo:', err);
      notify.admin.error('Gagal menyimpan promosi');
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto" />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Memuat Formulir Promosi...</p>
        </div>
      </div>
    );
  }

  const promoTypeOptions: { id: PromoType; label: string; desc: string; icon: any; color: string }[] = [
    { id: 'product', label: 'Diskon Produk', desc: 'Potongan harga untuk produk tunggal', icon: Tag, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'flash-sale', label: 'Flash Sale Kilat', desc: 'Waktu terbatas dengan kuota stok', icon: Zap, color: 'text-orange-600 bg-orange-50 border-orange-200' },
    { id: 'coupon', label: 'Kupon / Voucher', desc: 'Kode promo dengan min. belanja & cap', icon: Gift, color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { id: 'category', label: 'Diskon Kategori', desc: 'Berlaku untuk seluruh kategori produk', icon: Layers, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    { id: 'bundle', label: 'Paket Bundling', desc: 'Beli paket beberapa produk lebih hemat', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'buy-x-get-y', label: 'Beli X Gratis Y', desc: 'Beli 2 gratis 1 atau hadiah gratis', icon: Sparkles, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { id: 'min-purchase', label: 'Min. Belanja', desc: 'Diskon jika belanja mencapai target Rp', icon: DollarSign, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  ];

  return (
    <div className="p-3 md:p-6 bg-[#F4F6FA] min-h-screen text-slate-800 font-sans pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/promotions" className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              {editId ? 'Edit Program Promosi' : 'Buat Program Promosi Baru'}
            </h1>
            <p className="text-[11px] font-bold text-slate-400">
              Dilengkapi pengaman modal (HPP) & guardrail anti-boncos
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black border border-emerald-100">
          <ShieldCheck size={14} />
          <span>Anti-Boncos Active</span>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 text-xs font-bold leading-relaxed animate-in fade-in">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-rose-600" />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
        {/* SECTION 1: TIPE PROMO */}
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={16} className="text-emerald-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Pilih Model Promosi</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {promoTypeOptions.map((t) => {
              const Icon = t.icon;
              const isSelected = formData.type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
                  className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-xl ${t.color}`}><Icon size={16} /></div>
                    {isSelected && <Check size={16} className="text-emerald-600" />}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900">{t.label}</h3>
                    <p className="text-[10px] text-slate-400 font-medium line-clamp-2 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: INFORMASI DASAR & TARGET */}
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Gift size={16} className="text-emerald-600" />Informasi Program
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Program Promosi *</label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Flash Sale Gajian Krupuk Mentah 20%"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Target Selector */}
            {(formData.type === 'product' || formData.type === 'flash-sale') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Produk Target *</label>
                <select
                  required
                  value={formData.targetId || ''}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const pr = products.find((p) => p.id === pid);
                    setFormData({ ...formData, targetId: pid, targetName: pr?.name || '' });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Pilih Produk...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — Harga: {idr(p.price)} | Modal: {idr(p.costPrice)} | Stok: {p.stock}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.type === 'category' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Kategori Produk *</label>
                <select
                  required
                  value={formData.targetName || ''}
                  onChange={(e) => setFormData({ ...formData, targetName: e.target.value, targetId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">Pilih Kategori...</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.type === 'coupon' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Voucher / Kupon *</label>
                <div className="relative">
                  <input
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="HEMAT50 / GAJIAN"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black font-mono text-emerald-700 uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                    Hanya huruf & angka
                  </span>
                </div>
              </div>
            )}

            {/* Khusus Beli X Gratis Y */}
            {formData.type === 'buy-x-get-y' && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-amber-50/50 rounded-2xl border border-amber-200">
                <div>
                  <label className="block text-[11px] font-black text-amber-800 mb-1">Jumlah Beli (X)</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.buyQty || 2}
                    onChange={(e) => setFormData({ ...formData, buyQty: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-amber-800 mb-1">Jumlah Gratis (Y)</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.freeQty || 1}
                    onChange={(e) => setFormData({ ...formData, freeQty: Math.max(1, Number(e.target.value)) })}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: SKEMA DISKON & SIMULATOR HPP */}
        {formData.type !== 'buy-x-get-y' && (
          <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Percent size={16} className="text-emerald-600" />Skema Potongan Harga
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Diskon</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="percentage">Persentase (%)</option>
                  <option value="fixed">Nominal Tetap (Rp)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nilai Diskon ({formData.discountType === 'percentage' ? '%' : 'Rp'}) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={formData.discountType === 'percentage' ? 100 : undefined}
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* LIVE HPP & MARGIN SIMULATOR WIDGET */}
            {marginSimulation && (
              <div className={`mt-4 p-4 rounded-2xl border transition-all ${
                marginSimulation.isBoncos
                  ? 'bg-rose-50/90 border-rose-300'
                  : marginSimulation.isMarginTipis
                  ? 'bg-amber-50/80 border-amber-300'
                  : 'bg-emerald-50/80 border-emerald-200'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {marginSimulation.isBoncos ? (
                      <ShieldAlert className="text-rose-600 flex-shrink-0" size={20} />
                    ) : marginSimulation.isMarginTipis ? (
                      <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
                    ) : (
                      <ShieldCheck className="text-emerald-600 flex-shrink-0" size={20} />
                    )}
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-tight">
                        {marginSimulation.isBoncos
                          ? '🚨 BAHAYA BONCOS: Harga Diskon di Bawah Modal (HPP)!'
                          : marginSimulation.isMarginTipis
                          ? '⚠️ PERHATIAN: Margin Sangat Tipis (< 10%)'
                          : '✅ PROFIT AMAN: Margin Sehat & Terkendali'}
                      </h4>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                        Simulasi langsung berdasarkan data modal produk di gudang
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                    marginSimulation.isBoncos
                      ? 'bg-rose-600 text-white'
                      : marginSimulation.isMarginTipis
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    Margin {marginSimulation.marginPersen.toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-black/5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Harga Normal</span>
                    <strong className="text-slate-800">{idr(marginSimulation.normalPrice)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Modal Produk (HPP)</span>
                    <strong className="text-slate-800">{idr(marginSimulation.modalHPP)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Harga Setelah Diskon</span>
                    <strong className="text-blue-600">{idr(marginSimulation.promoPrice)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block">Laba Bersih / Pcs</span>
                    <strong className={marginSimulation.isBoncos ? 'text-rose-600' : 'text-emerald-600'}>
                      {marginSimulation.isBoncos ? '−' : '+'}{idr(marginSimulation.labaBersihPerUnit)}
                    </strong>
                  </div>
                </div>

                {marginSimulation.isBoncos && (
                  <label className="mt-3 pt-3 border-t border-rose-200 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowLossLeader || false}
                      onChange={(e) => setFormData({ ...formData, allowLossLeader: e.target.checked })}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-[11px] font-bold text-rose-800">
                      Saya sadar dan mengonfirmasi ini adalah strategi <em>Loss Leader</em> (diskon di bawah modal untuk pancingan pelanggan baru).
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: PENGAMAN FINANSIAL (GUARDRAILS ANTI-BONCOS) */}
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />Pengaman Finansial (Anti-Boncos)
            </h2>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
              Kunci Profit Toko
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Min Purchase */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Minimal Pembelian (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={formData.minPurchase || 0}
                onChange={(e) => setFormData({ ...formData, minPurchase: Number(e.target.value) })}
                placeholder="0 = Tanpa minimal"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Contoh: Min. Rp50.000 baru kupon aktif</span>
            </div>

            {/* Max Discount Cap (Crucial for Percentage) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Maksimal Potongan (Cap Rp)
              </label>
              <input
                type="number"
                min={0}
                value={formData.maxDiscount || 0}
                onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                placeholder="0 = Tanpa batas"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Cegah borongan diskon jutaan rupiah</span>
            </div>

            {/* Quota Total */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Total Kuota Penggunaan
              </label>
              <input
                type="number"
                min={0}
                value={formData.quota || 0}
                onChange={(e) => setFormData({ ...formData, quota: Number(e.target.value) })}
                placeholder="Contoh: 100 pengguna"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Habis kuota promo otomatis berakhir</span>
            </div>

            {/* Max per user */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batas Penggunaan per User
              </label>
              <input
                type="number"
                min={1}
                value={formData.maxUsagePerUser || 1}
                onChange={(e) => setFormData({ ...formData, maxUsagePerUser: Math.max(1, Number(e.target.value)) })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Mencegah reseller mengeksploitasi promo</span>
            </div>

            {/* Khusus Flash Sale: Kuota Stok Promo */}
            {formData.type === 'flash-sale' && (
              <div>
                <label className="block text-xs font-bold text-orange-700 mb-1">
                  Kuota Stok Flash Sale (Pcs) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.promoStockQuota || 20}
                  onChange={(e) => setFormData({ ...formData, promoStockQuota: Math.max(1, Number(e.target.value)) })}
                  className="w-full px-3.5 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs font-black text-orange-900 outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-[10px] text-orange-600 mt-1 block">Setelah 20 pcs habis, harga kembali normal</span>
              </div>
            )}
          </div>

          {/* Anti-Stacking Checkbox */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-800">Proteksi Anti-Stacking (Cegah Diskon Bertumpuk)</p>
              <p className="text-[10px] text-slate-400 font-medium">
                Jika diaktifkan, promo ini tidak dapat digabung dengan kupon lain atau harga grosir
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!formData.allowStacking}
                onChange={(e) => setFormData({ ...formData, allowStacking: !e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>
        </div>

        {/* SECTION 5: PERIODE & STATUS AKTIF */}
        <div className="bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Calendar size={16} className="text-emerald-600" />Periode Pelaksanaan
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Selesai *</label>
              <input
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs font-bold text-slate-800">Aktifkan promosi ini sekarang</span>
          </label>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/admin/promotions')}
            className="px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-200 transition-all flex items-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={16} />
            )}
            <span>{editId ? 'Perbarui Program' : 'Terbitkan Program'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AddPromotionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold">Memuat...</div>}>
      <AddPromotionContent />
    </Suspense>
  );
}
