export type BulkPricingMode =
  | 'set-nominal'
  | 'add-nominal'
  | 'subtract-nominal'
  | 'set-percent'
  | 'add-percent'
  | 'subtract-percent';

export function applyBulkPriceAdjustment(
  currentPrice: number | undefined,
  mode: BulkPricingMode,
  value: number,
  minimumPrice = 0,
): number {
  const safeBase = Number.isFinite(currentPrice) ? Number(currentPrice) : 0;
  const safeValue = Number.isFinite(value) ? Number(value) : 0;

  let nextPrice = safeBase;

  switch (mode) {
    case 'set-nominal':
      nextPrice = safeValue;
      break;
    case 'add-nominal':
      nextPrice = safeBase + safeValue;
      break;
    case 'subtract-nominal':
      nextPrice = safeBase - safeValue;
      break;
    case 'set-percent':
      nextPrice = safeBase * (1 + safeValue / 100);
      break;
    case 'add-percent':
      nextPrice = safeBase * (1 + safeValue / 100);
      break;
    case 'subtract-percent':
      nextPrice = safeBase * (1 - safeValue / 100);
      break;
    default:
      nextPrice = safeBase;
  }

  if (minimumPrice > 0 && nextPrice < minimumPrice) {
    return minimumPrice;
  }

  return Math.round(nextPrice);
}
