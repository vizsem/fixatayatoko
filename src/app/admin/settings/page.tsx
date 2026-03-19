'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection, getDocs,
  deleteDoc, addDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import {
  Settings, CreditCard, Printer, Store,
  Shield, Upload, Download,
  Plus, Trash2, Users, Tag, Save, Sparkles, Package, ExternalLink, Coins, CheckCircle2,
  Truck, Facebook, Instagram, Video, AlertTriangle, Power,
  Globe,
  Smartphone
} from 'lucide-react';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';

// --- TYPES ---
type PaymentMethod = { id: string; name: string; enabled: boolean; requiresProof?: boolean; description?: string };
type DeliveryMethod = { id: string; name: string; enabled: boolean; cost: number; description: string; };
type PrinterSettings = { type: 'ESC/POS' | 'Generic'; paperWidth: number; autoCut: boolean; characterSet: string; };
type StoreSettings = { 
  name: string; 
  address: string; 
  phone: string; 
  email: string; 
  footerMsg?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  maintenanceMode?: boolean;
  runningText?: string;
  aiPromptShopee?: string;
  aiPromptTiktok?: string;
};
type PointSettings = { earningRate: number; redemptionValue: number; minRedeem: number; isActive: boolean; };

type SystemSettings = {
  store: StoreSettings;
  paymentMethods: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  printer: PrinterSettings;
  createdAt: string;
  displayWarehouseId?: string;
};

type Employee = { id?: string; name: string; role: 'admin' | 'kasir'; phone: string; email: string; isActive: boolean; };
type Category = { id?: string; name: string; slug: string; };
type Banner = { id?: string; title: string; subtitle: string; buttonText: string; gradient: string; imageUrl?: string; linkUrl: string; isActive: boolean; };
type Warehouse = { id: string; name: string; };

// --- DEFAULT SETTINGS ---
const defaultSettings: SystemSettings = {
  store: { 
    name: 'Atayatoko2', 
    address: 'Jl. Pandan 98, Semen, Kediri', 
    phone: '0858-5316-1174', 
    email: 'atayatoko2@gmail.com', 
    footerMsg: 'Terima kasih telah berbelanja!',
    maintenanceMode: false,
    runningText: 'Selamat datang di Ataya Toko! Dapatkan promo menarik setiap hari.',
    aiPromptShopee: "🔥 INSIGHT BULAN INI (Shopee): Kampanye 'Big Ramadan Sale 2026' sedang berlangsung (11 Feb - 22 Mar). Traffic puncak terjadi pukul 04.00 (Sahur), 12.00, dan 20.00 WIB.\n💡 Strategi: Shopee membagi-bagikan diskon besar-besaran di Shopee Live & Shopee Video. Sangat disarankan untuk mengaktifkan Shopee Live XTRA dan menjadwalkan Live streaming pada jam sahur atau jam 8 malam untuk menangkap traffic Ramadan.",
    aiPromptTiktok: "🔥 INSIGHT BULAN INI (Tokopedia/TikTok): Siap-siap kampanye 'Ramadan Ekstra Seru 3.3' dan 'WIB (Waktu Indonesia Belanja) 25-Akhir Bulan'!\n💡 Strategi: Karena platform akan push Flash Sale & Diskon 90%, naikkan sedikit harga eceranmu sekarang, lalu berikan 'Coret Harga' besar-besaran saat promo 3.3 nanti."
  },
  paymentMethods: [
    { id: 'CASH', name: 'Tunai', enabled: true, description: 'Bayar di kasir' },
    { id: 'QRIS', name: 'QRIS', enabled: true, requiresProof: true, description: 'Scan QR Code' },
    { id: 'TRANSFER', name: 'Transfer Bank', enabled: true, requiresProof: true, description: 'BCA / Mandiri / BRI' },
    { id: 'CREDIT', name: 'Tempo', enabled: true, description: 'Hutang / Bayar Nanti' }
  ],
  deliveryMethods: [
    { id: 'PICKUP', name: 'Ambil di Toko', enabled: true, cost: 0, description: 'Pelanggan mengambil sendiri' },
    { id: 'COURIER', name: 'Kurir Toko', enabled: true, cost: 10000, description: 'Dikirim oleh kurir toko (Max 5km)' },
    { id: 'OJOL', name: 'Ojek Online', enabled: false, cost: 0, description: 'Ongkir bayar ditempat (COD)' }
  ],
  printer: { type: 'ESC/POS', paperWidth: 80, autoCut: true, characterSet: 'UTF-8' },
  createdAt: new Date().toISOString()
};

