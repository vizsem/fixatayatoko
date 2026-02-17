// src/app/cashier/orders/[id]/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { 
  Package, 
  User, 
  CreditCard, 
  MapPin, 
  Calendar, 
  AlertTriangle,
  Truck,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// Dynamic import OrderMap agar aman untuk SSR
import dynamic from 'next/dynamic';
const OrderMap = dynamic(() => import('@/components/OrderMap'), { ssr: false });

// Tipe data pesanan
type Order = {
  id: string;
  customerName?: string;
  customerPhone?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
  paymentMethod: string;
  deliveryMethod: 'AMBIL_DI_TOKO' | 'KURIR_TOKO' | 'OJOL';
  deliveryAddress?: string;
  deliveryLocation?: {
    lat: number;
    lng: number;
  };
  createdAt: string;
  notes?: string;
};

export default function CashierOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 🔐 Cek autentikasi & role (hanya cashier atau admin)
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
      if (role !== 'cashier' && role !== 'admin') {
        toast.error('Akses ditolak! Hanya kasir atau admin yang dapat melihat halaman ini.');
        router.push('/profil');
        return;
      }

      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [router]);

  // 📥 Ambil data pesanan dari Firestore
  useEffect(() => {
    if (!authChecked) return;

    const fetchOrder = async () => {
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Pesanan tidak ditemukan.');
          return;
        }

        const data = docSnap.data();
        setOrder({
          id: docSnap.id,
          customerName: data.customerName || '',
          customerPhone: data.customerPhone || '',
          items: Array.isArray(data.items) ? data.items : [],
          total: typeof data.total === 'number' ? data.total : 0,
          status: data.status || 'MENUNGGU',
          paymentMethod: data.paymentMethod || 'CASH',
          deliveryMethod: data.deliveryMethod || 'AMBIL_DI_TOKO',
          deliveryAddress: data.deliveryAddress,
          deliveryLocation: data.deliveryLocation,
          createdAt: data.createdAt || '',
          notes: data.notes,
        });
      } catch (err) {
        console.error('Gagal memuat pesanan:', err);
        setError('Terjadi kesalahan saat memuat data pesanan.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, authChecked]);

  // Helper: Tampilkan label metode pengiriman
  const getDeliveryLabel = (method: string) => {
    switch (method) {
      case 'AMBIL_DI_TOKO': return 'Ambil di Toko';
      case 'KURIR_TOKO': return 'Kurir Toko';
      case 'OJOL': return 'Ojek Online';
      default: return method;
    }
  };

  // Helper: Ikon pengiriman
  const getDeliveryIcon = (method: string) => {
    if (method === 'KURIR_TOKO' || method === 'OJOL') {
      return <Truck size={16} className="text-blue-600" />;
    }
    return <CheckCircle size={16} className="text-green-600" />;
  };

  // Render UI
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-black">Memeriksa sesi...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-black">Memuat detail pesanan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-center">
            <AlertTriangle className="text-red-500 mr-2" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
          <button
            onClick={() => router.back()}
            className="mt-3 text-sm text-red-600 hover:underline"
          >
            ← Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-black">Data pesanan tidak tersedia.</div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">Detail Pesanan</h1>
        <p className="text-gray-600">ID: #{order.id}</p>
      </div>

      {/* Status Pesanan */}
      <div className="mb-6">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          order.status === 'SELESAI' ? 'bg-green-100 text-green-800' :
          order.status === 'DIKIRIM' ? 'bg-blue-100 text-blue-800' :
          order.status === 'DIPROSES' ? 'bg-yellow-100 text-yellow-800' :
          order.status === 'DIBATALKAN' ? 'bg-gray-100 text-gray-800' :
          'bg-red-100 text-red-800'
        }`}>
          {order.status}
        </span>
      </div>

      {/* Info Pelanggan */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
        <h2 className="font-semibold text-black flex items-center gap-2 mb-3">
          <User size={18} /> Pelanggan
        </h2>
        <p className="text-black">{order.customerName || '–'}</p>
        <p className="text-black">{order.customerPhone || '–'}</p>
      </div>

      {/* Metode Pembayaran & Pengiriman */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="font-medium text-black flex items-center gap-2 mb-2">
            <CreditCard size={16} /> Pembayaran
          </h3>
          <p className="text-black">{order.paymentMethod}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="font-medium text-black flex items-center gap-2 mb-2">
            <MapPin size={16} /> Pengiriman
          </h3>
          <div className="flex items-center">
            {getDeliveryIcon(order.deliveryMethod)}
            <span className="ml-2 text-black">{getDeliveryLabel(order.deliveryMethod)}</span>
          </div>
          {order.deliveryAddress && (
            <p className="mt-2 text-black text-sm">{order.deliveryAddress}</p>
          )}
        </div>
      </div>

      {/* 🗺️ Lokasi Pengiriman */}
      {order.deliveryLocation && order.deliveryAddress && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-black mb-3">Lokasi Pengiriman</h3>
          <OrderMap
            lat={order.deliveryLocation.lat}
            lng={order.deliveryLocation.lng}
            address={order.deliveryAddress}
          />
        </div>
      )}

      {/* Catatan Pelanggan */}
      {order.notes && (
        <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
          <h3 className="font-medium text-black mb-2">Catatan Pelanggan</h3>
          <p className="text-black">{order.notes}</p>
        </div>
      )}

      {/* Daftar Produk */}
      <div className="bg-white shadow rounded-lg border border-gray-200">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-black flex items-center gap-2">
            <Package size={18} /> Produk ({order.items.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {order.items.map((item, index) => (
            <div key={index} className="px-4 py-3 flex justify-between">
              <div>
                <p className="font-medium text-black">{item.name}</p>
                <p className="text-sm text-gray-600">
                  {item.quantity} × Rp{item.price.toLocaleString('id-ID')}
                </p>
              </div>
              <p className="font-medium text-black">
                Rp{(item.quantity * item.price).toLocaleString('id-ID')}
              </p>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-gray-50 font-bold text-right text-black">
          Total: Rp{order.total.toLocaleString('id-ID')}
        </div>
      </div>

      {/* Tanggal Pembuatan */}
      <div className="mt-4 text-sm text-gray-600 flex items-center gap-1">
        <Calendar size={14} />
        Dibuat: {new Date(order.createdAt).toLocaleString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  );
}
