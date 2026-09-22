'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  Settings, CreditCard, Printer, Store,
  Shield, Upload, Download,
  Plus, Trash2, Users, Tag, Save, Sparkles, AlertTriangle,
  Globe, Truck, Coins, CheckCircle2, ChevronRight, Activity, Database, RotateCcw,
  ExternalLink, MapPin, Navigation, Package, Receipt, FileSpreadsheet
} from 'lucide-react';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import { logActivity } from '@/lib/activity';
import { supabase } from '@/lib/supabase';

import { addDoc, auth, collection, db, deleteDoc, doc, getDoc, getDocs, onAuthStateChanged, ref, setDoc, updateDoc, writeBatch } from '@/lib/firebase';
import { isAdminRole, isAuthorizedAdmin } from '@/lib/auth-helpers';
import {
  DEFAULT_DELIVERY_METHODS,
  ATAYATOKO_WAREHOUSE,
  DeliveryMethodConfig
} from '@/lib/shipping';

import { TaxSettings, DEFAULT_TAX_SETTINGS } from '@/lib/tax';

// --- TYPES ---
type PaymentMethod = { id: string; name: string; enabled: boolean; requiresProof?: boolean; description?: string };
type DeliveryMethod = DeliveryMethodConfig;
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
  isCashDrawerEnabled?: boolean;
};
type PointSettings = { earningRate: number; redemptionValue: number; minRedeem: number; isActive: boolean; };

type SystemSettings = {
  store: StoreSettings;
  paymentMethods: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  printer: PrinterSettings;
  tax?: TaxSettings;
  createdAt: string;
  displayWarehouseId?: string;
  marketplaceFees?: { shopee: number; tiktok: number; tokopedia: number; lazada: number };
};

type Employee = { id?: string; name: string; role: 'admin' | 'kasir'; phone: string; email: string; isActive: boolean; };
type Category = { id?: string; name: string; slug: string; };
type Banner = { id?: string; title: string; subtitle: string; buttonText: string; gradient: string; imageUrl?: string; linkUrl: string; isActive: boolean; };
type Warehouse = { id: string; name: string; };

const defaultSettings: SystemSettings = {
  store: { 
    name: 'Atayatoko2', 
    address: 'Jl. Pandan 98, Semen, Kediri', 
    phone: '0858-5316-1174', 
    email: 'atayatoko2@gmail.com', 
    footerMsg: 'Terima kasih telah berbelanja!',
    maintenanceMode: false,
    runningText: 'Selamat datang di Ataya Toko! Dapatkan promo menarik setiap hari.',
    aiPromptShopee: "🔥 INSIGHT BULAN INI (Shopee): Kampanye 'Big Ramadan Sale 2026' sedang berlangsung.",
    aiPromptTiktok: "🔥 INSIGHT BULAN INI (Tokopedia/TikTok): Siap-siap kampanye 'Ramadan Ekstra Seru 3.3'!",
    isCashDrawerEnabled: true
  },
  paymentMethods: [
    { id: 'CASH', name: 'Tunai', enabled: true, description: 'Bayar di kasir' },
    { id: 'QRIS', name: 'QRIS', enabled: true, requiresProof: true, description: 'Scan QR Code' },
    { id: 'TRANSFER', name: 'Transfer Bank', enabled: true, requiresProof: true, description: 'BCA / Mandiri / BRI' },
    { id: 'CREDIT', name: 'Tempo', enabled: true, description: 'Hutang / Bayar Nanti' }
  ],
  deliveryMethods: DEFAULT_DELIVERY_METHODS,
  printer: { type: 'ESC/POS', paperWidth: 80, autoCut: true, characterSet: 'UTF-8' },
  tax: DEFAULT_TAX_SETTINGS,
  createdAt: new Date().toISOString(),
  marketplaceFees: { shopee: 6.5, tiktok: 4.5, tokopedia: 5.0, lazada: 6.0 }
};

