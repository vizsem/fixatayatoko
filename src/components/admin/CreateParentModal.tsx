'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  Sparkles,
  Loader2,
  Package,
  ArrowRight,
  AlertCircle,
  Tag,
  CheckCircle2,
} from 'lucide-react';
import notify from '@/lib/notify';
import {
  createParentAndAttachVariantsAction,
  generateNextSkuAction,
} from '@/lib/actions/product.actions';
import type { ProductRow } from '@/app/admin/products/page';

interface CreateParentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: ProductRow[];
  onSuccess?: () => void;
}

/**
 * Mencari kata-kata yang sama di awal nama produk (common prefix)
 * Contoh: "Pepsodent Pasta Gigi 120g" & "Pepsodent Pasta Gigi 72g" -> "Pepsodent Pasta Gigi"
 */
function findCommonWordsPrefix(names: string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return names[0].trim();

  const wordsList = names.map((n) => n.trim().split(/\s+/).filter(Boolean));
  const firstWords = wordsList[0];
  const commonWords: string[] = [];

  for (let i = 0; i < firstWords.length; i++) {
    const word = firstWords[i];
    const allMatch = wordsList.every(
      (wArr) => wArr[i] && wArr[i].toLowerCase() === word.toLowerCase()
    );
    if (allMatch) {
      commonWords.push(word);
    } else {
      break;
    }
  }

  // Jika dapat prefix minimal 1 kata
  if (commonWords.length > 0) {
    return commonWords.join(' ');
  }

  // Fallback: hapus angka/gramatur dari nama pertama
  return names[0].replace(/\b\d+(\.\d+)?\s*(g|gr|gram|ml|kg|l|pcs|isi\s*\d+)?\b/gi, '').trim();
}

export default function CreateParentModal({
  isOpen,
  onClose,
  selectedProducts,
  onSuccess,
}: CreateParentModalProps) {
  const [parentName, setParentName] = useState('');
  const [parentSku, setParentSku] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [isParentOnly, setIsParentOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingSku, setGeneratingSku] = useState(false);

  // Inisialisasi saran nama induk & data dari produk terpilih
  useEffect(() => {
    if (selectedProducts.length > 0 && isOpen) {
      const names = selectedProducts.map((p) => p.name || p.Nama || '');
      const suggested = findCommonWordsPrefix(names);
      setParentName(suggested);

      // Ambil kategori dari produk pertama yang memiliki kategori
      const foundCat = selectedProducts.find((p) => p.category || p.Kategori);
      const catVal = foundCat?.category || foundCat?.Kategori || 'UMUM';
      setCategory(catVal);

      // Ambil brand dari produk pertama yang memiliki brand
      const foundBrand = selectedProducts.find((p) => p.brand);
      setBrand(foundBrand?.brand || '');

      setParentSku('');
      setIsParentOnly(true);
    }
  }, [selectedProducts, isOpen]);

  // Handler auto-generate SKU
  const handleAutoSku = async () => {
    if (!parentName.trim()) {
      notify.admin.error('Isi nama produk induk terlebih dahulu');
      return;
    }
    setGeneratingSku(true);
    try {
      const res = await generateNextSkuAction(category || 'UMUM', parentName);
      if (res.success && res.sku) {
        setParentSku(res.sku);
        notify.admin.success(`SKU dihasilkan: ${res.sku}`);
      } else {
        notify.admin.error('Gagal generate SKU otomatis');
      }
    } catch {
      notify.admin.error('Gagal generate SKU');
    } finally {
      setGeneratingSku(false);
    }
  };

  if (!isOpen || selectedProducts.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim()) {
      notify.admin.error('Nama produk induk harus diisi');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createParentAndAttachVariantsAction({
        parentName: parentName.trim(),
        parentSku: parentSku.trim() || undefined,
        category: category.trim() || undefined,
        brand: brand.trim() || undefined,
        isParentOnly,
        variantProductIds: selectedProducts.map((p) => p.id),
      });

      if (!res.success) {
        throw new Error(res.error || 'Gagal membuat produk induk');
      }

      notify.admin.success(
        `Berhasil membuat Induk "${res.parentName}" dan menghubungkan ${selectedProducts.length} varian!`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      notify.admin.error(err.message || 'Terjadi kesalahan saat membuat induk');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-200">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                Buatkan Produk Induk Baru
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Buat payung grup baru untuk {selectedProducts.length} produk yang dipilih
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Info Card */}
          <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-3.5 flex items-start gap-2.5">
            <Sparkles size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <p className="text-xs text-violet-900 font-medium leading-relaxed">
              Sistem akan membuat 1 produk Induk baru dan secara otomatis mengatur {selectedProducts.length} produk di bawah ini sebagai <strong>anak varian</strong> dari produk induk tersebut.
            </p>
          </div>

          {/* Nama Produk Induk */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Nama Produk Induk *
            </label>
            <input
              type="text"
              required
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Contoh: Pepsodent Pasta Gigi"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Nama grup utama yang menaungi seluruh varian (tanpa ukuran/gramatur spesifik).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* SKU Induk */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  ID SKU Induk (Opsional)
                </label>
                <button
                  type="button"
                  onClick={handleAutoSku}
                  disabled={generatingSku}
                  className="text-[10px] font-bold text-violet-600 hover:text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                >
                  <Sparkles size={10} /> Auto SKU
                </button>
              </div>
              <input
                type="text"
                value={parentSku}
                onChange={(e) => setParentSku(e.target.value)}
                placeholder="Otomatis jika kosong"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:bg-white focus:border-violet-500 outline-none"
              />
            </div>

            {/* Kategori */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Kategori
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="UMUM"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-violet-500 outline-none uppercase"
              />
            </div>
          </div>

          {/* Opsi Induk Non-Order */}
          <label className="flex items-start gap-3 p-3.5 bg-violet-50/70 border border-violet-200 rounded-2xl cursor-pointer hover:bg-violet-50 transition-colors">
            <input
              type="checkbox"
              checked={isParentOnly}
              onChange={(e) => setIsParentOnly(e.target.checked)}
              className="mt-0.5 rounded text-violet-600 focus:ring-violet-400 w-4 h-4 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-violet-900 block">
                Jadikan Induk hanya sebagai Pengelompokan (Non-Order)
              </span>
              <span className="text-violet-700 font-medium">
                Induk ini tidak bisa langsung di-order di kasir atau pembelian, melainkan pesanan diarahkan untuk memilih variannya.
              </span>
            </div>
          </label>

          {/* Preview Produk Anak Varian */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Package size={14} className="text-violet-600" />
                Produk yang akan menjadi Varian ({selectedProducts.length}):
              </span>
            </div>
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-2.5 divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {selectedProducts.map((p) => (
                <div key={p.id} className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ArrowRight size={12} className="text-violet-500 shrink-0" />
                    <span className="font-bold text-slate-800 truncate">{p.name || p.Nama}</span>
                    {p.sku && (
                      <span className="font-mono text-[9px] text-slate-400 shrink-0">#{p.sku}</span>
                    )}
                  </div>
                  <span className="text-slate-600 font-semibold shrink-0 text-[11px]">
                    Stok: {p.stock} {p.unit || 'PCS'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !parentName.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md shadow-violet-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              <span>Buatkan Induk & Hubungkan ({selectedProducts.length} Varian)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

