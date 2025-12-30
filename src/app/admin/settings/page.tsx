// src/app/admin/settings/page.tsx
'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import { 
  Settings, 
  CreditCard, 
  Truck, 
  Printer,
  Store,
  Shield,
  AlertTriangle,
  Upload,
  Download
} from 'lucide-react';

// Tipe konfigurasi
type PaymentMethod = {
  id: string;
  name: string;
  enabled: boolean;
  requiresProof?: boolean;
};

type DeliveryMethod = {
  id: string;
  name: string;
  enabled: boolean;
  cost: number;
  description: string;
};

type PrinterSettings = {
  type: 'ESC/POS' | 'Generic';
  paperWidth: number;
  autoCut: boolean;
  characterSet: string;
};

type StoreSettings = {
  name: string;
  address: string;
  phone: string;
  email: string;
};

type SystemSettings = {
  store: StoreSettings;
  paymentMethods: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  printer: PrinterSettings;
  createdAt: string;
};

// Konfigurasi default
const defaultSettings: SystemSettings = {
  store: {
    name: 'ATAYATOKO2',
    address: 'Jl. Pandan 98, Semen, Kediri',
    phone: '0858-5316-1174',
    email: 'atayatoko2@gmail.com'
  },
  paymentMethods: [
    { id: 'CASH', name: 'Tunai', enabled: true },
    { id: 'COD', name: 'Cash on Delivery', enabled: true },
    { id: 'QRIS', name: 'QRIS', enabled: true, requiresProof: true },
    { id: 'TRANSFER', name: 'Transfer Bank', enabled: true, requiresProof: true },
    { id: 'CREDIT', name: 'Tempo', enabled: true }
  ],
  deliveryMethods: [
    { id: 'PICKUP', name: 'Ambil di Toko', enabled: true, cost: 0, description: 'Pelanggan mengambil sendiri' },
    { id: 'COURIER', name: 'Kurir Toko', enabled: true, cost: 15000, description: 'Dikirim oleh kurir toko' },
    { id: 'OJOL', name: 'Ojek Online', enabled: true, cost: 0, description: 'Dikirim via OJOL (biaya ditanggung pelanggan)' }
  ],
  printer: {
    type: 'ESC/POS',
    paperWidth: 80,
    autoCut: true,
    characterSet: 'UTF-8'
  },
  createdAt: new Date().toISOString()
};

