import { DollarSign, FileText, PieChart } from 'lucide-react';

interface SummaryProps {
  totalAmount: number;
  totalCount: number;
  periodLabel: string;
  topCategory?: { name: string; amount: number; percent: number } | null;
}

export function ExpensesSummary({ totalAmount, totalCount, periodLabel, topCategory }: SummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
            <DollarSign size={18} />
          </div>
          <span className="text-xs font-semibold text-slate-500">Total Pengeluaran</span>
        </div>
        <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
          Rp{totalAmount.toLocaleString('id-ID')}
        </p>
        <p className="text-[11px] text-slate-400 mt-1 font-medium">{periodLabel}</p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <FileText size={18} />
          </div>
          <span className="text-xs font-semibold text-slate-500">Jumlah Transaksi</span>
        </div>
        <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">
          {totalCount.toLocaleString('id-ID')} <span className="text-sm font-semibold text-slate-400">catatan</span>
        </p>
        <p className="text-[11px] text-slate-400 mt-1 font-medium">
          Rata-rata {totalCount > 0 ? `Rp${Math.round(totalAmount / totalCount).toLocaleString('id-ID')}` : 'Rp0'} / transaksi
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
            <PieChart size={18} />
          </div>
          <span className="text-xs font-semibold text-slate-500">Pos Terbesar</span>
        </div>
        {topCategory ? (
          <>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
              {topCategory.name}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium tabular-nums">
              Rp{topCategory.amount.toLocaleString('id-ID')} ({topCategory.percent}%)
            </p>
          </>
        ) : (
          <>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-400 tracking-tight">-</p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Belum ada data</p>
          </>
        )}
      </div>
    </div>
  );
}
