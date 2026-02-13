'use client';

import { useEffect, useState, useCallback } from 'react';

import { useParams, useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Tag, DollarSign, Warehouse, Save,
  Loader2, Calendar, Image as ImageIcon
} from 'lucide-react';
import Image from 'next/image';

import imageCompression from 'browser-image-compression';
import { toast } from 'react-hot-toast';

interface ProductData {
  id: string;
  ID: string;
  Nama: string;
  Kategori: string;
  Satuan: string;
  Barcode: string;
  Brand: string;
  Supplier: string;
  Min_Stok: number;
  Ecer: number;
  Modal: number;
  Grosir: number;
  Stok: number;
  Status: number;
  expired_date: string;
  URL_Produk?: string;
  Link_Foto?: string;
  image?: string;
  stockByWarehouse: Record<string, number>;
}

interface Warehouse {
  id: string;
  name: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [product, setProduct] = useState<ProductData>({
    id: '', ID: '', Nama: '', Kategori: 'UMUM', Satuan: 'PCS', Barcode: '',
    Brand: '', Supplier: '', Min_Stok: 5, Ecer: 0, Modal: 0, Grosir: 0,
    Stok: 0, Status: 1, expired_date: '', stockByWarehouse: {}
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);






  const fetchProductData = useCallback(async () => {
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (!docSnap.exists()) {
        toast.error('Produk tidak ditemukan');
        return router.push('/admin/products');
      }
      const data = docSnap.data();
      setProduct({
        ...data,
        id: docSnap.id,
        ID: data.ID || '',
        Nama: data.Nama || data.name || '',
        Ecer: Number(data.Ecer || 0),
        Modal: Number(data.Modal || 0),
        Grosir: Number(data.Grosir || 0),
        Stok: Number(data.Stok ?? 0),
        Kategori: data.Kategori || 'UMUM',
        Satuan: data.Satuan || 'PCS',
        Barcode: data.Barcode || '',
        Brand: data.Brand || '',
        Supplier: data.Supplier || '',
        Min_Stok: Number(data.Min_Stok || 5), // Default peringatan jika stok < 5
        expired_date: data.expired_date || '', // Sinkron dengan tabel admin
        Status: data.Status ?? 1,
        stockByWarehouse: data.stockByWarehouse || {},
      });

      const currentPhoto = data.URL_Produk || data.Link_Foto || data.image;
      setImagePreview(currentPhoto || null);
    } catch {
      toast.error("Gagal sinkron data");
    }
  }, [id, router]);

