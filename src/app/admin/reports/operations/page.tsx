'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Download, Users, Warehouse, Package, Activity, Clock, AlertTriangle, ShoppingCart, Database, DollarSign, Info, ArrowRight, ShieldCheck } from 'lucide-react';
import notify from '@/lib/notify';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import * as Sentry from '@sentry/nextjs';
import * as XLSX from 'xlsx';

type OperationalMetric = {
  id: string;
  name: string;
  category: string;
  value: number | string;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  description: string;
};

export default function OperationsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [employeesData, setEmployeesData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [warehousesData, setWarehousesData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [ordersData, setOrdersData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (s) => setEmployeesData(s.docs.map(d => d.data())));
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => setUsersData(s.docs.map(d => d.data())));
    const unsubWarehouses = onSnapshot(collection(db, 'warehouses'), (s) => setWarehousesData(s.docs.map(d => d.data())));
    const unsubProducts = onSnapshot(query(collection(db, 'products'), where('isActive', '==', true)), (s) => setProductsData(s.docs.map(d => d.data())));
    const unsubOrders = onSnapshot(collection(db, 'orders'), (s) => setOrdersData(s.docs.map(d => d.data())));
    const unsubInventory = onSnapshot(collection(db, 'inventory_transactions'), (s) => setInventoryData(s.docs.map(d => d.data())));
    const unsubExpenses = onSnapshot(collection(db, 'operational_expenses'), (s) => setExpensesData(s.docs.map(d => d.data())));

    return () => {
      unsubEmployees(); unsubUsers(); unsubWarehouses(); unsubProducts(); unsubOrders(); unsubInventory(); unsubExpenses();
    };
  }, [loading]);

  const [activeUserCutoff, setActiveUserCutoff] = useState(0);

  useEffect(() => {
    setActiveUserCutoff(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }, []);

  const metrics = useMemo(() => {
    if (loading) return [];

    const activeEmployees = employeesData.filter(e => String(e.status).toUpperCase() === 'AKTIF').length;
    const totalPayroll = employeesData.filter(e => String(e.status).toUpperCase() === 'AKTIF').reduce((s, e) => s + Number(e.manualSalary || 0), 0);
    const activeUsers = usersData.filter(u => u.lastActive && new Date(u.lastActive).getTime() > activeUserCutoff).length;
    const fullWh = warehousesData.filter(wh => (wh.usedCapacity / wh.capacity) >= 0.9).length;
    const outOfStock = productsData.filter(p => p.stock === 0).length;
    const lowStock = productsData.filter(p => p.stock > 0 && p.stock <= 10).length;
    const pendingOrders = ordersData.filter(o => o.status === 'MENUNGGU').length;

    const m: OperationalMetric[] = [
      { id: 'emp-1', name: 'Active Personnel', category: 'Karyawan', value: activeEmployees, unit: 'pax', status: activeEmployees > 0 ? 'good' : 'warning', description: 'Currently active workforce' },
      { id: 'emp-2', name: 'Payroll Exposure', category: 'Karyawan', value: totalPayroll, unit: 'Rp', status: 'good', description: 'Monthly salary accumulation' },
      { id: 'user-1', name: 'User Retention', category: 'Pengguna', value: activeUsers, unit: 'users', status: activeUsers > 0 ? 'good' : 'warning', description: 'Active in last 7 days' },
      { id: 'wh-1', name: 'Capacity Alert', category: 'Gudang', value: fullWh, unit: 'units', status: fullWh > 0 ? 'critical' : 'good', description: 'Warehouses >90% full' },
      { id: 'inv-1', name: 'Critical Stock', category: 'Inventory', value: outOfStock, unit: 'SKUs', status: outOfStock > 0 ? 'critical' : 'good', description: 'Out of stock products' },
      { id: 'inv-2', name: 'Low Stock SKU', category: 'Inventory', value: lowStock, unit: 'SKUs', status: lowStock > 5 ? 'critical' : 'warning', description: 'Stock below 10 units' },
      { id: 'ord-1', name: 'Pending Pipeline', category: 'Pesanan', value: pendingOrders, unit: 'orders', status: pendingOrders > 5 ? 'critical' : 'warning', description: 'Orders awaiting process' },
      { id: 'exp-1', name: 'OpEx Total', category: 'Expenses', value: expensesData.reduce((s, e) => s + Number(e.amount || 0), 0), unit: 'Rp', status: 'good', description: 'Total operational cost' }
    ];
    return m;
  }, [loading, employeesData, usersData, warehousesData, productsData, ordersData, inventoryData, expensesData]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(metrics.map(m => ({ Metric: m.name, Value: m.value, Unit: m.unit, Status: m.status })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Operations");
    XLSX.writeFile(wb, `Ops_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading) return <div className="p-6"><TableSkeleton rows={10} /></div>;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="text-blue-600" size={32} /> Real-time Ops
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Live organizational metrics</p>
        </div>
        <button onClick={handleExport} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all">
           <Download size={18} /> EXPORT DATA
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <SummaryCard label="Critical Issues" val={metrics.filter(m => m.status === 'critical').length} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-50" />
        <SummaryCard label="Warnings" val={metrics.filter(m => m.status === 'warning').length} icon={Clock} color="text-amber-600" bg="bg-amber-50" />
        <SummaryCard label="Compliance" val="100%" icon={ShieldCheck} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      <div className="space-y-12">
        {['Karyawan', 'Pengguna', 'Gudang', 'Inventory', 'Pesanan', 'Expenses'].map(cat => {
           const items = metrics.filter(m => m.category === cat);
           if (items.length === 0) return null;
           return (
             <div key={cat} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                   <div className="h-[2px] flex-1 bg-slate-100" />
                   <h2 className="text-[10px] font-black uppercase text-slate-300 tracking-[0.5em]">{cat} Analysis</h2>
                   <div className="h-[2px] flex-1 bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {items.map(m => (
                     <div key={m.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                           <div className={`p-2 rounded-xl ${m.status === 'good' ? 'bg-emerald-50 text-emerald-600' : m.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                              {m.status === 'good' ? <Activity size={14}/> : m.status === 'warning' ? <Clock size={14}/> : <AlertTriangle size={14}/>}
                           </div>
                           <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${m.status === 'good' ? 'bg-emerald-50 text-emerald-600' : m.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                              {m.status}
                           </span>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.name}</p>
                        <div className="flex items-baseline gap-1 mb-2">
                           <span className="text-2xl font-black text-slate-900">{typeof m.value === 'number' && m.unit === 'Rp' ? `Rp ${m.value.toLocaleString()}` : m.value}</span>
                           <span className="text-[10px] font-bold text-slate-400 uppercase">{m.unit !== 'Rp' ? m.unit : ''}</span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 leading-relaxed">{m.description}</p>
                     </div>
                   ))}
                </div>
             </div>
           );
        })}
      </div>

      <div className="mt-12 bg-white rounded-[3rem] p-10 border border-slate-100 flex flex-col md:flex-row items-center gap-8 shadow-sm">
         <div className="p-6 bg-blue-50 rounded-[2rem] text-blue-600"><Info size={32}/></div>
         <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Diagnostic Data Intelligence</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl font-medium">This dashboard aggregates real-time data across employees, users, logistics, and financials to provide a comprehensive health check of the business operations. Status alerts are triggered based on predefined organizational thresholds.</p>
         </div>
         <button className="px-8 py-4 bg-slate-50 text-slate-900 rounded-2xl text-[10px] font-black tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2 group">
            LEARN THRESHOLDS <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
         </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, val, icon: Icon, color, bg }: any) {
  return (
    <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-slate-200 transition-all`}>
       <div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
          <p className={`text-3xl font-black ${color}`}>{val}</p>
       </div>
       <div className={`p-4 ${bg} ${color} rounded-[1.5rem] group-hover:scale-110 transition-transform`}>
          <Icon size={24} />
       </div>
    </div>
  );
}
