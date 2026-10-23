'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  ArrowLeft,
  Save,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  CheckCircle2,
  Users
} from 'lucide-react';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import { getCustomerForEdit, saveCustomer } from '@/lib/actions/customer.actions';

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
    type: 'Retail',
    creditLimit: 0,
    notes: ''
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await getCustomerForEdit(String(id));
        if (cancelled) return;

        if (!data) {
          notify.admin.error('Data pelanggan tidak ditemukan');
          router.push('/admin/customers');
          return;
        }

        setFormData({
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          type: data.type || 'Retail',
          creditLimit: data.creditLimit,
          notes: data.notes,
        });
      } catch {
        if (!cancelled) notify.admin.error('Gagal memuat data pelanggan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      notify.error('Nama pelanggan wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const result = await saveCustomer(String(id), formData);

      if (!result.success) {
        notify.admin.error(result.error || 'Gagal memperbarui data');
        setSaving(false);
        return;
      }

      setSuccess(true);
      notify.success('Data pelanggan berhasil diperbarui');
      setTimeout(() => {
        router.push('/admin/customers');
      }, 1000);
    } catch {
      notify.admin.error('Gagal memperbarui data');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center gap-3">
        <Link
          href="/admin/customers"
          className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shadow-2xs"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Edit Profil Pelanggan
          </h1>
          <p className="text-xs text-gray-500">
            Perbarui data kontak, tipe keanggotaan, dan batas kredit tempo pelanggan
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identitas & Kontak */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white p-5 sm:p-7 rounded-2xl md:rounded-3xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 pb-2 border-b border-gray-100">
              <User size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Identitas Dasar</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nama Lengkap Pelanggan <span className="text-rose-500">*</span>
              </label>
              <input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <Phone size={11} className="text-emerald-600" /> No. Telepon / WhatsApp
                </label>
                <input
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <Mail size={11} className="text-gray-400" /> Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <MapPin size={11} className="text-gray-400" /> Alamat Pengiriman
              </label>
              <textarea
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="bg-white p-5 sm:p-7 rounded-2xl md:rounded-3xl border border-gray-100 shadow-xs">
            <div className="flex items-center gap-2 text-emerald-700 pb-2 border-b border-gray-100 mb-3">
              <FileText size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Catatan Tambahan</span>
            </div>
            <textarea
              placeholder="Catatan preferensi pembeli, jadwal pengiriman, dll..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
            />
          </div>
        </div>

        {/* Right Column: Keanggotaan & Limit Kredit */}
        <div className="space-y-5">
          <div className="bg-white p-5 sm:p-7 rounded-2xl md:rounded-3xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 pb-2 border-b border-gray-100">
              <CreditCard size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">Keanggotaan & Tempo</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Tipe Member</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Retail">Retail (Eceran)</option>
                <option value="Grosir">Grosir (Kulakan Toko)</option>
                <option value="Semi-Grosir">Semi-Grosir</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Limit Kredit / Bon (IDR)
              </label>
              <input
                type="number"
                min="0"
                value={formData.creditLimit}
                onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-gray-400 mt-1 italic">
                * Isi 0 jika pelanggan wajib membayar lunas (tanpa tempo)
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider shadow-xs transition-all ${
              success
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {success ? (
              <>
                <CheckCircle2 size={16} /> Tersimpan!
              </>
            ) : saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Save size={16} /> Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
