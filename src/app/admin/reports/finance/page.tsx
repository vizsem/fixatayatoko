// src/app/(admin)/reports/finance/page.tsx
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
  where,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import {
  CreditCard,
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import notify from '@/lib/notify';


type FinancialRecord = {
  id: string;
  date: string;
  description: string;
  category: string;
  type: 'income' | 'expense' | 'profit';
  amount: number;
  cost?: number;
  profit?: number;
  paymentMethod: string;
  channel?: string;
};

export default function FinanceReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
    const fetchFinanceData = async () => {
      try {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        // Ambil semua order selesai (jenis status selesai), filter tanggal di sisi klien supaya aman untuk field createdAt yang bertipe string/Timestamp
        const salesSnapshot = await getDocs(
          query(
            collection(db, 'orders'),
            where('status', 'in', ['SELESAI', 'SUCCESS'])
          )
        );

        // Ambil data produk untuk harga beli
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productsMap = new Map<string, Record<string, unknown>>();
          productsSnapshot.docs.forEach(docSnap => {
            productsMap.set(docSnap.id, docSnap.data() as Record<string, unknown>);
        });

        const financeRecords: FinancialRecord[] = [];

        // Proses penjualan dengan perhitungan profit (filter tanggal di sini)
        for (const orderDoc of salesSnapshot.docs) {
          const order = orderDoc.data() as {
            createdAt?: Timestamp | string;
            total?: number;
            payment?: { method?: string };
            paymentMethod?: string;
            items?: { id?: string; productId?: string; price: number; quantity: number }[];
            channel?: string;
          };
          const created =
            order.createdAt instanceof Timestamp
              ? order.createdAt.toDate()
              : new Date(order.createdAt || new Date().toISOString());
          if (!(created >= startDate && created <= endDate)) continue;

          let totalCost = 0;
          let totalProfit = 0;

          // Hitung biaya & profit berdasarkan harga beli
          for (const item of order.items || []) {
            const product = productsMap.get(item.id || '') || productsMap.get(item.productId || '');
            // Gunakan field 'Modal' dari produk, fallback ke purchasePrice, lalu estimasi 80%
            const modalPrice = Number(
              (product && (product.Modal as number | undefined)) ??
              (product && (product.purchasePrice as number | undefined)) ??
              0
            );
            const sellingPrice = Number(item.price);
            
            // Jika modal 0, gunakan estimasi margin 10% (be conservative) -> Modal = 90% Harga Jual
            // Atau tetap 80% sesuai kode lama
            const purchasePrice = modalPrice > 0 ? modalPrice : sellingPrice * 0.85;
            
            const itemCost = purchasePrice * item.quantity;
            const itemProfit = (sellingPrice * item.quantity) - itemCost;

            totalCost += itemCost;
            totalProfit += itemProfit;
          }

          financeRecords.push({
            id: orderDoc.id,
            date: created.toISOString(),
            description: `Penjualan #${orderDoc.id.substring(0, 8)}`,
            category: 'Penjualan',
            type: 'profit',
            amount: Number(order.total || 0),
            cost: totalCost,
            profit: totalProfit,
            paymentMethod: order.payment?.method || order.paymentMethod || 'CASH',
            channel: order.channel || 'OFFLINE'
          });
        }

        // Ambil semua pembelian, lalu filter tanggal di sisi klien (untuk konsistensi tipe createdAt)
        const purchasesSnapshot = await getDocs(collection(db, 'purchases'));

        purchasesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const created =
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : new Date(data.createdAt || new Date().toISOString());
          if (!(created >= startDate && created <= endDate)) return;
          financeRecords.push({
            id: `PUR-${doc.id}`,
            date: created.toISOString(),
            description: `Pembelian dari ${data.supplierName}`,
            category: 'Pembelian',
            type: 'expense',
            amount: Number(data.total || 0),
            paymentMethod: data.paymentMethod || 'TRANSFER'
          });
        });

        // Urutkan berdasarkan tanggal (terbaru dulu)
        financeRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setRecords(financeRecords);
      } catch {
        // Error is logged to console
      }

    };

    fetchFinanceData();
  }, [dateRange]);

  const handleExport = () => {
    const exportData = records.map(record => ({
      Tanggal: new Date(record.date).toLocaleDateString('id-ID'),
      Deskripsi: record.description,
      Kategori: record.category,
      Pendapatan: record.type === 'profit' ? record.amount : 0,
      'Biaya Pokok': record.cost || 0,
      Laba: record.profit || 0,
      Pengeluaran: record.type === 'expense' ? record.amount : 0,
      'Metode Bayar': record.paymentMethod
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Keuangan');
    XLSX.writeFile(wb, `laporan-keuangan-${dateRange.startDate}-sampai-${dateRange.endDate}.xlsx`);
  };

  // Pagination logic - moved before conditional return
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return records.slice(startIndex, startIndex + itemsPerPage);
  }, [records, currentPage]);

  const totalPages = Math.ceil(records.length / itemsPerPage);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan keuangan...</p>
        </div>
      </div>
    );
  }

  // Hitung total berdasarkan tipe record
  const totalIncome = records
    .filter(r => r.type === 'profit')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalCost = records
    .filter(r => r.type === 'profit')
    .reduce((sum, r) => sum + (r.cost || 0), 0);

  const totalProfit = records
    .filter(r => r.type === 'profit')
    .reduce((sum, r) => sum + (r.profit || 0), 0);

  const totalExpense = records
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const netProfit = totalProfit - totalExpense;

  const channels: string[] = ['OFFLINE', 'WEBSITE', 'SHOPEE', 'TIKTOK'];

  const channelSummary = channels.map(channel => {
    const channelRecords = records.filter(
      r => r.type === 'profit' && (r.channel || 'OFFLINE') === channel,
    );

    const revenue = channelRecords.reduce((sum, r) => sum + r.amount, 0);
    const cost = channelRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    const profit = channelRecords.reduce((sum, r) => sum + (r.profit || 0), 0);

    return {
      channel,
      revenue,
      cost,
      profit,
    };
  });

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      {/* Header Section */}
      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-3xl shadow-lg">
            <CreditCard size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Laporan Keuangan</h1>
            <p className="text-xs font-semibold text-gray-500 mt-1">Analisis profitabilitas & arus kas bisnis</p>
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Akhir</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all duration-200"
            >
              <Download size={18} className="mr-2" />
              Ekspor Laporan
            </button>
          </div>
        </div>
      </div>

      {/* Financial Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Pendapatan</p>
              <p className="text-2xl md:text-3xl font-black text-green-600 mt-1">
                Rp{totalIncome.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-green-100 text-green-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Biaya Pokok</p>
              <p className="text-2xl md:text-3xl font-black text-red-600 mt-1">
                Rp{totalCost.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Laba Kotor</p>
              <p className={`text-2xl font-bold mt-1 ${totalProfit >= 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                Rp{totalProfit.toLocaleString('id-ID')}
              </p>
            </div>
            <div className={`p-3 rounded-full ${totalProfit >= 0 ? 'bg-blue-100' : 'bg-red-100'
              }`}>
              <Package className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Pengeluaran</p>
              <p className="text-2xl md:text-3xl font-black text-orange-600 mt-1">
                Rp{totalExpense.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
              <CreditCard size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Laba Bersih</p>
              <p className={`text-2xl md:text-3xl font-black mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                Rp{netProfit.toLocaleString('id-ID')}
              </p>
            </div>
            <div className={`p-3 rounded-2xl ${netProfit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
              {netProfit >= 0 ? (
                <TrendingUp size={24} />
              ) : (
                <TrendingDown size={24} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ringkasan Laba per Channel */}
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Ringkasan Laba per Channel</h2>
            <p className="text-xs text-gray-500 mt-1">
              Menggunakan Harga Modal/HPP dari produk dan harga jual per channel.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {channelSummary.map(summary => (
            <div
              key={summary.channel}
              className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  {summary.channel}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-gray-500">Pendapatan</p>
                <p className="text-sm font-bold text-green-600">
                  Rp{summary.revenue.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-gray-500">HPP (Modal)</p>
                <p className="text-sm font-bold text-red-600">
                  Rp{summary.cost.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-gray-500">Laba Kotor</p>
                <p
                  className={`text-sm font-extrabold ${
                    summary.profit >= 0 ? 'text-blue-600' : 'text-red-600'
                  }`}
                >
                  Rp{summary.profit.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Table Section */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Detail Transaksi Keuangan</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Pendapatan
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Biaya Pokok
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Laba
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Pengeluaran
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Metode Bayar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <CreditCard className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 font-medium">Tidak ada data keuangan dalam periode ini</p>
                      <p className="text-sm text-gray-400 mt-1">Coba ubah filter tanggal untuk melihat data</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(record.date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{record.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {record.type === 'profit' ? `Rp${record.amount.toLocaleString('id-ID')}` : '–'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-red-600">
                      {record.cost ? `Rp${record.cost.toLocaleString('id-ID')}` : '–'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      {record.profit ? (
                        <span className={`text-sm font-bold ${record.profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                          Rp{record.profit.toLocaleString('id-ID')}
                        </span>
                      ) : '–'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                      {record.type === 'expense' ? `Rp${record.amount.toLocaleString('id-ID')}` : '–'}
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {record.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Menampilkan <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> -{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, records.length)}
                </span>{' '}
                dari <span className="font-medium">{records.length}</span> transaksi
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                        currentPage === page
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Package size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-black">
            <p className="font-medium">Catatan Perhitungan:</p>
            <ul className="list-disc list-inside text-sm mt-1 space-y-1">
              <li><strong>Biaya Pokok (HPP)</strong> menggunakan data Harga Modal dari database produk.</li>
              <li>Jika Harga Modal bernilai 0, sistem mengestimasi HPP sebesar 85% dari harga jual.</li>
              <li><strong>Laba Kotor</strong> = Pendapatan Penjualan dikurangi Biaya Pokok (HPP).</li>
              <li><strong>Laba Bersih</strong> = Laba Kotor dikurangi Pengeluaran Operasional (Pembelian Stok, dll).</li>
              <li>Data hanya mencakup transaksi dengan status <strong>SELESAI</strong>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
