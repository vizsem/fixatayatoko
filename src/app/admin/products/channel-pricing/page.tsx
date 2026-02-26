'use client';

import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ChevronLeft, Search, Save, Tag } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct } from '@/lib/normalize';

type ChannelKey = 'offline' | 'website' | 'shopee' | 'tiktok';

type ChannelPricingState = {
  offline?: number;
  website?: number;
  shopee?: number;
  tiktok?: number;
};

type UnitChannelPricing = Record<string, { price?: number }>;
type Product = NormalizedProduct & {
  channelPricing?: Record<ChannelKey, UnitChannelPricing> | {
    offline?: { price?: number };
    website?: { price?: number };
    shopee?: { price?: number };
    tiktok?: { price?: number };
  };
};

export default function ChannelPricingPage() {
  const [savingId, setSavingId] = useState<string | null>(null);
  const { products: liveProducts, loading } = useProducts({ isActive: true, orderByField: 'name', orderDirection: 'asc' });
  // prices[productId][unitCode] = ChannelPricingState
  const [prices, setPrices] = useState<Record<string, Record<string, ChannelPricingState>>>({});
  const [selectedUnit, setSelectedUnit] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  // Init state harga channel dari data produk
  // LiveProducts sudah ter-normalisasi; channelPricing tetap optional
  if (liveProducts.length > 0) {
    setPrices(prev => {
      const next = { ...prev } as Record<string, Record<string, ChannelPricingState>>;
      (liveProducts as Product[]).forEach(p => {
        const unitList = (p.units || []).map(u => (u?.code || '').toString().toUpperCase());
        const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
        const units = unitList.length ? unitList : [baseUnit];
        if (!next[p.id]) next[p.id] = {};
        if (!selectedUnit[p.id]) setSelectedUnit(su => ({ ...su, [p.id]: baseUnit }));
        units.forEach(uc => {
          if (!next[p.id][uc]) {
            // Compat: jika channelPricing lama (flat), pakai untuk baseUnit
            const legacy = (p.channelPricing || {}) as {
              offline?: { price?: number };
              website?: { price?: number };
              shopee?: { price?: number };
              tiktok?: { price?: number };
            };
            const legacyState: ChannelPricingState = {
              offline: legacy?.offline?.price,
              website: legacy?.website?.price,
              shopee: legacy?.shopee?.price,
              tiktok: legacy?.tiktok?.price,
            };
            // Nested baru: channelPricing[channel]?.[unitCode]?.price
            const nested = (p.channelPricing || {}) as Record<string, UnitChannelPricing>;
            const fromNested: ChannelPricingState = {
              offline: nested?.offline?.[uc]?.price,
              website: nested?.website?.[uc]?.price,
              shopee: nested?.shopee?.[uc]?.price,
              tiktok: nested?.tiktok?.[uc]?.price,
            };
            next[p.id][uc] = uc === baseUnit ? { ...legacyState, ...fromNested } : fromNested;
          }
        });
      });
      return next;
    });
  }

  const filteredProducts = useMemo(() => {
    const products = liveProducts as Product[];
    if (!search) return products;
    const lower = search.toLowerCase();
    return products.filter(p => {
      return (p.name || '').toLowerCase().includes(lower);
    });
  }, [liveProducts, search]);

  const handleChangePrice = (productId: string, unitCode: string, channel: ChannelKey, value: string) => {
    setPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [unitCode]: {
          ...(prev[productId]?.[unitCode] || {}),
          [channel]: value === '' ? undefined : Number(value),
        },
      },
    }));
  };

  const handleSave = async (product: Product) => {
    const state = prices[product.id] || {};
    setSavingId(product.id);
    const toastId = notify.admin.loading('Menyimpan harga channel...');
    try {
      const payload: Record<string, Record<string, { price: number }>> = {};
      (['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).forEach((ch) => {
        Object.entries(state).forEach(([unitCode, chState]) => {
          const v = (chState as ChannelPricingState)[ch];
          if (typeof v === 'number' && !Number.isNaN(v)) {
            if (!payload[ch]) payload[ch] = {};
            payload[ch][unitCode] = { price: v };
          }
        });
      });
      await updateDoc(doc(db, 'products', product.id), {
        channelPricing: Object.keys(payload).length ? payload : null,
      });
      notify.admin.success('Harga channel tersimpan.', { id: toastId });
    } catch (err) {
      console.error(err);
      notify.admin.error('Gagal menyimpan harga channel.', { id: toastId });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-4 lg:p-10 bg-[#FBFBFE] min-h-screen pb-32 font-sans">
      <Toaster />

      <div className="flex items-center gap-4 mb-10">
        <Link
          href="/admin/products"
          className="p-4 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all"
        >
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">
            Harga per Channel
          </h1>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">
            Atur harga offline, website, Shopee & TikTok
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              className="w-full bg-gray-50 pl-10 pr-4 py-3 rounded-2xl text-xs font-bold outline-none"
              placeholder="Cari produk berdasarkan nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-[10px] font-black uppercase text-gray-400 tracking-[0.25em] flex items-center gap-2">
            <Tag size={14} />
            {filteredProducts.length} Produk
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-gray-400">
            Memuat data produk...
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-left min-w-[720px] md:min-w-0">
              <thead className="bg-gray-50/60">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase">Produk</th>
                  <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase text-right">
                    Offline
                  </th>
                  <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase text-right">
                    Website
                  </th>
                  <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase text-right">
                    Shopee
                  </th>
                  <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase text-right">
                    TikTok
                  </th>
                  <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredProducts.map((p) => {
                  const state = prices[p.id] || {};
                  const displayName = p.name || 'Produk';
                  const unitList = ((p.units || []).map(u => (u?.code || '').toString().toUpperCase()));
                  const baseUnit = (p.unit || 'PCS').toString().toUpperCase();
                  const units = unitList.length ? unitList : [baseUnit];
                  const currentUnit = selectedUnit[p.id] || baseUnit;
                  const stateByUnit = prices[p.id]?.[currentUnit] || {};
                  return (
                    <tr key={p.id}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-gray-800 uppercase">
                            {displayName}
                          </span>
                          <span className="text-[9px] font-bold text-gray-400">
                            Harga dasar: Rp{' '}
                            {Number(p.priceEcer || 0).toLocaleString()}
                          </span>
                          <div className="mt-2">
                            <select
                              value={currentUnit}
                              onChange={(e) => setSelectedUnit(su => ({ ...su, [p.id]: e.target.value }))}
                              className="text-[10px] font-black bg-gray-50 border rounded-lg px-2 py-1"
                            >
                              {units.map(uc => (
                                <option key={uc} value={uc}>{uc}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                      {(['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).map((key) => (
                        <td key={key} className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[9px] font-bold text-gray-400">Rp</span>
                            <input
                              type="number"
                              className="w-24 bg-gray-50 p-2 rounded-lg text-xs font-black text-right outline-none"
                              value={stateByUnit[key] ?? ''}
                              onChange={(e) =>
                                handleChangePrice(p.id, currentUnit, key, e.target.value)
                              }
                              min={0}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleSave(p)}
                          disabled={savingId === p.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Save size={14} />
                          {savingId === p.id ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredProducts.length && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-[11px] font-bold text-gray-400"
                    >
                      Tidak ada produk yang cocok dengan pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
