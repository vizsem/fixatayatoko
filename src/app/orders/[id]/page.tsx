'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, Package, Clock, CreditCard } from 'lucide-react';
import Link from 'next/link';

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
  customerPhone?: string;
  customerAddress?: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  status: 'MENUNGGU' | 'DIPROSES' | 'DIKIRIM' | 'SELESAI' | 'DIBATALKAN';
  createdAt: string;
};

export default function PublicOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'orders', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({
            id: docSnap.id,
            customerName: data.customerName || 'Pelanggan',
            customerPhone: data.customerPhone,
            customerAddress: data.customerAddress,
            items: data.items || [],
            subtotal: data.subtotal || 0,
            shippingCost: data.shippingCost || 0,
            total: data.total || 0,
            paymentMethod: data.paymentMethod || 'CASH',
            status: data.status || 'MENUNGGU',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          });
        } else {
          setError('Pesanan tidak ditemukan.');
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Gagal memuat pesanan.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat pesanan...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow max-w-md w-full text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-black mb-2">Pesanan Tidak Ditemukan</h2>
          <p className="text-gray-600 mb-6">{error || 'ID pesanan tidak valid.'}</p>
          <Link
            href="/"
            className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    MENUNGGU: 'text-red-600',
    DIPROSES: 'text-yellow-600',
    DIKIRIM: 'text-blue-600',
    SELESAI: 'text-green-600',
    DIBATALKAN: 'text-gray-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-black">Detail Pesanan</h1>
          <p className="text-gray-600">#{order.id.substring(0, 8)}</p>
          <div className={`mt-2 text-sm font-medium ${statusColors[order.status]}`}>
            Status: {order.status}
          </div>
        </div>

        {/* Ringkasan */}
        <div className="space-y-4 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-600">Tanggal</span>
            <span className="text-black">{new Date(order.createdAt).toLocaleDateString('id-ID')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pelanggan</span>
            <span className="text-black">{order.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Metode Bayar</span>
            <span className="text-black">{order.paymentMethod}</span>
          </div>
        </div>

        {/* Produk */}
        <div className="mb-6">
          <h2 className="font-bold text-black mb-3 flex items-center gap-2">
            <Package size={16} />
            Produk
          </h2>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.name} × {item.quantity}</span>
                <span>Rp{(item.price * item.quantity).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="border-t pt-4">
          <div className="flex justify-between font-medium">
            <span>Subtotal</span>
            <span>Rp{order.subtotal.toLocaleString('id-ID')}</span>
          </div>
          {order.shippingCost > 0 && (
            <div className="flex justify-between text-sm mt-1">
              <span>Ongkir</span>
              <span>Rp{order.shippingCost.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold mt-2">
            <span>Total</span>
            <span>Rp{order.total.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t text-center text-sm text-gray-500">
          Terima kasih telah berbelanja di <strong>ATAYATOKO2</strong>!<br />
          Lengkap • Hemat • Terpercaya
        </div>
      </div>
    </div>
  );
}