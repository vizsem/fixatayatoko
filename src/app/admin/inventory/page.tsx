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
  Calendar
} from 'lucide-react';

// ✅ Gunakan import yang sudah ada di lib/firebase
import { auth, db } from '@/lib/firebase';

type Product = {
  id: string;
  name: string;
  stock: number;
  stockByWarehouse?: Record<string, number>;
  category: string;
  unit: string;
  barcode?: string;
  expiredDate?: string;
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
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  // Proteksi admin
  useEffect(() => {
    // ✅ Gunakan 'auth' dan 'db' yang di-import dari @/lib/firebase
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

  // Fetch data real-time
  useEffect(() => {
    if (loading) return;

    // ✅ Fetch products menggunakan 'db' dari import
    const productsUnsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productList: Product[] = [];
      let lowStock = 0;
      let expired = 0;
      let totalVal = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const product: Product = {
          id: doc.id,
          name: data.name || '',
          stock: data.stock || 0,
          stockByWarehouse: data.stockByWarehouse || {},
          category: data.category || '',
          unit: data.unit || '',
          barcode: data.barcode,
          expiredDate: data.expiredDate
        };

        if (product.stock <= 10 && product.stock > 0) {
          lowStock++;
        }

        if (product.expiredDate && new Date(product.expiredDate) <= new Date()) {
          expired++;
        }

        const purchasePrice = (data.price || 0) * 0.8;
        totalVal += product.stock * purchasePrice;

        productList.push(product);
      });

      setProducts(productList);
      setLowStockCount(lowStock);
      setExpiredCount(expired);
      setTotalValue(totalVal);
    });

    // Fetch warehouses
    const warehousesUnsub = onSnapshot(collection(db, 'warehouses'), (snapshot) => {
      const warehouseList: Warehouse[] = [];
      snapshot.docs.forEach((doc) => {
        warehouseList.push({
          id: doc.id,
          name: doc.data().name || ''
        });
      });
      setWarehouses(warehouseList);
    });

    return () => {
      productsUnsub();
      warehousesUnsub();
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data inventaris...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Manajemen Inventaris</h1>
        <p className="text-black">Kelola stok, mutasi, dan opname barang Anda</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Produk</p>
              <p className="text-2xl font-bold mt-1">{products.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Package className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Nilai Stok</p>
              <p className="text-2xl font-bold mt-1">Rp{totalValue.toLocaleString('id-ID')}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <ArrowDown className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Stok Rendah</p>
              <p className="text-2xl font-bold mt-1">{lowStockCount}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <AlertTriangle className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Kadaluarsa</p>
              <p className="text-2xl font-bold mt-1">{expiredCount}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <Calendar className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Link href="/admin/inventory/stock-in" className="block">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
            <div className="bg-green-100 p-2 rounded-lg w-10 h-10 flex items-center justify-center mb-3">
              <ArrowDown className="text-green-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-1">Stok Masuk</h3>
            <p className="text-sm text-black">Pembelian dari supplier</p>
          </div>
        </Link>
        
        <Link href="/admin/inventory/stock-out" className="block">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
            <div className="bg-red-100 p-2 rounded-lg w-10 h-10 flex items-center justify-center mb-3">
              <ArrowUp className="text-red-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-1">Stok Keluar</h3>
            <p className="text-sm text-black">Penjualan & retur</p>
          </div>
        </Link>
        
        <Link href="/admin/inventory/transfer" className="block">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
            <div className="bg-purple-100 p-2 rounded-lg w-10 h-10 flex items-center justify-center mb-3">
              <ArrowRightLeft className="text-purple-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-1">Mutasi Stok</h3>
            <p className="text-sm text-black">Transfer antar gudang</p>
          </div>
        </Link>
        
        <Link href="/admin/inventory/opname" className="block">
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow">
            <div className="bg-orange-100 p-2 rounded-lg w-10 h-10 flex items-center justify-center mb-3">
              <RotateCcw className="text-orange-600" size={20} />
            </div>
            <h3 className="font-semibold text-black mb-1">Stok Opname</h3>
            <p className="text-sm text-black">Sesuaikan stok fisik</p>
          </div>
        </Link>
      </div>

      {/* Tabel Inventaris */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-black">Daftar Produk</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Stok</th>
                {warehouses.length > 1 && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Per Gudang</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => {
                const isLowStock = product.stock <= 10 && product.stock > 0;
                const isExpired = product.expiredDate && new Date(product.expiredDate) <= new Date();
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-black">{product.name}</div>
                      {product.barcode && <div className="text-xs text-black">#{product.barcode}</div>}
                    </td>
                    <td className="px-6 py-4 text-black">{product.category}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className={`${isExpired || isLowStock ? 'text-red-600 font-bold' : 'text-black'}`}>
                          {product.stock} {product.unit}
                        </span>
                      </div>
                    </td>
                    {warehouses.length > 1 && (
                      <td className="px-6 py-4 text-sm text-black">
                        {warehouses.map(w => (
                          <div key={w.id}>{w.name}: {product.stockByWarehouse?.[w.id] || 0}</div>
                        ))}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm">
                      <Link href={`/admin/products/edit/${product.id}`} className="text-blue-600">Edit</Link>
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