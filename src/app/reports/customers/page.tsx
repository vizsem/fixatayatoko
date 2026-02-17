// src/app/(admin)/reports/customers/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
import { 
  Users, 
  TrendingUp, 
  CreditCard,
  Download,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

// 🔴 PERBAIKAN 1: Import XLSX secara dinamis (SSR-safe)
import * as XLSX from 'xlsx';

type Order = {
  id: string;
  customerId: string;
  total: number;
  status: string;
  createdAt: string;
  [key: string]: unknown;
};

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
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [customerType, setCustomerType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'totalSpent' | 'outstandingDebt' | 'orderCount'>('totalSpent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 🔴 PERBAIKAN 2: Pisahkan autentikasi dari fetching data
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

      setIsAdmin(true);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch data hanya jika user sudah terverifikasi sebagai admin
  useEffect(() => {
    if (!authChecked || !isAdmin) return;

    const fetchReportData = async () => {
      try {
        const customersSnapshot = await getDocs(collection(db, 'customers'));
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
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

        const customerList: Customer[] = customersSnapshot.docs.map(doc => {
          const data = doc.data();
          const customerId = doc.id;

          const customerOrders = orders.filter((order) => order.customerId === customerId);
          const totalSpent = customerOrders
            .filter((order) => order.status === 'SELESAI')
            .reduce((sum, order) => sum + (order.total || 0), 0);
          const orderCount = customerOrders.length;

          const outstandingOrders = customerOrders.filter(
            order => order.status !== 'SELESAI' && order.status !== 'DIBATALKAN'
          );
          const outstandingDebt = outstandingOrders.reduce((sum, order) => sum + (order.total || 0), 0);

          // Optional: validasi lastOrderDate (pastikan string ISO)
          let lastOrderDate: string | undefined;
          if (customerOrders.length > 0) {
            lastOrderDate = customerOrders
              .map((o) => o.createdAt)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
          }

          return {
            id: doc.id,
            name: data.name || '',
            phone: data.phone || '',
            type: (data.type === 'grosir' || data.type === 'ecer') ? data.type : 'ecer',
            creditLimit: data.creditLimit || 0,
            outstandingDebt,
            totalSpent,
            orderCount,
            lastOrderDate
          };
        });

        setCustomers(customerList);
        setFilteredCustomers(customerList);
      } catch (err) {
        console.error('Gagal memuat laporan pelanggan:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [dateRange, authChecked, isAdmin]);

  // Filter & sort
  useEffect(() => {
    let result = [...customers];

    if (customerType !== 'all') {
      result = result.filter(c => c.type === customerType);
    }

    result.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (sortOrder === 'asc') {
        return valA < valB ? -1 : 1;
      } else {
        return valA > valB ? -1 : 1;
      }
    });

    setFilteredCustomers(result);
  }, [customerType, sortBy, sortOrder, customers]);

  const handleExport = () => {
    if (filteredCustomers.length === 0) return;

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

    // 🔴 PERBAIKAN 3: Pastikan di sisi klien & XLSX tersedia
    if (typeof window !== 'undefined' && XLSX) {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Pelanggan');
      XLSX.writeFile(wb, `laporan-pelanggan-${dateRange.startDate}-sampai-${dateRange.endDate}.xlsx`);
    }
  };

  const isOverLimit = (customer: Customer) => {
    return customer.outstandingDebt > customer.creditLimit && customer.creditLimit > 0;
  };

  if (loading || !authChecked) {
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Laporan Pelanggan</h1>
        <p className="text-black">Analisis perilaku & kinerja pelanggan ATAYATOKO</p>
      </div>

      {/* Filter & Aksi */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-black mb-1">Jenis Pelanggan</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-black"
            >
              <option value="all">Semua</option>
              <option value="grosir">Grosir</option>
              <option value="ecer">Eceran</option>
            </select>
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

      {/* Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Pelanggan</p>
              <p className="text-2xl font-bold mt-1">{filteredCustomers.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Pelanggan Aktif</p>
              <p className="text-2xl font-bold mt-1">
                {filteredCustomers.filter(c => c.orderCount > 0).length}
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
              <p className="text-sm text-black">Total Piutang</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                Rp{filteredCustomers.reduce((sum, c) => sum + c.outstandingDebt, 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <CreditCard className="text-red-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Melebihi Limit</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">
                {filteredCustomers.filter(isOverLimit).length}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <AlertTriangle className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Laporan */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black">Daftar Pelanggan</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-black">Urutkan berdasarkan:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'totalSpent' | 'outstandingDebt' | 'orderCount')}
                className="text-sm border border-gray-300 rounded px-2 py-1 text-black"
              >
                <option value="totalSpent">Total Belanja</option>
                <option value="outstandingDebt">Piutang</option>
                <option value="orderCount">Frekuensi Transaksi</option>
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
                  Pelanggan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Jenis
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Total Belanja
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Frekuensi
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Piutang
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Limit Kredit
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-black">
                    <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Tidak ada data pelanggan dalam periode ini</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-black">{customer.name}</div>
                      <div className="text-sm text-black">{customer.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        customer.type === 'grosir' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {customer.type === 'grosir' ? 'Grosir' : 'Ecer'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={16} className="text-green-600" />
                        <span>Rp{customer.totalSpent.toLocaleString('id-ID')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {customer.orderCount}x
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        isOverLimit(customer) ? 'text-red-600' : 'text-black'
                      }`}>
                        Rp{customer.outstandingDebt.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      {customer.creditLimit > 0 
                        ? `Rp${customer.creditLimit.toLocaleString('id-ID')}`
                        : '–'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isOverLimit(customer) ? (
                        <span className="flex items-center gap-1 text-sm text-red-600">
                          <AlertTriangle size={14} />
                          Melebihi Limit
                        </span>
                      ) : customer.outstandingDebt > 0 ? (
                        <span className="text-sm text-orange-600">Berutang</span>
                      ) : (
                        <span className="text-sm text-green-600">Lunas</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catatan */}
      <div className="mt-6 text-sm text-black">
        <p className="font-medium mb-2">Keterangan:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Pelanggan Aktif</strong>: Memiliki minimal 1 transaksi dalam periode yang dipilih</li>
          <li><strong>Melebihi Limit</strong>: Piutang &gt; Limit Kredit yang ditetapkan</li>
          <li><strong>Total Belanja</strong>: Hanya mencakup transaksi yang statusnya <strong>SELESAI</strong></li>
        </ul>
      </div>
    </div>
  );
}
