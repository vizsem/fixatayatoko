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
};

export function normalizeProduct(id: string, raw: Record<string, unknown>): NormalizedProduct {
  const getNum = (v: unknown, def = 0) => typeof v === 'number' ? v : Number(v || def);
  const getStr = (v: unknown, def = '') => typeof v === 'string' ? v : String(v ?? def);

  return {
    id,
    name: getStr(raw.name ?? raw.Nama),
    sku: getStr(raw.sku ?? raw.ID),
    category: getStr(raw.category ?? raw.Kategori),
    warehouseId: getStr(raw.warehouseId),
    stock: getNum(raw.stock ?? raw.Stok),
    minStock: getNum(raw.minStock ?? raw.Min_Stok),
    priceEcer: getNum(raw.priceEcer ?? raw.Ecer),
    priceGrosir: getNum(raw.priceGrosir ?? raw.Grosir ?? raw.Harga_Grosir),
    unit: getStr(raw.unit ?? raw.Satuan ?? 'pcs'),
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (getNum(raw.Status, 1) !== 0),
    imageUrl: getStr(raw.imageUrl ?? raw.image ?? raw.Link_Foto ?? raw.foto ?? raw.URL_Produk ?? raw.url_produk),
    purchasePrice: getNum(raw.purchasePrice ?? raw.Modal),
  };
}
