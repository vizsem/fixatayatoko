// src/app/(admin)/products/page.tsx
'use client';

// ✅ Gunakan SheetJS dari CDN (aman dari vulnerability)
declare const XLSX: any;

import { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Package, 
  Upload, 
  Download,
  AlertTriangle,
  Barcode,
  Warehouse,
  TrendingUp
} from 'lucide-react';

type Product = {
  id: string;
  name: string;
  price: number;
  wholesalePrice: number;
  purchasePrice: number; // ✅ HARGA BELI
  stock: number;
  stockByWarehouse?: Record<string, number>;
  category: string;
  unit: string;
  barcode: string; // ✅ BARCODE UNIK
  image: string;
  expiredDate?: string;
  createdAt: string;
};

// Contoh produk awal dengan barcode & harga beli
const sampleProducts: Omit<Product, 'id' | 'createdAt'>[] = [
  {
    name: "Beras Premium 5kg",
    price: 65000,
    wholesalePrice: 60000,
    purchasePrice: 50000,
    stock: 150,
    category: "Beras & Tepung",
    unit: "5kg",
    barcode: "BR001",
    image: "https://placehold.co/400x400/f59e0b/ffffff?text=Beras+5kg"
  },
  {
    name: "Minyak Goreng 2L",
    price: 32000,
    wholesalePrice: 28000,
    purchasePrice: 25000,
    stock: 85,
    category: "Minyak & Gula",
    unit: "2L",
    barcode: "MG002",
    image: "https://placehold.co/400x400/ef4444/ffffff?text=Minyak+2L"
  },
  {
    name: "Gula Pasir 1kg",
    price: 18000,
    wholesalePrice: 16000,
    purchasePrice: 14000,
    stock: 200,
    category: "Minyak & Gula",
    unit: "1kg",
    barcode: "GP003",
    image: "https://placehold.co/400x400/f97316/ffffff?text=Gula+1kg"
  },
  {
    name: "Mie Instan 40pcs",
    price: 2000,
    wholesalePrice: 1800,
    purchasePrice: 1500,
    stock: 500,
    category: "Mie & Sereal",
    unit: "pcs",
    barcode: "MI004",
    image: "https://placehold.co/400x400/8b5cf6/ffffff?text=Mie+Instan"
  },
  {
    name: "Sabun Mandi 120gr",
    price: 6000,
    wholesalePrice: 5500,
    purchasePrice: 4800,
    stock: 250,
    category: "Perlengkapan Mandi",
    unit: "pcs",
    barcode: "SM005",
    image: "https://placehold.co/400x400/ec4899/ffffff?text=Sabun"
  },
  {
    name: "Tepung Terigu 1kg",
    price: 12000,
    wholesalePrice: 11000,
    purchasePrice: 9500,
    stock: 180,
    category: "Beras & Tepung",
    unit: "1kg",
    barcode: "TT006",
    image: "https://placehold.co/400x400/3b82f6/ffffff?text=Tepung+1kg"
  },
  {
    name: "Kopi Sachet 20pcs",
    price: 15000,
    wholesalePrice: 13500,
    purchasePrice: 12000,
    stock: 300,
    category: "Minuman",
    unit: "20pcs",
    barcode: "KS007",
    image: "https://placehold.co/400x400/6366f1/ffffff?text=Kopi+Sachet"
  },
  {
    name: "Popok Bayi XL 30pcs",
    price: 85000,
    wholesalePrice: 78000,
    purchasePrice: 70000,
    stock: 120,
    category: "Perlengkapan Bayi",
    unit: "30pcs",
    barcode: "PB008",
    image: "https://placehold.co/400x400/10b981/ffffff?text=Popok+Bayi"
  },
  {
    name: "Tisu Basah 80pcs",
    price: 10000,
    wholesalePrice: 9000,
    purchasePrice: 8500,
    stock: 200,
    category: "Perlengkapan Mandi",
    unit: "80pcs",
    barcode: "TB009",
    image: "https://placehold.co/400x400/f59e0b/ffffff?text=Tisu+Basah"
  },
  {
    name: "Susu Bubuk 800gr",
    price: 120000,
    wholesalePrice: 110000,
    purchasePrice: 95000,
    stock: 80,
    category: "Minuman",
    unit: "800gr",
    barcode: "SB010",
    image: "https://placehold.co/400x400/8b5cf6/ffffff?text=Susu+Bubuk"
  }
];

