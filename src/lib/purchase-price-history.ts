export type PurchasePriceHistoryRow = {
  created_at?: string | null;
  status?: string | null;
  raw_data?: {
    createdAt?: string | number | { seconds?: number } | null;
    status?: string | null;
    items?: unknown[];
  } | null;
};

export type PurchasePriceHistory = {
  latestPrice: number;
  cheapestPrice: number;
};

function timestamp(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'seconds' in value) {
    return Number(value.seconds) * 1000;
  }
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPurchaseHistoryPrices(
  rows: PurchasePriceHistoryRow[],
  productId: string,
  unitCode: string,
  baseUnitCode: string,
  unitContains: number,
): PurchasePriceHistory {
  const targetUnit = unitCode.trim().toUpperCase();
  const baseUnit = baseUnitCode.trim().toUpperCase();
  const targetContains = Number(unitContains);
  if (!productId || !targetUnit || !Number.isFinite(targetContains) || targetContains <= 0) {
    return { latestPrice: 0, cheapestPrice: 0 };
  }

  const newestFirst = [...rows].sort((left, right) => {
    const leftDate = timestamp(left.created_at || left.raw_data?.createdAt);
    const rightDate = timestamp(right.created_at || right.raw_data?.createdAt);
    return rightDate - leftDate;
  });

  let latestPrice = 0;
  let cheapestPrice = 0;

  for (const row of newestFirst) {
    const raw = row.raw_data || {};
    const status = String(raw.status || row.status || '').trim().toUpperCase();
    if (
      ['CANCELLED', 'DIBATALKAN', 'APPROVED', 'DISETUJUI', 'PENDING', 'MENUNGGU', 'DRAFT']
        .includes(status)
    ) continue;

    for (const value of raw.items || []) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const itemProductId = String(item.productId ?? item.product_id ?? item.id ?? '');
      if (itemProductId !== productId) continue;

      const price = Number(item.unitPrice ?? item.purchasePrice ?? 0);
      if (!Number.isFinite(price) || price <= 0) continue;

      const historicalContains = Number(item.conversion);
      const historicalUnit = String(item.unit || '').trim().toUpperCase();
      let comparablePrice: number;
      if (Number.isFinite(historicalContains) && historicalContains > 0) {
        comparablePrice = (price / historicalContains) * targetContains;
      } else if (historicalUnit === targetUnit) {
        comparablePrice = price;
      } else if (historicalUnit === baseUnit) {
        comparablePrice = price * targetContains;
      } else {
        continue;
      }

      const roundedPrice = Math.round(comparablePrice);
      if (latestPrice === 0) latestPrice = roundedPrice;
      cheapestPrice = cheapestPrice === 0
        ? roundedPrice
        : Math.min(cheapestPrice, roundedPrice);
    }
  }

  return { latestPrice, cheapestPrice };
}