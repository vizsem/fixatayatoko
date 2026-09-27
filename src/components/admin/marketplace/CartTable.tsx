'use client';

import { Trash2, Plus, Minus } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  stock: number; // total base-unit (PCS) stock
  units?: any[];
}

interface CartTableProps {
  cart: CartItem[];
  onUpdateQty: (id: string, delta: number) => void;
  onSetQty: (id: string, qty: number) => void;
  onUpdatePrice: (id: string, price: number) => void;
  onUpdateUnit: (id: string, unit: string) => void;
  onRemove: (id: string) => void;
}

const CTN_ALIASES = ['CTN', 'KARTON', 'DUS', 'BOX'];

export const CartTable = ({ cart, onUpdateQty, onSetQty, onUpdatePrice, onUpdateUnit, onRemove }: CartTableProps) => {
  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] border-2 border-dashed border-gray-100 p-12 text-center">
        <p className="text-xs font-black text-gray-300 tracking-[0.2em]">Keranjang Kosong</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest">Produk & Satuan</th>
              <th className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest">Harga / Satuan</th>
              <th className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
              <th className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Setara PCS</th>
              <th className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cart.map((item) => {
              const currentUnitCode = item.unit?.toUpperCase() || '';
              const isCtnSelected = CTN_ALIASES.includes(currentUnitCode);

              // Find the CTN unit definition (for conversion)
              const ctnUnit = item.units?.find((u: any) =>
                CTN_ALIASES.includes(u.code?.toUpperCase())
              );
              const containsPerUnit = isCtnSelected && ctnUnit
                ? Number(ctnUnit.contains || 1)
                : 1;

              // Total base-PCS this order line represents
              const totalPcs = item.quantity * containsPerUnit;

              // Stock in selected unit
              const stockInUnit = isCtnSelected && containsPerUnit > 1
                ? Math.floor(item.stock / containsPerUnit)
                : item.stock;
              const stockIsLow = item.stock <= 0 || (isCtnSelected && stockInUnit <= 0);

              // All available unit options for this product
              const unitOptions: { code: string; label: string; price?: number }[] = [];
              if (item.units && item.units.length > 0) {
                item.units.forEach((u: any) => {
                  if (u.code) unitOptions.push({ code: u.code.toUpperCase(), label: u.code.toUpperCase(), price: u.price });
                });
              }
              if (!unitOptions.some(u => u.code === currentUnitCode)) {
                unitOptions.push({ code: currentUnitCode, label: currentUnitCode });
              }

              return (
                <tr key={item.id} className="group hover:bg-gray-50/50 transition-all">
                  {/* ── Kolom: Produk & Satuan ── */}
                  <td className="px-4 py-3 sm:w-2/5">
                    <p className="text-xs font-black text-gray-800 mb-1">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Unit Selector */}
                      <select
                        className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                        value={item.unit}
                        onChange={(e) => onUpdateUnit(item.id, e.target.value)}
                        title="Pilih satuan"
                      >
                        {unitOptions.map((u) => (
                          <option key={u.code} value={u.code}>{u.label}</option>
                        ))}
                      </select>

                      {/* Stock Badge */}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg ${
                        stockIsLow ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'
                      }`}>
                        Stok: {stockInUnit} {isCtnSelected ? item.unit : 'pcs'}
                        {isCtnSelected && containsPerUnit > 1 && (
                          <span className="font-normal text-blue-400"> ({item.stock} pcs)</span>
                        )}
                      </span>

                      {/* Conversion info */}
                      {ctnUnit && containsPerUnit > 1 && (
                        <span className="text-[10px] font-semibold text-gray-300 uppercase">
                          1 {ctnUnit.code?.toUpperCase()} = {containsPerUnit} pcs
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ── Kolom: Harga per Satuan ── */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-gray-400">Rp</span>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => onUpdatePrice(item.id, Number(e.target.value))}
                          className="w-24 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-xs font-black outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 font-semibold pl-1">
                        per {currentUnitCode}
                      </span>
                    </div>
                  </td>

                  {/* ── Kolom: Qty (dalam satuan dipilih) ── */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="p-1.5 bg-gray-100 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors active:scale-90"
                      >
                        <Minus size={11} />
                      </button>
                      <div className="text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => onSetQty(item.id, Math.max(1, Number(e.target.value)))}
                          className="w-10 text-center text-xs font-black bg-gray-50 border border-gray-100 rounded-lg p-1 outline-none focus:ring-1 focus:ring-orange-400"
                        />
                        <div className="text-[10px] text-gray-400 mt-0.5">{currentUnitCode}</div>
                      </div>
                      <button
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="p-1.5 bg-gray-100 rounded-lg hover:bg-green-50 hover:text-green-600 transition-colors active:scale-90"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </td>

                  {/* ── Kolom: Setara PCS ── */}
                  <td className="px-4 py-3 text-center">
                    {containsPerUnit > 1 ? (
                      <div>
                        <span className="text-xs font-black text-indigo-600">{totalPcs}</span>
                        <div className="text-[10px] text-gray-400">pcs</div>
                      </div>
                    ) : (
                      <span className="text-xs font-black text-gray-300">—</span>
                    )}
                  </td>

                  {/* ── Kolom: Subtotal ── */}
                  <td className="px-4 py-3 text-right">
                    <div>
                      <div className="text-xs font-black text-gray-900">
                        Rp{(item.price * item.quantity).toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {item.quantity} {currentUnitCode} × Rp{item.price.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </td>

                  {/* ── Kolom: Hapus ── */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-2 text-gray-200 hover:text-red-400 hover:bg-red-50 rounded-xl transition-all"
                      title="Hapus dari keranjang"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
