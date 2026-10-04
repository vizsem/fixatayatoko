// src/app/admin/inventory/stock-in/StockInFormInner.tsx
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';


import { useRouter } from 'next/navigation';
import { ArrowDown, Plus } from 'lucide-react';
import notify from '@/lib/notify';
import { addStockTx, computeAverageCost } from '@/lib/inventory';
import { supabase } from '@/lib/supabase';



import { getUserAndRole, sbGetDoc, sbGetDocs } from '@/lib/supabase-helpers';

import { isAdminRole } from '@/lib/auth-helpers';
type Product = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  stockByWarehouse?: { [key: string]: number };
};

type Supplier = {
  id: string;
  name: string;
};

export default function StockInFormInner({ productId }: { productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState({
    productId: productId,
    supplierId: '',
    quantity: 0,
    purchasePrice: 0,
    expiredDate: ''
  });

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === formData.productId) || null;
  }, [formData.productId, products]);


  const loadSupportingData = useCallback(async () => {
    try {
      // Load products
      const productsSnap = await sbGetDocs({ table: 'products' });
      const productList = productsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        unit: doc.data().unit || 'pcs',
        stock: doc.data().stock || 0
      }));
      setProducts(productList);

      // Load suppliers
      const suppliersSnap = await sbGetDocs({ table: 'suppliers' });
      const supplierList = suppliersSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setSuppliers(supplierList);

      // Set default product if provided
      if (productId) {
        setFormData(prev => ({ ...prev, productId }));
      }

    } catch (err) {
      console.error('Gagal memuat data:', err);
    }
  }, [productId]);

  // Proteksi admin
  useEffect(() => {
    const checkAuth = async () => {
      const { user, isAdmin } = await getUserAndRole();
      if (!user) {
        router.push('/profil/login');
        return;
      }

      if (!isAdmin) {
        notify.admin.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      // Load data
      await loadSupportingData();
      setLoading(false);
    };
    checkAuth();

    let __unsubscribe: (() => void) | undefined;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        checkAuth();
      });
      __unsubscribe = () => subscription.unsubscribe();
    })();

    return () => { if (__unsubscribe) __unsubscribe(); };
  }, [router, loadSupportingData]);




  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.quantity <= 0) {
      notify.admin.error('Jumlah harus lebih dari 0');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id || 'system';

      // Baca data produk untuk menghitung Average Cost baru
      const { data: productData } = await supabase.from('products').select('stock,raw_data').eq('id', formData.productId).single();
      if (!productData) throw new Error('Produk tidak ditemukan');

      const oldStock = Number(productData.stock || 0);
      const oldModal = Number(productData.raw_data?.Modal || 0);
      const supplierName = suppliers.find(s => s.id === formData.supplierId)?.name;
      const newModal = computeAverageCost(oldStock, oldModal, formData.quantity, formData.purchasePrice, 1);

      // 1. Jika modal berubah — update produk & catat cost log
      if (newModal !== oldModal) {
        await supabase.from('products').update({
          raw_data: { ...productData.raw_data, Modal: newModal },
          updated_at: new Date().toISOString()
        }).eq('id', formData.productId);

        await supabase.from('product_cost_logs').insert({
          id: `costlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          product_id: formData.productId,
          old_cost: oldModal,
          new_cost: newModal,
          admin_email: user?.email || 'system',
          change_date: new Date().toISOString()
        });
      }

      // 2. Tambah stok
      await addStockTx({
        productId: formData.productId,
        amount: formData.quantity,
        warehouseId: 'gudang-utama',
        adminId,
        note: `Pembelian dari ${supplierName}`,
        source: 'PURCHASE',
      });

      // 3. Simpan record transaksi stok masuk
      await supabase.from('inventory_transactions').insert({
        id: `stkin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: 'STOCK_IN',
        product_id: formData.productId,
        product_name: selectedProduct?.name,
        supplier_id: formData.supplierId,
        supplier_name: supplierName,
        quantity: formData.quantity,
        purchase_price: formData.purchasePrice,
        expired_date: formData.expiredDate || null,
        created_at: new Date().toISOString()
      });

      notify.admin.success('Stok berhasil ditambahkan!');
      router.push('/admin/inventory');
    } catch (err) {
      console.error('Gagal menambah stok:', err);
      notify.admin.error('Gagal menambah stok. Silakan coba lagi.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat form stok masuk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ArrowDown className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Stok Masuk</h1>
        </div>
        <p className="text-black">Tambah stok dari pembelian supplier</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="mb-6">
          <label className="block text-black text-sm font-medium mb-2">
            Pilih Produk *
          </label>
          <select
            required
            value={formData.productId}
            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
          >
            <option value="">Pilih produk...</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.stock} {product.unit} tersedia)
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-black text-sm font-medium mb-2">
            Supplier *
          </label>
          <select
            required
            value={formData.supplierId}
            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
          >
            <option value="">Pilih supplier...</option>
            {suppliers.map(supplier => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-black text-sm font-medium mb-2">
              Jumlah *
            </label>
            <input
              type="number"
              required
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              placeholder="100"
            />
          </div>

          <div>
            <label className="block text-black text-sm font-medium mb-2">
              Harga Beli (Rp) *
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.purchasePrice}
              onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              placeholder="10000"
            />
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-black text-sm font-medium mb-2">
            Tanggal Kadaluarsa
          </label>
          <input
            type="date"
            value={formData.expiredDate}
            onChange={(e) => setFormData({ ...formData, expiredDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/inventory')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Tambah Stok
          </button>
        </div>
      </form>
    </div>
  );
}
