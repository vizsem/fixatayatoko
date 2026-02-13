'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  User,
  ArrowLeft,
  Save,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  CheckCircle2
} from 'lucide-react';

export default function EditCustomer() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    type: 'ecer' as 'grosir' | 'ecer',
    creditLimit: 0,
    notes: ''
  });

  // 1. Proteksi Admin & Fetch Data Awal
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        router.push('/profil');
        return;
      }

      // Ambil data pelanggan yang akan diedit
      if (id) {
        try {
          const customerDoc = await getDoc(doc(db, 'customers', id as string));
          if (customerDoc.exists()) {
            const data = customerDoc.data();
            setFormData({
              name: data.name || '',
              phone: data.phone || '',
              email: data.email || '',
              address: data.address || '',
              type: data.type || 'ecer',
              creditLimit: data.creditLimit || 0,
              notes: data.notes || ''
            });
          } else {
            alert("Data tidak ditemukan");
            router.push('/admin/customers');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'customers', id as string), {
        ...formData,
        updatedAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/customers');
      }, 1500);
    } catch {
      alert("Gagal memperbarui data");
      setSaving(false);
    }

  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-green-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans p-4 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="p-3 bg-black text-white rounded-2xl inline-flex">
                <User size={22} />
              </div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Edit Client</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Update informasi pelanggan</p>
            </div>
          </div>
        </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-2 text-green-600">
              <User size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Identitas Dasar</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1">Nama Lengkap</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-1 outline-none focus:ring-2 focus:ring-green-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1 text-green-500 flex items-center gap-1">
                    <Phone size={10} /> WhatsApp
                  </label>
                  <input
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-1 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1 flex items-center gap-1">
                    <Mail size={10} /> Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-1 outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 tracking-widest ml-1 flex items-center gap-1">
                  <MapPin size={10} /> Alamat Pengiriman
                </label>
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold mt-1 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <FileText size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Catatan Tambahan</span>
            </div>
            <textarea
              placeholder="Tambahkan info spesifik pelanggan di sini..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="space-y-6">
          <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-xl">
            <div className="flex items-center gap-2 mb-8 text-green-400">
              <CreditCard size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Financial Settings</span>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Tipe Member</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'ecer' | 'grosir' })}
                  className="w-full bg-white/10 border-none rounded-xl px-4 py-3 text-xs font-bold mt-2 outline-none focus:bg-white/20"

                >
                  <option value="ecer" className="text-black">ECERAN</option>
                  <option value="grosir" className="text-black">GROSIR</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Limit Kredit (IDR)</label>
                <input
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                  className="w-full bg-white/10 border-none rounded-xl px-4 py-3 text-xs font-bold mt-2 outline-none focus:bg-white/20"
                />
                <p className="text-[8px] text-gray-500 mt-2 italic font-bold uppercase tracking-tighter">* Set 0 jika pembayaran harus cash</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`w-full py-5 rounded-[2rem] flex items-center justify-center gap-3 transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-lg ${success
              ? 'bg-green-500 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-green-100'
              }`}
          >
            {success ? (
              <><CheckCircle2 size={18} /> Updated!</>
            ) : saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
            ) : (
              <><Save size={18} /> Update Database</>
            )}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
