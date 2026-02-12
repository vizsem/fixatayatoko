'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Gift, Tag, Percent } from 'lucide-react';

/* ================= TYPES ================= */

type Promotion = {
  name: string;
  type: 'product' | 'category' | 'coupon';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetId?: string;
  code?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

type Product = {
  id: string;
  name: string;
  category?: string;
};

/* ================= INTERNAL COMPONENT ================= */

const getInitialPromotion = (): Promotion => {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    code: '',
    name: '',
    type: 'product',
    discountType: 'percentage',
    discountValue: 0,
    startDate: now.toISOString().split('T')[0],
    endDate: nextWeek.toISOString().split('T')[0],
    isActive: true,
  };
};

function AddPromotionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Promotion>(getInitialPromotion());


  /* ================= LOAD SUPPORT DATA ================= */

  const loadSupportingData = useCallback(async () => {
    const snap = await getDocs(collection(db, 'products'));
    const list: Product[] = snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name,
      category: d.data().category,
    }));

    setProducts(list);

    const uniqueCategories = new Set(
      list.map((p) => p.category).filter(Boolean)
    );
    setCategories(Array.from(uniqueCategories) as string[]);
  }, []);

  /* ================= AUTH & INIT ================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        alert('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      await loadSupportingData();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, loadSupportingData]);


  /* ================= LOAD EDIT DATA ================= */

  useEffect(() => {
    if (!editId) return;

    const loadPromotion = async () => {
      const snap = await getDoc(doc(db, 'promotions', editId));
      if (snap.exists()) {
        const d = snap.data();
        setFormData({
          name: d.name,
          type: d.type,
          discountType: d.discountType,
          discountValue: d.discountValue,
          targetId: d.targetId,
          code: d.code,
          startDate: d.startDate,
          endDate: d.endDate,
          isActive: d.isActive,
        });
      }
    };

    loadPromotion();
  }, [editId]);

  /* ================= HANDLERS ================= */

  const handleTypeChange = (type: Promotion['type']) => {
    setFormData((prev) => ({
      ...prev,
      type,
      targetId: undefined,
      code: type === 'coupon'
        ? `PROMO${Date.now().toString().slice(-6)}`
        : undefined,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.discountValue <= 0) {
      setError('Nilai diskon harus lebih dari 0');
      return;
    }

    if (
      formData.discountType === 'percentage' &&
      formData.discountValue > 100
    ) {
      setError('Diskon persentase tidak boleh lebih dari 100%');
      return;
    }

    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setError('Tanggal berakhir harus setelah tanggal mulai');
      return;
    }

    try {
      if (editId) {
        await updateDoc(doc(db, 'promotions', editId), {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        alert('Promosi berhasil diperbarui!');
      } else {
        await addDoc(collection(db, 'promotions'), {
          ...formData,
          code: formData.code || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        alert('Promosi berhasil ditambahkan!');
      }

      router.push('/admin/promotions');
    } catch (err) {
      console.error(err);
      setError('Gagal menyimpan promosi');
    }
  };

  /* ================= UI ================= */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-b-2 border-green-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-black">
        {editId ? 'Edit' : 'Tambah'} Program Promosi
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow border"
      >
        {/* Nama */}
        <input
          required

          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          placeholder="Nama Promosi"
          className="w-full mb-4 px-3 py-2 border rounded text-black"
        />

        {/* Type */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { id: 'product', label: 'Produk', icon: <Tag size={18} /> },
            { id: 'category', label: 'Kategori', icon: <Percent size={18} /> },
            { id: 'coupon', label: 'Kupon', icon: <Gift size={18} /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTypeChange(t.id as Promotion['type'])}
              className={`p-3 border rounded ${formData.type === t.id
                  ? 'border-green-600 bg-green-50'
                  : ''
                }`}
            >

              <div className="flex gap-2 items-center text-black">
                {t.icon}
                {t.label}
              </div>
            </button>
          ))}
        </div>

        {/* Target */}
        {(formData.type === 'product' || formData.type === 'category') && (
          <select
            required
            value={formData.targetId || ''}
            onChange={(e) =>
              setFormData({ ...formData, targetId: e.target.value })
            }
            className="w-full mb-4 px-3 py-2 border rounded text-black"
          >
            <option value="">Pilih...</option>
            {formData.type === 'product'
              ? products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
              : categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
          </select>
        )}

        {/* Coupon */}
        {formData.type === 'coupon' && (
          <input
            required
            value={formData.code || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                code: e.target.value.toUpperCase(),
              })
            }
            placeholder="KODEPROMO"
            className="w-full mb-4 px-3 py-2 border rounded font-mono text-black"
          />
        )}

        {/* Discount */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <select
            value={formData.discountType}
            onChange={(e) =>
              setFormData({
                ...formData,
                discountType: e.target.value as Promotion['discountType'],
              })
            }

            className="px-3 py-2 border rounded text-black"
          >
            <option value="percentage">Persentase (%)</option>
            <option value="fixed">Nilai Tetap (Rp)</option>
          </select>

          <input
            type="number"
            min={0}
            value={formData.discountValue}
            onChange={(e) =>
              setFormData({
                ...formData,
                discountValue: Number(e.target.value),
              })
            }
            className="px-3 py-2 border rounded text-black"
          />
        </div>

        {/* Date */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            className="px-3 py-2 border rounded text-black"
          />
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
            className="px-3 py-2 border rounded text-black"
          />
        </div>

        {/* Active */}
        <label className="flex gap-2 mb-4 text-black">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) =>
              setFormData({ ...formData, isActive: e.target.checked })
            }
          />
          Aktifkan promosi
        </label>

        {/* Action */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/promotions')}
            className="px-4 py-2 border rounded text-black"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            {editId ? 'Perbarui' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================= MAIN EXPORT ================= */

export default function AddPromotionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AddPromotionContent />
    </Suspense>
  );
}