export default function AdminProducts() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkEdit, setBulkEdit] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    wholesalePrice: 0,
    purchasePrice: 0, // ✅
    stock: 0,
    category: '',
    unit: '',
    barcode: '',
    expiredDate: ''
  });

  // Proteksi akses admin
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

      // Tambahkan contoh produk jika belum ada
      const productsSnapshot = await getDocs(collection(db, 'products'));
      if (productsSnapshot.empty) {
        for (const product of sampleProducts) {
          await addDoc(collection(db, 'products'), {
            ...product,
            stockByWarehouse: { 'gudang-utama': product.stock },
            createdAt: serverTimestamp()
          });
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Ambil data produk & gudang real-time
  useEffect(() => {
    if (loading) return;

    // Produk
    const productsRef = collection(db, 'products');
    const productsQ = query(productsRef, orderBy('name', 'asc'));
    const productsUnsub = onSnapshot(productsQ, (snapshot) => {
      const productList: Product[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        productList.push({
          id: doc.id,
          name: data.name || '',
          price: data.price || 0,
          wholesalePrice: data.wholesalePrice || 0,
          purchasePrice: data.purchasePrice || 0, // ✅
          stock: data.stock || 0,
          stockByWarehouse: data.stockByWarehouse || {},
          category: data.category || '',
          unit: data.unit || '',
          barcode: data.barcode || '',
          image: data.image || 'https://placehold.co/400x400/64748b/ffffff?text=No+Image',
          expiredDate: data.expiredDate,
          createdAt: data.createdAt || ''
        });
      });
      setProducts(productList);
    });

    // Gudang
    const warehousesRef = collection(db, 'warehouses');
    const warehousesUnsub = onSnapshot(warehousesRef, (snapshot) => {
      const warehouseList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      }));
      setWarehouses(warehouseList);
    });

    return () => {
      productsUnsub();
      warehousesUnsub();
    };
  }, [loading]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'products'), {
        ...formData,
        stockByWarehouse: { 'gudang-utama': formData.stock },
        image: "https://placehold.co/400x400/64748b/ffffff?text=No+Image",
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setFormData({
        name: '',
        price: 0,
        wholesalePrice: 0,
        purchasePrice: 0,
        stock: 0,
        category: '',
        unit: '',
        barcode: '',
        expiredDate: ''
      });
    } catch (err) {
      alert('Gagal menambahkan produk.');
      console.error(err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus produk "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      alert('Gagal menghapus produk.');
      console.error(err);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter(pid => pid !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const handleBulkAction = async (action: 'increase' | 'decrease' | 'setPrice') => {
    if (selectedProducts.length === 0) {
      alert('Pilih minimal 1 produk untuk edit massal.');
      return;
    }

    let value = 0;
    if (action !== 'setPrice') {
      value = parseInt(prompt(`Masukkan jumlah stok untuk ${action === 'increase' ? 'tambah' : 'kurangi'}:`) || '0');
    } else {
      value = parseInt(prompt('Masukkan harga ecer baru:') || '0');
    }

    if (isNaN(value) || value < 0) {
      alert('Nilai tidak valid.');
      return;
    }

    try {
      for (const id of selectedProducts) {
        const product = products.find(p => p.id === id);
        if (product) {
          if (action === 'setPrice') {
            await updateDoc(doc(db, 'products', id), { price: value });
          } else {
            const newStock = action === 'increase' 
              ? product.stock + value 
              : Math.max(0, product.stock - value);
            
            const stockByWarehouse = { ...product.stockByWarehouse };
            const mainWarehouse = warehouses[0]?.id || 'gudang-utama';
            stockByWarehouse[mainWarehouse] = 
              (stockByWarehouse[mainWarehouse] || 0) + (action === 'increase' ? value : -value);

            await updateDoc(doc(db, 'products', id), { 
              stock: newStock,
              stockByWarehouse
            });
          }
        }
      }
      setSelectedProducts([]);
    } catch (err) {
      alert('Gagal edit massal.');
      console.error(err);
    }
  };

  // ✅ Import Excel (aman menggunakan SheetJS 0.20.2+ dari CDN)
  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Hanya file Excel (.xlsx, .xls) yang diizinkan!');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File terlalu besar! Maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== 'string') return;
      
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const productsToImport = data.slice(1)
        .filter(row => row.length >= 4)
        .map((row: any[]) => ({
          name: row[0] || '',
          price: Number(row[1]) || 0,
          wholesalePrice: Number(row[2]) || 0,
          purchasePrice: Number(row[3]) || 0, // ✅
          stock: Number(row[4]) || 0,
          category: row[5] || 'Umum',
          unit: row[6] || 'pcs',
          barcode: row[7] || '',
          image: row[8] || 'https://placehold.co/400x400/64748b/ffffff?text=No+Image',
          stockByWarehouse: { 'gudang-utama': Number(row[4]) || 0 },
          createdAt: serverTimestamp()
        }));

      productsToImport.forEach(async (product) => {
        await addDoc(collection(db, 'products'), product);
      });

      alert(`Berhasil mengimpor ${productsToImport.length} produk!`);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ✅ Export Excel
  const handleExport = () => {
    const data = products.map(product => ({
      Nama: product.name,
      'Harga Ecer': product.price,
      'Harga Grosir': product.wholesalePrice,
      'Harga Beli': product.purchasePrice, // ✅
      Stok: product.stock,
      Kategori: product.category,
      Satuan: product.unit,
      Barcode: product.barcode, // ✅
      Gambar: product.image
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produk');
    XLSX.writeFile(wb, 'produk-atayatoko.xlsx');
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm) // ✅ Pencarian via barcode
  );

  const isExpired = (date: string | undefined) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  // Hitung profit margin
  const calculateProfitMargin = (product: Product) => {
    if (!product.purchasePrice || product.purchasePrice <= 0) return 0;
    return ((product.price - product.purchasePrice) / product.price) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data produk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Package className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Manajemen Produk</h1>
        </div>
        <p className="text-black">Kelola produk grosir & ecer Anda dengan lengkap</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Aksi Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Cari produk, kategori, atau barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
            />
            <Barcode className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          </div>
          
          {selectedProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-black">
                {selectedProducts.length} dipilih
              </span>
              <button
                onClick={() => handleBulkAction('increase')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                + Stok
              </button>
              <button
                onClick={() => handleBulkAction('decrease')}
                className="px-3 py-1 bg-orange-600 text-white rounded text-sm"
              >
                - Stok
              </button>
              <button
                onClick={() => handleBulkAction('setPrice')}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm"
              >
                Ubah Harga
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer">
            <Upload size={18} />
            Import Excel
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Download size={18} />
            Export Excel
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Plus size={18} />
            Tambah Produk
          </button>
        </div>
      </div>

      {/* Tabel Produk */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length > 0 && selectedProducts.length === products.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts(products.map(p => p.id));
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Produk
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Harga (Rp)
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Stok
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-black">
                    <Package className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Belum ada produk</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isLowStock = product.stock <= 10 && product.stock > 0;
                  const isOutOfStock = product.stock === 0;
                  const expired = isExpired(product.expiredDate);
                  const profitMargin = calculateProfitMargin(product);

                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded border"
                          />
                          <div>
                            <div className="font-medium text-black">{product.name}</div>
                            <div className="text-sm text-black">{product.unit} • {product.category}</div>
                            {product.barcode && (
                              <div className="text-xs text-black flex items-center gap-1">
                                <Barcode size={12} />
                                {product.barcode}
                              </div>
                            )}
                            {expired && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full mt-1">
                                Expired
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span className="text-black">Ecer: </span>
                          <span className="font-medium">Rp{product.price.toLocaleString('id-ID')}</span>
                        </div>
                        <div>
                          <span className="text-green-600">Grosir: Rp{product.wholesalePrice.toLocaleString('id-ID')}</span>
                        </div>
                        {product.purchasePrice > 0 && (
                          <div className="text-xs mt-1">
                            <span className="text-blue-600 flex items-center gap-1">
                              <TrendingUp size={12} />
                              Profit: Rp{(product.price - product.purchasePrice).toLocaleString('id-ID')} 
                              ({profitMargin.toFixed(0)}%)
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span
                            className={`font-medium ${
                              isOutOfStock
                                ? 'text-red-600'
                                : isLowStock
                                ? 'text-orange-600'
                                : expired
                                ? 'text-red-600'
                                : 'text-black'
                            }`}
                          >
                            {product.stock}
                          </span>
                          {isLowStock && (
                            <AlertTriangle className="ml-2 h-4 w-4 text-orange-500" />
                          )}
                          {isOutOfStock && (
                            <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                              Habis
                            </span>
                          )}
                        </div>
                        {warehouses.length > 1 && (
                          <div className="text-xs text-black mt-1">
                            {warehouses.map(wh => (
                              <div key={wh.id} className="flex justify-between">
                                <span>{wh.name}:</span>
                                <span>{product.stockByWarehouse?.[wh.id] || 0}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/admin/products/edit/${product.id}`}
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Edit size={16} />
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            className="text-red-600 hover:text-red-800 flex items-center gap-1"
                          >
                            <Trash2 size={16} />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Produk */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-black">Tambah Produk Baru</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleCreate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Nama Produk *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Kategori
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                      placeholder="Beras, Minyak, dll"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Satuan *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.unit}
                      onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                      placeholder="kg, pcs, dus, liter"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Barcode
                    </label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Harga Ecer (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Harga Grosir (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.wholesalePrice}
                      onChange={(e) => setFormData({...formData, wholesalePrice: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Harga Beli (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                      placeholder="Harga dari supplier"
                    />
                    {formData.purchasePrice > 0 && formData.price > 0 && (
                      <p className="text-xs text-black mt-1">
                        Margin: {(
                          ((formData.price - formData.purchasePrice) / formData.price) * 100
                        ).toFixed(1)}%
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Stok Awal *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Tgl Kadaluarsa
                    </label>
                    <input
                      type="date"
                      value={formData.expiredDate}
                      onChange={(e) => setFormData({...formData, expiredDate: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                    />
                  </div>
                </div>
                
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    Tambah Produk
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}