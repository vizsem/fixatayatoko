// src/app/admin/reports/customers/page.tsx
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
  Users,
  TrendingUp,
  CreditCard,
  Download,
  AlertTriangle
} from 'lucide-react';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';


type Customer = {
  id: string;
  name: string;
  phone: string;
  type: 'grosir' | 'ecer';
  creditLimit: number;
  outstandingDebt: number;
  totalSpent: number;
  orderCount: number;
  lastOrderDate?: string;
};

export default function CustomerReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [customerType, setCustomerType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [sortBy, setSortBy] = useState<'totalSpent' | 'outstandingDebt' | 'orderCount'>('totalSpent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredCustomers = useMemo(() => {
    let result = [...customers];
    if (customerType !== 'all') {
      result = result.filter(c => c.type === customerType);
    }
    result.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (sortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });
    return result;
  }, [customerType, sortBy, sortOrder, customers]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);


  // Proteksi admin
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

  // Fetch data laporan
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        // Ambil data pelanggan
        const customersSnapshot = await getDocs(collection(db, 'customers'));
        const customerList: Customer[] = [];

        // Ambil data pesanan untuk analisis
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        const ordersSnapshot = await getDocs(
          query(
            collection(db, 'orders'),
            where('createdAt', '>=', startDate.toISOString()),
            where('createdAt', '<=', endDate.toISOString())
          )
        );
        const orders = ordersSnapshot.docs.map(doc => doc.data());

        customersSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const customerId = doc.id;

          // Filter pesanan berdasarkan periode & pelanggan
          const customerOrders = orders.filter(order => order.customerId === customerId);
          const totalSpent = customerOrders.reduce((sum, order) => sum + order.total, 0);
          const orderCount = customerOrders.length;

          // Piutang (pesanan belum selesai)
          const outstandingOrders = customerOrders.filter(
            order => order.status !== 'SELESAI' && order.status !== 'DIBATALKAN'
          );
          const outstandingDebt = outstandingOrders.reduce((sum, order) => sum + order.total, 0);

          // Tanggal pesanan terakhir
          const lastOrderDate = customerOrders.length > 0
            ? customerOrders.reduce((latest, order) =>
              new Date(order.createdAt) > new Date(latest) ? order.createdAt : latest
              , customerOrders[0].createdAt)
            : undefined;

          customerList.push({
            id: doc.id,
            name: data.name || '',
            phone: data.phone || '',
            type: data.type || 'ecer',
            creditLimit: data.creditLimit || 0,
            outstandingDebt,
            totalSpent,
            orderCount,
            lastOrderDate
          });
        });

        setCustomers(customerList);

      } catch (err) {
        console.error('Gagal memuat laporan:', err);
      }
    };

    fetchReportData();
  }, [dateRange]);



  // Ekspor ke Excel
  const handleExport = () => {
    const exportData = filteredCustomers.map(customer => ({
      Nama: customer.name,
      Telepon: customer.phone,
      Jenis: customer.type === 'grosir' ? 'Grosir' : 'Ecer',
      'Total Belanja': customer.totalSpent,
      'Frekuensi Transaksi': customer.orderCount,
      Piutang: customer.outstandingDebt,
      'Limit Kredit': customer.creditLimit,
      'Melebihi Limit': customer.outstandingDebt > customer.creditLimit && customer.creditLimit > 0 ? 'Ya' : 'Tidak'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Pelanggan');
    XLSX.writeFile(wb, `laporan-pelanggan-${dateRange.startDate}-sampai-${dateRange.endDate}.xlsx`);
  };

  const isOverLimit = (customer: Customer) => {
    return customer.outstandingDebt > customer.creditLimit && customer.creditLimit > 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan pelanggan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <Toaster position="top-right" />
      
      {/* Header Section */}
      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-3xl shadow-lg">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Laporan Pelanggan</h1>
            <p className="text-xs font-semibold text-gray-500 mt-1">Analisis perilaku & kinerja pelanggan</p>
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
        <h3 className="text-lg font-bold text-gray-900 mb-4">Filter Laporan</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Mulai</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tanggal Akhir</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Jenis Pelanggan</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">Semua Pelanggan</option>
              <option value="grosir">Grosir</option>
              <option value="ecer">Eceran</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:shadow-lg transition-all duration-200"
            >
              <Download size={18} className="mr-2" />
              Ekspor Laporan
            </button>
          </div>
        </div>
      </div>

      {/* Customer Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Total Pelanggan</p>
              <p className="text-2xl md:text-3xl font-black text-blue-600 mt-1">{filteredCustomers.length}</p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Pelanggan Aktif</p>
              <p className="text-2xl md:text-3xl font-black text-green-600 mt-1">
                {filteredCustomers.filter(c => c.orderCount > 0).length}
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
              <p className="text-sm font-semibold text-gray-500">Total Piutang</p>
              <p className="text-2xl md:text-3xl font-black text-red-600 mt-1">
                Rp{filteredCustomers.reduce((sum, c) => sum + c.outstandingDebt, 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
              <CreditCard size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500">Melebihi Limit</p>
              <p className="text-2xl md:text-3xl font-black text-orange-600 mt-1">
                {filteredCustomers.filter(isOverLimit).length}
              </p>
            </div>
            <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Data Table Section */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Daftar Pelanggan</h2>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Urutkan:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'totalSpent' | 'outstandingDebt' | 'orderCount')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="totalSpent">Total Belanja</option>
                <option value="outstandingDebt">Piutang</option>
                <option value="orderCount">Frekuensi Transaksi</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full min-w-[720px] md:min-w-0">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Pelanggan
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Jenis
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Total Belanja
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Frekuensi
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Piutang
                </th>
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Limit Kredit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                      <Users className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 font-medium">Tidak ada data pelanggan dalam periode ini</p>
                      <p className="text-sm text-gray-400 mt-1">Coba ubah filter tanggal untuk melihat data</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500">{customer.phone}</div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${customer.type === 'grosir'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                        }`}>
                        {customer.type === 'grosir' ? 'Grosir' : 'Ecer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-green-600" />
                        <span className="font-semibold text-green-600">
                          Rp{customer.totalSpent.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        {customer.orderCount}x
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                      <span className={`font-semibold ${isOverLimit(customer) ? 'text-red-600' : 'text-gray-700'
                        }`}>
                        Rp{customer.outstandingDebt.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-gray-600">
                      {customer.creditLimit > 0
                        ? `Rp${customer.creditLimit.toLocaleString('id-ID')}`
                        : '–'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isOverLimit(customer) ? (
                        <span className="flex items-center gap-2 text-sm font-semibold text-red-600">
                          <AlertTriangle size={14} />
                          Melebihi Limit
                        </span>
                      ) : customer.outstandingDebt > 0 ? (
                        <span className="text-sm font-semibold text-orange-600">Berutang</span>
                      ) : (
                        <span className="text-sm font-semibold text-green-600">Lunas</span>
                      )}
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
                Menampilkan {Math.min(filteredCustomers.length, (currentPage - 1) * itemsPerPage + 1)}-
                {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} dari {filteredCustomers.length} pelanggan
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 text-sm font-medium rounded-lg ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Keterangan Laporan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 w-2 h-2 bg-blue-600 rounded-full"></div>
            <div>
              <p className="font-medium text-blue-900">Pelanggan Aktif</p>
              <p className="text-sm text-blue-700">Memiliki minimal 1 transaksi dalam periode yang dipilih</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-1 w-2 h-2 bg-red-600 rounded-full"></div>
            <div>
              <p className="font-medium text-blue-900">Melebihi Limit</p>
              <p className="text-sm text-blue-700">Piutang &gt; Limit Kredit yang ditetapkan</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-1 w-2 h-2 bg-green-600 rounded-full"></div>
            <div>
              <p className="font-medium text-blue-900">Total Belanja</p>
              <p className="text-sm text-blue-700">Hanya mencakup transaksi dengan status <strong>SELESAI</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
