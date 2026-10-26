/**
 * B2B & Factory Tax & Cost Accounting Engine (Anti-Boncos)
 * Sesuai UU HPP (Harmonisasi Peraturan Perpajakan), PP 55/2022, PMK PPh 22, dan standar akuntansi biaya.
 */

export type ProductCategoryType =
  | 'KATEGORI_A' // Barang Kebutuhan Pokok / Strategis: Beras, Jagung, Daging Segar, Telur, dll (Bebas PPN / PPN 0%)
  | 'KATEGORI_B' // Barang Konsumsi Umum & Manufaktur: Minyak Goreng, Sabun, Mie, Elektronik (PPN 11%)
  | 'KATEGORI_C' // Produk Industri Tertentu (Kena PPh Pasal 22: Semen 0.25%, Baja 0.3%, Kertas 0.1%, Otomotif 0.45%)
  | 'KATEGORI_D'; // Barang Kena Cukai / PPnBM Mewah

export type FactoryPpnStatus =
  | 'BELUM_PPN' // Harga faktur belum termasuk PPN 11% (Exclude PPN)
  | 'SUDAH_PPN' // Harga faktur sudah termasuk PPN 11% (Include PPN)
  | 'NON_PKP';  // Pabrik/Supplier Non-PKP (Tidak menerbitkan faktur pajak PPN)

export type BuyerTaxStatus =
  | 'PKP'     // Pengusaha Kena Pajak (Dapat mengkreditkan PPN Masukan)
  | 'NON_PKP'; // Non-PKP (PPN Masukan tidak dapat dikreditkan, wajib dikapitalisasi ke HPP modal)

export type AnnualTurnoverTier =
  | 'UNDER_500M' // Di bawah Rp500 Juta (WPOP bebas PPh Final 0.5% - Fasilitas PTKP PP 55/2022)
  | '500M_TO_4_8B' // Rp500 Juta s.d. Rp4.8 Miliar (Dikenakan PPh Final 0.5% atas omzet di atas Rp500jt)
  | 'ABOVE_4_8B'; // Di atas Rp4.8 Miliar (Wajib PKP & Pembukuan tarif PPh Badan umum)

export interface Pph22IndustryRate {
  label: string;
  ratePct: number; // e.g. 0.25 for Semen
}

export const PPH22_RATES: Record<string, Pph22IndustryRate> = {
  SEMEN: { label: 'Industri Semen', ratePct: 0.25 },
  BAJA: { label: 'Industri Baja', ratePct: 0.3 },
  KERTAS: { label: 'Industri Kertas & Pulp', ratePct: 0.1 },
  OTOMOTIF: { label: 'Industri Otomotif', ratePct: 0.45 },
  FARMASI: { label: 'Industri Farmasi', ratePct: 0.3 },
  NONE: { label: 'Bukan Industri PPh 22', ratePct: 0 },
};

export interface B2bTaxInput {
  productName: string;
  categoryType: ProductCategoryType;
  customCategoryName?: string;
  industryType?: keyof typeof PPH22_RATES;
  cukaiOrPbnbmNominal?: number; // Biaya cukai/PPnBM per unit (Kategori D)
  
  // Harga Beli & Status Pabrik
  factoryPurchasePrice: number; // Harga per unit di faktur/penawaran pabrik
  factoryPpnStatus: FactoryPpnStatus;
  
  // Biaya Tambahan Pengadaan (Landed Costs) per unit
  shippingCostPerUnit?: number; // Ongkos kirim / kontainer / truk per unit
  handlingCostPerUnit?: number; // Biaya bongkar muat per unit
  packagingCostPerUnit?: number; // Biaya repacking / karung / dus per unit
  otherLandedCostPerUnit?: number; // Biaya asuransi / karantina / lainnya
  
  // Status Usaha Kita (Pembeli)
  buyerTaxStatus: BuyerTaxStatus;
  
