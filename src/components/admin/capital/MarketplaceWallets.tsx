import { Store, Plus, RefreshCcw, ExternalLink } from 'lucide-react';

interface MarketplaceAccount {
  id: string;
  name: string;
  storeName?: string;
  activeBalance: number;
  pendingBalance: number;
  lastUpdated?: any;
}

interface WalletsProps {
  accounts: MarketplaceAccount[];
  totalAssets: number;
  onAddAccount: () => void;
  onImport: () => void;
  onEdit: (acc: MarketplaceAccount) => void;
  onWithdraw: (acc: MarketplaceAccount) => void;
}

export function MarketplaceWallets({ accounts, totalAssets, onAddAccount, onImport, onEdit, onWithdraw }: WalletsProps) {
  return (
    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-3xl">
            <Store size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Marketplace Wallets</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time settlement tracking</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 w-full lg:w-auto">
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Digital Asset Valuation</p>
            <p className="text-2xl font-black text-purple-600">Rp {totalAssets.toLocaleString('id-ID')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onImport} className="px-5 py-3 bg-slate-50 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100">
              Import Settlement
            </button>
            <button onClick={onAddAccount} className="px-5 py-3 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center gap-2">
              <Plus size={14} /> Add Account
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {accounts.map((acc) => (
          <div key={acc.id} className="group bg-[#FBFBFF] border border-slate-100 rounded-[2rem] p-6 hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all relative overflow-hidden">
             <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
               <Store size={100} />
             </div>
             
             <div className="flex justify-between items-start mb-6 relative z-10">
               <div>
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{acc.name}</h4>
                  {acc.storeName ? (
                    <p className="text-sm font-black text-purple-600">{acc.storeName}</p>
                  ) : (
                    <p className="text-xs font-bold text-slate-300 italic">No store name</p>
                  )}
               </div>
               <button onClick={() => onEdit(acc)} className="p-2 text-slate-300 hover:text-slate-900 hover:bg-white rounded-xl shadow-sm transition-all">
                 <RefreshCcw size={16} />
               </button>
             </div>

             <div className="space-y-4 relative z-10">
               <div className="bg-white p-4 rounded-2xl border border-slate-100/50 shadow-sm">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Active Balance</p>
                 <div className="flex items-center justify-between gap-2">
                   <p className="text-lg font-black text-emerald-600">Rp {acc.activeBalance.toLocaleString('id-ID')}</p>
                   {acc.activeBalance > 0 && (
                     <button onClick={() => onWithdraw(acc)} className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 uppercase tracking-tighter">
                       <ExternalLink size={10} /> Withdraw
                     </button>
                   )}
                 </div>
               </div>
               
               <div className="px-4">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-300 mb-1">Pending Settlement</p>
                 <p className="text-sm font-black text-slate-400">Rp {acc.pendingBalance.toLocaleString('id-ID')}</p>
               </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
