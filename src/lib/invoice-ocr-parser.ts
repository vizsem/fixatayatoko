/**
 * Intelligent Document & Invoice Parser (OCR / Text / e-Faktur DJP)
 * Menganalisis hasil scan/foto nota, invoice komersial, dan e-Faktur resmi DJP.
 */

import {
  ProductCategoryType,
  autoDetectCategory,
  calculateB2bHppAndPricing,
  BuyerTaxStatus,
  AnnualTurnoverTier,
  FactoryPpnStatus
} from './b2b-tax-calculator';

export type DetectedDocumentType =
  | 'E_FAKTUR_DJP'        // Faktur Pajak Elektronik Resmi DJP (Memiliki NSFP / QR Code valid)
  | 'COMMERCIAL_INVOICE'  // Invoice Komersial / Faktur Penjualan Pabrik (Resmi B2B)
  | 'NOTA_KONTAN'         // Nota Tunai / Bon Belanja Manual (Informal / Retail)
  | 'UNKNOWN';

export interface ParsedInvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number; // Harga satuan kotor atau DPP
  totalPrice: number;
  dpp: number;
  ppnAmount: number;
  categoryType: ProductCategoryType;
  
  // Landed cost teralokasi (pro-rata)
  allocatedLandedCost: number;
  
  // Hasil kalkulasi HPP & Harga Jual per item
  cleanHppPerUnit: number;
  recommendedOfflinePrice: number;
  recommendedMarketplacePrice: number;
  expectedProfitNominal: number;
}

export interface ParsedDocumentResult {
  documentType: DetectedDocumentType;
  documentTypeLabel: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  sellerName?: string;
  sellerNpwp?: string;
  buyerName?: string;
  buyerNpwp?: string;
  
  // Legalitas & Pajak
  isOfficialTaxInvoice: boolean; // Sah secara hukum perpajakan DJP
  factoryPpnStatus: FactoryPpnStatus;
  
  // Angka Total Faktur
  subtotal: number;
  discountTotal: number;
  totalDpp: number;
  totalPpn: number;
  grandTotal: number;
  
  // Item Terdeteksi
  items: ParsedInvoiceItem[];
  
  // Catatan & Keamanan Audit
  auditNotes: string[];
}

/**
 * Membersihkan format angka rupiah (contoh: "1.250.000,00" atau "Rp 50,000") menjadi number
 */
