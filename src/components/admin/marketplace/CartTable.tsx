'use client';

import { Trash2, Plus, Minus } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface CartTableProps {
  cart: CartItem[];
  onUpdateQty: (id: string, delta: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
}

export const CartTable = ({ cart, onUpdateQty, onUpdatePrice, onRemove }: CartTableProps) => {
  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] border-2 border-dashed border-gray-100 p-12 text-center">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Keranjang Kosong</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
              <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Harga</th>
              <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">QTY</th>
              <th className="px-4 py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cart.map((item) => (
              <tr key={item.id} className="group hover:bg-gray-50/50 transition-all">
                <td className="px-4 py-2.5">
                  <p className="text-[11px] font-black text-gray-800 uppercase">{item.name}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{item.unit}</p>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-gray-400">Rp</span>
                    <input 
                      type="number"
                      value={item.price}
                      onChange={(e) => onUpdatePrice(item.id, Number(e.target.value))}
                      className="w-24 bg-gray-50 border-none rounded-lg px-2 py-1 text-[11px] font-black outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => onUpdateQty(item.id, -1)} className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                    <button onClick={() => onUpdateQty(item.id, 1)} className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      <Plus size={12} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-black text-[11px] text-gray-900">
                  Rp{(item.price * item.quantity).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => onRemove(item.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
