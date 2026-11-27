'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Search, Truck, Printer, FileText, Receipt,
  LayoutDashboard, CheckSquare, Square, ChevronRight, ChevronLeft,
  Clock, CheckCircle2, Trash2, RefreshCcw, Calendar,
  AlertTriangle, Ban, X, Loader2, Package, PrinterCheck,
  Eye, ExternalLink, MessageSquare, CreditCard, MapPin,
  RotateCcw, Minus, Plus
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import { getSalesOrders, updateSalesOrderStatus, cancelSalesOrder, reorderSalesOrder, deleteDraftOrCancelledOrders } from '@/lib/actions/sales.actions';
import { formatShortTxNo } from '@/lib/ids';

type Order = {
  id: string;
  soNumber: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  customer: { name: string; phone?: string | null } | null;
  items: { productId?: string; quantity: number; unitPrice: number; product: { name: string } | null }[];
  paymentMethod?: string;
  deliveryMethod?: string;
  deliveryAddress?: string | null;
  notes?: string | null;
  invoice: { status: string; amountPaid: number } | null;
};

type OrderTab = 'SEMUA' | 'CONFIRMED' | 'PICKING' | 'DELIVERING' | 'COMPLETED' | 'DRAFT' | 'CANCELLED';

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<OrderTab>('SEMUA');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [printMenuOpen, setPrintMenuOpen] = useState<string | null>(null);
  const [bulkPrintMenuOpen, setBulkPrintMenuOpen] = useState(false);
  const [quickViewOrder, setQuickViewOrder] = useState<Order | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const itemsPerPage = 15;

  // State Modal Pembatalan & Restock
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [restockStock, setRestockStock] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // State Modal Pesan Ulang (Reorder)
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderSource, setReorderSource] = useState<Order | null>(null);
  const [reorderQty, setReorderQty] = useState<Record<string, number>>({});
  const [isReordering, setIsReordering] = useState(false);

  // State Modal Hapus Permanen (khusus DRAFT / CANCELLED)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOrderDeletable = (status: string) => {
    const s = String(status || '').toUpperCase();
    return s === 'DRAFT' || s === 'CANCELLED' || s === 'DIBATALKAN';
  };

  const deletableSelectedIds = selectedOrders.filter(id => {
    const ord = orders.find(o => o.id === id);
    return ord ? isOrderDeletable(ord.status) : false;
  });

  const handleConfirmDelete = async () => {
    if (deleteTargetIds.length === 0 || isDeleting) return;
    setIsDeleting(true);
    const t = notify.admin.loading(`Menghapus ${deleteTargetIds.length} pesanan...`);
    const result = await deleteDraftOrCancelledOrders(deleteTargetIds);
    notify.dismiss(t);
    setIsDeleting(false);
    if (result.success) {
      setIsDeleteModalOpen(false);
      setQuickViewOrder(null);
      setSelectedOrders(prev => prev.filter(id => !deleteTargetIds.includes(id)));
      setDeleteTargetIds([]);
      const skipMsg = result.skipped > 0 ? ` (${result.skipped} pesanan aktif dilewati)` : '';
      notify.admin.success(`${result.deleted} pesanan berhasil dihapus permanen${skipMsg}`);
      loadOrders();
    } else {
      notify.admin.error(result.error || 'Gagal menghapus pesanan');
    }
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const data = await getSalesOrders({ limit: 200 });
    setOrders(data as Order[]);
    setLoading(false);
  }, []);

  const openReorderModal = (order: Order) => {
    setReorderSource(order);
    // Inisialisasi qty dari pesanan asal
    const initQty: Record<string, number> = {};
    order.items.forEach((it, idx) => {
      const key = it.productId || String(idx);
      initQty[key] = it.quantity;
    });
    setReorderQty(initQty);
    setIsReorderModalOpen(true);
  };

  const handleConfirmReorder = async () => {
    if (!reorderSource || isReordering) return;
    setIsReordering(true);
    const t = notify.admin.loading('Membuat pesanan ulang...');
    const result = await reorderSalesOrder({
      sourceOrderId: reorderSource.id,
      quantities: reorderQty,
      notes: `Pesan ulang dari ${reorderSource.soNumber}`,
    });
    notify.dismiss(t);
    setIsReordering(false);
    if (result.success && result.data) {
      setIsReorderModalOpen(false);
      setQuickViewOrder(null);
      notify.admin.success(`Pesanan ulang ${result.data.soNumber} berhasil dibuat!`);
      loadOrders();
      router.push(`/admin/orders/${result.data.id}`);
    } else {
      notify.admin.error(result.error || 'Gagal membuat pesanan ulang');
    }
  };

  const handleBulkPrint = (mode: 'a4' | 'thermal' = 'a4') => {
    if (selectedOrders.length === 0) return;
    const ids = selectedOrders.join(',');
    router.push(`/admin/orders/print/bulk?ids=${ids}&mode=${mode}`);
  };

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Close print menu when clicking outside
  useEffect(() => {
    if (!printMenuOpen) return;
    const handler = () => setPrintMenuOpen(null);
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [printMenuOpen]);

  const handlePrint = (orderId: string, mode: 'a4' | 'thermal' = 'a4') => {
    router.push(`/admin/orders/print/${orderId}?mode=${mode}`);
  };

  const handleBulkUpdate = async (newStatus: string) => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Ubah ${selectedOrders.length} pesanan menjadi ${newStatus}?`)) return;
    const t = notify.admin.loading(`Memperbarui ${selectedOrders.length} pesanan...`);
    let successCount = 0;
    for (const orderId of selectedOrders) {
      const result = await updateSalesOrderStatus(orderId, newStatus);
      if (result.success) successCount++;
    }
    notify.dismiss(t);
    if (successCount > 0) notify.admin.success(`${successCount} pesanan diperbarui`);
    setSelectedOrders([]);
    loadOrders();
  };

  const handleConfirmCancel = async () => {
    if (selectedOrders.length === 0 || isCancelling) return;
    setIsCancelling(true);
    const t = notify.admin.loading(`Membatalkan ${selectedOrders.length} pesanan...`);
    let successCount = 0;
    for (const orderId of selectedOrders) {
      const result = await cancelSalesOrder({
        orderId,
        restockStock,
        reason: cancelReason || 'Dibatalkan massal oleh admin',
      });
      if (result.success) successCount++;
    }
    notify.dismiss(t);
    setIsCancelling(false);
    setIsCancelModalOpen(false);
    setCancelReason('');
    if (successCount > 0) {
      notify.admin.success(
        `${successCount} pesanan dibatalkan${restockStock ? ' & stok telah dikembalikan ke gudang' : ''}`
      );
    }
    setSelectedOrders([]);
    loadOrders();
  };

  const filteredOrders = orders.filter(order => {
    const q = searchTerm.trim().toLowerCase();
    const shortNo = formatShortTxNo(order.soNumber || '').toLowerCase();
    const matchesSearch =
      !q ||
      (order.soNumber || '').toLowerCase().includes(q) ||
      shortNo.includes(q) ||
      (order.customer?.name || '').toLowerCase().includes(q);
    const matchesTab =
      activeTab === 'SEMUA' ||
      (activeTab === 'PICKING' ? ['PICKING', 'PACKING'].includes(order.status) : order.status === activeTab);
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentItems = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const isAllCurrentSelected = currentItems.length > 0 && currentItems.every(o => selectedOrders.includes(o.id));

  const handleSelectAll = () => {
    const ids = currentItems.map(o => o.id);
    if (isAllCurrentSelected) setSelectedOrders(prev => prev.filter(id => !ids.includes(id)));
    else setSelectedOrders(prev => [...new Set([...prev, ...ids])]);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DRAFT': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'CONFIRMED': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PICKING': case 'PACKING': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DELIVERING': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELLED': return 'bg-slate-100 text-slate-500 border-slate-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DRAFT': return 'Draf';
      case 'CONFIRMED': return 'Menunggu';
      case 'PICKING':
      case 'PACKING': return 'Diproses';
      case 'DELIVERING': return 'Dikirim';
      case 'COMPLETED': return 'Selesai';
      case 'CANCELLED': return 'Dibatalkan';
      default: return status;
    }
  };

  const statusCounts = {
    ALL: orders.length,
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
    PICKING: orders.filter(o => ['PICKING', 'PACKING'].includes(o.status)).length,
    DELIVERING: orders.filter(o => o.status === 'DELIVERING').length,
    COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
    DRAFT: orders.filter(o => o.status === 'DRAFT').length,
    CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 pb-28">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Manajemen Pesanan
            </h1>
            <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">
              Pantau alur pesanan, pengemasan, pengiriman, dan pencetakan faktur secara real-time.
            </p>
          </div>
          <button
            onClick={loadOrders}
            disabled={loading}
            className="self-start sm:self-auto px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-semibold text-xs shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Muat Ulang</span>
          </button>
        </div>

        {/* KPI Pipeline Cards (Interaktif & Responsif) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          {[
            { tab: 'CONFIRMED' as OrderTab, label: 'Menunggu', sub: 'Perlu diproses', count: statusCounts.CONFIRMED, color: 'text-rose-600', ring: 'ring-rose-500/20 border-rose-300 bg-rose-50/30' },
            { tab: 'PICKING' as OrderTab, label: 'Diproses', sub: 'Sedang dikemas', count: statusCounts.PICKING, color: 'text-amber-600', ring: 'ring-amber-500/20 border-amber-300 bg-amber-50/30' },
            { tab: 'DELIVERING' as OrderTab, label: 'Dikirim', sub: 'Dalam perjalanan', count: statusCounts.DELIVERING, color: 'text-blue-600', ring: 'ring-blue-500/20 border-blue-300 bg-blue-50/30' },
            { tab: 'COMPLETED' as OrderTab, label: 'Selesai', sub: 'Terkirim & tuntas', count: statusCounts.COMPLETED, color: 'text-emerald-600', ring: 'ring-emerald-500/20 border-emerald-300 bg-emerald-50/30' },
          ].map(stat => {
            const isActive = activeTab === stat.tab;
            return (
              <button
                key={stat.tab}
                type="button"
                onClick={() => {
                  setActiveTab(isActive ? 'SEMUA' : stat.tab);
                  setCurrentPage(1);
                }}
                className={`text-left p-4 rounded-2xl md:rounded-3xl border shadow-xs transition-all hover:shadow-sm ${
                  isActive
                    ? `ring-2 ${stat.ring}`
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600">{stat.label}</span>
                  {isActive && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                      Filter Aktif
                    </span>
                  )}
                </div>
                <p className={`text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight mt-1.5 ${stat.color}`}>
                  {stat.count}
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{stat.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-2.5 rounded-2xl md:rounded-3xl shadow-xs border border-slate-200/80 mb-6 flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              id="order-search"
              type="text"
              placeholder="Cari nomor SO atau nama pelanggan..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-400 transition-all"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-md"
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {([
              { key: 'SEMUA', label: 'Semua', count: statusCounts.ALL },
              { key: 'CONFIRMED', label: 'Menunggu', count: statusCounts.CONFIRMED },
              { key: 'PICKING', label: 'Diproses', count: statusCounts.PICKING },
              { key: 'DELIVERING', label: 'Dikirim', count: statusCounts.DELIVERING },
              { key: 'COMPLETED', label: 'Selesai', count: statusCounts.COMPLETED },
              { key: 'DRAFT', label: 'Draf', count: statusCounts.DRAFT },
              { key: 'CANCELLED', label: 'Dibatalkan', count: statusCounts.CANCELLED },
            ] as { key: OrderTab; label: string; count: number }[]).map(tab => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSelectAll}
            disabled={currentItems.length === 0}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 border ${
              isAllCurrentSelected
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            } disabled:opacity-40`}
            title="Pilih semua pesanan di halaman ini"
          >
            {isAllCurrentSelected ? <CheckSquare size={15} /> : <Square size={15} />}
            <span>{isAllCurrentSelected ? 'Batal Pilih' : 'Pilih Semua'}</span>
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-16 text-center shadow-xs">
            <ShoppingCart className="mx-auto text-slate-300 mb-3" size={44} />
            <p className="text-slate-700 font-bold text-sm">Belum ada pesanan yang sesuai</p>
            <p className="text-slate-400 text-xs mt-1">Ubah kata kunci pencarian atau pilih tab status lainnya.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {currentItems.map(order => {
              const isSelected = selectedOrders.includes(order.id);
              const isPaid = order.invoice?.status === 'PAID';
              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl p-4 border transition-all ${
                    isSelected
                      ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-sm'
                      : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3.5 md:gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(i => i !== order.id) : [...prev, order.id])}
                      className="text-slate-300 hover:text-slate-600 transition-colors pt-0.5 md:pt-0 shrink-0"
                      aria-label={`Pilih pesanan ${order.soNumber}`}
                    >
                      {isSelected ? <CheckSquare size={20} className="text-slate-900" /> : <Square size={20} />}
                    </button>

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setQuickViewOrder(order)}>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setQuickViewOrder(order); }}
                          className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg hover:bg-blue-100 transition-colors"
                          title={`Nomor Lengkap: ${order.soNumber}`}
                        >
                          {formatShortTxNo(order.soNumber)}
                          {formatShortTxNo(order.soNumber)}
                        </button>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-lg font-semibold border ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                        {order.invoice && (
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-lg font-semibold border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isPaid ? 'Lunas' : 'Belum Lunas'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm md:text-[15px] truncate hover:text-blue-600 transition-colors">
                        {order.customer?.name || 'Pelanggan Umum (Walk-in)'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500 mt-1">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          {new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Clock size={13} className="text-slate-400" />
                          {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </span>
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Package size={13} className="text-slate-400" />
                          {order.items.length} jenis barang
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto gap-4 pt-3 md:pt-0 border-t md:border-none border-slate-100">
                      <div className="flex flex-col md:items-end md:text-right cursor-pointer" onClick={() => setQuickViewOrder(order)}>
                        <p className="text-[11px] font-semibold text-slate-500">Total Tagihan</p>
                        <p className="text-base md:text-lg font-extrabold tabular-nums text-slate-900 leading-tight mt-0.5">
                          Rp {order.totalAmount.toLocaleString('id-ID')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuickViewOrder(order)}
                          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                        >
                          <Eye size={14} />
                          <span>Detail</span>
                        </button>
                        {/* Print split-button */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setPrintMenuOpen(printMenuOpen === order.id ? null : order.id)}
                            className="p-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl hover:text-slate-900 hover:bg-slate-100 transition-all"
                            title="Pilih format cetak"
                          >
                            <Printer size={16} />
                          </button>
                          {printMenuOpen === order.id && (
                            <div className="absolute right-0 bottom-full mb-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-44">
                              <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/70">
                                <p className="text-[11px] font-bold text-slate-500">Format Cetak</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => { handlePrint(order.id, 'a4'); setPrintMenuOpen(null); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                              >
                                <FileText size={15} className="text-blue-600 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold">Invoice A4</p>
                                  <p className="text-[11px] text-slate-400">Faktur standar A4</p>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={() => { handlePrint(order.id, 'thermal'); setPrintMenuOpen(null); }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
                              >
                                <Receipt size={15} className="text-slate-500 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold">Struk Thermal</p>
                                  <p className="text-[11px] text-slate-400">Ukuran 58mm / 80mm</p>
                                </div>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
            >
              <ChevronLeft size={15} />
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>
            <span className="px-4 py-2 text-xs font-semibold tabular-nums text-slate-600">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Bar Proporsional & Touch-Friendly */}
      {selectedOrders.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[95vw] animate-in slide-in-from-bottom-6 duration-200">
          <div className="bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl p-1.5 md:p-2 flex items-center gap-1.5 md:gap-2.5 text-white">
            {/* Counter & Clear Selection */}
            <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white/10 rounded-xl text-xs font-semibold text-slate-200 whitespace-nowrap tabular-nums">
              <span>{selectedOrders.length} Dipilih</span>
              <button
                type="button"
                onClick={() => { setSelectedOrders([]); setBulkPrintMenuOpen(false); }}
                className="text-slate-400 hover:text-white p-0.5 rounded-lg transition-colors"
                title="Batal pilih semua"
              >
                <X size={14} />
              </button>
            </div>

            {/* Tombol Cancel / Batal */}
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(true)}
              className="px-3 md:px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
              title="Batalkan pesanan dan kembalikan stok"
            >
              <Ban size={14} />
              <span>Batalkan</span>
            </button>

            {/* Tombol Hapus Permanen (khusus Draf / Dibatalkan) */}
            {deletableSelectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDeleteTargetIds(deletableSelectedIds);
                  setIsDeleteModalOpen(true);
                }}
                className="px-3 md:px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                title={`Hapus permanen ${deletableSelectedIds.length} pesanan berstatus Draf / Dibatalkan`}
              >
                <Trash2 size={14} />
                <span>Hapus ({deletableSelectedIds.length})</span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            {/* Cetak Masal (Click-based agar ramah layar sentuh) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setBulkPrintMenuOpen(prev => !prev)}
                className="px-3 md:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-violet-600 hover:text-white transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                title="Cetak semua pesanan terpilih"
              >
                <Printer size={14} className="text-violet-400" />
                <span className="hidden sm:inline">Cetak</span>
              </button>
              {bulkPrintMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-40 z-50">
                  <button
                    type="button"
                    onClick={() => { setBulkPrintMenuOpen(false); handleBulkPrint('a4'); }}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-violet-600 hover:text-white transition-colors text-left"
                  >
                    <FileText size={13} /> Invoice A4
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkPrintMenuOpen(false); handleBulkPrint('thermal'); }}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors text-left"
                  >
                    <Receipt size={13} /> Struk Thermal
                  </button>
                </div>
              )}
            </div>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            {/* Operational Pipeline Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleBulkUpdate('PICKING')}
                className="px-3 md:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                title="Ubah status ke Diproses (Picking/Packing)"
              >
                <Package size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Proses</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkUpdate('DELIVERING')}
                className="px-3 md:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                title="Ubah status ke Dikirim (Delivering)"
              >
                <Truck size={14} className="text-blue-400" />
                <span className="hidden sm:inline">Kirim</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkUpdate('COMPLETED')}
                className="px-3 md:px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                title="Selesaikan pesanan (Completed)"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="hidden sm:inline">Selesai</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pembatalan & Pengembalian Stok */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Batalkan {selectedOrders.length} Pesanan Terpilih?
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1 mb-5">
              Pesanan yang dibatalkan akan otomatis dikeluarkan dari perhitungan Laporan Keuangan (omzet, HPP, & laba).
            </p>

            {/* Opsi Pengembalian Stok */}
            <div className="mb-4">
              <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl cursor-pointer border border-slate-200/70 transition-colors">
                <input
                  type="checkbox"
                  checked={restockStock}
                  onChange={e => setRestockStock(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
                <div className="text-xs">
                  <p className="font-bold text-slate-800">Kembalikan Stok ke Gudang (Restock)</p>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Jumlah barang yang dipesan akan ditambahkan kembali ke inventaris dan tercatat di kartu stok (inventory log).
                  </p>
                </div>
              </label>
            </div>

            {/* Alasan Pembatalan (Opsional) */}
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Alasan Pembatalan (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: Permintaan pembeli, stok bermasalah, dsb."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Tombol Aksi */}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancelReason('');
                }}
                disabled={isCancelling}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-200 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Membatalkan...</span>
                  </>
                ) : (
                  <span>Konfirmasi Pembatalan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pesan Ulang (Reorder) */}
      {isReorderModalOpen && reorderSource && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-slate-900 tracking-tight">Pesan Ulang</h3>
                <p className="text-xs text-slate-400 font-medium truncate">
                  Berdasarkan {reorderSource.soNumber} · {reorderSource.customer?.name}
                </p>
              </div>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Item list dengan edit qty */}
            <div className="overflow-y-auto flex-1 space-y-2 mb-5 pr-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Atur Jumlah Barang</p>
              {reorderSource.items.map((it, idx) => {
                const key = it.productId || String(idx);
                const qty = reorderQty[key] ?? it.quantity;
                return (
                  <div key={key} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">{it.product?.name || 'Produk'}</p>
                      <p className="text-[11px] font-mono text-slate-400">Rp {it.unitPrice.toLocaleString('id-ID')} / pcs</p>
                    </div>
                    {/* Qty stepper */}
                    <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-200 px-1.5 py-1">
                      <button
                        onClick={() => setReorderQty(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? it.quantity) - 1) }))}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={e => setReorderQty(prev => ({ ...prev, [key]: Math.max(0, Number(e.target.value)) }))}
                        className="w-10 text-center text-xs font-black text-slate-900 outline-none bg-transparent"
                      />
                      <button
                        onClick={() => setReorderQty(prev => ({ ...prev, [key]: (prev[key] ?? it.quantity) + 1 }))}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className="text-right w-20 shrink-0">
                      <p className="text-xs font-black font-mono text-slate-900">
                        Rp {(it.unitPrice * qty).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total & aksi */}
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-500">Estimasi Total</span>
                <span className="text-lg font-black font-mono text-slate-900">
                  Rp {reorderSource.items.reduce((s, it, idx) => {
                    const key = it.productId || String(idx);
                    return s + it.unitPrice * (reorderQty[key] ?? it.quantity);
                  }, 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsReorderModalOpen(false)}
                  disabled={isReordering}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReorder}
                  disabled={isReordering || reorderSource.items.every((it, idx) => (reorderQty[it.productId || String(idx)] ?? it.quantity) === 0)}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-violet-200 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isReordering ? (
                    <><Loader2 size={14} className="animate-spin" /><span>Memproses...</span></>
                  ) : (
                    <><RotateCcw size={14} /><span>Buat Pesanan Baru</span></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Order Modal (Instan 0 detik) */}
      {quickViewOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-900 text-white rounded-2xl">
                  <Receipt size={22} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-mono font-bold text-sm text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg"
                      title={`Nomor Lengkap: ${quickViewOrder.soNumber}`}
                    >
                      {formatShortTxNo(quickViewOrder.soNumber)}
                      {formatShortTxNo(quickViewOrder.soNumber)}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${getStatusColor(quickViewOrder.status)}`}>
                      {getStatusLabel(quickViewOrder.status)}
                    </span>
                    {quickViewOrder.invoice && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold border ${quickViewOrder.invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {quickViewOrder.invoice.status === 'PAID' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>{new Date(quickViewOrder.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                    <span>•</span>
                    <span>{new Date(quickViewOrder.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickViewOrder(null)}
                className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
                title="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6">
              {/* Customer & Payment Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pelanggan */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Pelanggan</p>
                  <p className="font-black text-slate-900 text-sm">{quickViewOrder.customer?.name || 'Walk-in Customer'}</p>
                  {quickViewOrder.customer?.phone ? (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-500">{quickViewOrder.customer.phone}</span>
                      <button
                        onClick={() => {
                          const phone = quickViewOrder.customer?.phone || '';
                          const clean = phone.startsWith('0') ? '62' + phone.slice(1) : phone.replace(/\D/g, '');
                          window.open(`https://wa.me/${clean}?text=${encodeURIComponent(`Halo ${quickViewOrder.customer?.name || ''}, terkait pesanan *${quickViewOrder.soNumber}*...`)}`, '_blank');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors"
                      >
                        <MessageSquare size={12} /> WhatsApp
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">Tidak ada nomor HP</p>
                  )}
                  {quickViewOrder.deliveryAddress && (
                    <p className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500 flex items-start gap-1">
                      <MapPin size={12} className="shrink-0 mt-0.5 text-slate-400" />
                      <span>{quickViewOrder.deliveryAddress}</span>
                    </p>
                  )}
                </div>

                {/* Metode & Pembayaran */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Metode & Status</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">Metode Bayar:</span>
                    <span className="text-xs font-black uppercase text-slate-800">{quickViewOrder.paymentMethod || 'TUNAI'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-slate-500">Pengiriman:</span>
                    <span className="text-xs font-bold text-slate-800">{quickViewOrder.deliveryMethod || 'Ambil di Toko'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                    <span className="text-xs text-slate-500">Status Faktur:</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${quickViewOrder.invoice?.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {quickViewOrder.invoice?.status === 'PAID' ? 'LUNAS' : 'BELUM LUNAS'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                  <span>Daftar Barang ({quickViewOrder.items.length} jenis)</span>
                  <span>Total Qty: {quickViewOrder.items.reduce((s, it) => s + it.quantity, 0)}</span>
                </p>
                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {quickViewOrder.items.map((it, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-bold text-slate-800 text-xs truncate">{it.product?.name || 'Produk'}</p>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Rp {it.unitPrice.toLocaleString('id-ID')} × {it.quantity}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black font-mono text-slate-900 text-xs">
                          Rp {(it.unitPrice * it.quantity).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Catatan jika ada */}
              {quickViewOrder.notes && (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 text-xs text-amber-900">
                  <span className="font-black">Catatan:</span> {quickViewOrder.notes}
                </div>
              )}

              {/* Total Ringkasan */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-lg shadow-slate-200">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Pembayaran</p>
                  <p className="text-xs text-slate-300 mt-0.5">{quickViewOrder.items.length} item produk</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black font-mono text-emerald-400">
                    Rp {quickViewOrder.totalAmount.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handlePrint(quickViewOrder.id, 'a4')}
                  className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <FileText size={14} className="text-blue-500" />
                  <span>Invoice A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrint(quickViewOrder.id, 'thermal')}
                  className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Receipt size={14} className="text-slate-500" />
                  <span>Struk Thermal</span>
                </button>
                {/* Tombol Pesan Ulang — muncul untuk semua status */}
                <button
                  type="button"
                  onClick={() => openReorderModal(quickViewOrder)}
                  className="px-3.5 py-2.5 bg-violet-50 border border-violet-200 hover:bg-violet-100 text-violet-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Pesan Ulang</span>
                </button>
                {/* Tombol Hapus Permanen — khusus Draf / Dibatalkan */}
                {isOrderDeletable(quickViewOrder.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTargetIds([quickViewOrder.id]);
                      setIsDeleteModalOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Hapus Permanen</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setNavigatingId(quickViewOrder.id);
                  router.push(`/admin/orders/${quickViewOrder.id}`);
                }}
                disabled={navigatingId === quickViewOrder.id}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 disabled:opacity-70 shadow-sm"
              >
                {navigatingId === quickViewOrder.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>Membuka...</span>
                  </>
                ) : (
                  <>
                    <span>Buka Halaman Lengkap</span>
                    <ExternalLink size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Permanen (khusus Draf / Dibatalkan) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[130] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Hapus Permanen {deleteTargetIds.length} Pesanan?
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1.5 mb-4">
              Data pesanan berstatus <strong>Draf</strong> atau <strong>Dibatalkan</strong> ini akan dihapus permanen dari daftar dan database. Tindakan ini tidak dapat dibatalkan.
            </p>

            {selectedOrders.length > deleteTargetIds.length && (
              <div className="mb-5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                <strong>{selectedOrders.length - deleteTargetIds.length} pesanan aktif</strong> yang ikut tercentang akan otomatis dilewati demi keamanan stok &amp; laporan.
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTargetIds([]);
                }}
                disabled={isDeleting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-200 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Ya, Hapus Permanen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
