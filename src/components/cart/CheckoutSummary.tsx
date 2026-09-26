// src/components/cart/CheckoutSummary.tsx
import Link from 'next/link';
import { ShoppingBag, Ticket, Coins, Wallet, CreditCard, Truck, Sparkles, ShieldCheck } from 'lucide-react';
import CustomerGuarantees from '@/components/common/CustomerGuarantees';

interface SummaryProps {
  subtotal: number;
  shippingCost?: number;
  shippingMethodName?: string;
  pointsToUse: number;
  voucherDiscount: number;
  walletToUse: number;
  total: number;
  isSubmitting: boolean;
  onCheckout: () => void;
  canCheckout: boolean;
  validationMsg: string;
}

export function CheckoutSummary({
  subtotal, shippingCost = 0, shippingMethodName,
  pointsToUse, voucherDiscount, walletToUse, total,
  isSubmitting, onCheckout, canCheckout, validationMsg
}: SummaryProps) {
  return (
    <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl border border-slate-100 sticky top-24 space-y-6">
      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
        <CreditCard size={18} className="text-emerald-600" /> Ringkasan Pembayaran
      </h2>

      <div className="space-y-4">
        <SummaryLine label="Subtotal Belanja" value={subtotal} />
        
        {/* Shipping Line */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <Truck size={14} className={shippingCost === 0 ? 'text-emerald-600' : 'text-slate-400'} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Ongkir {shippingMethodName ? `(${shippingMethodName})` : ''}
              </p>
            </div>
          </div>
          <div>
            {shippingCost === 0 ? (
              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles size={11} /> GRATIS
              </span>
            ) : (
              <p className="text-xs font-black text-slate-900">
                Rp {shippingCost.toLocaleString('id-ID')}
              </p>
            )}
          </div>
        </div>

        {pointsToUse > 0 && <SummaryLine label="Diskon Poin" value={-pointsToUse} color="text-emerald-600" icon={Coins} />}
        {voucherDiscount > 0 && <SummaryLine label="Potongan Voucher" value={-voucherDiscount} color="text-emerald-600" icon={Ticket} />}
        {walletToUse > 0 && <SummaryLine label="Pembayaran Saldo" value={-walletToUse} color="text-blue-600" icon={Wallet} />}
        
        <div className="h-px bg-slate-100 my-4" />
        
        <div className="flex justify-between items-end">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Tagihan</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">Rp {total.toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* 4 Jaminan Layanan Pelanggan */}
      <CustomerGuarantees variant="checkout" />

      {!canCheckout && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
           <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-relaxed">{validationMsg}</p>
        </div>
      )}

      <button 
        onClick={onCheckout}
        disabled={!canCheckout || isSubmitting}
        className="w-full py-5 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center gap-2">
             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
             MEMPROSES PESANAN...
          </div>
        ) : (
          <span className="flex items-center justify-center gap-2">
             KONFIRMASI PESANAN <ShoppingBag size={18} className="group-hover:translate-x-1 transition-transform" />
          </span>
        )}
      </button>

      <p className="text-center text-[10px] text-slate-400 leading-relaxed px-2">
        Dengan menekan tombol, Anda menyetujui{' '}
        <Link href="/syarat-ketentuan" className="text-emerald-700 font-bold underline hover:text-emerald-800" target="_blank">
          Syarat & Ketentuan
        </Link>{' '}
        dan{' '}
        <Link href="/kebijakan-privasi" className="text-emerald-700 font-bold underline hover:text-emerald-800" target="_blank">
          Kebijakan Privasi
        </Link>{' '}
        ATAYATOKO.
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
