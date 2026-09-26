'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { collection, db, doc, getDocs, onSnapshot, orderBy, query } from '@/lib/firebase';
import {
  History,
  ArrowLeft,
  ArrowRightLeft,
  PlusCircle,
  MinusCircle,
  Search,
  Calendar,
  Loader2,
  ShoppingCart,
  Package,
  Store,
  FileText,
  User,
  Truck
} from 'lucide-react';



type InventoryLog = {
  id: string;
  productId: string;
  productName: string;
  type: 'MASUK' | 'KELUAR' | 'MUTASI';
  amount: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  adminId: string;
  date: Date;
  source?: 'PURCHASE' | 'ORDER' | 'CASHIER' | 'MANUAL' | 'MARKETPLACE' | 'OPNAME' | 'TRANSFER';
  note?: string;
  referenceId?: string;
  prevStock?: number;
  nextStock?: number;
};

export default function InventoryHistoryPage() {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');

  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = async () => {
    try {
      // 1. Ambil data gudang dari Supabase
      const { data: whRows } = await supabase.from('warehouses').select('id, name');
      const wMap: Record<string, string> = {
        'gudang-utama': 'Gudang Utama',
        'toko-depan': 'Toko Depan',
        'Rumah': 'Rumah',
        'ATAYATOKO': 'ATAYATOKO'
      };
      (whRows || []).forEach((w: any) => {
        wMap[w.id] = w.name || w.id;
      });

      // 2. Ambil data inventory_logs dari Supabase
      const { data: logRows, error } = await supabase
        .from('inventory_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(250);

      if (error) {
        console.error('Error fetching inventory_logs:', error);
        return;
      }

      const logData = (logRows || []).map((row: any) => {
        const raw = row.raw_data || {};
        const fromWhId = row.from_warehouse_id || raw.fromWarehouseId || (row.type === 'KELUAR' ? row.warehouse_id : null);
        const toWhId = row.to_warehouse_id || raw.toWarehouseId || (row.type === 'MASUK' ? row.warehouse_id : null);
        const parsedDate = row.created_at ? new Date(row.created_at) : (raw.createdAt ? new Date(raw.createdAt) : new Date());

        return {
          id: row.id,
          productId: row.product_id || raw.productId || '',
          productName: row.product_name || raw.productName || 'Produk',
          type: (row.type || raw.type || 'MASUK').toUpperCase(),
          amount: Math.abs(Number(row.amount ?? row.quantity ?? raw.amount ?? raw.quantity ?? 0)),
          fromWarehouseId: fromWhId,
          toWarehouseId: toWhId,
          fromWarehouseName: wMap[fromWhId] || fromWhId || 'Gudang Utama',
          toWarehouseName: wMap[toWhId] || toWhId || 'Gudang Utama',
          adminId: row.admin_id || raw.adminId || 'System',
          date: parsedDate,
          source: (row.source || raw.source || 'MANUAL').toUpperCase(),
          note: row.note || raw.note || raw.notes || '',
          referenceId: row.reference_id || raw.referenceId || row.order_id || raw.orderId || '',
          prevStock: row.prev_stock ?? raw.prevStock,
          nextStock: row.next_stock ?? raw.nextStock,
        } as InventoryLog;
      });

      setLogs(logData);
    } catch (err) {
      console.error('Failed to load inventory history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // Auto-refresh setiap 30 detik
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.referenceId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || log.type === filterType;
    const matchesSource = filterSource === 'ALL' || log.source === filterSource;
    return matchesSearch && matchesType && matchesSource;
  });

  const getSourceIcon = (source?: string) => {
    switch (source) {
      case 'PURCHASE': return <Truck size={14} />;
      case 'ORDER': return <Package size={14} />;
      case 'CASHIER': return <Store size={14} />;
      case 'MARKETPLACE': return <ShoppingCart size={14} />;
      case 'MANUAL': return <User size={14} />;
      case 'OPNAME': return <FileText size={14} />;
      case 'TRANSFER': return <ArrowRightLeft size={14} />;
      default: return <History size={14} />;
    }
  };

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'PURCHASE': return 'Pembelian PO';
      case 'ORDER': return 'Pesanan Web';
      case 'CASHIER': return 'Kasir Toko';
      case 'MARKETPLACE': return 'Marketplace';
      case 'MANUAL': return 'Manual';
      case 'OPNAME': return 'Stok Opname';
      case 'TRANSFER': return 'Transfer Gudang';
      default: return source || 'Sistem';
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-black text-white rounded-2xl">
              <History size={22} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-gray-900">Log Mutasi Gudang</h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Riwayat Pemasukan &amp; Pengeluaran Barang</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-xs font-bold text-gray-700 flex items-center gap-1.5 shadow-sm"
              title="Refresh Data"
            >
              <Loader2 size={15} className={refreshing ? 'animate-spin text-blue-600' : 'text-gray-500'} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Cari produk / nota..."
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-black outline-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase px-3 py-2.5 focus:ring-2 focus:ring-black outline-none shadow-sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">Tipe: Semua</option>
              <option value="MASUK">Pemasukan (Masuk)</option>
              <option value="KELUAR">Pengeluaran (Keluar)</option>
              <option value="MUTASI">Mutasi Antar Gudang</option>
            </select>
            <select
              className="bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase px-3 py-2.5 focus:ring-2 focus:ring-black outline-none shadow-sm"
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
            >
              <option value="ALL">Sumber: Semua</option>
              <option value="PURCHASE">Pembelian / PO</option>
              <option value="CASHIER">Kasir Toko</option>
              <option value="MARKETPLACE">Marketplace</option>
              <option value="ORDER">Order Web Online</option>
              <option value="OPNAME">Stok Opname</option>
              <option value="TRANSFER">Transfer Gudang</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
        </div>
 
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] p-20 text-center border border-dashed border-gray-200">
              <History className="mx-auto text-gray-100 mb-4" size={64} />
              <p className="text-xs font-black text-gray-300 uppercase tracking-widest">Belum ada riwayat stok</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${log.type === 'MASUK' ? 'bg-green-50 text-green-600' :
                        log.type === 'KELUAR' ? 'bg-red-50 text-red-600' :
                          'bg-purple-50 text-purple-600'
                      }`}>
                      {log.type === 'MASUK' && <PlusCircle size={20} />}
                      {log.type === 'KELUAR' && <MinusCircle size={20} />}
                      {log.type === 'MUTASI' && <ArrowRightLeft size={20} />}
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{log.productName}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${log.type === 'MASUK' ? 'bg-green-600 text-white' :
                            log.type === 'KELUAR' ? 'bg-red-600 text-white' :
                              'bg-purple-600 text-white'
                          }`}>
                          {log.type}
                        </span>
                        
                        {/* Source Badge */}
                         <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-gray-100 text-gray-600 flex items-center gap-1">
                          {getSourceIcon(log.source)} {getSourceLabel(log.source)}
                        </span>

                        <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 uppercase">
                          <Calendar size={10} /> {log.date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {/* Note / Reference */}
                      {(log.note || log.referenceId) && (
                        <div className="mt-2 text-[10px] text-gray-500 font-medium bg-gray-50 p-2 rounded-lg border border-gray-100">
                           {log.note && <p>Note: {log.note}</p>}
                           {log.referenceId && <p className="font-mono text-gray-400 mt-0.5">Ref: {log.referenceId}</p>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-8 border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="text-left md:text-right">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Keterangan Lokasi</p>
                      {log.type === 'MUTASI' ? (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-900 uppercase">
                          <span>{log.fromWarehouseName}</span>
                          <ArrowLeft size={10} className="rotate-180 text-gray-300" />
                          <span className="text-purple-600">{log.toWarehouseName}</span>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-gray-900 uppercase">
                          {log.type === 'MASUK' ? `Masuk ke ${log.toWarehouseName}` : `Keluar dari ${log.fromWarehouseName}`}
                        </p>
                      )}
                    </div>

                    <div className="text-right min-w-[80px]">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Jumlah</p>
                      <p className={`text-lg font-black tracking-tighter ${log.type === 'MASUK' ? 'text-green-600' :
                          log.type === 'KELUAR' ? 'text-red-600' :
                            'text-gray-900'
                        }`}>
                        {log.type === 'MASUK' ? '+' : log.type === 'KELUAR' ? '-' : ''} {log.amount.toLocaleString()}
                      </p>
                      {(log.prevStock !== undefined && log.nextStock !== undefined) && (
                        <p className="text-[9px] font-bold text-gray-400 mt-1">
                          {log.prevStock} → {log.nextStock}
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
