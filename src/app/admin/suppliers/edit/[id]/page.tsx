'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import { ArrowLeft, Save, Building2, Phone, Mail, MapPin, CreditCard, Tag } from 'lucide-react';
import { getSupplierById, updateSupplier } from '@/lib/actions/supplier.actions';

const CATEGORY_OPTIONS = [
  'Sembako & Pangan',
  'Makanan & Minuman',
  'Bahan Baku',
  'Kemasan & Plastik',
  'Perlengkapan Toko',
  'Lainnya'
];

const PAYMENT_TERMS_OPTIONS = [
  'COD (Tunai saat datang)',
  'Tempo 7 Hari',
  'Tempo 14 Hari',
  'Tempo 30 Hari',
  'Konsinyasi (Titip Jual)',
  'Transfer Dimuka (Pre-Order)'
];

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: 'Sembako & Pangan',
    bankName: 'BCA',
    bankAccount: '',
    bankAccountName: '',
    paymentTerms: 'COD (Tunai saat datang)',
    notes: ''
  });

  const fetchSupplier = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSupplierById(id);
      if (!data) {
        notify.error('Supplier tidak ditemukan');
        router.push('/admin/suppliers');
        return;
      }
      setForm({
        name: data.name || '',
        contactPerson: data.contactPerson || '',
        phone: data.phone || '',
        email: data.email || '',
        address: data.address || '',
        category: data.category || 'Sembako & Pangan',
        bankName: data.bankName || 'BCA',
        bankAccount: data.bankAccount || '',
        bankAccountName: data.bankAccountName || '',
        paymentTerms: data.paymentTerms || 'COD (Tunai saat datang)',
        notes: data.notes || ''
      });
    } catch (err) {
      console.error(err);
      notify.error('Gagal memuat data supplier');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSupplier();
  }, [fetchSupplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify.error('Nama supplier wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateSupplier(id, {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        category: form.category || undefined,
        bankName: form.bankName.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined,
        bankAccountName: form.bankAccountName.trim() || undefined,
        paymentTerms: form.paymentTerms || undefined,
        notes: form.notes.trim() || undefined
      });

      if (res.success) {
        notify.success('Data supplier berhasil diperbarui');
        router.push('/admin/suppliers');
      } else {
        notify.error(res.error || 'Gagal menyimpan');
      }
    } catch {
      notify.error('Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Toaster position="top-right" />
      <div className="flex items-center gap-3">
        <Link
          href="/admin/suppliers"
          className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors shadow-2xs"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Edit Profil Supplier
          </h1>
          <p className="text-xs text-gray-500">Perbarui kontak, termin, dan rekening pembayaran mitra</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-5 sm:p-7 rounded-2xl md:rounded-3xl border border-gray-100 shadow-xs space-y-5"
      >
        {/* Identitas Perusahaan */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 pb-2 border-b border-gray-100">
            <Building2 size={13} /> 1. Identitas Perusahaan
          </h3>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nama Supplier <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nama PIC / Kontak</label>
              <input
                type="text"
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Kategori Pasokan</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Kontak & Lokasi */}
        <div className="space-y-3 pt-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 pb-2 border-b border-gray-100">
            <Phone size={13} /> 2. Kontak & Alamat
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">No. Telepon / WhatsApp</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Alamat Kantor / Gudang</label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Rekening & Termin */}
        <div className="space-y-3 pt-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 pb-2 border-b border-gray-100">
            <CreditCard size={13} /> 3. Rekening & Termin Pembayaran
          </h3>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Termin Pembayaran</label>
            <select
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Bank</label>
              <input
                type="text"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Nomor Rekening</label>
              <input
                type="text"
                value={form.bankAccount}
                onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Atas Nama Rekening</label>
            <input
              type="text"
              value={form.bankAccountName}
              onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Catatan Tambahan</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/admin/suppliers"
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save size={15} />
            <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
