// src/app/(admin)/purchases/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
  ShoppingBag, 
  Plus, 
  Edit, 
  Trash2, 
  Truck,
  User,
  CreditCard,
  Package,
  AlertTriangle,
  TrendingDown
} from 'lucide-react';

type ProductItem = {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
  unit: string;
};

type Purchase = {
  id: string;
  supplierId: string;
  supplierName: string;
  items: ProductItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  paymentStatus: 'LUNAS' | 'HUTANG' | 'DP';
  dueDate?: string;
  notes?: string;
  status: 'MENUNGGU' | 'DITERIMA' | 'DIBATALKAN';
  warehouseId: string;
  warehouseName: string;
  createdAt: string;
};

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

export default function AdminPurchases() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

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
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch pembelian real-time
  useEffect(() => {
    if (loading) return;

    const purchasesRef = collection(db, 'purchases');
    const q = query(purchasesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const purchaseList: Purchase[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        purchaseList.push({
          id: doc.id,
          supplierId: data.supplierId || '',
          supplierName: data.supplierName || 'Supplier',
          items: data.items || [],
          subtotal: data.subtotal || 0,
          shippingCost: data.shippingCost || 0,
          total: data.total || 0,
          paymentMethod: data.paymentMethod || 'CASH',
          paymentStatus: data.paymentStatus || 'LUNAS',
          dueDate: data.dueDate,
          notes: data.notes,
          status: data.status || 'MENUNGGU',
          warehouseId: data.warehouseId || 'gudang-utama',
          warehouseName: data.warehouseName || 'Gudang Utama',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
        });
      });
      setPurchases(purchaseList);
      setFilteredPurchases(purchaseList);
      setError(null);
    }, (err) => {
      console.error('Gagal memuat pembelian:', err);
      setError('Gagal memuat data pembelian.');
    });

    return () => unsubscribe();
  }, [loading]);

  // Filter pembelian
  useEffect(() => {
    let result = purchases;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(purchase =>
        purchase.id.toLowerCase().includes(term) ||
        purchase.supplierName.toLowerCase().includes(term) ||
        purchase.items.some(item => item.name.toLowerCase().includes(term))
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(purchase => purchase.status === statusFilter);
    }
    
    setFilteredPurchases(result);
  }, [searchTerm, statusFilter, purchases]);

  const handleDelete = async (id: string, supplierName: string) => {
    if (!confirm(`Hapus pembelian dari "${supplierName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'purchases', id));
    } catch (err) {
      alert('Gagal menghapus pembelian.');
      console.error(err);
    }
  };

  const updatePurchaseStatus = async (id: string, newStatus: Purchase['status']) => {
    try {
      // Jika status berubah ke DITERIMA, update stok produk
      if (newStatus === 'DITERIMA') {
        const purchaseDoc = await getDoc(doc(db, 'purchases', id));
        const purchase = purchaseDoc.data() as Purchase;
        
        // Update stok setiap produk
        for (const item of purchase.items) {
          const productRef = doc(db, 'products', item.id);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            const stockByWarehouse = productSnap.data().stockByWarehouse || {};
            const newStock = currentStock + item.quantity;
            
            // Update stok per gudang
            const updatedStockByWarehouse = {
              ...stockByWarehouse,
              [purchase.warehouseId]: (stockByWarehouse[purchase.warehouseId] || 0) + item.quantity
            };
            
            await updateDoc(productRef, {
              stock: newStock,
              stockByWarehouse: updatedStockByWarehouse,
              purchasePrice: item.purchasePrice, // Update harga beli terbaru
              updatedAt: serverTimestamp()
            });
          }
        }
      }
      
      // Update status pembelian
      await updateDoc(doc(db, 'purchases', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Gagal update status:', err);
      alert('Gagal memperbarui status pembelian.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MENUNGGU': return 'bg-yellow-100 text-yellow-800';
      case 'DITERIMA': return 'bg-green-100 text-green-800';
      case 'DIBATALKAN': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentColor = (status: string) => {
    switch (status) {
      case 'LUNAS': return 'bg-green-100 text-green-800';
      case 'HUTANG': return 'bg-red-100 text-red-800';
      case 'DP': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data pembelian...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingBag className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Manajemen Pembelian</h1>
        </div>
        <p className="text-black">Kelola pembelian dari supplier & update stok otomatis</p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Filter & Pencarian */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Cari pembelian (ID, supplier, produk)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
          />
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-black mb-2">Filter Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
          >
            <option value="all">Semua Status</option>
            <option value="MENUNGGU">Menunggu</option>
            <option value="DITERIMA">Diterima</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <Link
            href="/admin/purchases/add"
            className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Tambah Pembelian
          </Link>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Pembelian</p>
              <p className="text-2xl font-bold mt-1">{filteredPurchases.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <ShoppingBag className="text-blue-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Total Pengeluaran</p>
              <p className="text-2xl font-bold mt-1 text-red-600">
                Rp{filteredPurchases.reduce((sum, p) => sum + p.total, 0).toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-full">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Hutang Belum Lunas</p>
              <p className="text-2xl font-bold mt-1 text-orange-600">
                Rp{filteredPurchases
                  .filter(p => p.paymentStatus === 'HUTANG')
                  .reduce((sum, p) => sum + p.total, 0)
                  .toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <CreditCard className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-black">Menunggu Diterima</p>
              <p className="text-2xl font-bold mt-1 text-yellow-600">
                {filteredPurchases.filter(p => p.status === 'MENUNGGU').length}
              </p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Truck className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Pembelian */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pembelian
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Supplier
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pembayaran
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-black">
                    <ShoppingBag className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Tidak ada pembelian ditemukan</p>
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <ShoppingBag className="text-gray-400 mr-3" size={40} />
                        <div>
                          <div className="font-medium text-black">#{purchase.id.substring(0, 8)}</div>
                          <div className="text-sm text-black">
                            {new Date(purchase.createdAt).toLocaleDateString('id-ID')}
                          </div>
                          {purchase.warehouseName && (
                            <div className="text-xs text-black mt-1">
                              <Truck size={12} className="inline mr-1" />
                              {purchase.warehouseName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-black font-medium">{purchase.supplierName}</div>
                      <div className="text-sm text-black">
                        {purchase.items.length} produk
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      <span className="font-medium">Rp{purchase.total.toLocaleString('id-ID')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(purchase.status)}`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentColor(purchase.paymentStatus)}`}>
                        {purchase.paymentStatus}
                      </span>
                      {purchase.dueDate && purchase.paymentStatus === 'HUTANG' && (
                        <div className="text-xs text-black mt-1">
                          Jatuh tempo: {new Date(purchase.dueDate).toLocaleDateString('id-ID')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/purchases/${purchase.id}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Package size={16} />
                          Detail
                        </Link>
                        {purchase.status === 'MENUNGGU' && (
                          <>
                            <button
                              onClick={() => updatePurchaseStatus(purchase.id, 'DITERIMA')}
                              className="text-sm bg-green-600 text-white px-2 py-1 rounded"
                            >
                              Terima
                            </button>
                            <button
                              onClick={() => updatePurchaseStatus(purchase.id, 'DIBATALKAN')}
                              className="text-sm bg-red-600 text-white px-2 py-1 rounded"
                            >
                              Batalkan
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(purchase.id, purchase.supplierName)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catatan Penting */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-black">
            <p className="font-medium">Catatan Sistem:</p>
            <ul className="list-disc list-inside text-sm mt-1 space-y-1">
              <li>Klik <strong>"Terima"</strong> untuk memasukkan stok ke gudang dan update harga beli produk</li>
              <li>Harga beli terbaru dari supplier akan menggantikan harga beli sebelumnya di produk</li>
              <li>Pembelian dengan status <strong>"Diterima"</strong> tidak bisa diubah atau dihapus</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}