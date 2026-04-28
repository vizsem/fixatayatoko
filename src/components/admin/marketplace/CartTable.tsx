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
  onRemove: (id: string) => void;
}

export const CartTable = ({ cart, onUpdateQty, onRemove }: CartTableProps) => {
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
              <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Produk</th>
              <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Harga</th>
              <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">QTY</th>
              <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cart.map((item) => (
              <tr key={item.id} className="group hover:bg-gray-50/50 transition-all">
                <td className="px-6 py-4">
                  <p className="text-[11px] font-black text-gray-800 uppercase">{item.name}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase">{item.unit}</p>
                </td>
                <td className="px-6 py-4 font-black text-[11px] text-gray-700">
                  Rp{item.price.toLocaleString()}
                </td>
                <td className="px-6 py-4">
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
                <td className="px-6 py-4 text-right font-black text-[11px] text-gray-900">
                  Rp{(item.price * item.quantity).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
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
