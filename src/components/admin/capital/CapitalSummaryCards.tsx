import { Landmark, Package, CreditCard, ArrowDownCircle, TrendingUp, CheckCircle2 } from 'lucide-react';

interface SummaryProps {
  currentCapital: number;
  stockValue: number;
  activeProductCount?: number;
  totalStockUnits?: number;
  receivables: number;
  totalLiabilities: number;
  growth: number;
}

export function CapitalSummaryCards({ 
  currentCapital, 
  stockValue, 
  activeProductCount,
  totalStockUnits,
  receivables, 
  totalLiabilities, 
  growth 
}: SummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {/* 1. Modal Disetor */}
      <SummaryCard 
        label="Modal Disetor" 
        val={`Rp ${currentCapital.toLocaleString('id-ID')}`} 
        subtext="Ekuitas & Injeksi Modal"
        icon={Landmark} 
        color="text-indigo-600" 
        bg="bg-indigo-50" 
      />

      {/* 2. Aset Stok (Produk Aktif) */}
      <SummaryCard 
        label="Aset Stok Aktif" 
        val={`Rp ${stockValue.toLocaleString('id-ID')}`} 
        badge={activeProductCount ? `${activeProductCount} SKU Aktif` : 'Khusus Produk Aktif'}
        subtext={totalStockUnits ? `${totalStockUnits.toLocaleString('id-ID')} Total Unit` : 'Valuasi HPP Modal'}
        icon={Package} 
        color="text-blue-600" 
        bg="bg-blue-50" 
      />

      {/* 3. Piutang */}
      <SummaryCard 
        label="Piutang Usaha" 
        val={`Rp ${receivables.toLocaleString('id-ID')}`} 
        subtext="Tagihan Pelanggan"
        icon={CreditCard} 
        color="text-amber-600" 
        bg="bg-amber-50" 
      />

      {/* 4. Liabilitas / Hutang */}
      <SummaryCard 
        label="Total Hutang" 
        val={`Rp ${totalLiabilities.toLocaleString('id-ID')}`} 
        subtext="Pinjaman & Kewajiban"
        icon={ArrowDownCircle} 
        color="text-rose-600" 
        bg="bg-rose-50" 
      />

      {/* 5. Valuasi & Pertumbuhan Ekuitas */}
      <div className={`col-span-2 md:col-span-1 lg:col-span-1 p-5 rounded-2xl border shadow-xs relative overflow-hidden group hover:shadow-md transition-all ${
        growth >= 0 
          ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500' 
          : 'bg-gradient-to-br from-rose-600 to-red-700 border-rose-500'
      }`}>
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <TrendingUp size={64} className="text-white" />
        </div>
        <div className="flex items-center gap-2 mb-2.5 relative z-10">
          <div className="p-2 bg-white/20 text-white rounded-xl backdrop-blur-sm">
            <TrendingUp size={16} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">Valuasi & Growth</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight relative z-10 truncate">
          {growth >= 0 ? '+' : ''}Rp {growth.toLocaleString('id-ID')}
        </h3>
        <p className="text-[10px] font-medium text-white/80 mt-1 relative z-10">
          Net Worth - Modal Disetor
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, val, subtext, badge, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 ${bg} ${color} rounded-xl`}>
              <Icon size={16} className="stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate">{label}</span>
          </div>
          {badge && (
            <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100/80 px-1.5 py-0.5 rounded-md shrink-0">
              {badge}
            </span>
          )}
        </div>
        <h3 className={`text-lg sm:text-xl font-black tracking-tight ${color === 'text-rose-600' ? 'text-rose-600' : 'text-slate-800'} truncate`}>
          {val}
        </h3>
      </div>
      {subtext && (
        <p className="text-[10px] font-medium text-slate-400 mt-2 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}

