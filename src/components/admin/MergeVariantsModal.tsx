'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crown,
  ArrowRight,
  Package,
} from 'lucide-react';
import notify from '@/lib/notify';
import { mergeProductsAsVariantsAction } from '@/lib/actions/product.actions';
import type { ProductRow } from '@/app/admin/products/page';

interface MergeVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: ProductRow[];
  onSuccess?: () => void;
}

export default function MergeVariantsModal({
  isOpen,
  onClose,
  selectedProducts,
  onSuccess,
}: MergeVariantsModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<string>(() => {
    // Cari produk yang belum punya parentId sebagai kandidat awal
    const root = selectedProducts.find((p) => !p.parentId);
    return root ? root.id : (selectedProducts[0]?.id || '');
  });
  const [submitting, setSubmitting] = useState(false);

  // Update selectedParentId bila daftar produk berubah
  React.useEffect(() => {
    if (selectedProducts.length > 0 && (!selectedParentId || !selectedProducts.some(p => p.id === selectedParentId))) {
      const root = selectedProducts.find((p) => !p.parentId);
      setSelectedParentId(root ? root.id : selectedProducts[0].id);
    }
  }, [selectedProducts, selectedParentId]);

  const parentProduct = useMemo(
    () => selectedProducts.find((p) => p.id === selectedParentId),
    [selectedProducts, selectedParentId]
  );

  const variantProducts = useMemo(
    () => selectedProducts.filter((p) => p.id !== selectedParentId),
    [selectedProducts, selectedParentId]
  );

  if (!isOpen || selectedProducts.length < 2) return null;

  const handleMerge = async () => {
    if (!selectedParentId) {
      notify.admin.error('Silakan pilih salah satu produk sebagai produk induk.');
      return;
    }

    if (variantProducts.length === 0) {
      notify.admin.error('Minimal harus ada 1 produk yang menjadi varian.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await mergeProductsAsVariantsAction({
        parentId: selectedParentId,
        variantProductIds: variantProducts.map((p) => p.id),
      });

      if (!res.success) {
        throw new Error(res.error || 'Gagal menggabungkan produk');
      }

      notify.admin.success(
        `Berhasil menggabungkan ${res.mergedCount || variantProducts.length} produk sebagai varian dari "${parentProduct?.name || 'Induk'}"!`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      notify.admin.error(err.message || 'Terjadi kesalahan saat menggabungkan varian.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-200">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                Jadikan Varian Produk
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Gabungkan {selectedProducts.length} produk yang dipilih ke dalam satu kelompok varian
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

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Petunjuk */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed font-medium">
              <strong className="font-bold">Bagaimana cara kerjanya?</strong>
              <p className="mt-0.5 text-amber-800">
                Pilih <strong>1 produk sebagai Produk Induk</strong>. Produk lainnya akan menjadi <strong>anak varian</strong> di bawah produk induk tersebut. Masing-masing barcode, stok gudang, dan harga produk tetap aman dan tidak akan hilang.
              </p>
            </div>
          </div>

          {/* Langkah 1: Pilih Produk Induk */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Crown size={16} className="text-amber-500" />
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                1. Pilih Produk Utama / Induk:
              </label>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedProducts.map((p) => {
                const isSelected = p.id === selectedParentId;
                return (
                  <label
                    key={p.id}
                    onClick={() => setSelectedParentId(p.id)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-violet-50/70 border-violet-400 shadow-sm ring-2 ring-violet-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="radio"
                        name="parentProductRadio"
                        checked={isSelected}
                        onChange={() => setSelectedParentId(p.id)}
                        className="w-4 h-4 text-violet-600 focus:ring-violet-400 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-800 truncate">
                            {p.name}
                          </span>
                          {p.sku && (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              {p.sku}
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[10px] font-black uppercase bg-violet-600 text-white px-2 py-0.5 rounded-full">
                              Calon Induk
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          Stok: <span className="font-bold text-slate-700">{p.stock} {p.unit || 'PCS'}</span> · Ecer: <span className="font-bold text-emerald-600">Rp {(p.priceEcer || 0).toLocaleString('id-ID')}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 pl-2">
                      {isSelected ? (
                        <CheckCircle2 size={18} className="text-violet-600" />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">Pilih</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Langkah 2: Ringkasan Varian yang akan digabung */}
          {parentProduct && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Package size={15} className="text-violet-600" />
                  2. Produk yang Menjadi Anak Varian ({variantProducts.length}):
                </label>
                <span className="text-xs font-semibold text-slate-400">
                  Akan terlipat di bawah &quot;{parentProduct.name}&quot;
                </span>
              </div>

              <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-3 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {variantProducts.map((v) => (
                  <div key={v.id} className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ArrowRight size={12} className="text-violet-500 flex-shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{v.name}</span>
                        {v.sku && (
                          <span className="text-[10px] font-mono text-slate-400">({v.sku})</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 text-slate-600 font-semibold">
                      {v.stock} {v.unit || 'PCS'} · Rp {(v.priceEcer || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={submitting || !selectedParentId || variantProducts.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Gabungkan Jadi Varian ({variantProducts.length} Varian)
          </button>
        </div>
      </div>
    </div>
  );
}
