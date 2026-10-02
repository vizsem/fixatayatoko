import { supabaseAdmin } from '@/lib/supabase';
import { pushLayer, consumeFifo, type InventoryLayer } from '@/lib/inventory-layers';

export type InventorySource = 'PURCHASE' | 'ORDER' | 'CASHIER' | 'MANUAL' | 'MARKETPLACE' | 'OPNAME' | 'TRANSFER' | 'RECONCILIATION';

export type InventoryLogData = {
  productId?: string
  productName?: string
  amount?: number
  quantity?: number
  adminId?: string
  source?: string
  orderId?: string
  referenceId?: string
  note?: string
  notes?: string
  fromWarehouseId?: string
  toWarehouseId?: string
  warehouseId?: string
  prevStock?: number
  nextStock?: number
  type?: string
  batchNumber?: string
  [key: string]: any
};

/**
 * Kalkulasi Harga Modal rata-rata (WAC — Weighted Average Cost / Moving Average).
 *
 * Formula: AVG_Baru = (Stok_Lama × AVG_Lama + Qty_Beli × Harga_Beli) / (Stok_Lama + Qty_Beli)
 *
 * Perilaku reset:
 * - Jika currentStock = 0 (stok habis), maka AVG_Baru = incomingPrice secara otomatis,
 *   karena tidak ada nilai persediaan lama yang perlu di-average. Ini sesuai standar
 *   akuntansi (IFRS, SAK ETAP, SAK UMKM).
 *
 * @param currentStock  - Stok saat ini (satuan dasar / pcs)
 * @param currentCost   - HPP/AVG saat ini per satuan dasar
 * @param incomingQty   - Jumlah stok masuk (dalam satuan pembelian, mis. dus/karton)
 * @param incomingPrice - Harga beli per satuan dasar (sudah dikonversi ke pcs)
 * @param conversionRate - Konversi satuan pembelian → satuan dasar (default 1)
 */
export function computeAverageCost(
  currentStock: number,
  currentCost: number,
  incomingQty: number,
  incomingPrice: number,
  conversionRate: number = 1
): number {
  // Konversi qty beli ke satuan dasar (pcs)
  const incomingBaseQty = Math.max(0, incomingQty * (conversionRate || 1));

  // Harga per satuan dasar setelah konversi
  const costPerBaseUnit = conversionRate > 1
    ? incomingPrice / conversionRate
    : incomingPrice;

  const totalQty = currentStock + incomingBaseQty;

  // Guard: jika tidak ada stok sama sekali setelah pembelian, kembalikan harga beli
  if (totalQty <= 0) return Math.round(costPerBaseUnit);

  // Jika stok lama = 0 (habis), AVG otomatis reset ke harga beli terbaru
  // (formula WAC menghasilkan ini secara natural: 0 × oldCost + qty × price = qty × price)
  const oldInventoryValue = Math.max(0, currentStock) * currentCost;
  const newInventoryValue = incomingBaseQty * costPerBaseUnit;

  return Math.round((oldInventoryValue + newInventoryValue) / totalQty);
}

export const addInventoryLog = async (logData: InventoryLogData, _batch?: any) => {
  try {
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const entry = {
      ...logData,
      id,
      createdAt: logData.createdAt || logData.date || now,
      updatedAt: now,
    };

    const targetWarehouse = logData.warehouseId || logData.toWarehouseId || logData.fromWarehouseId || 'gudang-utama';

    const { error } = await supabaseAdmin.from('inventory_logs').insert({
      id,
      product_id: logData.productId || null,
      product_name: logData.productName || null,
      warehouse_id: targetWarehouse,
      to_warehouse_id: logData.toWarehouseId || null,
      from_warehouse_id: logData.fromWarehouseId || null,
      type: logData.type || 'MASUK',
      source: logData.source || 'PURCHASE',
      amount: Math.abs(Number(logData.amount || logData.quantity || 0)),
      quantity: Number(logData.quantity || logData.amount || 0),
      prev_stock: logData.prevStock ?? null,
      next_stock: logData.nextStock ?? null,
      reference_id: logData.referenceId || logData.reference || null,
      order_id: logData.orderId || null,
      admin_id: logData.adminId || null,
      note: logData.note || logData.notes || '',
      raw_data: entry,
      created_at: now,
      updated_at: now,
    });

    if (error) {
      console.error('Error adding inventory log in supabaseAdmin:', error);
    }
    return { success: true, id };
  } catch (err) {
    console.error('Failed to add inventory log:', err);
    return { success: false, error: err };
  }
};

