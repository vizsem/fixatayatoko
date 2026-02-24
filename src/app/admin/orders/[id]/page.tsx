'use client';

import { useEffect, useState, use, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';

import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  increment,
  collection,
  addDoc
} from 'firebase/firestore';
import {
  MapPin,
  CreditCard,
  Printer,
  ArrowLeft,
  Truck,
  MessageSquare,
  Receipt
} from 'lucide-react';

import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';

const OrderMap = dynamic(() => import('@/components/OrderMap'), { ssr: false });

type DeliveryLocation = { lat: number; lng: number };
type OrderStatus =
  | 'MENUNGGU'
  | 'DIPROSES'
  | 'DIKIRIM'
  | 'SELESAI'
  | 'DIBATALKAN'
  | 'BELUM_LUNAS'
  | 'PENDING';

type OrderItem = { productId?: string; name: string; quantity: number; price: number };

type Order = {
  id: string;
  orderId?: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  subtotal: number;
  shippingCost: number;
  status: OrderStatus;
  paymentMethod: string;
  deliveryMethod: string;
  deliveryAddress?: string;
  deliveryLocation?: DeliveryLocation;
  createdAt: Timestamp | null;
  notes?: string;
  dueDate?: string;
  userId?: string;
};

type EditableOrderItem = OrderItem & {
  originalQuantity: number;
  selected: boolean;
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>([]);
  const [isConfirmingItems, setIsConfirmingItems] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/profil/login');
        return;
      }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin' && userDoc.data()?.role !== 'cashier') {
        router.push('/profil');
        return;
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!authChecked || !id) return;
    const fetchOrder = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'orders', id));
        if (!docSnap.exists()) {
          setError('Pesanan tidak ditemukan.');
          return;
        }
        const data = { id: docSnap.id, ...docSnap.data() } as Order;
        setOrder(data);
        if (data.items && Array.isArray(data.items)) {
          setEditableItems(
            data.items.map((item) => ({
              ...item,
              originalQuantity: item.quantity,
              selected: true
            }))
          );
        }
      } catch {
        setError('Gagal memuat pesanan.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, authChecked]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order || isUpdating) return;
    setIsUpdating(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      notify.admin.success(`Status: ${newStatus}`, { icon: '🚀' });
    } catch {
      notify.admin.error('Gagal memperbarui status');
    } finally {
      setIsUpdating(false);
    }
  };

  const sendWhatsApp = () => {
    if (!order) return;
    const phone = order.customerPhone.startsWith('0') ? '62' + order.customerPhone.slice(1) : order.customerPhone;
    const message = `Halo ${order.customerName}, pesanan Anda *#${order.id.substring(0, 8)}* sedang dalam status: *${order.status}*.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'MENUNGGU':
      case 'PENDING':
        return 'bg-rose-500 text-white';
      case 'DIPROSES':
        return 'bg-amber-500 text-white';
      case 'DIKIRIM':
        return 'bg-indigo-500 text-white';
      case 'SELESAI':
        return 'bg-emerald-500 text-white';
      default:
        return 'bg-slate-400 text-white';
    }
  };

  const originalSubtotal = useMemo(() => {
    if (!order) return 0;
    if (order.subtotal && order.subtotal > 0) return order.subtotal;
    return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [order]);

  const confirmedItems = useMemo(
    () => editableItems.filter((item) => item.selected && item.quantity > 0),
    [editableItems]
  );

  const newSubtotal = useMemo(
    () => confirmedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [confirmedItems]
  );

  const refundAmount = useMemo(
    () => (originalSubtotal > newSubtotal ? originalSubtotal - newSubtotal : 0),
    [originalSubtotal, newSubtotal]
  );

  const newTotal = useMemo(() => {
    if (!order) return 0;
    return refundAmount > 0 ? Math.max(0, order.total - refundAmount) : order.total;
  }, [order, refundAmount]);

  const handleConfirmItems = async () => {
    if (!order || confirmedItems.length === 0 || isConfirmingItems) return;
    setIsConfirmingItems(true);
    try {
      const orderRef = doc(db, 'orders', order.id);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) {
          throw new Error('Pesanan tidak ditemukan saat konfirmasi');
        }
        const current = snap.data() as Order;
        const currentSubtotal =
          typeof current.subtotal === 'number'
            ? current.subtotal
            : Array.isArray(current.items)
            ? current.items.reduce(
                (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
                0
              )
            : 0;

        const calculatedNewSubtotal = confirmedItems.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const calculatedRefund =
          currentSubtotal > calculatedNewSubtotal ? currentSubtotal - calculatedNewSubtotal : 0;
        const currentTotal = Number(current.total || 0);
        const calculatedNewTotal =
          calculatedRefund > 0 ? Math.max(0, currentTotal - calculatedRefund) : currentTotal;

        tx.update(orderRef, {
          items: confirmedItems.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            productId: item.productId
          })),
          subtotal: calculatedNewSubtotal,
          total: calculatedNewTotal,
          status: 'DIPROSES',
          updatedAt: serverTimestamp()
        });

        if (
          calculatedRefund > 0 &&
          typeof current.userId === 'string' &&
          current.userId &&
          current.userId !== 'guest'
        ) {
          const userRef = doc(db, 'users', current.userId);
          tx.update(userRef, { walletBalance: increment(calculatedRefund) });
        }
      });

      if (
        refundAmount > 0 &&
        order.userId &&
        order.userId !== 'guest'
      ) {
        await addDoc(collection(db, 'wallet_logs'), {
          userId: order.userId,
          orderId: order.id,
          amountChanged: refundAmount,
          type: 'REFUND_STOCK',
          description: 'Pengembalian dana karena stok tidak sesuai',
          createdAt: serverTimestamp()
        });
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              items: confirmedItems.map((item) => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                productId: item.productId
              })),
              subtotal: newSubtotal,
              total: newTotal,
              status: 'DIPROSES'
            }
          : prev
      );
      notify.admin.success('Pesanan dikonfirmasi dan dompet pelanggan diperbarui');
    } catch {
      notify.admin.error('Gagal mengkonfirmasi item pesanan');
    } finally {
      setIsConfirmingItems(false);
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="p-20 text-center font-black uppercase text-slate-400 animate-pulse">
        Syncing...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-20 text-center font-black uppercase text-red-500 tracking-tighter italic">
        {error || 'Data Kosong'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 md:p-8 pb-24 text-black font-sans">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto bg-white shadow-2xl md:rounded-[3rem] overflow-hidden border border-white">
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-3 bg-white rounded-2xl shadow-sm hover:bg-black hover:text-white transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="p-3 bg-black text-white rounded-2xl inline-flex">
                <Receipt size={22} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
                Detail Pesanan
              </h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Kelola status dan cetak invoice
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={sendWhatsApp}
              className="flex items-center gap-2 text-[10px] font-black uppercase bg-green-600 text-white px-5 py-3 rounded-2xl shadow-lg hover:bg-green-700 transition-all"
            >
              <MessageSquare size={14} /> WhatsApp
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 text-[10px] font-black uppercase bg-black text-white px-5 py-3 rounded-2xl shadow-lg hover:bg-slate-800 transition-all"
            >
              <Printer size={14} /> Cetak
            </button>
          </div>
        </div>

        <div className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 border-b-2 border-slate-100 pb-12">
            <div>
              <h1 className="text-6xl font-black tracking-tighter italic mb-2">INVOICE.</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-green-600">
                Ataya Toko Official
              </p>
            </div>
            <div className="text-left md:text-right">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase mb-4 shadow-sm ${getStatusColor(
                  order.status
                )}`}
              >
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                {order.status}
              </div>
              <p className="text-xl font-black tracking-tight text-slate-800">
                #ORD-{order.id.substring(0, 12).toUpperCase()}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase">
                {order.createdAt?.toDate
                  ? new Date(order.createdAt.toDate()).toLocaleDateString('id-ID')
                  : '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Pelanggan
              </h4>
              <div className="p-6 bg-slate-50 rounded-[2rem]">
                <p className="text-2xl font-black uppercase">{order.customerName}</p>
                <p className="text-sm font-bold text-slate-500 mt-1">{order.customerPhone}</p>
                {order.deliveryAddress && (
                  <p className="mt-4 text-xs font-bold text-slate-400 uppercase italic leading-relaxed">
                    <MapPin size={12} className="inline mr-1" /> {order.deliveryAddress}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Metode
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-indigo-50 rounded-3xl text-indigo-700">
                  <Truck size={20} className="mb-2" />
                  <p className="text-[9px] font-black uppercase opacity-60">Kurir</p>
                  <p className="text-xs font-black uppercase">
                    {order.deliveryMethod?.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                    Status Pembayaran
                  </h3>
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                      order.status === 'SELESAI'
                        ? 'bg-green-100 text-green-700'
                        : order.status === 'BELUM_LUNAS'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <CreditCard size={12} /> {order.paymentMethod} •{' '}
                    {order.status === 'BELUM_LUNAS'
                      ? 'BELUM LUNAS'
                      : order.status === 'SELESAI'
                      ? 'LUNAS'
                      : order.status}
                  </div>
                  {order.dueDate && order.status === 'BELUM_LUNAS' && (
                    <p className="mt-2 text-[10px] font-bold text-red-500 uppercase">
                      Jatuh Tempo: {new Date(order.dueDate).toLocaleDateString('id-ID')}
                    </p>
                  )}
                </div>

                {order.status === 'BELUM_LUNAS' && (
                  <button
                    onClick={() => updateStatus('SELESAI')}
                    disabled={isUpdating}
                    className="mt-2 w-full bg-green-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                  >
                    {isUpdating ? 'Memproses...' : 'Tandai Lunas'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {order.deliveryLocation && (
            <div className="mb-12 rounded-[2.5rem] overflow-hidden border-4 border-slate-50 h-[250px] no-print">
              <OrderMap
                lat={order.deliveryLocation.lat}
                lng={order.deliveryLocation.lng}
                address={order.deliveryAddress || ''}
              />
            </div>
          )}

          <div className="mb-12">
            <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full min-w-[600px] md:min-w-0">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 border-b">
                  <th className="px-3 md:px-0 py-3 md:py-4 text-left">Item</th>
                  <th className="px-3 md:px-0 py-3 md:py-4 text-center w-24">Qty</th>
                  <th className="px-3 md:px-0 py-3 md:py-4 text-right">Subtotal</th>
                  {(order.status === 'MENUNGGU' || order.status === 'PENDING') && (
                    <th className="hidden md:table-cell px-3 md:px-0 py-3 md:py-4 text-right w-24">Stok Ada</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {editableItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`${!item.selected ? 'opacity-40 bg-slate-50' : ''} transition-all`}
                  >
                    <td className="px-3 md:px-0 py-3 md:py-4 font-black text-sm uppercase">
                      {item.name}
                      <p className="text-xs font-mono text-slate-400 font-medium normal-case">
                        Rp{item.price.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-3 md:px-0 py-3 md:py-4 text-center">
                      {(order.status === 'MENUNGGU' || order.status === 'PENDING') ? (
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQuantity = parseInt(e.target.value, 10);
                            setEditableItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      quantity: isNaN(newQuantity)
                                        ? 0
                                        : Math.max(0, newQuantity)
                                    }
                                  : it
                              )
                            );
                          }}
                          className="w-16 text-center font-bold bg-slate-100 rounded-lg p-2 text-sm"
                          max={item.originalQuantity}
                        />
                      ) : (
                        <span className="font-bold text-slate-400">x{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-3 md:px-0 py-3 md:py-4 text-right font-black">
                      Rp {(item.quantity * item.price).toLocaleString()}
                    </td>
                    {(order.status === 'MENUNGGU' || order.status === 'PENDING') && (
                      <td className="hidden md:table-cell px-3 md:px-0 py-3 md:py-4 text-right">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) =>
                            setEditableItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, selected: e.target.checked } : it
                              )
                            )
                          }
                          className="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500 shadow-sm"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(order.status === 'MENUNGGU' || order.status === 'PENDING') ? (
                  <>
                    <tr>
                      <td colSpan={4} className="pt-6 px-3 md:px-0">
                        <div className="ml-auto max-w-sm border-t-2 border-slate-100 pt-6 space-y-3">
                          <div className="flex justify-between text-sm font-bold text-slate-500">
                            <span>Subtotal Awal</span>
                            <span>Rp{originalSubtotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold text-slate-500">
                            <span>Ongkos Kirim</span>
                            <span>Rp{order.shippingCost?.toLocaleString() || 0}</span>
                          </div>
                          {refundAmount > 0 && (
                            <div className="flex justify-between text-sm font-bold text-rose-500">
                              <span>Refund ke Dompet</span>
                              <span>- Rp{refundAmount.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-black text-slate-900 pt-3 border-t-2 border-slate-100 border-dashed">
                            <span>Total Baru</span>
                            <span>Rp{newTotal.toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="pt-6 text-right px-3 md:px-0">
                        <button
                          onClick={handleConfirmItems}
                          disabled={isConfirmingItems || confirmedItems.length === 0}
                          className="bg-emerald-600 text-white font-black uppercase text-sm px-8 py-4 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                          {isConfirmingItems ? 'Memproses...' : 'Konfirmasi & Proses Pesanan'}
                        </button>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={3} className="pt-4 px-3 md:px-0">
                      <div className="ml-auto max-w-xs border-t border-slate-100 pt-4 space-y-2">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500">
                          <span>Subtotal Produk</span>
                          <span>
                            Rp
                            {(order.subtotal || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-500">
                          <span>Ongkos Kirim</span>
                          <span>Rp{(order.shippingCost || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100 border-dashed">
                          <span>Total Pembayaran</span>
                          <span>Rp{(order.total || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
            </div>
          </div>

          {(order.status === 'MENUNGGU' || order.status === 'PENDING') && editableItems.length > 0 && (
            <div className="mt-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 no-print">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Konfirmasi Stok & Edit Nota
                  </p>
                  <p className="text-xs font-bold text-slate-700">
                    Hilangkan centang atau kecilkan qty jika stok di gudang tidak tersedia.
                  </p>
                </div>
                <div className="text-right text-xs font-bold text-slate-500">
                  <p>Subtotal awal: Rp{originalSubtotal.toLocaleString()}</p>
                  <p>Subtotal baru: Rp{newSubtotal.toLocaleString()}</p>
                  <p className="text-emerald-600">
                    Refund ke dompet: Rp{refundAmount.toLocaleString()}
                  </p>
                  <p className="text-slate-900">
                    Total baru: Rp{newTotal.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {editableItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) =>
                          setEditableItems((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, selected: e.target.checked } : it
                            )
                          )
                        }
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                      />
                      <div>
                        <p className="text-xs font-black uppercase text-slate-800">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          Rp{item.price.toLocaleString()} / pcs
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={item.originalQuantity}
                        value={item.quantity}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          const safeValue = isNaN(value)
                            ? 0
                            : Math.max(0, Math.min(item.originalQuantity, value));
                          setEditableItems((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, quantity: safeValue } : it
                            )
                          );
                        }}
                        className="w-16 text-right text-xs font-black border rounded-lg px-2 py-1"
                      />
                      <span className="text-[10px] font-bold text-slate-400">
                        dari {item.originalQuantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  disabled={isConfirmingItems || confirmedItems.length === 0}
                  onClick={handleConfirmItems}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {isConfirmingItems ? 'Memproses...' : 'Konfirmasi & Proses Pesanan'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>



      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .shadow-2xl {
            shadow: none !important;
            box-shadow: none !important;
          }
          .border {
            border: none !important;
          }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
