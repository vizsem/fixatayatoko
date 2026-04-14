'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { 
  ArrowLeft, 
  Save, 
  Upload, 
  Loader2 
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';

export default function AddOperationalExpensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('Lainnya');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const categories = ['Listrik', 'Air', 'Gaji', 'Packing', 'Bensin', 'Pajak', 'Lainnya'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !date || !description) {
      notify.error('Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    setLoading(true);
    try {
      let proofUrl = '';

      // Upload file if exists
      if (file) {
        const storageRef = ref(storage, `operational_expenses_proofs/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        proofUrl = await getDownloadURL(snapshot.ref);
      }

      // Add document to Firestore
      await addDoc(collection(db, 'operational_expenses'), {
        category,
        amount: Number(amount),
        date: Timestamp.fromDate(new Date(date)),
        description,
        proofOfPayment: proofUrl || null,
        recordedBy: auth.currentUser?.uid || 'unknown',
        createdAt: Timestamp.now()
      });

      notify.success('Pengeluaran berhasil dicatat');
      router.push('/admin/operational-expenses');
    } catch (error) {
      console.error('Error adding expense:', error);
      notify.error('Gagal menyimpan data pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-4 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link 
            href="/admin/operational-expenses" 
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tambah Pengeluaran</h1>
            <p className="text-gray-500">Catat pengeluaran operasional baru</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori Pengeluaran <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah (Rp) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-12 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi / Keterangan <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
                placeholder="Contoh: Pembayaran listrik bulan Maret 2024"
                required
              />
            </div>

            {/* Proof of Payment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bukti Pembayaran (Opsional)
              </label>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*,.pdf"
                />
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload size={32} />
                  {file ? (
                    <span className="text-emerald-600 font-medium">{file.name}</span>
                  ) : (
                    <span>Klik untuk upload gambar atau PDF</span>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Simpan Pengeluaran
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
