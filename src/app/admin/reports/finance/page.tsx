// src/app/(admin)/reports/finance/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
import * as XLSX from 'xlsx';
import {
  CreditCard,
  Download,
  TrendingUp,
  TrendingDown,
  Package
} from 'lucide-react';


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
};

export default function FinanceReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

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
    const fetchFinanceData = async () => {
      try {
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        // Ambil data penjualan
        const salesSnapshot = await getDocs(
          query(
            collection(db, 'orders'),
            where('createdAt', '>=', startDate.toISOString()),
            where('createdAt', '<=', endDate.toISOString()),
            where('status', '==', 'SELESAI')
          )
        );

        // Ambil data produk untuk harga beli
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const productsMap = new Map();
        productsSnapshot.docs.forEach(doc => {
          productsMap.set(doc.id, doc.data());
        });

        const financeRecords: FinancialRecord[] = [];

        // Proses penjualan dengan perhitungan profit
        for (const orderDoc of salesSnapshot.docs) {
          const order = orderDoc.data();
          let totalCost = 0;
          let totalProfit = 0;

          // Hitung biaya & profit berdasarkan harga beli
          for (const item of order.items || []) {
            const product = productsMap.get(item.id) || productsMap.get(item.productId);
            const purchasePrice = product?.purchasePrice || (item.price * 0.8); // fallback 80%
            const itemCost = purchasePrice * item.quantity;
            const itemProfit = (item.price * item.quantity) - itemCost;

            totalCost += itemCost;
            totalProfit += itemProfit;
          }

          financeRecords.push({
            id: orderDoc.id,
            date: order.createdAt,
            description: `Penjualan #${orderDoc.id.substring(0, 8)}`,
            category: 'Penjualan',
            type: 'profit',
            amount: order.total, // Pendapatan
            cost: totalCost,     // Biaya Pokok Penjualan
            profit: totalProfit, // Laba Kotor
            paymentMethod: order.paymentMethod
          });
        }

        // Ambil data pembelian (pengeluaran)
        const purchasesSnapshot = await getDocs(
          query(
            collection(db, 'purchases'),
            where('createdAt', '>=', startDate.toISOString()),
            where('createdAt', '<=', endDate.toISOString())
          )
        );

        purchasesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          financeRecords.push({
            id: `PUR-${doc.id}`,
            date: data.createdAt,
            description: `Pembelian dari ${data.supplierName}`,
            category: 'Pembelian',
            type: 'expense',
            amount: data.total,
            paymentMethod: data.paymentMethod
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

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Laporan Keuangan</h1>
        <p className="text-black">Analisis profitabilitas & arus kas ATAYATOKO2</p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-1">Periode Mulai</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-1">Periode Akhir</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
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

      {/* Statistik Profitabilitas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Pendapatan</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                Rp{totalIncome.toLocaleString('id-ID')}
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
              <p className="text-sm text-black">Biaya Pokok</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                Rp{totalCost.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Laba Kotor</p>
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
              <p className="text-sm text-black">Pengeluaran</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">
                Rp{totalExpense.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <CreditCard className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Laba Bersih</p>
              <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                Rp{netProfit.toLocaleString('id-ID')}
              </p>
            </div>
            <div className={`p-3 rounded-full ${netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
              {netProfit >= 0 ? (
                <TrendingUp className="text-green-600" size={24} />
              ) : (
                <TrendingDown className="text-red-600" size={24} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-black">Detail Transaksi</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Tanggal
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Deskripsi
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pendapatan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Biaya Pokok
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Laba
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pengeluaran
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Metode Bayar
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-black">
                    <CreditCard className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Tidak ada data keuangan dalam periode ini</p>
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {new Date(record.date).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{record.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {record.type === 'profit' ? `Rp${record.amount.toLocaleString('id-ID')}` : '–'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {record.cost ? `Rp${record.cost.toLocaleString('id-ID')}` : '–'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.profit ? (
                        <span className={`font-medium ${record.profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                          Rp{record.profit.toLocaleString('id-ID')}
                        </span>
                      ) : '–'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {record.type === 'expense' ? `Rp${record.amount.toLocaleString('id-ID')}` : '–'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">{record.paymentMethod}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <Package size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-black">
            <p className="font-medium">Catatan Perhitungan:</p>
            <ul className="list-disc list-inside text-sm mt-1 space-y-1">
              <li><strong>Biaya Pokok Penjualan</strong> dihitung berdasarkan <strong>harga beli</strong> dari supplier</li>
              <li><strong>Laba Kotor</strong> = Pendapatan - Biaya Pokok</li>
              <li><strong>Laba Bersih</strong> = Laba Kotor - Pengeluaran Operasional</li>
              <li>Data hanya mencakup transaksi dengan status <strong>SELESAI</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
