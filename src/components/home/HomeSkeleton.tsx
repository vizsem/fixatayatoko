'use client';

import { SkeletonCard } from './SkeletonCard';

export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 animate-pulse">
      {/* Header Skeleton */}
      <div className="h-10 bg-green-700/10 w-full" />
      <header className="p-4 flex items-center justify-between gap-4 bg-white border-b border-slate-50">
        <div className="w-32 h-6 bg-slate-100 rounded-lg" />
        <div className="flex-1 max-w-lg h-10 bg-slate-50 rounded-xl" />
        <div className="w-10 h-10 bg-slate-100 rounded-xl" />
      </header>

      <main className="max-w-7xl mx-auto py-6 space-y-12">
        {/* Banner Skeleton */}
        <div className="px-4">
           <div className="w-full aspect-[21/9] bg-slate-100 rounded-[2.5rem] md:rounded-[4rem]" />
        </div>

        {/* Category Sections */}
        {[1, 2, 3].map(section => (
          <div key={section} className="px-4 space-y-6">
            <div className="flex justify-between items-end">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                  <div className="w-48 h-5 bg-slate-200 rounded-lg" />
               </div>
               <div className="w-16 h-3 bg-slate-100 rounded" />
            </div>
            
            <div className="flex gap-4 overflow-hidden pb-4">
               {[1, 2, 3, 4, 5, 6].map(i => (
                 <SkeletonCard key={i} />
               ))}
            </div>
          </div>
        ))}
      </main>

      {/* Bottom Nav Skeleton */}
      <div className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-slate-100 md:hidden flex justify-around items-center px-4">
         {[1, 2, 3, 4, 5].map(i => (
           <div key={i} className="w-10 h-10 bg-slate-50 rounded-xl" />
         ))}
      </div>
    </div>
  );
}
