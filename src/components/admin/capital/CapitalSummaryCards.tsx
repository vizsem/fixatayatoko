import { Landmark, Package, CreditCard, ArrowDownCircle, TrendingUp } from 'lucide-react';

interface SummaryProps {
  currentCapital: number;
  stockValue: number;
  receivables: number;
  totalLiabilities: number;
  growth: number;
}

export function CapitalSummaryCards({ currentCapital, stockValue, receivables, totalLiabilities, growth }: SummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <SummaryCard 
        label="Modal Disetor" 
        val={`Rp ${currentCapital.toLocaleString('id-ID')}`} 
        icon={Landmark} 
        color="text-slate-600" 
        bg="bg-slate-100" 
      />
      <SummaryCard 
        label="Aset Stok" 
        val={`Rp ${stockValue.toLocaleString('id-ID')}`} 
        icon={Package} 
        color="text-blue-600" 
        bg="bg-blue-50" 
      />
      <SummaryCard 
        label="Piutang" 
        val={`Rp ${receivables.toLocaleString('id-ID')}`} 
        icon={CreditCard} 
        color="text-orange-600" 
        bg="bg-orange-50" 
      />
      <SummaryCard 
        label="Hutang" 
        val={`Rp ${totalLiabilities.toLocaleString('id-ID')}`} 
        icon={ArrowDownCircle} 
        color="text-rose-600" 
        bg="bg-rose-50" 
      />
      <div className={`p-6 rounded-[2rem] border shadow-sm relative overflow-hidden group hover:shadow-md transition-all ${growth >= 0 ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'}`}>
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <TrendingUp size={80} className="text-white" />
        </div>
        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="p-2.5 bg-white/20 text-white rounded-2xl backdrop-blur-sm">
            <TrendingUp size={20} />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-white/80">Valuasi & Profit</span>
        </div>
        <h3 className="text-2xl font-black text-white tracking-tight relative z-10">
          {growth >= 0 ? '+' : ''}Rp {growth.toLocaleString('id-ID')}
        </h3>
        <p className="text-[10px] font-medium text-white/80 mt-1 relative z-10 uppercase tracking-widest">Net Worth - Modal</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, val, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={80} />
      </div>
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={`p-2.5 ${bg} ${color} rounded-2xl`}>
          <Icon size={20} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <h3 className={`text-2xl font-black tracking-tight relative z-10 ${color === 'text-rose-600' ? 'text-rose-600' : 'text-slate-800'}`}>
        {val}
      </h3>
    </div>
  );
}
