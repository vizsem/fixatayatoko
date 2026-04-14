/**
 * Halaman Monitoring Sinkronisasi Stok
 * Menampilkan status sinkronisasi antara produk dan gudang
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Package,
  Warehouse,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  BarChart3,
  Settings,
  XCircle,
  HelpCircle,
  X
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { stockSyncService } from '@/lib/stockSyncService';

// Types
interface SyncStatus {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  systemStock: number;
  warehouseStock: number;
  difference: number;
  lastSync: Timestamp | null;
  status: 'SYNCED' | 'OUT_OF_SYNC' | 'PENDING' | 'ERROR';
  syncError?: string;
}

interface SyncStats {
  total: number;
  synced: number;
  outOfSync: number;
  pending: number;
  error: number;
}

export default function StockSyncMonitorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'SYNCED' | 'OUT_OF_SYNC' | 'ERROR'>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [syncStats, setSyncStats] = useState<{
    total: number;
    success: number;
    failed: number;
    averageExecutionTime: number;
  }>({ total: 0, success: 0, failed: 0, averageExecutionTime: 0 });
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');
  const [isAuth, setIsAuth] = useState(false);
  
  // Batch Sync States
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const cancelSyncRef = useRef(false);
  
  // Help Modal State
  const [showHelp, setShowHelp] = useState(false);

  const stats = useMemo<SyncStats>(() => {
    return {
      total: syncStatuses.length,
      synced: syncStatuses.filter(s => s.status === 'SYNCED').length,
      outOfSync: syncStatuses.filter(s => s.status === 'OUT_OF_SYNC').length,
      pending: syncStatuses.filter(s => s.status === 'PENDING').length,
      error: syncStatuses.filter(s => s.status === 'ERROR').length
    };
  }, [syncStatuses]);

  const loadSyncStats = useCallback(async (range: 'day' | 'week' | 'month') => {
    try {
      const nextStats = await stockSyncService.getSyncStats(range);
      setSyncStats(nextStats);
    } catch (error) {
      console.error('Error loading sync stats:', error);
    }
  }, []);

  // Update stats when timeRange or auth changes
  useEffect(() => {
    if (isAuth) {
      loadSyncStats(timeRange);
    }
  }, [isAuth, timeRange, loadSyncStats]);

  // Load data sinkronisasi
  useEffect(() => {
    const loadSyncData = async () => {
      try {
        // Ambil data produk
        const productsQuery = query(collection(db, 'products'), where('isActive', '==', true));
        const productsSnap = await getDocs(productsQuery);
        const products = productsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Produk Tanpa Nama',
          stock: doc.data().stock || 0,
          stockByWarehouse: doc.data().stockByWarehouse || {}
        }));

        // Ambil data gudang
        const warehousesQuery = query(collection(db, 'warehouses'), where('isActive', '==', true));
        const warehousesSnap = await getDocs(warehousesQuery);
        const warehouses = warehousesSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Gudang Tanpa Nama'
        }));

        // Ambil data warehouse stock
        const warehouseStockQuery = query(collection(db, 'warehouseStock'));
        const warehouseStockSnap = await getDocs(warehouseStockQuery);
        const warehouseStocks = new Map();
        
        warehouseStockSnap.docs.forEach(doc => {
          const data = doc.data();
          const key = `${data.productId}_${data.warehouseId}`;
          warehouseStocks.set(key, data.quantity || 0);
        });

        // Hitung status sinkronisasi untuk setiap kombinasi produk-gudang
        const syncData: SyncStatus[] = [];
        
        products.forEach(product => {
          warehouses.forEach(warehouse => {
            const warehouseStock = warehouseStocks.get(`${product.id}_${warehouse.id}`) || 0;
            const systemStock = product.stockByWarehouse[warehouse.id] || 0;
            const difference = Math.abs(warehouseStock - systemStock);
            
            let status: SyncStatus['status'] = 'SYNCED';
            if (difference > 5) {
              status = 'OUT_OF_SYNC';
            } else if (difference > 0) {
              status = 'PENDING';
            }

            syncData.push({
              id: `${product.id}_${warehouse.id}`,
              productId: product.id,
              productName: product.name,
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              systemStock,
              warehouseStock,
              difference,
              lastSync: null, // Akan diisi dari log
              status
            });
          });
        });

        setSyncStatuses(syncData);
        setLastRefresh(new Date());
      } catch (error) {
        console.error('Error loading sync data:', error);
        notify.admin.error('Gagal memuat data sinkronisasi');
      }
    };

    // Proteksi admin
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        notify.admin.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      await loadSyncData();
      setIsAuth(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || isBatchSyncing) return; // Jangan refresh jika sedang sync

    const interval = setInterval(() => {
      window.location.reload();
    }, 30000); // Refresh setiap 30 detik

    return () => clearInterval(interval);
  }, [autoRefresh, isBatchSyncing]);

  // Sinkronisasi manual
  const handleManualSync = async (productId: string, warehouseId: string) => {
    try {
      const result = await stockSyncService.syncWarehouseToProduct(productId, warehouseId);
      if (result) {
        notify.admin.success('Sinkronisasi berhasil!');
        window.location.reload();
      } else {
        notify.admin.error('Sinkronisasi gagal!');
      }
    } catch (error) {
      console.error('Manual sync error:', error);
      notify.admin.error('Gagal melakukan sinkronisasi');
    }
  };

  // Cancel Batch Sync
  const handleCancelBatch = () => {
    cancelSyncRef.current = true;
    notify.admin.info('Membatalkan sinkronisasi...');
  };

  // Batch sync
  const handleBatchSync = async () => {
    const outOfSyncItems = syncStatuses.filter(s => s.status === 'OUT_OF_SYNC');
    if (outOfSyncItems.length === 0) {
      notify.admin.info('Tidak ada item yang perlu disinkronkan');
      return;
    }

    setIsBatchSyncing(true);
    cancelSyncRef.current = false;
    setSyncProgress({ current: 0, total: outOfSyncItems.length });

    try {
      let successCount = 0;
      let cancelled = false;

      for (let i = 0; i < outOfSyncItems.length; i++) {
        // Cek apakah dibatalkan
        if (cancelSyncRef.current) {
          cancelled = true;
          break;
        }

        const item = outOfSyncItems[i];
        setSyncProgress({ current: i + 1, total: outOfSyncItems.length });
        
        const result = await stockSyncService.syncWarehouseToProduct(item.productId, item.warehouseId);
        if (result) successCount++;
        
        // Sedikit delay untuk UI update dan membiarkan event loop bernafas
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (cancelled) {
        notify.admin.info(`Sinkronisasi dibatalkan. ${successCount} item berhasil disinkronkan.`);
      } else {
        notify.admin.success(`${successCount} dari ${outOfSyncItems.length} item berhasil disinkronkan`);
      }
      
      window.location.reload();
    } catch (error) {
      console.error('Batch sync error:', error);
      notify.admin.error('Gagal melakukan batch sync');
    } finally {
      setIsBatchSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  // Export data
  const handleExport = () => {
    const data = filteredStatuses.map(status => ({
      'Nama Produk': status.productName,
      'Gudang': status.warehouseName,
      'Stok Sistem': status.systemStock,
      'Stok Gudang': status.warehouseStock,
      'Selisih': status.difference,
      'Status': status.status,
      'Terakhir Sinkron': status.lastSync?.toDate().toLocaleString('id-ID') || '-'
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-sync-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStatuses = syncStatuses.filter(status => 
    filter === 'ALL' || status.status === filter
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data sinkronisasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 bg-gray-50 min-h-screen text-black">
      <Toaster position="top-right" />
      
      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <HelpCircle className="text-blue-600" />
                Panduan Penggunaan
              </h2>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-gray-700">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 mb-2">Fitur Utama</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Sync All:</strong> Memperbaiki semua item yang stoknya tidak sesuai secara otomatis.</li>
                  <li><strong>Cancel Sync:</strong> Menghentikan proses sinkronisasi massal yang sedang berjalan.</li>
                  <li><strong>Auto Refresh:</strong> Data diperbarui otomatis setiap 30 detik (mati saat sync berjalan).</li>
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-2">Arti Status</h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">SYNCED</span>
                    <span>Stok aman (selisih 0).</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">OUT_OF_SYNC</span>
                    <span>Selisih besar ({'>'}5), perlu disinkronkan.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-bold">PENDING</span>
                    <span>Selisih kecil (1-5), biasanya karena transaksi baru.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
                Monitoring Sinkronisasi Stok
              </h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Status sinkron antara produk dan gudang
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowHelp(true)}
              className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              title="Panduan Penggunaan"
            >
              <HelpCircle size={18} />
              <span className="hidden md:inline">Panduan</span>
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <RefreshCw size={16} className={autoRefresh ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Auto Refresh</span>
            </button>
            
            {isBatchSyncing ? (
              <button
                onClick={handleCancelBatch}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 animate-pulse"
              >
                <XCircle size={16} />
                Cancel Sync ({syncProgress.current}/{syncProgress.total})
              </button>
            ) : (
              <button
                onClick={handleBatchSync}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Sync All
              </button>
            )}
            
            <Link
              href="/admin/inventory/sync-logs"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Activity size={16} />
              <span className="hidden md:inline">Logs</span>
            </Link>
            
            <Link
              href="/admin/inventory/sync-config"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Settings size={16} />
            </Link>
            
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100">
            <div className="text-2xl font-bold text-black">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Item</div>
          </div>
          <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
            <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
            <div className="text-sm text-green-600">Tersinkron</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100">
            <div className="text-2xl font-bold text-yellow-600">{stats.outOfSync}</div>
            <div className="text-sm text-yellow-600">Tidak Sinkron</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
            <div className="text-sm text-blue-600">Pending</div>
          </div>
          <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
            <div className="text-2xl font-bold text-red-600">{stats.error}</div>
            <div className="text-sm text-red-600">Error</div>
          </div>
        </div>

        {/* Sync Performance Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-2xl border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{syncStats.total}</div>
            <div className="text-sm text-blue-600">Total Sync</div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-2xl border border-green-200">
            <div className="text-2xl font-bold text-green-600">{syncStats.success}</div>
            <div className="text-sm text-green-600">Sukses</div>
          </div>
          <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-2xl border border-red-200">
            <div className="text-2xl font-bold text-red-600">{syncStats.failed}</div>
            <div className="text-sm text-red-600">Gagal</div>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-2xl border border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{syncStats.averageExecutionTime.toFixed(0)}ms</div>
            <div className="text-sm text-purple-600">Rata-rata Waktu</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            {(['ALL', 'SYNCED', 'OUT_OF_SYNC', 'ERROR'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Periode:</span>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'day' | 'week' | 'month')}
              className="px-3 py-1 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300"
            >
              <option value="day">24 Jam</option>
              <option value="week">7 Hari</option>
              <option value="month">30 Hari</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Terakhir update: {lastRefresh.toLocaleString('id-ID')}
        </div>
      </div>

      {/* Tabel Status */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gudang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stok Sistem
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stok Gudang
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Selisih
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStatuses.map((status) => (
                <tr key={status.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <Package size={16} className="text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-black">{status.productName}</div>
                        <div className="text-xs text-gray-500">ID: {status.productId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Warehouse size={16} className="text-gray-400" />
                      <span className="text-sm text-black">{status.warehouseName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {status.systemStock.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {status.warehouseStock.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center gap-1 text-sm ${
                      status.difference > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {status.difference > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {status.difference.toLocaleString('id-ID')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      status.status === 'SYNCED'
                        ? 'bg-green-100 text-green-700'
                        : status.status === 'OUT_OF_SYNC'
                        ? 'bg-red-100 text-red-700'
                        : status.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {status.status === 'SYNCED' && <CheckCircle size={12} />}
                      {status.status === 'OUT_OF_SYNC' && <AlertCircle size={12} />}
                      {status.status === 'PENDING' && <Clock size={12} />}
                      {status.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleManualSync(status.productId, status.warehouseId)}
                      disabled={status.status === 'SYNCED' || isBatchSyncing}
                      className={`text-sm px-3 py-1 rounded-lg font-medium ${
                        status.status === 'SYNCED' || isBatchSyncing
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      <RefreshCw size={14} className={`inline mr-1 ${isBatchSyncing ? 'animate-spin' : ''}`} />
                      Sync
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredStatuses.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Tidak ada data untuk ditampilkan</p>
          </div>
        )}
      </div>
    </div>
  );
}
