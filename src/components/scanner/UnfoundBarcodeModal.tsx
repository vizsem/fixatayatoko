'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, Link as LinkIcon, Search, Check, X, Package, Layers, RefreshCw } from 'lucide-react';
import notify from '@/lib/notify';
import { attachBarcodeToProduct } from '@/lib/actions/product.actions';
import type { NormalizedProduct } from '@/lib/normalize';

interface UnfoundBarcodeModalProps {
  isOpen: boolean;
  barcode: string;
  onClose: () => void;
  products: NormalizedProduct[];
  onBarcodeAttached?: (productName: string, barcode: string) => void;
}

export default function UnfoundBarcodeModal({
  isOpen,
  barcode,
  onClose,
  products,
  onBarcodeAttached,
}: UnfoundBarcodeModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'link'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<NormalizedProduct | null>(null);
  const [targetType, setTargetType] = useState<'main' | 'unit'>('main');
  const [selectedUnitCode, setSelectedUnitCode] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Filter existing products for search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter((p) => (p.name && p.name.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [searchQuery, products]);

  // Handle navigate to Add New Product
  const handleCreateNewProduct = () => {
    onClose();
    router.push(`/admin/products/add?barcode=${encodeURIComponent(barcode)}`);
  };

  // Handle Attach to Existing Product
  const handleAttachBarcode = async () => {
    if (!selectedProduct) {
      notify.admin.error('Silakan pilih produk terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      const unitCode = targetType === 'unit' ? selectedUnitCode : undefined;
      const res = await attachBarcodeToProduct(selectedProduct.id, barcode, unitCode);

      if (res.success) {
        notify.admin.success(`Barcode berhasil ditautkan ke ${res.productName || selectedProduct.name}!`);
        if (onBarcodeAttached) {
          onBarcodeAttached(res.productName || selectedProduct.name, barcode);
        }
        handleResetAndClose();
      } else {
        notify.admin.error(res.error || 'Gagal menautkan barcode');
      }
    } catch (err: any) {
      notify.admin.error(err?.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setMode('choose');
    setSearchQuery('');
    setSelectedProduct(null);
    setTargetType('main');
    setSelectedUnitCode('');
    onClose();
  };

  if (!isOpen || !barcode) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 tracking-tight">Barcode Belum Terdaftar</h3>
              <p className="text-xs font-mono font-bold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-lg inline-block mt-0.5 border border-amber-200">
                {barcode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {mode === 'choose' ? (
            <>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                Produk dengan barcode di atas belum ada di katalog. Apa yang ingin Anda lakukan dengan barcode ini?
              </p>

              {/* Option 1: Buat Produk Baru */}
              <button
                type="button"
                onClick={handleCreateNewProduct}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-left transition-all group flex items-start gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <Plus size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-black text-blue-950 uppercase tracking-wide">1. Buat Produk Baru</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Buka formulir input master produk baru. Barcode ini akan langsung otomatis terisi di kolom barcode.
                  </p>
                </div>
              </button>

              {/* Option 2: Tautkan ke Produk yang Sudah Ada */}
              <button
                type="button"
                onClick={() => setMode('link')}
                className="w-full p-4 rounded-2xl border border-gray-200 hover:border-gray-900 bg-white hover:bg-gray-50/80 text-left transition-all group flex items-start gap-3.5 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <LinkIcon size={18} />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">
                    2. Tautkan ke Produk yang Sudah Ada
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Gunakan jika ini adalah barcode kemasan baru, atau barcode untuk satuan tertentu (seperti 1 Dus/Box atau Renceng).
                  </p>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Mode Link to Existing Product */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  &larr; Kembali ke Pilihan
                </button>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tautkan Barcode</span>
              </div>

              {/* Search Box */}
              {!selectedProduct ? (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-gray-400">
                    Cari Produk yang Sudah Ada di Toko
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ketik nama produk atau SKU..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    />
                  </div>

                  {/* Search Results List */}
                  <div className="mt-1 flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(p);
                          setSelectedUnitCode(p.unit || 'PCS');
                        }}
                        className="w-full p-2.5 text-left rounded-xl hover:bg-blue-50/60 border border-transparent hover:border-blue-200 flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <Package size={16} className="text-gray-400 group-hover:text-blue-600" />
                          <div>
                            <p className="text-xs font-black text-gray-800 group-hover:text-blue-900">{p.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold">
                              SKU: {p.sku || '-'} | Stok: {p.stock} {p.unit}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          Pilih &rarr;
                        </span>
                      </button>
                    ))}
                    {searchQuery.trim() && filteredProducts.length === 0 && (
                      <p className="text-center py-4 text-xs text-gray-400 font-bold">Produk tidak ditemukan</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Selected Product Setup */
                <div className="flex flex-col gap-4">
                  {/* Selected Product Card */}
                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase text-blue-600 tracking-wider">Produk Terpilih</span>
                      <h4 className="text-xs font-black text-gray-900">{selectedProduct.name}</h4>
                      <p className="text-[10px] text-gray-500 font-bold">
                        SKU: {selectedProduct.sku} | Barcode Saat Ini: {selectedProduct.barcode || 'Belum Ada'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-xs text-gray-400 hover:text-red-500 font-bold px-2 py-1 rounded-lg"
                    >
                      Ganti
                    </button>
                  </div>

                  {/* Target Type Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase text-gray-400">
                      Gunakan Barcode Ini Sebagai:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTargetType('main')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          targetType === 'main'
                            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-100'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-xs font-black text-gray-900">Barcode Utama</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Untuk satuan dasar ({selectedProduct.unit})</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTargetType('unit')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          targetType === 'unit'
                            ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-100'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-xs font-black text-gray-900">Barcode Satuan</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Misal BOX / RENCENG</p>
                      </button>
                    </div>
                  </div>

                  {/* Unit Picker if targetType === 'unit' */}
                  {targetType === 'unit' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black uppercase text-gray-400">Pilih Satuan:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {['BOX', 'CTN', 'RENCENG', 'PACK', 'LUSIN'].map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setSelectedUnitCode(u)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                              selectedUnitCode === u
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleAttachBarcode}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>Simpan Tautan Barcode</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
