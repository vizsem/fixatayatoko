'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Package, Image as ImageIcon, AlertTriangle, Barcode, Warehouse, Save, X } from 'lucide-react';
import imageCompression from 'browser-image-compression'; // Import library kompresi

type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  stock: number;
  stockByWarehouse: Record<string, number>;
  category: string;
  unit: string;
  barcode: string;
  image: string;
  expiredDate: string;
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | any>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      // Pengecekan role admin
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        router.push('/profil');
        return;
      }
      await Promise.all([fetchProductData(), fetchWarehouses()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const fetchProductData = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (!docSnap.exists()) {
        setError('Produk tidak ditemukan.');
        return;
      }
      const data = docSnap.data();
      // Pastikan semua field terisi meskipun data di Firestore kosong
      setProduct({
        ...data,
        id: docSnap.id,
        stockByWarehouse: data.stockByWarehouse || {},
        expiredDate: data.expiredDate || '',
        barcode: data.barcode || '',
      });
      setImagePreview(data.image);
    } catch (err) {
      setError('Gagal mengambil data produk.');
    }
  };

  const fetchWarehouses = async () => {
    const snapshot = await getDocs(collection(db, 'warehouses'));
    setWarehouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validasi tipe file
      if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar!');
        return;
      }

      // Opsi Kompresi (Seperti Shopee/Tokopedia)
      const options = {
        maxSizeMB: 0.2, // Maksimal 200KB
        maxWidthOrHeight: 800, // Dimensi maksimal 800px (HD tetap tajam tapi kecil)
        useWebWorker: true,
      };

      try {
        setLoading(true);
        const compressedFile = await imageCompression(file, options);
        setImageFile(compressedFile);
        setImagePreview(URL.createObjectURL(compressedFile));
      } catch (error) {
        console.error("Gagal kompresi:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return product.image;

    try {
      // Hapus gambar lama jika bukan placeholder
      if (product.image && product.image.includes('firebasestorage')) {
        const oldRef = ref(storage, product.image);
        await deleteObject(oldRef).catch(e => console.log("Old image not found, skipping delete"));
      }

      // Upload gambar baru yang sudah dikompres
      const fileName = `products/${id}/${Date.now()}.jpg`;
      const imageRef = ref(storage, fileName);
      await uploadBytes(imageRef, imageFile);
      return await getDownloadURL(imageRef);
    } catch (err) {
      console.error('Gagal upload:', err);
      throw new Error('Gagal mengunggah foto.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const imageUrl = await uploadImage();
      
      // Hitung total stok dari semua gudang secara real-time sebelum simpan
      const totalStock = Object.values(product.stockByWarehouse || {}).reduce((a: any, b: any) => a + (Number(b) || 0), 0);

      await updateDoc(doc(db, 'products', id), {
        ...product,
        image: imageUrl,
        stock: totalStock,
        updatedAt: new Date().toISOString()
      });

      alert('Berhasil diperbarui!');
      router.push('/admin/products');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-20 text-center font-bold">Memproses Data...</div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto bg-white min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
        <h1 className="text-2xl font-black uppercase tracking-tighter">Edit Produk</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kolom Kiri: Foto */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <label className="block text-sm font-bold mb-2 uppercase tracking-widest">Foto Produk</label>
            <div className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden flex items-center justify-center relative group">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={40} className="text-gray-300" />
              )}
              <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              <div className="absolute bottom-4 bg-black/50 text-white text-[10px] px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Ganti Foto</div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center uppercase font-bold tracking-widest">Auto-Compress: Maks 200KB</p>
          </div>
        </div>

        {/* Kolom Kanan: Detail */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase text-gray-400">Nama Produk</label>
              <input type="text" value={product.name} onChange={e => setProduct({...product, name: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Barcode</label>
              <input type="text" value={product.barcode} onChange={e => setProduct({...product, barcode: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Kategori</label>
              <input type="text" value={product.category} onChange={e => setProduct({...product, category: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Harga Ecer (Rp)</label>
              <input type="number" value={product.price} onChange={e => setProduct({...product, price: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-green-600" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Harga Grosir (Rp)</label>
              <input type="number" value={product.wholesalePrice} onChange={e => setProduct({...product, wholesalePrice: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-blue-600" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Satuan</label>
              <input type="text" value={product.unit} onChange={e => setProduct({...product, unit: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400">Kadaluarsa</label>
              <input type="date" value={product.expiredDate} onChange={e => setProduct({...product, expiredDate: e.target.value})} className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold" />
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-[32px] text-white">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-green-400">
              <Warehouse size={16} /> Stok Gudang
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warehouses.map(wh => (
                <div key={wh.id} className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-gray-500 mb-1">{wh.name}</span>
                  <input 
                    type="number" 
                    value={product.stockByWarehouse?.[wh.id] || 0} 
                    onChange={e => {
                      const newStocks = {...product.stockByWarehouse, [wh.id]: Number(e.target.value)};
                      setProduct({...product, stockByWarehouse: newStocks});
                    }}
                    className="bg-gray-800 border-none rounded-xl p-3 text-white font-bold focus:ring-1 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-5 bg-green-600 hover:bg-green-700 text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-green-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-gray-300"
          >
            {isSubmitting ? 'Menyimpan...' : <><Save size={20}/> Simpan Perubahan</>}
          </button>
        </div>
      </form>
    </div>
  );
}