  // Satuan & Konversi Bertingkat (Multi-tier Units)
  unitCode?: string; // misal: 'CTN', 'BAL', 'RTG', 'PCS'
  contains?: number; // Jumlah isi satuan dasar per unit faktur (cth: 120 pcs per dus). Default: 1
  baseUnitCode?: string; // Satuan dasar terkecil (cth: 'PCS')

  // Target Penjualan & Biaya Penjualan
  targetMarginPct: number; // Contoh: 15 (berarti 15%)
  marginType?: 'MARKUP_FROM_COST' | 'MARGIN_FROM_SALES'; // Default: MARGIN_FROM_SALES
  
  marketplaceFeePct: number; // Biaya admin marketplace, contoh: 6.5 (%)
  marketplaceFixedFee?: number; // Biaya tetap per pesanan jika ada, contoh: Rp1.000
  
  // Omzet & Pajak Penghasilan
  annualTurnoverTier: AnnualTurnoverTier;
  ppnRatePct?: number; // Default 11%
}

export interface B2bCostBreakdown {
  dppPerUnit: number; // Dasar Pengenaan Pajak
  ppnMasukanPerUnit: number; // Nilai PPN Masukan 11%
  ppnCapitalizedToHpp: number; // PPN yang menjadi beban HPP (0 jika PKP, 11% jika Non-PKP)
  pph22PerUnit: number; // PPh Pasal 22 (jika kategori C)
  cukaiOrPpnbmPerUnit: number; // Cukai/PPnBM (jika kategori D)
  totalLandedCostPerUnit: number; // Ongkir + Bongkar + Kemasan + Lainnya
  
  // HPP Bersih Riil
  cleanHppPerUnit: number;

  // Konversi Satuan Dasar (jika contains > 1)
  unitCode?: string;
  contains?: number;
  baseUnitCode?: string;
  cleanHppPerBaseUnit?: number;
}

export interface B2bPricingRecommendation {
  cleanHppPerUnit: number;
  
  // Break Even Point (BEP)
  bepOfflinePrice: number; // BEP penjualan offline / kasir (tanpa marketplace fee)
  bepMarketplacePrice: number; // BEP penjualan online (harga impas setelah dipotong marketplace fee)
  
  // Rekomendasi Harga Jual Offline (POS / Toko Fisik)
  recommendedOfflinePrice: number;
  expectedOfflineProfitNominal: number;
  expectedOfflineProfitPct: number;
  
  // Rekomendasi Harga Jual Online (Marketplace: Shopee / Tokopedia / TikTok Shop)
  recommendedMarketplacePrice: number;
  marketplaceDeductionNominal: number; // Potongan yang diambil platform
  netRevenueAfterPlatformFee: number; // Duit bersih yang cair ke saldo toko
  expectedOnlineProfitNominal: number;
  expectedOnlineProfitPct: number;

  // Rekomendasi per Satuan Dasar (jika contains > 1)
  recommendedOfflinePricePerBaseUnit?: number;
  recommendedMarketplacePricePerBaseUnit?: number;
}

export interface B2bTaxProjection {
  pphFinalRatePct: number;
  pphFinalNominalPerUnit: number; // 0.5% jika kena
  isExemptFromPphFinal: boolean;
  pphFinalNotes: string;
  taxCategoryDescription: string;
}

export interface B2bTaxRiskWarning {
  severity: 'DANGER' | 'WARNING' | 'INFO';
  title: string;
  description: string;
}

export interface B2bTaxOutput {
  productName: string;
  categoryType: ProductCategoryType;
  costBreakdown: B2bCostBreakdown;
  pricing: B2bPricingRecommendation;
  taxProjection: B2bTaxProjection;
  warnings: B2bTaxRiskWarning[];
  summaryText: string;
}

/**
 * Deteksi Kategori Otomatis berdasarkan nama komoditas
 */
