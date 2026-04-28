'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import useProducts from '@/lib/hooks/useProducts';
import type { NormalizedProduct } from '@/lib/normalize';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import { Package, Download, AlertTriangle, TrendingDown, TrendingUp, Search, Filter, ChevronLeft, ChevronRight, Info, Layers } from 'lucide-react';
import notify from '@/lib/notify';
import { TableSkeleton } from '@/components/admin/InventorySkeleton';
import * as Sentry from '@sentry/nextjs';

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  stockIn: number;
  stockOut: number;
  turnoverRate: number;
  stockValue: number;
  imageUrl?: string;
  warehouseId?: string;
};

export default function InventoryReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const { products, loading: productsLoading } = useProducts({ isActive: true, orderByField: 'name' });
  const [building, setBuilding] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push('/profil/login');
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.data()?.role !== 'admin') {
        notify.admin.error('Akses ditolak!');
        return router.push('/profil');
      }
      setLoading(false);
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    const build = async () => {
      setBuilding(true);
      try {
        const transSnap = await getDocs(collection(db, 'inventory_transactions'));
        const transactions = transSnap.docs.map(d => d.data());
        
        const whSnap = await getDocs(collection(db, 'warehouses'));
        setWarehouses(whSnap.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));

        const inv: InventoryItem[] = products.map((p: NormalizedProduct) => {
          const sIn = transactions.filter(t => t.productId === p.id && t.type === 'STOCK_IN').reduce((s, t) => s + Number(t.quantity || 0), 0);
          const sOut = transactions.filter(t => t.productId === p.id && t.type === 'STOCK_OUT').reduce((s, t) => s + Number(t.quantity || 0), 0);
          const cost = Number(p.Modal || p.purchasePrice || (p.priceEcer || 0) * 0.8);
          return {
            id: p.id,
            name: p.name || '',
            category: p.category || '',
            currentStock: p.stock || 0,
            stockIn: sIn,
            stockOut: sOut,
            turnoverRate: p.stock > 0 ? sOut / p.stock : 0,
            stockValue: (p.stock || 0) * cost,
            imageUrl: p.imageUrl,
            warehouseId: p.warehouseId
          };
        });
        setInventory(inv);
      } catch (err) {
        Sentry.captureException(err);
      } finally {
        setBuilding(false);
      }
    };
    if (!productsLoading && products.length > 0) build();
  }, [productsLoading, products]);

  const filtered = useMemo(() => {
    return inventory.filter(it => {
      const q = search.toLowerCase();
      const matchesSearch = !search || it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q);
      const matchesCat = selectedCategory === 'ALL' || it.category === selectedCategory;
      const matchesWh = selectedWarehouse === 'ALL' || it.warehouseId === selectedWarehouse;
      return matchesSearch && matchesCat && matchesWh;
    });
  }, [inventory, search, selectedCategory, selectedWarehouse]);

  const categories = Array.from(new Set(inventory.map(i => i.category).filter(Boolean))).sort();
  const totalValue = filtered.reduce((s, i) => s + i.stockValue, 0);
  const lowStockCount = filtered.filter(i => i.currentStock <= 10).length;

  const pageSlice = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(i => ({ Product: i.name, Category: i.category, Stock: i.currentStock, Value: i.stockValue, Turnover: i.turnoverRate.toFixed(2) })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  if (loading || productsLoading || building) return <div className="p-6"><TableSkeleton rows={15} /></div>;

  return (
    <div className="p-3 md:p-6 bg-[#F8FAFC] min-h-screen pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="text-blue-600" size={32} /> Asset Intelligence
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">Inventory valuation & turnover</p>
        </div>
        <button onClick={handleExport} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all">
           <Download size={18} /> EXPORT ASSETS
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SummaryCard label="Total Inventory Value" val={`Rp ${totalValue.toLocaleString()}`} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
        <SummaryCard label="Critical Reorder SKU" val={lowStockCount} icon={AlertTriangle} color="text-rose-600" bg="bg-rose-50" />
        <SummaryCard label="Unique SKUs" val={filtered.length} icon={Package} color="text-blue-600" bg="bg-blue-50" />
      </div>

      <div className="bg-white p-3 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
           <input type="text" placeholder="Filter by product name or category..." className="w-full pl-16 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={search} onChange={e => { setSearch(e.target.value); setPageIndex(0); }} />
        </div>
        <div className="flex gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar">
           <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setPageIndex(0); }} className="bg-slate-50 border-none rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
              <option value="ALL">ALL CATEGORIES</option>
              {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
           </select>
           <select value={selectedWarehouse} onChange={e => { setSelectedWarehouse(e.target.value); setPageIndex(0); }} className="bg-slate-50 border-none rounded-2xl px-6 py-4 text-[10px] font-black uppercase outline-none">
              <option value="ALL">ALL WAREHOUSES</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name.toUpperCase()}</option>)}
           </select>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
           <table className="w-full text-left">
              <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                 <tr>
                    <th className="px-8 py-5">Product SKU</th>
                    <th className="px-8 py-5">Stock Level</th>
                    <th className="px-8 py-5">Asset Value</th>
                    <th className="px-8 py-5">Turnover</th>
                    <th className="px-8 py-5 text-right pr-12">Performance</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {pageSlice.map(i => (
                   <tr key={i.id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 shadow-sm">
                               <Image src={i.imageUrl || 'https://placehold.co/100x100?text=SKU'} alt={i.name} fill className="object-cover" />
                            </div>
                            <div>
                               <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{i.name}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{i.category}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <p className={`text-sm font-black ${i.currentStock <= 10 ? 'text-rose-600' : 'text-slate-900'}`}>{i.currentStock}</p>
                         <div className="flex gap-2 mt-1">
                            <span className="text-[8px] font-black text-emerald-600 uppercase">IN: {i.stockIn}</span>
                            <span className="text-[8px] font-black text-rose-500 uppercase">OUT: {i.stockOut}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <p className="text-xs font-black text-slate-900">Rp {i.stockValue.toLocaleString()}</p>
                         <p className="text-[8px] font-black text-slate-400 uppercase mt-1">Avg Valuation</p>
                      </td>
                      <td className="px-8 py-5">
                         <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${i.turnoverRate > 0.5 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, i.turnoverRate * 100)}%` }} />
                         </div>
                         <p className="text-[9px] font-black text-slate-400 uppercase mt-2">{i.turnoverRate.toFixed(2)}x Points</p>
                      </td>
                      <td className="px-8 py-5 text-right pr-12">
                         {i.turnoverRate > 0.5 ? (
                           <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl uppercase tracking-widest flex items-center gap-2 justify-end">HIGH FLOW <TrendingUp size={14}/></span>
                         ) : (
                           <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-4 py-2 rounded-xl uppercase tracking-widest flex items-center gap-2 justify-end">STAGNANT <TrendingDown size={14}/></span>
                         )}
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
         <button onClick={() => setPageIndex(p => Math.max(0, p - 1))} disabled={pageIndex === 0} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all"><ChevronLeft size={20}/></button>
         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Page {pageIndex + 1} of {Math.ceil(filtered.length / pageSize)}</span>
         <button onClick={() => setPageIndex(p => p + 1)} disabled={(pageIndex + 1) * pageSize >= filtered.length} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all"><ChevronRight size={20}/></button>
      </div>
    </div>
  );
}

function SummaryCard({ label, val, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group">
       <div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
          <p className={`text-2xl font-black ${color}`}>{val}</p>
       </div>
       <div className={`p-4 ${bg} ${color} rounded-[1.5rem] group-hover:rotate-12 transition-transform`}>
          <Icon size={24} />
       </div>
    </div>
  );
}
