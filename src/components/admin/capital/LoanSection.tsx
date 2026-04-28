import { CreditCard, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { LoanRecord } from '@/types/finance';

interface LoanProps {
  loans: LoanRecord[];
  onRepay: (loan: LoanRecord) => void;
  onRecord: () => void;
}

export function LoanSection({ loans, onRepay, onRecord }: LoanProps) {
  return (
    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm mt-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-3xl">
            <CreditCard size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Debt & Liabilities</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Loan commitments & repayment status</p>
          </div>
        </div>
        <button onClick={onRecord} className="px-6 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center gap-2">
          Record New Loan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loans.filter(l => l.status === 'ACTIVE').map((loan) => (
          <div key={loan.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 hover:shadow-xl transition-all group relative overflow-hidden">
             <div className="flex justify-between items-start mb-6">
                <div>
                   <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{loan.lenderName}</h4>
                   <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">{loan.loanType}</p>
                </div>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                   <Clock size={16} />
                </div>
             </div>

             <div className="space-y-4 mb-6">
                <div className="flex justify-between items-end">
                   <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Principal Amount</p>
                      <p className="text-lg font-black text-slate-900">Rp {loan.amount.toLocaleString()}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Interest</p>
                      <p className="text-sm font-black text-slate-600">{loan.interestRate}%</p>
                   </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl">
                   <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Remaining Debt</p>
                   <p className="text-xl font-black text-rose-600">Rp {(loan.remainingAmount || 0).toLocaleString()}</p>
                </div>
             </div>

             <button onClick={() => onRepay(loan)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 group">
                MAKE REPAYMENT <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
        ))}
        {loans.filter(l => l.status === 'ACTIVE').length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
             <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
             </div>
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">No outstanding liabilities detected</p>
          </div>
        )}
      </div>
    </div>
  );
}
