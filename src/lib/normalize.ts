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
  stockByWarehouse?: Record<string, number>;
  minStock: number;
  priceEcer: number;
  priceGrosir: number;
  unit: string;
  isActive?: boolean;
  imageUrl?: string;
  purchasePrice?: number;
  units?: UnitOption[];
  updatedAt?: number;
  createdAt?: number;
};

export function normalizeProduct(id: string, raw: Record<string, unknown>): NormalizedProduct {
  const getNum = (v: unknown, def = 0) => typeof v === 'number' ? v : Number(v || def);
  const getStr = (v: unknown, def = '') => typeof v === 'string' ? v : String(v ?? def);
  const getTimestamp = (v: unknown): number | undefined => {
    if (v && typeof v === 'object' && 'seconds' in v) {
      return (v as { seconds: number }).seconds * 1000;
    }
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    return undefined;
  };
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
    stockByWarehouse: raw.stockByWarehouse as Record<string, number> | undefined,
    minStock: getNum(raw.minStock ?? raw.Min_Stok),
    priceEcer,
    priceGrosir: priceGrosir,
    unit,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : (getNum(raw.Status, 1) !== 0),
    imageUrl: getStr(raw.imageUrl ?? raw.image ?? raw.Link_Foto ?? raw.foto ?? raw.URL_Produk ?? raw.url_produk),
    purchasePrice: getNum(raw.purchasePrice ?? raw.Modal),
    updatedAt: getTimestamp(raw.updatedAt),
    createdAt: getTimestamp(raw.createdAt),
  };

  const rawUnits = (raw as Record<string, unknown>).units;
  result.units = parseUnits(rawUnits, unit, priceEcer, priceGrosir, minGrosir);
  return result;
}

export type MarginRule = {
  key: string;
  label: string;
  min: number;
  max: number;
};

export const MARGIN_RULES: MarginRule[] = [
  { key: 'AUTO', label: 'Auto (berdasarkan nama/kategori)', min: 10, max: 15 },
  { key: 'BERAS_SPHP', label: 'Beras SPHP', min: 2, max: 4 },
  { key: 'BERAS_PREMIUM', label: 'Beras premium', min: 4, max: 7 },
  { key: 'BERAS_MEDIUM', label: 'Beras medium', min: 3, max: 6 },
  { key: 'GULA_MERAH', label: 'Gula merah', min: 8, max: 12 },
  { key: 'GULA_PASIR', label: 'Gula pasir', min: 4, max: 7 },
  { key: 'MINYAK_REFILL', label: 'Minyak goreng refill', min: 4, max: 8 },
  { key: 'MINYAK_BOTOL', label: 'Minyak goreng botol', min: 5, max: 9 },
  { key: 'TEPUNG_TERIGU', label: 'Tepung terigu', min: 6, max: 10 },
  { key: 'TEPUNG_TAPIOKA', label: 'Tepung tapioka', min: 8, max: 12 },
  { key: 'TEPUNG_BERAS', label: 'Tepung beras', min: 8, max: 12 },
  { key: 'MIE_INSTAN', label: 'Mie instan', min: 8, max: 12 },
  { key: 'MIE_CUP_PREMIUM', label: 'Mie cup premium', min: 12, max: 18 },
  { key: 'POP_MIE', label: 'Pop mie', min: 10, max: 15 },
  { key: 'MINUMAN_AIR', label: 'Air mineral', min: 8, max: 12 },
  { key: 'MINUMAN_AIR_15L', label: 'Air mineral 1.5L', min: 7, max: 10 },
  { key: 'TEH_BOTOL_KOTAK', label: 'Teh botol/kotak', min: 10, max: 15 },
  { key: 'SUSU_UHT_KECIL', label: 'Susu UHT kecil', min: 12, max: 18 },
  { key: 'SUSU_UHT_BESAR', label: 'Susu UHT besar', min: 10, max: 15 },
  { key: 'ISOTONIK_SODA', label: 'Minuman isotonik/soda', min: 10, max: 15 },
  { key: 'KOPI_BOTOL', label: 'Kopi botol', min: 12, max: 18 },
  { key: 'KOPI_SACHET', label: 'Kopi sachet/mix', min: 12, max: 18 },
  { key: 'KOPI_BUBUK', label: 'Kopi hitam bubuk', min: 15, max: 20 },
  { key: 'TEH_CELUP', label: 'Teh celup', min: 10, max: 15 },
  { key: 'TEH_SACHET', label: 'Teh sachet', min: 12, max: 18 },
  { key: 'SKM', label: 'Susu kental manis', min: 8, max: 12 },
  { key: 'ENERGI_SACHET', label: 'Energi drink sachet', min: 12, max: 18 },
  { key: 'MINUMAN_JAHE', label: 'Minuman jahe sachet', min: 15, max: 20 },
  { key: 'SEREAL_MINUMAN', label: 'Sereal minuman sachet', min: 15, max: 20 },
  { key: 'SNACK_TINGGI', label: 'Snack margin tinggi', min: 20, max: 30 },
  { key: 'SNACK_SEDANG', label: 'Snack margin sedang', min: 15, max: 20 },
  { key: 'BISKUIT_KALENG', label: 'Biskuit kaleng', min: 10, max: 15 },
  { key: 'BISKUIT_SACHET', label: 'Biskuit sachet', min: 15, max: 20 },
  { key: 'BUMBUDAPUR_RENDAH', label: 'Bumbu dapur margin rendah', min: 8, max: 12 },
  { key: 'BUMBUDAPUR_SEDANG', label: 'Bumbu dapur margin sedang', min: 10, max: 15 },
  { key: 'BUMBUDAPUR_TINGGI', label: 'Bumbu dapur margin tinggi', min: 15, max: 20 },
  { key: 'SAOS', label: 'Saos', min: 12, max: 18 },
  { key: 'KECAP_MANIS', label: 'Kecap manis', min: 10, max: 15 },
  { key: 'KECAP_ASIN', label: 'Kecap asin', min: 12, max: 18 },
  { key: 'KEBERSIHAN_SEDANG', label: 'Produk kebersihan', min: 12, max: 18 },
  { key: 'KEBERSIHAN_TINGGI', label: 'Produk kebersihan margin tinggi', min: 15, max: 20 },
  { key: 'RUMAH_TANGGA', label: 'Produk rumah tangga', min: 12, max: 18 },
  { key: 'RUMAH_TANGGA_TINGGI', label: 'Produk rumah tangga margin tinggi', min: 15, max: 20 },
  { key: 'ROKOK', label: 'Produk rokok', min: 5, max: 8 },
  { key: 'ROKOK_POD', label: 'Rokok elektrik pod', min: 8, max: 12 },
  { key: 'TELUR', label: 'Telur ayam', min: 4, max: 8 },
  { key: 'FROZEN', label: 'Frozen food', min: 10, max: 15 },
  { key: 'ROTI', label: 'Roti', min: 10, max: 15 },
  { key: 'BAYI', label: 'Produk bayi', min: 10, max: 15 },
  { key: 'ATK_KECIL', label: 'ATK & item kecil', min: 20, max: 30 },
  { key: 'PLASTIK', label: 'Plastik & kemasan', min: 20, max: 30 },
  { key: 'ES', label: 'Es & produk dingin kecil', min: 20, max: 30 },
  { key: 'GAS_LPG', label: 'Gas LPG', min: 2, max: 5 },
];

