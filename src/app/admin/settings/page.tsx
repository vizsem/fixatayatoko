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
  Plus, Trash2, Users, Tag, Save, Sparkles, Package, ExternalLink, Coins, CheckCircle2
} from 'lucide-react';


// --- TYPES ---
type PaymentMethod = { id: string; name: string; enabled: boolean; requiresProof?: boolean; };
type DeliveryMethod = { id: string; name: string; enabled: boolean; cost: number; description: string; };
type PrinterSettings = { type: 'ESC/POS' | 'Generic'; paperWidth: number; autoCut: boolean; characterSet: string; };
type StoreSettings = { name: string; address: string; phone: string; email: string; footerMsg?: string; };
type PointSettings = { earningRate: number; redemptionValue: number; minRedeem: number; isActive: boolean; };

type SystemSettings = {
  store: StoreSettings;
  paymentMethods: PaymentMethod[];
  deliveryMethods: DeliveryMethod[];
  printer: PrinterSettings;
  createdAt: string;
};

type Employee = { id?: string; name: string; role: 'admin' | 'kasir'; phone: string; email: string; isActive: boolean; };
type Category = { id?: string; name: string; slug: string; };
type Banner = { id?: string; title: string; subtitle: string; buttonText: string; gradient: string; imageUrl?: string; linkUrl: string; isActive: boolean; };

// --- DEFAULT SETTINGS ---
const defaultSettings: SystemSettings = {
  store: { name: 'Atayatoko2', address: 'Jl. Pandan 98, Semen, Kediri', phone: '0858-5316-1174', email: 'atayatoko2@gmail.com', footerMsg: 'Terima kasih telah berbelanja!' },

  paymentMethods: [
    { id: 'CASH', name: 'Tunai', enabled: true },
    { id: 'QRIS', name: 'QRIS', enabled: true, requiresProof: true },
    { id: 'TRANSFER', name: 'Transfer Bank', enabled: true, requiresProof: true },
    { id: 'CREDIT', name: 'Tempo', enabled: true }
  ],
  deliveryMethods: [
    { id: 'PICKUP', name: 'Ambil di Toko', enabled: true, cost: 0, description: 'Pelanggan mengambil sendiri' },
    { id: 'COURIER', name: 'Kurir Toko', enabled: true, cost: 15000, description: 'Dikirim oleh kurir toko' }
  ],
  printer: { type: 'ESC/POS', paperWidth: 80, autoCut: true, characterSet: 'UTF-8' },
  createdAt: new Date().toISOString()
};

