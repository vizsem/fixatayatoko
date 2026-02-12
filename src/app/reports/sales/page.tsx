// src/app/(admin)/reports/sales/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  TrendingUp, 
  Download,
  Package,
  CreditCard
} from 'lucide-react';

type SaleItem = {
  id: string;
  date: string;
  productName: string;
  quantity: number;
  total: number;
  paymentMethod: string;
  customerName: string;
};

export default function SalesReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'quantity'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        alert('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        
        const ordersSnapshot = await getDocs(
          query(
            collection(db, 'orders'),
            where('createdAt', '>=', startDate.toISOString()),
            where('createdAt', '<=', endDate.toISOString()),
            where('status', '==', 'SELESAI')
          )
        );

        const salesList: SaleItem[] = [];
        for (const orderDoc of ordersSnapshot.docs) {
          const order = orderDoc.data();
          for (const item of order.items || []) {
            salesList.push({
              id: orderDoc.id,
              date: order.createdAt,
              productName: item.name,
              quantity: item.quantity,
              total: item.price * item.quantity,
              paymentMethod: order.paymentMethod,
              customerName: order.customerName || 'Pelanggan'
            });
          }
        }
        setSales(salesList);
      } catch (err) {
        console.error('Gagal memuat laporan penjualan:', err);
      }
    };

    fetchSalesData();
  }, [dateRange]);

  const sortedSales = useMemo(() => {
    return [...sales].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (sortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
  }, [sales, sortBy, sortOrder]);

  const handleExport = () => {
    const exportData = sortedSales.map(sale => ({
      Tanggal: new Date(sale.date).toLocaleDateString('id-ID'),
      Produk: sale.productName,
      Kuantitas: sale.quantity,
      Total: sale.total,
      'Metode Bayar': sale.paymentMethod,
      Pelanggan: sale.customerName
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Penjualan');
    XLSX.writeFile(wb, `laporan-penjualan-${dateRange.startDate}-sampai-${dateRange.endDate}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan penjualan...</p>
        </div>
      </div>
    );
  }

  const totalSales = sortedSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalItems = sortedSales.reduce((sum, sale) => sum + sale.quantity, 0);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Laporan Penjualan</h1>
        <p className="text-black">Analisis penjualan produk ATAYATOKO2</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Periode Mulai</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Periode Akhir</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded text-black"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Ekspor Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Penjualan</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                Rp{totalSales.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Item Terjual</p>
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
              <p className="text-sm text-black">Jumlah Transaksi</p>
              <p className="text-2xl font-bold mt-1">{new Set(sales.map(s => s.id)).size}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <CreditCard className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Detail Penjualan</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-black">Urutkan:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'total' | 'quantity')}
                className="text-sm border border-gray-300 rounded px-2 py-1 text-black"
              >
                <option value="date">Tanggal</option>
                <option value="total">Total</option>
                <option value="quantity">Kuantitas</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-sm bg-gray-200 px-2 py-1 rounded text-black"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Tanggal
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Produk
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Kuantitas
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Metode Bayar
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pelanggan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-black">
                    <TrendingUp className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Tidak ada data penjualan dalam periode ini</p>
                  </td>
                </tr>
              ) : (
                sortedSales.map((sale, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {new Date(sale.date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{sale.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{sale.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      Rp{sale.total.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{sale.paymentMethod}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{sale.customerName}</td>
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

declare const XLSX: typeof import('xlsx');