export default function AdminSettings() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'general' | 'shipping' | 'categories' | 'employees' | 'banners' | 'points'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data States
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [pointConfig, setPointConfig] = useState<PointSettings>({ earningRate: 10000, redemptionValue: 100, minRedeem: 50, isActive: true });
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // UI States
  const [newBanner, setNewBanner] = useState<Banner>({ title: '', subtitle: '', buttonText: 'Lihat', gradient: 'from-green-600 to-emerald-800', imageUrl: '', linkUrl: '', isActive: true });
  const [newCat, setNewCat] = useState('');
  const [newEmp, setNewEmp] = useState<Employee>({ name: '', role: 'kasir', phone: '', email: '', isActive: true });
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // New Delivery Input
  const [newDelivery, setNewDelivery] = useState<DeliveryMethod>({ id: '', name: '', enabled: true, cost: 0, description: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') { router.push('/'); return; }

      await Promise.all([loadSettings(), loadPointSettings(), loadCategories(), loadEmployees(), loadBanners(), loadWarehouses()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSettings = async () => {
    const snap = await getDoc(doc(db, 'settings', 'system'));
    if (snap.exists()) {
      const data = snap.data() as SystemSettings;
      // Merge with default to ensure new fields exist
      setSettings({
        ...defaultSettings,
        ...data,
        store: { ...defaultSettings.store, ...data.store },
        deliveryMethods: data.deliveryMethods || defaultSettings.deliveryMethods
      });
    }
  };

  const loadPointSettings = async () => {
    const snap = await getDoc(doc(db, 'settings', 'points'));
    if (snap.exists()) setPointConfig(snap.data() as PointSettings);
  };

  const loadCategories = async () => {
    const snap = await getDocs(collection(db, 'categories'));
    setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
  };

  const loadEmployees = async () => {
    const snap = await getDocs(collection(db, 'employees'));
    setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
  };

  const loadBanners = async () => {
    const snap = await getDocs(collection(db, 'banners'));
    setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
  };

  const loadWarehouses = async () => {
    const snap = await getDocs(collection(db, 'warehouses'));
    setWarehouses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
  };

  const handleSaveSystem = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'system'), { ...settings, updatedAt: new Date().toISOString() });
      notify.admin.success('Sistem diperbarui!');
    } catch {
      notify.admin.error('Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePoints = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'points'), pointConfig);
      notify.admin.success('Konfigurasi Point disimpan!');
    } finally { setSaving(false); }
  };

  const addCategory = async () => {
    if (!newCat) return;
    await addDoc(collection(db, 'categories'), { name: newCat, slug: newCat.toLowerCase().replace(/\s+/g, '-') });
    setNewCat('');
    loadCategories();
  };

  const addEmployee = async () => {
    if (!newEmp.name || !newEmp.email) return;
    await addDoc(collection(db, 'employees'), newEmp);
    setNewEmp({ name: '', role: 'kasir', phone: '', email: '', isActive: true });
    loadEmployees();
  };

  const handleAddBanner = async () => {
    if (banners.length >= 5) return notify.admin.error("Maksimal 5 banner!");
    await addDoc(collection(db, 'banners'), newBanner);
    setNewBanner({ title: '', subtitle: '', buttonText: 'Lihat', gradient: 'from-green-600 to-emerald-800', imageUrl: '', linkUrl: '', isActive: true });
    loadBanners();
  };

  // Delivery Management
  const handleUpdateDelivery = (index: number, field: keyof DeliveryMethod, value: any) => {
    const newMethods = [...settings.deliveryMethods];
    newMethods[index] = { ...newMethods[index], [field]: value };
    setSettings({ ...settings, deliveryMethods: newMethods });
  };

  const handleAddDelivery = () => {
    if (!newDelivery.name) return;
    const id = newDelivery.id || newDelivery.name.toUpperCase().replace(/\s+/g, '_');
    const newMethods = [...settings.deliveryMethods, { ...newDelivery, id }];
    setSettings({ ...settings, deliveryMethods: newMethods });
    setNewDelivery({ id: '', name: '', enabled: true, cost: 0, description: '' });
  };

  const handleDeleteDelivery = (index: number) => {
    const newMethods = settings.deliveryMethods.filter((_, i) => i !== index);
    setSettings({ ...settings, deliveryMethods: newMethods });
  };

  const handleBackup = async () => {
    setBackupStatus('Exporting...');
    try {
      const colls = ['products', 'orders', 'customers', 'suppliers', 'categories', 'employees', 'banners', 'settings'];
      const wb = XLSX.utils.book_new();
      for (const colName of colls) {
        let data: any[] = [];
        if (colName === 'settings') {
           // Special case for settings which are docs, not collection
           const sys = await getDoc(doc(db, 'settings', 'system'));
           const pts = await getDoc(doc(db, 'settings', 'points'));
           if (sys.exists()) data.push({ id: 'system', ...sys.data() });
           if (pts.exists()) data.push({ id: 'points', ...pts.data() });
        } else {
           const snap = await getDocs(collection(db, colName));
           data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        if (data.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), colName);
      }
      XLSX.writeFile(wb, `ataya-backup-${new Date().toISOString().split('T')[0]}.xlsx`);
      setBackupStatus('Success!');
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (e) { 
      console.error(e);
      setBackupStatus('Failed'); 
    }
  };

  const handleRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm('⚠️ PERINGATAN: Menghapus data lama! Lanjutkan?')) return;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        
        // Helper to process standard collections
        const processCollection = async (sheetName: string) => {
            if (!wb.SheetNames.includes(sheetName)) return;
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as Record<string, unknown>[];
            
            // Delete old data
            const oldSnap = await getDocs(collection(db, sheetName));
            const deleteBatch = writeBatch(db);
            oldSnap.docs.forEach(d => deleteBatch.delete(d.ref));
            await deleteBatch.commit();
            
            // Insert new data
            for (let i = 0; i < data.length; i += 500) {
              const batch = writeBatch(db);
              data.slice(i, i + 500).forEach(row => {
                const { id, ...rest } = row;
                const docRef = typeof id === 'string' && id
                  ? doc(db, sheetName, id)
                  : doc(collection(db, sheetName));
                batch.set(docRef, rest);
              });
              await batch.commit();
            }
        }

        // Process Settings separately
        if (wb.SheetNames.includes('settings')) {
           const settingsData = XLSX.utils.sheet_to_json(wb.Sheets['settings']) as any[];
           const batch = writeBatch(db);
           settingsData.forEach(s => {
              if (s.id) batch.set(doc(db, 'settings', s.id), s);
           });
           await batch.commit();
        }

        const collections = ['products', 'orders', 'customers', 'suppliers', 'categories', 'employees', 'banners'];
        for (const col of collections) await processCollection(col);

        notify.success("Restore berhasil! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) { 
        console.error(e);
        notify.error("Restore gagal check console");
        setIsRestoring(false); 
      }
    };
    reader.readAsBinaryString(file);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-xs tracking-widest animate-pulse">Initializing system...</div>;


  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto bg-[#F8FAFC] min-h-screen pb-32 font-sans text-slate-900">
      <Toaster position="top-right" />

      {/* HEADER NAV */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings size={32} className="text-slate-900" /> Settings
          </h1>
          <p className="text-xs font-bold text-slate-500 mt-2">Pusat kontrol & konfigurasi toko</p>
        </div>

        <div className="flex bg-white shadow-sm border border-slate-200 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'general', label: 'Umum', icon: Globe },
            { id: 'shipping', label: 'Pengiriman', icon: Truck },
            { id: 'points', label: 'Loyalty', icon: Coins },
            { id: 'categories', label: 'Kategori', icon: Tag },
            { id: 'employees', label: 'Staff', icon: Users },
            { id: 'banners', label: 'Banner', icon: Sparkles },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- TAB CONTENT --- */}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-8">
            {/* STORE IDENTITY */}
            <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <h2 className="font-black text-xs tracking-widest text-slate-400 uppercase flex items-center gap-2"><Store size={16} /> Identitas Toko</h2>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-500">Mode Maintenance</span>
                    <button 
                      onClick={() => setSettings({ ...settings, store: { ...settings.store, maintenanceMode: !settings.store.maintenanceMode } })}
                      className={`w-8 h-4 rounded-full relative transition-all ${settings.store.maintenanceMode ? 'bg-rose-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.store.maintenanceMode ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500">Nama Toko</label>
                  <input type="text" value={settings.store.name} onChange={e => setSettings({ ...settings, store: { ...settings.store, name: e.target.value } })} className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm transition-all outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500">WhatsApp / Telepon</label>
                  <input type="text" value={settings.store.phone} onChange={e => setSettings({ ...settings, store: { ...settings.store, phone: e.target.value } })} className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm transition-all outline-none" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500">Alamat Lengkap</label>
                  <textarea value={settings.store.address} onChange={e => setSettings({ ...settings, store: { ...settings.store, address: e.target.value } })} className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm transition-all outline-none h-20 resize-none" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                   <label className="text-[10px] font-bold text-slate-500">Running Text (Pengumuman)</label>
                   <input type="text" value={settings.store.runningText || ''} onChange={e => setSettings({ ...settings, store: { ...settings.store, runningText: e.target.value } })} className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm transition-all outline-none" placeholder="Contoh: Diskon 50% Hari Ini!" />
                </div>

                <div className="md:col-span-2 pt-4 border-t border-slate-100">
                    <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest mb-3">AI Promosi Marketplace</h3>
                    <div className="space-y-4">
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500">Insight AI Shopee Calculator</label>
                            <textarea 
                              rows={3}
                              placeholder="Masukkan info promo Shopee bulan ini..." 
                              value={settings.store.aiPromptShopee || ''} 
                              onChange={e => setSettings({ ...settings, store: { ...settings.store, aiPromptShopee: e.target.value } })} 
                              className="w-full p-3 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 text-xs font-medium outline-none resize-none" 
                            />
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500">Insight AI TikTok/Tokopedia Calculator</label>
                            <textarea 
                              rows={3}
                              placeholder="Masukkan info promo TikTok/Tokopedia bulan ini..." 
                              value={settings.store.aiPromptTiktok || ''} 
                              onChange={e => setSettings({ ...settings, store: { ...settings.store, aiPromptTiktok: e.target.value } })} 
                              className="w-full p-3 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 text-xs font-medium outline-none resize-none" 
                            />
                         </div>
                    </div>
                </div>
                
                <div className="md:col-span-2 space-y-1.5 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-500">Gudang Utama (Stok Display)</label>
                  <select
                    value={settings.displayWarehouseId || ''}
                    onChange={e => setSettings({ ...settings, displayWarehouseId: e.target.value })}
                    className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm outline-none"
                  >
                    <option value="">-- Tampilkan Total Stok (Semua Gudang) --</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* PAYMENT METHODS */}
            <section className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100">
              <h2 className="font-black text-xs tracking-widest text-slate-400 uppercase mb-6 flex items-center gap-2"><CreditCard size={16} /> Metode Pembayaran</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {settings.paymentMethods.map((pm, idx) => (
                  <div key={pm.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${pm.enabled ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div>
                        <span className="font-black text-xs text-slate-800 block">{pm.name}</span>
                        <span className="text-[10px] text-slate-500">{pm.description}</span>
                    </div>

                    <button
                      onClick={() => {
                        const newMethods = [...settings.paymentMethods];
                        newMethods[idx].enabled = !newMethods[idx].enabled;
                        setSettings({ ...settings, paymentMethods: newMethods });
                      }}
                      className={`w-10 h-5 rounded-full relative transition-all ${pm.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${pm.enabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
             {/* SAVE BUTTON */}
            <button onClick={handleSaveSystem} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>

            {/* PRINTER SETTINGS */}
            <section className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
              <h2 className="font-black text-xs tracking-widest text-slate-500 uppercase mb-6 flex items-center gap-2"><Printer size={16} /> Printer Kasir</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase">Kertas</label>
                      <select value={settings.printer.paperWidth} onChange={e => setSettings({ ...settings, printer: { ...settings.printer, paperWidth: Number(e.target.value) } })} className="w-full bg-white/10 p-3 rounded-xl border-none font-bold text-xs outline-none">
                        <option value={58} className="text-black">58mm</option>
                        <option value={80} className="text-black">80mm</option>
                      </select>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase">Fitur</label>
                      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl h-[42px]">
                        <input type="checkbox" checked={settings.printer.autoCut} onChange={e => setSettings({ ...settings, printer: { ...settings.printer, autoCut: e.target.checked } })} className="w-4 h-4 rounded accent-emerald-500" />
                        <span className="text-[10px] font-bold">Auto Cut</span>
                      </div>
                  </div>
                </div>
              </div>
            </section>

            {/* DATA SECURITY */}
            <section className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
              <h2 className="font-black text-xs tracking-widest text-amber-700 uppercase mb-6 flex items-center gap-2"><Shield size={16} /> Database</h2>

              <div className="space-y-3">
                <button onClick={handleBackup} className="w-full bg-white p-4 rounded-2xl shadow-sm border border-amber-200 flex items-center justify-between group hover:bg-amber-500 transition-all">
                  <span className="text-[10px] font-black group-hover:text-white uppercase tracking-wider">{backupStatus || 'Download Backup (.xlsx)'}</span>
                  <Download className="text-amber-500 group-hover:text-white" size={16} />
                </button>

                <label className="w-full bg-white p-4 rounded-2xl shadow-sm border border-amber-200 flex items-center justify-between cursor-pointer hover:bg-slate-900 group transition-all">
                  <span className="text-[10px] font-black group-hover:text-white uppercase tracking-wider">{isRestoring ? 'Memproses...' : 'Restore Database'}</span>
                  <Upload className="text-slate-900 group-hover:text-white" size={16} />
                  <input type="file" className="hidden" accept=".xlsx" onChange={handleRestore} disabled={isRestoring} />
                </label>
                <p className="text-[9px] text-amber-600/70 font-bold text-center leading-relaxed">
                   ⚠️ Restore akan menimpa data yang ada. Pastikan backup terlebih dahulu.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* --- SHIPPING TAB --- */}
      {activeTab === 'shipping' && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* List Shipping */}
                <div className="md:col-span-2 space-y-4">
                    {settings.deliveryMethods.map((dm, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between group hover:border-blue-100 transition-all">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-2xl ${dm.enabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-black text-sm text-slate-900">{dm.name}</h3>
                                        {dm.enabled && <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md">AKTIF</span>}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mb-1">{dm.description}</p>
                                    <p className="text-xs font-black text-slate-900">Biaya: Rp {dm.cost.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-end md:self-center">
                                <button 
                                    onClick={() => handleUpdateDelivery(idx, 'enabled', !dm.enabled)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${dm.enabled ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                                >
                                    {dm.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                                <button onClick={() => handleDeleteDelivery(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add New Shipping */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-fit sticky top-6">
                    <h2 className="font-black text-xs tracking-widest text-slate-400 uppercase mb-6">Tambah Metode</h2>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nama Metode (ex: JNE)" value={newDelivery.name} onChange={e => setNewDelivery({ ...newDelivery, name: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 text-xs font-bold" />
                        <input type="text" placeholder="Deskripsi Singkat" value={newDelivery.description} onChange={e => setNewDelivery({ ...newDelivery, description: e.target.value })} className="w-full p-3 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 text-xs font-bold" />
                        <div className="relative">
                            <span className="absolute left-3 top-3 text-xs font-bold text-slate-400">Rp</span>
                            <input type="number" placeholder="Biaya Ongkir" value={newDelivery.cost} onChange={e => setNewDelivery({ ...newDelivery, cost: Number(e.target.value) })} className="w-full p-3 pl-8 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 text-xs font-bold" />
                        </div>
                        <button onClick={handleAddDelivery} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all">
                            Tambah
                        </button>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-slate-100">
                         <button onClick={handleSaveSystem} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                            <Save size={14} /> Simpan Semua
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 2. LOYALTY POINTS TAB */}
      {activeTab === 'points' && (
        <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-6 duration-500">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100 space-y-10 relative overflow-hidden">
            <Coins className="absolute -right-10 -top-10 text-slate-50 opacity-50" size={250} />
            <div className="relative z-10 flex justify-between items-center">
              <h2 className="font-black text-sm text-slate-800 flex items-center gap-3">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200"><Sparkles size={20} /></div>
                Loyalty Point System
              </h2>
              <button
                onClick={() => setPointConfig({ ...pointConfig, isActive: !pointConfig.isActive })}
                className={`px-5 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${pointConfig.isActive ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-slate-100 text-slate-400'}`}
              >
                {pointConfig.isActive ? 'AKTIF' : 'NONAKTIF'}
              </button>

            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 tracking-widest px-2 uppercase">Belanja (IDR) dapat 1 Point</label>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 mb-2">Setiap kelipatan</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xl font-black text-slate-400">Rp</span>
                    <input type="number" value={pointConfig.earningRate} onChange={e => setPointConfig({ ...pointConfig, earningRate: Number(e.target.value) })} className="bg-transparent text-2xl font-black w-full outline-none text-slate-900" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 tracking-widest px-2 uppercase">Nilai Tukar 1 Point (IDR)</label>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 mb-2">Bernilai diskon</p>
                  <div className="flex items-center gap-1">
                     <span className="text-xl font-black text-slate-400">Rp</span>
                     <input type="number" value={pointConfig.redemptionValue} onChange={e => setPointConfig({ ...pointConfig, redemptionValue: Number(e.target.value) })} className="bg-transparent text-2xl font-black w-full outline-none text-amber-600" />
                  </div>
                </div>
              </div>

            </div>

            <div className="relative z-10 bg-slate-900 text-white p-8 rounded-[2.5rem]">
              <div className="flex justify-between items-center mb-6">
                <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Minimum Penukaran</label>
                <span className="text-xl font-black">{pointConfig.minRedeem} <span className="text-[10px] text-slate-500">POINTS</span></span>
              </div>

              <input type="range" min="0" max="1000" step="10" value={pointConfig.minRedeem} onChange={e => setPointConfig({ ...pointConfig, minRedeem: Number(e.target.value) })} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500" />
            </div>

            <button onClick={handleSavePoints} className="relative z-10 w-full bg-amber-600 text-white py-5 rounded-[2rem] font-black text-xs tracking-[0.2em] shadow-xl shadow-amber-100 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3">
              <Save size={18} /> {saving ? 'MENYIMPAN...' : 'SIMPAN KONFIGURASI'}
            </button>

          </div>
        </div>
      )}

      {/* 3. CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
            <h2 className="font-black text-[10px] tracking-widest text-slate-400 mb-8 flex items-center gap-2 uppercase"><Tag size={16} /> Master Kategori</h2>

            <div className="flex gap-3 mb-10">
              <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} className="flex-1 p-5 rounded-3xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-sm outline-none focus:ring-emerald-500 transition-all" placeholder="Input Nama Kategori Baru..." />
              <button onClick={addCategory} className="bg-emerald-600 text-white px-8 rounded-3xl font-black uppercase text-xs shadow-lg shadow-emerald-100 active:scale-95 transition-all flex items-center gap-2">
                 <Plus size={16} /> Tambah
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="bg-slate-50 p-5 rounded-3xl flex justify-between items-center group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-black text-xs text-slate-700">{cat.name}</span>
                  </div>

                  <button onClick={() => deleteDoc(doc(db, 'categories', cat.id!)).then(loadCategories)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. EMPLOYEES TAB */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-6">
          <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 sticky top-10">
              <h2 className="font-black text-[10px] tracking-widest text-slate-400 mb-6 uppercase">Registrasi Staff</h2>

              <div className="space-y-4">
                <input type="text" placeholder="Nama Lengkap" value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-xs outline-none" />
                <input type="email" placeholder="Email Akun (Login)" value={newEmp.email} onChange={e => setNewEmp({ ...newEmp, email: e.target.value })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-xs outline-none" />
                <input type="tel" placeholder="No. Telepon" value={newEmp.phone} onChange={e => setNewEmp({ ...newEmp, phone: e.target.value })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-xs outline-none" />
                <select value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value as 'admin' | 'kasir' })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-xs outline-none cursor-pointer">
                  <option value="kasir">KASIR / SALES</option>
                  <option value="admin">ADMINISTRATOR</option>
                </select>
                <button onClick={addEmployee} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-[10px] tracking-[0.2em] shadow-lg shadow-blue-100 active:scale-95 transition-all uppercase">
                    Tambah Staff
                </button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8 space-y-4">
            <h2 className="font-black text-[10px] tracking-widest text-slate-400 px-4 uppercase">Daftar Karyawan Aktif</h2>

            {employees.map(emp => (
              <div key={emp.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm hover:scale-[1.01] transition-all">
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl ${emp.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Users size={24} />
                  </div>
                  <div>
                    <p className="font-black text-sm tracking-tight text-slate-900">{emp.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">{emp.role} • {emp.email}</p>
                  </div>
                </div>
                <button onClick={() => updateDoc(doc(db, 'employees', emp.id!), { isActive: !emp.isActive }).then(loadEmployees)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-[9px] font-black transition-all uppercase ${emp.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                  {emp.isActive ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {emp.isActive ? 'Aktif' : 'Blokir'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MULTI-BANNER TAB */}
      {activeTab === 'banners' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-6">
          <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 sticky top-10">
              <h2 className="font-black text-[10px] tracking-widest text-slate-400 mb-6 flex items-center gap-2 uppercase">Slot Iklan ({banners.length}/5)</h2>

              <div className="space-y-4">
                <input type="text" placeholder="Headline / Judul" value={newBanner.title} onChange={e => setNewBanner({ ...newBanner, title: e.target.value })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-xs outline-none" />
                <input type="text" placeholder="Sub-judul (Pendek)" value={newBanner.subtitle} onChange={e => setNewBanner({ ...newBanner, subtitle: e.target.value })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-xs outline-none" />
                <input type="text" placeholder="URL Gambar (Opsional)" value={newBanner.imageUrl || ''} onChange={e => setNewBanner({ ...newBanner, imageUrl: e.target.value })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-[9px] outline-none" />
                <input type="text" placeholder="Link Tujuan (ex: /shop)" value={newBanner.linkUrl} onChange={e => setNewBanner({ ...newBanner, linkUrl: e.target.value })} className="w-full p-4 rounded-2xl bg-blue-50 border-none ring-1 ring-blue-100 font-black text-[9px] text-blue-700 placeholder:text-blue-300 outline-none" />
                <select value={newBanner.gradient} onChange={e => setNewBanner({ ...newBanner, gradient: e.target.value })} className="w-full p-4 rounded-2xl bg-slate-50 border-none ring-1 ring-slate-100 font-black text-xs outline-none cursor-pointer">
                  <option value="from-green-600 to-emerald-800">EMERALD GREEN</option>
                  <option value="from-blue-600 to-indigo-800">DEEP BLUE</option>
                  <option value="from-orange-500 to-red-600">VIBRANT ORANGE</option>
                  <option value="from-zinc-800 to-black">NEO BLACK</option>
                  <option value="from-pink-500 to-rose-600">HOT PINK</option>
                  <option value="from-violet-600 to-purple-800">ROYAL PURPLE</option>
                </select>
                <button onClick={handleAddBanner} disabled={banners.length >= 5} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] tracking-[0.2em] disabled:opacity-30 active:scale-95 transition-all uppercase">
                    Publish Banner
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <h2 className="font-black text-[10px] tracking-widest text-slate-400 px-4 uppercase">Live Preview</h2>

            {banners.map((bn, idx) => (
              <div key={bn.id} className={`relative group overflow-hidden rounded-[3rem] bg-gradient-to-r ${bn.gradient} p-8 text-white shadow-xl transition-all hover:scale-[1.02]`}>
                <div className="flex justify-between items-start relative z-10">
                  <div className="max-w-[70%]">
                    <span className="text-[9px] font-black bg-black/20 px-3 py-1 rounded-full mb-4 inline-block tracking-[0.2em]">SLOT 0{idx + 1}</span>
                    <h3 className="font-black text-xl leading-none mb-2 tracking-tighter">{bn.title}</h3>

                    <p className="text-xs font-medium opacity-80 mb-6">{bn.subtitle}</p>
                    <div className="flex items-center gap-2 text-[9px] font-black bg-white/10 w-fit px-3 py-1 rounded-lg">
                      <ExternalLink size={10} /> {bn.linkUrl || 'NO_LINK'}
                    </div>
                  </div>
                  <button onClick={() => deleteDoc(doc(db, 'banners', bn.id!)).then(loadBanners)} className="bg-red-500/20 p-3 rounded-full hover:bg-red-500 transition-all text-white">
                    <Trash2 size={20} />
                  </button>
                </div>
                {bn.imageUrl ? (
                  <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40">
                    <Image
                      src={bn.imageUrl}
                      fill
                      className="object-contain opacity-30 group-hover:opacity-50 transition-all"
                      alt={bn.title}
                    />
                  </div>
                ) : <Package size={120} className="absolute right-[-20px] bottom-[-20px] opacity-10 rotate-12" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
