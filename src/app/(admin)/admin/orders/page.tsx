// src/app/(admin)/orders/page.tsx
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
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  ShoppingCart, 
  Search, 
  Clock, 
  CheckCircle, 
  Truck, 
  Package,
  MessageSquare,
  Printer,
  AlertTriangle,
  User
} from 'lucide-react';

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  paymentProofUrl?: string;
  deliveryMethod: string;
  transactionType: 'toko' | 'online';
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
  createdAt: string;
  updatedAt?: string;
};

export default function AdminOrders() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
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

  // Fetch pesanan real-time
  useEffect(() => {
    if (loading) return;

    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orderList: Order[] = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        orderList.push({
          id: doc.id,
          customerName: data.customerName || 'Pelanggan',
          customerPhone: data.customerPhone || '',
          items: data.items || [],
          subtotal: data.subtotal || 0,
          shippingCost: data.shippingCost || 0,
          total: data.total || 0,
          paymentMethod: data.paymentMethod || 'CASH',
          paymentProofUrl: data.paymentProofUrl,
          deliveryMethod: data.deliveryMethod || 'Ambil di Toko',
          transactionType: data.transactionType || 'toko',
          status: data.status || 'MENUNGGU',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        });
      });
      setOrders(orderList);
      setFilteredOrders(orderList);
      setError(null);
    }, (err) => {
      console.error('Gagal memuat pesanan:', err);
      setError('Gagal memuat data pesanan.');
    });

    return () => unsubscribe();
  }, [loading]);

  // Filter pesanan
  useEffect(() => {
    let result = orders;
    
    // Filter berdasarkan pencarian
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(order =>
        order.id.toLowerCase().includes(term) ||
        order.customerName.toLowerCase().includes(term) ||
        (order.customerPhone && order.customerPhone.includes(term)) ||
        order.items.some(item => item.name.toLowerCase().includes(term))
      );
    }
    
    // Filter berdasarkan status
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }
    
    setFilteredOrders(result);
  }, [searchTerm, statusFilter, orders]);

  // Update status pesanan
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Gagal update status:', err);
      alert('Gagal memperbarui status pesanan.');
    }
  };

  // Cetak struk
  const printReceipt = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isOnline = order.transactionType === 'online';
    const receiptContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk ATAYATOKO</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            width: 80mm; 
            margin: 0; 
            padding: 10px;
            font-size: 12px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .separator { border-top: 1px dashed #000; margin: 8px 0; }
          .item { display: flex; justify-content: space-between; }
          .highlight { background-color: #f0f0f0; padding: 2px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold">ATAYATOKO</div>
          <div>Ecer & Grosir</div>
          <div>Jl. Pandan 98, Semen, Kediri</div>
          <div>0858-5316-1174</div>
          <div class="separator"></div>
          <div class="highlight">
            ${isOnline ? 'PESANAN ONLINE' : 'TRANSAKSI TOKO'}
          </div>
          <div>ID: #${order.id.substring(0, 8)}</div>
          <div>${new Date(order.createdAt).toLocaleString('id-ID')}</div>
          <div class="separator"></div>
        </div>
        
        <div class="item">
          <span>Pelanggan</span>
          <span>${order.customerName}</span>
        </div>
        ${order.customerPhone ? `
          <div class="item">
            <span>HP</span>
            <span>${order.customerPhone}</span>
          </div>
        ` : ''}
        <div class="separator"></div>
        
        ${order.items.map(item => `
          <div class="item">
            <span>${item.name} x${item.quantity}</span>
            <span>Rp${(item.price * item.quantity).toLocaleString('id-ID')}</span>
          </div>
        `).join('')}
        
        <div class="separator"></div>
        <div class="item">
          <span>Subtotal</span>
          <span>Rp${order.subtotal.toLocaleString('id-ID')}</span>
        </div>
        ${order.shippingCost > 0 ? `
          <div class="item">
            <span>Ongkir</span>
            <span>Rp${order.shippingCost.toLocaleString('id-ID')}</span>
          </div>
        ` : ''}
        <div class="item bold">
          <span>TOTAL</span>
          <span>Rp${order.total.toLocaleString('id-ID')}</span>
        </div>
        
        <div class="separator"></div>
        <div class="item">
          <span>Metode Bayar</span>
          <span>${order.paymentMethod}</span>
        </div>
        ${order.paymentMethod === 'CASH' ? `
          <div class="item">
            <span>Status</span>
            <span>LUNAS</span>
          </div>
        ` : order.paymentProofUrl ? `
          <div class="item">
            <span>Bukti Bayar</span>
            <span>✓ Terupload</span>
          </div>
        ` : ''}
        
        <div class="separator"></div>
        <div class="item">
          <span>Pengiriman</span>
          <span>${order.deliveryMethod}</span>
        </div>
        <div class="item">
          <span>Status</span>
          <span>${order.status}</span>
        </div>
        
        <div class="separator"></div>
        <div class="center">
          Terima kasih!<br>
          Lengkap • Hemat • Terpercaya
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MENUNGGU': return 'bg-red-100 text-red-800';
      case 'DIPROSES': return 'bg-yellow-100 text-yellow-800';
      case 'DIKIRIM': return 'bg-blue-100 text-blue-800';
      case 'SELESAI': return 'bg-green-100 text-green-800';
      case 'DIBATALKAN': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeliveryIcon = (method: string) => {
    if (method.includes('Kurir') || method.includes('OJOL')) {
      return <Truck className="text-blue-600" size={16} />;
    }
    return <CheckCircle className="text-green-600" size={16} />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat data pesanan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingCart className="text-black" size={28} />
          <h1 className="text-2xl font-bold text-black">Manajemen Pesanan</h1>
        </div>
        <p className="text-black">Kelola pesanan toko & online Anda</p>
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari pesanan (ID, nama, HP)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-black"
          />
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
            <option value="DIPROSES">Diproses</option>
            <option value="DIKIRIM">Dikirim</option>
            <option value="SELESAI">Selesai</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <div className="text-sm text-black">
            Total: <span className="font-medium">{filteredOrders.length} pesanan</span>
          </div>
        </div>
      </div>

      {/* Tabel Pesanan */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pesanan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Pelanggan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-black">
                    <ShoppingCart className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>Tidak ada pesanan ditemukan</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <ShoppingCart className="text-gray-400 mr-3" size={40} />
                        <div>
                          <div className="font-medium text-black">#{order.id.substring(0, 8)}</div>
                          <div className="text-sm text-black">
                            {new Date(order.createdAt).toLocaleDateString('id-ID')} • {order.transactionType}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-black font-medium">{order.customerName}</div>
                      {order.customerPhone && (
                        <div className="text-sm text-black flex items-center gap-1 mt-1">
                          <User size={14} />
                          {order.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-black">
                      <span className="font-medium">Rp{order.total.toLocaleString('id-ID')}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Package size={16} />
                          Detail
                        </Link>
                        <button
                          onClick={() => printReceipt(order)}
                          className="text-green-600 hover:text-green-800 flex items-center gap-1"
                          title="Cetak Struk"
                        >
                          <Printer size={16} />
                        </button>
                        {order.customerPhone && (
                          <a
                            href={`https://wa.me/${order.customerPhone.replace('+', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-800"
                            title="Chat via WhatsApp"
                          >
                            <MessageSquare size={16} />
                          </a>
                        )}
                      </div>
                      
                      {/* Aksi Status */}
                      <div className="flex items-center gap-1 mt-2">
                        {order.status === 'MENUNGGU' && (
                          <>
                            <button
                              onClick={() => updateOrderStatus(order.id, 'DIPROSES')}
                              className="text-sm bg-yellow-600 text-white px-2 py-1 rounded"
                            >
                              Proses
                            </button>
                            <button
                              onClick={() => updateOrderStatus(order.id, 'DIBATALKAN')}
                              className="text-sm bg-red-600 text-white px-2 py-1 rounded"
                            >
                              Batalkan
                            </button>
                          </>
                        )}
                        {order.status === 'DIPROSES' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'DIKIRIM')}
                            className="text-sm bg-blue-600 text-white px-2 py-1 rounded"
                          >
                            Kirim
                          </button>
                        )}
                        {order.status === 'DIKIRIM' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'SELESAI')}
                            className="text-sm bg-green-600 text-white px-2 py-1 rounded"
                          >
                            Selesai
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Legend */}
      <div className="mt-6 text-sm text-black">
        <p className="font-medium mb-2">Legenda Status:</p>
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>
            Menunggu
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
            Diproses
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            Dikirim
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            Selesai
          </span>
        </div>
      </div>
    </div>
  );
}