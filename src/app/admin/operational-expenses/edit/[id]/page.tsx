'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { 
  doc,
  getDoc,
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { 
  ArrowLeft, 
  Save, 
  Upload, 
  Loader2 
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';

export default function EditOperationalExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [category, setCategory] = useState('Lainnya');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [currentProofUrl, setCurrentProofUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const categories = ['Listrik', 'Air', 'Gaji', 'Packing', 'Bensin', 'Pajak', 'Lainnya'];

  useEffect(() => {
    const fetchExpense = async () => {
      try {
        const docRef = doc(db, 'operational_expenses', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCategory(data.category);
          setAmount(String(data.amount));
          setDescription(data.description);
          setCurrentProofUrl(data.proofOfPayment || null);
          
          // Handle date
          if (data.date instanceof Timestamp) {
            setDate(data.date.toDate().toISOString().split('T')[0]);
          } else if (data.date) {
            setDate(new Date(data.date).toISOString().split('T')[0]);
          }
        } else {
          notify.error('Data pengeluaran tidak ditemukan');
          router.push('/admin/operational-expenses');
        }
      } catch (error) {
        console.error('Error fetching expense:', error);
        notify.error('Gagal mengambil data pengeluaran');
      } finally {
        setLoading(false);
      }
    };

    fetchExpense();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !date || !description) {
      notify.error('Mohon lengkapi semua field yang wajib diisi');
      return;
    }

    setSaving(true);
    try {
      let proofUrl = currentProofUrl;

      // Upload new file if selected
      if (file) {
        const storageRef = ref(storage, `operational_expenses_proofs/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        proofUrl = await getDownloadURL(snapshot.ref);
      }

      // Update document
      const docRef = doc(db, 'operational_expenses', id);
      await updateDoc(docRef, {
        category,
        amount: Number(amount),
        date: Timestamp.fromDate(new Date(date)),
        description,
        proofOfPayment: proofUrl,
        updatedAt: Timestamp.now()
      });

      notify.success('Pengeluaran berhasil diperbarui');
      router.push('/admin/operational-expenses');
    } catch (error) {
      console.error('Error updating expense:', error);
      notify.error('Gagal memperbarui data pengeluaran');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-800">Edit Pengeluaran</h1>
            <p className="text-gray-500">Perbarui data pengeluaran operasional</p>
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
              
              {currentProofUrl && !file && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">File saat ini tersimpan</span>
                  <a 
                    href={currentProofUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 text-sm font-medium hover:underline"
                  >
                    Lihat Bukti
                  </a>
                </div>
              )}

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
                    <span>Klik untuk ganti file bukti (Gambar/PDF)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Simpan Perubahan
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
