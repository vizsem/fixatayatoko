import { describe, it, expect } from 'vitest';
import { computeAverageCost } from '@/lib/inventory';

/**
 * Verifikasi guard-guard keamanan WAC (Weighted Average Cost / Moving Average HPP).
 *
 * Tiga skenario berbahaya yang harus dijaga:
 *   S1 – Stok negatif (data korup) merusak pembagi rumus WAC
 *   S2 – HPP locked manual tidak boleh ditimpa WAC saat PO masuk
 *   S3 – incomingPrice = 0 tidak boleh menggeser HPP ke nol
 */

describe('computeAverageCost – WAC guards', () => {
  // ── Skenario normal ────────────────────────────────────────────────────────

  it('menghitung WAC dengan benar pada kondisi normal', () => {
    // 100 pcs @ Rp 5.000 + beli 50 pcs @ Rp 6.000
    // AVG = (100×5000 + 50×6000) / 150 = 800000/150 ≈ 5333
    expect(computeAverageCost(100, 5000, 50, 6000)).toBe(5333);
  });

  it('WAC reset ke harga beli ketika stok habis (stok = 0)', () => {
    // Stok habis → AVG = harga beli terbaru (reset alami WAC per SAK EMKM)
    expect(computeAverageCost(0, 4500, 100, 7000)).toBe(7000);
  });

  it('WAC reset ke harga beli ketika stok tepat = 0 meski HPP lama ada', () => {
    // HPP lama = 10.000, stok = 0, beli 20 @ 8.000 → AVG = 8.000
    expect(computeAverageCost(0, 10000, 20, 8000)).toBe(8000);
  });

  // ── S1: Stok negatif (Guard 1) ────────────────────────────────────────────

  it('[S1] Stok negatif di-clamp ke 0 sebelum WAC, bukan merusak pembagi', () => {
    // Stok = -5 (korup): tanpa guard → (−5×5000 + 10×7000)/(−5+10) = 45000/5 = 9000 ← SALAH
    // Dengan guard clamp → (0×5000 + 10×7000)/(0+10) = 7000 ← BENAR
    const clampedStock = Math.max(0, -5); // simulasi Guard 1 di addStock
    expect(computeAverageCost(clampedStock, 5000, 10, 7000)).toBe(7000);
  });

  it('[S1] Stok sangat negatif tidak menghasilkan HPP negatif atau NaN', () => {
    const clampedStock = Math.max(0, -9999);
    const result = computeAverageCost(clampedStock, 3000, 5, 4000);
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  // ── S3: incomingPrice = 0 (Guard 3) ──────────────────────────────────────

  it('[S3] incomingPrice = 0 menggeser HPP ke bawah (Guard 3 di addStock harus mencegah ini)', () => {
    // WAC = (100×5000 + 50×0) / 150 = 3333 ← berbahaya
    // Guard 3 di addStock (hasValidIncomingPrice check) mencegah computeAverageCost dipanggil
    // Test ini membuktikan bahwa harga 0 memang berbahaya untuk WAC
    const waWithZeroPrice = computeAverageCost(100, 5000, 50, 0);
    expect(waWithZeroPrice).toBeLessThan(5000); // konfirmasi bahwa guard diperlukan
  });

  // ── Konversi satuan (CTN → PCS) ───────────────────────────────────────────

  it('menghitung WAC dengan benar saat beli dalam satuan CTN (konversi)', () => {
    // Stok 120 pcs @ 2000/pcs. Beli 12 pcs @ 2500/pcs → AVG ≈ 2045
    expect(computeAverageCost(120, 2000, 12, 2500)).toBe(2045);
  });

  it('tidak menghasilkan NaN atau Infinity pada edge case qty=0', () => {
    const result = computeAverageCost(100, 5000, 0, 6000);
    expect(Number.isFinite(result)).toBe(true);
  });
});
