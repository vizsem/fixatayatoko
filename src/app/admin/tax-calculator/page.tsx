'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calculator,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Percent,
  Truck,
  Building2,
  Receipt,
  Store,
  DollarSign,
  AlertTriangle,
  Info,
  Copy,
  Printer,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Package,
  Layers,
  CheckCircle2,
  FileText,
  ScanText,
  FileSpreadsheet,
  UploadCloud,
  Check,
  ChevronRight,
  QrCode,
  AlertCircle
} from 'lucide-react';
import notify from '@/lib/notify';
import {
  calculateB2bHppAndPricing,
  autoDetectCategory,
  B2bTaxInput,
  ProductCategoryType,
  FactoryPpnStatus,
  BuyerTaxStatus,
  AnnualTurnoverTier,
  PPH22_RATES
} from '@/lib/b2b-tax-calculator';
import {
  parseScannedDocument,
  ParsedDocumentResult
} from '@/lib/invoice-ocr-parser';

// Presets untuk memudahkan input 1-klik
const PRESETS = [
  {
    name: 'Beras Sembako 5kg',
    categoryType: 'KATEGORI_A' as ProductCategoryType,
    factoryPrice: 62000,
    factoryPpn: 'BELUM_PPN' as FactoryPpnStatus,
    shipping: 1500,
    handling: 500,
    packaging: 1000,
    marginPct: 15,
    industryType: 'NONE' as keyof typeof PPH22_RATES,
  },
  {
    name: 'Minyak Goreng Botol 2L',
    categoryType: 'KATEGORI_B' as ProductCategoryType,
    factoryPrice: 28500,
    factoryPpn: 'BELUM_PPN' as FactoryPpnStatus,
    shipping: 1000,
    handling: 200,
    packaging: 0,
    marginPct: 18,
    industryType: 'NONE' as keyof typeof PPH22_RATES,
  },
  {
    name: 'Sabun Mandi / Detergen',
    categoryType: 'KATEGORI_B' as ProductCategoryType,
    factoryPrice: 18000,
    factoryPpn: 'SUDAH_PPN' as FactoryPpnStatus,
    shipping: 800,
    handling: 150,
    packaging: 0,
    marginPct: 20,
    industryType: 'NONE' as keyof typeof PPH22_RATES,
  },
  {
    name: 'Semen Sak 50kg',
    categoryType: 'KATEGORI_C' as ProductCategoryType,
    factoryPrice: 61000,
    factoryPpn: 'BELUM_PPN' as FactoryPpnStatus,
    shipping: 4000,
    handling: 1000,
    packaging: 0,
    marginPct: 12,
    industryType: 'SEMEN' as keyof typeof PPH22_RATES,
  },
  {
    name: 'Baja Ringan Profil C',
    categoryType: 'KATEGORI_C' as ProductCategoryType,
    factoryPrice: 85000,
    factoryPpn: 'BELUM_PPN' as FactoryPpnStatus,
    shipping: 6000,
    handling: 1500,
    packaging: 0,
    marginPct: 15,
    industryType: 'BAJA' as keyof typeof PPH22_RATES,
  },
];

