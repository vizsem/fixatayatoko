import { Timestamp } from 'firebase/firestore';
import { History, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'INJECTION' | 'WITHDRAWAL';
  amount: number;
  description: string;
  date: any;
}

interface TableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

export function CapitalTransactionTable({ transactions, onDelete }: TableProps) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden h-fit">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white text-slate-600 rounded-xl shadow-sm border border-slate-100">
            <History size={18} />
          </div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight">Equity Movement Log</h3>
        </div>
      </div>
      
      <div className="overflow-x-auto max-h-[600px] no-scrollbar">
        {transactions.length === 0 ? (
          <div className="p-16 text-center">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="text-slate-200" size={32} />
             </div>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No equity transactions found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-xl border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Classification</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Value</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Description</th>
                <th className="px-8 py-5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((t) => {
                const dateObj = t.date ? (t.date instanceof Timestamp ? t.date.toDate() : new Date(t.date)) : null;
                const isInjection = t.type === 'INJECTION';
                
                return (
                  <tr key={t.id} className="group hover:bg-slate-50/80 transition-all">
                    <td className="px-8 py-5">
                      <p className="text-[11px] font-black text-slate-700">
                        {dateObj ? dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        {isInjection ? (
                          <ArrowUpCircle className="text-emerald-500" size={14} />
                        ) : (
                          <ArrowDownCircle className="text-rose-500" size={14} />
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isInjection ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className={`text-sm font-black ${isInjection ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isInjection ? '+' : '-'} Rp {t.amount.toLocaleString('id-ID')}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        {t.description}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <button 
                        onClick={() => onDelete(t.id)}
                        className="p-2 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
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