export function autoDetectCategory(productName: string): {
  category: ProductCategoryType;
  industry?: keyof typeof PPH22_RATES;
} {
  const norm = productName.trim().toUpperCase();

  // Kategori A: Sembako & Kebutuhan Pokok Bebas PPN (UU HPP & PMK terkait)
  const sembakoKeywords = [
    'BERAS', 'JAGUNG', 'KEDELAI', 'DAGING', 'TELUR', 'SUSU SEGAR',
    'SAYUR', 'BUAH', 'GABAH', 'SAGU', 'GARAM', 'UBI', 'SINGKONG'
  ];
  if (sembakoKeywords.some(k => norm.includes(k))) {
    return { category: 'KATEGORI_A' };
  }

  // Kategori C: Industri Khusus Kena PPh 22
  if (norm.includes('SEMEN')) return { category: 'KATEGORI_C', industry: 'SEMEN' };
  if (norm.includes('BAJA') || norm.includes('BESI')) return { category: 'KATEGORI_C', industry: 'BAJA' };
  if (norm.includes('KERTAS') || norm.includes('PULP') || norm.includes('KARTON')) return { category: 'KATEGORI_C', industry: 'KERTAS' };
  if (norm.includes('MOBIL') || norm.includes('MOTOR') || norm.includes('OTOMOTIF')) return { category: 'KATEGORI_C', industry: 'OTOMOTIF' };

  // Kategori D: Cukai / Mewah
  if (norm.includes('ROKOK') || norm.includes('TEMBAKAU') || norm.includes('VAPE') || norm.includes('LIQUID')) {
    return { category: 'KATEGORI_D' };
  }

  // Default: Kategori B (Konsumsi Umum & Manufaktur biasa)
  return { category: 'KATEGORI_B' };
}

/**
 * Kalkulasi Lengkap B2B HPP, Pajak, dan Penetapan Harga Jual Anti-Boncos
 */