export default function AdminSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [previewStruk, setPreviewStruk] = useState<string>('');
  
  // State untuk backup & restore
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Proteksi admin
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

      await loadSettings();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'system'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as SystemSettings);
      } else {
        await setDoc(doc(db, 'settings', 'system'), defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (err) {
      console.error('Gagal memuat pengaturan:', err);
      setError('Gagal memuat pengaturan sistem.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await setDoc(doc(db, 'settings', 'system'), {
        ...settings,
        updatedAt: new Date().toISOString()
      });
      alert('Pengaturan berhasil disimpan!');
    } catch (err) {
      console.error('Gagal menyimpan pengaturan:', err);
      setError('Gagal menyimpan pengaturan. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Kembalikan semua pengaturan ke nilai default?')) {
      setSettings(defaultSettings);
    }
  };

  // Update store settings
  const updateStoreSetting = (field: keyof StoreSettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      store: { ...prev.store, [field]: value }
    }));
  };

  // Update payment method
  const togglePaymentMethod = (id: string) => {
    setSettings(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map(pm => 
        pm.id === id ? { ...pm, enabled: !pm.enabled } : pm
      )
    }));
  };

  // Update delivery method
  const updateDeliveryMethod = (id: string, field: keyof DeliveryMethod, value: any) => {
    setSettings(prev => ({
      ...prev,
      deliveryMethods: prev.deliveryMethods.map(dm => 
        dm.id === id ? { ...dm, [field]: value } : dm
      )
    }));
  };

  // Update printer setting
  const updatePrinterSetting = (field: keyof PrinterSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      printer: { ...prev.printer, [field]: value }
    }));
  };

  // Generate preview struk
  useEffect(() => {
    const preview = `
${settings.store.name}
${settings.store.address}
${settings.store.phone}
========================
Beras Premium 5kg.....Rp65.000
Minyak Goreng 2L.....Rp32.000
========================
TOTAL.................Rp97.000
METODE: Tunai
Tgl: ${new Date().toLocaleDateString('id-ID')}
------------------------
Terima kasih!
Lengkap • Hemat • Terpercaya
    `.trim();
    setPreviewStruk(preview);
  }, [settings.store]);

  // ✅ Backup semua data ke Excel
  const handleBackup = async () => {
    setBackupStatus('Membuat backup...');
    try {
      const collections = ['products', 'orders', 'customers', 'suppliers', 'warehouses', 'promotions'];
      const backupData: Record<string, any[]> = {};

      for (const col of collections) {
        const snapshot = await getDocs(collection(db, col));
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        backupData[col] = data;
      }

      const wb = XLSX.utils.book_new();
      
      Object.keys(backupData).forEach(col => {
        if (backupData[col].length > 0) {
          const ws = XLSX.utils.json_to_sheet(backupData[col]);
          XLSX.utils.book_append_sheet(wb, ws, col);
        }
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      XLSX.writeFile(wb, `atayatoko2-backup-${timestamp}.xlsx`);
      setBackupStatus('Backup berhasil! File telah diunduh.');
      setTimeout(() => setBackupStatus(null), 5000);
    } catch (err) {
      console.error('Backup gagal:', err);
      setBackupStatus('Backup gagal. Silakan coba lagi.');
      setTimeout(() => setBackupStatus(null), 5000);
    }
  };

  // ✅ Restore data dari Excel
  const handleRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      alert('Hanya file .xlsx yang didukung!');
      return;
    }

    setIsRestoring(true);
    setRestoreStatus('Memproses file...');

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        const requiredSheets = ['products', 'orders', 'suppliers', 'warehouses'];
        const missingSheets = requiredSheets.filter(sheet => !wb.SheetNames.includes(sheet));
        
        if (missingSheets.length > 0) {
          alert(`File tidak valid! Sheet yang hilang: ${missingSheets.join(', ')}`);
          setIsRestoring(false);
          return;
        }

        setRestoreStatus('Menghapus data lama...');
        const collections = ['products', 'orders', 'customers', 'suppliers', 'warehouses', 'promotions'];
        for (const col of collections) {
          const snapshot = await getDocs(collection(db, col));
          const deletes = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletes);
        }

        setRestoreStatus('Mengimpor data baru...');
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws) as any[];
          
          if (data.length === 0) continue;
          
          const writes = data.map(row => {
            const { id, ...rest } = row;
            if (id) {
              return setDoc(doc(db, sheetName, id), rest);
            } else {
              return addDoc(collection(db, sheetName), rest);
            }
          });
          
          await Promise.all(writes);
        }

        setRestoreStatus('Restore berhasil! Memuat ulang halaman...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error('Restore gagal:', err);
      setRestoreStatus('Restore gagal. File mungkin tidak valid.');
      setIsRestoring(false);
      setTimeout(() => setRestoreStatus(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat pengaturan sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Pengaturan Sistem</h1>
        </div>
        <p className="text-black">Konfigurasi toko, pembayaran, pengiriman, printer, dan backup data</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Konfigurasi Toko */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Store className="mr-2" size={20} />
            Konfigurasi Toko
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Nama Toko</label>
              <input
                type="text"
                value={settings.store.name}
                onChange={(e) => updateStoreSetting('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Alamat</label>
              <textarea
                value={settings.store.address}
                onChange={(e) => updateStoreSetting('address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-black"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Nomor Telepon</label>
              <input
                type="text"
                value={settings.store.phone}
                onChange={(e) => updateStoreSetting('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Email</label>
              <input
                type="email"
                value={settings.store.email}
                onChange={(e) => updateStoreSetting('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-black"
              />
            </div>
          </div>
        </div>

        {/* Metode Pembayaran */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <CreditCard className="mr-2" size={20} />
            Metode Pembayaran
          </h2>
          <div className="space-y-4">
            {settings.paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between">
                <div>
                  <span className="text-black">{method.name}</span>
                  {method.requiresProof && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      Butuh Bukti
                    </span>
                  )}
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={method.enabled}
                    onChange={() => togglePaymentMethod(method.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Metode Pengiriman */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Truck className="mr-2" size={20} />
            Metode Pengiriman
          </h2>
          <div className="space-y-4">
            {settings.deliveryMethods.map((method) => (
              <div key={method.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-black">{method.name}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={method.enabled}
                      onChange={() => updateDeliveryMethod(method.id, 'enabled', !method.enabled)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                </div>
                <p className="text-sm text-black mb-3">{method.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Biaya (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={method.cost}
                      onChange={(e) => updateDeliveryMethod(method.id, 'cost', Number(e.target.value))}
                      disabled={!method.enabled}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-black text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Status</label>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      method.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {method.enabled ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pengaturan Printer */}
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Printer className="mr-2" size={20} />
            Pengaturan Printer
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-black mb-1">Tipe Printer</label>
              <select
                value={settings.printer.type}
                onChange={(e) => updatePrinterSetting('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-black"
              >
                <option value="ESC/POS">ESC/POS Thermal Printer</option>
                <option value="Generic">Generic Text Printer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Lebar Kertas (mm)</label>
              <select
                value={settings.printer.paperWidth}
                onChange={(e) => updatePrinterSetting('paperWidth', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-black"
              >
                <option value={58}>58mm</option>
                <option value={80}>80mm</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoCut"
                checked={settings.printer.autoCut}
                onChange={(e) => updatePrinterSetting('autoCut', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="autoCut" className="text-black">Potong Otomatis</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1">Set Karakter</label>
              <select
                value={settings.printer.characterSet}
                onChange={(e) => updatePrinterSetting('characterSet', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-black"
              >
                <option value="UTF-8">UTF-8 (Unicode)</option>
                <option value="CP437">CP437 (ASCII)</option>
              </select>
            </div>
            
            {/* Preview Struk */}
            <div>
              <label className="block text-sm font-medium text-black mb-2">Preview Struk</label>
              <div className="bg-gray-100 p-4 rounded font-mono text-xs text-black whitespace-pre-wrap border border-gray-300">
                {previewStruk}
              </div>
            </div>
          </div>
        </div>

        {/* Aksi Simpan */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-black">
              <AlertTriangle size={16} className="text-yellow-600" />
              <span>Perubahan akan berlaku setelah halaman dimuat ulang</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
              >
                Reset ke Default
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Pengaturan'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Shield className="mr-2" size={20} />
            Backup & Restore Data
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Backup */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-black mb-2">Backup Data</h3>
              <p className="text-sm text-black mb-4">
                Simpan semua data toko ke file Excel. Aman untuk arsip atau migrasi.
              </p>
              <button
                onClick={handleBackup}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Buat Backup Sekarang
              </button>
              {backupStatus && (
                <p className="mt-2 text-sm text-black">{backupStatus}</p>
              )}
            </div>
            
            {/* Restore */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-black mb-2">Restore Data</h3>
              <p className="text-sm text-black mb-4">
                Pulihkan data dari file backup sebelumnya. ⚠️ Ini akan mengganti data saat ini!
              </p>
              <label className={`w-full cursor-pointer ${isRestoring ? 'opacity-50' : ''}`}>
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg py-3 text-center text-sm text-black flex items-center justify-center gap-2">
                  <Upload size={16} />
                  {isRestoring ? 'Sedang memproses...' : 'Klik untuk pilih file backup'}
                </div>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleRestore}
                  disabled={isRestoring}
                  className="hidden"
                />
              </label>
              {restoreStatus && (
                <p className="mt-2 text-sm text-black">{restoreStatus}</p>
              )}
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-600 mt-0.5" />
              <p className="text-sm text-black">
                <strong>Peringatan:</strong> Restore akan menghapus semua data saat ini dan menggantinya dengan data dari file backup. 
                Pastikan Anda telah membuat backup terbaru sebelum melakukan restore.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}