export function cleanCurrency(val: string | number | undefined): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  
  // Bersihkan karakter non-digit selain koma dan titik
  let str = val.trim().replace(/[^\d.,-]/g, '');
  if (!str) return 0;

  // Jika format Indonesia: 100.000,00 (titik ribuan, koma desimal)
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Bisa desimal misal 15,5 atau ribuan misal 15,000
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      str = parts[0] + '.' + parts[1];
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    // Jika ada banyak titik (misal 1.000.000)
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts.join('');
    } else if (parts.length === 2 && parts[1].length === 3) {
      // 100.000 -> ribuan
      str = parts.join('');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Parsing data e-Faktur resmi DJP dari XML atau URL validasi QR Code
 */
export function parseEFakturDjpData(rawText: string): Partial<ParsedDocumentResult> | null {
  const isXml = rawText.includes('<resValidateFakturPm>') || rawText.includes('<nomorFaktur>');
  const isUrl = rawText.includes('svc.efaktur.pajak.go.id') || rawText.includes('efaktur.pajak.go.id');

  if (!isXml && !isUrl) return null;

  // Ekstraksi Tag XML jika tersedia
  const extractTag = (tag: string): string => {
    const match = rawText.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return match ? match[1].trim() : '';
  };

  const nomorFaktur = extractTag('nomorFaktur') || extractTag('kdJenisTransaksi') + extractTag('fgPengganti') + extractTag('nomorFaktur');
  const tanggalFaktur = extractTag('tanggalFaktur');
  const npwpPenjual = extractTag('npwpPenjual');
  const namaPenjual = extractTag('namaPenjual');
  const npwpPembeli = extractTag('npwpLawanTransaksi');
  const namaPembeli = extractTag('namaLawanTransaksi');
  const totalDpp = cleanCurrency(extractTag('jumlahDpp'));
  const totalPpn = cleanCurrency(extractTag('jumlahPpn'));

  return {
    documentType: 'E_FAKTUR_DJP',
    documentTypeLabel: 'Faktur Pajak Elektronik Resmi (e-Faktur DJP)',
    invoiceNumber: nomorFaktur || undefined,
    invoiceDate: tanggalFaktur || undefined,
    sellerName: namaPenjual || undefined,
    sellerNpwp: npwpPenjual || undefined,
    buyerName: namaPembeli || undefined,
    buyerNpwp: npwpPembeli || undefined,
    isOfficialTaxInvoice: true,
    factoryPpnStatus: 'SUDAH_PPN',
    totalDpp,
    totalPpn,
    grandTotal: totalDpp + totalPpn,
    auditNotes: [
      'Dokumen terverifikasi sebagai Faktur Pajak Resmi e-Faktur DJP.',
      'PPN 11% tercatat sah secara perpajakan dan dapat dikreditkan jika status usaha Anda adalah PKP.'
    ]
  };
}

/**
 * Parser Dokumen Pintar (OCR Text / Nota / Faktur Pabrik)
 */
export function parseScannedDocument(opts: {
  rawText: string;
  buyerTaxStatus: BuyerTaxStatus;
  annualTurnoverTier: AnnualTurnoverTier;
  targetMarginPct?: number;
  marketplaceFeePct?: number;
  additionalLandedCostTotal?: number; // Total ongkir / bongkar sefaktur
}): ParsedDocumentResult {
  const text = opts.rawText.trim();
  const buyerTaxStatus = opts.buyerTaxStatus;
  const annualTurnoverTier = opts.annualTurnoverTier;
  const targetMarginPct = opts.targetMarginPct ?? 15;
  const marketplaceFeePct = opts.marketplaceFeePct ?? 6.5;
  const totalLandedCostSeFaktur = opts.additionalLandedCostTotal ?? 0;

  // 1. Cek apakah ini format e-Faktur DJP
  const efaktur = parseEFakturDjpData(text);
  if (efaktur && efaktur.documentType === 'E_FAKTUR_DJP') {
    // Ekstraksi detail transaksi item jika ada XML tag detailTransaksi
    const items: ParsedInvoiceItem[] = [];
    const itemMatches = text.match(/<detailTransaksi>([\s\S]*?)<\/detailTransaksi>/gi) || [];

    for (const [idx, itemXml] of itemMatches.entries()) {
      const getTag = (t: string) => {
        const m = itemXml.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`, 'i'));
        return m ? m[1].trim() : '';
      };

      const name = getTag('nama') || `Item ${idx + 1}`;
      const qty = cleanCurrency(getTag('jumlahBarang')) || 1;
      const unitPrice = cleanCurrency(getTag('hargaSatuan'));
      const dpp = cleanCurrency(getTag('dpp')) || (unitPrice * qty);
      const ppn = cleanCurrency(getTag('ppn')) || Math.round(dpp * 0.11);
      const detected = autoDetectCategory(name);

      items.push({
        id: `item-${idx + 1}`,
        name,
        quantity: qty,
        unit: 'PCS',
        unitPrice,
        totalPrice: dpp + ppn,
        dpp,
        ppnAmount: ppn,
        categoryType: detected.category,
        allocatedLandedCost: 0,
        cleanHppPerUnit: 0,
        recommendedOfflinePrice: 0,
        recommendedMarketplacePrice: 0,
        expectedProfitNominal: 0,
      });
    }

    // Jika detail tidak ada di XML, buat 1 agregat item dari DPP total
    if (items.length === 0 && (efaktur.totalDpp || 0) > 0) {
      items.push({
        id: 'item-1',
        name: 'Produk Faktur Pajak DJP',
        quantity: 1,
        unit: 'LOT',
        unitPrice: efaktur.totalDpp || 0,
        totalPrice: (efaktur.totalDpp || 0) + (efaktur.totalPpn || 0),
        dpp: efaktur.totalDpp || 0,
        ppnAmount: efaktur.totalPpn || 0,
        categoryType: 'KATEGORI_B',
        allocatedLandedCost: totalLandedCostSeFaktur,
        cleanHppPerUnit: 0,
        recommendedOfflinePrice: 0,
        recommendedMarketplacePrice: 0,
        expectedProfitNominal: 0,
      });
    }

    // Alokasikan landed cost proporsional berdasarkan DPP
    prorateAndCalculateItems({
      items,
      totalLandedCostSeFaktur,
      buyerTaxStatus,
      targetMarginPct,
      marketplaceFeePct,
      annualTurnoverTier,
      factoryPpnStatus: 'BELUM_PPN' // Di e-Faktur DJP, hargaSatuan adalah DPP murni sebelum PPN
    });

    return {
      documentType: 'E_FAKTUR_DJP',
      documentTypeLabel: 'Faktur Pajak Resmi (e-Faktur DJP)',
      invoiceNumber: efaktur.invoiceNumber,
      invoiceDate: efaktur.invoiceDate,
      sellerName: efaktur.sellerName,
      sellerNpwp: efaktur.sellerNpwp,
      buyerName: efaktur.buyerName,
      buyerNpwp: efaktur.buyerNpwp,
      isOfficialTaxInvoice: true,
      factoryPpnStatus: 'SUDAH_PPN',
      subtotal: efaktur.totalDpp || 0,
      discountTotal: 0,
      totalDpp: efaktur.totalDpp || 0,
      totalPpn: efaktur.totalPpn || 0,
      grandTotal: efaktur.grandTotal || 0,
      items,
      auditNotes: efaktur.auditNotes || [],
    };
  }

  // 2. Analisis Berbasis OCR Teks Baris per Baris (Nota / Invoice Komersial)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let docType: DetectedDocumentType = 'UNKNOWN';
  let sellerName = '';
  let invoiceNumber = '';
  let invoiceDate = '';
  let subtotal = 0;
  let totalDpp = 0;
  let totalPpn = 0;
  let grandTotal = 0;
  let discountTotal = 0;
  let hasPpn11 = false;
  let isNonPkp = false;

  const upperText = text.toUpperCase();

  // Deteksi Tipe Dokumen
  if (upperText.includes('FAKTUR PAJAK') || upperText.includes('NSFP') || upperText.includes('E-FAKTUR')) {
    docType = 'E_FAKTUR_DJP';
  } else if (upperText.includes('INVOICE') || upperText.includes('FAKTUR PENJUALAN') || upperText.includes('SURAT JALAN') || upperText.includes('PURCHASE ORDER')) {
    docType = 'COMMERCIAL_INVOICE';
  } else if (upperText.includes('NOTA') || upperText.includes('KASIR') || upperText.includes('BON') || upperText.includes('KWITANSI')) {
    docType = 'NOTA_KONTAN';
  } else {
    docType = 'COMMERCIAL_INVOICE';
  }

  // Deteksi PPN & Pajak
  if (upperText.includes('PPN') || upperText.includes('VAT') || upperText.includes('11%') || upperText.includes('PAJAK PERTAMBAHAN NILAI')) {
    hasPpn11 = true;
  }
  if (upperText.includes('NON PKP') || upperText.includes('NON-PKP') || upperText.includes('TIDAK MEMUNGUT PPN')) {
    isNonPkp = true;
    hasPpn11 = false;
  }

  // Ekstraksi baris transaksi item barang
  const items: ParsedInvoiceItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Deteksi Nomor Invoice (hindari alamat jalan seperti "Jl. ... No. 45")
    if (!invoiceNumber && !upper.includes('JL.') && !upper.includes('JALAN') && !upper.includes('RAYA')) {
      const invMatch = line.match(/(?:INVOICE|INV|FAKTUR|NOTA)[\s.:#Nno]+([A-Za-z0-9\/-]+)/i);
      if (invMatch && invMatch[1] && invMatch[1].length > 2) {
        invoiceNumber = invMatch[1].trim();
      } else if (upper.startsWith('NO.') || upper.startsWith('NOMOR:')) {
        invoiceNumber = line.replace(/^(?:NO\.|NOMOR:?)\s*/i, '').trim();
      }
    }

    // Deteksi Tanggal
    if (!invoiceDate && (upper.includes('TGL') || upper.includes('TANGGAL') || upper.includes('DATE'))) {
      const match = line.match(/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/);
      if (match) invoiceDate = match[0];
    }

    // Deteksi Penjual
    if (!sellerName && (upper.includes('PT.') || upper.includes('CV.') || upper.includes('UD.') || upper.includes('TOKO '))) {
      sellerName = line;
    }

    // Deteksi Ringkasan Total
    if (upper.includes('SUBTOTAL') || upper.includes('JUMLAH HARGA')) {
      subtotal = cleanCurrency(line);
    } else if (upper.includes('PPN') || upper.includes('PPN 11%') || upper.includes('PAJAK')) {
      totalPpn = cleanCurrency(line);
    } else if (upper.includes('TOTAL') || upper.includes('GRAND TOTAL') || upper.includes('JUMLAH TOTAL')) {
      grandTotal = cleanCurrency(line);
    } else if (upper.includes('DISKON') || upper.includes('POTONGAN')) {
      discountTotal = cleanCurrency(line);
    }

    // Deteksi Item Barang: Pola "Nama Barang ... Qty x Harga ... Total"
    // Contoh: "Minyak Goreng Sania 2L   10 Dus   Rp 180.000   1.800.000"
    // Contoh: "1. Beras Pandan Wangi 5kg | Qty: 20 | Harga: 65.000"
    const numberMatches = line.match(/\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/g);
    if (numberMatches && numberMatches.length >= 2 && !upper.includes('TOTAL') && !upper.includes('TELP') && !upper.includes('NPWP')) {
      // Ambil angka terakhir sebagai total baris dan angka sebelumnya sebagai harga satuan / qty
      const candidateTotal = cleanCurrency(numberMatches[numberMatches.length - 1]);
      const candidatePrice = cleanCurrency(numberMatches[numberMatches.length - 2]);
      let qty = 1;

      if (numberMatches.length >= 3) {
        qty = cleanCurrency(numberMatches[numberMatches.length - 3]) || 1;
      } else if (candidatePrice > 0) {
        qty = Math.round(candidateTotal / candidatePrice) || 1;
      }

      // Bersihkan nama produk dari angka-angka harga di ujung
      let cleanName = line;
      for (const numStr of numberMatches) {
        cleanName = cleanName.replace(numStr, '');
      }
      cleanName = cleanName.replace(/[|:xX@Rp.,\t-]/g, ' ').replace(/\s+/g, ' ').trim();

      if (cleanName.length > 2 && candidateTotal > 1000) {
        const detected = autoDetectCategory(cleanName);
        items.push({
          id: `item-${items.length + 1}`,
          name: cleanName,
          quantity: qty,
          unit: 'PCS',
          unitPrice: candidatePrice || Math.round(candidateTotal / qty),
          totalPrice: candidateTotal,
          dpp: candidateTotal,
          ppnAmount: 0,
          categoryType: detected.category,
          allocatedLandedCost: 0,
          cleanHppPerUnit: 0,
          recommendedOfflinePrice: 0,
          recommendedMarketplacePrice: 0,
          expectedProfitNominal: 0,
        });
      }
    }
  }

  // Jika tidak ada item yang terekstrak secara parsing baris, buat 1 item fallback dari Grand Total
  if (items.length === 0) {
    const fallbackPrice = grandTotal || subtotal || 100000;
    const detected = autoDetectCategory(text);
    items.push({
      id: 'item-1',
      name: detected.category === 'KATEGORI_A' ? 'Komoditas Sembako' : 'Produk Faktur Masukan',
      quantity: 1,
      unit: 'LOT',
      unitPrice: fallbackPrice,
      totalPrice: fallbackPrice,
      dpp: fallbackPrice,
      ppnAmount: 0,
      categoryType: detected.category,
      allocatedLandedCost: totalLandedCostSeFaktur,
      cleanHppPerUnit: 0,
      recommendedOfflinePrice: 0,
      recommendedMarketplacePrice: 0,
      expectedProfitNominal: 0,
    });
  }

  // Hitung DPP & Grand Total jika belum terekstrak
  if (totalDpp === 0) {
    totalDpp = items.reduce((s, it) => s + it.dpp, 0);
  }
  if (hasPpn11 && totalPpn === 0) {
    totalPpn = Math.round(totalDpp * 0.11);
  }
  if (grandTotal === 0) {
    grandTotal = totalDpp + totalPpn - discountTotal;
  }

  // Tentukan Status PPN Pabrik
  let factoryPpnStatus: FactoryPpnStatus = 'BELUM_PPN';
  if (isNonPkp) {
    factoryPpnStatus = 'NON_PKP';
  } else if (hasPpn11) {
    factoryPpnStatus = 'SUDAH_PPN';
  } else {
    factoryPpnStatus = 'BELUM_PPN';
  }

  // Alokasikan landed cost pro-rata dan hitung HPP & rekomendasi harga
  prorateAndCalculateItems({
    items,
    totalLandedCostSeFaktur,
    buyerTaxStatus,
    targetMarginPct,
    marketplaceFeePct,
    annualTurnoverTier,
    factoryPpnStatus
  });

  const auditNotes: string[] = [];
  if (docType === 'E_FAKTUR_DJP') {
    auditNotes.push('Dokumen dikenali sebagai Faktur Pajak Resmi e-Faktur.');
  } else if (docType === 'COMMERCIAL_INVOICE') {
    auditNotes.push('Dokumen adalah Invoice Komersial / Faktur Penjualan Pabrik.');
    if (hasPpn11 && buyerTaxStatus === 'PKP') {
      auditNotes.push('Perhatian: Pastikan supplier memberikan lampiran e-Faktur resmi dengan NSFP agar PPN 11% dapat dikreditkan di SPT Masa.');
    }
  } else if (docType === 'NOTA_KONTAN') {
    auditNotes.push('Peringatan: Dokumen adalah Nota Tunai manual (bukan Faktur Pajak resmi).');
    if (buyerTaxStatus === 'PKP') {
      auditNotes.push('PPN di nota manual TIDAK DAPAT dikreditkan di SPT pajak dan wajib dimasukkan ke modal dasar (HPP).');
    }
  }

  if (buyerTaxStatus === 'NON_PKP' && hasPpn11) {
    auditNotes.push('Karena usaha Anda Non-PKP, seluruh beban PPN 11% telah otomatis dikapitalisasi ke dalam HPP modal setiap item.');
  }

  return {
    documentType: docType,
    documentTypeLabel:
      docType === 'E_FAKTUR_DJP'
        ? 'Faktur Pajak Elektronik Resmi (e-Faktur DJP)'
        : docType === 'COMMERCIAL_INVOICE'
        ? 'Invoice Komersial / Faktur Pabrik'
        : docType === 'NOTA_KONTAN'
        ? 'Nota Kontan / Bon Belanja Manual'
        : 'Dokumen Belum Teridentifikasi',
    invoiceNumber: invoiceNumber || undefined,
    invoiceDate: invoiceDate || undefined,
    sellerName: sellerName || undefined,
    isOfficialTaxInvoice: docType === 'E_FAKTUR_DJP',
    factoryPpnStatus,
    subtotal: subtotal || totalDpp,
    discountTotal,
    totalDpp,
    totalPpn,
    grandTotal,
    items,
    auditNotes,
  };
}

/**
 * Prorate Landed Cost (Ongkos kirim/bongkar muat) ke seluruh item dan hitung HPP per item
 */
function prorateAndCalculateItems(opts: {
  items: ParsedInvoiceItem[];
  totalLandedCostSeFaktur: number;
  buyerTaxStatus: BuyerTaxStatus;
  targetMarginPct: number;
  marketplaceFeePct: number;
  annualTurnoverTier: AnnualTurnoverTier;
  factoryPpnStatus: FactoryPpnStatus;
}) {
  const {
    items,
    totalLandedCostSeFaktur,
    buyerTaxStatus,
    targetMarginPct,
    marketplaceFeePct,
    annualTurnoverTier,
    factoryPpnStatus
  } = opts;

  const totalDppFaktur = items.reduce((s, it) => s + it.dpp, 0);

  for (const item of items) {
    // Alokasi landed cost berdasarkan bobot nilai DPP
    const ratio = totalDppFaktur > 0 ? item.dpp / totalDppFaktur : 1 / items.length;
    const allocatedCostForItem = Math.round(totalLandedCostSeFaktur * ratio);
    const allocatedPerUnit = item.quantity > 0 ? Math.round(allocatedCostForItem / item.quantity) : 0;
    item.allocatedLandedCost = allocatedCostForItem;

    // Hitung kalkulasi HPP & harga per item menggunakan B2B Tax Calculator
    const calc = calculateB2bHppAndPricing({
      productName: item.name,
      categoryType: item.categoryType,
      factoryPurchasePrice: item.unitPrice,
      factoryPpnStatus,
      shippingCostPerUnit: allocatedPerUnit,
      handlingCostPerUnit: 0,
      packagingCostPerUnit: 0,
      buyerTaxStatus,
      targetMarginPct,
      marketplaceFeePct,
      annualTurnoverTier,
    });

    item.cleanHppPerUnit = calc.costBreakdown.cleanHppPerUnit;
    item.recommendedOfflinePrice = calc.pricing.recommendedOfflinePrice;
    item.recommendedMarketplacePrice = calc.pricing.recommendedMarketplacePrice;
    item.expectedProfitNominal = calc.pricing.expectedOnlineProfitNominal;
  }
}
