'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  onSnapshot,
  updateDoc,
  arrayRemove,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2, Mail, MapPin, Phone, Save, Trash2, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

type Address = {
  id: string;
  label: string;
  receiverName: string;
  receiverPhone: string;
  address: string;
};

export default function EditProfilePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '', // ✅ No WhatsApp
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newReceiverName, setNewReceiverName] = useState('');
  const [newReceiverPhone, setNewReceiverPhone] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser || currentUser.isAnonymous) {
        router.push('/profil/login');
        return;
      }

      const unsubUser = onSnapshot(
        doc(db, 'users', currentUser.uid),
        (snap) => {
          const data = snap.data() as any;
          setFormData({
            name: data?.name || '',
            email: data?.email || '',
            phone: data?.whatsapp || data?.phone || '',
          });
          setAddresses(Array.isArray(data?.addresses) ? data.addresses : []);
          if (!Array.isArray(data?.addresses) || data.addresses.length === 0) {
            const legacy = String(data?.address || '');
            if (legacy && !newAddress) setNewAddress(legacy);
            const nm = String(data?.name || '');
            const ph = String(data?.whatsapp || data?.phone || '');
            if (nm && !newReceiverName) setNewReceiverName(nm);
            if (ph && !newReceiverPhone) setNewReceiverPhone(ph);
          }
          setLoading(false);
        },
        () => {
          toast.error('Gagal memuat data profil');
          setLoading(false);
        },
      );

      return () => unsubUser();
    });

    return () => unsubscribe();
  }, [router, newAddress, newReceiverName, newReceiverPhone]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addAddress = async () => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    if (!newAddress.trim() || !newReceiverName.trim()) {
      toast.error('Lengkapi nama penerima dan alamat!');
      return;
    }

    setSavingAddress(true);
    const addressObj: Address = {
      id: Date.now().toString(),
      label: (newLabel || 'Rumah').trim(),
      receiverName: newReceiverName.trim(),
      receiverPhone: newReceiverPhone.trim(),
      address: newAddress.trim(),
    };

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        addresses: arrayUnion(addressObj),
        address: addressObj.address,
        updatedAt: new Date().toISOString(),
      });
      setNewAddress('');
      setNewLabel('');
      setNewReceiverName('');
      setNewReceiverPhone('');
    } catch {
      toast.error('Gagal menambah alamat');
    } finally {
      setSavingAddress(false);
    }
  };

  const deleteAddress = async (addrId: string) => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    if (!window.confirm('Hapus alamat ini?')) return;
    const addrToDelete = addresses.find((a) => a.id === addrId);
    if (!addrToDelete) return;

    try {
      const patch: Record<string, unknown> = { addresses: arrayRemove(addrToDelete), updatedAt: new Date().toISOString() };
      if (addresses.length === 1) patch.address = '';
      await updateDoc(doc(db, 'users', user.uid), patch);
    } catch {
      toast.error('Gagal menghapus alamat');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      if (user.isAnonymous) {
        router.push('/profil/login');
        return;
      }
      
      await updateDoc(doc(db, 'users', user.uid), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        whatsapp: formData.phone.trim(),
        updatedAt: new Date().toISOString()
      });
      
      toast.success('Profil berhasil diperbarui!');
      router.push('/profil');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Gagal memperbarui profil');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center text-green-600 hover:text-green-700"
          >
            ← Kembali ke Beranda
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-black text-slate-900 mb-6 uppercase tracking-tight">Edit Profil</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Nama Lengkap
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-50 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-emerald-400"
                  placeholder="Contoh: Agus Santoso"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-50 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-emerald-400"
                  placeholder="contoh@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Nomor WhatsApp
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-50 rounded-2xl text-xs font-black outline-none focus:bg-white focus:border-emerald-400"
                  placeholder="081234567890"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.push('/profil')}
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-2xl hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl hover:bg-emerald-700 disabled:bg-gray-400 text-[10px] font-black uppercase tracking-widest"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <h3 className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-6 flex items-center gap-2">
            <MapPin size={14} className="text-emerald-500" /> Alamat Tersimpan
          </h3>
          <div className="space-y-4 mb-8">
            {addresses.length > 0 ? (
              addresses.map((addr) => (
                <div key={addr.id} className="p-5 bg-slate-50 rounded-3xl relative border border-slate-50 group">
                  <p className="text-[10px] font-bold text-green-600 uppercase mb-1">{addr.label}</p>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{addr.receiverName}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase leading-relaxed">{addr.address}</p>
                  <button onClick={() => deleteAddress(addr.id)} className="absolute top-5 right-5 text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-center text-slate-400 py-4 font-medium">Belum ada alamat.</p>
            )}
          </div>

          <div className="bg-emerald-50/50 p-6 rounded-3xl border-2 border-dashed border-emerald-200 space-y-3">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="LABEL (MISAL: RUMAH)..."
              className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none border border-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              value={newReceiverName}
              onChange={(e) => setNewReceiverName(e.target.value)}
              placeholder="NAMA PENERIMA..."
              className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none border border-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <input
              value={newReceiverPhone}
              onChange={(e) => setNewReceiverPhone(e.target.value)}
              placeholder="NO. WHATSAPP..."
              className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none border border-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <textarea
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="ALAMAT LENGKAP..."
              className="w-full bg-white rounded-xl px-4 py-3 text-[10px] font-bold uppercase outline-none border border-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 h-20 resize-none"
            />
            <button
              type="button"
              onClick={addAddress}
              disabled={savingAddress}
              className="w-full bg-emerald-500 text-white py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-emerald-600 disabled:opacity-60"
            >
              {savingAddress ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Simpan Alamat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
