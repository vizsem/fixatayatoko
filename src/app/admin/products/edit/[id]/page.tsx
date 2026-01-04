'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Package, Image as ImageIcon, Barcode, Warehouse, 
  Save, ArrowLeft, Tag, Layers, 
  DollarSign, Info, Loader2, Eye, EyeOff, AlertTriangle
} from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [product, setProduct] = useState<any>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') return router.push('/profil');
      
      await Promise.all([fetchProductData(), fetchWarehouses()]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const fetchProductData = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (!docSnap.exists()) {
        alert('Produk tidak ditemukan');
        return router.push('/admin/products');
      }
      const data = docSnap.data();
      setProduct({
        ...data,
        id: docSnap.id,
        // Fallback Mapping (Pastikan data lama tetap terbaca)
        Nama: data.Nama || data.name || '',
        Ecer: data.Ecer || data.price || 0,
        Modal: data.Modal || data.purchasePrice || 0,
        Grosir: data.Grosir || data.wholesalePrice || 0,
        Stok: data.Stok ?? data.stock ?? 0,
        Kategori: data.Kategori || data.category || 'Umum',
        Satuan: data.Satuan || data.unit || 'Pcs',
        Barcode: data.Barcode || data.barcode || '',
        Status: data.Status ?? 1, // 1: Aktif, 0: Arsip
        stockByWarehouse: data.stockByWarehouse || {},
      });
      setImagePreview(data.Link_Foto || data.image || null);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWarehouses = async () => {
    const snapshot = await getDocs(collection(db, 'warehouses'));
    setWarehouses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const options = {
      maxSizeMB: 0.1, // Perkecil lagi ke 100KB agar loading dashboard cepat
      maxWidthOrHeight: 800,
      useWebWorker: true,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      setImageFile(compressedFile);
      setImagePreview(URL.createObjectURL(compressedFile));
    } catch (error) {
      alert("Gagal kompresi gambar");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Proteksi harga jual di bawah modal
    if (product.Ecer < product.Modal) {
      if (!confirm("Peringatan: Harga Jual (Ecer) lebih rendah dari Modal. Tetap simpan?")) return;
    }

    setIsSubmitting(true);
    
    try {
      let finalImageUrl = product.Link_Foto || product.image || '';

      if (imageFile) {
        const fileName = `products/${id}/main.jpg`;
        const imageRef = ref(storage, fileName);
        await uploadBytes(imageRef, imageFile);
        finalImageUrl = await getDownloadURL(imageRef);
      }

      // Hitung total stok dari semua gudang
      const totalStock = Object.values(product.stockByWarehouse || {}).reduce((a: any, b: any) => a + (Number(b) || 0), 0);

      const updatePayload = {
        ...product,
        // Update kedua versi (ID & EN) agar kompatibel dengan sistem lama & baru
        Nama: product.Nama, name: product.Nama,
        Ecer: Number(product.Ecer), price: Number(product.Ecer),
        Modal: Number(product.Modal), purchasePrice: Number(product.Modal),
        Grosir: Number(product.Grosir), wholesalePrice: Number(product.Grosir),
        Stok: totalStock, stock: totalStock,
        Kategori: product.Kategori, category: product.Kategori,
        Satuan: product.Satuan, unit: product.Satuan,
        Barcode: product.Barcode, barcode: product.Barcode,
        Status: Number(product.Status),
        Link_Foto: finalImageUrl, image: finalImageUrl,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'products', id), updatePayload);
      alert('Data Berhasil Disinkronkan!');
      router.push('/admin/products');
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="font-black uppercase text-[10px] tracking-widest text-gray-400">Sinkronisasi Database...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-screen font-sans text-black">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-4 bg-white shadow-sm rounded-2xl hover:bg-black hover:text-white transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter italic">Edit Produk</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Master Data / SKU: {product.ID || id}</p>
            </div>
          </div>

          {/* Toggle Status Aktif/Arsip */}
          <div className="flex bg-white p-2 rounded-2xl shadow-sm self-start">
            <button 
              type="button"
              onClick={() => setProduct({...product, Status: 1})}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${product.Status === 1 ? 'bg-green-600 text-white shadow-lg shadow-green-100' : 'text-gray-400'}`}
            >
              <Eye size={14} /> Aktif
            </button>
            <button 
              type="button"
              onClick={() => setProduct({...product, Status: 0})}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${product.Status === 0 ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}
            >
              <EyeOff size={14} /> Arsipkan
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Sisi Kiri: Foto */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-4 block tracking-widest text-center">Visual Produk</label>
              
              <div className="relative group aspect-square rounded-[2rem] overflow-hidden bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center transition-all hover:border-blue-400">
                {imagePreview ? (
                  <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                ) : (
                  <div className="text-center p-6">
                    <ImageIcon size={48} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-[9px] font-black text-gray-300 uppercase">Klik Tambah Foto</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                   <p className="text-white text-[10px] font-black uppercase">Ganti Foto</p>
                </div>
              </div>
            </div>

            {product.Status === 0 && (
              <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 flex items-start gap-3">
                <AlertTriangle className="text-red-600 shrink-0" size={20} />
                <p className="text-[10px] font-bold text-red-700 uppercase leading-relaxed">
                  Produk ini diarsip. Tidak akan muncul di daftar POS penjualan atau pencarian toko online.
                </p>
              </div>
            )}
          </div>

          {/* Sisi Kanan: Detail Data */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Info Produk */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4">
                <Tag size={16} className="text-blue-600" /> Spesifikasi Produk
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nama Barang</label>
                  <input required type="text" value={product.Nama} onChange={e => setProduct({...product, Nama: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none focus:ring-2 focus:ring-black" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Kategori</label>
                  <div className="relative">
                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input type="text" value={product.Kategori} onChange={e => setProduct({...product, Kategori: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Satuan (Pcs/Box/Kg)</label>
                  <input type="text" value={product.Satuan} onChange={e => setProduct({...product, Satuan: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Barcode / SKU</label>
                  <div className="relative">
                    <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                    <input type="text" value={product.Barcode} onChange={e => setProduct({...product, Barcode: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Harga */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4">
                <DollarSign size={16} className="text-emerald-600" /> Finansial
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Modal</label>
                  <input type="number" value={product.Modal} onChange={e => setProduct({...product, Modal: Number(e.target.value)})} className="w-full bg-transparent font-black text-lg outline-none" />
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl">
                  <label className="text-[10px] font-black uppercase text-blue-400 block mb-1">Harga Jual</label>
                  <input type="number" value={product.Ecer} onChange={e => setProduct({...product, Ecer: Number(e.target.value)})} className={`w-full bg-transparent font-black text-lg outline-none ${product.Ecer < product.Modal ? 'text-red-600' : 'text-blue-600'}`} />
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <label className="text-[10px] font-black uppercase text-emerald-400 block mb-1">Grosir</label>
                  <input type="number" value={product.Grosir} onChange={e => setProduct({...product, Grosir: Number(e.target.value)})} className="w-full bg-transparent font-black text-lg text-emerald-600 outline-none" />
                </div>
              </div>
              {product.Ecer < product.Modal && (
                <p className="mt-3 text-[9px] font-black text-red-600 uppercase flex items-center gap-1">
                  <AlertTriangle size={10} /> Harga jual lebih rendah dari modal!
                </p>
              )}
            </div>

            {/* Stok per Gudang */}
            <div className="bg-black p-8 rounded-[2.5rem] text-white shadow-xl shadow-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black uppercase flex items-center gap-2">
                  <Warehouse size={16} className="text-yellow-400" /> Stok di Gudang
                </h3>
                <div className="bg-yellow-400 text-black px-4 py-1 rounded-full text-[10px] font-black">
                   TOTAL: {(Object.values(product.stockByWarehouse || {}).reduce((a: any, b: any) => a + (Number(b) || 0), 0) as number)}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {warehouses.map(wh => (
                  <div key={wh.id} className="bg-white/10 p-4 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black uppercase opacity-60 tracking-tighter">{wh.name}</span>
                      <Package size={12} className="opacity-40" />
                    </div>
                    <input 
                      type="number" 
                      placeholder="0"
                      value={product.stockByWarehouse?.[wh.id] ?? ''} 
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        const newStocks = {...product.stockByWarehouse, [wh.id]: val};
                        setProduct({...product, stockByWarehouse: newStocks});
                      }}
                      className="bg-transparent w-full font-black text-xl outline-none text-white placeholder:text-white/20"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Simpan */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-blue-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:bg-gray-300"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={20}/>}
              {isSubmitting ? 'Mensinkronkan Data...' : 'Update & Simpan Produk'}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}