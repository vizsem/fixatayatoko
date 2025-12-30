// src/app/(admin)/products/edit/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { 
  Package, 
  Image as ImageIcon,
  AlertTriangle,
  Barcode,
  Warehouse
} from 'lucide-react';

type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  stock: number;
  stockByWarehouse?: Record<string, number>;
  category: string;
  unit: string;
  barcode: string;
  image: string;
  expiredDate?: string;
};

type Warehouse = {
  id: string;
  name: string;
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Partial<Product>>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Proteksi admin
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

      await fetchProductData();
      await fetchWarehouses();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, router]);

  const fetchProductData = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (!docSnap.exists()) {
        setError('Produk tidak ditemukan.');
        return;
      }

      const data = docSnap.data();
      setProduct({
        id: docSnap.id,
        name: data.name || '',
        price: data.price || 0,
        wholesalePrice: data.wholesalePrice || 0,
        stock: data.stock || 0,
        stockByWarehouse: data.stockByWarehouse || {},
        category: data.category || '',
        unit: data.unit || '',
        barcode: data.barcode || '',
        image: data.image || 'https://placehold.co/400x400/64748b/ffffff?text=No+Image',
        expiredDate: data.expiredDate
      });
      setImagePreview(data.image);
    } catch (err) {
      console.error('Gagal memuat produk:', err);
      setError('Gagal memuat detail produk.');
    }
  };

  const fetchWarehouses = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'warehouses'));
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      }));
      setWarehouses(list);
    } catch (err) {
      console.error('Gagal memuat gudang:', err);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Hanya file gambar yang diizinkan!');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return product.image;

    try {
      // Hapus gambar lama jika ada
      if (product.image && !product.image.includes('placehold.co')) {
        const oldRef = ref(storage, product.image);
        await deleteObject(oldRef).catch(() => {}); // Ignore error if file not found
      }

      // Upload gambar baru
      const imageRef = ref(storage, `products/${id}/${Date.now()}`);
      await uploadBytes(imageRef, imageFile);
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (err) {
      console.error('Gagal upload gambar:', err);
      alert('Gagal mengupload gambar. Gunakan gambar default.');
      return 'https://placehold.co/400x400/64748b/ffffff?text=No+Image';
    }
  };

  const calculateTotalStock = (stockByWarehouse: Record<string, number>) => {
    return Object.values(stockByWarehouse).reduce((sum, stock) => sum + stock, 0);
  };

  const handleStockChange = (warehouseId: string, value: number) => {
    const newStockByWarehouse = {
      ...(product.stockByWarehouse || {}),
      [warehouseId]: Math.max(0, value)
    };
    const totalStock = calculateTotalStock(newStockByWarehouse);
    
    setProduct(prev => ({
      ...prev,
      stockByWarehouse: newStockByWarehouse,
      stock: totalStock
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.name || !product.category || !product.unit) {
      alert('Nama, kategori, dan satuan wajib diisi!');
      return;
    }

    if (product.price <= 0 || product.wholesalePrice <= 0) {
      alert('Harga harus lebih dari 0!');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload gambar jika ada perubahan
      const imageUrl = await uploadImage();

      // Update produk
      await updateDoc(doc(db, 'products', id), {
        name: product.name,
        price: product.price,
        wholesalePrice: product.wholesalePrice,
        stock: product.stock,
        stockByWarehouse: product.stockByWarehouse,
        category: product.category,
        unit: product.unit,
        barcode: product.barcode,
        image: imageUrl,
        expiredDate: product.expiredDate || null,
        updatedAt: new Date().toISOString()
      });

      alert('Produk berhasil diperbarui!');
      router.push('/admin/products');
    } catch (err) {
      console.error('Gagal memperbarui produk:', err);
      setError('Gagal memperbarui produk. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat detail produk...</p>
        </div>
      </div>
    );
  }

  if (error || !product.id) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h2 className="text-xl font-bold text-black mb-2">Produk Tidak Ditemukan</h2>
          <p className="text-black mb-6">{error || 'ID produk tidak valid.'}</p>
          <button 
            onClick={() => router.push('/admin/products')}
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar Produk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Edit Produk</h1>
        <p className="text-black">Perbarui informasi produk {product.name}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow border border-gray-200">
        {/* Gambar Produk */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-black mb-2">
            Gambar Produk
          </label>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="text-gray-400" size={24} />
              )}
            </div>
            <label className="flex flex-col items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer">
              <span className="text-sm text-black">Pilih Gambar</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nama Produk */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Nama Produk *
            </label>
            <input
              type="text"
              required
              value={product.name || ''}
              onChange={(e) => setProduct({...product, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            />
          </div>
          
          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Kategori *
            </label>
            <input
              type="text"
              required
              value={product.category || ''}
              onChange={(e) => setProduct({...product, category: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              placeholder="Beras, Minyak, dll"
            />
          </div>
          
          {/* Satuan */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Satuan *
            </label>
            <input
              type="text"
              required
              value={product.unit || ''}
              onChange={(e) => setProduct({...product, unit: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              placeholder="kg, pcs, dus, liter"
            />
          </div>
          
          {/* Barcode */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Barcode
            </label>
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={product.barcode || ''}
                onChange={(e) => setProduct({...product, barcode: e.target.value})}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              />
            </div>
          </div>
          
          {/* Harga Ecer */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Harga Ecer (Rp) *
            </label>
            <input
              type="number"
              required
              min="0"
              value={product.price || 0}
              onChange={(e) => setProduct({...product, price: Number(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            />
          </div>
          
          {/* Harga Grosir */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Harga Grosir (Rp) *
            </label>
            <input
              type="number"
              required
              min="0"
              value={product.wholesalePrice || 0}
              onChange={(e) => setProduct({...product, wholesalePrice: Number(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            />
          </div>
          
          {/* Tanggal Kadaluarsa */}
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Tanggal Kadaluarsa
            </label>
            <input
              type="date"
              value={product.expiredDate || ''}
              onChange={(e) => setProduct({...product, expiredDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            />
          </div>
        </div>

        {/* Stok Per Gudang */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
            <Warehouse size={20} />
            Stok per Gudang
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warehouses.map(warehouse => (
              <div key={warehouse.id} className="border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-black mb-1">
                  {warehouse.name}
                </label>
                <input
                  type="number"
                  min="0"
                  value={product.stockByWarehouse?.[warehouse.id] || 0}
                  onChange={(e) => handleStockChange(warehouse.id, Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-black"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-black">
              <span className="font-medium">Total Stok:</span> {product.stock || 0} {product.unit}
            </p>
          </div>
        </div>

        {/* Aksi */}
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Menyimpan...
              </>
            ) : (
              'Simpan Perubahan'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}