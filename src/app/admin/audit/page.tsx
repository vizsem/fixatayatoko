'use client';

import { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  History, 
  ArrowLeftRight, 
  Wallet, 
  Search,
  Filter,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';

// --- TYPES ---
type AuditTab = 'stock' | 'transaction' | 'finance' | 'profit' | 'cost';

interface CostLog {
  id: string;
  productName: string;
  oldCost: number;
  newCost: number;
  changeDate: Timestamp;
  adminId?: string;
  purchaseId?: string;
  quantity?: number; // Qty pembelian yang memicu perubahan
  purchasePrice?: number; // Harga beli baru yang memicu perubahan
}

interface ProfitLog {
  id: string; // Order ID
  date: Timestamp;
  totalSales: number;
  totalCost: number;
  grossProfit: number;
  margin: number;
  items: {
    name: string;
    qty: number;
    sales: number;
    cost: number;
    profit: number;
    discount: number;
  }[];
}

interface InventoryLog {
  id: string;
  productName: string;
  type: 'MASUK' | 'KELUAR' | 'MUTASI';
  amount: number;
  adminId: string;
  date: Timestamp;
  note?: string;
  source?: string;
  prevStock?: number;
  nextStock?: number;
}

interface TransactionLog {
  id: string;
  createdAt: Timestamp;
  customerName: string;
  total: number;
  paymentMethod: string;
  status: string;
  items: any[];
  cashierName?: string; // If available
}

interface CashierShift {
  id: string;
  cashierName: string;
  openedAt: Timestamp;
  closedAt?: Timestamp;
  initialCash: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  status: 'OPEN' | 'CLOSED';
  totalCashSales: number;
  totalNonCashSales: number;
  notes?: string;
}

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<AuditTab>('stock');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter Date State
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01')); // Awal bulan ini
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd')); // Hari ini

  // Data States
  const [stockLogs, setStockLogs] = useState<InventoryLog[]>([]);
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [shifts, setShifts] = useState<CashierShift[]>([]);
  const [profitLogs, setProfitLogs] = useState<ProfitLog[]>([]);
  const [costLogs, setCostLogs] = useState<CostLog[]>([]);
  const [profitSummary, setProfitSummary] = useState({ 
    sales: 0, 
    cost: 0, 
    profit: 0, 
    discount: 0,
    expenses: 0,
    netProfit: 0
  });

  // Fetch Data based on active tab
  useEffect(() => {
    fetchData();
  }, [activeTab, startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(start);
      const endTimestamp = Timestamp.fromDate(end);

      if (activeTab === 'stock') {
        const q = query(
          collection(db, 'inventory_logs'), 
          where('date', '>=', startTimestamp),
          where('date', '<=', endTimestamp),
          orderBy('date', 'desc'), 
          limit(200)
        );
        const snap = await getDocs(q);
        setStockLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryLog)));
      } 
      else if (activeTab === 'transaction') {
        const q = query(
          collection(db, 'orders'), 
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp),
          orderBy('createdAt', 'desc'), 
          limit(200)
        );
        const snap = await getDocs(q);
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as TransactionLog)));
      } 
      else if (activeTab === 'finance') {
        const q = query(
          collection(db, 'cashier_shifts'), 
          where('openedAt', '>=', startTimestamp),
          where('openedAt', '<=', endTimestamp),
          orderBy('openedAt', 'desc'), 
          limit(100)
        );
        const snap = await getDocs(q);
        setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as CashierShift)));
      }
      else if (activeTab === 'profit') {
        // Fetch orders and calculate profit based on DATE RANGE
        const qOrders = query(
          collection(db, 'orders'), 
          where('status', 'in', ['SELESAI', 'SUCCESS']), 
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp),
          orderBy('createdAt', 'desc')
        );
        
        const qExpenses = query(
          collection(db, 'operational_expenses'), 
          where('date', '>=', startTimestamp),
          where('date', '<=', endTimestamp),
          orderBy('date', 'desc')
        );

        const [snapOrders, snapExpenses] = await Promise.all([
          getDocs(qOrders),
          getDocs(qExpenses)
        ]);
        
        // Calculate Expenses
        let totalExpenses = 0;
        snapExpenses.docs.forEach(doc => {
          const data = doc.data();
          totalExpenses += (data.amount || 0);
        });

        // Calculate Sales & COGS
        let totalSales = 0;
        let totalCost = 0;
        let totalDiscount = 0;
        
        const logs: ProfitLog[] = snapOrders.docs.map(d => {
          const data = d.data();
          const items = data.items || [];
          let orderCost = 0;
          let orderDiscount = 0;
          const orderSales = data.total || 0;
          
          const profitItems = items.map((i: any) => {
                // Prioritize 'cost' field from order item, then try to estimate or fallback
                // Note: Ideally 'cost' should be saved in order items during checkout
                let itemCost = (i.cost || 0) * (i.quantity || 1);
                
                // Fallback if cost is 0 (maybe old data or not saved)
                if (itemCost === 0) {
                   // Estimate cost as 80% of price if not available (Standard retail margin estimation)
                   // Better approach: fetch product current cost, but that might have changed. 
                   // For audit, using saved cost is best. If 0, we can flag it or estimate.
                   // Let's try to be safe and set it to 0 if not found, or maybe estimate.
                   // Based on user request "hpp modal tidak muncul", likely it is 0.
                   // We will try to use 'modal' field if 'cost' is missing, some systems use that.
                   // Also check 'purchasePrice' as fallback
                   const unitCost = i.cost || i.modal || i.purchasePrice || 0;
                   itemCost = unitCost * (i.quantity || 1);
                }

                const itemSales = (i.price || 0) * (i.quantity || 1);
            // Assuming i.originalPrice exists, otherwise fallback to price
            const itemOriginalSales = (i.originalPrice || i.price || 0) * (i.quantity || 1);
            const itemDiscount = Math.max(0, itemOriginalSales - itemSales);

            orderCost += itemCost;
            orderDiscount += itemDiscount;
            return {
              name: i.name,
              qty: i.quantity,
              sales: itemSales,
              cost: itemCost,
              profit: itemSales - itemCost,
              discount: itemDiscount
            };
          });

          const grossProfit = orderSales - orderCost;
          const margin = orderSales > 0 ? (grossProfit / orderSales) * 100 : 0;
          
          totalSales += orderSales;
          totalCost += orderCost;
          totalDiscount += orderDiscount;

          return {
            id: d.id,
            date: data.createdAt,
            totalSales: orderSales,
            totalCost: orderCost,
            grossProfit,
            margin,
            items: profitItems
          };
        });

        const grossProfitTotal = totalSales - totalCost;
        const netProfitTotal = grossProfitTotal - totalExpenses;

        setProfitLogs(logs);
        setProfitSummary({ 
          sales: totalSales, 
          cost: totalCost, 
          profit: grossProfitTotal, 
          discount: totalDiscount,
          expenses: totalExpenses,
          netProfit: netProfitTotal
        });
      } else if (activeTab === 'cost') {
        const q = query(
          collection(db, 'product_cost_logs'), 
          where('changeDate', '>=', startTimestamp),
          where('changeDate', '<=', endTimestamp),
          orderBy('changeDate', 'desc'), 
          limit(100)
        );
        const snap = await getDocs(q);
        setCostLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as CostLog)));
      }
    } catch (error) {
      console.error("Error fetching audit data:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    let data: any[] = [];
    let filename = `audit-${activeTab}-${format(new Date(), 'yyyy-MM-dd')}`;

    if (activeTab === 'stock') {
      data = stockLogs.map(l => ({
        Tanggal: l.date?.toDate ? format(l.date.toDate(), 'dd/MM/yyyy HH:mm') : '-',
        Produk: l.productName,
        Tipe: l.type,
        Jumlah: l.amount,
        'Stok Awal': l.prevStock || '-',
        'Stok Akhir': l.nextStock || '-',
        Admin: l.adminId,
        Sumber: l.source,
        Catatan: l.note
      }));
    } else if (activeTab === 'transaction') {
      data = transactions.map(t => ({
        Tanggal: t.createdAt?.toDate ? format(t.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : '-',
        ID: t.id,
        Pelanggan: t.customerName,
        Total: t.total,
        Pembayaran: t.paymentMethod,
        Status: t.status,
      }));
    } else if (activeTab === 'finance') {
      data = shifts.map(s => ({
        'Buka': s.openedAt?.toDate ? format(s.openedAt.toDate(), 'dd/MM/yyyy HH:mm') : '-',
        'Tutup': s.closedAt?.toDate ? format(s.closedAt.toDate(), 'dd/MM/yyyy HH:mm') : '-',
        Kasir: s.cashierName,
        Status: s.status,
        'Modal Awal': s.initialCash,
        'Total Tunai': s.totalCashSales,
        'Diharapkan': s.expectedCash,
        'Aktual': s.actualCash || 0,
        'Selisih': s.difference || 0,
        Catatan: s.notes
      }));
    } else if (activeTab === 'profit') {
      data = profitLogs.map(p => ({
        ID: p.id,
        Tanggal: p.date?.toDate ? format(p.date.toDate(), 'dd/MM/yyyy HH:mm') : '-',
        Penjualan: p.totalSales,
        Modal: p.totalCost,
        Profit: p.grossProfit,
        Margin: p.margin.toFixed(2) + '%',
        Detail: p.items.map(i => `${i.name} (${i.qty}x)`).join(', ')
      }));
    } else if (activeTab === 'cost') {
      data = costLogs.map(c => ({
        Tanggal: c.changeDate?.toDate ? format(c.changeDate.toDate(), 'dd/MM/yyyy HH:mm') : '-',
        Produk: c.productName,
        'Modal Lama': c.oldCost,
        'Modal Baru': c.newCost,
        'Selisih': c.newCost - c.oldCost,
        'Harga Beli': c.purchasePrice || '-',
        'Qty Beli': c.quantity || '-',
        'Sumber': c.purchaseId ? `Pembelian #${c.purchaseId.slice(-4)}` : 'Manual Edit',
        Admin: c.adminId || '-'
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.toUpperCase());
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const filteredData = () => {
    if (activeTab === 'stock') {
      return stockLogs.filter(l => 
        (l.productName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (l.note?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    } else if (activeTab === 'transaction') {
      return transactions.filter(t => 
        (t.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    } else if (activeTab === 'finance') {
      return shifts.filter(s => 
        (s.cashierName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (s.notes?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );
    } else if (activeTab === 'profit') {
      return profitLogs.filter(p => 
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } else if (activeTab === 'cost') {
      return costLogs.filter(c => 
        c.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.adminId || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return [];
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen bg-gray-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <History className="text-blue-600" />
            AUDIT & LOGS
          </h1>
          <p className="text-gray-500 text-sm">Pusat Audit Stok, Transaksi, dan Keuangan</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border shadow-sm">
          {[
            { id: 'stock', label: 'Stok Produk', icon: Package },
            { id: 'transaction', label: 'Transaksi', icon: ArrowLeftRight },
            { id: 'finance', label: 'Keuangan Shift', icon: Wallet },
            { id: 'profit', label: 'Laba Rugi', icon: ArrowUpCircle },
            { id: 'cost', label: 'Harga Beli (HPP)', icon: ArrowDownCircle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AuditTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          {/* FILTER TANGGAL */}
          <div className="flex items-center gap-2">
            <div className="bg-gray-50 border px-3 py-2 rounded-xl flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Dari</span>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm font-bold outline-none"
              />
            </div>
            <div className="bg-gray-50 border px-3 py-2 rounded-xl flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Sampai</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm font-bold outline-none"
              />
            </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={`Cari data ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 rounded-xl text-sm transition-all outline-none border"
            />
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold hover:bg-green-100 border border-green-100 transition-colors"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 animate-pulse">Memuat Data Audit...</div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'stock' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="p-3 font-bold">Waktu</th>
                    <th className="p-3 font-bold">Produk</th>
                    <th className="p-3 font-bold text-center">Tipe</th>
                    <th className="p-3 font-bold text-right">Jumlah</th>
                    <th className="p-3 font-bold text-center">Stok (Lama &rarr; Baru)</th>
                    <th className="p-3 font-bold">Admin/Sumber</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredData().map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                      <td className="p-3 text-gray-500 text-xs">
                        {item.date?.toDate ? format(item.date.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                      </td>
                      <td className="p-3 font-medium text-gray-800">
                        {item.productName}
                        {item.note && <p className="text-[10px] text-gray-400 mt-1 italic">"{item.note}"</p>}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          item.type === 'MASUK' ? 'bg-green-100 text-green-700' : 
                          item.type === 'KELUAR' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-bold ${
                        item.type === 'MASUK' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {item.type === 'MASUK' ? '+' : '-'}{Math.abs(item.amount)}
                      </td>
                      <td className="p-3 text-center text-xs text-gray-500">
                        {item.prevStock ?? '-'} &rarr; <span className="font-bold text-gray-800">{item.nextStock ?? '-'}</span>
                      </td>
                      <td className="p-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1"><User size={12}/> {item.adminId}</div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400"><Filter size={10}/> {item.source}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'transaction' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="p-3 font-bold">Waktu</th>
                    <th className="p-3 font-bold">Order ID</th>
                    <th className="p-3 font-bold">Pelanggan</th>
                    <th className="p-3 font-bold text-right">Total</th>
                    <th className="p-3 font-bold text-center">Metode</th>
                    <th className="p-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredData().map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-gray-500 text-xs">
                        {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'dd MMM yyyy HH:mm') : '-'}
                      </td>
                      <td className="p-3 font-mono text-xs text-blue-600">#{item.id.slice(-6).toUpperCase()}</td>
                      <td className="p-3 font-medium text-gray-800">{item.customerName}</td>
                      <td className="p-3 text-right font-bold text-gray-800">Rp{item.total.toLocaleString()}</td>
                      <td className="p-3 text-center text-xs font-bold uppercase text-gray-500">{item.paymentMethod}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                          item.status === 'SELESAI' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'finance' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="p-3 font-bold">Waktu Buka/Tutup</th>
                    <th className="p-3 font-bold">Kasir</th>
                    <th className="p-3 font-bold text-right">Modal Awal</th>
                    <th className="p-3 font-bold text-right">Penjualan Tunai</th>
                    <th className="p-3 font-bold text-right">Diharapkan</th>
                    <th className="p-3 font-bold text-right">Aktual</th>
                    <th className="p-3 font-bold text-right">Selisih</th>
                    <th className="p-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredData().map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3 text-gray-500 text-xs">
                        <div className="flex items-center gap-1 text-green-600"><Clock size={12}/> {item.openedAt?.toDate ? format(item.openedAt.toDate(), 'HH:mm') : '-'}</div>
                        <div className="flex items-center gap-1 text-red-600"><Clock size={12}/> {item.closedAt?.toDate ? format(item.closedAt.toDate(), 'HH:mm') : '-'}</div>
                        <div className="text-[10px] text-gray-400 mt-1">{item.openedAt?.toDate ? format(item.openedAt.toDate(), 'dd MMM yyyy') : '-'}</div>
                      </td>
                      <td className="p-3 font-medium text-gray-800">
                        {item.cashierName}
                        {item.notes && <div className="text-[10px] text-gray-400 italic mt-1 max-w-[150px] truncate">"{item.notes}"</div>}
                      </td>
                      <td className="p-3 text-right text-gray-500">Rp{item.initialCash.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-green-600">+Rp{item.totalCashSales.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-gray-800">Rp{item.expectedCash.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-blue-600">Rp{(item.actualCash || 0).toLocaleString()}</td>
                      <td className={`p-3 text-right font-black ${(item.difference || 0) < 0 ? 'text-red-500' : ((item.difference || 0) > 0 ? 'text-green-500' : 'text-gray-300')}`}>
                        {(item.difference || 0) > 0 ? '+' : ''}{(item.difference || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          item.status === 'OPEN' ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'profit' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pendapatan Kotor</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Penjualan</span>
                        <span className="font-bold text-gray-800">Rp{profitSummary.sales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">HPP (Modal)</span>
                        <span className="font-bold text-red-600">-Rp{profitSummary.cost.toLocaleString()}</span>
                      </div>
                      <div className="h-px bg-gray-100 my-2"></div>
                      <div className="flex justify-between items-center">
                        <span className="font-black text-gray-700">Laba Kotor</span>
                        <span className="font-black text-green-600">Rp{profitSummary.profit.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pengeluaran & Diskon</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Total Diskon</span>
                        <span className="font-bold text-orange-600">Rp{profitSummary.discount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Beban Operasional</span>
                        <span className="font-bold text-red-600">Rp{profitSummary.expenses.toLocaleString()}</span>
                      </div>
                      <div className="h-px bg-gray-100 my-2"></div>
                      <div className="flex justify-between items-center">
                        <span className="font-black text-gray-700">Total Beban</span>
                        <span className="font-black text-red-700">Rp{(profitSummary.discount + profitSummary.expenses).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-center items-center text-center ${profitSummary.netProfit >= 0 ? 'bg-green-600 text-white border-green-700' : 'bg-red-600 text-white border-red-700'}`}>
                    <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Laba Bersih (Net Profit)</p>
                    <p className="text-3xl font-black">Rp{profitSummary.netProfit.toLocaleString()}</p>
                    <p className="text-[10px] font-bold opacity-70 mt-2 uppercase">
                      {profitSummary.netProfit >= 0 ? 'Keuntungan Bersih' : 'Kerugian Bersih'}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Rincian Transaksi Penjualan</h3>
                  </div>
                  <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                      <th className="p-3 font-bold">Waktu & ID</th>
                      <th className="p-3 font-bold">Detail Item</th>
                      <th className="p-3 font-bold text-right">Penjualan</th>
                      <th className="p-3 font-bold text-right">Diskon</th>
                      <th className="p-3 font-bold text-right">Modal</th>
                      <th className="p-3 font-bold text-right">Profit</th>
                      <th className="p-3 font-bold text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {filteredData().map((item: any) => (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 text-gray-500 text-xs">
                          <div>{item.date?.toDate ? format(item.date.toDate(), 'dd MMM yyyy HH:mm') : '-'}</div>
                          <div className="text-blue-600 font-mono text-[10px]">#{item.id.slice(-6).toUpperCase()}</div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            {item.items.map((i: any, idx: number) => (
                              <div key={idx} className="text-xs flex justify-between gap-4">
                                <span className="font-medium text-gray-700">{i.name} <span className="text-gray-400">x{i.qty}</span></span>
                                <div className="text-right">
                                  <span className="text-gray-500 text-[10px]">
                                    (Jual: {i.sales.toLocaleString()} | Modal: {i.cost.toLocaleString()})
                                  </span>
                                  {i.discount > 0 && (
                                    <div className="text-[10px] text-red-500 font-bold">Hemat: Rp{i.discount.toLocaleString()}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right font-bold text-gray-800">Rp{item.totalSales.toLocaleString()}</td>
                        <td className="p-3 text-right text-orange-600">
                          {item.items.reduce((sum: number, i: any) => sum + i.discount, 0) > 0 
                            ? `Rp${item.items.reduce((sum: number, i: any) => sum + i.discount, 0).toLocaleString()}` 
                            : '-'}
                        </td>
                        <td className="p-3 text-right text-red-600">Rp{item.totalCost.toLocaleString()}</td>
                        <td className={`p-3 text-right font-black ${item.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Rp{item.grossProfit.toLocaleString()}
                        </td>
                        <td className={`p-3 text-right font-bold text-xs ${item.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.margin.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
            
            {activeTab === 'cost' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="p-4">Waktu</th>
                    <th className="p-4">Produk</th>
                    <th className="p-4">Modal Lama</th>
                    <th className="p-4">Modal Baru (Avg)</th>
                    <th className="p-4">Selisih</th>
                    <th className="p-4">Sumber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredData().map((l: any) => (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-xs font-bold text-gray-600">
                        {l.changeDate?.toDate ? format(l.changeDate.toDate(), 'dd/MM/yyyy HH:mm', { locale: id }) : '-'}
                      </td>
                      <td className="p-4 text-sm font-black text-gray-800">{l.productName}</td>
                      <td className="p-4 text-xs font-bold text-gray-500">Rp{l.oldCost.toLocaleString()}</td>
                      <td className="p-4 text-xs font-black text-blue-600">Rp{l.newCost.toLocaleString()}</td>
                      <td className={`p-4 text-xs font-bold ${l.newCost > l.oldCost ? 'text-red-500' : 'text-green-500'}`}>
                        {l.newCost > l.oldCost ? '↑' : '↓'} Rp{Math.abs(l.newCost - l.oldCost).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase">
                          {l.purchaseId ? 'PEMBELIAN' : 'MANUAL'}
                        </span>
                        {l.purchaseId && (
                          <div className="text-[9px] text-gray-400 mt-1">
                            Beli: {l.quantity}x @Rp{l.purchasePrice?.toLocaleString()}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            
            {filteredData().length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm italic">
                Tidak ada data ditemukan.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}