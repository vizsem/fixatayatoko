'use server';

import { cekAksesStaf } from '@/lib/actions/access';
import { supabaseAdmin } from '@/lib/supabase';
import {
  reconstructLayersFromLogs,
  type InventoryLayer,
} from '@/lib/inventory-layers';
import { toPlainData } from '@/lib/db-schema';

export type InventoryLayerProduct = {
  id: string;
  name: string;
  unit: string;
  stock: number;
  isActive: boolean;
  inventoryLayers: InventoryLayer[];
};

export type InventoryLayerReport =
  | { ok: true; products: InventoryLayerProduct[] }
  | { ok: false; error: string };

/**
 * Muat laporan "Audit Layer Persediaan (FIFO)" dari server.
 *
 * MENGAPA SERVER ACTION, BUKAN BACA LANGSUNG DARI BROWSER
 * ------------------------------------------------------
 * Halaman layer sebelumnya membaca `products` via klien anon. `products` boleh
 * dibaca anon, tetapi `inventory_logs` (dipakai untuk rekonstruksi) hanya boleh
 * dibaca staf. Pembacaan anon dibalas RLS dengan array kosong — kegagalan senyap
 * yang membuat rekonstruksi selalu kosong. Di sini `supabaseAdmin` (service role)
 * membaca kedua tabel dengan izin penuh, setelah peran diverifikasi.
 */
export async function getInventoryLayerReport(): Promise<InventoryLayerReport> {
  const izin = await cekAksesStaf();
  if (izin) return izin;

  try {
    const [produkRes, logRes] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id, name, unit, stock, cost_price, is_active, raw_data')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('inventory_logs')
        .select('id, product_id, type, amount, quantity, created_at, warehouse_id, reference_id, raw_data'),
    ]);

    if (produkRes.error) return { ok: false, error: produkRes.error.message };
    if (logRes.error) return { ok: false, error: logRes.error.message };

    const logsByProduct = new Map<string, any[]>();
    for (const log of logRes.data || []) {
      const pid = String(log.product_id || '');
      if (!pid) continue;
      const arr = logsByProduct.get(pid) || [];
      arr.push(log);
      logsByProduct.set(pid, arr);
    }

    const products: InventoryLayerProduct[] = (produkRes.data || []).map((p: any) => {
      const raw = p.raw_data || {};
      const stored = Array.isArray(raw.inventoryLayers) ? raw.inventoryLayers : [];
      const logs = logsByProduct.get(String(p.id)) || [];

      const layers: InventoryLayer[] =
        stored.length > 0
          ? stored.map((l: any) => ({
              qty: Number(l.qty || 0),
              costPerPcs: Number(l.costPerPcs || 0),
              ts: l.ts,
              purchaseId: l.purchaseId,
              supplierName: l.supplierName,
              warehouseId: l.warehouseId,
            }))
          : reconstructLayersFromLogs(
              logs.map((log) => ({
                type: log.type,
                amount: log.amount,
                quantity: log.quantity,
                ts: log.created_at,
                costPerPcs: Number(log.raw_data?.costPerPcs ?? log.raw_data?.incomingPrice ?? 0),
                purchaseId: log.raw_data?.purchaseId ?? log.raw_data?.referenceId ?? log.reference_id,
                supplierName: log.raw_data?.supplierName,
                warehouseId: log.warehouse_id,
              })),
              () => Number(raw.Modal ?? p.cost_price ?? 0)
            );

      return {
        id: String(p.id),
        name: String(p.name || raw.name || raw.Nama || 'Produk'),
        unit: String(p.unit || raw.unit || 'PCS').toUpperCase(),
        stock: Number(p.stock ?? raw.stock ?? raw.Stok ?? 0),
        isActive: p.is_active !== false,
        inventoryLayers: layers,
      };
    });

    return { ok: true, products: toPlainData(products) as InventoryLayerProduct[] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Gagal memuat laporan layer persediaan',
    };
  }
}
