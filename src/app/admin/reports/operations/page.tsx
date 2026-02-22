// src/app/(admin)/reports/operations/page.tsx
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
  Download,
  Users,
  Warehouse,
  Package,
  Activity,
  Clock,
  AlertTriangle,
  ShoppingCart,
  Database
} from 'lucide-react';
import notify from '@/lib/notify';


type OperationalMetric = {
  id: string;
  name: string;
  category: string;
  value: number | string;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
};

export default function OperationsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OperationalMetric[]>([]);

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
    const fetchOperationsData = async () => {
      try {
        // Ambil data karyawan
        const employeesSnapshot = await getDocs(collection(db, 'employees'));
        type EmployeeDoc = {
          status?: string;
          manualSalary?: number;
          totalAttendance?: number;
        };
        const employees = employeesSnapshot.docs.map(doc => doc.data() as EmployeeDoc);
        const totalEmployees = employees.length;
        const activeEmployees = employees.filter((e) => String(e.status || '').toUpperCase() === 'AKTIF').length;
        const totalPayroll = employees
          .filter((e) => String(e.status || '').toUpperCase() === 'AKTIF')
          .reduce((sum: number, e) => sum + Number(e.manualSalary || 0), 0);
        const avgSalary = activeEmployees > 0 ? Math.round(totalPayroll / activeEmployees) : 0;
        const totalAttendanceDays = employees.reduce((sum: number, e) => sum + Number(e.totalAttendance || 0), 0);

        // Ambil data pengguna
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnapshot.size;
        const activeUsers = usersSnapshot.docs.filter(doc =>
          doc.data().lastActive &&
          (Date.now() - new Date(doc.data().lastActive).getTime()) < 7 * 24 * 60 * 60 * 1000
        ).length;

        // Ambil data gudang
        const warehousesSnapshot = await getDocs(collection(db, 'warehouses'));
        const warehouses = warehousesSnapshot.docs.map(doc => doc.data());
        const totalWarehouses = warehouses.length;
        const fullWarehouses = warehouses.filter(wh =>
          (wh.usedCapacity / wh.capacity) >= 0.9
        ).length;

        // Ambil data produk
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const products = productsSnapshot.docs.map(doc => doc.data());
        const totalProducts = products.length;
        const outOfStockProducts = products.filter(p => p.stock === 0).length;
        const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 10).length;

        // Ambil data pesanan
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        const orders = ordersSnapshot.docs.map(doc => doc.data());
        const totalOrders = orders.length;
        const pendingOrders = orders.filter(o => o.status === 'MENUNGGU').length;
        const avgProcessingTime = totalOrders > 0
          ? (orders.reduce((sum, o) => {
            if (o.updatedAt && o.createdAt) {
              return sum + (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime());
            }
            return sum;
          }, 0) / totalOrders / (60 * 1000)) // dalam menit
          : 0;

        // Ambil data transaksi inventaris
        const inventorySnapshot = await getDocs(collection(db, 'inventory_transactions'));
        const inventoryTransactions = inventorySnapshot.docs.map(doc => doc.data());
        const totalTransactions = inventoryTransactions.length;
        const stockInTransactions = inventoryTransactions.filter(t => t.type === 'STOCK_IN').length;
        const stockOutTransactions = inventoryTransactions.filter(t => t.type === 'STOCK_OUT').length;
        const transferTransactions = inventoryTransactions.filter(t => t.type === 'TRANSFER').length;

        const operationalMetrics: OperationalMetric[] = [
          // Karyawan
          {
            id: 'active-employees',
            name: 'Karyawan Aktif',
            category: 'Karyawan',
            value: activeEmployees,
            unit: 'orang',
            status: activeEmployees > 0 ? 'good' : 'warning',
            description: 'Jumlah karyawan dengan status AKTIF'
          },
          {
            id: 'total-employees',
            name: 'Total Karyawan',
            category: 'Karyawan',
            value: totalEmployees,
            unit: 'orang',
            status: 'good',
            description: 'Jumlah seluruh karyawan terdaftar'
          },
          {
            id: 'monthly-payroll',
            name: 'Total Gaji Bulanan',
            category: 'Karyawan',
            value: totalPayroll,
            unit: 'Rp',
            status: totalPayroll > 0 ? 'good' : 'warning',
            description: 'Akumulasi take home pay karyawan aktif'
          },
          {
            id: 'average-salary',
            name: 'Rata-rata Gaji',
            category: 'Karyawan',
            value: avgSalary,
            unit: 'Rp',
            status: avgSalary > 0 ? 'good' : 'warning',
            description: 'Rata-rata gaji per karyawan aktif'
          },
          {
            id: 'attendance-total',
            name: 'Total Absensi',
            category: 'Karyawan',
            value: totalAttendanceDays,
            unit: 'hari',
            status: 'good',
            description: 'Akumulasi absensi seluruh karyawan'
          },
          // Pengguna
          {
            id: 'active-users',
            name: 'Pengguna Aktif',
            category: 'Pengguna',
            value: activeUsers,
            unit: 'pengguna',
            status: activeUsers > 0 ? 'good' : 'warning',
            description: 'Pengguna yang aktif dalam 7 hari terakhir'
          },
          {
            id: 'total-users',
            name: 'Total Pengguna',
            category: 'Pengguna',
            value: totalUsers,
            unit: 'pengguna',
            status: 'good',
            description: 'Jumlah total pengguna sistem'
          },

          // Gudang
          {
            id: 'full-warehouses',
            name: 'Gudang Penuh',
            category: 'Gudang',
            value: fullWarehouses,
            unit: 'gudang',
            status: fullWarehouses > 0 ? 'critical' : 'good',
            description: 'Gudang dengan kapasitas terisi >90%'
          },
          {
            id: 'total-warehouses',
            name: 'Total Gudang',
            category: 'Gudang',
            value: totalWarehouses,
            unit: 'gudang',
            status: 'good',
            description: 'Jumlah total gudang aktif'
          },

          // Produk
          {
            id: 'out-of-stock',
            name: 'Produk Habis',
            category: 'Produk',
            value: outOfStockProducts,
            unit: 'produk',
            status: outOfStockProducts > 0 ? 'critical' : 'good',
            description: 'Produk dengan stok 0'
          },
          {
            id: 'low-stock',
            name: 'Stok Rendah',
            category: 'Produk',
            value: lowStockProducts,
            unit: 'produk',
            status: lowStockProducts > 5 ? 'critical' : lowStockProducts > 0 ? 'warning' : 'good',
            description: 'Produk dengan stok ≤10 unit'
          },
          {
            id: 'total-products',
            name: 'Total Produk',
            category: 'Produk',
            value: totalProducts,
            unit: 'produk',
            status: 'good',
            description: 'Jumlah total produk dalam sistem'
          },

          // Pesanan
          {
            id: 'pending-orders',
            name: 'Pesanan Tertunda',
            category: 'Pesanan',
            value: pendingOrders,
            unit: 'pesanan',
            status: pendingOrders > 5 ? 'critical' : pendingOrders > 0 ? 'warning' : 'good',
            description: 'Pesanan dengan status "Menunggu"'
          },
          {
            id: 'avg-processing',
            name: 'Waktu Proses Rata-rata',
            category: 'Pesanan',
            value: avgProcessingTime > 0 ? Math.round(avgProcessingTime) : 0,
            unit: 'menit',
            status: avgProcessingTime > 60 ? 'warning' : 'good',
            description: 'Rata-rata waktu pemrosesan pesanan'
          },
          {
            id: 'total-orders',
            name: 'Total Pesanan',
            category: 'Pesanan',
            value: totalOrders,
            unit: 'pesanan',
            status: 'good',
            description: 'Jumlah total pesanan sepanjang waktu'
          },

          // Inventaris
          {
            id: 'inventory-transactions',
            name: 'Transaksi Inventaris',
            category: 'Inventaris',
            value: totalTransactions,
            unit: 'transaksi',
            status: 'good',
            description: 'Total transaksi stok (masuk/keluar/transfer)'
          },
          {
            id: 'stock-in-transactions',
            name: 'Stok Masuk',
            category: 'Inventaris',
            value: stockInTransactions,
            unit: 'transaksi',
            status: 'good',
            description: 'Jumlah transaksi stok masuk'
          },
          {
            id: 'stock-out-transactions',
            name: 'Stok Keluar',
            category: 'Inventaris',
            value: stockOutTransactions,
            unit: 'transaksi',
            status: 'good',
            description: 'Jumlah transaksi stok keluar'
          },
          {
            id: 'transfer-transactions',
            name: 'Mutasi Stok',
            category: 'Inventaris',
            value: transferTransactions,
            unit: 'transaksi',
            status: 'good',
            description: 'Jumlah transaksi mutasi antar gudang'
          }
        ];

        setMetrics(operationalMetrics);
      } catch {
        // Error is logged to console
      }

    };

    fetchOperationsData();
  }, []);

  const handleExport = async () => {
    const exportData = metrics.map(metric => ({
      Kategori: metric.category,
      Metrik: metric.name,
      Nilai: metric.value,
      Satuan: metric.unit,
      Status: metric.status,
      Deskripsi: metric.description
    }));

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Operasional');
    XLSX.writeFile(wb, 'laporan-operasional.xlsx');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat laporan operasional...</p>
        </div>
      </div>
    );
  }

  // Hitung summary metrics
  const criticalMetrics = metrics.filter(m => m.status === 'critical').length;
  const warningMetrics = metrics.filter(m => m.status === 'warning').length;
  const totalMetrics = metrics.length;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Activity size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-gray-900">Laporan Operasional</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Analisis kinerja sistem</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
        >
          <Download size={16} /> Ekspor
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Masalah Kritis</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{criticalMetrics}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Peringatan</p>
              <p className="text-2xl font-bold mt-1 text-yellow-600">{warningMetrics}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Metrik</p>
              <p className="text-2xl font-bold mt-1">{totalMetrics}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Activity className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Operational Metrics by Category */}
      <div className="space-y-8">
        {['Karyawan', 'Pengguna', 'Gudang', 'Produk', 'Pesanan', 'Inventaris'].map(category => {
          const categoryMetrics = metrics.filter(m => m.category === category);
          if (categoryMetrics.length === 0) return null;

          return (
            <div key={category} className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-lg font-semibold text-black flex items-center gap-2">
                  {category === 'Karyawan' && <Users size={20} />}
                  {category === 'Pengguna' && <Users size={20} />}
                  {category === 'Gudang' && <Warehouse size={20} />}
                  {category === 'Produk' && <Package size={20} />}
                  {category === 'Pesanan' && <ShoppingCart size={20} />}
                  {category === 'Inventaris' && <Database size={20} />}
                  {category}
                </h2>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryMetrics.map(metric => (
                    <div key={metric.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-black">{metric.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${metric.status === 'good' ? 'bg-green-100 text-green-800' :
                            metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                          }`}>
                          {metric.status === 'good' ? 'Baik' :
                            metric.status === 'warning' ? 'Peringatan' : 'Kritis'}
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-black mb-1">
                        {metric.value} <span className="text-sm font-normal">{metric.unit}</span>
                      </div>
                      <p className="text-sm text-gray-600">{metric.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
