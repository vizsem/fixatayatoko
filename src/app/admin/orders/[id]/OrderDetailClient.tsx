'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  CreditCard,
  Printer,
  ArrowLeft,
  Truck,
  MessageSquare,
  Receipt,
  RefreshCcw,
  XCircle,
  FileText
} from 'lucide-react';

import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { addInventoryLog, InventoryLogData } from '@/lib/inventory';
import { FirestoreTimestamp } from '@/lib/types';
import {
  createReturnRequest,
  creditWalletRefund,
  getOrderDetail,
  getProductForOrder,
  updateOrder,
  updateProductForOrder,
} from '@/lib/actions/order-admin.actions';

const OrderMap = dynamic(() => import('@/components/OrderMap'), { ssr: false });

export type DeliveryLocation = { lat: number; lng: number };
export type OrderStatus =
  | 'MENUNGGU'
  | 'DIPROSES'
  | 'DIKIRIM'
  | 'SELESAI'
  | 'DIBATALKAN'
  | 'BELUM_LUNAS'
  | 'PENDING';

export type StoreSettings = {
  name: string;
  address: string;
  phone: string;
  email: string;
  footerMsg?: string;
};

export type OrderItem = {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  unit?: string;
  originalQuantity?: number;
  status?: 'fulfilled' | 'unfulfilled' | 'partial';
  note?: string;
};

export type Order = {
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
  createdAt: FirestoreTimestamp | Date | null;
  notes?: string;
  dueDate?: string;
  userId?: string;
  discount?: number;
  voucher?: number;
  pointsUsed?: number;
  walletUsed?: number;
  channel?: string;
  externalOrderId?: string;
};

export type EditableOrderItem = OrderItem & {
  originalQuantity: number;
  fulfillmentStatus: 'fulfilled' | 'unfulfilled' | 'partial';
  selected: boolean;
};

interface OrderDetailClientProps {
  initialOrder: Order;
  initialSettings?: StoreSettings | null;
  id: string;
}

