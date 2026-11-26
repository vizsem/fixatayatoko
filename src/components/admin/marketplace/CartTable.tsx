'use client';

import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';

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

export const CartTable = ({
  cart,
  onUpdateQty,
  onSetQty,
  onUpdatePrice,
  onUpdateUnit,
  onRemove,
}: CartTableProps) => {
  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-10 md:p-12 text-center">
        <ShoppingCart className="mx-auto text-slate-300 mb-2.5" size={36} />
        <p className="text-sm font-bold text-slate-600">Keranjang Pesanan Masih Kosong</p>
        <p className="text-xs text-slate-400 mt-1">
          Gunakan kolom pencarian produk untuk menambahkan barang ke pesanan ini.
        </p>
      </div>
    );
  }

  const prepareRowData = (item: CartItem) => {
    const currentUnitCode = item.unit?.toUpperCase() || '';
    const selectedUnit = item.units?.find(
      (u: any) => u.code?.toUpperCase() === currentUnitCode
    );
    const configuredContains = Number(selectedUnit?.contains || 1);
    const containsPerUnit =
      Number.isFinite(configuredContains) && configuredContains > 0 ? configuredContains : 1;
    const baseUnitCode =
      item.units?.find((u: any) => Number(u.contains || 0) === 1)?.code?.toUpperCase() || 'PCS';
    const totalBaseUnits = item.quantity * containsPerUnit;
    const stockInUnit =
      containsPerUnit > 1 ? Math.floor(item.stock / containsPerUnit) : item.stock;
    const stockIsLow = item.stock <= 0 || stockInUnit <= 0;

    const unitOptions: { code: string; label: string; price?: number }[] = [];
    if (item.units && item.units.length > 0) {
      item.units.forEach((u: any) => {
        if (u.code) {
          unitOptions.push({
            code: u.code.toUpperCase(),
            label: u.code.toUpperCase(),
            price: u.price,
          });
        }
      });
    }
    if (!unitOptions.some((u) => u.code === currentUnitCode)) {
      unitOptions.push({ code: currentUnitCode, label: currentUnitCode });
    }

    return {
      currentUnitCode,
      selectedUnit,
      containsPerUnit,
      baseUnitCode,
      totalBaseUnits,
      stockInUnit,
      stockIsLow,
      unitOptions,
    };
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Tampilan Mobile: Kartu Vertikal (Tanpa Scroll Samping) */}
      <div className="md:hidden divide-y divide-slate-100">
        {cart.map((item) => {
          const {
            currentUnitCode,
            containsPerUnit,
            baseUnitCode,
            totalBaseUnits,
            stockInUnit,
            stockIsLow,
            unitOptions,
          } = prepareRowData(item);

          return (
            <div key={item.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 leading-snug">{item.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <select
                      className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 outline-none"
                      value={item.unit}
                      onChange={(e) => onUpdateUnit(item.id, e.target.value)}
                    >
                      {unitOptions.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg tabular-nums ${
                        stockIsLow
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      Stok: {stockInUnit} {containsPerUnit > 1 ? currentUnitCode : baseUnitCode}
                    </span>
                    {containsPerUnit > 1 && (
                      <span className="text-[11px] font-medium text-slate-500">
                        (1 {currentUnitCode} = {containsPerUnit} {baseUnitCode})
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                  title="Hapus dari keranjang"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Harga / {currentUnitCode}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={item.price}
                      onChange={(e) => onUpdatePrice(item.id, Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-2.5 py-2 text-xs font-bold tabular-nums text-slate-900 outline-none focus:bg-white focus:border-orange-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Jumlah ({currentUnitCode})
                  </label>
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, -1)}
                      className="p-1.5 bg-white rounded-lg text-slate-600 hover:text-rose-600 shadow-2xs active:scale-90"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => onSetQty(item.id, Math.max(1, Number(e.target.value)))}
                      className="w-12 text-center text-xs font-bold tabular-nums bg-transparent outline-none text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, 1)}
                      className="p-1.5 bg-white rounded-lg text-slate-600 hover:text-emerald-600 shadow-2xs active:scale-90"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {typeof item.lastInputtedPrice === 'number' &&
                item.lastInputtedPrice > 0 &&
                item.price !== item.lastInputtedPrice && (
                  <button
                    type="button"
                    onClick={() => onUpdatePrice(item.id, item.lastInputtedPrice!)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg"
                  >
                    Pakai harga terakhir: Rp {item.lastInputtedPrice.toLocaleString('id-ID')}
                  </button>
                )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-500 font-medium tabular-nums">
                  {containsPerUnit > 1 ? `Setara ${totalBaseUnits} ${baseUnitCode}` : 'Subtotal'}
                </span>
                <span className="font-extrabold text-slate-900 tabular-nums text-sm">
                  Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tampilan Desktop: Tabel Rapi */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-500">Produk &amp; Satuan</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500">Harga / Satuan</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 text-center">Qty</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 text-center">Setara Dasar</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 text-right">Subtotal</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cart.map((item) => {
              const {
                currentUnitCode,
                containsPerUnit,
                baseUnitCode,
                totalBaseUnits,
                stockInUnit,
                stockIsLow,
                unitOptions,
              } = prepareRowData(item);

              return (
                <tr key={item.id} className="group hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3.5 sm:w-2/5">
                    <p className="text-xs font-bold text-slate-900 mb-1.5 leading-snug">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                        value={item.unit}
                        onChange={(e) => onUpdateUnit(item.id, e.target.value)}
                        title="Pilih satuan"
                      >
                        {unitOptions.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.label}
                          </option>
                        ))}
                      </select>

                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg tabular-nums ${
                          stockIsLow
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        Stok: {stockInUnit} {containsPerUnit > 1 ? currentUnitCode : baseUnitCode}
                        {containsPerUnit > 1 && (
                          <span className="font-normal text-blue-500">
                            {' '}({item.stock} {baseUnitCode})
                          </span>
                        )}
                      </span>

                      {containsPerUnit > 1 && (
                        <span className="text-[11px] font-medium text-slate-500">
                          1 {currentUnitCode} = {containsPerUnit} {baseUnitCode}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-slate-400">Rp</span>
                        <input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => onUpdatePrice(item.id, Number(e.target.value))}
                          className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums text-slate-900 outline-none focus:bg-white focus:border-orange-400"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 pl-1">
                        <span className="text-[11px] text-slate-400 font-medium">
                          per {currentUnitCode}
                        </span>

                        {typeof item.lastInputtedPrice === 'number' && item.lastInputtedPrice > 0 && (
                          item.price === item.lastInputtedPrice ? (
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded w-fit">
                                Sesuai input terakhir
                              </span>
                              {typeof item.defaultPrice === 'number' &&
                                item.defaultPrice > 0 &&
                                item.defaultPrice !== item.price && (
                                  <button
                                    type="button"
                                    onClick={() => onUpdatePrice(item.id, item.defaultPrice!)}
                                    className="text-[10px] font-medium text-slate-500 hover:text-blue-600 underline text-left w-fit"
                                    title={`Kembalikan ke harga bawaan: Rp ${item.defaultPrice.toLocaleString('id-ID')}`}
                                  >
                                    Reset ke Rp {item.defaultPrice.toLocaleString('id-ID')}
                                  </button>
                                )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onUpdatePrice(item.id, item.lastInputtedPrice!)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded transition-all text-left w-fit mt-0.5"
                              title="Klik untuk menggunakan nominal harga yang terakhir diinput"
                            >
                              Pakai terakhir: Rp {item.lastInputtedPrice.toLocaleString('id-ID')}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="p-1.5 bg-slate-100 rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors active:scale-90"
                      >
                        <Minus size={12} />
                      </button>
                      <div className="text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => onSetQty(item.id, Math.max(1, Number(e.target.value)))}
                          className="w-11 text-center text-xs font-bold tabular-nums bg-slate-50 border border-slate-200 rounded-lg p-1 outline-none focus:bg-white focus:border-orange-400"
                        />
                        <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                          {currentUnitCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="p-1.5 bg-slate-100 rounded-lg text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors active:scale-90"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-center">
                    {containsPerUnit > 1 ? (
                      <div>
                        <span className="text-xs font-bold tabular-nums text-indigo-600">
                          {totalBaseUnits}
                        </span>
                        <div className="text-[10px] font-medium text-slate-400">{baseUnitCode}</div>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-300">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <div className="text-xs font-extrabold tabular-nums text-slate-900">
                      Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                    </div>
                    <div className="text-[11px] font-medium tabular-nums text-slate-400">
                      {item.quantity} {currentUnitCode} × Rp {item.price.toLocaleString('id-ID')}
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
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
