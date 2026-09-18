'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart, Search, Truck, Printer,
  LayoutDashboard, CheckSquare, Square, ChevronRight, ChevronLeft,
  Clock, CheckCircle2, Trash2, RefreshCcw, Calendar
} from 'lucide-react';
import Link from 'next/link';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import { getSalesOrders, updateSalesOrderStatus } from '@/lib/actions/sales.actions';

import { limit } from '@/lib/firebase';
type Order = {
  id: string;
  soNumber: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  customer: { name: string; phone?: string | null } | null;
  items: { quantity: number; unitPrice: number; product: { name: string } | null }[];
  invoice: { status: string; amountPaid: number } | null;
};

export default function AdminOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'SEMUA' | 'DRAFT' | 'CONFIRMED' | 'DELIVERING' | 'COMPLETED'>('SEMUA');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const data = await getSalesOrders({ limit: 200 });
    setOrders(data as Order[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handlePrint = (orderId: string) => {
    router.push(`/admin/orders/print/${orderId}`);
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

  const handleBulkCancel = () => handleBulkUpdate('CANCELLED');

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      (order.soNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'SEMUA' || order.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const currentItems = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = () => {
    const ids = currentItems.map(o => o.id);
    const allSelected = ids.every(id => selectedOrders.includes(id));
    if (allSelected) setSelectedOrders(prev => prev.filter(id => !ids.includes(id)));
    else setSelectedOrders(prev => [...new Set([...prev, ...ids])]);
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DRAFT': return 'bg-slate-50 text-slate-500 border-slate-100';
      case 'CONFIRMED': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'PICKING': case 'PACKING': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'DELIVERING': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'CANCELLED': return 'bg-slate-50 text-slate-400 border-slate-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const statusCounts = {
    CONFIRMED: orders.filter(o => o.status === 'CONFIRMED').length,
    PICKING: orders.filter(o => ['PICKING', 'PACKING'].includes(o.status)).length,
    DELIVERING: orders.filter(o => o.status === 'DELIVERING').length,
    COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 md:p-6 pb-32">
      <Toaster position="top-right" />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Orders Pipeline</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Transaction flow management · PostgreSQL</p>
        </div>
        <button onClick={loadOrders} className="px-4 py-2.5 bg-white border border-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 md:gap-4 mb-6">
        {[
          { label: 'Pending', count: statusCounts.CONFIRMED, color: 'text-rose-600' },
          { label: 'Processing', count: statusCounts.PICKING, color: 'text-amber-600' },
          { label: 'Shipping', count: statusCounts.DELIVERING, color: 'text-blue-600' },
          { label: 'Finished', count: statusCounts.COMPLETED, color: 'text-emerald-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white p-2 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center">
            <span className={`text-lg md:text-2xl font-black ${stat.color}`}>{stat.count}</span>
            <span className="text-[8px] md:text-[9px] font-black uppercase text-slate-400 tracking-wider md:tracking-widest mt-0.5 md:mt-1 text-center select-none">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100 mb-6 flex flex-col lg:flex-row items-center gap-2">
        <div className="relative w-full lg:max-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
          <input
            id="order-search"
            type="text"
            placeholder="Search orders..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold outline-none"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="flex flex-1 gap-1 overflow-x-auto w-full no-scrollbar px-1">
          {['SEMUA', 'DRAFT', 'CONFIRMED', 'DELIVERING', 'COMPLETED'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button onClick={handleSelectAll} className="p-3 bg-slate-900 text-white rounded-xl shadow-md">
          <CheckCircle2 size={16} />
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-16 text-center">
          <ShoppingCart className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 font-bold">Belum ada pesanan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {currentItems.map(order => (
            <div key={order.id} className={`bg-white rounded-[1.5rem] p-4 border transition-all ${selectedOrders.includes(order.id) ? 'border-slate-900 ring-4 ring-slate-50' : 'border-slate-100 hover:border-slate-200'}`}>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <button onClick={() => setSelectedOrders(prev => prev.includes(order.id) ? prev.filter(i => i !== order.id) : [...prev, order.id])} className="text-slate-200">
                  {selectedOrders.includes(order.id) ? <CheckSquare size={20} className="text-slate-900" /> : <Square size={20} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/admin/orders/${order.id}`} className="font-black text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors">
                      {order.soNumber}
                    </Link>
                    <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase border ${getStatusColor(order.status)}`}>{order.status}</span>
                    {order.invoice && (
                      <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black uppercase border ${order.invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                        {order.invoice.status}
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-slate-800 text-sm uppercase truncate">{order.customer?.name || 'Walk-in Customer'}</h3>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(order.createdAt).toLocaleDateString('id-ID')}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="flex items-center gap-1"><LayoutDashboard size={12} /> {order.items.length} item</span>
                  </div>
                </div>

                <div className="flex flex-col md:items-end md:text-right">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">Total</p>
                  <p className="text-lg font-black text-slate-900 leading-tight">Rp {order.totalAmount.toLocaleString('id-ID')}</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-none border-slate-50">
                  <Link href={`/admin/orders/${order.id}`} className="flex-1 md:flex-none px-5 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center">Detail</Link>
                  <button onClick={() => handlePrint(order.id)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-slate-900 transition-all"><Printer size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-3 bg-white border border-slate-100 rounded-xl"><ChevronLeft size={16} /></button>
          <span className="flex items-center px-4 text-xs font-black text-slate-400">PAGE {currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-3 bg-white border border-slate-100 rounded-xl"><ChevronRight size={16} /></button>
        </div>
      )}

      {selectedOrders.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 p-2 rounded-[2.5rem] shadow-2xl flex items-center gap-2 z-[100] animate-in slide-in-from-bottom-10">
          <div className="px-4 py-2 bg-white/10 rounded-full text-[10px] font-black text-white">{selectedOrders.length} SELECTED</div>
          <button onClick={handleBulkCancel} className="px-5 py-2.5 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase">Cancel</button>
          <button onClick={() => handleBulkUpdate('PICKING')} className="px-5 py-2.5 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase">Process</button>
          <button onClick={() => handleBulkUpdate('DELIVERING')} className="px-5 py-2.5 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase">Ship</button>
          <button onClick={() => handleBulkUpdate('COMPLETED')} className="px-5 py-2.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase">Done</button>
        </div>
      )}
    </div>
  );
}
