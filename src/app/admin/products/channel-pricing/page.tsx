'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { ChevronLeft, Search, Save, Tag } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';

type ChannelKey = 'offline' | 'website' | 'shopee' | 'tiktok';

type ChannelPricingState = {
  offline?: number;
  website?: number;
  shopee?: number;
  tiktok?: number;
};

type Product = {
  id: string;
  Nama?: string;
  name?: string;
  Ecer?: number;
  price?: number;
  channelPricing?: {
    offline?: { price?: number };
    website?: { price?: number };
    shopee?: { price?: number };
    tiktok?: { price?: number };
  };
};

export default function ChannelPricingPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Record<string, ChannelPricingState>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'products'), orderBy('name', 'asc')));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
        setProducts(list);
        const initial: Record<string, ChannelPricingState> = {};
        list.forEach(p => {
          initial[p.id] = {
            offline: p.channelPricing?.offline?.price ?? undefined,
            website: p.channelPricing?.website?.price ?? undefined,
            shopee: p.channelPricing?.shopee?.price ?? undefined,
            tiktok: p.channelPricing?.tiktok?.price ?? undefined,
          };
        });
        setPrices(initial);
      } catch (err) {
        console.error(err);
        notify.admin.error('Gagal memuat produk.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const lower = search.toLowerCase();
    return products.filter(p => {
      const name = p.Nama || p.name || '';
      return name.toLowerCase().includes(lower);
    });
  }, [products, search]);

  const handleChangePrice = (productId: string, channel: ChannelKey, value: string) => {
    setPrices(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [channel]: value === '' ? undefined : Number(value),
      },
    }));
  };

  const handleSave = async (product: Product) => {
    const state = prices[product.id] || {};
    setSavingId(product.id);
    const toastId = notify.admin.loading('Menyimpan harga channel...');
    try {
      const channelPricing: Record<string, { price: number }> = {};
      (['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).forEach(key => {
        const v = state[key];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          channelPricing[key] = { price: v };
        }
      });
      await updateDoc(doc(db, 'products', product.id), {
        channelPricing: Object.keys(channelPricing).length ? channelPricing : null,
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
                  const displayName = p.Nama || p.name || 'Produk';
                  return (
                    <tr key={p.id}>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-gray-800 uppercase">
                            {displayName}
                          </span>
                          <span className="text-[9px] font-bold text-gray-400">
                            Harga dasar: Rp{' '}
                            {Number(p.Ecer || p.price || 0).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      {(['offline', 'website', 'shopee', 'tiktok'] as ChannelKey[]).map((key) => (
                        <td key={key} className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-[9px] font-bold text-gray-400">Rp</span>
                            <input
                              type="number"
                              className="w-24 bg-gray-50 p-2 rounded-lg text-xs font-black text-right outline-none"
                              value={state[key] ?? ''}
                              onChange={(e) =>
                                handleChangePrice(p.id, key, e.target.value)
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
