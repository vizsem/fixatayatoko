'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
  ChevronLeft, Save, Tag, Truck,
  Barcode, Image as ImageIcon, AlertCircle, Layers
} from 'lucide-react';
import notify from '@/lib/notify';


export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);

  const [formData, setFormData] = useState({
    ID: '',
    Barcode: '',
    Parent_ID: '',
    Nama: '',
    Kategori: '',
    Brand: '',
    Expired_Default: '',
    expired_date: '',
    tgl_masuk: '',
    Satuan: 'Pcs',
    Stok: 0,
    Min_Stok: 5,
    Modal: 0,
    Ecer: 0,
    Harga_Coret: 0,
    Grosir: 0,
    Min_Grosir: 1,
    Link_Foto: '',
    Deskripsi: '',
    Status: 1,
    Supplier: '',
    No_WA_Supplier: '',
    Lokasi: '',
    warehouseId: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Validasi ID Duplikat (Wajib Unik untuk Sinkronisasi Excel)
      const q = query(collection(db, 'products'), where('ID', '==', formData.ID));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(`ID Produk "${formData.ID}" sudah terdaftar di database!`);
      }

      // 2. Simpan ke Firestore (lengkap dengan field ter-normalisasi)
      await addDoc(collection(db, 'products'), {
        ...formData,
        sku: formData.ID,
        name: formData.Nama,
        category: formData.Kategori,
        unit: formData.Satuan,
        stock: Number(formData.Stok || 0),
        minStock: Number(formData.Min_Stok || 0),
        purchasePrice: Number(formData.Modal || 0),
        priceEcer: Number(formData.Ecer || 0),
        priceGrosir: Number(formData.Grosir || 0),
        Min_Grosir: Number(formData.Min_Grosir || 0),
        imageUrl: formData.Link_Foto,
        isActive: Number(formData.Status) === 1,
        warehouseId: formData.warehouseId || '',
        tgl_masuk: formData.tgl_masuk || '',
        expired_date: formData.expired_date || formData.Expired_Default || '',
        Lokasi: formData.Lokasi || '',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      notify.admin.success('Produk berhasil ditambahkan ke database!');
      router.push('/admin/products');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unknown error occurred');
      }
    } finally {

      setLoading(false);
    }
  };

  // Load warehouses
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'warehouses'), (s) => {
      setWarehouses(s.docs.map(d => {
        const data = d.data() as Record<string, unknown>;
        const name = (typeof data.name === 'string' && data.name) ? data.name : d.id;
        return { id: d.id, name };
      }));
    });
    return () => unsub();
  }, []);
  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen pb-24 text-black font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/products" className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">Tambah Produk</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Database Inventaris Ataya</p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-xs font-black uppercase animate-bounce">
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="text-xs font-black uppercase mb-6 flex items-center gap-2 border-b pb-4 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-tag" aria-hidden="true">
                <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path>
                <circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle>
              </svg>
              Identitas Barang
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nama Produk</label>
                <input required className="w-full p-4 bg-gray-100 rounded-2xl font-black outline-none" type="text" value={formData.Nama} onChange={e => setFormData({ ...formData, Nama: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Lokasi Rak</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Lokasi} onChange={e => setFormData({ ...formData, Lokasi: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Kategori</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Kategori} onChange={e => setFormData({ ...formData, Kategori: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Brand / Merk</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Brand} onChange={e => setFormData({ ...formData, Brand: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Barcode / SKU</label>
                <input className="w-full p-4 bg-gray-50 rounded-2xl font-black outline-none" type="text" value={formData.Barcode} onChange={e => setFormData({ ...formData, Barcode: e.target.value })} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tanggal Kadaluarsa</label>
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" aria-hidden="true">
                    <path d="M8 2v4"></path>
                    <path d="M16 2v4"></path>
                    <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                    <path d="M3 10h18"></path>
                  </svg>
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="date" value={formData.Expired_Default} onChange={e => setFormData({ ...formData, Expired_Default: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Tanggal Masuk</label>
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" aria-hidden="true">
                    <path d="M8 2v4"></path>
                    <path d="M16 2v4"></path>
                    <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                    <path d="M3 10h18"></path>
                  </svg>
                  <input className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-black outline-none" type="date" value={formData.tgl_masuk} onChange={e => setFormData({ ...formData, tgl_masuk: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN 2: STOK & KATEGORI */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-emerald-600">
              <Layers size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Kategori & Stok</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Satuan</label>
                <input required type="text" placeholder="Pcs/Dus" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.Satuan} onChange={e => setFormData({ ...formData, Satuan: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-emerald-600">Stok Awal</label>
                <input required type="number" className="w-full p-4 bg-emerald-50 rounded-2xl border-none font-black text-emerald-700" value={formData.Stok} onChange={e => setFormData({ ...formData, Stok: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-red-500">Min. Stok</label>
                <input required type="number" className="w-full p-4 bg-red-50 rounded-2xl border-none font-black text-red-600" value={formData.Min_Stok} onChange={e => setFormData({ ...formData, Min_Stok: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Gudang</label>
                <select className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.warehouseId} onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}>
                  <option value="">Pilih Gudang</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* BAGIAN 3: HARGA & GROSIR */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-orange-600">
              <Tag size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Struktur Harga</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Modal</label>
                <input required type="number" className="w-full p-4 bg-gray-100 rounded-2xl border-none font-black" value={formData.Modal} onChange={e => setFormData({ ...formData, Modal: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Ecer (Jual)</label>
                <input required type="number" className="w-full p-4 bg-blue-50 rounded-2xl border-none font-black text-blue-700 focus:ring-2 focus:ring-blue-600" value={formData.Ecer} onChange={e => setFormData({ ...formData, Ecer: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Coret</label>
                <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-gray-300 line-through" value={formData.Harga_Coret} onChange={e => setFormData({ ...formData, Harga_Coret: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 bg-orange-50 rounded-3xl border border-orange-100">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Harga Grosir</label>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Grosir} onChange={e => setFormData({ ...formData, Grosir: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Min. Beli Grosir</label>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Min_Grosir} onChange={e => setFormData({ ...formData, Min_Grosir: Number(e.target.value) })} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-gray-400">Status</span>
              <select className="p-3 bg-gray-50 rounded-xl text-xs font-bold" value={formData.Status} onChange={e => setFormData({ ...formData, Status: Number(e.target.value) })}>
                <option value={1}>Aktif</option>
                <option value={0}>Arsip</option>
              </select>
            </div>
          </div>

          {/* BAGIAN 4: MEDIA & SUPPLIER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase text-gray-400 mb-4 flex items-center gap-2"><ImageIcon size={14} /> Media</h3>
              <div className="space-y-4">
                <input type="text" placeholder="URL Foto Produk" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Link_Foto} onChange={e => setFormData({ ...formData, Link_Foto: e.target.value })} />
                <textarea rows={3} placeholder="Deskripsi Singkat..." className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Deskripsi} onChange={e => setFormData({ ...formData, Deskripsi: e.target.value })}></textarea>
              </div>
            </div>
            <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-xl text-white">
              <h3 className="text-xs font-black uppercase text-blue-200 mb-4 flex items-center gap-2"><Truck size={14} /> Supplier</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Nama Supplier" className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.Supplier} onChange={e => setFormData({ ...formData, Supplier: e.target.value })} />
                <input type="text" placeholder="WA: 628..." className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.No_WA_Supplier} onChange={e => setFormData({ ...formData, No_WA_Supplier: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <button type="button" onClick={() => router.back()} className="flex-1 p-5 bg-white text-gray-400 font-black uppercase text-xs rounded-[2rem] shadow-sm border hover:bg-gray-100 transition-all">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex-[2] p-5 bg-black text-white font-black uppercase text-xs rounded-[2rem] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 tracking-widest">
              {loading ? 'SISTEM MENYIMPAN...' : <><Save size={18} /> Simpan Produk</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
