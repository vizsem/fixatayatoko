'use client';

export const SkeletonCard = () => (
  <div className="min-w-[160px] md:min-w-[200px] bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm animate-pulse flex flex-col snap-start">
    <div className="aspect-square bg-slate-100 relative overflow-hidden">
       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] animate-shimmer" />
    </div>
    <div className="p-4 space-y-3 flex-1 flex flex-col">
      <div className="space-y-1.5">
        <div className="h-3 bg-slate-100 rounded-full w-5/6" />
        <div className="h-3 bg-slate-100 rounded-full w-1/2" />
      </div>
      <div className="h-2 bg-slate-50 rounded-full w-1/3" />
      
      <div className="mt-auto pt-4">
        <div className="h-6 bg-green-50 rounded-xl w-full" />
      </div>
    </div>
    
    <style jsx>{`
      @keyframes shimmer {
        0% { transform: translateX(-100%) skewX(-20deg); }
        100% { transform: translateX(200%) skewX(-20deg); }
      }
      .animate-shimmer {
        animation: shimmer 2s infinite linear;
      }
    `}</style>
  </div>
);
