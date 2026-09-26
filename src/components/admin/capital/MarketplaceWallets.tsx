import { Store, Plus, RefreshCcw, ExternalLink, Wallet } from 'lucide-react';

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
    <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Store size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Saldo Marketplace</h3>
            <p className="text-xs text-slate-500 mt-0.5">Lacak saldo aktif & escrow tertahan real-time</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Saldo Channel</p>
            <p className="text-lg sm:text-xl font-black text-purple-600">Rp {totalAssets.toLocaleString('id-ID')}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onImport} 
              className="px-3.5 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all border border-slate-200/80 active:scale-95"
            >
              Refresh Data
            </button>
            <button 
              onClick={onAddAccount} 
              className="px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all shadow-sm shadow-purple-200 flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={15} /> Tambah Akun
            </button>
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-500">Belum ada akun marketplace yang terhubung</p>
          <button 
            onClick={onAddAccount}
            className="mt-2 text-xs font-bold text-purple-600 hover:underline"
          >
            + Tambah akun Shopee, TikTok, Tokopedia sekarang
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts.map((acc) => (
            <div key={acc.id} className="bg-slate-50/50 hover:bg-white border border-slate-200/70 hover:border-purple-200 rounded-xl p-4.5 hover:shadow-sm transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{acc.name}</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">
                      {acc.storeName || 'Toko Utama'}
                    </p>
                  </div>
                  <button 
                    onClick={() => onEdit(acc)} 
                    className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Edit Saldo"
                  >
                    <RefreshCcw size={14} />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="bg-white p-3 rounded-lg border border-slate-200/60 shadow-2xs">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Saldo Aktif (Siap Tarik)</p>
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-sm font-black text-emerald-600">Rp {acc.activeBalance.toLocaleString('id-ID')}</p>
                      {acc.activeBalance > 0 && (
                        <button 
                          onClick={() => onWithdraw(acc)} 
                          className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-1 active:scale-95"
                        >
                          <ExternalLink size={10} /> Tarik
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="px-2 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400">Saldo Tertunda:</span>
                    <span className="text-xs font-bold text-slate-600">Rp {acc.pendingBalance.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

