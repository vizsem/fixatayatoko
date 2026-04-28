import { ShoppingBag, Ticket, Coins, Wallet, CreditCard } from 'lucide-react';

interface SummaryProps {
  subtotal: number;
  pointsToUse: number;
  voucherDiscount: number;
  walletToUse: number;
  total: number;
  isSubmitting: boolean;
  onCheckout: () => void;
  canCheckout: boolean;
  validationMsg: string;
}

export function CheckoutSummary({ subtotal, pointsToUse, voucherDiscount, walletToUse, total, isSubmitting, onCheckout, canCheckout, validationMsg }: SummaryProps) {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 sticky top-24">
      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3">
        <CreditCard size={18} className="text-blue-600" /> Order Summary
      </h2>

      <div className="space-y-4 mb-8">
        <SummaryLine label="Items Subtotal" value={subtotal} />
        {pointsToUse > 0 && <SummaryLine label="Points Discount" value={-pointsToUse} color="text-emerald-600" icon={Coins} />}
        {voucherDiscount > 0 && <SummaryLine label="Voucher Discount" value={-voucherDiscount} color="text-emerald-600" icon={Ticket} />}
        {walletToUse > 0 && <SummaryLine label="Wallet Payment" value={-walletToUse} color="text-blue-600" icon={Wallet} />}
        
        <div className="h-px bg-slate-100 my-6" />
        
        <div className="flex justify-between items-end">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grand Total</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">Rp {total.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {!canCheckout && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-6 text-center">
           <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-relaxed">{validationMsg}</p>
        </div>
      )}

      <button 
        onClick={onCheckout}
        disabled={!canCheckout || isSubmitting}
        className="w-full py-5 bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-green-100 hover:bg-green-700 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center gap-2">
             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
             PROCESSING...
          </div>
        ) : (
          <span className="flex items-center justify-center gap-2">
             PLACE ORDER <ShoppingBag size={18} className="group-hover:translate-x-1 transition-transform" />
          </span>
        )}
      </button>

      <p className="text-center text-[10px] font-bold text-slate-400 mt-6 leading-relaxed">
        By placing an order, you agree to our <span className="text-slate-900 underline">Terms of Service</span> and <span className="text-slate-900 underline">Privacy Policy</span>.
      </p>
    </div>
  );
}

function SummaryLine({ label, value, color = 'text-slate-900', icon: Icon }: any) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className={color} />}
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className={`text-xs font-black ${color}`}>
        {value < 0 ? '-' : ''} Rp {Math.abs(value).toLocaleString('id-ID')}
      </p>
    </div>
  );
}