export default function OrderDetailClient({
  initialOrder,
  initialSettings,
  id,
}: OrderDetailClientProps) {
  const router = useRouter();

  const [order, setOrder] = useState<Order>(initialOrder);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableOrderItem[]>(() => {
    const orderItems = (initialOrder.items ?? []) as OrderItem[];
    if (!Array.isArray(orderItems)) return [];
    return orderItems.map((item) => ({
      ...item,
      originalQuantity: item.originalQuantity || item.quantity,
      quantity: item.status === 'unfulfilled' ? 0 : item.quantity,
      selected: item.status !== 'unfulfilled',
      fulfillmentStatus: (item.status || 'fulfilled') as 'fulfilled' | 'unfulfilled' | 'partial'
    }));
  });

  const [isConfirmingItems, setIsConfirmingItems] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<{ productId: string; name: string; quantity: number; price: number; selected: boolean }[]>(() => {
    if (!initialOrder || !initialOrder.items) return [];
    return initialOrder.items.map(item => ({
      productId: item.productId || '',
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      selected: false
    }));
  });
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({
    name: initialSettings?.name || 'Ataya Toko',
    address: initialSettings?.address || 'Jl. Pandan 98, Semen, Kediri',
    phone: initialSettings?.phone || '0858-5316-1174',
    email: initialSettings?.email || 'atayatoko2@gmail.com',
    footerMsg: initialSettings?.footerMsg || 'Terima kasih telah berbelanja!'
  });

  // Sinkronkan returnItems jika order berubah
  useEffect(() => {
    if (order && order.items) {
      setReturnItems(order.items.map(item => ({
        productId: item.productId || '',
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        selected: false
      })));
    }
  }, [order]);

  const handlePrint = (mode: 'a4' | 'thermal' = 'a4') => {
    if (typeof window !== 'undefined' && order?.id) {
      window.open(`/admin/orders/print/${order.id}?mode=${mode}`, '_blank');
    }
  };

  // Close print dropdown when clicking outside
  useEffect(() => {
    if (!printDropdownOpen) return;
    const handler = () => setPrintDropdownOpen(false);
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [printDropdownOpen]);

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order || isUpdating) return;
    setIsUpdating(true);
    try {
      const updated = await updateOrder(order.id, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      if (!updated.ok) {
        notify.admin.error(updated.error);
        return;
      }
      setOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
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
      const freshOrder = await getOrderDetail(order.id);
      if (!freshOrder.ok || !freshOrder.data.order) {
        throw new Error('Pesanan tidak ditemukan saat konfirmasi');
      }
      const current = freshOrder.data.order as unknown as Order;
      const logsToAdd: InventoryLogData[] = [];

      // --- SYNC STOCK LOGIC ---
      for (const newItem of editableItems) {
        if (!newItem.productId) continue;

        const oldItem = current.items.find(i => i.productId === newItem.productId);
        const oldQty = oldItem ? (Number(oldItem.quantity) || 0) : 0;
        const newQty = newItem.selected && newItem.quantity > 0 ? Number(newItem.quantity) : 0;
        const diff = newQty - oldQty;

        if (diff !== 0) {
          const productResult = await getProductForOrder(newItem.productId);
          const pData = productResult.ok ? productResult.data : null;

          if (pData) {
            const currentStock = Number(pData.stock || pData.Stok || 0);
            const stockByWarehouse = (pData.stockByWarehouse ?? {}) as Record<string, number>;
            const newStockByWarehouse: Record<string, number> = { ...stockByWarehouse };
            
            const targetWarehouseId = String(pData.warehouseId || 'gudang-utama');
            const currentWarehouseStock = stockByWarehouse[targetWarehouseId] || 0;
            const stockChange = -diff;
            
            newStockByWarehouse[targetWarehouseId] = currentWarehouseStock + stockChange;
            
            let cogsDelta = 0;
            if (stockChange < 0) {
              const consumeQty = Math.abs(stockChange);
              const layers: Array<{ qty: number; costPerPcs: number; ts?: any }> = Array.isArray(pData.inventoryLayers) ? pData.inventoryLayers : [];
              const nextLayers: Array<{ qty: number; costPerPcs: number; ts?: any }> = [];
              let remaining = consumeQty;
              for (const layer of layers) {
                if (remaining <= 0) {
                  nextLayers.push(layer);
                  continue;
                }
                const take = Math.min(Number(layer.qty || 0), remaining);
                if (take > 0) {
                  cogsDelta += take * Number(layer.costPerPcs || 0);
                  const left = Number(layer.qty || 0) - take;
                  if (left > 0) nextLayers.push({ ...layer, qty: left });
                  remaining -= take;
                } else {
                  nextLayers.push(layer);
                }
              }
              if (remaining > 0) {
                const fallbackCost = Number(pData.Modal || pData.purchasePrice || 0);
                cogsDelta += remaining * fallbackCost;
              }
              if (cogsDelta !== 0) {
                await updateOrder(order.id, {
                  cogsTotal: ((current as any).cogsTotal || 0) + Math.round(cogsDelta),
                });
              }
              if (nextLayers.length !== layers.length || cogsDelta !== 0) {
                await updateProductForOrder(newItem.productId, {
                  inventoryLayers: nextLayers,
                });
              }
            }

            await updateProductForOrder(newItem.productId, {
              stock: currentStock + stockChange,
              stockByWarehouse: newStockByWarehouse,
            });

            logsToAdd.push({
              productId: newItem.productId!,
              productName: newItem.name,
              type: stockChange > 0 ? 'MASUK' : 'KELUAR',
              amount: Math.abs(stockChange),
              adminId: 'system',
              source: 'ORDER',
              orderId: order.id,
              referenceId: order.id,
              note: `Update pesanan #${order.id}`,
              fromWarehouseId: stockChange < 0 ? targetWarehouseId : undefined,
              toWarehouseId: stockChange > 0 ? targetWarehouseId : undefined,
              prevStock: currentStock,
              nextStock: currentStock + stockChange,
            });
          }
        }
      }

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

      const orderUpdate = await updateOrder(order.id, {
        items: editableItems.map((item) => ({
          name: item.name || 'Produk Tanpa Nama',
          price: Number(item.price) || 0,
          quantity: item.selected && item.quantity > 0 ? Number(item.quantity) : 0,
          productId: item.productId || '',
          originalQuantity: Number(item.originalQuantity) || 0,
          status: item.selected && item.quantity > 0
            ? (item.quantity < item.originalQuantity ? 'partial' : 'fulfilled')
            : 'unfulfilled',
        })),
        subtotal: calculatedNewSubtotal,
        total: calculatedNewTotal,
        status: 'DIPROSES',
        updatedAt: new Date().toISOString(),
      });

      if (!orderUpdate.ok) {
        throw new Error(orderUpdate.error);
      }

      const isRefundablePayment = !['CASH', 'TEMPO', 'COD'].includes((current.paymentMethod || '').toUpperCase());

      if (
        calculatedRefund > 0 &&
        typeof current.userId === 'string' &&
        current.userId &&
        current.userId !== 'guest' &&
        isRefundablePayment
      ) {
        const refund = await creditWalletRefund(current.userId, calculatedRefund, order.id);
        if (!refund.ok) throw new Error(refund.error);
      }

      if (logsToAdd && logsToAdd.length > 0) {
        await Promise.all(logsToAdd.map((log: any) => addInventoryLog(log)));
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              items: editableItems.map((item) => ({
                name: item.name || 'Produk Tanpa Nama',
                price: Number(item.price) || 0,
                quantity: item.selected && item.quantity > 0 ? Number(item.quantity) : 0,
                productId: item.productId || '',
                originalQuantity: Number(item.originalQuantity) || 0,
                status: item.selected && item.quantity > 0
                  ? (item.quantity < item.originalQuantity ? 'partial' : 'fulfilled')
                  : 'unfulfilled',
              })),
              subtotal: newSubtotal,
              total: newTotal,
              status: 'DIPROSES'
            }
          : prev
      );
      notify.admin.success('Pesanan dikonfirmasi dan dompet pelanggan diperbarui');
    } catch (error: unknown) {
      console.error('Error confirming items:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan internal';
      notify.admin.error(`Gagal: ${errorMessage}`);
    } finally {
      setIsConfirmingItems(false);
    }
  };

  const handleCreateReturn = async () => {
    const itemsToReturn = returnItems.filter(i => i.selected && i.quantity > 0);
    if (itemsToReturn.length === 0) return notify.error("Pilih minimal satu barang");
    if (!returnReason) return notify.error("Alasan retur wajib diisi");

    setIsSubmittingReturn(true);
    try {
      const totalValue = itemsToReturn.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const created = await createReturnRequest({
        type: 'SALES_RETURN',
        refId: order?.id,
        customerOrSupplierName: order?.customerName,
        items: itemsToReturn.map(i => ({ productId: i.productId, productName: i.name, quantity: i.quantity, price: i.price })),
        reason: returnReason,
        status: 'PENDING',
        totalValue,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (!created.ok) throw new Error(created.error);

      notify.admin.success("Request retur berhasil dibuat");
      setIsReturnModalOpen(false);
    } catch {
      notify.admin.error("Gagal membuat request retur");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="bg-gray-50 md:p-4 text-black font-sans">
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
              <p className="text-xs text-slate-400">
                Kelola status dan cetak invoice
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={sendWhatsApp}
              className="flex items-center gap-2 text-xs font-semibold bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-emerald-700 transition-all"
            >
              <MessageSquare size={14} /> WhatsApp
            </button>
            <div className="relative">
              <button
                onClick={() => setPrintDropdownOpen(o => !o)}
                className="flex items-center gap-2 text-xs font-semibold bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-800 transition-all"
              >
                <Printer size={14} /> Cetak
              </button>
              {printDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-44">
                  <div className="px-3 py-2 border-b border-slate-50">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Format Cetak</p>
                  </div>
                  <button
                    onClick={() => { handlePrint('a4'); setPrintDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                  >
                    <FileText size={15} className="text-blue-500" />
                    <div>
                      <p className="text-xs font-black">Invoice A4</p>
                      <p className="text-xs text-slate-400 font-normal">Profesional, A4</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { handlePrint('thermal'); setPrintDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
                  >
                    <Receipt size={15} className="text-slate-500" />
                    <div>
                      <p className="text-xs font-black">Struk Thermal</p>
                      <p className="text-xs text-slate-400 font-normal">58mm / 80mm</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
            {order.status === 'SELESAI' && (
              <button
                onClick={() => setIsReturnModalOpen(true)}
                className="flex items-center gap-2 text-xs font-semibold bg-purple-600 text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-purple-700 transition-all"
              >
                <RefreshCcw size={14} /> Retur
              </button>
            )}
          </div>
        </div>

        {isReturnModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Retur Barang</h2>
                  <p className="text-xs text-slate-400">Order #{order.id.slice(-8)}</p>
                </div>
                <button onClick={() => setIsReturnModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all"><XCircle size={24} className="text-slate-300" /></button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-500 px-1">Pilih Barang yang Dikembalikan</p>
                  {returnItems.map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border transition-all ${item.selected ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={item.selected} 
                          onChange={e => {
                            const updated = [...returnItems];
                            updated[idx].selected = e.target.checked;
                            setReturnItems(updated);
                          }}
                          className="w-5 h-5 rounded-lg accent-purple-600"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-black uppercase">{item.name}</p>
                          <p className="text-xs text-slate-400">Rp {item.price.toLocaleString()}</p>
                        </div>
                        {item.selected && (
                          <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-purple-100">
                            <span className="text-xs font-semibold text-slate-400 px-2">Qty</span>
                            <input 
                              type="number" 
                              max={order.items.find(i => i.productId === item.productId)?.quantity || 1}
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const updated = [...returnItems];
                                updated[idx].quantity = Math.max(1, Number(e.target.value));
                                setReturnItems(updated);
                              }}
                              className="w-12 text-center font-black text-xs outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 px-1">Alasan Pengembalian</label>
                  <textarea 
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    placeholder="Contoh: Barang rusak saat diterima..."
                    className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-black outline-none border border-transparent focus:border-purple-500 transition-all h-24 resize-none"
                  />
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="text-right flex-1 px-4">
                  <p className="text-xs font-semibold text-slate-500">Total Nilai</p>
                  <p className="text-lg font-black text-slate-900">Rp {returnItems.filter(i => i.selected).reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString()}</p>
                </div>
                <button 
                  onClick={handleCreateReturn}
                  disabled={isSubmittingReturn}
                  className="bg-purple-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-100 hover:bg-purple-700 active:scale-95 transition-all"
                >
                  {isSubmittingReturn ? 'Mengirim...' : 'Kirim Request'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 border-b-2 border-slate-100 pb-12">
            <div>
              <h1 className="text-6xl font-black tracking-tighter italic mb-2">INVOICE.</h1>
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">
                {storeSettings.name}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                {storeSettings.address}
              </p>
              <p className="text-xs text-slate-500">
                ☎ {storeSettings.phone} &nbsp;|&nbsp; ✉ {storeSettings.email}
              </p>
            </div>
            <div className="text-left md:text-right">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase mb-3 shadow-sm ${getStatusColor(
                  order.status
                )}`}
              >
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                {order.status}
              </div>
              <p className="text-xl font-black tracking-tight text-slate-800">
                #ORD-{order.id.substring(0, 12).toUpperCase()}
              </p>
              {order.externalOrderId && (
                <p className="text-xs font-semibold text-orange-600">
                  {order.channel && `${order.channel} • `}{order.externalOrderId}
                </p>
              )}
              <p className="text-xs font-bold text-slate-400 uppercase">
                {order.createdAt
                  ? (typeof (order.createdAt as any)?.toDate === 'function'
                      ? (order.createdAt as any).toDate()
                      : new Date(order.createdAt as any)
                    ).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                  : '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
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
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Metode
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-indigo-50 rounded-3xl text-indigo-700">
                  <Truck size={20} className="mb-2" />
                  <p className="text-xs font-semibold opacity-70">Kurir</p>
                  <p className="text-xs font-black uppercase">
                    {order.deliveryMethod?.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">
                    Status Pembayaran
                  </h3>
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
                      order.status === 'SELESAI'
                        ? 'bg-green-100 text-green-700'
                        : order.status === 'BELUM_LUNAS'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <CreditCard size={14} />
                    {order.status === 'SELESAI' ? 'LUNAS' : order.status === 'BELUM_LUNAS' ? 'BELUM LUNAS' : 'PENDING'}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-mono uppercase">
                    {order.paymentMethod || 'TUNAI'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Catatan Pesanan
            </h4>
            <div className="p-6 bg-amber-50/50 rounded-3xl border border-amber-100 text-amber-900 text-sm font-medium">
              {order.notes || 'Tidak ada catatan untuk pesanan ini.'}
            </div>
          </div>

          <div className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Ringkasan Pembayaran
              </h4>
              <span className="text-xs font-mono text-slate-400">
                Jatuh Tempo: {order.dueDate ? new Date(order.dueDate).toLocaleDateString('id-ID') : '-'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-3xl">
                <p className="text-xs font-bold text-slate-400 uppercase">Subtotal Produk</p>
                <p className="text-xl font-black mt-1">
                  Rp{order.items.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString()}
                </p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl">
                <p className="text-xs font-bold text-slate-400 uppercase">Biaya Pengiriman</p>
                <p className="text-xl font-black mt-1">
                  Rp{(order.shippingCost || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase">Total Akhir</p>
                <p className="text-2xl font-black mt-1 text-emerald-400">
                  Rp{(order.total || 0).toLocaleString()}
                </p>
                {order.status === 'BELUM_LUNAS' && (
                  <button
                    onClick={() => updateStatus('SELESAI')}
                    disabled={isUpdating}
                    className="mt-2 w-full bg-green-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-green-200"
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
            <div className="md:hidden space-y-3 px-4">
              {editableItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-3xl border shadow-sm ${
                    !item.selected ? 'opacity-50 bg-slate-50 border-slate-100' : 'bg-white border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase text-slate-900 line-clamp-2">{item.name}</p>
                      <p className="text-xs font-mono text-slate-400 font-medium normal-case">
                        Rp{item.price.toLocaleString()}
                        {item.unit && <span className="text-[10px] text-slate-400"> / {item.unit}</span>}
                      </p>
                    </div>
                    <span className="text-xs font-black font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl shrink-0">
                      ×{item.quantity}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Total</span>
                    <span className="text-sm font-black font-mono text-slate-900">
                      Rp{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              <div className="mt-4 p-4 rounded-3xl bg-slate-50 border border-slate-100 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-500 font-medium">
                  <span>Subtotal</span>
                  <span>Rp{order.items.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString()}</span>
                </div>
                {(order.shippingCost || 0) > 0 && (
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Ongkir</span>
                    <span>Rp{(order.shippingCost || 0).toLocaleString()}</span>
                  </div>
                )}
                {(order.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Diskon</span>
                    <span>- Rp{(order.discount || 0).toLocaleString()}</span>
                  </div>
                )}
                {(order.voucher || 0) > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Voucher</span>
                    <span>- Rp{(order.voucher || 0).toLocaleString()}</span>
                  </div>
                )}
                {(order.pointsUsed || 0) > 0 && (
                  <div className="flex justify-between text-violet-600 font-medium">
                    <span>Poin</span>
                    <span>- Rp{(order.pointsUsed || 0).toLocaleString()}</span>
                  </div>
                )}
                {(order.walletUsed || 0) > 0 && (
                  <div className="flex justify-between text-blue-600 font-medium">
                    <span>Dompet</span>
                    <span>- Rp{(order.walletUsed || 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Pembayaran</span>
                  <span>Rp{(order.total || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-slate-100 text-xs font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-4">Produk</th>
                  <th className="pb-4 text-center">Qty</th>
                  <th className="pb-4 text-right">Harga</th>
                  <th className="pb-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {editableItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`group hover:bg-slate-50/50 transition-colors ${
                      !item.selected ? 'opacity-40 bg-slate-50/30' : ''
                    }`}
                  >
                    <td className="py-4">
                      <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                      {item.note && (
                        <p className="text-xs text-amber-600 italic mt-0.5">{item.note}</p>
                      )}
                      {item.originalQuantity && item.originalQuantity !== item.quantity && (
                        <p className="text-xs text-rose-500 font-semibold mt-0.5">
                          Disesuaikan dari {item.originalQuantity} {item.unit || 'pcs'}
                        </p>
                      )}
                    </td>
                    <td className="py-4 text-center font-mono font-bold text-xs text-slate-600">
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td className="py-4 text-right font-mono font-bold text-xs text-slate-600">
                      Rp{item.price.toLocaleString()}
                    </td>
                    <td className="py-4 text-right font-mono font-black text-slate-800 text-sm">
                      Rp{(item.price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {order.items.length > 0 && (
                  <tr>
                    <td colSpan={4} className="pt-6">
                      <div className="bg-slate-50 rounded-2xl p-4 space-y-2 font-mono">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                          <span>Subtotal Produk</span>
                          <span>Rp{order.items.reduce((s, i) => s + (i.price * i.quantity), 0).toLocaleString()}</span>
                        </div>
                        {(order.shippingCost || 0) > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-slate-500">
                            <span>Biaya Pengiriman</span>
                            <span>Rp{(order.shippingCost || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {(order.discount || 0) > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-emerald-600">
                            <span>Diskon</span>
                            <span>- Rp{(order.discount || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {(order.voucher || 0) > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-rose-600">
                            <span>Voucher</span>
                            <span>- Rp{(order.voucher || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {(order.pointsUsed || 0) > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-violet-600">
                            <span>Poin Digunakan</span>
                            <span>- Rp{(order.pointsUsed || 0).toLocaleString()}</span>
                          </div>
                        )}
                        {(order.walletUsed || 0) > 0 && (
                          <div className="flex justify-between text-xs font-semibold text-blue-600">
                            <span>Saldo Dompet</span>
                            <span>- Rp{(order.walletUsed || 0).toLocaleString()}</span>
                          </div>
                        )}
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

          {/* Signature Box – visible only on print */}
          <div className="mt-12 grid grid-cols-2 gap-16 print-only">
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-500 mb-16">Penerima / Customer</p>
              <div className="border-t-2 border-slate-300 pt-2">
                <p className="text-xs text-slate-400">(Tanda Tangan &amp; Nama Jelas)</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-500 mb-16">Hormat Kami / Kasir</p>
              <div className="border-t-2 border-slate-300 pt-2">
                <p className="text-xs text-slate-400">{storeSettings.name}</p>
              </div>
            </div>
          </div>

          {/* Footer message */}
          <div className="mt-8 pt-6 border-t border-dashed border-slate-200 text-center print-only-block">
            <p className="text-xs text-slate-400 italic">{storeSettings.footerMsg || 'Terima kasih telah berbelanja!'}</p>
          </div>
          {(order.status === 'MENUNGGU' || order.status === 'PENDING') && editableItems.length > 0 && (
            <div className="mt-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 no-print">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-slate-400">
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
                        <p className="text-xs text-slate-400">
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
                      <span className="text-xs text-slate-400">
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
                  className="px-6 py-3 rounded-2xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
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
          .print-only {
            display: grid !important;
          }
          .print-only-block {
            display: block !important;
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
