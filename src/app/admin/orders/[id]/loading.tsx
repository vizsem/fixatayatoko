export default function OrderDetailLoading() {
  return (
    <div className="bg-gray-50 md:p-4 text-black font-sans min-h-screen animate-pulse">
      <div className="max-w-4xl mx-auto bg-white shadow-2xl md:rounded-[3rem] overflow-hidden border border-white">
        {/* Top Header Bar Skeleton */}
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-200 rounded-2xl" />
            <div className="space-y-2">
              <div className="h-6 w-40 bg-slate-200 rounded-lg" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-24 h-9 bg-slate-200 rounded-xl" />
            <div className="w-20 h-9 bg-slate-200 rounded-xl" />
          </div>
        </div>

        <div className="p-5 md:p-6 space-y-8">
          {/* Invoice Header Skeleton */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b-2 border-slate-100 pb-12">
            <div className="space-y-3">
              <div className="h-10 w-44 bg-slate-200 rounded-xl" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
              <div className="h-3 w-48 bg-slate-100 rounded" />
            </div>
            <div className="space-y-2 md:text-right">
              <div className="h-7 w-28 bg-slate-200 rounded-xl md:ml-auto" />
              <div className="h-5 w-36 bg-slate-200 rounded-lg md:ml-auto" />
              <div className="h-3 w-24 bg-slate-100 rounded md:ml-auto" />
            </div>
          </div>

          {/* Customer & Delivery Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-slate-50 rounded-[2rem] space-y-3">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-48 bg-slate-200 rounded-lg" />
              <div className="h-4 w-32 bg-slate-100 rounded" />
            </div>
            <div className="p-6 bg-slate-50 rounded-[2rem] space-y-3">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-40 bg-slate-200 rounded-lg" />
              <div className="h-4 w-28 bg-slate-100 rounded" />
            </div>
          </div>

          {/* Payment Summary Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-32 bg-slate-200 rounded-lg" />
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-28 bg-slate-200 rounded-lg" />
            </div>
            <div className="p-6 bg-slate-200 rounded-3xl space-y-2">
              <div className="h-3 w-20 bg-slate-300 rounded" />
              <div className="h-7 w-36 bg-slate-300 rounded-lg" />
            </div>
          </div>

          {/* Items Table Skeleton */}
          <div className="space-y-4 pt-4">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div className="space-y-2">
                    <div className="h-4 w-48 bg-slate-200 rounded" />
                    <div className="h-3 w-24 bg-slate-100 rounded" />
                  </div>
                  <div className="h-5 w-20 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
