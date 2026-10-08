import { describe, expect, it } from 'vitest';
import { getPurchaseHistoryPrices } from '@/lib/purchase-price-history';

describe('purchase price history', () => {
  it('returns latest and lowest prices converted to the requested purchase unit', () => {
    const prices = getPurchaseHistoryPrices([
      {
        created_at: '2026-10-01T10:00:00.000Z',
        raw_data: {
          items: [{ productId: 'sugar', unit: 'PCS', conversion: 1, unitPrice: 2500 }],
        },
      },
      {
        created_at: '2026-10-03T10:00:00.000Z',
        raw_data: {
          items: [{ productId: 'other', unit: 'DUS', conversion: 12, unitPrice: 1000 }],
        },
      },
      {
        created_at: '2026-10-02T10:00:00.000Z',
        raw_data: {
          items: [{ productId: 'sugar', unit: 'DUS', conversion: 12, unitPrice: 36000 }],
        },
      },
      {
        created_at: '2026-10-04T10:00:00.000Z',
        raw_data: {
          status: 'CANCELLED',
          items: [{ productId: 'sugar', unit: 'DUS', conversion: 12, unitPrice: 20000 }],
        },
      },
      {
        created_at: '2026-10-05T10:00:00.000Z',
        status: 'APPROVED',
        raw_data: {
          items: [{ productId: 'sugar', unit: 'DUS', conversion: 12, unitPrice: 18000 }],
        },
      },
    ], 'sugar', 'DUS', 'PCS', 12);

    expect(prices).toEqual({ latestPrice: 36000, cheapestPrice: 30000 });
  });

  it('uses matching unit names for older history without a conversion snapshot', () => {
    const prices = getPurchaseHistoryPrices([
      {
        created_at: '2026-10-01T10:00:00.000Z',
        raw_data: {
          items: [{ productId: 'oil', unit: 'PCS', unitPrice: 5000 }],
        },
      },
    ], 'oil', 'DUS', 'PCS', 6);

    expect(prices).toEqual({ latestPrice: 30000, cheapestPrice: 30000 });
  });
});