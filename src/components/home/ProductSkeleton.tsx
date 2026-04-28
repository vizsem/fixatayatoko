'use client';

export function ProductSkeleton() {
  return (
    <div className="min-h-screen bg-white pb-40 animate-pulse">
      {/* Header Skeleton */}
      <header className="bg-white sticky top-0 z-50 border-b border-gray-50 px-4 py-4 flex items-center justify-between">
          <div className="w-10 h-10 bg-gray-100 rounded-2xl" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-2 bg-gray-100 rounded" />
            <div className="w-24 h-3 bg-gray-200 rounded" />
          </div>
          <div className="w-10 h-10 bg-gray-100 rounded-2xl" />
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Image Skeleton */}
          <div className="aspect-square rounded-[2.5rem] md:rounded-[4rem] bg-gray-100" />

          <div className="flex flex-col">
            <div className="mb-6 space-y-4">
              <div className="flex gap-2">
                <div className="w-16 h-6 bg-green-50 rounded-lg" />
                <div className="w-20 h-6 bg-blue-50 rounded-lg" />
              </div>
              <div className="w-full h-12 bg-gray-200 rounded-2xl" />
              <div className="w-1/2 h-4 bg-gray-100 rounded" />
            </div>

            {/* Price Box Skeleton */}
            <div className="rounded-[2.5rem] p-8 mb-8 bg-gray-50 border border-gray-100 space-y-6">
               <div className="space-y-2">
                 <div className="w-20 h-3 bg-gray-200 rounded" />
                 <div className="w-48 h-12 bg-gray-300 rounded-xl" />
               </div>
               <div className="pt-6 border-t border-dashed border-gray-200 flex justify-between">
                 <div className="w-24 h-4 bg-gray-200 rounded" />
                 <div className="w-32 h-6 bg-gray-300 rounded" />
               </div>
            </div>

            {/* Content Skeleton */}
            <div className="space-y-6">
               <div className="bg-white rounded-[2rem] border border-gray-100 p-6 space-y-3">
                 <div className="w-24 h-3 bg-gray-200 rounded" />
                 <div className="w-full h-2 bg-gray-100 rounded" />
                 <div className="w-full h-2 bg-gray-100 rounded" />
                 <div className="w-3/4 h-2 bg-gray-100 rounded" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 h-16" />
                  ))}
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Action */}
      <div className="md:hidden fixed bottom-24 left-0 right-0 z-[90] px-4">
        <div className="max-w-md mx-auto h-20 bg-gray-100 rounded-[2rem]" />
      </div>
    </div>
  );
}