  const fetchWarehouses = useCallback(async () => {
    const snapshot = await getDocs(collection(db, 'warehouses'));
    setWarehouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse)));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') return router.push('/profil');
      await Promise.all([fetchProductData(), fetchWarehouses()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, router, fetchProductData, fetchWarehouses]);




  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedFile = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 1024 });
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch { toast.error("Gagal proses gambar"); }

  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const loadingToast = toast.loading("Sinkronisasi data & mencatat riwayat...");

    try {
      // 1. Ambil data stok lama untuk dibandingkan
      const oldDoc = await getDoc(doc(db, 'products', id));
      const oldData = oldDoc.data();
      const oldStocks = oldData?.stockByWarehouse || {};

      // 2. Proses Gambar
      let finalImageUrl = product.URL_Produk || product.Link_Foto || '';
      if (imageFile) {
        const imageRef = ref(storage, `products/${id}/main.jpg`);
        await uploadBytes(imageRef, imageFile);
        finalImageUrl = await getDownloadURL(imageRef);
      }

      const newStocks = product.stockByWarehouse || {};
      const totalStock = Object.values(newStocks).reduce((a, b) => a + (Number(b) || 0), 0);

      // 3. LOGIKA RIWAYAT STOK: Cek gudang mana yang angkanya berubah
      interface StockLog {
        productId: string;
        productName: string;
        warehouseId: string;
        warehouseName: string;
        previousStock: number;
        newStock: number;
        change: number;
        type: string;
        adminEmail?: string | null;
        createdAt: Timestamp | { toDate: () => Date } | null | unknown; // serverTimestamp returns FieldValue

      }
      const logEntries: StockLog[] = [];



      warehouses.forEach(wh => {
        const oldVal = Number(oldStocks[wh.id] || 0);
        const newVal = Number(newStocks[wh.id] || 0);

        if (oldVal !== newVal) {
          logEntries.push({
            productId: id,
            productName: product.Nama.toUpperCase(),
            warehouseId: wh.id,
            warehouseName: wh.name,
            previousStock: oldVal,
            newStock: newVal,
            change: newVal - oldVal,
            type: 'EDIT_ADMIN', // Penanda bahwa diubah manual lewat menu edit
            adminEmail: auth.currentUser?.email,
            createdAt: serverTimestamp(),
          });
        }
      });

      // 4. Update Dokumen Produk
      const updatePayload = {
        ...product,
        Nama: product.Nama.toUpperCase(),
        Stok: totalStock,
        URL_Produk: finalImageUrl,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'products', id), updatePayload);

      // 5. Simpan semua riwayat ke koleksi 'stock_logs'
      if (logEntries.length > 0) {
        const { addDoc, collection } = await import('firebase/firestore');
        const logPromises = logEntries.map(log => addDoc(collection(db, 'stock_logs'), log));
        await Promise.all(logPromises);
      }

      toast.success('Database & Riwayat Berhasil Disinkronkan!', { id: loadingToast });
      router.push('/admin/products');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error("Gagal: " + errorMessage, { id: loadingToast });
    } finally {

      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Tag size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-gray-900">Edit Produk</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU: {product.Barcode || id}</p>
            </div>
          </div>
          <div className="flex bg-white p-2 rounded-2xl shadow-sm">
            <button type="button" onClick={() => setProduct({ ...product, Status: 1 })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${product.Status === 1 ? 'bg-green-600 text-white' : 'text-gray-400'}`}>Aktif</button>
            <button type="button" onClick={() => setProduct({ ...product, Status: 0 })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${product.Status === 0 ? 'bg-red-600 text-white' : 'text-gray-400'}`}>Arsip</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* KIRI: MEDIA & KONTROL */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 text-center">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-4 block tracking-widest">Foto Produk</label>
              <div className="relative group aspect-square rounded-[2rem] overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center transition-all hover:border-blue-400">
                {imagePreview ? <Image src={imagePreview} className="w-full h-full object-cover" alt="Preview" width={400} height={400} /> : <ImageIcon size={48} className="text-gray-200" />}
                <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              </div>

            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block ml-1">Batas Minimum Stok</label>
              <input type="number" value={product.Min_Stok} onChange={e => setProduct({ ...product, Min_Stok: Number(e.target.value) })} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none border-2 border-transparent focus:border-orange-400 transition-all" />

              <p className="text-[8px] text-gray-400 mt-2 font-bold uppercase italic">* Notifikasi akan muncul jika stok di bawah angka ini.</p>
            </div>
          </div>

          {/* KANAN: FORM LENGKAP */}
          <div className="lg:col-span-8 space-y-6">

            {/* SPESIFIKASI */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4 text-blue-600"><Tag size={16} /> Identitas Barang</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nama Produk</label>
                  <input required type="text" value={product.Nama} onChange={e => setProduct({ ...product, Nama: e.target.value })} className="w-full p-4 bg-gray-100 rounded-2xl font-black outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Kategori</label>
                  <input type="text" value={product.Kategori} onChange={e => setProduct({ ...product, Kategori: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Brand / Merk</label>
                  <input type="text" value={product.Brand} onChange={e => setProduct({ ...product, Brand: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Barcode / SKU</label>
                  <input type="text" value={product.Barcode} onChange={e => setProduct({ ...product, Barcode: e.target.value })} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tanggal Kadaluarsa</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                    <input type="date" value={product.expired_date} onChange={e => setProduct({ ...product, expired_date: e.target.value })} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* HARGA */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4 text-emerald-600"><DollarSign size={16} /> Finansial</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-emerald-200 transition-all">
                  <label className="text-[9px] font-black uppercase text-gray-400 block mb-1">Harga Modal</label>
                  <input type="number" value={product.Modal} onChange={e => setProduct({ ...product, Modal: Number(e.target.value) })} className="w-full bg-transparent font-black text-lg outline-none" />
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-transparent hover:border-blue-200 transition-all">
                  <label className="text-[9px] font-black uppercase text-blue-400 block mb-1">Harga Ecer</label>
                  <input type="number" value={product.Ecer} onChange={e => setProduct({ ...product, Ecer: Number(e.target.value) })} className="w-full bg-transparent font-black text-lg text-blue-600 outline-none" />
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-transparent hover:border-emerald-200 transition-all">
                  <label className="text-[9px] font-black uppercase text-emerald-400 block mb-1">Harga Grosir</label>
                  <input type="number" value={product.Grosir} onChange={e => setProduct({ ...product, Grosir: Number(e.target.value) })} className="w-full bg-transparent font-black text-lg text-emerald-600 outline-none" />
                </div>

              </div>
            </div>

            {/* STOK PER GUDANG */}
            <div className="bg-black p-8 rounded-[2.5rem] text-white shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase flex items-center gap-2">
                  <Warehouse size={16} className="text-yellow-400" /> Distribusi Stok
                </h3>
                <div className="bg-yellow-400 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Total: {(() => {
                    const values = Object.values(product.stockByWarehouse || {});
                    const total = values.reduce((acc: number, curr: unknown) => acc + (Number(curr) || 0), 0);

                    return total.toLocaleString('id-ID'); // Menampilkan angka yang diformat
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warehouses.map(wh => (
                  <div key={wh.id} className="bg-white/10 p-4 rounded-2xl border border-white/5 hover:bg-white/20 transition-all cursor-pointer">
                    <span className="text-[9px] font-black uppercase opacity-60 block mb-2">{wh.name}</span>
                    <input
                      type="number"
                      value={product.stockByWarehouse?.[wh.id] ?? ''}
                      onChange={e => setProduct({ ...product, stockByWarehouse: { ...product.stockByWarehouse, [wh.id]: e.target.value === '' ? 0 : Number(e.target.value) } })}
                      className="bg-transparent w-full font-black text-xl outline-none text-white"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-blue-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-gray-300">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
              {isSubmitting ? 'Sync Database...' : 'Update Master Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
