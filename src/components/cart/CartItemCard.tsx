import NextImage from 'next/image';
import { Trash2, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/lib/types';

interface CartItemCardProps {
  item: CartItem;
  onUpdateQty: (id: string, qty: number) => void;
  onUpdateUnit: (id: string, unit: string) => void;
  onRemove: (id: string) => void;
  availableUnits: Array<{ code: string; contains: number }>;
  lineTotal: number;
}

export function CartItemCard({ item, onUpdateQty, onUpdateUnit, onRemove, availableUnits, lineTotal }: CartItemCardProps) {
  const itemId = item.id || (item as any).ID || (item as any).productId || '';
  const unit = String(item.unit || item.baseUnit || 'PCS').toUpperCase();
  const contains = Math.max(1, Math.floor(Number(item.unitContains || 1)));
  const maxUnits = contains > 0 ? Math.max(1, Math.floor(Number(item.stock || 0) / contains)) : item.quantity;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3 md:p-4 shadow-sm hover:shadow-md transition-all group">
      <div className="flex gap-4">
        <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 relative">
          <NextImage
            src={item.Link_Foto || item.image || '/logo-atayatoko.png'}
            alt={item.name || 'Produk'}
            fill
            className="rounded-xl object-cover border border-slate-100"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xs md:text-sm font-black text-slate-800 uppercase tracking-tight line-clamp-2 leading-tight mb-1">
                {item.name || (item as any).Nama}
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                Stok: {Number(item.stock || 0).toLocaleString()} {item.baseUnit || 'PCS'}
              </p>
            </div>
            <button
              onClick={() => onRemove(itemId)}
              className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
             <div className="flex items-center gap-3">
                {/* Unit Selector */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
                   <select
                     value={unit}
                     disabled={item.promoType === 'TEBUS_MURAH'}
                     onChange={(e) => onUpdateUnit(itemId, e.target.value)}
                     className="bg-transparent text-[10px] font-black text-slate-700 outline-none uppercase"
                   >
                     {availableUnits.map((u) => (
                       <option key={u.code} value={u.code}>{u.code}</option>
                     ))}
                   </select>
                </div>

                {/* Qty Counter */}
                <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl p-1">
                   <button
                     onClick={() => onUpdateQty(itemId, Number(item.quantity || 1) - 1)}
                     className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                   >
                     <Minus size={12} />
                   </button>
                   <span className="w-8 text-center text-[10px] font-black text-slate-900">{item.quantity}</span>
                   <button
                     onClick={() => onUpdateQty(itemId, Number(item.quantity || 1) + 1)}
                     className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"
                   >
                     <Plus size={12} />
                   </button>
                </div>
             </div>

             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
                <p className="text-sm font-black text-green-600">Rp {lineTotal.toLocaleString('id-ID')}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
