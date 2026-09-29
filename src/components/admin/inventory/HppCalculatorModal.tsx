'use client';

import React, { useState, useMemo } from 'react';
import {
  X, Calculator, ArrowRight, Check, Sparkles, TrendingUp,
  Package, DollarSign, Layers, BookOpen, RefreshCw, AlertCircle,
  HelpCircle, Copy
} from 'lucide-react';
import notify from '@/lib/notify';
import { updateProduct } from '@/lib/actions/product.actions';

export interface HppCalculatorProduct {
  id: string;
  name: string;
  sku?: string;
  unit?: string;
  stock?: number;
  costPrice?: number;
  price?: number;
}

interface HppCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: HppCalculatorProduct[];
  onProductUpdated?: () => void;
  defaultProductId?: string;
}

type TabMode = 'GROSIR_CONVERT' | 'MOVING_AVERAGE' | 'GUIDE';

export default function HppCalculatorModal({
  isOpen,
  onClose,
  products = [],
  onProductUpdated,
  defaultProductId,
}: HppCalculatorModalProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('GROSIR_CONVERT');
  const [selectedProductId, setSelectedProductId] = useState<string>(defaultProductId || '');
  const [saving, setSaving] = useState(false);

  // --- State Skema 1: Konversi Grosir / Kartonan ---
  const [satuanBeli, setSatuanBeli] = useState('Karton / Dus');
  const [hargaBeliGrosir, setHargaBeliGrosir] = useState<number | ''>(120000);
  const [isiPcs, setIsiPcs] = useState<number | ''>(24);
  const [ongkirPerDus, setOngkirPerDus] = useState<number | ''>(2000);
  const [diskonPerDus, setDiskonPerDus] = useState<number | ''>(0);
  const [targetMarginPct, setTargetMarginPct] = useState<number>(15);
  const [roundingRule, setRoundingRule] = useState<'NONE' | '500' | '1000'>('500');

  // --- State Skema 2: Moving Average (Rata-rata Bergerak) ---
  const [stokLama, setStokLama] = useState<number | ''>(10);
  const [hppLama, setHppLama] = useState<number | ''>(5000);
  const [stokBaru, setStokBaru] = useState<number | ''>(20);
  const [hargaBeliBaru, setHargaBeliBaru] = useState<number | ''>(5600);

  // Load product data when selected
  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find(x => x.id === prodId);
    if (p) {
      if (p.costPrice && p.costPrice > 0) {
        setHppLama(p.costPrice);
      }
      if (p.stock !== undefined) {
        setStokLama(p.stock);
      }
    }
  };

  // --- Perhitungan Skema 1: Konversi Kartonan ---
  const calcGrosir = useMemo(() => {
    const beli = Number(hargaBeliGrosir || 0);
    const isi = Number(isiPcs || 1);
    const ongkir = Number(ongkirPerDus || 0);
    const diskon = Number(diskonPerDus || 0);

    const totalModalDus = Math.max(0, beli + ongkir - diskon);
    const hppPerPcsExact = isi > 0 ? totalModalDus / isi : 0;
    const hppPerPcs = Math.round(hppPerPcsExact);

    // Target harga jual
    let rawJual = 0;
    if (targetMarginPct < 100 && targetMarginPct >= 0 && hppPerPcs > 0) {
      // Rumus Margin: Margin% = (Harga Jual - Modal) / Harga Jual -> Jual = Modal / (1 - Margin%)
      rawJual = hppPerPcs / (1 - targetMarginPct / 100);
    } else {
      rawJual = hppPerPcs * 1.15;
    }

    // Pembulatan
    let hargaJualBulat = Math.round(rawJual);
    if (roundingRule === '500') {
      hargaJualBulat = Math.ceil(rawJual / 500) * 500;
    } else if (roundingRule === '1000') {
      hargaJualBulat = Math.ceil(rawJual / 1000) * 1000;
    }

    const marginRp = Math.max(0, hargaJualBulat - hppPerPcs);
    const marginRealPct = hargaJualBulat > 0 ? (marginRp / hargaJualBulat) * 100 : 0;
    const totalUntungDus = marginRp * isi;

    return {
      totalModalDus,
      hppPerPcsExact,
      hppPerPcs,
      rawJual,
      hargaJualBulat,
      marginRp,
      marginRealPct,
      totalUntungDus,
    };
  }, [hargaBeliGrosir, isiPcs, ongkirPerDus, diskonPerDus, targetMarginPct, roundingRule]);

  // --- Perhitungan Skema 2: Moving Average ---
  const calcMovingAvg = useMemo(() => {
    const qLama = Math.max(0, Number(stokLama || 0));
    const cLama = Math.max(0, Number(hppLama || 0));
    const qBaru = Math.max(0, Number(stokBaru || 0));
    const cBaru = Math.max(0, Number(hargaBeliBaru || 0));

    const totalQty = qLama + qBaru;
    const valLama = qLama * cLama;
    const valBaru = qBaru * cBaru;
    const totalVal = valLama + valBaru;

    const newAvgCost = totalQty > 0 ? Math.round(totalVal / totalQty) : cBaru;
    const diffRp = newAvgCost - cLama;
    const diffPct = cLama > 0 ? ((newAvgCost - cLama) / cLama) * 100 : 0;

    return {
      qLama,
      cLama,
      qBaru,
      cBaru,
      totalQty,
      valLama,
      valBaru,
      totalVal,
      newAvgCost,
      diffRp,
      diffPct,
    };
  }, [stokLama, hppLama, stokBaru, hargaBeliBaru]);

  // Simpan hasil ke produk terpilih
  const handleApplyToProduct = async (cost: number, price?: number) => {
    if (!selectedProductId) {
      notify.error('Pilih produk terlebih dahulu di bagian atas.');
      return;
    }
    setSaving(true);
    try {
      const res = await updateProduct(selectedProductId, {
        costPrice: cost,
        sellPrice: price,
      });

      if (res.success) {
        notify.success(`HPP berhasil diupdate ke Rp ${cost.toLocaleString('id-ID')}${price ? ` & Harga Jual Rp ${price.toLocaleString('id-ID')}` : ''}`);
        if (onProductUpdated) onProductUpdated();
      } else {
        notify.error(res.error || 'Gagal menyimpan harga ke produk');
      }
    } catch (err: any) {
      notify.error(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notify.success(`${label} disalin ke clipboard!`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <Calculator size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">Skema Penentuan HPP & Harga Modal</h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Kalkulator Cerdas
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Hitung modal per pcs dari kulakan kartonan atau rata-rata moving average secara akurat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Product Picker (Optional linking) */}
        {products.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Package size={14} className="text-blue-600 shrink-0" />
              <span>Terapkan ke Produk (Opsional):</span>
            </div>
            <select
              value={selectedProductId}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
            >
              <option value="">-- Hitung Bebas (Tanpa Pilih Produk) --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.costPrice ? `(HPP: Rp ${p.costPrice.toLocaleString()})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-5 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('GROSIR_CONVERT')}
            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'GROSIR_CONVERT'
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <Layers size={14} />
            1. Konversi Dus / Grosir &rarr; Pcs
          </button>
          <button
            onClick={() => setActiveTab('MOVING_AVERAGE')}
            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'MOVING_AVERAGE'
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <TrendingUp size={14} />
            2. Moving Average (Kulakan Baru)
          </button>
          <button
            onClick={() => setActiveTab('GUIDE')}
            className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'GUIDE'
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <BookOpen size={14} />
            3. Panduan & Aturan Margin
          </button>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: KONVERSI GROSIR */}
          {activeTab === 'GROSIR_CONVERT' && (
            <div className="space-y-6">
              <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl text-xs text-blue-900 flex items-start gap-2.5">
                <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black">Skema Konversi Satuan:</span> Digunakan saat membeli barang dari supplier per Karton/Dus/Bal/Karung/Lusin dan akan dijual eceran per Pcs/Bungkus. Rumus otomatis membagi harga beli + biaya ongkir - diskon dengan total isi.
                </div>
              </div>

              {/* Form Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">Satuan Pembelian</label>
                  <select
                    value={satuanBeli}
                    onChange={e => setSatuanBeli(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Karton / Dus">Karton / Dus</option>
                    <option value="Bal">Bal</option>
                    <option value="Karung / Sak">Karung / Sak</option>
                    <option value="Slop">Slop</option>
                    <option value="Renceng">Renceng</option>
                    <option value="Lusin (12 pcs)">Lusin (12 pcs)</option>
                    <option value="Kodi (20 pcs)">Kodi (20 pcs)</option>
                    <option value="Pack">Pack</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">
                    Harga Beli per {satuanBeli} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={hargaBeliGrosir}
                      onChange={e => setHargaBeliGrosir(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="120000"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">
                    Isi Satuan Dasar (Pcs/Bks) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={isiPcs}
                    onChange={e => setIsiPcs(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="24"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Contoh: 1 Dus isi 24 pcs, 1 Slop isi 10 bks</span>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">
                    Ongkir / Biaya Angkut per {satuanBeli}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={ongkirPerDus}
                      onChange={e => setOngkirPerDus(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">
                    Diskon / Cashback per {satuanBeli}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={diskonPerDus}
                      onChange={e => setDiskonPerDus(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase mb-1">
                    Aturan Pembulatan Harga Jual
                  </label>
                  <select
                    value={roundingRule}
                    onChange={e => setRoundingRule(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="500">Bulat ke Rp 500 terdekat (Sangat Disarankan)</option>
                    <option value="1000">Bulat ke Rp 1.000 terdekat</option>
                    <option value="NONE">Sesuai Perhitungan (Tanpa Dibulatkan)</option>
                  </select>
                </div>
              </div>

              {/* Target Margin Buttons */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-1.5">
                  Target Margin Keuntungan (% dari Harga Jual):
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[5, 8, 10, 12, 15, 20, 25].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTargetMarginPct(pct)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        targetMarginPct === pct
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {pct}% {pct === 15 ? '★ Standar' : ''}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl">
                    <input
                      type="number"
                      value={targetMarginPct}
                      onChange={e => setTargetMarginPct(Number(e.target.value))}
                      className="w-12 bg-transparent text-xs font-black text-center outline-none"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>
              </div>

              {/* HASIL PERHITUNGAN KARTONAN */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl text-white shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <span className="text-xs font-black uppercase tracking-widest text-blue-400">
                    Hasil Kalkulasi HPP & Harga Jual
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Total Modal 1 {satuanBeli}: Rp {calcGrosir.totalModalDus.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* HPP Modal per Pcs */}
                  <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                        Harga Pokok Penjualan (HPP) / Pcs
                      </p>
                      <p className="text-3xl font-black text-amber-400 mt-1">
                        Rp {calcGrosir.hppPerPcs.toLocaleString('id-ID')}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">
                        (Rp {calcGrosir.totalModalDus.toLocaleString()} ÷ {isiPcs} pcs)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(calcGrosir.hppPerPcs), 'HPP')}
                      className="mt-3 text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 self-start bg-slate-700/60 px-2.5 py-1 rounded-lg"
                    >
                      <Copy size={12} /> Salin HPP
                    </button>
                  </div>

                  {/* Rekomendasi Harga Jual */}
                  <div className="bg-blue-950/60 p-4 rounded-2xl border border-blue-800/60 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-black text-blue-300 uppercase tracking-wider flex items-center justify-between">
                        <span>Rekomendasi Harga Jual Ecer</span>
                        <span className="text-[10px] bg-blue-600/80 text-white px-2 py-0.5 rounded-full">
                          Target {targetMarginPct}%
                        </span>
                      </p>
                      <p className="text-3xl font-black text-emerald-400 mt-1">
                        Rp {calcGrosir.hargaJualBulat.toLocaleString('id-ID')}
                      </p>
                      <div className="mt-1 text-[11px] text-slate-300 space-y-0.5">
                        <p>
                          Untung per Pcs: <strong className="text-emerald-400">Rp {calcGrosir.marginRp.toLocaleString('id-ID')}</strong> ({calcGrosir.marginRealPct.toFixed(1)}%)
                        </p>
                        <p>
                          Estimasi Laba per {satuanBeli}: <strong className="text-emerald-400">Rp {calcGrosir.totalUntungDus.toLocaleString('id-ID')}</strong>
                        </p>
                      </div>
                    </div>

                    {selectedProductId && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleApplyToProduct(calcGrosir.hppPerPcs, calcGrosir.hargaJualBulat)}
                        className="mt-3 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                        Terapkan ke {selectedProduct?.name?.slice(0, 18)}...
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MOVING AVERAGE */}
          {activeTab === 'MOVING_AVERAGE' && (
            <div className="space-y-6">
              <div className="p-3.5 bg-purple-50/80 border border-purple-100 rounded-2xl text-xs text-purple-900 flex items-start gap-2.5">
                <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black">Skema Moving Average (Rata-Rata Bergerak):</span> Digunakan saat stok lama di toko masih tersisa dan Anda kulakan barang baru dengan harga beli berbeda. HPP baru dihitung dari rata-rata tertimbang nilai stok gabungan sehingga laporan laba/rugi tidak terdistorsi.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Kolom Kiri: Sisa Stok Lama */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Package size={14} className="text-slate-500" />
                    1. Kondisi Stok Lama di Toko
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Jumlah Sisa Stok Lama (Pcs)</label>
                    <input
                      type="number"
                      min="0"
                      value={stokLama}
                      onChange={e => setStokLama(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">HPP / Modal Satuan Lama (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        value={hppLama}
                        onChange={e => setHppLama(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-xs font-bold text-slate-600 flex justify-between">
                    <span>Total Nilai Stok Lama:</span>
                    <span>Rp {calcMovingAvg.valLama.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {/* Kolom Kanan: Kulakan Masuk Baru */}
                <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-purple-600" />
                    2. Kulakan Baru Masuk
                  </h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Jumlah Barang Masuk Baru (Pcs)</label>
                    <input
                      type="number"
                      min="1"
                      value={stokBaru}
                      onChange={e => setStokBaru(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-black text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Harga Beli Masuk Baru (Rp)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        value={hargaBeliBaru}
                        onChange={e => setHargaBeliBaru(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-purple-200 rounded-xl text-sm font-black text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-purple-200 text-xs font-bold text-purple-900 flex justify-between">
                    <span>Total Nilai Pembelian Baru:</span>
                    <span>Rp {calcMovingAvg.valBaru.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* HASIL MOVING AVERAGE */}
              <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl text-white shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-indigo-900">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                    Hasil Moving Average HPP
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Total Stok Gabungan: {calcMovingAvg.totalQty} pcs
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      HPP Rata-Rata Tertimbang Baru
                    </p>
                    <div className="flex items-baseline gap-3 mt-1">
                      <p className="text-4xl font-black text-emerald-400">
                        Rp {calcMovingAvg.newAvgCost.toLocaleString('id-ID')}
                      </p>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                        calcMovingAvg.diffRp > 0 ? 'bg-rose-900/60 text-rose-300' : 'bg-emerald-900/60 text-emerald-300'
                      }`}>
                        {calcMovingAvg.diffRp >= 0 ? '+' : ''}{calcMovingAvg.diffRp.toLocaleString('id-ID')} ({calcMovingAvg.diffPct.toFixed(1)}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Rumus: (Rp {calcMovingAvg.valLama.toLocaleString()} + Rp {calcMovingAvg.valBaru.toLocaleString()}) ÷ {calcMovingAvg.totalQty} pcs
                    </p>
                  </div>

                  {selectedProductId && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleApplyToProduct(calcMovingAvg.newAvgCost)}
                      className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-lg shrink-0 disabled:opacity-50"
                    >
                      {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      Update HPP Produk Ini
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PANDUAN & ATURAN MARGIN */}
          {activeTab === 'GUIDE' && (
            <div className="space-y-5 text-slate-700 text-xs">
              <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                <h4 className="font-black text-emerald-900 text-sm mb-1 flex items-center gap-2">
                  <Check size={16} className="text-emerald-600" />
                  Prinsip Dasar Penentuan HPP (Harga Modal Produk)
                </h4>
                <p className="text-emerald-800 leading-relaxed">
                  HPP (Harga Pokok Penjualan) adalah modal bersih per satuan unit barang yang dijual. Di toko retail dan grosir, HPP tidak boleh hanya menghitung harga barang polos dari agen, namun wajib memasukkan <strong>ongkos kirim per unit</strong> dikurangi <strong>diskon/cashback supplier</strong>.
                </p>
              </div>

              {/* Tabel Acuan Margin Toko Kelontong */}
              <div>
                <h4 className="font-black text-slate-900 uppercase tracking-wider mb-2">
                  Standar Target Margin Toko Retail / Kelontong:
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 font-black text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Kategori Produk</th>
                        <th className="p-3 text-center">Standar Margin (%)</th>
                        <th className="p-3">Karakteristik & Strategi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 font-bold text-slate-900">Sembako (Beras, Minyak, Gula, Tepung)</td>
                        <td className="p-3 text-center font-black text-blue-600">5% - 10%</td>
                        <td className="p-3 text-slate-500">Fast moving, harga sangat sensitif dibandingkan pembeli. Ambil untung tipis namun perputaran cepat.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-900">Rokok</td>
                        <td className="p-3 text-center font-black text-blue-600">3% - 6%</td>
                        <td className="p-3 text-slate-500">Margin paling tipis di toko, namun menjadi magnet pelanggan untuk membeli barang lain.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-900">Makanan Ringan / Snack & Mie Instan</td>
                        <td className="p-3 text-center font-black text-blue-600">12% - 18%</td>
                        <td className="p-3 text-slate-500">Penjualan stabil dan tinggi. Cocok diterapkan pembulatan ke Rp 500 terdekat.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-900">Minuman Dingin / RTD</td>
                        <td className="p-3 text-center font-black text-blue-600">18% - 25%</td>
                        <td className="p-3 text-slate-500">Bisa diberi margin lebih tinggi karena ada nilai tambah pendingin (chiller toko).</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-900">Toiletries & Sabun / Deterjen</td>
                        <td className="p-3 text-center font-black text-blue-600">15% - 22%</td>
                        <td className="p-3 text-slate-500">Kebutuhan rumah tangga rutin dengan masa kadaluarsa relatif panjang.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-900">ATK, Plastik, & Keperluan Rumah Tangga</td>
                        <td className="p-3 text-center font-black text-blue-600">25% - 35%</td>
                        <td className="p-3 text-slate-500">Slow moving tapi margin tebal untuk menutupi biaya operasional toko.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Perbedaan Margin vs Markup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="font-black text-slate-900 uppercase block mb-1">
                    Rumus Margin (Profit Margin)
                  </span>
                  <p className="font-mono text-blue-700 font-bold mb-1">
                    Margin % = (Harga Jual - Modal) ÷ Harga Jual × 100%
                  </p>
                  <p className="text-slate-500">
                    Contoh: Beli Rp 8.000, Jual Rp 10.000. Untung Rp 2.000. Margin = 2.000 / 10.000 = <strong>20%</strong>.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="font-black text-slate-900 uppercase block mb-1">
                    Rumus Markup
                  </span>
                  <p className="font-mono text-purple-700 font-bold mb-1">
                    Markup % = (Harga Jual - Modal) ÷ Modal × 100%
                  </p>
                  <p className="text-slate-500">
                    Contoh: Beli Rp 8.000, Jual Rp 10.000. Untung Rp 2.000. Markup = 2.000 / 8.000 = <strong>25%</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="text-xs text-slate-400">
            {selectedProduct ? (
              <span>Produk Terpilih: <strong className="text-slate-700">{selectedProduct.name}</strong></span>
            ) : (
              <span>Mode Perhitungan Mandiri (Bisa salin angka hasil hitung)</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-black transition-colors"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
