'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function AddProductPage() {
  const router = useRouter();
  
  // State untuk semua field produk
  const [formData, setFormData] = useState({
    barcode: '',
    nama: '',
    kategori: '',
    variant: '',
    satuan: 'Pcs', // Default satuan
    harga_beli: 0,
    ecer: 0,
    grosir: 0,
    min_grosir: 1,
    stok: 0,
    url_produk: ''
  });

  // Fungsi untuk menangani perubahan input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newProduct = {
        ...formData,
        // Pastikan angka disimpan sebagai Number, bukan String
        harga_beli: Number(formData.harga_beli),
        ecer: Number(formData.ecer),
        grosir: Number(formData.grosir),
        min_grosir: Number(formData.min_grosir),
        stok: Number(formData.stok),
        // Hitung profit otomatis sebelum simpan
        profit_ecer: Number(formData.ecer) - Number(formData.harga_beli),
        profit_grosir: Number(formData.grosir) - Number(formData.harga_beli),
        createdAt: new Date()
      };

      await addDoc(collection(db, "products"), newProduct);
      alert("Produk berhasil ditambahkan!");
      router.push('/admin/products'); // Kembali ke daftar produk
    } catch (error) {
      console.error("Error adding product: ", error);
      alert("Gagal menambah produk. Cek console.");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Tambah Produk Baru</h1>
      <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Barcode & Nama */}
        <input name="barcode" placeholder="Barcode" onChange={handleChange} className="border p-2 rounded text-black" />
        <input name="nama" placeholder="Nama Produk" onChange={handleChange} required className="border p-2 rounded text-black" />
        
        {/* Kategori & Satuan */}
        <input name="kategori" placeholder="Kategori" onChange={handleChange} className="border p-2 rounded text-black" />
        <select name="satuan" onChange={handleChange} className="border p-2 rounded text-black">
          <option value="Pcs">Pcs</option>
          <option value="Bungkus">Bungkus</option>
          <option value="Dus">Dus</option>
          <option value="Lusin">Lusin</option>
        </select>

        {/* Harga & Stok */}
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Harga Beli (Modal)</label>
          <input name="harga_beli" type="number" onChange={handleChange} className="border p-2 rounded text-black" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Harga Jual Ecer</label>
          <input name="ecer" type="number" onChange={handleChange} className="border p-2 rounded text-black" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Harga Jual Grosir</label>
          <input name="grosir" type="number" onChange={handleChange} className="border p-2 rounded text-black" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500">Minimal Beli Grosir</label>
          <input name="min_grosir" type="number" onChange={handleChange} className="border p-2 rounded text-black" />
        </div>

        <input name="stok" type="number" placeholder="Stok Awal" onChange={handleChange} className="border p-2 rounded text-black" />
        <input name="url_produk" placeholder="URL Foto Produk" onChange={handleChange} className="border p-2 rounded text-black" />

        <button type="submit" className="md:col-span-2 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700">
          Simpan Produk
        </button>
      </form>
    </div>
  );
}