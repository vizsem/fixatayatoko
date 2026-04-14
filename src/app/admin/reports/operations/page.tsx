'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot
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
  Database,
  DollarSign
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

  // State for each data source
  const [employeesData, setEmployeesData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [warehousesData, setWarehousesData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);

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

  // Real-time listeners
  useEffect(() => {
    if (loading) return;

    // 1. Employees
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployeesData(snapshot.docs.map(doc => doc.data()));
    });

    // 2. Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsersData(snapshot.docs.map(doc => doc.data()));
    });

    // 3. Warehouses
    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (snapshot) => {
      setWarehousesData(snapshot.docs.map(doc => doc.data()));
    });

    // 4. Products (Active only)
    const productsQ = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      orderBy('name', 'asc')
    );
    const unsubProducts = onSnapshot(productsQ, (snapshot) => {
      setProductsData(snapshot.docs.map(doc => doc.data()));
    });

    // 5. Orders
    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrdersData(snapshot.docs.map(doc => doc.data()));
    });

    // 6. Inventory Transactions
    const unsubInventory = onSnapshot(collection(db, 'inventory_transactions'), (snapshot) => {
      setInventoryData(snapshot.docs.map(doc => doc.data()));
    });

    // 7. Operational Expenses
    const unsubExpenses = onSnapshot(collection(db, 'operational_expenses'), (snapshot) => {
      setExpensesData(snapshot.docs.map(doc => doc.data()));
    });

    return () => {
      unsubEmployees();
      unsubUsers();
      unsubWarehouses();
      unsubProducts();
      unsubOrders();
      unsubInventory();
      unsubExpenses();
    };
  }, [loading]);

  // Calculate metrics whenever data changes
  useEffect(() => {
    if (loading) return;

    // --- Karyawan ---
    const totalEmployees = employeesData.length;
    const activeEmployees = employeesData.filter((e) => String(e.status || '').toUpperCase() === 'AKTIF').length;
    const totalPayroll = employeesData
      .filter((e) => String(e.status || '').toUpperCase() === 'AKTIF')
      .reduce((sum: number, e) => sum + Number(e.manualSalary || 0), 0);
    const avgSalary = activeEmployees > 0 ? Math.round(totalPayroll / activeEmployees) : 0;
    const totalAttendanceDays = employeesData.reduce((sum: number, e) => sum + Number(e.totalAttendance || 0), 0);

    // --- Pengguna ---
    const totalUsers = usersData.length;
    const activeUsers = usersData.filter(u =>
      u.lastActive &&
      (Date.now() - new Date(u.lastActive).getTime()) < 7 * 24 * 60 * 60 * 1000
    ).length;

    // --- Gudang ---
    const totalWarehouses = warehousesData.length;
    const fullWarehouses = warehousesData.filter(wh =>
      (wh.usedCapacity / wh.capacity) >= 0.9
    ).length;

    // --- Produk ---
    const totalProducts = productsData.length;
    const outOfStockProducts = productsData.filter(p => p.stock === 0).length;
    const lowStockProducts = productsData.filter(p => p.stock > 0 && p.stock <= 10).length;

    // --- Pesanan ---
    const totalOrders = ordersData.length;
    const pendingOrders = ordersData.filter(o => o.status === 'MENUNGGU').length;
    const avgProcessingTime = totalOrders > 0
      ? (ordersData.reduce((sum, o) => {
        if (o.updatedAt && o.createdAt) {
          // Handle Firestore Timestamp or Date string
          const updated = o.updatedAt.toDate ? o.updatedAt.toDate() : new Date(o.updatedAt);
          const created = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
          return sum + (updated.getTime() - created.getTime());
        }
        return sum;
      }, 0) / totalOrders / (60 * 1000)) // dalam menit
      : 0;

    // --- Inventaris ---
    const totalTransactions = inventoryData.length;
    const stockInTransactions = inventoryData.filter(t => t.type === 'STOCK_IN').length;
    const stockOutTransactions = inventoryData.filter(t => t.type === 'STOCK_OUT').length;
    const transferTransactions = inventoryData.filter(t => t.type === 'TRANSFER').length;

    // --- Pengeluaran Operasional ---
    const totalExpenses = expensesData.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalExpenseTransactions = expensesData.length;
    
    // Filter bulan ini
    const now = new Date();
    const thisMonthExpenses = expensesData.filter(e => {
      let date: Date;
      if (e.date?.toDate) date = e.date.toDate();
      else if (e.date instanceof Date) date = e.date;
      else if (e.date?.seconds) date = new Date(e.date.seconds * 1000);
      else date = new Date(e.date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const totalThisMonthExpenses = thisMonthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Cari kategori tertinggi
    const expenseCategoryMap: Record<string, number> = {};
    expensesData.forEach(e => {
      const cat = e.category || 'Lainnya';
      expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + Number(e.amount || 0);
    });
    let topExpenseCategory = '-';
    let topExpenseValue = 0;
    Object.entries(expenseCategoryMap).forEach(([cat, val]) => {
      if (val > topExpenseValue) {
        topExpenseValue = val;
        topExpenseCategory = cat;
      }
    });


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
      },

      // Pengeluaran Operasional
      {
        id: 'total-expenses-month',
        name: 'Pengeluaran (Bulan Ini)',
        category: 'Pengeluaran',
        value: totalThisMonthExpenses,
        unit: 'Rp',
        status: totalThisMonthExpenses > 10000000 ? 'warning' : 'good', // Threshold contoh
        description: 'Total pengeluaran operasional bulan ini'
      },
      {
        id: 'total-expenses-all',
        name: 'Total Pengeluaran',
        category: 'Pengeluaran',
        value: totalExpenses,
        unit: 'Rp',
        status: 'good',
        description: 'Total pengeluaran operasional sepanjang waktu'
      },
      {
        id: 'top-expense-category',
        name: 'Kategori Terbesar',
        category: 'Pengeluaran',
        value: topExpenseCategory,
        unit: '',
        status: 'warning',
        description: 'Kategori dengan total pengeluaran tertinggi'
      },
      {
        id: 'total-expense-trx',
        name: 'Jumlah Transaksi',
        category: 'Pengeluaran',
        value: totalExpenseTransactions,
        unit: 'trx',
        status: 'good',
        description: 'Total frekuensi transaksi pengeluaran'
      }
    ];

    setMetrics(operationalMetrics);
  }, [loading, employeesData, usersData, warehousesData, productsData, ordersData, inventoryData, expensesData]);

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
    <div className="p-3 md:p-4 bg-gray-50 min-h-screen text-black">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Activity size={22} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-gray-900">Laporan Operasional (Real-time)</h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Analisis kinerja sistem terkini</p>
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
        {['Karyawan', 'Pengguna', 'Gudang', 'Produk', 'Pesanan', 'Inventaris', 'Pengeluaran'].map(category => {
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
                  {category === 'Pengeluaran' && <DollarSign size={20} />}
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
                        {typeof metric.value === 'number' && (metric.unit === 'Rp' || metric.name.includes('Gaji')) ? 
                          `Rp ${metric.value.toLocaleString('id-ID')}` : metric.value} 
                        <span className="text-sm font-normal ml-1">{metric.unit !== 'Rp' ? metric.unit : ''}</span>
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
