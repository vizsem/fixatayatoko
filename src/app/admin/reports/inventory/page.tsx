// src/app/(admin)/reports/inventory/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct } from '@/lib/normalize';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import {
  Package,
  Download,
  AlertTriangle,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import notify from '@/lib/notify';


type InventoryItem = {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  stockIn: number;
  stockOut: number;
  turnoverRate: number;
  stockValue: number;
  imageUrl?: string;
  warehouseId?: string;
};

export default function InventoryReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const { products, loading: productsLoading } = useProducts({ isActive: true, orderByField: 'name' });
  const [building, setBuilding] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<200 | 300 | 500>(200);
  const [pageIndex, setPageIndex] = useState(0);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        notify.admin.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const build = async () => {
      setBuilding(true);
      try {
        const transactionsSnapshot = await getDocs(collection(db, 'inventory_transactions'));
        const transactions = transactionsSnapshot.docs.map(d => d.data() as Record<string, unknown>);
        const inv: InventoryItem[] = products.map((p: NormalizedProduct) => {
          const stockIn = transactions
            .filter(t => t.productId === p.id && t.type === 'STOCK_IN')
            .reduce((sum, t) => sum + Number(t.quantity || 0), 0);
          const stockOut = transactions
            .filter(t => t.productId === p.id && t.type === 'STOCK_OUT')
            .reduce((sum, t) => sum + Number(t.quantity || 0), 0);
          const purchasePrice = typeof p.purchasePrice === 'number' ? p.purchasePrice : (p.priceEcer || 0) * 0.8;
          const stockValue = (p.stock || 0) * purchasePrice;
          const turnoverRate = p.stock > 0 ? stockOut / p.stock : 0;
          return {
            id: p.id,
            name: p.name || '',
            category: p.category || '',
            currentStock: p.stock || 0,
            stockIn,
            stockOut,
            turnoverRate,
            stockValue,
            imageUrl: p.imageUrl,
            warehouseId: p.warehouseId
          };
        });
        setInventory(inv);
      } finally {
        setBuilding(false);
      }
    };
    if (!productsLoading) build();
  }, [productsLoading, products]);

  // Load warehouses for filter
  useEffect(() => {
    getDocs(collection(db, 'warehouses')).then((s) => {
      const arr = s.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const name = (typeof data.name === 'string' && data.name) ? data.name : d.id;
        return { id: d.id, name };
      });
      setWarehouses(arr);
    });
  }, []);

  const handleExport = () => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? inventory.filter(it => (it.name || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q))
      : inventory;
    const exportData = rows.map(item => ({
      Produk: item.name,
      Kategori: item.category,
      'Stok Saat Ini': item.currentStock,
      'Stok Masuk': item.stockIn,
      'Stok Keluar': item.stockOut,
      'Nilai Stok (Rp)': item.stockValue,
      'Turnover Rate': item.turnoverRate.toFixed(2)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Inventaris');
    XLSX.writeFile(wb, 'laporan-inventaris.xlsx');
  };

  if (loading || productsLoading || building) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan inventaris...</p>
        </div>
      </div>
    );
  }

  const filtered = inventory
    .filter(it => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (it.name || '').toLowerCase().includes(q) || (it.category || '').toLowerCase().includes(q);
    })
    .filter(it => selectedCategory === 'ALL' ? true : (it.category || '') === selectedCategory)
    .filter(it => selectedWarehouse === 'ALL' ? true : (it.warehouseId || '') === selectedWarehouse);
  const categories = Array.from(new Set(inventory.map(i => i.category).filter(Boolean))).sort();
  const totalItems = filtered.reduce((sum, item) => sum + item.currentStock, 0);
  const lowStockItems = filtered.filter(item => item.currentStock <= 10).length;
  const totalValue = filtered.reduce((sum, item) => sum + item.stockValue, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const pageStart = currentPage * pageSize;
  const pageEnd = Math.min(filtered.length, pageStart + pageSize);
  const pageSlice = filtered.slice(pageStart, pageEnd);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-gray-900">Laporan Inventaris</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Analisis stok & perputaran</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
        >
          <Download size={16} /> Ekspor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Item</p>
              <p className="text-2xl font-bold mt-1">{totalItems}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Package className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Stok Rendah</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{lowStockItems}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Nilai Stok</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                Rp{totalValue.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-black">Detail Inventaris</h2>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPageIndex(0); }}
              placeholder="Cari produk/kategori..."
              className="px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold outline-none border border-gray-200"
              type="text"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-500 uppercase">Kategori</span>
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setPageIndex(0); }}
                className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold outline-none border border-gray-200"
              >
                <option value="ALL">Semua</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-500 uppercase">Gudang</span>
              <select
                value={selectedWarehouse}
                onChange={(e) => { setSelectedWarehouse(e.target.value); setPageIndex(0); }}
                className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold outline-none border border-gray-200"
              >
                <option value="ALL">Semua</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-500 uppercase">Per halaman</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) as 200 | 300 | 500); setPageIndex(0); }}
                className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold outline-none border border-gray-200"
              >
                <option value={200}>200</option>
                <option value={300}>300</option>
                <option value={500}>500</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-xl bg-gray-100 text-xs font-bold disabled:opacity-40"
                onClick={() => setPageIndex(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                type="button"
              >
                Prev
              </button>
              <div className="text-xs font-bold text-gray-600">
                {filtered.length ? `${pageStart + 1}-${pageEnd} dari ${filtered.length}` : '0-0 dari 0'}
              </div>
              <button
                className="px-3 py-2 rounded-xl bg-gray-100 text-xs font-bold disabled:opacity-40"
                onClick={() => setPageIndex(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="min-w-full divide-y divide-gray-200 min-w-[860px] md:min-w-0">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-3 md:px-6 py-3 md:py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Foto</th>
                <th scope="col" className="px-3 md:px-6 py-3 md:py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Produk
                </th>
                <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Kategori
                </th>
                <th scope="col" className="px-3 md:px-6 py-3 md:py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Stok Saat Ini
                </th>
                <th scope="col" className="px-3 md:px-6 py-3 md:py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Status</th>
                <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Stok Masuk
                </th>
                <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Stok Keluar
                </th>
                <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Nilai Stok
                </th>
                <th scope="col" className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Turnover
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-black">
                    <Package className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada data inventaris</p>
                  </td>
                </tr>
              ) : (
                pageSlice.map((item) => {
                  const status = item.currentStock <= 0 ? 'HABIS' : item.currentStock <= 10 ? 'RENDAH' : 'AMAN';
                  const statusClass =
                    status === 'HABIS' ? 'bg-red-100 text-red-700' :
                    status === 'RENDAH' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700';
                  const img = item.imageUrl && item.imageUrl.length ? item.imageUrl : 'https://placehold.co/80x80/edf2f7/667085?text=IMG';
                  return (
                  <tr key={item.id} className="hover:bg-gray-50 odd:bg-gray-50/40">
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                        <Image src={img} alt={item.name} fill className="object-cover" />
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-black">{item.name}</td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-black">{item.category}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`font-medium ${item.currentStock <= 10 ? 'text-red-600' : 'text-black'
                        }`}>
                        {item.currentStock}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${statusClass}`}>{status}</span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-black">{item.stockIn}</td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-black">{item.stockOut}</td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-black">
                      Rp{item.stockValue.toLocaleString('id-ID')}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {item.turnoverRate > 0.5 ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <TrendingUp size={16} />
                          Cepat
                        </span>
                      ) : item.turnoverRate > 0.2 ? (
                        <span className="text-yellow-600">Sedang</span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <TrendingDown size={16} />
                          Lambat
                        </span>
                      )}
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
