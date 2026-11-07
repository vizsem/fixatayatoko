'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Tag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import notify from '@/lib/notify';
import { bulkUpdateProductBrandAction } from '@/lib/actions/product.actions';
import type { ProductRow } from '@/app/admin/products/page';

interface BulkBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: ProductRow[];
  existingBrands?: string[];
  onSuccess?: () => void;
}

export default function BulkBrandModal({
  isOpen,
  onClose,
  selectedProducts,
  existingBrands = [],
  onSuccess,
}: BulkBrandModalProps) {
  const [brandName, setBrandName] = useState('');
  const [updateProductName, setUpdateProductName] = useState(false);
  const [prefixStyle, setPrefixStyle] = useState<'plain' | 'bracket'>('plain');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; percent: number }>({
    current: 0,
    total: 0,
    percent: 0,
  });

  if (!isOpen || selectedProducts.length === 0) return null;

  const totalCount = selectedProducts.length;

  // Format preview nama baru untuk sebuah produk
  const getPreviewName = (oldName: string, brand: string) => {
    const trimmedBrand = brand.trim();
    if (!trimmedBrand || !updateProductName) return oldName;
    const brandLower = trimmedBrand.toLowerCase();
    if (oldName.toLowerCase().includes(brandLower)) {
      return oldName; // Sudah ada nama brand, jangan duplikasi
    }
    return prefixStyle === 'bracket'
      ? `[${trimmedBrand}] ${oldName}`
      : `${trimmedBrand} ${oldName}`;
  };

  const sampleProducts = useMemo(() => {
    return selectedProducts.slice(0, 3);
  }, [selectedProducts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBrand = brandName.trim();
    if (!cleanBrand) {
      notify.admin.error('Silakan isi nama brand terlebih dahulu');
      return;
    }

    setLoading(true);
    const ids = selectedProducts.map((p) => p.id);
    const chunkSize = 80;
    const total = ids.length;
    let processed = 0;

    setProgress({ current: 0, total, percent: 0 });

    try {
      for (let i = 0; i < total; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const res = await bulkUpdateProductBrandAction(chunk, cleanBrand, {
          updateProductName,
          brandPrefixStyle: prefixStyle,
        });

        if (!res.success) {
          throw new Error(res.error || 'Gagal mengubah brand sebagian produk');
        }

        processed += chunk.length;
        const pct = Math.round((processed / total) * 100);
        setProgress({
          current: processed,
          total,
          percent: pct,
        });
      }

      notify.admin.success(
        `Berhasil menetapkan brand "${cleanBrand}" ke ${total} produk!`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      notify.admin.error(err?.message || 'Gagal mengubah nama brand produk');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xs">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>Set Nama Brand Massal</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                  {totalCount} Produk Terpilih
                </span>
              </h2>
              <p className="text-xs text-indigo-100 font-medium mt-0.5">
                Terapkan brand ke seluruh produk yang dicentang sekaligus
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 hover:text-white transition-all disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* Input Nama Brand */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700">
              Nama Brand / Merek <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                list="existing-brands-list"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Contoh: Indomie, SunCo, Unilever, Wings, dll..."
                disabled={loading}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                autoFocus
              />
              <datalist id="existing-brands-list">
                {existingBrands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            {/* Quick Chips dari Brand yang Sudah Ada */}
            {existingBrands.length > 0 && (
              <div className="pt-1.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Pilih Cepat dari Brand yang Sudah Ada:
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                  {existingBrands.slice(0, 10).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrandName(b)}
                      disabled={loading}
                      className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all border ${
                        brandName.toLowerCase() === b.toLowerCase()
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Opsi Update Nama Produk */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={updateProductName}
                onChange={(e) => setUpdateProductName(e.target.checked)}
                disabled={loading}
                className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <div>
                <p className="text-xs font-black text-gray-900">
                  Sisipkan juga nama brand ke Nama Produk
                </p>
                <p className="text-[11px] text-gray-500 font-medium">
                  Secara otomatis menambahkan brand di depan nama produk jika belum ada.
                </p>
              </div>
            </label>

            {updateProductName && (
              <div className="pt-2 pl-7 border-t border-indigo-100 space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                  Format Penulisan:
                </p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                    <input
                      type="radio"
                      name="prefixStyle"
                      value="plain"
                      checked={prefixStyle === 'plain'}
                      onChange={() => setPrefixStyle('plain')}
                      disabled={loading}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Polos: <strong className="text-indigo-700 font-mono">Brand Nama</strong></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                    <input
                      type="radio"
                      name="prefixStyle"
                      value="bracket"
                      checked={prefixStyle === 'bracket'}
                      onChange={() => setPrefixStyle('bracket')}
                      disabled={loading}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Kurung: <strong className="text-indigo-700 font-mono">[Brand] Nama</strong></span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Live Preview */}
          {brandName.trim() && (
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                  Pratinjau Hasil (Contoh 3 Produk):
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  {totalCount} produk akan diperbarui
                </span>
              </div>
              <div className="space-y-2">
                {sampleProducts.map((p) => {
                  const previewName = getPreviewName(p.name, brandName);
                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-white border border-gray-100 text-xs shadow-2xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span className="font-mono">#{p.sku || p.id.slice(0, 8)}</span>
                        <span className="font-semibold text-gray-500">
                          Brand saat ini: <strong className="text-gray-700">{p.brand || '-'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-400 line-through truncate max-w-[200px]">
                          {p.name}
                        </span>
                        <ArrowRight size={12} className="text-indigo-500 shrink-0" />
                        <span className="font-bold text-gray-900 truncate max-w-[250px]">
                          {previewName}
                        </span>
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Brand: {brandName.trim()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress Bar saat submit */}
          {loading && (
            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-indigo-900">
                <span>Memperbarui data produk...</span>
                <span>{progress.percent}% ({progress.current}/{progress.total})</span>
              </div>
              <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !brandName.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold tracking-wide shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Terapkan ke {totalCount} Produk</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