export type PricingStrategy = {
  mode: 'manual' | 'margin';
  ruleKey?: string;
  marginPercent?: number;
  roundingStep?: number;
};

export type PricingRecommendation = {
  rule: MarginRule;
  marginPercent: number;
  roundingStep: number;
  cost: number;
  recommendedPrice: number;
  effectiveMarginPercent: number;
};

const normalizeText = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const roundUpToStep = (value: number, step: number) => {
  const s = step > 0 ? step : 1;
  return Math.ceil(value / s) * s;
};

export function resolveMarginRuleKey(name?: string, category?: string): string {
  const text = `${normalizeText(name)} ${normalizeText(category)}`.trim();
  if (!text) return 'AUTO';

  if (/\bsphp\b/.test(text)) return 'BERAS_SPHP';
  if (/\bberas\b/.test(text) && /\bpremium\b/.test(text)) return 'BERAS_PREMIUM';
  if (/\bberas\b/.test(text)) return 'BERAS_MEDIUM';

  if (/\bgula\b/.test(text) && /\bmerah\b/.test(text)) return 'GULA_MERAH';
  if (/\bgula\b/.test(text)) return 'GULA_PASIR';

  if (/\bminyak\b/.test(text) && /\brefill\b/.test(text)) return 'MINYAK_REFILL';
  if (/\bminyak\b/.test(text) && /\bbotol\b/.test(text)) return 'MINYAK_BOTOL';
  if (/\bminyak\b/.test(text)) return 'MINYAK_REFILL';

  if (/\btepung\b/.test(text) && /\bterigu\b/.test(text)) return 'TEPUNG_TERIGU';
  if (/\btepung\b/.test(text) && /\btapioka\b/.test(text)) return 'TEPUNG_TAPIOKA';
  if (/\btepung\b/.test(text) && /\bberas\b/.test(text)) return 'TEPUNG_BERAS';

  if (/\b(pop mie|popmie)\b/.test(text)) return 'POP_MIE';
  if (/\bmie\b/.test(text) && /\bcup\b/.test(text) && /\bpremium\b/.test(text)) return 'MIE_CUP_PREMIUM';
  if (/\bmie\b/.test(text)) return 'MIE_INSTAN';

  if (/\bair\b/.test(text) && /\b1\s*5l\b/.test(text)) return 'MINUMAN_AIR_15L';
  if (/\bair\b/.test(text) && /\b(mineral|galon)\b/.test(text)) return 'MINUMAN_AIR';

  if (/\bteh\b/.test(text) && /\b(botol|kotak)\b/.test(text)) return 'TEH_BOTOL_KOTAK';
  if (/\bteh\b/.test(text) && /\bcelup\b/.test(text)) return 'TEH_CELUP';
  if (/\bteh\b/.test(text) && /\bsachet\b/.test(text)) return 'TEH_SACHET';

  if (/\bsusu\b/.test(text) && /\buht\b/.test(text) && /\b(kecil|mini)\b/.test(text)) return 'SUSU_UHT_KECIL';
  if (/\bsusu\b/.test(text) && /\buht\b/.test(text)) return 'SUSU_UHT_BESAR';
  if (/\b(susu kental manis|skm)\b/.test(text)) return 'SKM';

  if (/\bkopi\b/.test(text) && /\bbotol\b/.test(text)) return 'KOPI_BOTOL';
  if (/\bkopi\b/.test(text) && /\b(bubuk|hitam)\b/.test(text)) return 'KOPI_BUBUK';
  if (/\bkopi\b/.test(text) && /\b(sachet|mix)\b/.test(text)) return 'KOPI_SACHET';

  if (/\b(isotonik|soda)\b/.test(text)) return 'ISOTONIK_SODA';
  if (/\benergi\b/.test(text) && /\bsachet\b/.test(text)) return 'ENERGI_SACHET';
  if (/\bjahe\b/.test(text)) return 'MINUMAN_JAHE';
  if (/\bsereal\b/.test(text)) return 'SEREAL_MINUMAN';

  if (/\b(rokok|cigarette|kretek|mild|filter|slim)\b/.test(text)) return 'ROKOK';
  if (/\b(pod|rokok elektrik)\b/.test(text)) return 'ROKOK_POD';

  if (/\btelur\b/.test(text)) return 'TELUR';
  if (/\b(nugget|sosis|frozen)\b/.test(text)) return 'FROZEN';
  if (/\broti\b/.test(text)) return 'ROTI';
  if (/\b(bayi|popok|tisu basah|susu bayi)\b/.test(text)) return 'BAYI';

  if (/\b(pulpen|pensil|penghapus|buku|spidol|lakban|gunting|stapler|staples|amplop)\b/.test(text)) return 'ATK_KECIL';
  if (/\b(plastik|kemasan|kertas nasi|kantong|sedotan|gelas plastik|sendok plastik|kotak makanan)\b/.test(text)) return 'PLASTIK';

  if (/\b(es\b|es batu|es lilin)\b/.test(text)) return 'ES';
  if (/\b(gas lpg|lpg)\b/.test(text)) return 'GAS_LPG';

  return 'AUTO';
}

