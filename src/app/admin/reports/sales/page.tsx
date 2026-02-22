// src/app/(admin)/reports/sales/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';

import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  Download,
  Package,
  CreditCard
} from 'lucide-react';
import notify from '@/lib/notify';

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
  const [currentPage, setCurrentPage] = useState(1);

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


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
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

        // Ambil order selesai, filter tanggal di sisi klien (menghindari mismatch tipe Timestamp/string)
        const ordersSnapshot = await getDocs(
          query(
            collection(db, 'orders'),
            where('status', 'in', ['SELESAI', 'SUCCESS'])
          )
        );

        const salesList: SaleItem[] = [];
        for (const orderDoc of ordersSnapshot.docs) {
          const order = orderDoc.data();
          const created =
            order.createdAt?.toDate
              ? order.createdAt.toDate()
              : new Date(order.createdAt || new Date().toISOString());
          if (!(created >= startDate && created <= endDate)) continue;
          for (const item of order.items || []) {
            salesList.push({
              id: orderDoc.id,
              date: created.toISOString(),
              productName: String(item.name || ''),
              quantity: Number(item.quantity || 0),
              total: Number(item.price || 0) * Number(item.quantity || 0),
              paymentMethod: order.payment?.method || order.paymentMethod || 'CASH',
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

  // Pagination logic - moved before conditional return
  const itemsPerPage = 10;
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedSales.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedSales, currentPage]);

  const totalPages = Math.ceil(sortedSales.length / itemsPerPage);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      {/* Header Section */}
      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl shadow-lg">
            <TrendingUp size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Laporan Penjualan</h1>
            <p className="text-xs font-semibold text-gray-500 mt-1">Analisis performa & insights penjualan</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="bg-gradient-to-r from-gray-900 to-black text-white px-6 py-3.5 rounded-2xl text-sm font-bold hover:shadow-xl transition-all duration-200 flex items-center gap-2"
          >
            <Download size={18} /> Export Excel
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Total Penjualan</p>
              <p className="text-2xl md:text-3xl font-black text-gray-900 mt-1">
                Rp {totalSales.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-green-100 text-green-600 rounded-2xl">
              <CreditCard size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Total Items Terjual</p>
              <p className="text-2xl md:text-3xl font-black text-gray-900 mt-1">
                {totalItems.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Total Transaksi</p>
              <p className="text-2xl md:text-3xl font-black text-gray-900 mt-1">
                {new Set(sales.map(s => s.id)).size.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-6 rounded-3xl shadow-lg mb-8 border border-gray-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Filter Periode</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Mulai</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Akhir</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-700 text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all duration-200"
            >
              <Download size={18} />
              Ekspor Excel
            </button>
          </div>
        </div>
      </div>



      {/* Data Table Section */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Detail Transaksi Penjualan</h2>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Urutkan:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'total' | 'quantity')}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="date">Tanggal</option>
                  <option value="total">Total</option>
                  <option value="quantity">Kuantitas</option>
                </select>
              </div>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Qty
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Pembayaran
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Pelanggan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {sortedSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <TrendingUp className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 font-medium text-lg mb-2">Belum ada data penjualan</p>
                      <p className="text-gray-400 text-sm">Pilih periode lain untuk melihat laporan penjualan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(sale.date).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {sale.productName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-semibold">
                      {sale.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold">
                      Rp{sale.total.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sale.paymentMethod === 'CASH' 
                          ? 'bg-green-100 text-green-800'
                          : sale.paymentMethod === 'QRIS'
                          ? 'bg-blue-100 text-blue-800'
                          : sale.paymentMethod === 'TRANSFER'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {sale.customerName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer with Pagination */}
        {sortedSales.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                Menampilkan {Math.min(sortedSales.length, (currentPage - 1) * itemsPerPage + 1)}-
                {Math.min(currentPage * itemsPerPage, sortedSales.length)} dari {sortedSales.length} transaksi
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (page > totalPages) return null;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 text-sm rounded-lg ${
                          currentPage === page
                            ? 'bg-green-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
