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
      case 'Platinum': return 'bg-gradient-to-r from-slate-900 to-slate-700 text-white';
      case 'Gold': return 'bg-gradient-to-r from-yellow-500 to-yellow-300 text-yellow-900';
      case 'Silver': return 'bg-gradient-to-r from-gray-400 to-gray-200 text-gray-800';
      default: return 'bg-gradient-to-r from-orange-400 to-orange-200 text-orange-900'; // Bronze
    }
  };

  return (
    <div 
      className={`w-full aspect-[1.586] rounded-[2rem] p-6 relative overflow-hidden shadow-2xl transition-all hover:scale-[1.02] ${getLevelColor()}`}
      data-testid="member-card"
    >
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-black opacity-5 rounded-full translate-y-1/3 -translate-x-1/3 blur-2xl"></div>

      <div className="relative z-10 h-full flex flex-col justify-between">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">ATAYATOKO MEMBER</h3>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter line-clamp-1">{name}</h2>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-white/20 backdrop-blur rounded-lg border border-white/10">
               {level}
             </span>
          </div>
        </div>

        {/* Content: Barcode & Points */}
        <div className="flex items-end justify-between mt-4">
          <div className="flex flex-col gap-1">
             <div className="bg-white p-2 rounded-xl inline-block shadow-sm">
                <QRCodeSVG value={memberId} size={64} />
             </div>
             <p className="text-[8px] font-mono mt-1 opacity-80">{memberId}</p>
          </div>

          <div className="flex items-center gap-4">
            {typeof walletBalance === 'number' && (
              <div className="flex flex-col items-end">
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1"><Wallet size={10}/> Saldo</p>
                <p className="text-xl font-black italic tracking-tighter">Rp{walletBalance.toLocaleString()}</p>
              </div>
            )}
            <div className="flex flex-col items-end">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1"><Ticket size={10}/> Poin</p>
              <p className="text-3xl font-black italic tracking-tighter">{points.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        {/* Footer Barcode - Removed due to dependency issues */}
      </div>
    </div>
  );
}
