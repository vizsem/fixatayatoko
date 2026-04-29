'use client';

import { Trash2, Plus, Minus } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  stock: number;
}

interface CartTableProps {
  cart: CartItem[];
  onUpdateQty: (id: string, delta: number) => void;
  onSetQty: (id: string, qty: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onUpdateUnit: (id: string, unit: string) => void;
  onRemove: (id: string) => void;
}

export const CartTable = ({ cart, onUpdateQty, onSetQty, onUpdatePrice, onUpdateUnit, onRemove }: CartTableProps) => {
  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] border-2 border-dashed border-gray-100 p-12 text-center">
        <p className="text-[10px] font-black text-gray-300 tracking-[0.2em]">Keranjang Kosong</p>
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
                <td className="px-4 py-2.5 sm:w-2/5">
                  <p className="text-[11px] font-black text-gray-800">{item.name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <select 
                      className="text-[9px] font-bold text-gray-400 uppercase bg-gray-50 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-orange-500"
                      value={item.unit}
                      onChange={(e) => onUpdateUnit(item.id, e.target.value)}
                    >
                      <option value="PCS">PCS</option>
                      <option value="BOX">BOX</option>
                      <option value="STRIP">STRIP</option>
                      <option value="TUBE">TUBE</option>
                      <option value="BOTOL">BOTOL</option>
                      {/* Ensure current unit is an option even if not in the list above */}
                      {!['PCS', 'BOX', 'STRIP', 'TUBE', 'BOTOL'].includes(item.unit.toUpperCase()) && (
                        <option value={item.unit}>{item.unit.toUpperCase()}</option>
                      )}
                    </select>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${item.stock <= 0 ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                      Stok: {item.stock}
                    </span>
                  </div>
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
                <td className="px-4 py-2.5 sm:w-1/5">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => onUpdateQty(item.id, -1)} 
                      className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors active:scale-90"
                    >
                      <Minus size={12} />
                    </button>
                    <input 
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => onSetQty(item.id, Math.max(1, Number(e.target.value)))}
                      className="w-10 text-center text-[11px] font-black bg-gray-50 rounded-lg border-none p-1 outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <button 
                      onClick={() => onUpdateQty(item.id, 1)} 
                      className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors active:scale-90"
                    >
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
