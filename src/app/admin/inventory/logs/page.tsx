'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import {
  ArrowLeft, Search,
  ArrowUpCircle, ArrowDownCircle, User, Warehouse, Package
} from 'lucide-react';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface StockLog {
  id: string;
  adminEmail: string;
  productName: string;
  warehouseName: string;
  change: number;
  previousStock: number;
  newStock: number;
  type?: string;
  createdAt?: Timestamp;
}


export default function StockLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<StockLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Ambil 100 riwayat terbaru
    const q = query(
      collection(db, 'stock_logs'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StockLog[];

      setLogs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = logs.filter(log =>
    log.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-10 bg-gray-50 min-h-screen font-sans text-black">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-4 bg-white shadow-sm rounded-2xl hover:bg-black hover:text-white transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Audit Stok</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Riwayat Perubahan Inventaris</p>
            </div>
          </div>

          <div className="relative group w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
            <input
              type="text"
              placeholder="CARI PRODUK ATAU ADMIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl font-black text-[10px] uppercase shadow-sm outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>
        </div>

        {/* TABEL LOGS */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Waktu & Admin</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Produk</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Gudang</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-center">Perubahan</th>
                  <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center font-black uppercase text-gray-300 animate-pulse">Memuat riwayat...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center font-black uppercase text-gray-300">Belum ada riwayat perubahan</td></tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <User size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase">{log.adminEmail?.split('@')[0]}</p>
                            <p className="text-[9px] text-gray-400 font-bold">
                              {log.createdAt ? format(log.createdAt.toDate(), 'dd MMM yyyy, HH:mm', { locale: id }) : 'Loading...'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="text-gray-300" />
                          <p className="text-[10px] font-black uppercase text-gray-700">{log.productName}</p>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <Warehouse size={14} className="text-gray-300" />
                          <p className="text-[10px] font-bold uppercase text-gray-500">{log.warehouseName}</p>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-col items-center">
                          <div className={`flex items-center gap-1 font-black text-xs ${log.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {log.change > 0 ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                            {log.change > 0 ? `+${log.change}` : log.change}
                          </div>
                          <p className="text-[8px] font-black text-gray-300 uppercase mt-1">
                            {log.previousStock} → {log.newStock}
                          </p>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="px-3 py-1 bg-gray-100 rounded-full text-[8px] font-black uppercase text-gray-500 tracking-tighter">
                          {log.type || 'SYSTEM'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}