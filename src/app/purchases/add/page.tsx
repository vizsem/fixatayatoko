// src/app/(admin)/purchases/add/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';

import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import toast, { Toaster } from 'react-hot-toast';

type Supplier = {
  id: string;
  name: string;
};

type Warehouse = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  unit: string;
  purchasePrice: number;
};

type PurchaseItem = {
  productId: string;
  name: string;
  purchasePrice: number;
  quantity: number;
  unit: string;
};

export default function AddPurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    paymentMethod: 'CASH',
    paymentStatus: 'LUNAS' as 'LUNAS' | 'HUTANG' | 'DP',
    shippingCost: 0,
    notes: '',
    dueDate: ''
  });

  const loadSupportingData = useCallback(async () => {
    try {
      // Load suppliers
      const suppliersSnap = await getDocs(collection(db, 'suppliers'));
      const supplierList = suppliersSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setSuppliers(supplierList);

      // Load warehouses
      const warehousesSnap = await getDocs(collection(db, 'warehouses'));
      const warehouseList = warehousesSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setWarehouses(warehouseList);

      // Load products
      const productsSnap = await getDocs(collection(db, 'products'));
      const productList = productsSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        unit: doc.data().unit || 'pcs',
        purchasePrice: doc.data().purchasePrice || 0
      }));
      setProducts(productList);
    } catch (err) {
      console.error('Gagal memuat data pendukung:', err);
    }
  }, []);

  // Proteksi admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists() || userDoc.data()?.role !== 'admin') {
        toast.error('Akses ditolak! Anda bukan admin.');
        router.push('/profil');
        return;
      }

      await loadSupportingData();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, loadSupportingData]);


  const addItem = () => {
    const newItem: PurchaseItem = {
      productId: '',
      name: '',
      purchasePrice: 0,
      quantity: 1,
      unit: 'pcs'
    };
    setItems([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number) => {
    const newItems = [...items];
    const updatedItem = { ...newItems[index] };

    if (field === 'purchasePrice' || field === 'quantity') {
      updatedItem[field] = Number(value);
    } else if (field === 'productId' || field === 'name' || field === 'unit') {
      updatedItem[field] = String(value);
    }

    // Jika productId berubah, update detail produk
    if (field === 'productId' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        updatedItem.name = product.name;
        updatedItem.purchasePrice = product.purchasePrice;
        updatedItem.unit = product.unit;
      }
    }

    newItems[index] = updatedItem;
    setItems(newItems);
  };


  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + formData.shippingCost;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Tambahkan minimal 1 produk!');
      return;
    }

    if (!formData.supplierId || !formData.warehouseId) {
      toast.error('Pilih supplier dan gudang tujuan!');
      return;
    }

    try {
      const purchaseData = {
        ...formData,
        supplierName: suppliers.find(s => s.id === formData.supplierId)?.name || 'Supplier',
        warehouseName: warehouses.find(w => w.id === formData.warehouseId)?.name || 'Gudang',
        items: items.map(item => ({
          id: item.productId,
          name: item.name,
          purchasePrice: item.purchasePrice,
          quantity: item.quantity,
          unit: item.unit
        })),
        subtotal: calculateSubtotal(),
        total: calculateTotal(),
        status: 'MENUNGGU',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'purchases'), purchaseData);
      toast.success('Pembelian berhasil ditambahkan!');
      router.push('/admin/purchases');
    } catch (err) {
      console.error('Gagal menambahkan pembelian:', err);
      toast.error('Gagal menambahkan pembelian. Silakan coba lagi.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat form pembelian...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Toaster position="top-right" />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black">Tambah Pembelian Baru</h1>
        <p className="text-black">Buat pembelian dari supplier & kelola stok masuk</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informasi Supplier & Gudang */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
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

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Gudang Tujuan *
              </label>
              <select
                required
                value={formData.warehouseId}
                onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              >
                <option value="">Pilih gudang...</option>
                {warehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Metode Pembayaran *
              </label>
              <select
                required
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              >
                <option value="CASH">Tunai</option>
                <option value="TRANSFER">Transfer Bank</option>
                <option value="QRIS">QRIS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Status Pembayaran *
              </label>
              <select
                required
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as 'LUNAS' | 'HUTANG' | 'DP' })}

                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              >
                <option value="LUNAS">Lunas</option>
                <option value="HUTANG">Hutang</option>
                <option value="DP">DP</option>
              </select>
            </div>

            {formData.paymentStatus === 'HUTANG' && (
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Tanggal Jatuh Tempo
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Biaya Pengiriman (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={formData.shippingCost}
                onChange={(e) => setFormData({ ...formData, shippingCost: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Catatan
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
                rows={3}
              />
            </div>
          </div>

          {/* Detail Produk */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-black">Detail Produk</h2>
              <button
                type="button"
                onClick={addItem}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
              >
                + Tambah Produk
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-black">
                Belum ada produk ditambahkan
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-600 mb-1">Produk</label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-black text-sm"
                          required
                        >
                          <option value="">Pilih produk...</option>
                          {products.map(product => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Harga Beli</label>
                        <input
                          type="number"
                          min="0"
                          value={item.purchasePrice}
                          onChange={(e) => updateItem(index, 'purchasePrice', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-black text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-black text-sm"
                          required
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                    {item.productId && (
                      <div className="mt-2 text-xs text-black">
                        Subtotal: Rp{(item.purchasePrice * item.quantity).toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ringkasan */}
            <div className="border-t pt-4">
              <div className="flex justify-between mb-2">
                <span className="text-black">Subtotal:</span>
                <span className="font-medium text-black">Rp{calculateSubtotal().toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-black">Ongkir:</span>
                <span className="font-medium text-black">Rp{formData.shippingCost.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-black">
                <span>Total:</span>
                <span>Rp{calculateTotal().toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/purchases')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Simpan Pembelian
          </button>
        </div>
      </form>
    </div>
  );
}
