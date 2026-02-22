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
import { 
  Package, 
  Download,
  AlertTriangle,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  stockIn: number;
  stockOut: number;
  turnoverRate: number;
  stockValue: number;
};

export default function InventoryReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        toast.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchInventoryData = async () => {
      try {
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const inventoryList: InventoryItem[] = [];
        
        // Ambil data transaksi untuk perhitungan mutasi
        const transactionsSnapshot = await getDocs(collection(db, 'inventory_transactions'));
        const transactions = transactionsSnapshot.docs.map(doc => doc.data());
        
        productsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const productId = doc.id;
          
          // Hitung stok masuk & keluar dari transaksi
          const stockIn = transactions
            .filter(t => t.productId === productId && t.type === 'STOCK_IN')
            .reduce((sum, t) => sum + t.quantity, 0);
            
          const stockOut = transactions
            .filter(t => t.productId === productId && t.type === 'STOCK_OUT')
            .reduce((sum, t) => sum + t.quantity, 0);
          
          // Asumsikan harga beli 80% dari harga jual
          const purchasePrice = (data.price || 0) * 0.8;
          const stockValue = (data.stock || 0) * purchasePrice;
          
          // Hitung turnover rate (sederhana: stockOut / currentStock)
          const turnoverRate = data.stock > 0 ? stockOut / data.stock : 0;
          
          inventoryList.push({
            id: doc.id,
            name: data.name || '',
            category: data.category || '',
            currentStock: data.stock || 0,
            stockIn,
            stockOut,
            turnoverRate,
            stockValue
          });
        });
        
        setInventory(inventoryList);
      } catch (err) {
        console.error('Gagal memuat laporan inventaris:', err);
      }
    };

    fetchInventoryData();
  }, []);

  const handleExport = () => {
    const exportData = inventory.map(item => ({
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan inventaris...</p>
        </div>
      </div>
    );
  }

  const totalItems = inventory.reduce((sum, item) => sum + item.currentStock, 0);
  const lowStockItems = inventory.filter(item => item.currentStock <= 10).length;
  const totalValue = inventory.reduce((sum, item) => sum + item.stockValue, 0);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Laporan Inventaris</h1>
        <p className="text-black">Analisis stok & perputaran produk ATAYATOKO2</p>
      </div>

      <div className="flex justify-end mb-6">
        <button
          onClick={handleExport}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Download size={18} />
          Ekspor Excel
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
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-black">Detail Inventaris</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Produk
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Kategori
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Stok Saat Ini
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Stok Masuk
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Stok Keluar
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Nilai Stok
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Turnover
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-black">
                    <Package className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada data inventaris</p>
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-black">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        item.currentStock <= 10 ? 'text-red-600' : 'text-black'
                      }`}>
                        {item.currentStock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{item.stockIn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{item.stockOut}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      Rp{item.stockValue.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import * as XLSX from 'xlsx';
