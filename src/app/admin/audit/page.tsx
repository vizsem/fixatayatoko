'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  collection, query, orderBy, limit, getDocs, where, Timestamp, onSnapshot, getDoc, doc
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { 
  History, ArrowLeftRight, Wallet, Search, Download, AlertCircle, CheckCircle, Clock, User, Package, ArrowUpCircle, ArrowDownCircle, Landmark, ChevronRight, BarChart3, TrendingUp, Info
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import notify from '@/lib/notify';
import { Toaster } from 'react-hot-toast';
import * as Sentry from '@sentry/nextjs';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';

type AuditTab = 'stock' | 'transaction' | 'finance' | 'profit' | 'cost' | 'capital';

export default function AuditPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuditTab>('stock');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [limitCount, setLimitCount] = useState(50);
  
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [profitLogs, setProfitLogs] = useState<any[]>([]);
  const [costLogs, setCostLogs] = useState<any[]>([]);
  const [capitalLogs, setCapitalLogs] = useState<any[]>([]);
  const [profitSummary, setProfitSummary] = useState({ sales: 0, cost: 0, profit: 0, discount: 0, expenses: 0, netProfit: 0 });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
    });
    return () => unsubAuth();
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let unsub: (() => void) | null = null;
    try {
      const start = new Date(startDate); start.setHours(0,0,0,0);
      const end = new Date(endDate); end.setHours(23,59,59,999);
      const startT = Timestamp.fromDate(start);
      const endT = Timestamp.fromDate(end);

      if (activeTab === 'stock') {
        const q = query(collection(db, 'inventory_logs'), where('date', '>=', startT), where('date', '<=', endT), orderBy('date', 'desc'), limit(limitCount));
        unsub = onSnapshot(q, (s) => { setStockLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
      } else if (activeTab === 'transaction') {
        const q = query(collection(db, 'orders'), where('createdAt', '>=', startT), where('createdAt', '<=', endT), orderBy('createdAt', 'desc'), limit(limitCount));
        unsub = onSnapshot(q, (s) => { setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
      } else if (activeTab === 'finance') {
        const q = query(collection(db, 'cashier_shifts'), where('openedAt', '>=', startT), where('openedAt', '<=', endT), orderBy('openedAt', 'desc'), limit(limitCount));
        unsub = onSnapshot(q, (s) => { setShifts(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
      } else if (activeTab === 'profit') {
        const qOrders = query(collection(db, 'orders'), where('status', 'in', ['SELESAI', 'SUCCESS']), where('createdAt', '>=', startT), where('createdAt', '<=', endT));
        const qExp = query(collection(db, 'operational_expenses'), where('date', '>=', startT), where('date', '<=', endT));
        const [oSnap, eSnap] = await Promise.all([getDocs(qOrders), getDocs(qExp)]);
        
        let tS = 0, tC = 0, tD = 0, tE = 0;
        eSnap.docs.forEach(d => tE += (d.data().amount || 0));
        const logs = oSnap.docs.map(d => {
           const data = d.data();
           let oC = 0, oD = 0;
           (data.items || []).forEach((i: any) => {
              oC += (i.cost || i.modal || 0) * (i.quantity || 1);
              oD += Math.max(0, ((i.originalPrice || i.price) - i.price) * i.quantity);
           });
           tS += (data.total || 0); tC += oC; tD += oD;
           return { id: d.id, date: data.createdAt, sales: data.total, cost: oC, profit: (data.total - oC) };
        });
        setProfitLogs(logs);
        setProfitSummary({ sales: tS, cost: tC, profit: (tS - tC), discount: tD, expenses: tE, netProfit: (tS - tC - tE) });
        setLoading(false);
      } else if (activeTab === 'cost') {
        const q = query(collection(db, 'product_cost_logs'), where('changeDate', '>=', startT), where('changeDate', '<=', endT), orderBy('changeDate', 'desc'), limit(limitCount));
        unsub = onSnapshot(q, (s) => { setCostLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
      } else if (activeTab === 'capital') {
        const q = query(collection(db, 'capital_transactions'), where('date', '>=', startT), where('date', '<=', endT), orderBy('date', 'desc'), limit(limitCount));
        unsub = onSnapshot(q, (s) => { setCapitalLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
      }
    } catch (err) {
      Sentry.captureException(err);
      notify.error("Gagal memuat data");
      setLoading(false);
    }
    return unsub;
  }, [activeTab, startDate, endDate, limitCount]);

  useEffect(() => {
    let unsub: any;
    fetchData().then(u => unsub = u);
    return () => unsub && unsub();
  }, [fetchData]);

  const handleExport = () => {
    let data: any[] = [];
    if (activeTab === 'stock') data = stockLogs.map(l => ({ Tanggal: format(l.date.toDate(), 'Pp'), Produk: l.productName, Tipe: l.type, Qty: l.amount, Sisa: l.nextStock, Admin: l.adminId }));
    else if (activeTab === 'transaction') data = transactions.map(t => ({ Tanggal: format(t.createdAt.toDate(), 'Pp'), ID: t.id, Customer: t.customerName, Total: t.total, Status: t.status }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `Audit_${activeTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const tabs = [
    { id: 'stock', label: 'Stock Logs', icon: Package },
    { id: 'transaction', label: 'Orders', icon: ArrowLeftRight },
    { id: 'finance', label: 'Cashier Shifts', icon: Wallet },
    { id: 'capital', label: 'Capital', icon: Landmark },
    { id: 'profit', label: 'Profit & Loss', icon: TrendingUp },
    { id: 'cost', label: 'HPP / Costs', icon: BarChart3 },
  ];

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <Toaster position="top-right" />
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <History className="text-blue-600" size={32} /> Centralized Audit
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Institutional record keeping</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
           <div className="bg-white p-1 rounded-2xl border border-slate-100 flex gap-1 shadow-sm overflow-x-auto no-scrollbar">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all whitespace-nowrap ${activeTab === t.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                   <t.icon size={14}/> {t.label}
                </button>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white p-3 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-4">
        <div className="flex items-center gap-2 w-full lg:w-auto">
           <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input type="text" placeholder="Search entries..." className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
           <div className="flex bg-slate-50 rounded-2xl p-1 gap-1">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black p-2 outline-none" />
              <div className="w-[1px] bg-slate-200 my-2" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black p-2 outline-none" />
           </div>
        </div>
        <div className="flex-1" />
        <button onClick={handleExport} className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all">
           <Download size={14}/> EXPORT ASSET
        </button>
      </div>

      {activeTab === 'profit' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-top-4">
           <Stat label="Gross Sales" val={profitSummary.sales} color="text-slate-900" />
           <Stat label="Total COGS" val={profitSummary.cost} color="text-rose-600" prefix="-" />
           <Stat label="Operational" val={profitSummary.expenses} color="text-amber-600" prefix="-" />
           <div className={`p-6 rounded-[2rem] border ${profitSummary.netProfit >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'} shadow-xl`}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Net Income</p>
              <p className="text-2xl font-black">Rp {profitSummary.netProfit.toLocaleString()}</p>
           </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? <div className="p-8"><TableSkeleton rows={10} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  {activeTab === 'stock' && (
                    <tr>
                      <th className="px-8 py-5">Timestamp</th>
                      <th className="px-8 py-5">Product Name</th>
                      <th className="px-8 py-5">Movement</th>
                      <th className="px-8 py-5">Balance</th>
                      <th className="px-8 py-5 text-right">Executor</th>
                    </tr>
                  )}
                  {activeTab === 'transaction' && (
                    <tr>
                      <th className="px-8 py-5">Created At</th>
                      <th className="px-8 py-5">Order Reference</th>
                      <th className="px-8 py-5">Customer</th>
                      <th className="px-8 py-5">Revenue</th>
                      <th className="px-8 py-5 text-right">Status</th>
                    </tr>
                  )}
                  {/* Additional headers for other tabs can be added here */}
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {activeTab === 'stock' && stockLogs.filter(l => l.productName?.toLowerCase().includes(searchTerm.toLowerCase())).map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-5">
                          <p className="text-[11px] font-black text-slate-800">{format(l.date.toDate(), 'HH:mm')}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{format(l.date.toDate(), 'd MMM yyyy')}</p>
                       </td>
                       <td className="px-8 py-5 font-black text-xs text-slate-800 uppercase max-w-[200px] truncate">{l.productName}</td>
                       <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${l.type === 'MASUK' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                             {l.type === 'MASUK' ? '+' : '-'}{l.amount}
                          </span>
                       </td>
                       <td className="px-8 py-5 text-xs font-black text-slate-500">{l.prevStock} &rarr; <span className="text-slate-900">{l.nextStock}</span></td>
                       <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                             <User size={12}/> <span className="text-[10px] font-black uppercase">{l.adminId?.substring(0,8)}</span>
                          </div>
                       </td>
                    </tr>
                  ))}
                  {/* Additional rows for other tabs */}
               </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, val, color, prefix = '' }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
       <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">{label}</p>
       <p className={`text-2xl font-black ${color}`}>{prefix}Rp {val.toLocaleString()}</p>
    </div>
  );
}