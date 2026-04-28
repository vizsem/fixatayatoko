import { Timestamp } from 'firebase/firestore';
import { Store } from 'lucide-react';

interface MarketplaceLog {
  id: string;
  accountId: string;
  name: string;
  storeName?: string;
  type: 'ADJUST' | 'WITHDRAWAL' | 'DEPOSIT';
  amount?: number;
  activeChange?: number;
  pendingChange?: number;
  date: any;
  note?: string;
}

export function MarketplaceLogsTable({ logs }: { logs: MarketplaceLog[] }) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden h-fit">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white text-purple-600 rounded-xl shadow-sm border border-slate-100">
            <Store size={18} />
          </div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight">Marketplace Settlement Logs</h3>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[600px] no-scrollbar">
        {logs.length === 0 ? (
          <div className="p-16 text-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Store className="text-slate-200" size={32} />
             </div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No settlement logs detected</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-xl border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Timeframe</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Store Profile</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Operation</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Delta</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((lg) => {
                const dateObj = lg.date ? (lg.date instanceof Timestamp ? lg.date.toDate() : new Date(lg.date)) : null;
                const isAdjust = lg.type === 'ADJUST';
                const adjustText = isAdjust
                  ? `Active: ${((lg.activeChange || 0) >= 0 ? '+' : '') + (lg.activeChange || 0).toLocaleString()} | Pending: ${((lg.pendingChange || 0) >= 0 ? '+' : '') + (lg.pendingChange || 0).toLocaleString()}`
                  : '';
                const amountText = !isAdjust ? (lg.amount || 0).toLocaleString('id-ID') : '';
                const amountClass = lg.type === 'WITHDRAWAL' ? 'text-rose-600' : 'text-emerald-600';
                
                return (
                  <tr key={lg.id} className="group hover:bg-slate-50/80 transition-all">
                    <td className="px-8 py-5">
                      <p className="text-[11px] font-black text-slate-700">
                        {dateObj ? dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                        {dateObj ? dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{lg.name}</span>
                        {lg.storeName && <span className="text-[9px] font-black text-purple-600 uppercase mt-0.5 tracking-tighter">{lg.storeName}</span>}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${isAdjust ? 'bg-slate-100 text-slate-600' : lg.type === 'WITHDRAWAL' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {lg.type}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className={`text-sm font-black ${amountClass}`}>
                         {lg.type === 'WITHDRAWAL' ? '-' : '+'} {amountText}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-medium text-slate-400 leading-relaxed max-w-[200px] block truncate">
                        {isAdjust ? adjustText : (lg.note || '-')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