// Sample dokumen OCR untuk uji coba 1-klik
const SAMPLE_DOCS = {
  E_FAKTUR: `<resValidateFakturPm>
  <kdJenisTransaksi>01</kdJenisTransaksi>
  <fgPengganti>0</fgPengganti>
  <nomorFaktur>0100022498765432</nomorFaktur>
  <tanggalFaktur>24/10/2026</tanggalFaktur>
  <npwpPenjual>01.234.567.8-012.000</npwpPenjual>
  <namaPenjual>PT INDOFOOD MAKMUR SEJAHTERA</namaPenjual>
  <jumlahDpp>25000000</jumlahDpp>
  <jumlahPpn>2750000</jumlahPpn>
  <detailTransaksi>
    <nama>Beras Rojolele Super 10kg</nama>
    <jumlahBarang>150</jumlahBarang>
    <hargaSatuan>120000</hargaSatuan>
    <dpp>18000000</dpp>
    <ppn>0</ppn>
  </detailTransaksi>
  <detailTransaksi>
    <nama>Minyak Goreng Sania 2L</nama>
    <jumlahBarang>200</jumlahBarang>
    <hargaSatuan>35000</hargaSatuan>
    <dpp>7000000</dpp>
    <ppn>770000</ppn>
  </detailTransaksi>
</resValidateFakturPm>`,

  INVOICE_PABRIK: `PT. SINAR JAYA LOGISTIK & SEMBAKO
Jl. Raya Industri Km. 12 No. 88 Tangerang
FAKTUR PENJUALAN: INV-2026-X891
TANGGAL: 23/10/2026
PEMBELI: TOKO GROSIR BERKAH (NON-PKP)

DAFTAR BARANG:
1. Minyak Goreng Sovia 2L (Dus)    50 Dus    @ Rp 210.000    10.500.000
2. Sabun Cuci Detergen 800g        40 Karung @ Rp 140.000     5.600.000
3. Beras Pandan Wangi 5kg          60 Sak    @ Rp  65.000     3.900.000

SUBTOTAL: Rp 20.000.000
PPN 11% (DIPUNGUT): Rp 1.771.000
TOTAL TAGIHAN FAKTUR: Rp 21.771.000`,

  NOTA_KONTAN: `NOTA KONTAN UD. AGRO JAYA
No. Nota: NK-4512
Tanggal: 25-10-2026
Toko Langganan

1. Jagung Pakan Ternak 50kg   20 Karung x Rp 275.000 = Rp 5.500.000
2. Telur Ayam Ras Peti        10 Peti   x Rp 310.000 = Rp 3.100.000

TOTAL PEMBAYARAN TUNAI: Rp 8.600.000
(Harga Netto - Tanpa PPN)`
};

