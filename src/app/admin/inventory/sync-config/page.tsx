/**
 * Halaman Konfigurasi Sinkronisasi Stok
 * Konfigurasi dan pengaturan sinkronisasi antara produk dan gudang
 */

'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  ArrowLeft,
  Save,
  RefreshCw,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { stockSyncService } from '@/lib/stockSyncService';
import { SyncConfig } from '@/lib/types';

export default function SyncConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SyncConfig>({
    autoSync: true,
    syncInterval: 5000,
    maxRetries: 3,
    batchSize: 50,
    enableValidation: true,
    validationThreshold: 5,
    enableNotifications: true,
    logLevel: 'INFO'
  });
  const [activeListeners, setActiveListeners] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'stockSync'));
        if (configDoc.exists()) {
          setConfig(configDoc.data() as SyncConfig);
        }

        const listeners = stockSyncService.getActiveListeners();
        setActiveListeners(listeners);
      } catch (error) {
        console.error('Error loading config:', error);
        notify.admin.error('Gagal memuat konfigurasi');
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

      await loadConfig();
    });

    return () => unsubscribe();
  }, [router]);

  // Update config
  const handleUpdateConfig = async () => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'settings', 'stockSync'), config as any);
      notify.admin.success('Konfigurasi berhasil diperbarui');
      
      // Update service config
      stockSyncService.updateConfig(config);
    } catch (error) {
      console.error('Error updating config:', error);
      notify.admin.error('Gagal memperbarui konfigurasi');
    } finally {
      setIsUpdating(false);
    }
  };

  // Stop all auto-sync
  const handleStopAllAutoSync = () => {
    stockSyncService.stopAllAutoSync();
    setActiveListeners([]);
    notify.admin.info('Semua auto-sync telah dihentikan');
  };

  // Refresh active listeners
  const handleRefreshListeners = () => {
    const listeners = stockSyncService.getActiveListeners();
    setActiveListeners(listeners);
    notify.admin.info(`Auto-sync aktif: ${listeners.length} listener`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat konfigurasi...</p>
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
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
              <Settings size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
                Konfigurasi Sinkronisasi
              </h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Pengaturan sinkronisasi stok
              </p>
            </div>
          </div>
          
          <button
            onClick={handleUpdateConfig}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isUpdating
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <Save size={16} />
            {isUpdating ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Status Auto-Sync */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-black">Status Auto-Sync</h2>
              <p className="text-sm text-gray-500">Monitor auto-sync yang sedang aktif</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshListeners}
              className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            
            <button
              onClick={handleStopAllAutoSync}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
            >
              <AlertCircle size={16} />
              Stop All
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm font-medium text-black">Active Listeners</span>
            </div>
            <div className="text-2xl font-bold text-black">{activeListeners.length}</div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-black">Last Update</span>
            </div>
            <div className="text-sm text-black">{new Date().toLocaleString('id-ID')}</div>
          </div>
        </div>
        
        {activeListeners.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Active Listeners:</h3>
            <div className="space-y-1">
              {activeListeners.map((listener, index) => (
                <div key={index} className="text-xs text-blue-700 font-mono">
                  {listener}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Konfigurasi */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-black">Pengaturan Sinkronisasi</h2>
            <p className="text-sm text-gray-500">Konfigurasi sistem sinkronisasi stok</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Auto Sync Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-black">Auto Sync</h3>
              <p className="text-xs text-gray-500">Aktifkan sinkronisasi otomatis</p>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, autoSync: !prev.autoSync }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.autoSync ? 'bg-green-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.autoSync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Enable Validation Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-black">Validasi Stok</h3>
              <p className="text-xs text-gray-500">Aktifkan validasi sebelum sinkronisasi</p>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, enableValidation: !prev.enableValidation }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.enableValidation ? 'bg-green-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.enableValidation ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Sync Interval */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Interval Sync (ms)
            </label>
            <input
              type="number"
              value={config.syncInterval}
              onChange={(e) => setConfig(prev => ({ ...prev, syncInterval: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="1000"
              max="60000"
            />
            <p className="text-xs text-gray-500 mt-1">
              Interval antara sinkronisasi otomatis (1000-60000 ms)
            </p>
          </div>

          {/* Max Retries */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Max Retries
            </label>
            <input
              type="number"
              value={config.maxRetries}
              onChange={(e) => setConfig(prev => ({ ...prev, maxRetries: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="1"
              max="10"
            />
            <p className="text-xs text-gray-500 mt-1">
              Jumlah maksimal percobaan ulang saat gagal
            </p>
          </div>

          {/* Batch Size */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Batch Size
            </label>
            <input
              type="number"
              value={config.batchSize}
              onChange={(e) => setConfig(prev => ({ ...prev, batchSize: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="10"
              max="200"
            />
            <p className="text-xs text-gray-500 mt-1">
              Jumlah maksimal item per batch sync
            </p>
          </div>

          {/* Log Level */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Log Level
            </label>
            <select
              value={config.logLevel}
              onChange={(e) => setConfig(prev => ({ ...prev, logLevel: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="ERROR">Error Only</option>
              <option value="WARN">Warning & Error</option>
              <option value="INFO">Info, Warning & Error</option>
              <option value="DEBUG">All (Debug)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Tingkat detail logging yang akan disimpan
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}