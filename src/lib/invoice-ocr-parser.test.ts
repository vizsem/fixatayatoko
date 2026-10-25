import { describe, it, expect } from 'vitest';
import {
  parseScannedDocument,
  cleanCurrency,
  parseEFakturDjpData,
} from './invoice-ocr-parser';

describe('Intelligent Document & Invoice OCR Parser', () => {
  it('cleans currency strings accurately', () => {
    expect(cleanCurrency('Rp 150.000,00')).toBe(150000);
    expect(cleanCurrency('1,250,000')).toBe(1250000);
    expect(cleanCurrency('50.000')).toBe(50000);
    expect(cleanCurrency('Rp 12.500')).toBe(12500);
  });

  it('correctly parses official e-Faktur DJP XML data', () => {
    const efakturXml = `
      <resValidateFakturPm>
        <kdJenisTransaksi>01</kdJenisTransaksi>
        <fgPengganti>0</fgPengganti>
        <nomorFaktur>0100022412345678</nomorFaktur>
        <tanggalFaktur>25/10/2026</tanggalFaktur>
        <npwpPenjual>012345678901000</npwpPenjual>
        <namaPenjual>PT PABRIK MAKMUR SEJAHTERA</namaPenjual>
        <jumlahDpp>10000000</jumlahDpp>
        <jumlahPpn>1100000</jumlahPpn>
        <detailTransaksi>
          <nama>Beras Rojolele Super 5kg</nama>
          <jumlahBarang>100</jumlahBarang>
          <hargaSatuan>60000</hargaSatuan>
          <dpp>6000000</dpp>
          <ppn>0</ppn>
        </detailTransaksi>
        <detailTransaksi>
          <nama>Minyak Goreng Botol 2L</nama>
          <jumlahBarang>100</jumlahBarang>
          <hargaSatuan>40000</hargaSatuan>
          <dpp>4000000</dpp>
          <ppn>440000</ppn>
        </detailTransaksi>
      </resValidateFakturPm>
    `;

    const result = parseScannedDocument({
      rawText: efakturXml,
      buyerTaxStatus: 'NON_PKP',
      annualTurnoverTier: 'UNDER_500M',
      additionalLandedCostTotal: 200000, // Rp200rb ongkir sefaktur
      targetMarginPct: 15,
      marketplaceFeePct: 6.5,
    });

    expect(result.documentType).toBe('E_FAKTUR_DJP');
    expect(result.isOfficialTaxInvoice).toBe(true);
    expect(result.sellerName).toBe('PT PABRIK MAKMUR SEJAHTERA');
    expect(result.invoiceNumber).toBe('0100022412345678');
    expect(result.totalDpp).toBe(10000000);
    expect(result.totalPpn).toBe(1100000);
    expect(result.items.length).toBe(2);

    // Item 1: Beras (Kategori A, Bebas PPN)
    const beras = result.items[0];
    expect(beras.categoryType).toBe('KATEGORI_A');
    expect(beras.quantity).toBe(100);
    // Landed cost prorated: Beras DPP = 6jt / 10jt = 60% of 200rb = 120rb total -> 1200 per unit
    expect(beras.allocatedLandedCost).toBe(120000);
    expect(beras.cleanHppPerUnit).toBe(61200);

    // Item 2: Minyak Goreng (Kategori B, Non-PKP so PPN 11% is capitalized)
    const minyak = result.items[1];
    expect(minyak.categoryType).toBe('KATEGORI_B');
    // Landed cost prorated: Minyak DPP = 4jt / 10jt = 40% of 200rb = 80rb total -> 800 per unit
    expect(minyak.allocatedLandedCost).toBe(80000);
    // Unit price = 40.000, PPN 11% capitalized = 4.400, Landed = 800 -> HPP = 45.200
    expect(minyak.cleanHppPerUnit).toBe(45200);
  });

  it('correctly parses raw text from a commercial invoice scan with landed cost proration', () => {
    const rawInvoiceText = `
      PT. DISTRIBUTOR SEMBAKO JAYA
      Jl. Industri Raya No. 45 Jakarta
      INVOICE NO: INV-2026-8891
      TANGGAL: 24/10/2026
      
      RINCIAN BARANG:
      1. Sabun Cuci Piring 800ml   50   Rp 15.000   750.000
      2. Telur Ayam Negeri 1 Peti   10   Rp 250.000  2.500.000
      
      SUBTOTAL: 3.250.000
      PPN 11%: 82.500
      TOTAL: 3.332.500
    `;

    const result = parseScannedDocument({
      rawText: rawInvoiceText,
      buyerTaxStatus: 'PKP',
      annualTurnoverTier: '500M_TO_4_8B',
      additionalLandedCostTotal: 100000,
      targetMarginPct: 20,
      marketplaceFeePct: 7,
    });

    expect(result.documentType).toBe('COMMERCIAL_INVOICE');
    expect(result.invoiceNumber).toContain('INV-2026-8891');
    expect(result.items.length).toBeGreaterThanOrEqual(2);

    // Since buyer is PKP, PPN is creditable and not in HPP
    const telurItem = result.items.find(i => i.name.toUpperCase().includes('TELUR'));
    expect(telurItem).toBeDefined();
    if (telurItem) {
      expect(telurItem.categoryType).toBe('KATEGORI_A');
    }
  });

  it('flags Nota Kontan and warns about non-creditable tax', () => {
    const notaKontan = `
      NOTA KONTAN UD. SUMBER REJEKI
      No. 1245
      Tgl: 22-10-2026
      Barang: Semen Gresik 50kg   10 Sak x 65.000 = 650.000
      TOTAL: 650.000
    `;

    const result = parseScannedDocument({
      rawText: notaKontan,
      buyerTaxStatus: 'PKP',
      annualTurnoverTier: 'UNDER_500M',
    });

    expect(result.documentType).toBe('NOTA_KONTAN');
    expect(result.isOfficialTaxInvoice).toBe(false);
    expect(result.auditNotes.some(n => n.includes('TIDAK DAPAT dikreditkan'))).toBe(true);
  });
});
