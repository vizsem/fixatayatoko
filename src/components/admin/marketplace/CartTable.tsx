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
  isCustomPrice?: boolean;
  defaultPrice?: number;
  lastInputtedPrice?: number;
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
              <th className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Setara Satuan Dasar</th>
              <th className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Subtotal</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cart.map((item) => {
              const currentUnitCode = item.unit?.toUpperCase() || '';
              const selectedUnit = item.units?.find((u: any) =>
                u.code?.toUpperCase() === currentUnitCode
              );

              // Conversion is defined by the product's configured unit, whatever its code.
              const configuredContains = Number(selectedUnit?.contains || 1);
              const containsPerUnit = Number.isFinite(configuredContains) && configuredContains > 0
                ? configuredContains
                : 1;
              const baseUnitCode = item.units?.find((u: any) =>
                Number(u.contains || 0) === 1
              )?.code?.toUpperCase() || 'PCS';

              // Total base units this order line represents
              const totalBaseUnits = item.quantity * containsPerUnit;

              // Stock in selected unit
              const stockInUnit = containsPerUnit > 1
                ? Math.floor(item.stock / containsPerUnit)
                : item.stock;
              const stockIsLow = item.stock <= 0 || stockInUnit <= 0;

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
                        Stok: {stockInUnit} {containsPerUnit > 1 ? currentUnitCode : baseUnitCode}
                        {containsPerUnit > 1 && (
                          <span className="font-normal text-blue-400"> ({item.stock} {baseUnitCode})</span>
                        )}
                      </span>

                      {/* Conversion info */}
                      {selectedUnit && containsPerUnit > 1 && (
                        <span className="text-[10px] font-semibold text-gray-300 uppercase">
                          1 {currentUnitCode} = {containsPerUnit} {baseUnitCode}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ── Kolom: Harga per Satuan ── */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-gray-400">Rp</span>
                        <input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => onUpdatePrice(item.id, Number(e.target.value))}
                          className="w-28 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 text-xs font-black outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 pl-1">
                        <span className="text-[10px] text-gray-400 font-semibold">
                          per {currentUnitCode}
                        </span>

                        {/* Rekomendasi nominal terakhir yang diinput */}
                        {typeof item.lastInputtedPrice === 'number' && item.lastInputtedPrice > 0 && (
                          item.price === item.lastInputtedPrice ? (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200/70 px-1.5 py-0.5 rounded w-fit">
                                ✨ Sesuai input terakhir
                              </span>
                              {typeof item.defaultPrice === 'number' && item.defaultPrice > 0 && item.defaultPrice !== item.price && (
                                <button
                                  type="button"
                                  onClick={() => onUpdatePrice(item.id, item.defaultPrice!)}
                                  className="text-[9px] font-bold text-gray-400 hover:text-blue-600 underline text-left w-fit"
                                  title={`Kembalikan ke harga bawaan produk: Rp ${item.defaultPrice.toLocaleString('id-ID')}`}
                                >
                                  (Reset: Rp {item.defaultPrice.toLocaleString('id-ID')})
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onUpdatePrice(item.id, item.lastInputtedPrice!)}
                              className="inline-flex items-center gap-1 text-[9px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded transition-all text-left w-fit mt-0.5"
                              title="Klik untuk menggunakan nominal harga yang terakhir kali Anda input"
                            >
                              <span>💡 Pakai terakhir: Rp {item.lastInputtedPrice.toLocaleString('id-ID')}</span>
                            </button>
                          )
                        )}
                      </div>
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
                        <span className="text-xs font-black text-indigo-600">{totalBaseUnits}</span>
                        <div className="text-[10px] text-gray-400">{baseUnitCode}</div>
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
