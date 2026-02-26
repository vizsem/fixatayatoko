export type UnitOption = {
  code: string;
  contains?: number;
  price?: number;
  minQty?: number;
  label?: string;
};

export type NormalizedProduct = {
  id: string;
  name: string;
  sku: string;
  category: string;
  warehouseId: string;
  stock: number;
  minStock: number;
  priceEcer: number;
  priceGrosir: number;
  unit: string;
  isActive?: boolean;
  imageUrl?: string;
  purchasePrice?: number;
  units?: UnitOption[];
};

export function normalizeProduct(id: string, raw: Record<string, unknown>): NormalizedProduct {
  const getNum = (v: unknown, def = 0) => typeof v === 'number' ? v : Number(v || def);
  const getStr = (v: unknown, def = '') => typeof v === 'string' ? v : String(v ?? def);
  const toUpper = (s: string) => s.trim().toUpperCase();
  const parseUnits = (v: unknown, baseUnit: string, baseEcer: number, grosir: number, minGrosir: number): UnitOption[] => {
    if (Array.isArray(v)) {
      return v
        .map((u) => {
          const item = (u || {}) as Record<string, unknown>;
          const code = getStr(item.code ?? item.unit ?? '', '').trim();
          if (!code) return null;
          return {
            code: toUpper(code),
            contains: typeof item.contains === 'number' ? item.contains : getNum(item.contains, undefined as unknown as number),
            price: typeof item.price === 'number' ? item.price : getNum(item.price, undefined as unknown as number),
            minQty: typeof item.minQty === 'number' ? item.minQty : getNum(item.minQty, undefined as unknown as number),
            label: getStr(item.label, ''),
          } as UnitOption;
        })
        .filter(Boolean) as UnitOption[];
    }
    const base: UnitOption[] = [];
    base.push({ code: toUpper(baseUnit), price: baseEcer });
    if (grosir > 0 && minGrosir > 0) base.push({ code: toUpper(baseUnit), price: grosir, minQty: minGrosir });
    return base;
  };

  const unit = toUpper(getStr(raw.unit ?? raw.Satuan ?? 'PCS'));
  const priceEcer = getNum(raw.priceEcer ?? raw.Ecer);
  const priceGrosir = getNum(raw.priceGrosir ?? raw.Grosir ?? raw.Harga_Grosir);
  const minGrosir = getNum((raw as Record<string, unknown>).Min_Grosir ?? (raw as Record<string, unknown>).minWholesale ?? 0);

  const result: NormalizedProduct = {
    id,
    name: getStr(raw.name ?? raw.Nama),
    sku: getStr(raw.sku ?? raw.ID),
    category: getStr(raw.category ?? raw.Kategori),
    warehouseId: getStr(raw.warehouseId),
    stock: getNum(raw.stock ?? raw.Stok),
    minStock: getNum(raw.minStock ?? raw.Min_Stok),
    priceEcer,
    priceGrosir: priceGrosir,
    unit,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (getNum(raw.Status, 1) !== 0),
    imageUrl: getStr(raw.imageUrl ?? raw.image ?? raw.Link_Foto ?? raw.foto ?? raw.URL_Produk ?? raw.url_produk),
    purchasePrice: getNum(raw.purchasePrice ?? raw.Modal),
  };

  const rawUnits = (raw as Record<string, unknown>).units;
  result.units = parseUnits(rawUnits, unit, priceEcer, priceGrosir, minGrosir);
  return result;
}
