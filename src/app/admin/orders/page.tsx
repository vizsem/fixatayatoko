// src/app/(admin)/orders/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { 
  ShoppingCart, 
  Search, 
  CheckCircle, 
  Truck, 
  MapPin,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';

type Order = {
  id: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  total: number;
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
  deliveryMethod: 'AMBIL_DI_TOKO' | 'KURIR_TOKO' | 'OJOL';
};

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | null>(null);

  // 🔒 Proteksi akses: hanya admin atau cashier
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        router.push('/profil/login');
        return;
      }

      const role = userDoc.data()?.role;
      if (role !== 'admin' && role !== 'cashier') {
        alert('Akses ditolak! Hanya admin atau kasir yang dapat mengakses halaman ini.');
        router.push('/profil');
        return;
      }

      setUserRole(role);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [router]);

  // 📥 Ambil data pesanan
  useEffect(() => {
    if (!authChecked) return;

    const fetchOrders = async () => {
      try {
        const querySnapshot = await getDocs(
          query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
        );

        const ordersList: Order[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            createdAt: data.createdAt || '',
            customerName: data.customerName || '',
            customerPhone: data.customerPhone || '',
            total: typeof data.total === 'number' ? data.total : 0,
            status: data.status || 'MENUNGGU',
            deliveryMethod: data.deliveryMethod || 'AMBIL_DI_TOKO',
          };
        });

        setOrders(ordersList);
        setError(null);
      } catch (err) {
        console.error('Gagal memuat pesanan:', err);
        setError('Gagal memuat data pesanan. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [authChecked]);

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
    switch (method) {
      case 'KURIR_TOKO':
      case 'OJOL':
        return <Truck size={16} className="text-blue-600" />;
      case 'AMBIL_DI_TOKO':
        return <CheckCircle size={16} className="text-green-600" />;
      default:
        return <MapPin size={16} className="text-gray-600" />;
    }
  };

  const getDeliveryLabel = (method: string) => {
    switch (method) {
      case 'AMBIL_DI_TOKO': return 'Ambil di Toko';
      case 'KURIR_TOKO': return 'Kurir Toko';
      case 'OJOL': return 'Ojek Online';
      default: return method;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID');
  };

  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (order.customerPhone && order.customerPhone.includes(searchTerm))
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-center">
            <AlertTriangle className="text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-600 hover:underline"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">Manajemen Pesanan</h1>
        {userRole === 'admin' && (
          <Link 
            href="/admin" 
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Kembali ke Dashboard
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cari pesanan (ID, nama, HP)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-black"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-black">
          Memuat daftar pesanan...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center border border-gray-200">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-black">Tidak ada pesanan ditemukan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Pesanan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-black uppercase tracking-wider">Pengiriman</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <ShoppingCart className="text-gray-400 mr-3" size={32} />
                      <div>
                        <Link 
                          href={`/admin/orders/${order.id}`} 
                          className="text-sm font-medium text-green-600 hover:underline"
                        >
                          #{order.id.substring(0, 8).toUpperCase()}
                        </Link>
                        <div className="text-sm text-black mt-1">
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-black">{order.customerName || '–'}</div>
                    <div className="text-sm text-black">{order.customerPhone || '–'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-black">
                      Rp{(order.total || 0).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getDeliveryIcon(order.deliveryMethod)}
                      <span className="ml-2 text-sm text-black">
                        {getDeliveryLabel(order.deliveryMethod)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}