export default function AdminSettings() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'general' | 'shipping' | 'tax' | 'categories' | 'employees' | 'banners' | 'points' | 'backup'>('general');
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
  const [newDelivery, setNewDelivery] = useState<DeliveryMethod>({
    id: '',
    name: '',
    type: 'EKSPEDISI',
    cost: 0,
    minSpendFree: 0,
    description: '',
    enabled: true,
    zone: 'LUAR_KOTA',
    estimatedTime: '2-4 Hari'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: any) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userDocData = userDoc.exists() ? userDoc.data() : null;
      if (!isAuthorizedAdmin(user, userDocData)) { router.push('/'); return; }

      await Promise.all([loadSettings(), loadPointSettings(), loadCategories(), loadEmployees(), loadBanners(), loadWarehouses()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSettings = async () => {
    const snap = await getDoc(doc(db, 'settings', 'system'));
    if (snap.exists()) {
      const data = snap.data() as SystemSettings;
      setSettings({ ...defaultSettings, ...data, store: { ...defaultSettings.store, ...data.store }, deliveryMethods: data.deliveryMethods || defaultSettings.deliveryMethods });
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
      await logActivity({ type: 'SETTING_UPDATE', description: 'Updated system settings (Store, Payment, Shipping)' });
      notify.admin.success('Sistem diperbarui!');
    } catch { notify.admin.error('Gagal menyimpan.'); }
    finally { setSaving(false); }
  };

  const handleSavePoints = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'points'), pointConfig);
      await logActivity({ type: 'SETTING_UPDATE', description: 'Updated loyalty point configuration' });
      notify.admin.success('Konfigurasi Point disimpan!');
    } finally { setSaving(false); }
  };

  const handleBackup = async () => {
    setBackupStatus('Exporting...');
    try {
      const colls = ['products', 'orders', 'customers', 'suppliers', 'categories', 'employees', 'banners', 'settings', 'inventory_logs'];
      const wb = XLSX.utils.book_new();
      for (const colName of colls) {
        let data: any[] = [];
        if (colName === 'settings') {
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
      await logActivity({ type: 'BACKUP_CREATED', description: 'System backup generated (.xlsx)' });
      setBackupStatus('Success!');
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (e) { console.error(e); setBackupStatus('Failed'); }
  };

  const handleRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm('⚠️ PERINGATAN: Menghapus data lama! Lanjutkan?')) return;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const processCollection = async (sheetName: string) => {
            if (!wb.SheetNames.includes(sheetName)) return;
            const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as Record<string, unknown>[];
            const oldSnap = await getDocs(collection(db, sheetName));
            const deleteBatch = writeBatch(db);
            oldSnap.docs.forEach(d => deleteBatch.delete((d as any).ref || doc(db, sheetName, d.id)));
            await deleteBatch.commit();
            for (let i = 0; i < data.length; i += 500) {
              const batch = writeBatch(db);
              data.slice(i, i + 500).forEach(row => {
                const { id, ...rest } = row;
                const docRef = typeof id === 'string' && id ? doc(db, sheetName, id) : doc(collection(db, sheetName));
                batch.set(docRef, rest);
              });
              await batch.commit();
            }
        }
        if (wb.SheetNames.includes('settings')) {
           const settingsData = XLSX.utils.sheet_to_json(wb.Sheets['settings']) as any[];
           const batch = writeBatch(db);
           settingsData.forEach(s => { if (s.id) batch.set(doc(db, 'settings', s.id), s); });
           await batch.commit();
        }
        const collections = ['products', 'orders', 'customers', 'suppliers', 'categories', 'employees', 'banners'];
        for (const col of collections) await processCollection(col);
        await logActivity({ type: 'RESTORE_PERFORMED', description: 'System database restored from file' });
        notify.success("Restore berhasil! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) { console.error(e); notify.error("Restore gagal"); setIsRestoring(false); }
    };
    reader.readAsBinaryString(file);
  };

  // --- HANDLERS FOR NEW TABS ---
  const handleAddDelivery = () => {
    if (!newDelivery.name || !newDelivery.id) return notify.error("Nama & ID wajib diisi");
    setSettings({ ...settings, deliveryMethods: [...settings.deliveryMethods, newDelivery] });
    setNewDelivery({
      id: '',
      name: '',
      type: 'EKSPEDISI',
      cost: 0,
      minSpendFree: 0,
      description: '',
      enabled: true,
      zone: 'LUAR_KOTA',
      estimatedTime: '2-4 Hari'
    });
  };

  const handleDeleteDelivery = (id: string) => {
    setSettings({ ...settings, deliveryMethods: settings.deliveryMethods.filter(d => d.id !== id) });
  };

  const handleAddCategory = async () => {
    if (!newCat) return;
    const slug = newCat.toLowerCase().replace(/\s+/g, '-');
    const docRef = await addDoc(collection(db, 'categories'), { name: newCat, slug });
    setCategories([...categories, { id: docRef.id, name: newCat, slug }]);
    setNewCat('');
    notify.success("Kategori ditambahkan");
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Hapus kategori ini?")) return;
    await deleteDoc(doc(db, 'categories', id));
    setCategories(categories.filter(c => c.id !== id));
    notify.success("Kategori dihapus");
  };

  const handleAddEmployee = async () => {
    if (!newEmp.name || !newEmp.email) return notify.error("Nama & Email wajib");
    const docRef = await addDoc(collection(db, 'employees'), newEmp);
    setEmployees([...employees, { id: docRef.id, ...newEmp }]);
    setNewEmp({ name: '', role: 'kasir', phone: '', email: '', isActive: true });
    notify.success("Staff ditambahkan");
  };

  const handleToggleEmployee = async (emp: Employee) => {
    const updated = { ...emp, isActive: !emp.isActive };
    await updateDoc(doc(db, 'employees', emp.id!), { isActive: !emp.isActive });
    setEmployees(employees.map(e => e.id === emp.id ? updated : e));
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm("Hapus staff?")) return;
    await deleteDoc(doc(db, 'employees', id));
    setEmployees(employees.filter(e => e.id !== id));
  };

  const handleAddBanner = async () => {
    if (!newBanner.title || !newBanner.imageUrl) return notify.error("Title & Image URL wajib");
    const docRef = await addDoc(collection(db, 'banners'), newBanner);
    setBanners([...banners, { id: docRef.id, ...newBanner }]);
    setNewBanner({ title: '', subtitle: '', buttonText: 'Lihat', gradient: 'from-green-600 to-emerald-800', imageUrl: '', linkUrl: '', isActive: true });
    notify.success("Banner ditambahkan");
  };

  const handleDeleteBanner = async (id: string) => {
    await deleteDoc(doc(db, 'banners', id));
    setBanners(banners.filter(b => b.id !== id));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-xs tracking-widest animate-pulse">Initializing system...</div>;

  return (
    <div className="p-3 md:p-4 max-w-7xl mx-auto bg-[#F8FAFC] min-h-screen pb-32 font-sans text-slate-900">
      <Toaster position="top-right" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
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
            { id: 'tax', label: 'Pajak (Tax)', icon: Receipt },
            { id: 'points', label: 'Loyalty', icon: Coins },
            { id: 'categories', label: 'Kategori', icon: Tag },
            { id: 'employees', label: 'Staff', icon: Users },
            { id: 'banners', label: 'Banner', icon: Sparkles },
            { id: 'backup', label: 'Database', icon: Database },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <h2 className="font-black text-xs tracking-widest text-slate-400 uppercase flex items-center gap-2 mb-6"><Store size={16} /> Identitas Toko</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500">Nama Toko</label>
                  <input type="text" value={settings.store.name} onChange={e => setSettings({ ...settings, store: { ...settings.store, name: e.target.value } })} className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500">WhatsApp / Telepon</label>
                  <input type="text" value={settings.store.phone} onChange={e => setSettings({ ...settings, store: { ...settings.store, phone: e.target.value } })} className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm outline-none" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500">Alamat Lengkap</label>
                  <textarea value={settings.store.address} onChange={e => setSettings({ ...settings, store: { ...settings.store, address: e.target.value } })} className="w-full p-3.5 rounded-xl bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-slate-900 font-bold text-sm outline-none h-20 resize-none" />
                </div>
              </div>
            </section>

            <section className="bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h2 className="font-black text-xs tracking-widest text-slate-400 uppercase mb-6 flex items-center gap-2"><CreditCard size={16} /> Marketplace Fees</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['shopee', 'tiktok', 'tokopedia', 'lazada'].map(m => (
                  <div key={m} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{m}</p>
                    <div className="flex items-center gap-1">
                      <input type="number" value={(settings.marketplaceFees as any)?.[m] || 0} onChange={e => setSettings({ ...settings, marketplaceFees: { ...settings.marketplaceFees!, [m]: Number(e.target.value) } })} className="w-full bg-transparent font-black text-sm outline-none" />
                      <span className="text-[10px] font-bold text-slate-400">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="space-y-8">
            <button onClick={handleSaveSystem} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            <section className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
              <h2 className="font-black text-xs tracking-widest text-slate-500 uppercase mb-6 flex items-center gap-2"><Printer size={16} /> Printer Kasir</h2>
              <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Paper Width</label>
                    <select value={settings.printer.paperWidth} onChange={e => setSettings({ ...settings, printer: { ...settings.printer, paperWidth: Number(e.target.value) } })} className="w-full bg-white/10 p-3 rounded-xl font-bold text-xs outline-none">
                      <option value={58} className="text-black">58mm</option>
                      <option value={80} className="text-black">80mm</option>
                    </select>
                </div>
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-xs font-bold text-white">Auto Cut</span>
                    <input type="checkbox" checked={settings.printer.autoCut} onChange={e => setSettings({ ...settings, printer: { ...settings.printer, autoCut: e.target.checked } })} className="w-4 h-4 rounded accent-emerald-500" />
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'tax' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
          <section className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
                  <Receipt size={24} className="text-indigo-600" /> Konfigurasi Pajak Toko (PPN / PPh Final)
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Atur mode pengenaan pajak resmi sesuai status badan usaha dan regulasi UU HPP / PMK.
                </p>
              </div>

              {/* Status Switch */}
              <label className="flex items-center gap-3 cursor-pointer bg-slate-50 p-2 px-4 rounded-2xl border border-slate-200">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  {settings.tax?.enabled ? '🟢 PAKAI PAJAK' : '⚪ TANPA PAJAK'}
                </span>
                <input
                  type="checkbox"
                  checked={settings.tax?.enabled || false}
                  onChange={e => setSettings({
                    ...settings,
                    tax: { ...(settings.tax || DEFAULT_TAX_SETTINGS), enabled: e.target.checked }
                  })}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>

            {settings.tax?.enabled && (
              <div className="space-y-6">
                {/* Mode Pilihan: PT PKP vs Perorangan UMKM */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-3">Opsi Skema Pajak</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setSettings({
                        ...settings,
                        tax: { ...settings.tax!, mode: 'UMKM_FINAL', pphFinalRate: 0.5 }
                      })}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${settings.tax.mode === 'UMKM_FINAL' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">👤 Perorangan / UMKM (PP 55/2022)</span>
                        {settings.tax.mode === 'UMKM_FINAL' && <CheckCircle2 size={18} className="text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        PPh Final <strong>0,5%</strong> dari total omzet tahunan di atas Rp 500 Juta. Pajak diikutsertakan di HPP toko.
                      </p>
                    </div>

                    <div
                      onClick={() => setSettings({
                        ...settings,
                        tax: { ...settings.tax!, mode: 'PT_PKP', ppnRate: 11 }
                      })}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${settings.tax.mode === 'PT_PKP' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">🏢 PT / Badan Usaha (PKP PPN)</span>
                        {settings.tax.mode === 'PT_PKP' && <CheckCircle2 size={18} className="text-indigo-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        PPN resmi <strong>11%</strong> (DPP Nilai Lain 11/12 UU HPP). Bebas PPN (0%) otomatis untuk produk kategori Sembako.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Mode Tampilan Harga: Inclusive vs Exclusive */}
                {settings.tax.mode === 'PT_PKP' && (
                  <div className="pt-4 border-t border-slate-100">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-3">Mekanisme Tampilan Harga Produk</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        onClick={() => setSettings({
                          ...settings,
                          tax: { ...settings.tax!, pricingMode: 'INCLUSIVE' }
                        })}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${settings.tax.pricingMode === 'INCLUSIVE' ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-100'}`}
                      >
                        <p className="text-xs font-black text-slate-800 mb-1">⭐ Harga Sudah Termasuk Pajak (Inclusive)</p>
                        <p className="text-[10px] text-slate-500">Harga etalase = harga bayar akhir. Pembeli tidak kaget di checkout.</p>
                      </div>

                      <div
                        onClick={() => setSettings({
                          ...settings,
                          tax: { ...settings.tax!, pricingMode: 'EXCLUSIVE' }
                        })}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${settings.tax.pricingMode === 'EXCLUSIVE' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100'}`}
                      >
                        <p className="text-xs font-black text-slate-800 mb-1">➕ Pajak Ditambahkan di Checkout (Exclusive)</p>
                        <p className="text-[10px] text-slate-500">PPN 11% dihitung secara terpisah di rincian tagihan akhir.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button onClick={handleSaveSystem} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-2">
                    <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan Pajak'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:border-emerald-100 transition-all">
              <div className="p-6 bg-emerald-50 text-emerald-600 rounded-3xl mb-6 group-hover:scale-110 transition-transform">
                <Download size={48} />
              </div>
              <h3 className="text-xl font-black mb-2">Export Data</h3>
              <p className="text-xs text-slate-500 font-medium mb-8">Unduh seluruh database (produk, pesanan, pelanggan) ke dalam file Excel (.xlsx)</p>
              <button onClick={handleBackup} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                {backupStatus || 'Download Backup'}
              </button>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:border-rose-100 transition-all">
              <div className="p-6 bg-rose-50 text-rose-600 rounded-3xl mb-6 group-hover:scale-110 transition-transform">
                <RotateCcw size={48} />
              </div>
              <h3 className="text-xl font-black mb-2">Restore Data</h3>
              <p className="text-xs text-slate-500 font-medium mb-8">Unggah file Excel hasil backup untuk memulihkan data. <span className="text-rose-500 font-black italic">Tindakan ini akan menghapus data lama!</span></p>
              <label className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2">
                <Upload size={16} /> {isRestoring ? 'Processing...' : 'Upload & Restore'}
                <input type="file" className="hidden" accept=".xlsx" onChange={handleRestore} disabled={isRestoring} />
              </label>
            </div>
          </div>
          
          <div className="mt-12 bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
            <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            <div>
              <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Penting</p>
              <p className="text-[11px] text-amber-700 leading-relaxed font-medium">Backup dilakukan secara manual. Kami menyarankan untuk melakukan backup setiap hari atau sebelum melakukan perubahan besar pada data produk. File restore harus menggunakan format Excel (.xlsx) yang dihasilkan dari fitur Export di atas.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shipping' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
          {/* WAREHOUSE LOCATION CARD */}
          <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-7 rounded-[2.5rem] shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Titik Gudang Pusat Terverifikasi
                  </span>
                </div>
                <h2 className="text-xl font-black">{ATAYATOKO_WAREHOUSE.name}</h2>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  {ATAYATOKO_WAREHOUSE.address}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                    Lat: {ATAYATOKO_WAREHOUSE.latitude}
                  </span>
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                    Long: {ATAYATOKO_WAREHOUSE.longitude}
                  </span>
                  <span className="bg-white/10 px-2.5 py-1 rounded-lg">
                    Kota: {ATAYATOKO_WAREHOUSE.city} (64116)
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                <a
                  href={ATAYATOKO_WAREHOUSE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
                >
                  <Navigation size={15} />
                  <span>Buka di Google Maps</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* ZONES STRATEGY GUIDE */}
            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                <span className="text-[10px] font-black uppercase text-emerald-400 block mb-0.5">Ring 1 (0 – 3 km)</span>
                <strong className="text-white text-xs block">Dalam Kota Dekat</strong>
                <span className="text-[10px] text-slate-400">Gratis Min. Rp50.000</span>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                <span className="text-[10px] font-black uppercase text-blue-400 block mb-0.5">Ring 2 (3 – 7 km)</span>
                <strong className="text-white text-xs block">Sekitar Kota Kediri</strong>
                <span className="text-[10px] text-slate-400">Subsidi / Min. Rp120.000</span>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                <span className="text-[10px] font-black uppercase text-purple-400 block mb-0.5">Ring 3 (7 – 12 km)</span>
                <strong className="text-white text-xs block">Pinggiran / Grosir</strong>
                <span className="text-[10px] text-slate-400">Armada / Min. Rp300.000</span>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                <span className="text-[10px] font-black uppercase text-amber-400 block mb-0.5">Luar Kota (&gt; 12 km)</span>
                <strong className="text-white text-xs block">JNE / J&T / Kargo</strong>
                <span className="text-[10px] text-slate-400">Nasional & Partai Bal</span>
              </div>
            </div>
          </section>

          {/* DELIVERY METHODS LIST */}
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2"><Truck className="text-slate-900" /> Pengaturan Metode Pengiriman</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Atur kurir toko, radius, dan ekspedisi luar kota</p>
              </div>
              <button onClick={handleSaveSystem} className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                Simpan Perubahan
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {settings.deliveryMethods.map((method) => (
                <div key={method.id} className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100 relative group">
                  <button onClick={() => handleDeleteDelivery(method.id)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all" title="Hapus">
                    <Trash2 size={16} />
                  </button>

                  <div className="flex items-center gap-3.5 mb-3">
                    <div className="p-3 bg-white rounded-2xl shadow-sm text-slate-900">
                      {method.type === 'CARGO' ? <Package size={20} className="text-amber-600" /> : method.type === 'PICKUP' ? <Store size={20} className="text-emerald-600" /> : <Truck size={20} className="text-slate-800" />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{method.name}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                          {method.type || 'KURIR'}
                        </span>
                        {method.zone && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                            {method.zone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium mb-3 leading-relaxed">
                    {method.description}
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Biaya Standar</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          value={method.cost}
                          onChange={(e) => {
                            const updated = settings.deliveryMethods.map((m) =>
                              m.id === method.id ? { ...m, cost: Number(e.target.value) } : m
                            );
                            setSettings({ ...settings, deliveryMethods: updated });
                          }}
                          className="bg-transparent text-right font-black text-xs outline-none w-24"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Min. Belanja Gratis</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          value={method.minSpendFree || 0}
                          onChange={(e) => {
                            const updated = settings.deliveryMethods.map((m) =>
                              m.id === method.id ? { ...m, minSpendFree: Number(e.target.value) } : m
                            );
                            setSettings({ ...settings, deliveryMethods: updated });
                          }}
                          placeholder="0 = Tidak ada"
                          className="bg-transparent text-right font-black text-xs outline-none w-24"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Status Aktif</span>
                      <input
                        type="checkbox"
                        checked={method.enabled}
                        onChange={(e) => {
                          const updated = settings.deliveryMethods.map((m) =>
                            m.id === method.id ? { ...m, enabled: e.target.checked } : m
                          );
                          setSettings({ ...settings, deliveryMethods: updated });
                        }}
                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ADD NEW DELIVERY METHOD */}
            <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Tambah Layanan Kurir / Ekspedisi Baru</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="ID (ex: SICEPAT)"
                  value={newDelivery.id}
                  onChange={(e) => setNewDelivery({ ...newDelivery, id: e.target.value.toUpperCase() })}
                  className="bg-white/10 p-3 rounded-xl text-xs font-bold outline-none placeholder:text-white/30"
                />
                <input
                  type="text"
                  placeholder="Nama Layanan"
                  value={newDelivery.name}
                  onChange={(e) => setNewDelivery({ ...newDelivery, name: e.target.value })}
                  className="bg-white/10 p-3 rounded-xl text-xs font-bold outline-none placeholder:text-white/30"
                />
                <input
                  type="number"
                  placeholder="Biaya Ongkir (Rp)"
                  value={newDelivery.cost || ''}
                  onChange={(e) => setNewDelivery({ ...newDelivery, cost: Number(e.target.value) })}
                  className="bg-white/10 p-3 rounded-xl text-xs font-bold outline-none placeholder:text-white/30"
                />
                <button
                  onClick={handleAddDelivery}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest py-3 transition-all"
                >
                  Tambah Layanan
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'points' && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-[1.5rem]"><Coins size={32} /></div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">Loyalty Points</h2>
                <p className="text-xs font-bold text-slate-500">Atur sistem poin hadiah pelanggan</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-black">Status Loyalty</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Aktifkan sistem poin</p>
                </div>
                <input type="checkbox" checked={pointConfig.isActive} onChange={e => setPointConfig({...pointConfig, isActive: e.target.checked})} className="w-6 h-6 rounded-lg accent-amber-500" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-2">1 Poin per Belanja</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">Rp</span>
                    <input type="number" value={pointConfig.earningRate} onChange={e => setPointConfig({...pointConfig, earningRate: Number(e.target.value)})} className="w-full bg-slate-50 p-4 pl-10 rounded-2xl text-sm font-black outline-none border border-transparent focus:border-amber-500 transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase px-2">Nilai Tukar 1 Poin</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">Rp</span>
                    <input type="number" value={pointConfig.redemptionValue} onChange={e => setPointConfig({...pointConfig, redemptionValue: Number(e.target.value)})} className="w-full bg-slate-50 p-4 pl-10 rounded-2xl text-sm font-black outline-none border border-transparent focus:border-amber-500 transition-all" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase px-2">Minimal Tukar Poin</label>
                <input type="number" value={pointConfig.minRedeem} onChange={e => setPointConfig({...pointConfig, minRedeem: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl text-sm font-black outline-none border border-transparent focus:border-amber-500 transition-all" />
              </div>

              <button onClick={handleSavePoints} disabled={saving} className="w-full bg-amber-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-100 hover:bg-amber-600 active:scale-95 transition-all">
                {saving ? 'Menyimpan...' : 'Simpan Konfigurasi Poin'}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="max-w-2xl mx-auto animate-in fade-in duration-500">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Tag className="text-slate-900" /> Kelola Kategori</h2>
            
            <div className="flex gap-2 mb-8">
              <input type="text" placeholder="Nama Kategori Baru..." value={newCat} onChange={e => setNewCat(e.target.value)} className="flex-1 bg-slate-50 p-4 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-slate-900 transition-all" />
              <button onClick={handleAddCategory} className="px-8 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Tambah</button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight">{cat.name}</p>
                    <p className="text-[9px] font-bold text-slate-400">slug: {cat.slug}</p>
                  </div>
                  <button onClick={() => handleDeleteCategory(cat.id!)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'employees' && (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-xl font-black mb-8 flex items-center gap-2"><Users className="text-slate-900" /> Kelola Staff</h2>

            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8">
              <h3 className="text-[10px] font-black uppercase text-slate-400 mb-4 px-2">Tambah Staff Baru</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input type="text" placeholder="Nama Lengkap" value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} className="bg-white p-4 rounded-2xl text-xs font-bold outline-none" />
                <input type="email" placeholder="Email" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} className="bg-white p-4 rounded-2xl text-xs font-bold outline-none" />
                <select value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value as any})} className="bg-white p-4 rounded-2xl text-xs font-bold outline-none">
                  <option value="kasir">Kasir</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={handleAddEmployee} className="bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest py-4">Tambah</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employees.map(emp => (
                <div key={emp.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100"><Users size={20} /></div>
                    <div>
                      <p className="text-xs font-black uppercase">{emp.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{emp.role} • {emp.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleEmployee(emp)} className={`p-2 rounded-xl transition-all ${emp.isActive ? 'text-emerald-500 bg-emerald-50' : 'text-slate-300 bg-white'}`}><CheckCircle2 size={18} /></button>
                    <button onClick={() => handleDeleteEmployee(emp.id!)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'banners' && (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-xl font-black mb-8 flex items-center gap-2"><Sparkles className="text-slate-900" /> Homepage Banners</h2>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white mb-12 shadow-2xl">
              <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-widest">Desain Banner Baru</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-500">Judul</label><input type="text" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} className="w-full bg-white/10 p-4 rounded-2xl text-xs font-bold outline-none" /></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-500">Subjudul</label><input type="text" value={newBanner.subtitle} onChange={e => setNewBanner({...newBanner, subtitle: e.target.value})} className="w-full bg-white/10 p-4 rounded-2xl text-xs font-bold outline-none" /></div>
                <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-500">Link URL</label><input type="text" value={newBanner.linkUrl} onChange={e => setNewBanner({...newBanner, linkUrl: e.target.value})} className="w-full bg-white/10 p-4 rounded-2xl text-xs font-bold outline-none" /></div>
                <div className="md:col-span-2 space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-500">Image URL</label><input type="text" value={newBanner.imageUrl} onChange={e => setNewBanner({...newBanner, imageUrl: e.target.value})} className="w-full bg-white/10 p-4 rounded-2xl text-xs font-bold outline-none" /></div>
                <div className="flex items-end"><button onClick={handleAddBanner} className="w-full bg-white text-slate-900 h-[52px] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Publish Banner</button></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {banners.map(banner => (
                <div key={banner.id} className={`relative p-8 rounded-[2.5rem] bg-gradient-to-br ${banner.gradient} text-white shadow-lg overflow-hidden group`}>
                  {banner.imageUrl && <img src={banner.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-110 transition-transform duration-700" alt="" />}
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${banner.isActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>{banner.isActive ? 'Active' : 'Draft'}</span>
                      <button onClick={() => handleDeleteBanner(banner.id!)} className="p-2 bg-white/10 rounded-xl hover:bg-rose-500 transition-colors"><Trash2 size={16} /></button>
                    </div>
                    <h3 className="text-xl font-black mb-1">{banner.title}</h3>
                    <p className="text-xs font-bold opacity-80 mb-6">{banner.subtitle}</p>
                    <button className="px-6 py-2.5 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest">{banner.buttonText}</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
