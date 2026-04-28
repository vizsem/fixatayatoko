import { DollarSign, FileText, Calendar } from 'lucide-react';

interface SummaryProps {
  totalAmount: number;
  totalCount: number;
  period: string;
}

export function ExpensesSummary({ totalAmount, totalCount, period }: SummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <SummaryCard 
        label="Total Expenditure" 
        val={`Rp ${totalAmount.toLocaleString('id-ID')}`} 
        icon={DollarSign} 
        color="text-rose-600" 
        bg="bg-rose-50" 
      />
      <SummaryCard 
        label="Transaction Count" 
        val={totalCount.toString()} 
        icon={FileText} 
        color="text-blue-600" 
        bg="bg-blue-50" 
      />
      <SummaryCard 
        label="Reporting Period" 
        val={period} 
        icon={Calendar} 
        color="text-amber-600" 
        bg="bg-amber-50" 
      />
    </div>
  );
}

function SummaryCard({ label, val, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={80} />
      </div>
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={`p-2.5 ${bg} ${color} rounded-2xl`}>
          <Icon size={20} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <h3 className="text-2xl font-black text-slate-800 tracking-tight relative z-10">
        {val}
      </h3>
    </div>
  );
}