export function calculateB2bHppAndPricing(input: B2bTaxInput): B2bTaxOutput {
  const ppnRate = (input.ppnRatePct ?? 11) / 100;
  const targetMarginPct = input.targetMarginPct || 0;
  const marginRatio = targetMarginPct / 100;
  const marginType = input.marginType || 'MARGIN_FROM_SALES';
  const mpFeePct = (input.marketplaceFeePct || 0) / 100;
  const mpFixedFee = input.marketplaceFixedFee || 0;

  const shipping = input.shippingCostPerUnit || 0;
  const handling = input.handlingCostPerUnit || 0;
  const packaging = input.packagingCostPerUnit || 0;
  const otherLanded = input.otherLandedCostPerUnit || 0;
  const totalLandedCostPerUnit = shipping + handling + packaging + otherLanded;

  const rawFactoryPrice = Math.max(0, input.factoryPurchasePrice || 0);

  // 1. Hitung DPP (Dasar Pengenaan Pajak) & PPN Masukan
  let dpp = rawFactoryPrice;
  let ppnMasukan = 0;

  if (input.categoryType === 'KATEGORI_A') {
    // Sembako / Pokok: Bebas PPN (0%)
    dpp = rawFactoryPrice;
    ppnMasukan = 0;
  } else {
    // Kategori B, C, D (Kena PPN jika pabrik PKP)
    if (input.factoryPpnStatus === 'SUDAH_PPN') {
      // Harga pabrik sudah termasuk PPN 11% (Inclusive)
      dpp = Math.round(rawFactoryPrice / (1 + ppnRate));
      ppnMasukan = rawFactoryPrice - dpp;
    } else if (input.factoryPpnStatus === 'BELUM_PPN') {
      // Harga pabrik belum termasuk PPN 11% (Exclusive)
      dpp = rawFactoryPrice;
      ppnMasukan = Math.round(dpp * ppnRate);
    } else {
      // Pabrik Non-PKP (Tidak ada faktur PPN)
      dpp = rawFactoryPrice;
      ppnMasukan = 0;
    }
  }

  // 2. Hitung PPh Pasal 22 (Khusus Kategori C)
  let pph22PerUnit = 0;
  if (input.categoryType === 'KATEGORI_C') {
    const ind = input.industryType || 'NONE';
    const rateInfo = PPH22_RATES[ind] || PPH22_RATES.NONE;
    if (rateInfo.ratePct > 0) {
      // PPh 22 dihitung dari DPP
      pph22PerUnit = Math.round(dpp * (rateInfo.ratePct / 100));
    }
  }

  // 3. Cukai / PPnBM (Khusus Kategori D)
  const cukaiOrPpnbmPerUnit = input.categoryType === 'KATEGORI_D' ? (input.cukaiOrPbnbmNominal || 0) : 0;

  // 4. Perlakuan Pajak Masukan berdasarkan Status Usaha Pembeli:
  // - Jika NON-PKP: PPN Masukan tidak dapat dikreditkan di SPT, sehingga WAJIB dikapitalisasi ke HPP modal.
  // - Jika PKP: PPN Masukan dipisah ke buku pajak masukan untuk mengompensasi PPN Keluaran. Tidak boleh membebani HPP.
  let ppnCapitalizedToHpp = 0;
  if (input.buyerTaxStatus === 'NON_PKP') {
    ppnCapitalizedToHpp = ppnMasukan;
  } else {
    ppnCapitalizedToHpp = 0;
  }

  // PPh 22: Bagi Non-PKP atau yang tidak mengkreditkan di SPT Tahunan PPh, dimasukkan ke modal
  const pph22Capitalized = input.buyerTaxStatus === 'NON_PKP' ? pph22PerUnit : 0;

  // TOTAL HPP BERSIH RIIL (Modal Dasar per unit)
  const cleanHppPerUnit = dpp + ppnCapitalizedToHpp + pph22Capitalized + cukaiOrPpnbmPerUnit + totalLandedCostPerUnit;

  // 5. BREAK EVEN POINT (BEP)
  // - Offline: BEP = cleanHppPerUnit
  // - Marketplace: Net = Price * (1 - mpFeePct) - mpFixedFee = cleanHpp
  //   Price = (cleanHpp + mpFixedFee) / (1 - mpFeePct)
  const bepOfflinePrice = cleanHppPerUnit;
  const bepMarketplacePrice = mpFeePct < 1
    ? Math.round((cleanHppPerUnit + mpFixedFee) / (1 - mpFeePct))
    : cleanHppPerUnit;

  // 6. PENETAPAN HARGA JUAL AMAN
  let recommendedOfflinePrice = 0;
  if (marginType === 'MARKUP_FROM_COST') {
    recommendedOfflinePrice = Math.round(cleanHppPerUnit * (1 + marginRatio));
  } else {
    // Margin atas harga jual: Harga = HPP / (1 - Margin)
    recommendedOfflinePrice = marginRatio < 1
      ? Math.round(cleanHppPerUnit / (1 - marginRatio))
      : Math.round(cleanHppPerUnit * (1 + marginRatio));
  }

  const expectedOfflineProfitNominal = recommendedOfflinePrice - cleanHppPerUnit;
  const expectedOfflineProfitPct = cleanHppPerUnit > 0
    ? Number(((expectedOfflineProfitNominal / cleanHppPerUnit) * 100).toFixed(1))
    : 0;

  // Rekomendasi Harga Jual Online (Marketplace):
  // Formula Anti-Boncos:
  // Kita ingin agar Net Cash Inflow yang cair ke toko sama dengan (recommendedOfflinePrice)
  // atau mencapai target margin yang sama setelah dipotong komisi platform.
  // Formula: NetReceived = P * (1 - mpFeePct) - mpFixedFee >= Target Net Selling
  // P = (Target Net Selling + mpFixedFee) / (1 - mpFeePct)
  const recommendedMarketplacePrice = mpFeePct < 1
    ? Math.round((recommendedOfflinePrice + mpFixedFee) / (1 - mpFeePct))
    : recommendedOfflinePrice;

  const marketplaceDeductionNominal = Math.round(recommendedMarketplacePrice * mpFeePct) + mpFixedFee;
  const netRevenueAfterPlatformFee = recommendedMarketplacePrice - marketplaceDeductionNominal;
  const expectedOnlineProfitNominal = netRevenueAfterPlatformFee - cleanHppPerUnit;
  const expectedOnlineProfitPct = cleanHppPerUnit > 0
    ? Number(((expectedOnlineProfitNominal / cleanHppPerUnit) * 100).toFixed(1))
    : 0;

  // 7. PROYEKSI PPh FINAL UMKM (PP 55/2022)
  let pphFinalRatePct = 0;
  let isExemptFromPphFinal = false;
  let pphFinalNotes = '';

  if (input.annualTurnoverTier === 'UNDER_500M') {
    isExemptFromPphFinal = true;
    pphFinalRatePct = 0;
    pphFinalNotes = 'Bebas PPh Final (Fasilitas PTKP Omzet Kumulatif s.d. Rp500 Juta/tahun untuk WPOP sesuai PP 55 Tahun 2022).';
  } else if (input.annualTurnoverTier === '500M_TO_4_8B') {
    isExemptFromPphFinal = false;
    pphFinalRatePct = 0.5;
    pphFinalNotes = 'Dikenakan PPh Final UMKM 0,5% atas omzet yang telah melebihi batas Rp500 Juta per tahun pajak.';
  } else {
    isExemptFromPphFinal = false;
    pphFinalRatePct = 22; // Tarif umum badan
    pphFinalNotes = 'Omzet melampaui Rp4,8 Miliar/tahun: Wajib menjadi PKP dan menyelenggarakan pembukuan dengan tarif umum PPh Badan/Orang Pribadi.';
  }

  const pphFinalNominalPerUnit = isExemptFromPphFinal
    ? 0
    : Math.round(recommendedMarketplacePrice * (pphFinalRatePct / 100));

  // 8. IDENTIFIKASI RISIKO & CATATAN KEAMANAN (ANTI-BONCOS AUDIT)
  const warnings: B2bTaxRiskWarning[] = [];

  // Risiko 1: Non-PKP tapi lupa PPN pabrik
  if (input.buyerTaxStatus === 'NON_PKP' && input.factoryPpnStatus === 'BELUM_PPN' && input.categoryType !== 'KATEGORI_A') {
    warnings.push({
      severity: 'DANGER',
      title: 'Pabrik Menagih PPN 11% Terpisah',
      description: 'Karena status Anda Non-PKP, PPN 11% (Rp ' + ppnMasukan.toLocaleString('id-ID') + ') menjadi beban modal langsung. Pastikan Anda tidak memakai harga pabrik mentah untuk menentukan harga jual, karena Anda akan boncos seketika!'
    });
  }

  // Risiko 2: Kategori A tapi kena tagih PPN
  if (input.categoryType === 'KATEGORI_A' && input.factoryPpnStatus !== 'NON_PKP') {
    warnings.push({
      severity: 'WARNING',
      title: 'Barang Pokok / Sembako Bebas PPN',
      description: 'Komoditas ini masuk Kategori A (Bebas PPN sesuai UU HPP). Jika pabrik mengenakan PPN 11%, mintakan konfirmasi atau faktur bebas PPN agar modal Anda tidak membengkak.'
    });
  }

  // Risiko 3: Margin Lebih Kecil dari Biaya Marketplace
  if (targetMarginPct <= input.marketplaceFeePct) {
    warnings.push({
      severity: 'DANGER',
      title: 'Target Margin Terlalu Tipis!',
      description: `Target margin Anda (${targetMarginPct}%) lebih kecil atau setara dengan komisi marketplace (${input.marketplaceFeePct}%). Anda berisiko rugi/boncos setelah dikurangi biaya operasional toko!`
    });
  }

  // Risiko 4: Ongkir & Landed Cost Belum Diinput
  if (totalLandedCostPerUnit === 0) {
    warnings.push({
      severity: 'WARNING',
      title: 'Biaya Ongkir / Ekspedisi Masih Rp0',
      description: 'Pastikan biaya kirim truk, bongkar muat buruh, dan karung/repack sudah dialokasikan ke modal per unit agar HPP tidak bocor.'
    });
  }

  // Kategori Description
  let taxCategoryDescription = '';
  switch (input.categoryType) {
    case 'KATEGORI_A':
      taxCategoryDescription = 'Kategori A: Barang Kebutuhan Pokok / Strategis (Fasilitas Bebas PPN 0% UU HPP)';
      break;
    case 'KATEGORI_B':
      taxCategoryDescription = 'Kategori B: Barang Konsumsi Umum & Manufaktur (Tarif PPN 11%)';
      break;
    case 'KATEGORI_C':
      taxCategoryDescription = `Kategori C: Industri Tertentu Kena PPh 22 (${PPH22_RATES[input.industryType || 'NONE']?.label || 'PPh 22'})`;
      break;
    case 'KATEGORI_D':
      taxCategoryDescription = 'Kategori D: Barang Kena Cukai / PPnBM Barang Mewah';
      break;
  }

  // Konversi Satuan Bertingkat (jika input faktur dalam satuan besar seperti Karton/Renceng)
  const contains = Math.max(1, input.contains || 1);
  const unitCode = (input.unitCode || 'PCS').trim().toUpperCase();
  const baseUnitCode = (input.baseUnitCode || 'PCS').trim().toUpperCase();
  const isMultiTier = contains > 1;

  const cleanHppPerBaseUnit = isMultiTier ? Number((cleanHppPerUnit / contains).toFixed(2)) : cleanHppPerUnit;
  const recommendedOfflinePricePerBaseUnit = isMultiTier ? Math.round(recommendedOfflinePrice / contains) : recommendedOfflinePrice;
  const recommendedMarketplacePricePerBaseUnit = isMultiTier ? Math.round(recommendedMarketplacePrice / contains) : recommendedMarketplacePrice;

  const unitSummary = isMultiTier
    ? `\n   - Satuan Beli Faktur        : 1 ${unitCode} (Isi ${contains} ${baseUnitCode})\n   - HPP Modal Satuan Dasar    : Rp ${cleanHppPerBaseUnit.toLocaleString('id-ID')} / ${baseUnitCode}\n   - Rekomendasi Jual Ecer     : Rp ${recommendedOfflinePricePerBaseUnit.toLocaleString('id-ID')} / ${baseUnitCode}`
    : '';

  // Build Summary Text in Professional Format
  const summaryText = `=== HASIL KALKULASI HPP & REKOMENDASI HARGA ANTI-BONCOS ===
1. PRODUK & STATUS PAJAK:
   - Nama Produk: ${input.productName}
   - Kategori: ${taxCategoryDescription}
   - Status Toko: ${input.buyerTaxStatus} (${input.buyerTaxStatus === 'PKP' ? 'Bisa kreditkan PPN Masukan' : 'PPN 11% masuk beban HPP'})
   - Status Faktur Pabrik: ${input.factoryPpnStatus}${unitSummary}

2. RINCIAN MODAL (HPP BERSIH) PER UNIT:
   - DPP (Harga Dasar Pabrik) : Rp ${dpp.toLocaleString('id-ID')}
   - PPN Masukan Beban Modal   : Rp ${ppnCapitalizedToHpp.toLocaleString('id-ID')} ${input.buyerTaxStatus === 'PKP' ? '(Dikreditkan di SPT, tidak membebani HPP)' : '(Ditanggung Modal)'}
   - PPh 22 Industri          : Rp ${pph22Capitalized.toLocaleString('id-ID')}
   - Cukai / PPnBM            : Rp ${cukaiOrPpnbmPerUnit.toLocaleString('id-ID')}
   - Landed Cost (Ongkir+Packing): Rp ${totalLandedCostPerUnit.toLocaleString('id-ID')}
   ----------------------------------------------------
   TOTAL HPP BERSIH (MODAL RIIL) : Rp ${cleanHppPerUnit.toLocaleString('id-ID')} / ${isMultiTier ? unitCode : 'unit'} ${isMultiTier ? `(Rp ${cleanHppPerBaseUnit.toLocaleString('id-ID')}/${baseUnitCode})` : ''}

3. TITIK IMPAS (BREAK EVEN POINT):
   - BEP Penjualan Offline/Toko : Rp ${bepOfflinePrice.toLocaleString('id-ID')} / ${isMultiTier ? unitCode : 'unit'}
   - BEP Penjualan Marketplace  : Rp ${bepMarketplacePrice.toLocaleString('id-ID')} (Harga minimal agar tidak rugi potongan platform)

4. REKOMENDASI HARGA JUAL AMAN:
   - Rekomendasi Toko Offline/POS: Rp ${recommendedOfflinePrice.toLocaleString('id-ID')} / ${isMultiTier ? unitCode : 'unit'} ${isMultiTier ? `(Ecer: Rp ${recommendedOfflinePricePerBaseUnit.toLocaleString('id-ID')} / ${baseUnitCode})` : ''}
     * Laba Bersih Offline: Rp ${expectedOfflineProfitNominal.toLocaleString('id-ID')} / ${expectedOfflineProfitPct}%
   - Rekomendasi Marketplace      : Rp ${recommendedMarketplacePrice.toLocaleString('id-ID')} / ${isMultiTier ? unitCode : 'unit'} ${isMultiTier ? `(Ecer: Rp ${recommendedMarketplacePricePerBaseUnit.toLocaleString('id-ID')} / ${baseUnitCode})` : ''}
     * Estimasi Potongan Platform (${input.marketplaceFeePct}% + Rp ${mpFixedFee}): Rp ${marketplaceDeductionNominal.toLocaleString('id-ID')}
     * Dana Bersih Cair ke Toko   : Rp ${netRevenueAfterPlatformFee.toLocaleString('id-ID')}
     * Laba Bersih Online         : Rp ${expectedOnlineProfitNominal.toLocaleString('id-ID')} (${expectedOnlineProfitPct}% dari modal)

5. STATUS PPh USAHA (PP 55/2022):
   - ${pphFinalNotes}
   - Estimasi PPh Final per Unit: Rp ${pphFinalNominalPerUnit.toLocaleString('id-ID')}
`;

  return {
    productName: input.productName,
    categoryType: input.categoryType,
    costBreakdown: {
      dppPerUnit: dpp,
      ppnMasukanPerUnit: ppnMasukan,
      ppnCapitalizedToHpp,
      pph22PerUnit,
      cukaiOrPpnbmPerUnit,
      totalLandedCostPerUnit,
      cleanHppPerUnit,
      unitCode: isMultiTier ? unitCode : undefined,
      contains: isMultiTier ? contains : undefined,
      baseUnitCode: isMultiTier ? baseUnitCode : undefined,
      cleanHppPerBaseUnit: isMultiTier ? cleanHppPerBaseUnit : undefined,
    },
    pricing: {
      cleanHppPerUnit,
      bepOfflinePrice,
      bepMarketplacePrice,
      recommendedOfflinePrice,
      expectedOfflineProfitNominal,
      expectedOfflineProfitPct,
      recommendedMarketplacePrice,
      marketplaceDeductionNominal,
      netRevenueAfterPlatformFee,
      expectedOnlineProfitNominal,
      expectedOnlineProfitPct,
      recommendedOfflinePricePerBaseUnit: isMultiTier ? recommendedOfflinePricePerBaseUnit : undefined,
      recommendedMarketplacePricePerBaseUnit: isMultiTier ? recommendedMarketplacePricePerBaseUnit : undefined,
    },
    taxProjection: {
      pphFinalRatePct,
      pphFinalNominalPerUnit,
      isExemptFromPphFinal,
      pphFinalNotes,
      taxCategoryDescription,
    },
    warnings,
    summaryText,
  };
}
