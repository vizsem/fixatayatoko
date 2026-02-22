import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wallet, Ticket } from 'lucide-react';

type MemberCardProps = {
  name: string;
  memberId: string;
  points: number;
  walletBalance?: number;
  level: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
};

export default function MemberCard({ name, memberId, points, walletBalance, level }: MemberCardProps) {
  // Tentukan warna berdasarkan level
  const getLevelColor = () => {
    switch (level) {
      case 'Platinum': return 'bg-gradient-to-r from-slate-800 to-slate-600 text-white';
      case 'Gold': return 'bg-gradient-to-r from-amber-500 to-amber-300 text-amber-900';
      case 'Silver': return 'bg-gradient-to-r from-slate-400 to-slate-200 text-slate-800';
      default: return 'bg-gradient-to-r from-emerald-500 to-emerald-300 text-emerald-900'; // Bronze - lebih fresh
    }
  };

  return (
    <div 
      className={`w-full max-w-md md:max-w-sm lg:max-w-xs aspect-[1.586] rounded-2xl p-5 md:p-4 relative overflow-hidden shadow-xl transition-all hover:scale-[1.01] ${getLevelColor()}`}
      data-testid="member-card"
    >
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black opacity-5 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl"></div>

      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-70 mb-1">ATAYATOKO MEMBER</h3>
            <h2 className="text-xl md:text-lg font-bold uppercase tracking-tight line-clamp-1">{name}</h2>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-white/20 backdrop-blur rounded-lg border border-white/10">
               {level}
             </span>
          </div>
        </div>

        {/* Content: Barcode & Points */}
        <div className="flex items-end justify-between mt-4">
          <div className="flex flex-col gap-1">
             <div className="bg-white p-1.5 rounded-lg inline-block shadow-sm">
                <QRCodeSVG value={memberId} size={48} className="md:w-10 md:h-10" />
             </div>
             <p className="text-[7px] font-mono mt-0.5 opacity-80">{memberId}</p>
          </div>

          <div className="flex items-center gap-4">
            {typeof walletBalance === 'number' && (
              <div className="flex flex-col items-end">
                <p className="text-[8px] font-medium uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1"><Wallet size={8}/> Saldo</p>
                <p className="text-lg font-bold tracking-tight">Rp{walletBalance.toLocaleString()}</p>
              </div>
            )}
            <div className="flex flex-col items-end">
              <p className="text-[8px] font-medium uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1"><Ticket size={8}/> Poin</p>
              <p className="text-2xl md:text-xl font-bold tracking-tight">{points.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        {/* Footer Barcode - Removed due to dependency issues */}
      </div>
    </div>
  );
}
