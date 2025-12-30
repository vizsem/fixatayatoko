// src/app/(admin)/orders/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AlertTriangle, Package, MapPin, Calendar, CreditCard, User } from 'lucide-react';

// Dynamically import OrderMap to avoid SSR issues
import dynamic from 'next/dynamic';
const OrderMap = dynamic(() => import('@/components/OrderMap'), { ssr: false });

type DeliveryLocation = {
  lat: number;
  lng: number;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
  paymentMethod: string;
  deliveryMethod: 'AMBIL_DI_TOKO' | 'KURIR_TOKO' | 'OJOL';
  deliveryAddress?: string;
  deliveryLocation?: DeliveryLocation;
  createdAt: string;
  notes?: string;
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | null>(null);

  // Cek autentikasi dan role (admin atau cashier boleh akses)
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
        alert('Akses ditolak! Hanya admin atau kasir yang dapat melihat detail pesanan.');
        router.push('/profil');
        return;
      }

      setUserRole(role);
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch data pesanan
  useEffect(() => {
    if (!authChecked || !id) return;

    const fetchOrder = async () => {
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Pesanan tidak ditemukan.');
          setLoading(false);
          return;
        }

        const data = docSnap.data();
        setOrder({
          id: docSnap.id,
          customerName: data.customerName || '–',
          customerPhone: data.customerPhone || '–',
          items: data.items || [],
          total: data.total || 0,
          status: data.status || 'DIPROSES',
          paymentMethod: data.paymentMethod || '–',
          deliveryMethod: data.deliveryMethod || 'AMBIL_DI_TOKO',
          deliveryAddress: data.deliveryAddress,
          deliveryLocation: data.deliveryLocation,
          createdAt: data.createdAt || '',
          notes: data.notes || undefined,
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

  const getDeliveryMethodLabel = (method: string) => {
    switch (method) {
      case 'AMBIL_DI_TOKO': return 'Ambil di Toko';
      case 'KURIR_TOKO': return 'Kurir Toko';
      case 'OJOL': return 'Ojek Online';
      default: return method;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DIPROSES': return 'bg-yellow-100 text-yellow-800';
      case 'DIKIRIM': return 'bg-blue-100 text-blue-800';
      case 'SELESAI': return 'bg-green-100 text-green-800';
      case 'DIBATALKAN': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat detail pesanan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-red-600">
          <AlertTriangle className="mx-auto h-12 w-12 mb-3" />
          <p className="text-lg">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-green-600 hover:underline"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return null; // Should not happen if error/loading handled
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Detail Pesanan</h1>
          <p className="text-gray-600">ID: {order.id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {order.status}
        </span>
      </div>

      {/* Info Pelanggan */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 border border-gray-200">
        <h2 className="font-semibold text-black flex items-center gap-2 mb-3">
          <User size={18} />
          Pelanggan
        </h2>
        <p className="text-black">{order.customerName}</p>
        <p className="text-black">{order.customerPhone}</p>
      </div>

      {/* Metode Pengiriman & Pembayaran */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="font-medium text-black flex items-center gap-2 mb-2">
            <MapPin size={16} />
            Pengiriman
          </h3>
          <p className="text-black">{getDeliveryMethodLabel(order.deliveryMethod)}</p>
          {order.deliveryAddress && (
            <p className="text-black mt-1">{order.deliveryAddress}</p>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="font-medium text-black flex items-center gap-2 mb-2">
            <CreditCard size={16} />
            Pembayaran
          </h3>
          <p className="text-black">{order.paymentMethod}</p>
        </div>
      </div>

      {/* Lokasi Pengiriman (Peta) */}
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

      {/* Catatan */}
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
            <Package size={18} />
            Produk ({order.items.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200">
          {order.items.map((item, index) => (
            <div key={index} className="px-4 py-3 flex justify-between">
              <div>
                <p className="font-medium text-black">{item.name}</p>
                <p className="text-sm text-gray-600">{item.quantity} × Rp{item.price.toLocaleString('id-ID')}</p>
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

      {/* Tanggal */}
      <div className="mt-4 text-sm text-gray-600 flex items-center gap-1">
        <Calendar size={14} />
        Dibuat: {new Date(order.createdAt).toLocaleString('id-ID')}
      </div>
    </div>
  );
}