import { Clock, Package, Truck, CheckCircle2, XCircle } from 'lucide-react';

interface TimelineProps {
  status: string;
}

export function OrderTimeline({ status }: TimelineProps) {
  const steps = [
    { key: 'PENDING', label: 'Menunggu', icon: Clock, color: 'text-amber-500' },
    { key: 'DIPROSES', label: 'Diproses', icon: Package, color: 'text-blue-500' },
    { key: 'DIKIRIM', label: 'Dikirim', icon: Truck, color: 'text-purple-500' },
    { key: 'SELESAI', label: 'Selesai', icon: CheckCircle2, color: 'text-emerald-500' },
  ];

  const currentStatus = status?.toUpperCase();
  const currentIndex = steps.findIndex(s => s.key === currentStatus || (currentStatus === 'MENUNGGU' && s.key === 'PENDING'));
  
  const isCancelled = currentStatus === 'BATAL' || currentStatus === 'DIBATALKAN';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 bg-rose-50 p-4 rounded-2xl border border-rose-100">
         <XCircle className="text-rose-500" size={20} />
         <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Pesanan Dibatalkan</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-2 relative">
       {/* Progress Line */}
       <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
       <div 
         className="absolute top-1/2 left-8 h-0.5 bg-green-500 -translate-y-1/2 z-0 transition-all duration-700" 
         style={{ width: `${currentIndex > 0 ? (currentIndex / (steps.length - 1)) * 100 - 15 : 0}%` }}
       />

       {steps.map((step, idx) => {
         const Icon = step.icon;
         const isActive = idx <= currentIndex;
         const isCurrent = idx === currentIndex;

         return (
           <div key={step.key} className="flex flex-col items-center gap-2 relative z-10">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 ${isCurrent ? 'bg-green-600 text-white shadow-lg scale-110' : isActive ? 'bg-green-50 text-green-600' : 'bg-white border border-slate-100 text-slate-300'}`}>
                 <Icon size={14} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-tighter ${isCurrent ? 'text-green-700' : isActive ? 'text-green-600' : 'text-slate-300'}`}>
                 {step.label}
              </span>
           </div>
         );
       })}
    </div>
  );
}
