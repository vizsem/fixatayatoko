'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import { 
  ChevronLeft, Save, Package, Tag, Truck, 
  Barcode, Image as ImageIcon, AlertCircle, Layers 
} from 'lucide-react';

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    ID: '',
    Barcode: '',
    Parent_ID: '',
    Nama: '',
    Kategori: '',
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
    No_WA_Supplier: ''
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

      // 2. Simpan ke Firestore
      await addDoc(collection(db, 'products'), {
        ...formData,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      alert('Produk berhasil ditambahkan ke database!');
      router.push('/admin/products');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          
          {/* BAGIAN 1: IDENTITAS (ID & SKU) */}
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-blue-600">
              <Barcode size={18} />
              <h3 className="text-xs font-black uppercase tracking-widest">Identitas Produk</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">ID Produk (Unique) *</label>
                <input required type="text" placeholder="Contoh: AT-001" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.ID} onChange={e => setFormData({...formData, ID: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Barcode / SKU</label>
                <input type="text" placeholder="Scan Barcode" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold" value={formData.Barcode} onChange={e => setFormData({...formData, Barcode: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Parent ID (Untuk Varian)</label>
                <input type="text" placeholder="Kosongkan jika bukan varian" className="w-full p-4 bg-purple-50 rounded-2xl border-none focus:ring-2 focus:ring-purple-500 font-bold text-purple-700" value={formData.Parent_ID} onChange={e => setFormData({...formData, Parent_ID: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Nama Produk *</label>
                <input required type="text" className="w-full p-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold" value={formData.Nama} onChange={e => setFormData({...formData, Nama: e.target.value})} />
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
              <div className="col-span-2 md:col-span-1 space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Kategori</label>
                <input required type="text" placeholder="Umum" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.Kategori} onChange={e => setFormData({...formData, Kategori: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Satuan</label>
                <input required type="text" placeholder="Pcs/Dus" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold" value={formData.Satuan} onChange={e => setFormData({...formData, Satuan: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-emerald-600">Stok Awal</label>
                <input required type="number" className="w-full p-4 bg-emerald-50 rounded-2xl border-none font-black text-emerald-700" value={formData.Stok} onChange={e => setFormData({...formData, Stok: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2 text-red-500">Min. Stok</label>
                <input required type="number" className="w-full p-4 bg-red-50 rounded-2xl border-none font-black text-red-600" value={formData.Min_Stok} onChange={e => setFormData({...formData, Min_Stok: Number(e.target.value)})} />
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
                <input required type="number" className="w-full p-4 bg-gray-100 rounded-2xl border-none font-black" value={formData.Modal} onChange={e => setFormData({...formData, Modal: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Ecer (Jual)</label>
                <input required type="number" className="w-full p-4 bg-blue-50 rounded-2xl border-none font-black text-blue-700 focus:ring-2 focus:ring-blue-600" value={formData.Ecer} onChange={e => setFormData({...formData, Ecer: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Harga Coret</label>
                <input type="number" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-black text-gray-300 line-through" value={formData.Harga_Coret} onChange={e => setFormData({...formData, Harga_Coret: Number(e.target.value)})} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 bg-orange-50 rounded-3xl border border-orange-100">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Harga Grosir</label>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Grosir} onChange={e => setFormData({...formData, Grosir: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-orange-600 ml-2">Min. Beli Grosir</label>
                <input type="number" className="w-full p-4 bg-white rounded-2xl border-none font-black text-orange-700 shadow-sm" value={formData.Min_Grosir} onChange={e => setFormData({...formData, Min_Grosir: Number(e.target.value)})} />
              </div>
            </div>
          </div>

          {/* BAGIAN 4: MEDIA & SUPPLIER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-xs font-black uppercase text-gray-400 mb-4 flex items-center gap-2"><ImageIcon size={14}/> Media</h3>
              <div className="space-y-4">
                <input type="text" placeholder="URL Foto Produk" className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Link_Foto} onChange={e => setFormData({...formData, Link_Foto: e.target.value})} />
                <textarea rows={3} placeholder="Deskripsi Singkat..." className="w-full p-4 bg-gray-50 rounded-2xl border-none font-bold text-xs" value={formData.Deskripsi} onChange={e => setFormData({...formData, Deskripsi: e.target.value})}></textarea>
              </div>
            </div>
            <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-xl text-white">
              <h3 className="text-xs font-black uppercase text-blue-200 mb-4 flex items-center gap-2"><Truck size={14}/> Supplier</h3>
              <div className="space-y-4">
                <input type="text" placeholder="Nama Supplier" className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.Supplier} onChange={e => setFormData({...formData, Supplier: e.target.value})} />
                <input type="text" placeholder="WA: 628..." className="w-full p-4 bg-blue-500/30 rounded-2xl border-none font-bold placeholder:text-blue-200 text-white" value={formData.No_WA_Supplier} onChange={e => setFormData({...formData, No_WA_Supplier: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6">
            <button type="button" onClick={() => router.back()} className="flex-1 p-5 bg-white text-gray-400 font-black uppercase text-xs rounded-[2rem] shadow-sm border hover:bg-gray-100 transition-all">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex-[2] p-5 bg-black text-white font-black uppercase text-xs rounded-[2rem] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 tracking-widest">
              {loading ? 'SISTEM MENYIMPAN...' : <><Save size={18}/> Simpan Produk</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}