export default function TaxCalculatorPage() {
  const [activeTab, setActiveTab] = useState<'SINGLE_CALC' | 'OCR_DOCUMENT'>('SINGLE_CALC');

  // State Kalkulator Satuan (Mode 1)
  const [productName, setProductName] = useState('Minyak Goreng Kemasan 2L');
  const [categoryType, setCategoryType] = useState<ProductCategoryType>('KATEGORI_B');
  const [industryType, setIndustryType] = useState<keyof typeof PPH22_RATES>('NONE');
  const [cukaiNominal, setCukaiNominal] = useState<number>(0);

  const [factoryPrice, setFactoryPrice] = useState<number>(30000);
  const [factoryPpnStatus, setFactoryPpnStatus] = useState<FactoryPpnStatus>('BELUM_PPN');

  const [shippingCost, setShippingCost] = useState<number>(1200);
  const [handlingCost, setHandlingCost] = useState<number>(300);
  const [packagingCost, setPackagingCost] = useState<number>(500);

  const [buyerTaxStatus, setBuyerTaxStatus] = useState<BuyerTaxStatus>('NON_PKP');
  const [targetMarginPct, setTargetMarginPct] = useState<number>(15);
  const [marginType, setMarginType] = useState<'MARKUP_FROM_COST' | 'MARGIN_FROM_SALES'>('MARGIN_FROM_SALES');

  const [marketplaceFeePct, setMarketplaceFeePct] = useState<number>(6.5);
  const [marketplaceFixedFee, setMarketplaceFixedFee] = useState<number>(1000);

  const [annualTurnoverTier, setAnnualTurnoverTier] = useState<AnnualTurnoverTier>('500M_TO_4_8B');

  // State OCR & Scan Dokumen (Mode 2)
  const [ocrRawText, setOcrRawText] = useState(SAMPLE_DOCS.INVOICE_PABRIK);
  const [ocrLandedCostTotal, setOcrLandedCostTotal] = useState<number>(450000); // Misal ongkir sefaktur
  const [parsedDoc, setParsedDoc] = useState<ParsedDocumentResult | null>(null);

  // Live Auto Detect Category saat mengetik nama produk di Mode 1
  const handleProductNameChange = (val: string) => {
    setProductName(val);
    const detected = autoDetectCategory(val);
    if (detected.category !== categoryType) {
      setCategoryType(detected.category);
    }
    if (detected.industry) {
      setIndustryType(detected.industry);
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setProductName(preset.name);
    setCategoryType(preset.categoryType);
    setFactoryPrice(preset.factoryPrice);
    setFactoryPpnStatus(preset.factoryPpn);
    setShippingCost(preset.shipping);
    setHandlingCost(preset.handling);
    setPackagingCost(preset.packaging);
    setTargetMarginPct(preset.marginPct);
    setIndustryType(preset.industryType);
    notify.success(`Preset "${preset.name}" diterapkan!`);
  };

  // Kalkulasi Hasil Akuntansi Satuan
  const calcResult = useMemo(() => {
    const input: B2bTaxInput = {
      productName,
      categoryType,
      industryType,
      cukaiOrPbnbmNominal: cukaiNominal,
      factoryPurchasePrice: factoryPrice,
      factoryPpnStatus,
      shippingCostPerUnit: shippingCost,
      handlingCostPerUnit: handlingCost,
      packagingCostPerUnit: packagingCost,
      buyerTaxStatus,
      targetMarginPct,
      marginType,
      marketplaceFeePct,
      marketplaceFixedFee,
      annualTurnoverTier,
    };
    return calculateB2bHppAndPricing(input);
  }, [
    productName,
    categoryType,
    industryType,
    cukaiNominal,
    factoryPrice,
    factoryPpnStatus,
    shippingCost,
    handlingCost,
    packagingCost,
    buyerTaxStatus,
    targetMarginPct,
    marginType,
    marketplaceFeePct,
    marketplaceFixedFee,
    annualTurnoverTier,
  ]);

  // Eksekusi Parse Dokumen OCR
  const handleRunOcrParse = () => {
    if (!ocrRawText.trim()) {
      notify.error('Silakan masukkan teks dokumen hasil scan atau pilih sampel dokumen');
      return;
    }
    try {
      const res = parseScannedDocument({
        rawText: ocrRawText,
        buyerTaxStatus,
        annualTurnoverTier,
        targetMarginPct,
        marketplaceFeePct,
        additionalLandedCostTotal: ocrLandedCostTotal,
      });
      setParsedDoc(res);
      notify.success(`Dokumen ${res.documentTypeLabel} berhasil dianalisis (${res.items.length} item ditemukan)!`);
    } catch (e: any) {
      notify.error('Gagal memproses dokumen: ' + (e?.message || 'Format tidak dikenali'));
    }
  };

  const loadSampleDoc = (sample: string, name: string) => {
    setOcrRawText(sample);
    notify.success(`Sampel ${name} dimuat! Silakan klik "Analisis Dokumen"`);
  };

  const copySummary = () => {
    if (activeTab === 'SINGLE_CALC') {
      navigator.clipboard.writeText(calcResult.summaryText);
      notify.success('Rincian kalkulasi berhasil disalin ke clipboard!');
    } else if (parsedDoc) {
      let memo = `=== ANALISIS DOKUMEN FAKTUR & HPP BERSIH ===\n`;
      memo += `Jenis Dokumen: ${parsedDoc.documentTypeLabel}\n`;
      memo += `No. Faktur: ${parsedDoc.invoiceNumber || '-'}\n`;
      memo += `Penjual: ${parsedDoc.sellerName || '-'}\n`;
      memo += `Total DPP: Rp ${parsedDoc.totalDpp.toLocaleString('id-ID')}\n`;
      memo += `Total PPN: Rp ${parsedDoc.totalPpn.toLocaleString('id-ID')}\n`;
      memo += `Total Grand: Rp ${parsedDoc.grandTotal.toLocaleString('id-ID')}\n\n`;
      memo += `RINCIAN HPP & HARGA AMAN PER ITEM:\n`;
      parsedDoc.items.forEach((it, idx) => {
        memo += `${idx + 1}. ${it.name} (Qty: ${it.quantity} ${it.unit})\n`;
        memo += `   - Kategori Pajak: ${it.categoryType}\n`;
        memo += `   - Landed Cost Teralokasi: Rp ${it.allocatedLandedCost.toLocaleString('id-ID')}\n`;
        memo += `   - HPP Bersih Riil: Rp ${it.cleanHppPerUnit.toLocaleString('id-ID')} / unit\n`;
        memo += `   - Rekomendasi Jual Offline: Rp ${it.recommendedOfflinePrice.toLocaleString('id-ID')}\n`;
        memo += `   - Rekomendasi Jual Marketplace: Rp ${it.recommendedMarketplacePrice.toLocaleString('id-ID')}\n\n`;
      });
      navigator.clipboard.writeText(memo);
      notify.success('Rincian analisis faktur multi-item disalin!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6 md:p-8 space-y-5 sm:space-y-6 text-slate-900">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl shadow-xs">
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Kalkulator Pajak B2B & HPP Anti-Boncos
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
            Ekstraksi scan invoice pabrik (OCR), verifikasi e-Faktur DJP, landed cost proration, dan rekomendasi harga aman marketplace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={copySummary}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition active:scale-95"
          >
            <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
            Salin Rincian
          </button>
          <button
            onClick={handlePrint}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Cetak
          </button>
          <Link
            href="/admin/products/pricing-hpp"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-medium shadow-sm transition active:scale-95"
          >
            <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            HPP Katalog
          </Link>
        </div>
      </div>

      {/* Mode Tab Switcher */}
      <div className="flex flex-col sm:flex-row border border-slate-200 bg-white p-1 rounded-xl shadow-xs max-w-xl gap-1">
        <button
          onClick={() => setActiveTab('SINGLE_CALC')}
          className={`py-2.5 px-4 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
            activeTab === 'SINGLE_CALC'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Kalkulator Satuan Cepat
        </button>
        <button
          onClick={() => {
            setActiveTab('OCR_DOCUMENT');
            if (!parsedDoc) handleRunOcrParse();
          }}
          className={`py-2.5 px-4 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${
            activeTab === 'OCR_DOCUMENT'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ScanText className="w-4 h-4" />
          Scan Faktur & OCR Multi-Item
          <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
            Pintar
          </span>
        </button>
      </div>

      {/* TAB 1: KALKULATOR SATUAN CEPAT */}
      {activeTab === 'SINGLE_CALC' && (
        <div className="space-y-6">
          {/* Preset Cepat Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Preset Cepat:
            </span>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyPreset(p)}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 transition"
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Kolom Kiri: INPUT DATA TRANSAKSI (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span>Data Transaksi Pengadaan</span>
                  <span className="text-xs font-normal text-slate-500">Tingkat Pabrik (B2B)</span>
                </h2>

                {/* 1. Nama Produk */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    1. Nama Produk / Komoditas
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => handleProductNameChange(e.target.value)}
                    placeholder="Misal: Beras Pandan Wangi 5kg / Minyak Goreng"
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                {/* Kategori Produk */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kategori Pajak
                    </label>
                    <select
                      value={categoryType}
                      onChange={(e) => setCategoryType(e.target.value as ProductCategoryType)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="KATEGORI_A">Kategori A (Bebas PPN: Sembako/Pokok)</option>
                      <option value="KATEGORI_B">Kategori B (PPN 11%: Konsumsi Umum)</option>
                      <option value="KATEGORI_C">Kategori C (Industri / PPh 22)</option>
                      <option value="KATEGORI_D">Kategori D (Cukai / Mewah)</option>
                    </select>
                  </div>

                  {categoryType === 'KATEGORI_C' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Jenis Industri PPh 22
                      </label>
                      <select
                        value={industryType}
                        onChange={(e) => setIndustryType(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                      >
                        {Object.entries(PPH22_RATES).map(([key, val]) => (
                          <option key={key} value={key}>
                            {val.label} ({val.ratePct}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {categoryType === 'KATEGORI_D' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Biaya Cukai / PPnBM (Rp/Unit)
                      </label>
                      <input
                        type="number"
                        value={cukaiNominal}
                        onChange={(e) => setCukaiNominal(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* 2 & 3. Harga Beli dari Pabrik & Status PPN */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      2. Harga Beli Pabrik (Faktur)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={factoryPrice}
                        onChange={(e) => setFactoryPrice(Number(e.target.value))}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      3. Status PPN Pabrik
                    </label>
                    <select
                      value={factoryPpnStatus}
                      onChange={(e) => setFactoryPpnStatus(e.target.value as FactoryPpnStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium bg-white"
                    >
                      <option value="BELUM_PPN">Belum termasuk PPN 11% (Exclude)</option>
                      <option value="SUDAH_PPN">Sudah termasuk PPN 11% (Include)</option>
                      <option value="NON_PKP">Non-PKP (Tanpa PPN)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Biaya Tambahan Pengadaan (Landed Costs) */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    4. Biaya Pengadaan Tambahan per Unit (Landed Cost)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500">Ongkos Kirim/Truk</span>
                      <input
                        type="number"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Bongkar Muat</span>
                      <input
                        type="number"
                        value={handlingCost}
                        onChange={(e) => setHandlingCost(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Packaging/Karung</span>
                      <input
                        type="number"
                        value={packagingCost}
                        onChange={(e) => setPackagingCost(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs mt-0.5"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Status Usaha Kita (Pembeli) */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    5. Status Usaha Toko Kita (Pembeli)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBuyerTaxStatus('NON_PKP')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-left flex items-start gap-2 transition ${
                        buyerTaxStatus === 'NON_PKP'
                          ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-400'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="mt-0.5">
                        {buyerTaxStatus === 'NON_PKP' ? <ShieldAlert className="w-4 h-4 text-amber-600" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                      </div>
                      <div>
                        <div className="font-semibold">NON-PKP</div>
                        <div className="text-[10px] text-slate-500">PPN 11% hangus & jadi beban HPP</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBuyerTaxStatus('PKP')}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border text-left flex items-start gap-2 transition ${
                        buyerTaxStatus === 'PKP'
                          ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-400'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="mt-0.5">
                        {buyerTaxStatus === 'PKP' ? <ShieldCheck className="w-4 h-4 text-blue-600" /> : <div className="w-4 h-4 rounded-full border border-slate-300" />}
                      </div>
                      <div>
                        <div className="font-semibold">PKP</div>
                        <div className="text-[10px] text-slate-500">PPN Masukan dikreditkan di SPT</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 6. Target Margin Keuntungan */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      6. Target Margin (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={targetMarginPct}
                        onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                        className="w-full pr-8 pl-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Metode Margin
                    </label>
                    <select
                      value={marginType}
                      onChange={(e) => setMarginType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="MARGIN_FROM_SALES">Margin dari Omzet</option>
                      <option value="MARKUP_FROM_COST">Markup dari HPP</option>
                    </select>
                  </div>
                </div>

                {/* 7. Biaya Platform Marketplace */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    7. Biaya Platform / Marketplace (Admin + Layanan)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => { setMarketplaceFeePct(0); setMarketplaceFixedFee(0); }}
                      className={`text-[11px] px-2.5 py-1 rounded border font-medium ${marketplaceFeePct === 0 ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600'}`}
                    >
                      Toko Fisik (0%)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMarketplaceFeePct(6.5); setMarketplaceFixedFee(1000); }}
                      className={`text-[11px] px-2.5 py-1 rounded border font-medium ${marketplaceFeePct === 6.5 ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600'}`}
                    >
                      Shopee (6.5% + 1rb)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMarketplaceFeePct(7.0); setMarketplaceFixedFee(1000); }}
                      className={`text-[11px] px-2.5 py-1 rounded border font-medium ${marketplaceFeePct === 7.0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600'}`}
                    >
                      TikTok Shop (7%)
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={marketplaceFeePct}
                        onChange={(e) => setMarketplaceFeePct(Number(e.target.value))}
                        className="w-full pl-3 pr-8 py-1.5 border border-slate-300 rounded-md text-xs font-medium"
                        placeholder="Persen (%)"
                      />
                      <span className="absolute right-3 top-1.5 text-xs text-slate-400">%</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">Rp</span>
                      <input
                        type="number"
                        value={marketplaceFixedFee}
                        onChange={(e) => setMarketplaceFixedFee(Number(e.target.value))}
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-md text-xs"
                        placeholder="Fee tetap (Rp)"
                      />
                    </div>
                  </div>
                </div>

                {/* 8. Estimasi Omzet Tahunan */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    8. Estimasi Omzet Usaha Tahunan (PPh Final UMKM PP 55/2022)
                  </label>
                  <select
                    value={annualTurnoverTier}
                    onChange={(e) => setAnnualTurnoverTier(e.target.value as AnnualTurnoverTier)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="UNDER_500M">Di bawah Rp 500 Juta / tahun (Bebas PPh Final 0%)</option>
                    <option value="500M_TO_4_8B">Rp 500 Juta s.d. Rp 4,8 Miliar / tahun (PPh Final 0,5%)</option>
                    <option value="ABOVE_4_8B">Di atas Rp 4,8 Miliar / tahun (Wajib PKP & Pembukuan)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Kolom Kanan: FORMAT OUTPUT PROFESIONAL & ANTI-BONCOS (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Card Peringatan Keamanan / Anti-Boncos */}
              {calcResult.warnings.length > 0 && (
                <div className="space-y-2">
                  {calcResult.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border flex items-start gap-3 ${
                        warn.severity === 'DANGER'
                          ? 'bg-rose-50 border-rose-200 text-rose-950'
                          : warn.severity === 'WARNING'
                          ? 'bg-amber-50 border-amber-200 text-amber-950'
                          : 'bg-blue-50 border-blue-200 text-blue-950'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          warn.severity === 'DANGER'
                            ? 'text-rose-600'
                            : warn.severity === 'WARNING'
                            ? 'text-amber-600'
                            : 'text-blue-600'
                        }`}
                      />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide">
                          {warn.title}
                        </h4>
                        <p className="text-xs mt-0.5 leading-relaxed">{warn.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 1. Kategori & Status Pajak */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Kategori Produk & Status Pajak
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {calcResult.categoryType}
                  </span>
                </div>

                <div className="text-sm font-semibold text-slate-800">
                  {calcResult.taxProjection.taxCategoryDescription}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block">Status Toko Kita:</span>
                    <span className="font-semibold text-slate-800">
                      {buyerTaxStatus === 'PKP' ? 'PKP (Bisa Kreditkan PPN)' : 'Non-PKP (PPN Beban Modal)'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-slate-500 block">Faktur Pajak Pabrik:</span>
                    <span className="font-semibold text-slate-800">
                      {factoryPpnStatus === 'BELUM_PPN'
                        ? 'Exclude (PPN 11% Ditagih Terpisah)'
                        : factoryPpnStatus === 'SUDAH_PPN'
                        ? 'Include (PPN 11% Melekat di Harga)'
                        : 'Non-PKP (Tanpa PPN)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Rincian Komponen Modal (HPP Bersih Riil) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span>2. Rincian Komponen Modal (HPP Bersih) per Unit</span>
                  <span className="text-xs font-normal text-slate-400">Transparan & Terverifikasi</span>
                </h3>

                <div className="divide-y divide-slate-100 text-sm">
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-600">DPP (Harga Pokok Dasar Pabrik)</span>
                    <span className="font-semibold text-slate-900">
                      Rp {calcResult.costBreakdown.dppPerUnit.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center">
                    <div>
                      <span className="text-slate-600">PPN Masukan 11% Beban HPP</span>
                      {buyerTaxStatus === 'PKP' && (
                        <span className="ml-2 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          Dikreditkan di SPT (Bukan Biaya)
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-900">
                      Rp {calcResult.costBreakdown.ppnCapitalizedToHpp.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {calcResult.costBreakdown.pph22PerUnit > 0 && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-600">PPh Pasal 22 Industri</span>
                      <span className="font-semibold text-slate-900">
                        Rp {calcResult.costBreakdown.pph22PerUnit.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}

                  {calcResult.costBreakdown.cukaiOrPpnbmPerUnit > 0 && (
                    <div className="py-2.5 flex justify-between items-center">
                      <span className="text-slate-600">Cukai / PPnBM Mewah</span>
                      <span className="font-semibold text-slate-900">
                        Rp {calcResult.costBreakdown.cukaiOrPpnbmPerUnit.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}

                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-slate-600">Landed Cost (Ongkir + Bongkar + Kemasan)</span>
                    <span className="font-semibold text-slate-900">
                      Rp {calcResult.costBreakdown.totalLandedCostPerUnit.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {/* Total HPP Highlight */}
                  <div className="pt-3.5 pb-1 flex justify-between items-center text-base">
                    <span className="font-bold text-slate-900">TOTAL HPP BERSIH RIIL (MODAL RIIL)</span>
                    <span className="text-xl font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                      Rp {calcResult.costBreakdown.cleanHppPerUnit.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 & 4. Titik Impas & Rekomendasi Harga Jual Aman */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-3">
                  3 & 4. Titik Impas (BEP) & Rekomendasi Harga Jual Aman
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Box Toko Offline */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-emerald-600" />
                        Penjualan Toko / Kasir Offline
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">
                        Fee: 0%
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 block">Titik Impas (BEP Offline):</span>
                      <span className="text-sm font-semibold text-slate-800">
                        Rp {calcResult.pricing.bepOfflinePrice.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-xs text-slate-500 block">Rekomendasi Harga Jual:</span>
                      <div className="text-xl font-bold text-emerald-700 mt-0.5">
                        Rp {calcResult.pricing.recommendedOfflinePrice.toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex justify-between">
                        <span>Laba Bersih:</span>
                        <span className="font-semibold text-emerald-700">
                          +Rp {calcResult.pricing.expectedOfflineProfitNominal.toLocaleString('id-ID')} ({calcResult.pricing.expectedOfflineProfitPct}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Box Marketplace Online */}
                  <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-indigo-600" />
                        Penjualan Marketplace Online
                      </span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium">
                        Fee: {marketplaceFeePct}% + Rp {marketplaceFixedFee}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-500 block">Titik Impas (BEP Online):</span>
                      <span className="text-sm font-semibold text-indigo-950">
                        Rp {calcResult.pricing.bepMarketplacePrice.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-indigo-200/60">
                      <span className="text-xs text-slate-600 block">Rekomendasi Harga Tayang:</span>
                      <div className="text-xl font-bold text-indigo-700 mt-0.5">
                        Rp {calcResult.pricing.recommendedMarketplacePrice.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Potongan Platform:</span>
                          <span className="text-rose-600 font-medium">
                            -Rp {calcResult.pricing.marketplaceDeductionNominal.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cair Bersih ke Rekening:</span>
                          <span className="font-semibold text-slate-800">
                            Rp {calcResult.pricing.netRevenueAfterPlatformFee.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-indigo-100">
                          <span className="font-medium text-slate-700">Laba Bersih Online:</span>
                          <span className="font-bold text-indigo-700">
                            +Rp {calcResult.pricing.expectedOnlineProfitNominal.toLocaleString('id-ID')} ({calcResult.pricing.expectedOnlineProfitPct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Catatan Pajak Penghasilan (PPh UMKM PP 55/2022) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  5. Proyeksi Pajak Penghasilan Toko (PP 55 Tahun 2022)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {calcResult.taxProjection.pphFinalNotes}
                </p>
                {!calcResult.taxProjection.isExemptFromPphFinal && (
                  <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center mt-2">
                    <span className="text-slate-600">Estimasi Beban PPh Final per Unit Penjualan:</span>
                    <span className="font-bold text-slate-900">
                      Rp {calcResult.taxProjection.pphFinalNominalPerUnit.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OCR & SCAN DOKUMEN FAKTUR (MULTI-ITEM) */}
      {activeTab === 'OCR_DOCUMENT' && (
        <div className="space-y-6">
          {/* Box Input Teks OCR & Sampel Dokumen */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ScanText className="w-5 h-5 text-indigo-600" />
                  Input Hasil Scan / Teks Faktur / XML e-Faktur
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paste teks hasil scan nota, foto invoice OCR, atau XML / URL QR Code e-Faktur resmi DJP.
                </p>
              </div>

              {/* Sampel Dokumen 1-Klik */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Muat Contoh:</span>
                <button
                  type="button"
                  onClick={() => loadSampleDoc(SAMPLE_DOCS.E_FAKTUR, 'e-Faktur DJP Resmi')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                >
                  e-Faktur DJP
                </button>
                <button
                  type="button"
                  onClick={() => loadSampleDoc(SAMPLE_DOCS.INVOICE_PABRIK, 'Invoice Komersial Pabrik')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                >
                  Invoice Pabrik
                </button>
                <button
                  type="button"
                  onClick={() => loadSampleDoc(SAMPLE_DOCS.NOTA_KONTAN, 'Nota Kontan Tunai')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                >
                  Nota Kontan
                </button>
              </div>
            </div>

            {/* Grid Input Pengaturan Pengadaan Multi-Item */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Status Usaha Toko Kita:
                </label>
                <select
                  value={buyerTaxStatus}
                  onChange={(e) => setBuyerTaxStatus(e.target.value as BuyerTaxStatus)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="NON_PKP">Non-PKP (PPN 11% Beban HPP)</option>
                  <option value="PKP">PKP (PPN 11% Dikreditkan di SPT)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Total Ongkir Se-Faktur (Landed Cost):
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-slate-400">Rp</span>
                  <input
                    type="number"
                    value={ocrLandedCostTotal}
                    onChange={(e) => setOcrLandedCostTotal(Number(e.target.value))}
                    className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg font-medium"
                    placeholder="Ongkir/Bongkar total"
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  *Akan dialokasikan pro-rata ke tiap item
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Target Margin Keuntungan (%):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetMarginPct}
                    onChange={(e) => setTargetMarginPct(Number(e.target.value))}
                    className="w-full p-1.5 pr-6 border border-slate-300 rounded-lg font-medium"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Biaya Marketplace (%):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={marketplaceFeePct}
                    onChange={(e) => setMarketplaceFeePct(Number(e.target.value))}
                    className="w-full p-1.5 pr-6 border border-slate-300 rounded-lg font-medium"
                  />
                  <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">%</span>
                </div>
              </div>
            </div>

            {/* Textarea Dokumen */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Teks Dokumen Scan / Faktur Masukan:
              </label>
              <textarea
                rows={7}
                value={ocrRawText}
                onChange={(e) => setOcrRawText(e.target.value)}
                placeholder="Paste hasil scan nota, foto teks OCR, atau data XML e-Faktur di sini..."
                className="w-full font-mono text-xs p-3.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleRunOcrParse}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Analisis Dokumen & Hitung HPP
              </button>
            </div>
          </div>

          {/* HASIL ANALISIS DOKUMEN FAKTUR */}
          {parsedDoc && (
            <div className="space-y-6">
              {/* Header Kartu Dokumen */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${parsedDoc.isOfficialTaxInvoice ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {parsedDoc.documentTypeLabel}
                        </h3>
                        {parsedDoc.isOfficialTaxInvoice ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Sah e-Faktur DJP
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Komersial
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Penjual: <span className="font-semibold text-slate-800">{parsedDoc.sellerName || 'Tidak tertera di dokumen'}</span> | No: <span className="font-semibold text-slate-800">{parsedDoc.invoiceNumber || 'Tidak tertera'}</span> | Tgl: {parsedDoc.invoiceDate || 'Hari ini'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Total Tagihan Faktur:</span>
                      <span className="text-lg font-black text-slate-900">
                        Rp {parsedDoc.grandTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit & Legalitas Notes */}
                {parsedDoc.auditNotes.length > 0 && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1">
                    <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      Catatan Audit Pajak & Legalitas Faktur:
                    </div>
                    <ul className="text-xs text-amber-950 space-y-0.5 list-disc pl-5">
                      {parsedDoc.auditNotes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Tabel Rincian Multi-Item & HPP Anti-Boncos */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Rincian Multi-Item & Rekomendasi Harga Anti-Boncos
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Landed cost dialokasikan otomatis secara proporsional sesuai nilai DPP masing-masing barang.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {parsedDoc.items.length} Barang Terdeteksi
                  </span>
                </div>

                {/* Tampilan Desktop: Tabel Data Lengkap */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Nama Barang</th>
                        <th className="py-3 px-3">Kategori</th>
                        <th className="py-3 px-3 text-right">Qty</th>
                        <th className="py-3 px-3 text-right">Harga Satuan</th>
                        <th className="py-3 px-3 text-right">Ongkir Teralokasi</th>
                        <th className="py-3 px-3 text-right bg-indigo-50/50 text-indigo-900">HPP Bersih (Unit)</th>
                        <th className="py-3 px-3 text-right text-emerald-800">Jual Offline (POS)</th>
                        <th className="py-3 px-4 text-right bg-indigo-50 text-indigo-900">Jual Marketplace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {parsedDoc.items.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {it.name}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {it.categoryType}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            Rp {it.unitPrice.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500">
                            Rp {it.allocatedLandedCost.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-indigo-700 bg-indigo-50/30">
                            Rp {it.cleanHppPerUnit.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700">
                            Rp {it.recommendedOfflinePrice.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-indigo-700 bg-indigo-50">
                            Rp {it.recommendedMarketplacePrice.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Tampilan Mobile: Kartu Responsif Nyaman Dibaca Tanpa Scroll Horizontal */}
                <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
                  {parsedDoc.items.map((it) => (
                    <div key={it.id} className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="font-bold text-xs text-slate-900 leading-snug">{it.name}</h5>
                          <span className="text-[10px] text-slate-500">
                            {it.quantity} {it.unit} @ Rp {it.unitPrice.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          {it.categoryType}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-slate-500 border-t border-slate-200/50 pt-1.5">
                        <span>Ongkir Teralokasi:</span>
                        <span className="font-medium text-slate-700">Rp {it.allocatedLandedCost.toLocaleString('id-ID')}</span>
                      </div>

                      <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 flex justify-between items-center">
                        <span className="text-[11px] font-bold text-indigo-900">HPP Bersih (Modal Riil):</span>
                        <span className="text-sm font-black text-indigo-700">
                          Rp {it.cleanHppPerUnit.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-800 block">Jual Offline (POS):</span>
                          <span className="text-xs font-bold text-emerald-700">
                            Rp {it.recommendedOfflinePrice.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <span className="text-[10px] font-bold text-blue-800 block">Jual Marketplace:</span>
                          <span className="text-xs font-bold text-blue-700">
                            Rp {it.recommendedMarketplacePrice.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
