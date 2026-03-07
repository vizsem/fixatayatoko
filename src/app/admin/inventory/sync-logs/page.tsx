/**
 * Halaman Logs Sinkronisasi Stok
 * Menampilkan history dan detail dari semua sinkronisasi
 */

'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  ArrowLeft,
  Activity
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';

import { StockSyncLog } from '@/lib/types';

export default function SyncLogsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<StockSyncLog[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');
  const [logType, setLogType] = useState<'ALL' | 'WAREHOUSE_TO_PRODUCT' | 'BATCH_SYNC' | 'STOCK_VALIDATION'>('ALL');
  const [limitCount, setLimitCount] = useState(100);

  // Load logs
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logsRef = collection(db, 'stockSyncLogs');
        let q = query(
          logsRef,
          orderBy('timestamp', 'desc'),
          limit(limitCount)
        );

        if (filter !== 'ALL') {
          q = query(q, where('status', '==', filter));
        }

        if (logType !== 'ALL') {
          q = query(q, where('type', '==', logType));
        }

        const snapshot = await getDocs(q);
        const logsData: StockSyncLog[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StockSyncLog));

        setLogs(logsData);
      } catch (error) {
        console.error('Error loading logs:', error);
        notify.admin.error('Gagal memuat logs sinkronisasi');
      } finally {
        setLoading(false);
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

      await loadLogs();
    });

    return () => unsubscribe();
  }, [router, filter, logType, limitCount]);

  // Export logs
  const handleExport = () => {
    const data = filteredLogs.map(log => ({
      'Waktu': (log.timestamp as Timestamp).toDate().toLocaleString('id-ID'),
      'Tipe': log.type,
      'Status': log.status,
      'Produk': log.productId,
      'Gudang': log.warehouseId,
      'Stok Sistem': log.systemStock || 0,
      'Stok Baru': log.newStock || 0,
      'Selisih': log.difference || 0,
      'Waktu Eksekusi (ms)': log.executionTime,
      'Operator': log.operator,
      'Error': log.error || '-'
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => {
    if (filter !== 'ALL' && log.status !== filter) return false;
    if (logType !== 'ALL' && log.type !== logType) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat logs sinkronisasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen text-black">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/inventory/sync-monitor" className="p-2 bg-white rounded-2xl border hover:bg-gray-100 transition">
              <ArrowLeft size={20} />
            </Link>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
                Logs Sinkronisasi Stok
              </h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                History dan detail sinkronisasi
              </p>
            </div>
          </div>
          
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Status:</span>
            {['ALL', 'SUCCESS', 'ERROR'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Tipe:</span>
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value as any)}
              className="px-3 py-1 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300"
            >
              <option value="ALL">Semua</option>
              <option value="WAREHOUSE_TO_PRODUCT">Warehouse to Product</option>
              <option value="BATCH_SYNC">Batch Sync</option>
              <option value="STOCK_VALIDATION">Stock Validation</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Limit:</span>
            <select
              value={limitCount}
              onChange={(e) => setLimitCount(Number(e.target.value))}
              className="px-3 py-1 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waktu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
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
                  Stok Baru
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Selisih
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Waktu Eksekusi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operator
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {(log.timestamp as Timestamp).toDate().toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {log.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      log.status === 'SUCCESS' || log.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {log.status === 'SUCCESS' || log.status === 'COMPLETED' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {log.productId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {log.warehouseId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {(log.systemStock || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {(log.newStock || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center gap-1 text-sm ${
                      (log.difference || 0) > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {(log.difference || 0) > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {(log.difference || 0).toLocaleString('id-ID')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {log.executionTime}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                    {log.operator}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Tidak ada logs untuk ditampilkan</p>
          </div>
        )}
      </div>
    </div>
  );
}