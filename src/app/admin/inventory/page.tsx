'use client';

// ✅ Nonaktifkan prerendering — hanya render di client
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import Link from 'next/link';
import { 
  Package, 
  ArrowDown, 
  ArrowUp, 
  ArrowRightLeft,
  RotateCcw,
  AlertTriangle,
  Calendar,
  Search,
  History,
  LayoutDashboard,
  ChevronRight,
  Barcode,
  TrendingUp
} from 'lucide-react';

// ✅ Gunakan import yang sudah ada di lib/firebase
import { auth, db } from '@/lib/firebase';

// --- Types ---
type Product = {
  id: string;
  name: string;
  stock: number;
  stockByWarehouse?: Record<string, number>;
  category: string;
  unit: string;
  barcode?: string;
  expiredDate?: string;
  purchasePrice?: number; // Opsional untuk keamanan TS
};

type Warehouse = {
  id: string;
  name: string;
};

export default function InventoryDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');

  // 1. Proteksi Admin
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
          alert('Akses ditolak! Anda bukan admin.');
          router.push('/profil');
          return;
        }
        setLoading(false);
      } catch (error) {
        console.error("Error checking admin status:", error);
        router.push('/profil');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch data real-time dengan Proteksi Data
  useEffect(() => {
    if (loading) return;

    // Fetch products
    const productsUnsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      let lowStock = 0;
      let expired = 0;
      let totalVal = 0;

      const productList: Product[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        
        // Proteksi: Gunakan Fallback untuk menghindari error undefined
        const product: Product = {
          id: doc.id,
          name: data.name || 'Produk Tanpa Nama',
          stock: Number(data.stock) || 0,
          stockByWarehouse: data.stockByWarehouse || {},
          category: data.category || 'Umum',
          unit: data.unit || 'pcs',
          barcode: data.barcode || '',
          expiredDate: data.expiredDate || null,
          purchasePrice: Number(data.purchasePrice) || Number(data.price * 0.8) || 0
        };

        if (product.stock <= 10 && product.stock > 0) lowStock++;
        if (product.expiredDate && new Date(product.expiredDate) <= new Date()) expired++;
        
        // ✅ Perbaikan untuk Build Error: Pastikan purchasePrice tidak undefined
        totalVal += product.stock * (product.purchasePrice || 0);

        return product;
      });

      setProducts(productList);
      setLowStockCount(lowStock);
      setExpiredCount(expired);
      setTotalValue(totalVal);
    });

    // Fetch warehouses
    const warehousesUnsub = onSnapshot(collection(db, 'warehouses'), (snapshot) => {
      const warehouseList: Warehouse[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || 'Gudang'
      }));
      setWarehouses(warehouseList);
    });

    return () => {
      productsUnsub();
      warehousesUnsub();
    };
  }, [loading]);

  // 3. Filter Logic (Aman dari error .toLowerCase)
  const filteredProducts = products.filter(p => {
    const name = p.name ? String(p.name).toLowerCase() : "";
    const barcode = p.barcode ? String(p.barcode).toLowerCase() : "";
    const search = searchTerm.toLowerCase();

    const matchesSearch = name.includes(search) || barcode.includes(search);
    const matchesWarehouse = selectedWarehouse === 'all' || 
                             (p.stockByWarehouse && (p.stockByWarehouse[selectedWarehouse] || 0) > 0);
    
    return matchesSearch && matchesWarehouse;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 font-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-black uppercase tracking-widest text-xs">Memuat Inventaris...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      
      {/* Header & Navigasi */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">Manajemen Inventaris</h1>
          <p className="text-gray-500 text-xs font-medium">Kelola stok, mutasi, dan opname barang secara real-time</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin" className="flex items-center gap-2 bg-white border px-4 py-2 rounded-xl text-[10px] font-black hover:bg-gray-50 transition shadow-sm">
            <LayoutDashboard size={14} /> DASHBOARD
          </Link>
          <Link href="/admin/inventory/history" className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-gray-800 transition shadow-md">
            <History size={14} /> RIWAYAT LOG
          </Link>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link href="/admin/inventory/stock-in" className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:border-emerald-500 transition-all group">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <ArrowDown size={20} />
          </div>
          <h3 className="text-xs font-black">STOK MASUK</h3>
          <p className="text-[9px] text-gray-400 font-bold">Barang dari Supplier</p>
        </Link>
        
        <Link href="/admin/inventory/stock-out" className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:border-red-500 transition-all group">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <ArrowUp size={20} />
          </div>
          <h3 className="text-xs font-black">STOK KELUAR</h3>
          <p className="text-[9px] text-gray-400 font-bold">Retur & Barang Rusak</p>
        </Link>
        
        <Link href="/admin/inventory/transfer" className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:border-blue-500 transition-all group">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <ArrowRightLeft size={20} />
          </div>
          <h3 className="text-xs font-black">MUTASI STOK</h3>
          <p className="text-[9px] text-gray-400 font-bold">Antar Gudang</p>
        </Link>
        
        <Link href="/admin/inventory/opname" className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:border-orange-500 transition-all group">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <RotateCcw size={20} />
          </div>
          <h3 className="text-xs font-black">STOK OPNAME</h3>
          <p className="text-[9px] text-gray-400 font-bold">Cek Fisik Berkala</p>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-3xl border shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total SKU</p>
          <p className="text-2xl font-black">{products.length}</p>
        </div>
        <div className="bg-emerald-600 p-5 rounded-3xl text-white shadow-lg shadow-emerald-100">
          <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Valuasi Stok</p>
          <p className="text-xl font-black leading-tight">Rp {totalValue.toLocaleString('id-ID')}</p>
        </div>
        <div className={`p-5 rounded-3xl border shadow-sm ${lowStockCount > 0 ? 'bg-amber-50 border-amber-200 animate-pulse' : 'bg-white'}`}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stok Tipis</p>
          <p className="text-2xl font-black text-amber-700">{lowStockCount}</p>
        </div>
        <div className={`p-5 rounded-3xl border shadow-sm ${expiredCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kadaluarsa</p>
          <p className="text-2xl font-black text-red-700">{expiredCount}</p>
        </div>
      </div>

      {/* Tabel Inventaris */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h2 className="font-black text-sm uppercase tracking-widest">Inventory List</h2>
            <select 
              className="bg-gray-50 border-none rounded-xl px-4 py-2 text-[10px] font-black outline-none focus:ring-2 focus:ring-black"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              <option value="all">SEMUA GUDANG</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>{wh.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
            <input 
              type="text" 
              placeholder="Cari nama atau barcode..." 
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 border-none text-sm font-medium outline-none focus:ring-2 focus:ring-black transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[9px] font-black text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="p-6">Produk</th>
                <th className="p-6">Kategori</th>
                <th className="p-6 text-center">Stok</th>
                {warehouses.length > 1 && <th className="p-6">Per Gudang</th>}
                <th className="p-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map((product) => {
                const isLow = product.stock <= 10 && product.stock > 0;
                return (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition-colors">
                          <Package size={20} />
                        </div>
                        <div>
                          <div className="font-black text-gray-900 leading-tight">{product.name}</div>
                          <div className="text-[9px] text-gray-400 font-bold flex items-center gap-1 mt-1 uppercase">
                            <Barcode size={10} /> {product.barcode || 'NO BARCODE'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase">
                        {product.category}
                      </span>
                    </td>
                    <td className="p-6 text-center">
                      <div className={`font-black text-sm ${isLow ? 'text-amber-600' : product.stock === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {product.stock} <span className="text-[10px] text-gray-400 font-bold">{product.unit}</span>
                      </div>
                    </td>
                    {warehouses.length > 1 && (
                      <td className="p-6">
                        <div className="space-y-1">
                          {warehouses.map(wh => (
                            <div key={wh.id} className="text-[9px] font-bold text-gray-400 flex justify-between w-32 border-b border-gray-50">
                              <span>{wh.name}:</span>
                              <span className="text-gray-900">{product.stockByWarehouse?.[wh.id] || 0}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    )}
                    <td className="p-6 text-center">
                      <Link 
                        href={`/admin/products/edit/${product.id}`}
                        className="p-2.5 bg-gray-50 text-gray-400 hover:bg-black hover:text-white rounded-xl transition-all inline-block shadow-sm"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}