/**
 * Deduct stock from product in Supabase (warehouse-aware, with waterfall fallback).
 * warehouseId: explicit warehouse ID, or 'auto' to pick from available stock (gudang-utama first).
 * Returns { success, deducted, warehousesUsed, error }.
 */
export async function deductStockFEFO(
  arg1: string | {
    productId: string;
    amount: number;
    warehouseId?: string;
    reference?: string;
    notes?: string;
    source?: InventorySource;
    adminId?: string;
  },
  warehouseIdArg?: string,
  amountArg?: number,
  referenceArg?: string,
  notesArg?: string
) {
  let productId: string;
  let amount: number;
  let warehouseId: string;
  let reference: string | undefined;
  let notes: string | undefined;
  let source: InventorySource = 'ORDER';
  let adminId: string | undefined;

  if (typeof arg1 === 'object') {
    productId = arg1.productId;
    amount = arg1.amount;
    warehouseId = arg1.warehouseId || 'gudang-utama';
    reference = arg1.reference;
    notes = arg1.notes;
    if (arg1.source) source = arg1.source;
    adminId = arg1.adminId;
  } else {
    productId = arg1;
    warehouseId = warehouseIdArg || 'gudang-utama';
    amount = amountArg || 0;
    reference = referenceArg;
    notes = notesArg;
  }

  if (!amount || isNaN(amount) || amount <= 0) {
    return { success: false, error: 'Jumlah pengeluaran stok harus berupa angka positif lebih dari 0' };
  }

  try {
    const { data: product, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchErr || !product) {
      return { success: false, error: `Produk ID ${productId} tidak ditemukan` };
    }

    const raw = product.raw_data || {};
    const unit = product.unit || raw.unit || 'pcs';
    const currentStock = Number(product.stock ?? raw.stock ?? raw.Stok ?? 0);

    // 🛑 VALIDASI UTAMA: Jangan pernah izinkan barang keluar lebih banyak dari stok asli!
    if (currentStock < amount) {
      return {
        success: false,
        error: `Stok tidak cukup: "${product.name || productId}". Tersedia: ${currentStock} ${unit}, Diminta keluar: ${amount} ${unit}. Stok tidak boleh negatif!`,
      };
    }

    // ── Warehouse waterfall: deduct dari gudang dipilih, sisa dari gudang lain ──
    const MAIN_WH = 'gudang-utama';
    const stockByWarehouse: Record<string, number> = {
      ...(raw.stockByWarehouse || {}),
    };

    // Sinkronisasi saldo gudang jika belum diinisialisasi
    if (Object.keys(stockByWarehouse).length === 0) {
      stockByWarehouse[MAIN_WH] = currentStock;
    } else {
      const sum = Object.values(stockByWarehouse).reduce((a, b) => a + Number(b || 0), 0);
      if (sum < currentStock) {
        stockByWarehouse[MAIN_WH] = Number(stockByWarehouse[MAIN_WH] || 0) + (currentStock - sum);
      }
    }

    let remainingToDeduct = amount;
    const warehousesUsed: string[] = [];

    // Urutan: warehouseId yang diminta (kecuali 'auto') → gudang-utama → sisanya
    const prioritized =
      warehouseId === 'auto'
        ? Object.entries(stockByWarehouse).sort(([a]) => (a === MAIN_WH ? -1 : 1))
        : [
            [warehouseId, stockByWarehouse[warehouseId] ?? 0] as [string, number],
            ...Object.entries(stockByWarehouse)
              .filter(([id]) => id !== warehouseId)
              .sort(([a]) => (a === MAIN_WH ? -1 : 1)),
          ];

    const deductionsPerWh: Array<{ whId: string; amount: number; prevWhStock: number; nextWhStock: number }> = [];

    for (const [whId, qty] of prioritized) {
      if (remainingToDeduct <= 0) break;
      const available = Number(qty);
      if (available <= 0) continue;
      const deduct = Math.min(available, remainingToDeduct);
      const nextWhStock = Math.max(0, available - deduct);
      stockByWarehouse[whId] = nextWhStock;
      remainingToDeduct -= deduct;
      warehousesUsed.push(whId);
      deductionsPerWh.push({ whId, amount: deduct, prevWhStock: available, nextWhStock });
    }

    if (remainingToDeduct > 0) {
      return {
        success: false,
        error: `Stok gudang tidak mencukupi untuk mengeluarkan ${amount} ${unit} produk "${product.name || productId}". Sisa yang tidak dapat dipenuhi: ${remainingToDeduct} ${unit}.`,
      };
    }

    const newStock = currentStock - amount;
    if (newStock < 0) {
      return {
        success: false,
        error: `Pengurangan stok dibatalkan karena stok akhir bernilai negatif (${newStock}).`,
      };
    }

    const now = new Date().toISOString();

    // ── FIFO: konsumsi lapisan persediaan (batch tertua dulu) ──
    const existingLayers: InventoryLayer[] = (Array.isArray(raw.inventoryLayers)
      ? raw.inventoryLayers
      : []
    ).map((l: any) => ({
      qty: Number(l.qty || 0),
      costPerPcs: Number(l.costPerPcs || 0),
      ts: l.ts,
      purchaseId: l.purchaseId,
      supplierName: l.supplierName,
      warehouseId: l.warehouseId,
    }));
    const fifo = consumeFifo(existingLayers, amount);
    const fallbackCost = Number(product.cost_price ?? raw.Modal ?? 0);
    const cogs = Math.round(fifo.consumedCost + fifo.shortage * fallbackCost);
    const inventoryLayers = fifo.remaining;

    const updatedRaw = {
      ...raw,
      stock: newStock,
      stockByWarehouse,
      inventoryLayers,
      updatedAt: now,
    };

    const { error: updateErr } = await supabaseAdmin
      .from('products')
      .update({ stock: newStock, raw_data: updatedRaw, updated_at: now })
      .eq('id', productId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Catat log mutasi pengeluaran barang untuk setiap gudang yang terdampak
    for (const item of deductionsPerWh) {
      await addInventoryLog({
        productId,
        productName: product.name || raw.name || raw.Nama || 'Produk',
        type: 'KELUAR',
        amount: item.amount,
        quantity: -item.amount,
        prevStock: currentStock,
        nextStock: newStock,
        referenceId: reference,
        orderId: reference,
        note: notes ? `${notes} [Gudang: ${item.whId}]` : `Pengeluaran stok dari ${item.whId}`,
        fromWarehouseId: item.whId,
        warehouseId: item.whId,
        adminId,
        source,
      });
    }

    return { success: true, deducted: amount, warehousesUsed, cogs };
  } catch (err: any) {
    console.error('deductStockFEFO error:', err);
    return { success: false, error: err.message || 'Gagal mengurangi stok' };
  }
}

/**
 * Add stock to product in Supabase and record inventory log
 */
export const addStock = async (params: {
  productId: string
  amount: number
  warehouseId?: string
  batchNumber?: string
  expiryDate?: Date
  reference?: string
  notes?: string
  incomingPrice?: number // Harga beli masuk untuk menghitung AVG Modal
  source?: InventorySource // Asal mutasi; default 'PURCHASE' (perilaku lama)
}) => {
  const { productId, amount, batchNumber, reference, notes, incomingPrice, source } = params;
  const warehouseId = params.warehouseId || 'gudang-utama';

  if (amount <= 0) throw new Error('Amount must be > 0');

  try {
    const { data: product, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchErr || !product) throw new Error(`Produk tidak ditemukan: ${productId}`);

    const raw = product.raw_data || {};
    const currentStock = Number(product.stock ?? raw.stock ?? raw.Stok ?? 0);
    const currentCost = Number(product.cost_price ?? raw.Modal ?? 0);
    const newStock = currentStock + amount;

    const stockByWarehouse = { ...(raw.stockByWarehouse || { 'gudang-utama': currentStock }) };
    const curWhStock = Number(stockByWarehouse[warehouseId] ?? 0);
    stockByWarehouse[warehouseId] = curWhStock + amount;

    // Kalkulasi AVG Modal (Moving Average Cost) jika incomingPrice tersedia
    let newCostPrice = currentCost;
    if (incomingPrice !== undefined && incomingPrice >= 0) {
      newCostPrice = computeAverageCost(currentStock, currentCost, amount, incomingPrice, 1);
    }

    // Sinkronkan modal/HPP ke seluruh unit (Satuan Lainnya) jika ada
    let updatedUnits = raw.units;
    if (Array.isArray(updatedUnits)) {
      updatedUnits = updatedUnits.map((u: any) => {
        const contains = Number(u.contains || (u.code === (raw.Satuan || raw.unit || 'PCS') ? 1 : 1));
        return {
          ...u,
          modal: Math.round(newCostPrice * contains),
          costPrice: Math.round(newCostPrice * contains),
        };
      });
    }

    const now = new Date().toISOString();

    // ── FIFO: catat batch masuk sebagai lapisan persediaan ──
    const layerCostPerPcs =
      incomingPrice !== undefined && incomingPrice >= 0 ? incomingPrice : newCostPrice;
    const existingLayers: InventoryLayer[] = (Array.isArray(raw.inventoryLayers)
      ? raw.inventoryLayers
      : []
    ).map((l: any) => ({
      qty: Number(l.qty || 0),
      costPerPcs: Number(l.costPerPcs || 0),
      ts: l.ts,
      purchaseId: l.purchaseId,
      supplierName: l.supplierName,
      warehouseId: l.warehouseId,
    }));
    const inventoryLayers = pushLayer(existingLayers, {
      qty: amount,
      costPerPcs: layerCostPerPcs,
      ts: now,
      purchaseId: reference,
      supplierName: raw.supplierName || raw.supplier || undefined,
      warehouseId,
    });

    const updatedRaw = {
      ...raw,
      stock: newStock,
      stockByWarehouse,
      Modal: newCostPrice,
      units: updatedUnits,
      inventoryLayers,
      updatedAt: now,
    };

    const { error: updateErr } = await supabaseAdmin
      .from('products')
      .update({
        stock: newStock,
        cost_price: newCostPrice,
        raw_data: updatedRaw,
        updated_at: now,
      })
      .eq('id', productId);

    if (updateErr) throw updateErr;

    await addInventoryLog({
      productId,
      productName: product.name || raw.name || raw.Nama || 'Produk',
      type: 'MASUK',
      amount,
      quantity: amount,
      prevStock: currentStock,
      nextStock: newStock,
      referenceId: reference,
      note: notes || 'Penambahan stok',
      toWarehouseId: warehouseId,
      warehouseId,
      source: source || 'PURCHASE',
      batchNumber,
      costPerPcs: layerCostPerPcs,
    });

    return { success: true, newStock };
  } catch (err) {
    console.error('addStock error:', err);
    throw err;
  }
};

/**
 * Transfer stock between warehouses in Supabase
 */
export const transferStock = async (params: {
  productId?: string
  batchId?: string
  amount: number
  fromWarehouseId?: string
  toWarehouseId: string
  reference?: string
  notes?: string
}) => {
  const { productId, amount, fromWarehouseId = 'gudang-utama', toWarehouseId, reference, notes } = params;

  if (!productId) return { success: true };

  const { data: product, error: fetchErr } = await supabaseAdmin.from('products').select('*').eq('id', productId).single();
  if (fetchErr || !product) throw new Error('Produk tidak ditemukan');

  const raw = product.raw_data || {};
  const stockMap = { ...(raw.stockByWarehouse || {}) };
  const fromStock = Number(stockMap[fromWarehouseId] || 0);

  if (fromStock < amount) throw new Error('Stok di gudang asal tidak cukup');

  stockMap[fromWarehouseId] = fromStock - amount;
  stockMap[toWarehouseId] = Number(stockMap[toWarehouseId] || 0) + amount;

  const now = new Date().toISOString();
  await supabaseAdmin.from('products').update({
    raw_data: { ...raw, stockByWarehouse: stockMap, updatedAt: now },
    updated_at: now,
  }).eq('id', productId);

  await addInventoryLog({
    productId,
    productName: product.name || raw.name || 'Produk',
    type: 'MUTASI',
    amount,
    fromWarehouseId,
    toWarehouseId,
    warehouseId: toWarehouseId,
    referenceId: reference,
    note: notes || `Transfer dari ${fromWarehouseId} ke ${toWarehouseId}`,
    source: 'TRANSFER',
  });

  return { success: true };
};

/**
 * Transitional helpers
 */
export const deductStockTx = async (txOrParams: any, maybeParams?: any) => {
  const params = maybeParams || txOrParams;
  if (!params) return { success: true };
  return await deductStockFEFO({
    productId: params.productId,
    amount: params.amount || params.quantity || 0,
    warehouseId: params.warehouseId || params.mainWarehouseId || 'gudang-utama',
    reference: params.reference || params.referenceId || params.orderId,
    notes: params.note || params.notes,
  });
};

export const addStockTx = async (txOrParams: any, maybeParams?: any) => {
  const isTx = txOrParams && typeof txOrParams.get === 'function';
  const params = isTx ? maybeParams : txOrParams;
  if (!params) return { success: true };

  return await addStock({
    productId: params.productId,
    amount: params.amount || params.quantity || 0,
    warehouseId: params.warehouseId || params.mainWarehouseId || 'gudang-utama',
    batchNumber: params.batchNumber || `BATCH-${Date.now()}`,
    expiryDate: params.expiryDate ? new Date(params.expiryDate) : undefined,
    reference: params.reference || params.referenceId,
    notes: params.note || params.notes,
  });
};

export const transferStockTx = async (txOrParams: any, maybeParams?: any) => {
  const isTx = txOrParams && typeof txOrParams.get === 'function';
  const params = isTx ? maybeParams : txOrParams;
  if (!params) return { success: true };

  return await transferStock({
    productId: params.productId,
    amount: params.amount || 0,
    fromWarehouseId: params.fromWarehouseId || 'gudang-utama',
    toWarehouseId: params.toWarehouseId || 'gudang-utama',
    reference: params.reference,
    notes: params.notes,
  });
};

export const adjustStockTx = async (txOrParams: any, maybeParams?: any) => {
  const isTx = txOrParams && typeof txOrParams.get === 'function';
  const params = isTx ? maybeParams : txOrParams;
  if (!params || !params.productId) return { success: true };

  const { data: product } = await supabaseAdmin.from('products').select('*').eq('id', params.productId).single();
  if (!product) throw new Error('Product not found');

  const raw = product.raw_data || {};
  const stockMap = { ...(raw.stockByWarehouse || {}) };
  const warehouseId = params.warehouseId || 'gudang-utama';
  const targetStock = params.newStock !== undefined ? params.newStock : (params.actualStock !== undefined ? params.actualStock : 0);
  const prevWhStock = Number(stockMap[warehouseId] || 0);
  const diff = targetStock - prevWhStock;

  stockMap[warehouseId] = targetStock;
  const prevTotal = Number(product.stock ?? raw.stock ?? 0);
  const nextTotal = Math.max(0, prevTotal + diff);

  const now = new Date().toISOString();
  await supabaseAdmin.from('products').update({
    stock: nextTotal,
    raw_data: {
      ...raw,
      stock: nextTotal,
      stockByWarehouse: stockMap,
      updatedAt: now,
    },
    updated_at: now,
  }).eq('id', params.productId);

  await addInventoryLog({
    productId: params.productId,
    productName: product.name || raw.name || 'Produk',
    type: diff < 0 ? 'KELUAR' : 'MASUK',
    amount: Math.abs(diff),
    quantity: diff,
    prevStock: prevTotal,
    nextStock: nextTotal,
    warehouseId,
    adminId: params.adminId,
    source: params.source || 'OPNAME',
    note: params.notes || 'Penyesuaian stok opname',
  });

  return { success: true, diff };
};

export const deductStockBatch = async (
  arg1: any,
  arg2?: any
) => {
  if (Array.isArray(arg1)) {
    for (const item of arg1) {
      await deductStockFEFO({
        productId: item.productId,
        amount: item.amount,
        warehouseId: item.warehouseId || 'gudang-utama'
      });
    }
  } else if (arg2) {
    await deductStockFEFO({
      productId: arg2.productId,
      amount: arg2.amount,
      warehouseId: arg2.warehouseId || 'gudang-utama',
      reference: arg2.note,
      notes: arg2.note
    });
  }
  return { success: true };
};
