'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, doc, getDoc, getDocs
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, RefreshCw, CheckCircle, AlertCircle, Clock, Package, Warehouse, TrendingUp, TrendingDown, Filter, Download, Settings, XCircle, HelpCircle, X
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import notify from '@/lib/notify';
import { stockSyncService } from '@/lib/stockSyncService';
import * as Sentry from '@sentry/nextjs';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';

interface SyncStatus {
  id: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  systemStock: number;
  warehouseStock: number;
  difference: number;
  status: 'SYNCED' | 'OUT_OF_SYNC' | 'PENDING' | 'ERROR';
}

export default function StockSyncMonitorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'SYNCED' | 'OUT_OF_SYNC' | 'ERROR'>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [syncStats, setSyncStats] = useState({ total: 0, success: 0, failed: 0, averageExecutionTime: 0 });
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');
  
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const cancelSyncRef = useRef(false);
  const [showHelp, setShowHelp] = useState(false);

  const stats = useMemo(() => ({
      total: syncStatuses.length,
      synced: syncStatuses.filter(s => s.status === 'SYNCED').length,
      outOfSync: syncStatuses.filter(s => s.status === 'OUT_OF_SYNC').length,
      pending: syncStatuses.filter(s => s.status === 'PENDING').length,
      error: syncStatuses.filter(s => s.status === 'ERROR').length
  }), [syncStatuses]);

  const loadSyncData = useCallback(async () => {
    try {
      const productsSnap = await getDocs(query(collection(db, 'products'), where('isActive', '==', true)));
      const warehousesSnap = await getDocs(query(collection(db, 'warehouses'), where('isActive', '==', true)));
      const warehouseStockSnap = await getDocs(collection(db, 'warehouseStock'));
      
      const warehouseStocks = new Map();
      warehouseStockSnap.docs.forEach(doc => {
        const d = doc.data();
        warehouseStocks.set(`${d.productId}_${d.warehouseId}`, d.quantity || 0);
      });

      const syncData: SyncStatus[] = [];
      productsSnap.docs.forEach(pDoc => {
        const p = pDoc.data();
        warehousesSnap.docs.forEach(wDoc => {
          const w = wDoc.data();
          const wStock = warehouseStocks.get(`${pDoc.id}_${wDoc.id}`) || 0;
          const sStock = (p.stockByWarehouse || {})[wDoc.id] || 0;
          const diff = Math.abs(wStock - sStock);
          
          let status: SyncStatus['status'] = 'SYNCED';
          if (diff > 5) status = 'OUT_OF_SYNC';
          else if (diff > 0) status = 'PENDING';

          syncData.push({
            id: `${pDoc.id}_${wDoc.id}`,
            productId: pDoc.id,
            productName: p.name || 'Untitled',
            warehouseId: wDoc.id,
            warehouseName: w.name || 'Unknown',
            systemStock: sStock,
            warehouseStock: wStock,
            difference: diff,
            status
          });
        });
      });

      setSyncStatuses(syncData);
      setLastRefresh(new Date());
    } catch (error) {
      Sentry.captureException(error);
      notify.error("Gagal sinkron data");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        notify.aksesDitolakAdmin();
        return router.push('/profil');
      }
      await loadSyncData();
      const s = await stockSyncService.getSyncStats(timeRange);
      setSyncStats(s);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, loadSyncData, timeRange]);

  useEffect(() => {
    if (!autoRefresh || isBatchSyncing) return;
    const interval = setInterval(() => loadSyncData(), 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, isBatchSyncing, loadSyncData]);

  const handleManualSync = async (productId: string, warehouseId: string) => {
    const t = notify.admin.loading("Sinkronisasi...");
    try {
      const ok = await stockSyncService.syncWarehouseToProduct(productId, warehouseId);
      if (ok) {
        notify.admin.success("Berhasil!", { id: t });
        loadSyncData();
      } else throw new Error();
    } catch { notify.admin.error("Gagal", { id: t }); }
  };

  const handleBatchSync = async () => {
    const targets = syncStatuses.filter(s => s.status === 'OUT_OF_SYNC');
    if (targets.length === 0) return notify.info("Semua sudah sinkron");
    
    setIsBatchSyncing(true);
    cancelSyncRef.current = false;
    setSyncProgress({ current: 0, total: targets.length });

    try {
      let success = 0;
      for (let i = 0; i < targets.length; i++) {
        if (cancelSyncRef.current) break;
        setSyncProgress({ current: i + 1, total: targets.length });
        const ok = await stockSyncService.syncWarehouseToProduct(targets[i].productId, targets[i].warehouseId);
        if (ok) success++;
        await new Promise(r => setTimeout(r, 100));
      }
      notify.admin.success(`Selesai! ${success} item diperbarui.`);
      loadSyncData();
    } finally {
      setIsBatchSyncing(false);
    }
  };

  const filteredStatuses = syncStatuses.filter(s => filter === 'ALL' || s.status === filter);

  if (loading) return <div className="p-6"><TableSkeleton rows={10} /></div>;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <Toaster position="top-right" />
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Activity className="text-blue-600" /> Sync Monitor
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Cross-warehouse stock integrity</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${autoRefresh ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} /> {autoRefresh ? 'AUTO ON' : 'AUTO OFF'}
          </button>
          <button onClick={handleBatchSync} disabled={isBatchSyncing} className="bg-slate-900 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all flex items-center gap-2">
            {isBatchSyncing ? `Syncing ${syncProgress.current}/${syncProgress.total}` : <><RefreshCw size={14} /> Sync All</>}
          </button>
          <button onClick={() => setShowHelp(true)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm"><HelpCircle size={18}/></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-8">
        <StatSmall label="Total Items" val={stats.total} color="text-slate-900" />
        <StatSmall label="Synced" val={stats.synced} color="text-emerald-600" bg="bg-emerald-50" />
        <StatSmall label="Out of Sync" val={stats.outOfSync} color="text-rose-600" bg="bg-rose-50" />
        <StatSmall label="Pending" val={stats.pending} color="text-amber-600" bg="bg-amber-50" />
        <StatSmall label="Avg Time" val={`${syncStats.averageExecutionTime.toFixed(0)}ms`} color="text-blue-600" bg="bg-blue-50" />
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
           <div className="flex gap-1">
              {(['ALL', 'SYNCED', 'OUT_OF_SYNC', 'ERROR'] as const).map(s => (
                <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter ${filter === s ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>{s.replace('_', ' ')}</button>
              ))}
           </div>
           <span className="text-[10px] font-bold text-slate-400 uppercase">Last Update: {lastRefresh.toLocaleTimeString()}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Product & Warehouse</th>
                <th className="px-6 py-4">System</th>
                <th className="px-6 py-4">Warehouse</th>
                <th className="px-6 py-4">Diff</th>
                <th className="px-6 py-4 text-right pr-8">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredStatuses.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${s.status === 'SYNCED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}><Package size={16}/></div>
                      <div>
                        <p className="text-[11px] font-black text-slate-800 uppercase">{s.productName}</p>
                        <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Warehouse size={10}/> {s.warehouseName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[11px] font-black text-slate-600">{s.systemStock}</td>
                  <td className="px-6 py-4 text-[11px] font-black text-slate-600">{s.warehouseStock}</td>
                  <td className="px-6 py-4">
                     <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${s.difference > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {s.difference > 0 ? <TrendingUp className="inline mr-1" size={10}/> : <CheckCircle className="inline mr-1" size={10}/>}
                        {s.difference}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-right pr-8">
                     <button onClick={() => handleManualSync(s.productId, s.warehouseId)} disabled={s.status === 'SYNCED'} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-blue-600 transition-all disabled:opacity-30">
                        <RefreshCw size={14}/>
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showHelp && (
         <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowHelp(false)} />
            <div className="bg-white max-w-md w-full rounded-[2.5rem] p-8 relative z-10 shadow-2xl animate-in zoom-in-95">
               <h2 className="text-xl font-black mb-6">Sync Guide</h2>
               <div className="space-y-4 text-xs font-medium text-slate-500 leading-relaxed">
                  <p>Halaman ini memantau integritas data antara tabel <strong>Products</strong> dan tabel <strong>WarehouseStock</strong>. Selisih biasanya terjadi karena transaksi yang gagal atau koneksi database yang terputus.</p>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-700">
                     <p className="font-black uppercase text-[9px] mb-1">Status Synced</p>
                     Data sistem dan fisik gudang 100% sama.
                  </div>
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-rose-700">
                     <p className="font-black uppercase text-[9px] mb-1">Status Out of Sync</p>
                     Selisih {'>'} 5 unit. Memerlukan sinkronisasi manual atau massal.
                  </div>
               </div>
               <button onClick={() => setShowHelp(false)} className="mt-8 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">Understand</button>
            </div>
         </div>
      )}
    </div>
  );
}

function StatSmall({ label, val, color, bg = 'bg-white' }: any) {
  return (
    <div className={`${bg} p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center`}>
      <span className={`text-xl font-black ${color}`}>{val}</span>
      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">{label}</span>
    </div>
  );
}
