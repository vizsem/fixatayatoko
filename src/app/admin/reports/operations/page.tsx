'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAdminAuth from '@/lib/hooks/useAdminAuth';
import { Download, Users, Warehouse, Package, Activity, Clock, AlertTriangle, ShoppingCart, Database, DollarSign, Info, ArrowRight, ShieldCheck } from 'lucide-react';
import notify from '@/lib/notify';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import * as Sentry from '@sentry/nextjs';
import * as XLSX from 'xlsx';
import { getOperationsMetrics } from '@/lib/actions/operations-report.actions';
import type { OperationalMetric } from '@/lib/operations-metrics';

export default function OperationsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OperationalMetric[]>([]);

  const { authLoading } = useAdminAuth();

  useEffect(() => {
    if (authLoading) return;

    const fetchData = async () => {
      try {
        // Dihitung di server: klien tidak lagi mengunduh isi 7 tabel penuh
        // hanya untuk memperoleh 8 angka.
        setMetrics(await getOperationsMetrics());
      } catch (error) {
        console.error("Error fetching ops data", error);
        Sentry.captureException(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading]);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(metrics.map(m => ({ Metric: m.name, Value: m.value, Unit: m.unit, Status: m.status })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Operations");
    XLSX.writeFile(wb, `Ops_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading || authLoading) return <div className="p-6"><TableSkeleton rows={10} /></div>;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="text-blue-600" size={32} /> Real-time Ops
          </h1>
          <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] mt-1">Live organizational metrics</p>
        </div>
        <button onClick={handleExport} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all">
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
                   <h2 className="text-xs font-black uppercase text-slate-300 tracking-[0.5em]">{cat} Analysis</h2>
                   <div className="h-[2px] flex-1 bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {items.map(m => (
                     <div key={m.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                           <div className={`p-2 rounded-xl ${m.status === 'good' ? 'bg-emerald-50 text-emerald-600' : m.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                              {m.status === 'good' ? <Activity size={14}/> : m.status === 'warning' ? <Clock size={14}/> : <AlertTriangle size={14}/>}
                           </div>
                           <span className={`text-xs font-black uppercase px-2 py-1 rounded-lg ${m.status === 'good' ? 'bg-emerald-50 text-emerald-600' : m.status === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                              {m.status}
                           </span>
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{m.name}</p>
                        <div className="flex items-baseline gap-1 mb-2">
                           <span className="text-2xl font-black text-slate-900">{typeof m.value === 'number' && m.unit === 'Rp' ? `Rp ${m.value.toLocaleString()}` : m.value}</span>
                           <span className="text-xs font-bold text-slate-400 uppercase">{m.unit !== 'Rp' ? m.unit : ''}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-400 leading-relaxed">{m.description}</p>
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
         <button className="px-8 py-4 bg-slate-50 text-slate-900 rounded-2xl text-xs font-black tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2 group">
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
          <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
          <p className={`text-3xl font-black ${color}`}>{val}</p>
       </div>
       <div className={`p-4 ${bg} ${color} rounded-[1.5rem] group-hover:scale-110 transition-transform`}>
          <Icon size={24} />
       </div>
    </div>
  );
}
