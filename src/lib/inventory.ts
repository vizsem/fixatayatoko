import { supabaseAdmin } from '@/lib/supabase';
import { collection, db, doc, increment, serverTimestamp } from '@/lib/firebase';

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

export function computeAverageCost(
  currentStock: number,
  currentCost: number,
  incomingQty: number,
  incomingPrice: number,
  conversionRate: number = 1
): number {
  const incomingBaseQty = incomingQty * (conversionRate || 1);
  const costPerBaseUnit = incomingBaseQty > 0 ? incomingPrice / (conversionRate || 1) : incomingPrice;
  const totalQty = currentStock + incomingBaseQty;
  if (totalQty <= 0) return Math.round(costPerBaseUnit);
  const totalVal = (currentStock * currentCost) + (incomingQty * incomingPrice);
  return Math.round(totalVal / totalQty);
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
 * Deduct stock from product in Supabase and record inventory log
 */
export async function deductStockFEFO(
  arg1: string | { productId: string; amount: number; warehouseId?: string; reference?: string; notes?: string },
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

  if (typeof arg1 === 'object') {
    productId = arg1.productId;
    amount = arg1.amount;
    warehouseId = arg1.warehouseId || 'gudang-utama';
    reference = arg1.reference;
    notes = arg1.notes;
  } else {
    productId = arg1;
    warehouseId = warehouseIdArg || 'gudang-utama';
    amount = amountArg || 0;
    reference = referenceArg;
    notes = notesArg;
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
    const currentStock = Number(product.stock ?? raw.stock ?? raw.Stok ?? 0);

    if (currentStock < amount) {
      return { success: false, error: `Stok tidak cukup. Tersedia: ${currentStock}, Dibutuhkan: ${amount}` };
    }

    const newStock = Math.max(0, currentStock - amount);
    const stockByWarehouse = { ...(raw.stockByWarehouse || { 'gudang-utama': currentStock }) };
    const curWhStock = Number(stockByWarehouse[warehouseId] ?? currentStock);
    stockByWarehouse[warehouseId] = Math.max(0, curWhStock - amount);

    const now = new Date().toISOString();
    const updatedRaw = {
      ...raw,
      stock: newStock,
      stockByWarehouse,
      updatedAt: now,
    };

    const { error: updateErr } = await supabaseAdmin
      .from('products')
      .update({
        stock: newStock,
        raw_data: updatedRaw,
        updated_at: now,
      })
      .eq('id', productId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await addInventoryLog({
      productId,
      productName: product.name || raw.name || raw.Nama || 'Produk',
      type: 'KELUAR',
      amount,
      quantity: -amount,
      prevStock: currentStock,
      nextStock: newStock,
      referenceId: reference,
      orderId: reference,
      note: notes || 'Pengurangan stok penjualan',
      fromWarehouseId: warehouseId,
      warehouseId,
      source: 'ORDER',
    });

    return { success: true, deducted: amount };
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
}) => {
  const { productId, amount, batchNumber, reference, notes } = params;
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
    const newStock = currentStock + amount;

    const stockByWarehouse = { ...(raw.stockByWarehouse || { 'gudang-utama': currentStock }) };
    const curWhStock = Number(stockByWarehouse[warehouseId] ?? 0);
    stockByWarehouse[warehouseId] = curWhStock + amount;

    const now = new Date().toISOString();
    const updatedRaw = {
      ...raw,
      stock: newStock,
      stockByWarehouse,
      updatedAt: now,
    };

    const { error: updateErr } = await supabaseAdmin
      .from('products')
      .update({
        stock: newStock,
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
      source: 'PURCHASE',
      batchNumber,
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
  const tx = isTx ? txOrParams : null;
  const params = isTx ? maybeParams : txOrParams;
  if (!params) return { success: true };

  if (tx) {
    const productRef = doc(db, 'products', params.productId);
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('Product not found');
    const pData = snap.data();
    const stockMap = pData.stockByWarehouse || {};
    const currentWhStock = Number(stockMap[params.warehouseId] || 0);
    const nextMap = {
      ...stockMap,
      [params.warehouseId]: currentWhStock + params.amount,
    };
    tx.update(productRef, {
      stock: Number(pData.stock || 0) + params.amount,
      stockByWarehouse: nextMap,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  }

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
  const tx = isTx ? txOrParams : null;
  const params = isTx ? maybeParams : txOrParams;
  if (!params) return { success: true };

  if (tx) {
    const productRef = doc(db, 'products', params.productId);
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('Product not found');
    const pData = snap.data();
    const stockMap = pData.stockByWarehouse || {};
    const fromStock = Number(stockMap[params.fromWarehouseId] || 0);
    if (fromStock < params.amount) {
      throw new Error('Stok di gudang asal tidak cukup');
    }
    const nextMap = {
      ...stockMap,
      [params.fromWarehouseId]: fromStock - params.amount,
      [params.toWarehouseId]: Number(stockMap[params.toWarehouseId] || 0) + params.amount,
    };
    tx.update(productRef, {
      stockByWarehouse: nextMap,
      updatedAt: new Date().toISOString(),
    });

    const fromWhRef = doc(db, 'warehouses', params.fromWarehouseId);
    const toWhRef = doc(db, 'warehouses', params.toWarehouseId);
    tx.update(fromWhRef, { usedCapacity: increment(-params.amount) });
    tx.update(toWhRef, { usedCapacity: increment(params.amount) });

    const currentTotalStock = Number(pData.stock || 0);
    const logRef = doc(collection(db, 'inventory_logs'));
    tx.set(logRef, {
      productId: params.productId,
      type: 'MUTASI',
      amount: params.amount,
      prevStock: currentTotalStock,
      nextStock: currentTotalStock,
      fromWarehouseId: params.fromWarehouseId,
      toWarehouseId: params.toWarehouseId,
      adminId: params.adminId,
      source: params.source || 'TRANSFER',
      createdAt: serverTimestamp(),
    });

    return { success: true };
  }

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
  const tx = isTx ? txOrParams : null;
  const params = isTx ? maybeParams : txOrParams;
  if (!params || !params.productId) return { success: true };

  if (tx) {
    const productRef = doc(db, 'products', params.productId);
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('Product not found');
    const pData = snap.data();
    const stockMap = pData.stockByWarehouse || {};
    const targetStock = params.newStock !== undefined ? params.newStock : (params.actualStock !== undefined ? params.actualStock : 0);
    const prevWhStock = Number(stockMap[params.warehouseId] || 0);
    const diff = targetStock - prevWhStock;
    const nextMap = {
      ...stockMap,
      [params.warehouseId]: targetStock,
    };
    const prevTotal = Number(pData.stock || 0);
    const nextTotal = Math.max(0, prevTotal + diff);
    tx.update(productRef, {
      stock: nextTotal,
      stockByWarehouse: nextMap,
      updatedAt: new Date().toISOString(),
    });

    const whRef = doc(db, 'warehouses', params.warehouseId);
    tx.update(whRef, { usedCapacity: increment(diff) });

    const logRef = doc(collection(db, 'inventory_logs'));
    tx.set(logRef, {
      productId: params.productId,
      type: diff < 0 ? 'KELUAR' : 'MASUK',
      amount: Math.abs(diff),
      prevStock: prevTotal,
      nextStock: nextTotal,
      diff,
      warehouseId: params.warehouseId,
      adminId: params.adminId,
      source: params.source || 'OPNAME',
      createdAt: serverTimestamp(),
    });

    return { success: true, diff };
  }

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