export default function AdminSettings() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'employees' | 'banners' | 'points'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data States
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [pointConfig, setPointConfig] = useState<PointSettings>({ earningRate: 10000, redemptionValue: 100, minRedeem: 50, isActive: true });
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);

  // UI States
  const [newBanner, setNewBanner] = useState<Banner>({ title: '', subtitle: '', buttonText: 'Lihat', gradient: 'from-green-600 to-emerald-800', imageUrl: '', linkUrl: '', isActive: true });
  const [newCat, setNewCat] = useState('');
  const [newEmp, setNewEmp] = useState<Employee>({ name: '', role: 'kasir', phone: '', email: '', isActive: true });
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') { router.push('/'); return; }

      await Promise.all([loadSettings(), loadPointSettings(), loadCategories(), loadEmployees(), loadBanners()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSettings = async () => {
    const snap = await getDoc(doc(db, 'settings', 'system'));
    if (snap.exists()) setSettings(snap.data() as SystemSettings);
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

  const handleSaveSystem = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'system'), { ...settings, updatedAt: new Date().toISOString() });
      alert('Sistem diperbarui!');
    } catch {
      alert('Gagal menyimpan.');
    } finally {
      setSaving(false);
    }

  };

  const handleSavePoints = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'points'), pointConfig);
      alert('Konfigurasi Point disimpan!');
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
    if (banners.length >= 5) return alert("Maksimal 5 banner!");
    await addDoc(collection(db, 'banners'), newBanner);
    setNewBanner({ title: '', subtitle: '', buttonText: 'Lihat', gradient: 'from-green-600 to-emerald-800', imageUrl: '', linkUrl: '', isActive: true });
    loadBanners();
  };

  const handleBackup = async () => {
    setBackupStatus('Exporting...');
    try {
      const colls = ['products', 'orders', 'customers', 'suppliers', 'categories', 'employees', 'banners'];
      const wb = XLSX.utils.book_new();
      for (const colName of colls) {
        const snap = await getDocs(collection(db, colName));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (data.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), colName);
      }
      XLSX.writeFile(wb, `ataya-backup-${new Date().toLocaleDateString()}.xlsx`);
      setBackupStatus('Success!');
    } catch { setBackupStatus('Failed'); }

  };

  const handleRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm('⚠️ PERINGATAN: Menghapus data lama! Lanjutkan?')) return;
    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        for (const sheetName of wb.SheetNames) {
          const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as Record<string, unknown>[];

          const oldSnap = await getDocs(collection(db, sheetName));
          const deleteBatch = writeBatch(db);
          oldSnap.docs.forEach(d => deleteBatch.delete(d.ref));
          await deleteBatch.commit();
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
        window.location.reload();
      } catch { setIsRestoring(false); }

    };
    reader.readAsBinaryString(file);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-xs tracking-widest animate-pulse">Initializing system...</div>;


  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto bg-[#FBFBFE] min-h-screen pb-32 font-sans">

      {/* HEADER NAV */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter flex items-center gap-3">
            <Settings size={38} className="text-blue-600" /> Control panel
          </h1>
          <p className="text-[10px] font-black text-gray-400 tracking-[0.3em] mt-2 italic">Terminal pusat pengaturan toko</p>
        </div>

        <div className="flex bg-white shadow-sm border border-gray-100 p-1.5 rounded-[2rem] w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'general', label: 'Sistem', icon: Settings },
            { id: 'points', label: 'Loyalty', icon: Coins },
            { id: 'categories', label: 'Kategori', icon: Tag },
            { id: 'employees', label: 'Staff', icon: Users },
            { id: 'banners', label: 'Ads', icon: Sparkles },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'general' | 'categories' | 'employees' | 'banners' | 'points')}
              className={`flex items-center gap-2 px-6 py-3 rounded-[1.5rem] text-[10px] font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
              <tab.icon size={14} /> {tab.label}
            </button>


          ))}
        </div>
      </div>

      {/* --- TAB CONTENT --- */}

      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
              <h2 className="font-black text-[10px] tracking-widest text-gray-400 mb-6 flex items-center gap-2"><Store size={16} /> Identitas toko</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 px-2">Nama bisnis</label>

                  <input type="text" value={settings.store.name} onChange={e => setSettings({ ...settings, store: { ...settings.store, name: e.target.value } })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 px-2">Hotline WhatsApp</label>

                  <input type="text" value={settings.store.phone} onChange={e => setSettings({ ...settings, store: { ...settings.store, phone: e.target.value } })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-sm" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black text-gray-400 px-2">Alamat operasional</label>

                  <textarea value={settings.store.address} onChange={e => setSettings({ ...settings, store: { ...settings.store, address: e.target.value } })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-bold text-sm h-24" />
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
              <h2 className="font-black text-[10px] tracking-widest text-gray-400 mb-6 flex items-center gap-2"><CreditCard size={16} /> Metode pembayaran</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {settings.paymentMethods.map((pm, idx) => (
                  <div key={pm.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${pm.enabled ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                    <span className="font-black text-[10px] text-gray-700">{pm.name}</span>

                    <button
                      onClick={() => {
                        const newMethods = [...settings.paymentMethods];
                        newMethods[idx].enabled = !newMethods[idx].enabled;
                        setSettings({ ...settings, paymentMethods: newMethods });
                      }}
                      className={`w-10 h-5 rounded-full relative transition-all ${pm.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${pm.enabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-black text-white p-8 rounded-[3rem] shadow-xl">
              <h2 className="font-black text-[10px] tracking-widest text-gray-500 mb-6 flex items-center gap-2"><Printer size={16} /> Struk & printer</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <select value={settings.printer.paperWidth} onChange={e => setSettings({ ...settings, printer: { ...settings.printer, paperWidth: Number(e.target.value) } })} className="bg-white/10 p-4 rounded-2xl border-none font-black text-xs">
                    <option value={58} className="text-black">58mm</option>
                    <option value={80} className="text-black">80mm</option>
                  </select>
                  <div className="flex items-center gap-2 p-4 bg-white/5 rounded-2xl">
                    <input type="checkbox" checked={settings.printer.autoCut} onChange={e => setSettings({ ...settings, printer: { ...settings.printer, autoCut: e.target.checked } })} className="w-4 h-4 rounded accent-blue-500" />
                    <span className="text-[10px] font-black">Auto cut</span>
                  </div>

                </div>
                <button onClick={handleSaveSystem} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-[10px] tracking-widest hover:bg-blue-500 transition-all">Update system</button>

              </div>
            </section>

            <section className="bg-orange-50 p-8 rounded-[3rem] border border-orange-100">
              <h2 className="font-black text-[10px] tracking-widest text-orange-700 mb-6 flex items-center gap-2"><Shield size={16} /> Keamanan data</h2>

              <div className="space-y-3">
                <button onClick={handleBackup} className="w-full bg-white p-4 rounded-2xl shadow-sm border border-orange-200 flex items-center justify-between group hover:bg-orange-600 transition-all">
                  <span className="text-[10px] font-black group-hover:text-white">{backupStatus || 'Download backup'}</span>
                  <Download className="text-orange-600 group-hover:text-white" size={16} />
                </button>

                <label className="w-full bg-white p-4 rounded-2xl shadow-sm border border-orange-200 flex items-center justify-between cursor-pointer hover:bg-black group transition-all">
                  <span className="text-[10px] font-black group-hover:text-white">{isRestoring ? 'Memulihkan...' : 'Restore data'}</span>
                  <Upload className="text-black group-hover:text-white" size={16} />

                  <input type="file" className="hidden" accept=".xlsx" onChange={handleRestore} />
                </label>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* 2. LOYALTY POINTS TAB */}
      {activeTab === 'points' && (
        <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-6 duration-500">
          <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-gray-100 space-y-10 relative overflow-hidden">
            <Coins className="absolute -right-10 -top-10 text-orange-50 opacity-50" size={250} />
            <div className="relative z-10 flex justify-between items-center">
              <h2 className="font-black text-sm text-gray-800 flex items-center gap-3">

                <div className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg shadow-orange-200"><Sparkles size={20} /></div>
                Loyalty Point System
              </h2>
              <button
                onClick={() => setPointConfig({ ...pointConfig, isActive: !pointConfig.isActive })}
                className={`px-5 py-2 rounded-full text-[10px] font-black tracking-widest transition-all ${pointConfig.isActive ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 'bg-gray-100 text-gray-400'}`}
              >
                {pointConfig.isActive ? 'Aktif' : 'Nonaktif'}
              </button>

            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 tracking-widest px-2">Point earning rate</label>
                <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 mb-2">Rp spend per 1 point</p>
                  <input type="number" value={pointConfig.earningRate} onChange={e => setPointConfig({ ...pointConfig, earningRate: Number(e.target.value) })} className="bg-transparent text-2xl font-black w-full outline-none" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 tracking-widest px-2">Redemption value</label>
                <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                  <p className="text-[9px] font-bold text-gray-400 mb-2">IDR value per 1 point</p>
                  <input type="number" value={pointConfig.redemptionValue} onChange={e => setPointConfig({ ...pointConfig, redemptionValue: Number(e.target.value) })} className="bg-transparent text-2xl font-black w-full outline-none text-orange-600" />
                </div>
              </div>

            </div>

            <div className="relative z-10 bg-black text-white p-8 rounded-[2.5rem]">
              <div className="flex justify-between items-center mb-6">
                <label className="text-[10px] font-black tracking-widest text-gray-500">Minimum redemption threshold</label>
                <span className="text-xl font-black">{pointConfig.minRedeem} <span className="text-[10px] text-gray-500">PTS</span></span>
              </div>

              <input type="range" min="0" max="1000" step="10" value={pointConfig.minRedeem} onChange={e => setPointConfig({ ...pointConfig, minRedeem: Number(e.target.value) })} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500" />
            </div>

            <button onClick={handleSavePoints} className="relative z-10 w-full bg-orange-600 text-white py-6 rounded-[2rem] font-black text-xs tracking-[0.3em] shadow-xl shadow-orange-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
              <Save size={18} /> {saving ? 'Menyimpan...' : 'Simpan aturan point'}
            </button>

          </div>
        </div>
      )}

      {/* 3. CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100">
            <h2 className="font-black text-[10px] tracking-widest text-gray-400 mb-8 flex items-center gap-2"><Tag size={16} /> Master kategori</h2>

            <div className="flex gap-3 mb-10">
              <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} className="flex-1 p-5 rounded-3xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-sm outline-none focus:ring-green-500 transition-all" placeholder="Input Nama Kategori..." />
              <button onClick={addCategory} className="bg-green-600 text-white px-8 rounded-3xl font-black uppercase text-xs shadow-lg shadow-green-100 active:scale-95 transition-all"><Plus /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="bg-gray-50 p-5 rounded-3xl flex justify-between items-center group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-black text-xs text-gray-700">{cat.name}</span>
                  </div>

                  <button onClick={() => deleteDoc(doc(db, 'categories', cat.id!)).then(loadCategories)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
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
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 sticky top-10">
              <h2 className="font-black text-[10px] tracking-widest text-gray-400 mb-6">Registrasi staff</h2>

              <div className="space-y-4">
                <input type="text" placeholder="Nama Lengkap" value={newEmp.name} onChange={e => setNewEmp({ ...newEmp, name: e.target.value })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-xs" />
                <input type="email" placeholder="Email Akun" value={newEmp.email} onChange={e => setNewEmp({ ...newEmp, email: e.target.value })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-xs" />
                <select value={newEmp.role} onChange={e => setNewEmp({ ...newEmp, role: e.target.value as 'admin' | 'kasir' })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-xs">

                  <option value="kasir">KASIR / SALES</option>
                  <option value="admin">ADMINISTRATOR</option>
                </select>
                <button onClick={addEmployee} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-[10px] tracking-[0.2em] shadow-lg shadow-blue-100 active:scale-95 transition-all">Daftarkan staff</button>

              </div>
            </div>
          </div>
          <div className="lg:col-span-8 space-y-4">
            <h2 className="font-black text-[10px] tracking-widest text-gray-400 px-4">Daftar karyawan aktif</h2>

            {employees.map(emp => (
              <div key={emp.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 flex justify-between items-center shadow-sm hover:scale-[1.01] transition-all">
                <div className="flex items-center gap-5">
                  <div className={`p-4 rounded-2xl ${emp.role === 'admin' ? 'bg-black text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Users size={24} />
                  </div>
                  <div>
                    <p className="font-black text-sm tracking-tighter">{emp.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 tracking-widest italic">{emp.role} • {emp.email}</p>
                  </div>

                </div>
                <button onClick={() => updateDoc(doc(db, 'employees', emp.id!), { isActive: !emp.isActive }).then(loadEmployees)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-[9px] font-black transition-all ${emp.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  {emp.isActive ? <CheckCircle2 size={12} /> : null} {emp.isActive ? 'Aktif' : 'Blokir'}
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
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 sticky top-10">
              <h2 className="font-black text-[10px] tracking-widest text-gray-400 mb-6 flex items-center gap-2">Ads slot ({banners.length}/5)</h2>

              <div className="space-y-4">
                <input type="text" placeholder="Headline" value={newBanner.title} onChange={e => setNewBanner({ ...newBanner, title: e.target.value })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-xs" />
                <input type="text" placeholder="Short Desc" value={newBanner.subtitle} onChange={e => setNewBanner({ ...newBanner, subtitle: e.target.value })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-xs" />
                <input type="text" placeholder="Image URL" value={newBanner.imageUrl || ''} onChange={e => setNewBanner({ ...newBanner, imageUrl: e.target.value })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-[9px]" />
                <input type="text" placeholder="Redirect Link (ex: /shop)" value={newBanner.linkUrl} onChange={e => setNewBanner({ ...newBanner, linkUrl: e.target.value })} className="w-full p-4 rounded-2xl bg-blue-50 border-none ring-1 ring-blue-100 font-black text-[9px] text-blue-700 placeholder:text-blue-300" />
                <select value={newBanner.gradient} onChange={e => setNewBanner({ ...newBanner, gradient: e.target.value })} className="w-full p-4 rounded-2xl bg-gray-50 border-none ring-1 ring-gray-100 font-black text-xs">
                  <option value="from-green-600 to-emerald-800">EMERALD GREEN</option>
                  <option value="from-blue-600 to-indigo-800">DEEP BLUE</option>
                  <option value="from-orange-500 to-red-600">VIBRANT ORANGE</option>
                  <option value="from-zinc-800 to-black">NEO BLACK</option>
                </select>
                <button onClick={handleAddBanner} disabled={banners.length >= 5} className="w-full bg-black text-white py-5 rounded-2xl font-black text-[10px] tracking-[0.2em] disabled:opacity-30 active:scale-95 transition-all">Push banner</button>

              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <h2 className="font-black text-[10px] tracking-widest text-gray-400 px-4">Live preview</h2>

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