export function getMarginRuleByKey(ruleKey: string): MarginRule {
  const key = String(ruleKey || '').trim();
  const found = MARGIN_RULES.find((r) => r.key === key);
  return found || MARGIN_RULES[0];
}

export function recommendSellingPrice(opts: {
  cost: number;
  name?: string;
  category?: string;
  ruleKey?: string;
  marginPercent?: number;
  roundingStep?: number;
}): PricingRecommendation | null {
  const cost = Number(opts.cost || 0);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const ruleKey = String(opts.ruleKey || 'AUTO').trim();
  const resolvedKey = ruleKey === 'AUTO' ? resolveMarginRuleKey(opts.name, opts.category) : ruleKey;
  const rule = getMarginRuleByKey(resolvedKey);

  const midpoint = (rule.min + rule.max) / 2;
  const requested = Number(opts.marginPercent || 0);
  const marginPercent = requested > 0 ? clamp(requested, rule.min, rule.max) : midpoint;

  const roundingStep = Number(opts.roundingStep || 100);
  const rawPrice = cost * (1 + marginPercent / 100);
  const recommendedPrice = roundUpToStep(rawPrice, roundingStep);
  const effectiveMarginPercent = cost > 0 ? ((recommendedPrice - cost) / cost) * 100 : 0;

  return {
    rule,
    marginPercent,
    roundingStep: roundingStep > 0 ? roundingStep : 100,
    cost,
    recommendedPrice,
    effectiveMarginPercent,
  };
}
