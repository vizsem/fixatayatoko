import { Trash2, Edit, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';

interface Expense {
  id: string;
  date: any;
  category: string;
  description: string;
  amount: number;
  proofOfPayment?: string;
}

interface TableProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

export function ExpensesTable({ expenses, onDelete }: TableProps) {
  const formatDate = (date: any) => {
    if (!date) return '-';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-8 py-5">Date</th>
              <th className="px-8 py-5">Category</th>
              <th className="px-8 py-5">Statement</th>
              <th className="px-8 py-5 text-right">Value</th>
              <th className="px-8 py-5 text-center">Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50/50 transition-all group">
                <td className="px-8 py-5 text-xs font-black text-slate-700">
                  {formatDate(expense.date)}
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-100 text-slate-600">
                    {expense.category}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                     <span className="text-xs font-bold text-slate-800">{expense.description}</span>
                     {expense.proofOfPayment && (
                       <a href={expense.proofOfPayment} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-blue-600 uppercase mt-1 flex items-center gap-1 hover:underline">
                         View Attachment <ExternalLink size={10} />
                       </a>
                     )}
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                   <span className="text-sm font-black text-slate-900">Rp {Number(expense.amount).toLocaleString('id-ID')}</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center justify-center gap-3">
                    <Link href={`/admin/operational-expenses/edit/${expense.id}`} className="p-2.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                      <Edit size={16} />
                    </Link>
                    <button onClick={() => onDelete(expense.id)} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
