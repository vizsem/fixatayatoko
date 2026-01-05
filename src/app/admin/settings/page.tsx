'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc, getDoc, setDoc, collection, getDocs, 
  deleteDoc, addDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  Settings, CreditCard, Truck, Printer, Store,
  Shield, AlertTriangle, Upload, Download,
  Plus, Trash2, Users, Tag, Save, RefreshCcw, Sparkles, Package, ExternalLink
} from 'lucide-react';

// --- TYPES ---
type PaymentMethod = { id: string; name: string; enabled: boolean; requiresProof?: boolean; };
type DeliveryMethod = { id: string; name: string; enabled: boolean; cost: number; description: string; };
type PrinterSettings = { type: 'ESC/POS' | 'Generic'; paperWidth: number; autoCut: boolean; characterSet: string; };
type StoreSettings = { name: string; address: string; phone: string; email: string; footerMsg?: string; };

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
  store: { name: 'ATAYATOKO2', address: 'Jl. Pandan 98, Semen, Kediri', phone: '0858-5316-1174', email: 'atayatoko2@gmail.com', footerMsg: 'Terima kasih telah berbelanja!' },
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
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'employees' | 'banners'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data States
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [newBanner, setNewBanner] = useState<Banner>({
    title: '', subtitle: '', buttonText: 'Lihat',
    gradient: 'from-green-600 to-emerald-800', imageUrl: '', linkUrl: '', isActive: true
  });

  // Backup/Restore States
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Form Temp States
  const [newCat, setNewCat] = useState('');
  const [newEmp, setNewEmp] = useState<Employee>({ name: '', role: 'kasir', phone: '', email: '', isActive: true });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/profil/login'); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') { router.push('/'); return; }
      
      await Promise.all([loadSettings(), loadCategories(), loadEmployees(), loadBanners()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSettings = async () => {
    const snap = await getDoc(doc(db, 'settings', 'system'));
    if (snap.exists()) setSettings(snap.data() as SystemSettings);
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

  // --- HANDLERS ---
  const handleSaveSystem = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'system'), { ...settings, updatedAt: new Date().toISOString() });
      alert('Pengaturan sistem berhasil disimpan!');
    } catch (err) { setError('Gagal menyimpan data.'); }
    finally { setSaving(false); }
  };

  const addCategory = async () => {
    if (!newCat) return;
    const slug = newCat.toLowerCase().replace(/\s+/g, '-');
    await addDoc(collection(db, 'categories'), { name: newCat, slug });
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

  // --- BACKUP & RESTORE ---
  const handleBackup = async () => {
    setBackupStatus('Membuat backup...');
    try {
      const colls = ['products', 'orders', 'customers', 'suppliers', 'categories', 'employees', 'banners'];
      const wb = XLSX.utils.book_new();
      for (const colName of colls) {
        const snap = await getDocs(collection(db, colName));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (data.length > 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), colName);
      }
      XLSX.writeFile(wb, `ataya-backup-${new Date().getTime()}.xlsx`);
      setBackupStatus('Selesai!');
    } catch (e) { setBackupStatus('Gagal!'); }
  };

  const handleRestore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !confirm('⚠️ PERINGATAN: Ini akan menghapus data lama. Lanjutkan?')) return;
    setIsRestoring(true);
    setRestoreStatus('Membaca file...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        for (const sheetName of wb.SheetNames) {
          setRestoreStatus(`Memproses: ${sheetName}`);
          const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];
          const oldSnap = await getDocs(collection(db, sheetName));
          const deleteBatch = writeBatch(db);
          oldSnap.docs.forEach(d => deleteBatch.delete(d.ref));
          await deleteBatch.commit();

          for (let i = 0; i < data.length; i += 500) {
            const batch = writeBatch(db);
            data.slice(i, i + 500).forEach(row => {
              const { id, ...rest } = row;
              const ref = id ? doc(db, sheetName, id) : doc(collection(db, sheetName));
              batch.set(ref, rest);
            });
            await batch.commit();
          }
        }
        window.location.reload();
      } catch (err) { setRestoreStatus('Gagal!'); setIsRestoring(false); }
    };
    reader.readAsBinaryString(file);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold">Memuat...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto bg-white min-h-screen pb-24">
      {/* HEADER NAV */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
            <Settings size={32} /> Control Panel
          </h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-2xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'general', label: 'Sistem', icon: Settings },
            { id: 'categories', label: 'Kategori', icon: Tag },
            { id: 'employees', label: 'Karyawan', icon: Users },
            { id: 'banners', label: 'Banner', icon: Sparkles },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow-md text-green-600' : 'text-gray-400 hover:text-gray-600'}`}>
              <tab.icon size={14}/> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. SISTEM TAB (IDENTITAS, PEMBAYARAN, PRINTER, BACKUP) */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
          <div className="space-y-6">
            <section className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
              <h2 className="font-black uppercase text-xs mb-4 flex items-center gap-2"><Store size={16}/> Toko</h2>
              <div className="space-y-3">
                <input type="text" value={settings.store.name} onChange={e => setSettings({...settings, store: {...settings.store, name: e.target.value}})} className="w-full p-3 rounded-xl border-none ring-1 ring-gray-200 font-bold text-sm" placeholder="Nama Toko" />
                <textarea value={settings.store.address} onChange={e => setSettings({...settings, store: {...settings.store, address: e.target.value}})} className="w-full p-3 rounded-xl border-none ring-1 ring-gray-200 font-medium text-sm" rows={2} placeholder="Alamat" />
                <input type="text" value={settings.store.phone} onChange={e => setSettings({...settings, store: {...settings.store, phone: e.target.value}})} className="w-full p-3 rounded-xl border-none ring-1 ring-gray-200 font-bold text-sm" placeholder="WhatsApp" />
              </div>
            </section>

            <section className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
              <h2 className="font-black uppercase text-xs mb-4 text-blue-700 flex items-center gap-2"><Shield size={16}/> Data Management</h2>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleBackup} className="bg-white p-4 rounded-2xl shadow-sm border border-blue-200 flex flex-col items-center gap-2 hover:bg-blue-100">
                  <Download className="text-blue-600" />
                  <span className="text-[10px] font-black uppercase">{backupStatus || 'Backup Excel'}</span>
                </button>
                <label className="bg-white p-4 rounded-2xl shadow-sm border border-blue-200 flex flex-col items-center gap-2 cursor-pointer hover:bg-orange-50">
                  <Upload className="text-orange-600" />
                  <span className="text-[10px] font-black uppercase">{isRestoring ? 'Wait...' : 'Restore'}</span>
                  <input type="file" className="hidden" accept=".xlsx" onChange={handleRestore} disabled={isRestoring} />
                </label>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
              <h2 className="font-black uppercase text-xs mb-4 flex items-center gap-2"><Printer size={16}/> Printer</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <select value={settings.printer.paperWidth} onChange={e => setSettings({...settings, printer: {...settings.printer, paperWidth: Number(e.target.value)}})} className="p-3 rounded-xl ring-1 ring-gray-200 border-none font-bold text-sm">
                  <option value={58}>58mm</option>
                  <option value={80}>80mm</option>
                </select>
                <div className="flex items-center gap-2 px-3 bg-white rounded-xl ring-1 ring-gray-200">
                  <input type="checkbox" checked={settings.printer.autoCut} onChange={e => setSettings({...settings, printer: {...settings.printer, autoCut: e.target.checked}})} id="cut" />
                  <label htmlFor="cut" className="text-xs font-bold">Auto Cut</label>
                </div>
              </div>
              <button onClick={handleSaveSystem} disabled={saving} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95">
                {saving ? 'Saving...' : 'Simpan Sistem'}
              </button>
            </section>
          </div>
        </div>
      )}

      {/* 2. CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4">
          <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
            <h2 className="font-black uppercase text-xs mb-6 text-green-700 flex items-center gap-2"><Tag size={16}/> Kelola Kategori</h2>
            <div className="flex gap-2 mb-6">
              <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} className="flex-1 p-4 rounded-2xl border-none ring-1 ring-gray-200 font-bold" placeholder="Nama Kategori Baru" />
              <button onClick={addCategory} className="bg-green-600 text-white px-6 rounded-2xl"><Plus/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map(cat => (
                <div key={cat.id} className="bg-white p-4 rounded-2xl flex justify-between items-center border border-gray-100 shadow-sm">
                  <span className="font-black text-sm uppercase text-gray-700">{cat.name}</span>
                  <button onClick={() => deleteDoc(doc(db, 'categories', cat.id!)).then(loadCategories)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. EMPLOYEES TAB */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
          <div className="bg-gray-50 p-6 rounded-[2rem] h-fit">
            <h2 className="font-black uppercase text-xs mb-6 text-blue-700">Tambah Staf</h2>
            <div className="space-y-3">
              <input type="text" placeholder="Nama Lengkap" value={newEmp.name} onChange={e => setNewEmp({...newEmp, name: e.target.value})} className="w-full p-3 rounded-xl ring-1 ring-gray-200 border-none font-bold text-sm" />
              <input type="email" placeholder="Email Staf" value={newEmp.email} onChange={e => setNewEmp({...newEmp, email: e.target.value})} className="w-full p-3 rounded-xl ring-1 ring-gray-200 border-none font-bold text-sm" />
              <select value={newEmp.role} onChange={e => setNewEmp({...newEmp, role: e.target.value as any})} className="w-full p-3 rounded-xl ring-1 ring-gray-200 border-none font-bold text-sm">
                <option value="kasir">Kasir</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={addEmployee} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Daftarkan Staf</button>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-3">
            {employees.map(emp => (
              <div key={emp.id} className="bg-white p-4 rounded-[1.5rem] border border-gray-100 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users size={20}/></div>
                  <div>
                    <p className="font-black uppercase text-sm">{emp.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{emp.role} • {emp.email}</p>
                  </div>
                </div>
                <button onClick={() => updateDoc(doc(db, 'employees', emp.id!), { isActive: !emp.isActive }).then(loadEmployees)} 
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${emp.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {emp.isActive ? 'Aktif' : 'Non-aktif'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MULTI-BANNER TAB */}
      {activeTab === 'banners' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-orange-50 p-6 rounded-[2.5rem] border border-orange-100 shadow-sm">
              <h2 className="font-black uppercase text-xs mb-4 text-orange-700 flex items-center gap-2"><Plus size={18}/> Tambah Banner Baru ({banners.length}/5)</h2>
              <div className="space-y-3">
                <input type="text" placeholder="Judul Banner" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} className="w-full p-3 rounded-xl border-none ring-1 ring-gray-200 font-bold text-sm" />
                <input type="text" placeholder="Deskripsi Singkat" value={newBanner.subtitle} onChange={e => setNewBanner({...newBanner, subtitle: e.target.value})} className="w-full p-3 rounded-xl border-none ring-1 ring-gray-200 font-medium text-xs" />
                <input type="text" placeholder="URL Foto Produk Banner" value={newBanner.imageUrl || ''} onChange={e => setNewBanner({...newBanner, imageUrl: e.target.value})} className="w-full p-3 rounded-xl border-none ring-1 ring-gray-200 font-medium text-xs text-blue-600" />
                <input type="text" placeholder="Link Tujuan (cth: /kategori/beras)" value={newBanner.linkUrl} onChange={e => setNewBanner({...newBanner, linkUrl: e.target.value})} className="w-full p-3 rounded-xl border-none ring-1 ring-orange-200 font-bold text-xs text-orange-700 bg-white" />
                
                <div className="grid grid-cols-2 gap-2">
                  <select value={newBanner.gradient} onChange={e => setNewBanner({...newBanner, gradient: e.target.value})} className="p-3 rounded-xl border-none ring-1 ring-gray-200 font-bold text-xs bg-white">
                    <option value="from-green-600 to-emerald-800">Hijau</option>
                    <option value="from-blue-600 to-indigo-800">Biru</option>
                    <option value="from-orange-500 to-red-600">Orange</option>
                    <option value="from-zinc-800 to-black">Hitam</option>
                  </select>
                  <button onClick={handleAddBanner} disabled={banners.length >= 5} className="bg-orange-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest disabled:bg-gray-300">Simpan Slot</button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-black uppercase text-xs text-gray-400 mb-2 px-2">Daftar Banner Aktif</h2>
            <div className="space-y-3">
              {banners.map((bn, idx) => (
                <div key={bn.id} className={`relative group overflow-hidden rounded-[2rem] bg-gradient-to-r ${bn.gradient} p-5 text-white shadow-md transition-all hover:scale-[1.01]`}>
                  <div className="flex justify-between items-start relative z-10">
                    <div className="max-w-[75%]">
                      <span className="text-[9px] font-black bg-black/20 px-2 py-0.5 rounded-full uppercase mb-2 inline-block">Slot {idx + 1}</span>
                      <h3 className="font-black text-sm uppercase leading-tight mb-1">{bn.title}</h3>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-white/70 italic">
                        <ExternalLink size={10}/> {bn.linkUrl || 'Tanpa Link'}
                      </div>
                    </div>
                    <button onClick={() => deleteDoc(doc(db, 'banners', bn.id!)).then(loadBanners)} className="bg-white/20 p-2 rounded-full hover:bg-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {bn.imageUrl ? <img src={bn.imageUrl} className="absolute right-[-10px] bottom-[-10px] w-24 h-24 object-contain opacity-40" /> : <Package size={80} className="absolute right-[-10px] bottom-[-10px] opacity-10 rotate-12" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}