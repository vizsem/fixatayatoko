'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  ArrowLeft, Save, Warehouse, MapPin, 
  Phone, User, Package, Loader2 
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

type WarehouseData = {
  id: string;
  name: string;
  address: string;
  contactPerson: string;
  phone: string;
  capacity?: number;
  status: 'AKTIF' | 'NONAKTIF';
};

export default function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [formData, setFormData] = useState<WarehouseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // 1. Proteksi Admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        router.push('/admin');
        return;
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Ambil Data Gudang Existing
  useEffect(() => {
    if (!authChecked || !id) return;

    const fetchWarehouse = async () => {
      try {
        const docRef = doc(db, 'warehouses', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setFormData({ id: docSnap.id, ...docSnap.data() } as WarehouseData);
        } else {
          toast.error('Gudang tidak ditemukan');
          router.push('/admin/warehouses');
        }
      } catch (error) {
        console.error(error);
        toast.error('Gagal mengambil data');
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouse();
  }, [id, authChecked, router]);

  // 3. Handle Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || isSaving) return;

    setIsSaving(true);
    try {
      const docRef = doc(db, 'warehouses', id);
      await updateDoc(docRef, {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      toast.success('Data gudang berhasil diperbarui');
      setTimeout(() => router.push('/admin/warehouses'), 1500);
    } catch (error) {
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <Toaster position="top-right" />
      
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => router.back()}
            className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black uppercase tracking-tighter italic">Edit Warehouse</h1>
          <div className="w-10"></div>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-white overflow-hidden p-8 md:p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white">
              <Warehouse size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Gudang</p>
              <h2 className="text-lg font-black uppercase tracking-tight italic">ID: {id.substring(0, 8)}</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nama Gudang */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nama Gudang</label>
              <div className="relative">
                <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                  required
                  type="text"
                  value={formData?.name || ''}
                  onChange={(e) => setFormData(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-black outline-none transition-all"
                  placeholder="Contoh: Gudang Pusat Jakarta"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Person */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Penanggung Jawab</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    required
                    type="text"
                    value={formData?.contactPerson || ''}
                    onChange={(e) => setFormData(prev => prev ? {...prev, contactPerson: e.target.value} : null)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-black outline-none transition-all"
                    placeholder="Nama Staff"
                  />
                </div>
              </div>

              {/* No Telepon */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">WhatsApp / Telp</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    required
                    type="tel"
                    value={formData?.phone || ''}
                    onChange={(e) => setFormData(prev => prev ? {...prev, phone: e.target.value} : null)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-black outline-none transition-all"
                    placeholder="0812..."
                  />
                </div>
              </div>
            </div>

            {/* Alamat Lengkap */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Alamat Lengkap</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-6 text-slate-300" size={18} />
                <textarea
                  required
                  rows={3}
                  value={formData?.address || ''}
                  onChange={(e) => setFormData(prev => prev ? {...prev, address: e.target.value} : null)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-black outline-none transition-all resize-none"
                  placeholder="Alamat lengkap lokasi gudang..."
                />
              </div>
            </div>

            {/* Status Gudang */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Status Operasional</label>
              <select
                value={formData?.status || 'AKTIF'}
                onChange={(e) => setFormData(prev => prev ? {...prev, status: e.target.value as any} : null)}
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-black outline-none transition-all appearance-none cursor-pointer text-sm"
              >
                <option value="AKTIF">AKTIF</option>
                <option value="NONAKTIF">NONAKTIF / MAINTENANCE</option>
              </select>
            </div>

            {/* Tombol Simpan */}
            <button
              disabled={isSaving}
              type="submit"
              className="w-full bg-black text-white py-5 rounded-3xl font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 disabled:bg-slate-300"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
              Simpan Perubahan
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}