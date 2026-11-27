import { Trash2, Edit, ExternalLink, Receipt, Wallet } from 'lucide-react';
import Link from 'next/link';

interface Expense {
  id: string;
  date: any;
  category: string;
  description: string;
  amount: number;
  paymentMethod?: string;
  proofOfPayment?: string;
}

interface TableProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

const formatDate = (date: any) => {
  if (!date) return '-';
  const d = date && typeof date.toDate === 'function' ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getPaymentBadgeClass = (method?: string) => {
  const m = (method || 'Kas Tunai').toLowerCase();
  if (m.includes('transfer')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (m.includes('qris')) return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
};

export function ExpensesTable({ expenses, onDelete }: TableProps) {
  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <Receipt size={22} />
        </div>
        <h3 className="text-sm font-bold text-slate-800">Belum ada catatan pengeluaran</h3>
        <p className="text-xs text-slate-500 mt-1">
          Tidak ada pengeluaran operasional yang cocok dengan filter atau periode yang dipilih.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 text-slate-700">
                    {expense.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getPaymentBadgeClass(
                      expense.paymentMethod
                    )}`}
                  >
                    {expense.paymentMethod || 'Kas Tunai'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">{formatDate(expense.date)}</p>
              </div>
              <p className="text-sm font-extrabold text-rose-600 tabular-nums shrink-0">
                Rp{Number(expense.amount).toLocaleString('id-ID')}
              </p>
            </div>

            <p className="text-xs font-medium text-slate-700 leading-relaxed">
              {expense.description || '-'}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {expense.proofOfPayment ? (
                <a
                  href={expense.proofOfPayment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1 hover:underline"
                >
                  Lihat Bukti <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-[11px] text-slate-400">Tanpa lampiran</span>
              )}

              <div className="flex items-center gap-1">
                <Link
                  href={`/admin/operational-expenses/edit/${expense.id}`}
                  className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 transition-colors"
                >
                  <Edit size={14} /> Edit
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(expense.id)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Kategori</th>
                <th className="px-5 py-3.5">Sumber Dana</th>
                <th className="px-5 py-3.5">Keterangan & Bukti</th>
                <th className="px-5 py-3.5 text-right">Nominal</th>
                <th className="px-5 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-700">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${getPaymentBadgeClass(
                        expense.paymentMethod
                      )}`}
                    >
                      <Wallet size={12} />
                      {expense.paymentMethod || 'Kas Tunai'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-slate-800">{expense.description || '-'}</span>
                      {expense.proofOfPayment && (
                        <a
                          href={expense.proofOfPayment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-blue-600 mt-1 inline-flex items-center gap-1 hover:underline self-start"
                        >
                          Lihat Bukti <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      Rp{Number(expense.amount).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        href={`/admin/operational-expenses/edit/${expense.id}`}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Pengeluaran"
                      >
                        <Edit size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDelete(expense.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus Pengeluaran"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
