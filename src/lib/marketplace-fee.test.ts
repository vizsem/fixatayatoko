import { describe, it, expect } from 'vitest';

import {
  TARIF_DEFAULT,
  hitungBiayaAdmin,
  keteranganMode,
  kunciChannel,
  tarifUntuk,
} from '@/lib/marketplace-fee';

/**
 * Biaya admin marketplace.
 *
 * Dua mode yang diminta pemilik:
 *   AUTO   - yang diisi HARGA JUAL, sistem memotong biaya admin.
 *   MANUAL - yang diisi HARGA BERSIH hasil potongan marketplace (jangan dipotong
 *            dua kali).
 */

describe('kunciChannel', () => {
  it('mengenali channel dari berbagai penulisan', () => {
    expect(kunciChannel('TIKTOK')).toBe('tiktok');
    expect(kunciChannel('tiktok')).toBe('tiktok');
    expect(kunciChannel('Tokopedia')).toBe('tokopedia');
    expect(kunciChannel('SHOPEE')).toBe('shopee');
    expect(kunciChannel('OFFLINE')).toBeNull();
    expect(kunciChannel(null)).toBeNull();
  });
});

describe('tarifUntuk', () => {
  it('memakai tarif dari Settings', () => {
    expect(tarifUntuk('TIKTOK', { tiktok: 4.5 })).toBe(4.5);
    expect(tarifUntuk('SHOPEE', TARIF_DEFAULT)).toBe(6.5);
  });

  it('channel tanpa tarif dianggap 0, bukan dipaksa pakai tarif lain', () => {
    expect(tarifUntuk('OFFLINE')).toBe(0);
    expect(tarifUntuk(undefined)).toBe(0);
  });

  it('tarif lebih dari 100% dipangkas supaya pendapatan tidak jadi negatif', () => {
    expect(tarifUntuk('TIKTOK', { tiktok: 150 })).toBe(100);
    expect(tarifUntuk('TIKTOK', { tiktok: -5 })).toBe(0);
  });
});

describe('hitungBiayaAdmin — mode OTOMATIS (harga jual)', () => {
  it('memotong biaya admin dari harga jual', () => {
    // Order TikTok Rp3.750.000 pada tarif 4,5%.
    const hasil = hitungBiayaAdmin({
      mode: 'AUTO',
      jumlahDiisi: 3750000,
      channel: 'TIKTOK',
      tarif: { tiktok: 4.5 },
    });

    expect(hasil.biaya).toBe(168750);
    expect(hasil.bersih).toBe(3581250);
    expect(hasil.tarif).toBe(4.5);
    expect(hasil.mode).toBe('AUTO');
  });

  it('channel tanpa tarif tidak dipotong', () => {
    const hasil = hitungBiayaAdmin({ mode: 'AUTO', jumlahDiisi: 100000, channel: 'OFFLINE' });
    expect(hasil.biaya).toBe(0);
    expect(hasil.bersih).toBe(100000);
  });

  it('mode default adalah AUTO', () => {
    expect(hitungBiayaAdmin({ jumlahDiisi: 100000, channel: 'SHOPEE', tarif: { shopee: 10 } }).biaya).toBe(10000);
  });
});

describe('hitungBiayaAdmin — mode MANUAL (harga bersih)', () => {
  it('TIDAK memotong lagi karena angka yang diisi sudah bersih', () => {
    const hasil = hitungBiayaAdmin({
      mode: 'MANUAL',
      jumlahDiisi: 3581250,
      channel: 'TIKTOK',
      tarif: { tiktok: 4.5 },
    });

    expect(hasil.biaya).toBe(0);
    expect(hasil.bersih).toBe(3581250);
    expect(hasil.tarif).toBe(0);
    expect(hasil.mode).toBe('MANUAL');
  });

  it('menulis mode dengan huruf kecil tetap terbaca sebagai MANUAL', () => {
    expect(hitungBiayaAdmin({ mode: 'manual', jumlahDiisi: 1000, channel: 'TIKTOK' }).biaya).toBe(0);
  });
});

describe('keteranganMode', () => {
  it('menjelaskan arti angka yang diisi untuk masing-masing mode', () => {
    expect(keteranganMode('AUTO', 4.5)).toContain('biaya admin 4.5%');
    expect(keteranganMode('MANUAL', 0)).toContain('uang bersih diterima');
  });
});
