// src/app/(admin)/orders/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { 
  ArrowLeft,
  Package,
  User,
  Phone,
  CreditCard,
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  AlertTriangle,
  Printer,
  MessageSquare,
  Image as ImageIcon
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
  customerAddress?: string;
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

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);

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

      // Fetch data
      await fetchOrderData();
      await fetchWarehouses();
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, router]);

  const fetchOrderData = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'orders', id));
      if (!docSnap.exists()) {
        setError('Pesanan tidak ditemukan.');
        return;
      }

      const data = docSnap.data();
      setOrder({
        id: docSnap.id,
        customerName: data.customerName || 'Pelanggan',
        customerPhone: data.customerPhone || '',
        customerAddress: data.customerAddress,
        items: data.items || [],
        subtotal: data.subtotal || 0,
        shippingCost: data.shippingCost || 0, // Perbaiki typo
        total: data.total || 0,
        paymentMethod: data.paymentMethod || 'CASH',
        paymentProofUrl: data.paymentProofUrl,
        deliveryMethod: data.deliveryMethod || 'Ambil di Toko',
        transactionType: data.transactionType || 'toko',
        status: data.status || 'MENUNGGU',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
      });
    } catch (err) {
      console.error('Gagal memuat pesanan:', err);
      setError('Gagal memuat detail pesanan.');
    }
  };

  const fetchWarehouses = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'warehouses'));
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || ''
      }));
      setWarehouses(list);
    } catch (err) {
      console.error('Gagal memuat gudang:', err);
    }
  };

  const updateOrderStatus = async (newStatus: Order['status']) => {
    if (!order) return;
    
    try {
      await updateDoc(doc(db, 'orders', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setOrder({ ...order, status: newStatus });
      alert(`Status pesanan diperbarui menjadi: ${newStatus}`);
    } catch (err) {
      console.error('Gagal update status:', err);
      alert('Gagal memperbarui status.');
    }
  };

  const printReceipt = () => {
    if (!order) return;
    
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
          .highlight { background-color: #f0f0f0; padding: 2; }
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
        ${order.customerAddress ? `
          <div class="item">
            <span>Alamat</span>
            <span>${order.customerAddress}</span>
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-black">Memuat detail pesanan...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h2 className="text-xl font-bold text-black mb-2">Pesanan Tidak Ditemukan</h2>
          <p className="text-black mb-6">{error || 'ID pesanan tidak valid.'}</p>
          <Link 
            href="/admin/orders" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar Pesanan
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    MENUNGGU: 'bg-red-100 text-red-800',
    DIPROSES: 'bg-yellow-100 text-yellow-800',
    DIKIRIM: 'bg-blue-100 text-blue-800',
    SELESAI: 'bg-green-100 text-green-800',
    DIBATALKAN: 'bg-gray-100 text-gray-800'
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/admin/orders" 
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft size={18} className="mr-1" />
          Kembali ke Daftar Pesanan
        </Link>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black">Detail Pesanan</h1>
            <p className="text-black">#{order.id}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
            {order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informasi Pesanan */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ringkasan Pesanan */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-black mb-4">Ringkasan Pesanan</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-black">Tanggal</p>
                <p className="font-medium">{new Date(order.createdAt).toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-sm text-black">Jenis Transaksi</p>
                <p className="font-medium capitalize">{order.transactionType}</p>
              </div>
              <div>
                <p className="text-sm text-black">Metode Pembayaran</p>
                <p className="font-medium">{order.paymentMethod}</p>
              </div>
              <div>
                <p className="text-sm text-black">Metode Pengiriman</p>
                <p className="font-medium">{order.deliveryMethod}</p>
              </div>
            </div>
            
            {order.paymentProofUrl && order.paymentMethod !== 'CASH' && (
              <div className="mt-4">
                <p className="text-sm text-black mb-2">Bukti Pembayaran</p>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-w-xs">
                  <img 
                    src={order.paymentProofUrl} 
                    alt="Bukti Pembayaran" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Detail Produk */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-black mb-4">Detail Produk</h2>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div>
                    <h3 className="font-medium text-black">{item.name}</h3>
                    <p className="text-sm text-black">{item.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-black">Rp{(item.price * item.quantity).toLocaleString('id-ID')}</p>
                    <p className="text-sm text-black">{item.quantity} × Rp{item.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-black">
                <span>Subtotal</span>
                <span>Rp{order.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {order.shippingCost > 0 && (
                <div className="flex justify-between text-black mt-1">
                  <span>Ongkir</span>
                  <span>Rp{order.shippingCost.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg text-black mt-2">
                <span>Total</span>
                <span>Rp{order.total.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Aksi & Informasi Pelanggan */}
        <div className="space-y-6">
          {/* Aksi Status */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-black mb-4">Aksi Status</h2>
            
            {order.status === 'MENUNGGU' && (
              <div className="space-y-3">
                <button
                  onClick={() => updateOrderStatus('DIPROSES')}
                  className="w-full bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700"
                >
                  Proses Pesanan
                </button>
                <button
                  onClick={() => updateOrderStatus('DIBATALKAN')}
                  className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                >
                  Batalkan Pesanan
                </button>
              </div>
            )}
            
            {order.status === 'DIPROSES' && (
              <button
                onClick={() => updateOrderStatus('DIKIRIM')}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              >
                Kirim Pesanan
              </button>
            )}
            
            {order.status === 'DIKIRIM' && (
              <button
                onClick={() => updateOrderStatus('SELESAI')}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Tandai Selesai
              </button>
            )}
            
            {order.status === 'SELESAI' && (
              <p className="text-center text-green-600">Pesanan telah selesai ✅</p>
            )}
            
            {order.status === 'DIBATALKAN' && (
              <p className="text-center text-red-600">Pesanan telah dibatalkan ❌</p>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={printReceipt}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700"
              >
                <Printer size={18} />
                Cetak Struk
              </button>
            </div>
          </div>

          {/* Informasi Pelanggan */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-black mb-4">Informasi Pelanggan</h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="text-gray-500" size={20} />
                <span className="text-black">{order.customerName}</span>
              </div>
              
              {order.customerPhone && (
                <div className="flex items-center gap-3">
                  <Phone className="text-gray-500" size={20} />
                  <a 
                    href={`https://wa.me/${order.customerPhone.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black hover:text-emerald-600 flex items-center gap-1"
                  >
                    <MessageSquare size={16} />
                    {order.customerPhone}
                  </a>
                </div>
              )}
              
              {order.customerAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="text-gray-500 mt-0.5" size={20} />
                  <span className="text-black">{order.customerAddress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Riwayat Status */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-lg font-semibold text-black mb-4">Riwayat Status</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  ['MENUNGGU', 'DIPROSES', 'DIKIRIM', 'SELESAI'].includes(order.status) 
                    ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <span className="text-black">Pesanan Dibuat</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {new Date(order.createdAt).toLocaleTimeString('id-ID')}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  ['DIPROSES', 'DIKIRIM', 'SELESAI'].includes(order.status) 
                    ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <span className="text-black">Diproses</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {order.status !== 'MENUNGGU' ? '–' : 'Belum'}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  ['DIKIRIM', 'SELESAI'].includes(order.status) 
                    ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <span className="text-black">Dikirim</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {order.status === 'SELESAI' ? '–' : 'Belum'}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  order.status === 'SELESAI' ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <span className="text-black">Selesai</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {order.status === 'SELESAI' ? '✓' : 'Belum'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}