import { describe, it, expect } from 'vitest';
import {
  MAX_ADJUSTMENT,
  MAX_REASON_LENGTH,
  UNKNOWN_LEDGER_TYPE,
  formatNumber,
  formatRupiah,
  formatSigned,
  formatSignedRupiah,
  isEarningPointType,
  ledgerTypeLabel,
  normalizePointLog,
  normalizeWalletLog,
  pointDelta,
  summarizePointLogs,
  summarizeWalletLogs,
  validatePointAdjustment,
  validateWalletAdjustment,
  walletDelta,
} from './loyalty';

const USER = '999a2a0d-a717-4bcc-9f23-c56f039c41ac';

describe('validatePointAdjustment', () => {
  it('menerima masukan yang benar', () => {
    const result = validatePointAdjustment({
      userId: USER,
      kind: 'BONUS',
      amount: 50,
      reason: 'Pelanggan setia',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      userId: USER,
      kind: 'BONUS',
      amount: 50,
      reason: 'Pelanggan setia',
    });
  });

  it('memakai alasan bawaan saat alasan kosong', () => {
    const result = validatePointAdjustment({
      userId: USER,
      kind: 'PENALTY',
      amount: 10,
      reason: '   ',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reason).toBe('Penalti Kecurangan');
  });

  it('menolak UID yang bukan UUID', () => {
    // UID gaya Firebase dari data lama — tidak boleh dipakai sebagai uuid.
    const result = validatePointAdjustment({
      userId: 'a1BAutHIUigczzWns0Ra5T3sL8D3',
      kind: 'BONUS',
      amount: 1,
      reason: '',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/tidak valid/i);
  });

  it('menormalkan UID menjadi huruf kecil', () => {
    const result = validatePointAdjustment({
      userId: USER.toUpperCase(),
      kind: 'BONUS',
      amount: 1,
      reason: '',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.userId).toBe(USER);
  });

  it('menolak jumlah nol, negatif, pecahan, dan bukan angka', () => {
    for (const amount of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validatePointAdjustment({ userId: USER, kind: 'BONUS', amount });
      expect(result.ok, `amount=${amount} seharusnya ditolak`).toBe(false);
    }
  });

  it('menolak jumlah di atas batas wajar', () => {
    const result = validatePointAdjustment({
      userId: USER,
      kind: 'BONUS',
      amount: MAX_ADJUSTMENT + 1,
    });
    expect(result.ok).toBe(false);
  });

  it('menolak alasan yang terlalu panjang', () => {
    const result = validatePointAdjustment({
      userId: USER,
      kind: 'BONUS',
      amount: 1,
      reason: 'x'.repeat(MAX_REASON_LENGTH + 1),
    });
    expect(result.ok).toBe(false);
  });

  it('menolak jenis penyesuaian yang tidak dikenal', () => {
    const result = validatePointAdjustment({
      userId: USER,
      kind: 'HADIAH' as never,
      amount: 1,
    });
    expect(result.ok).toBe(false);
  });
});

describe('validateWalletAdjustment', () => {
  it('menerima nominal desimal dua angka di belakang koma', () => {
    const result = validateWalletAdjustment({
      userId: USER,
      kind: 'TOPUP_ADMIN',
      amount: 1500.25,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amount).toBe(1500.25);
  });

  it('membersihkan derau floating point', () => {
    const result = validateWalletAdjustment({
      userId: USER,
      kind: 'TOPUP_ADMIN',
      amount: 0.30000000000000004,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amount).toBe(0.3);
  });

  it('menerima alasan kosong dan memakai bawaan', () => {
    const result = validateWalletAdjustment({
      userId: USER,
      kind: 'WITHDRAW_ADMIN',
      amount: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reason).toBe('Penarikan oleh Admin');
  });

  it('menolak nominal nol atau negatif', () => {
    expect(validateWalletAdjustment({ userId: USER, kind: 'TOPUP_ADMIN', amount: 0 }).ok).toBe(false);
    expect(validateWalletAdjustment({ userId: USER, kind: 'TOPUP_ADMIN', amount: -1 }).ok).toBe(false);
  });

  it('menolak jenis penyesuaian yang tidak dikenal', () => {
    const result = validateWalletAdjustment({
      userId: USER,
      kind: 'TRANSFER' as never,
      amount: 10,
    });
    expect(result.ok).toBe(false);
  });
});

describe('delta', () => {
  it('menentukan tanda delta poin dari jenisnya', () => {
    expect(pointDelta('BONUS', 25)).toBe(25);
    expect(pointDelta('PENALTY', 25)).toBe(-25);
    // Nilai negatif yang tidak sengaja dikirim tidak boleh membalik tanda.
    expect(pointDelta('BONUS', -25)).toBe(25);
    expect(pointDelta('PENALTY', -25)).toBe(-25);
  });

  it('menentukan tanda delta saldo dari jenisnya', () => {
    expect(walletDelta('TOPUP_ADMIN', 1000)).toBe(1000);
    expect(walletDelta('WITHDRAW_ADMIN', 1000)).toBe(-1000);
  });
});

describe('normalizePointLog', () => {
  it('membaca baris sesudah migrasi (kolom asli terisi)', () => {
    const log = normalizePointLog({
      id: 'pt1',
      user_id: USER,
      points: 5,
      type: 'BONUS',
      description: 'Bonus Admin',
      created_at: '2026-03-15T10:00:00.000Z',
    });
    expect(log).toEqual({
      id: 'pt1',
      userId: USER,
      pointsChanged: 5,
      type: 'BONUS',
      description: 'Bonus Admin',
      createdAt: '2026-03-15T10:00:00.000Z',
    });
  });

  it('membaca baris sebelum migrasi (hanya raw_data) dengan hasil yang sama', () => {
    const log = normalizePointLog({
      id: 'DQG7jFOtoOjLnNbMKhgw',
      user_id: null,
      points: null,
      description: null,
      created_at: '2026-09-12T23:36:11.776Z',
      raw_data: {
        type: 'BONUS',
        userId: 'a1BAutHIUigczzWns0Ra5T3sL8D3',
        description: 'Bonus Admin',
        pointsChanged: 5,
      },
    });
    expect(log.userId).toBe('a1BAutHIUigczzWns0Ra5T3sL8D3');
    expect(log.pointsChanged).toBe(5);
    expect(log.type).toBe('BONUS');
    expect(log.description).toBe('Bonus Admin');
  });

  it('memakai kolom asli bila raw_data saling bertentangan', () => {
    const log = normalizePointLog({
      id: 'pt2',
      user_id: USER,
      points: -5,
      type: 'REDEEM',
      description: 'Tukar voucher',
      raw_data: { pointsChanged: 999, type: 'BONUS', userId: 'uid-lama' },
    });
    expect(log.pointsChanged).toBe(-5);
    expect(log.type).toBe('REDEEM');
    expect(log.userId).toBe(USER);
  });

  it('memberi nilai aman untuk baris rusak', () => {
    const log = normalizePointLog({
      id: 'rusak',
      points: 'abc',
      type: null,
      description: null,
      created_at: 'bukan-tanggal',
    });
    expect(log.pointsChanged).toBe(0);
    expect(log.type).toBe(UNKNOWN_LEDGER_TYPE);
    expect(log.description).toBe('');
    expect(log.createdAt).toBeNull();
  });

  it('tidak melempar untuk masukan null/undefined', () => {
    expect(() => normalizePointLog(null)).not.toThrow();
    expect(normalizePointLog(undefined).pointsChanged).toBe(0);
  });
});

describe('normalizeWalletLog', () => {
  it('membaca order_id dan amount dari kolom asli', () => {
    const log = normalizeWalletLog({
      id: 'wl1',
      user_id: USER,
      amount: -165000,
      type: 'WITHDRAW_ADMIN',
      description: 'kesalahan sistem',
      order_id: 'ATY-123',
      created_at: '2026-03-15T10:00:00.000Z',
    });
    expect(log.amountChanged).toBe(-165000);
    expect(log.orderId).toBe('ATY-123');
    expect(log.type).toBe('WITHDRAW_ADMIN');
  });

  it('jatuh ke raw_data sebelum migrasi', () => {
    const log = normalizeWalletLog({
      id: '0X9R9s2rT2yaCBN7IXXa',
      amount: null,
      raw_data: { amountChanged: 208900, type: 'REFUND_STOCK', orderId: 'OOB0xxuX' },
    });
    expect(log.amountChanged).toBe(208900);
    expect(log.orderId).toBe('OOB0xxuX');
  });

  it('orderId kosong menjadi null, bukan string kosong', () => {
    const log = normalizeWalletLog({ id: 'wl2', amount: 100, type: 'TOPUP_ADMIN' });
    expect(log.orderId).toBeNull();
  });
});

describe('summarizePointLogs / summarizeWalletLogs', () => {
  it('memisahkan dana masuk dan keluar', () => {
    const logs = [
      normalizePointLog({ points: 100, raw_data: {} }),
      normalizePointLog({ points: -30, raw_data: {} }),
      normalizePointLog({ points: 5, raw_data: {} }),
    ];
    expect(summarizePointLogs(logs)).toEqual({
      totalIn: 105,
      totalOut: 30,
      circulating: 75,
    });
  });

  it('mengabaikan nilai nol', () => {
    const logs = [normalizePointLog({ points: 0 }), normalizePointLog({ points: 10 })];
    expect(summarizePointLogs(logs)).toEqual({ totalIn: 10, totalOut: 0, circulating: 10 });
  });

  it('tidak teracuni NaN (satu baris rusak tidak merusak total)', () => {
    const logs = [
      normalizeWalletLog({ amount: Number.NaN, raw_data: {} }),
      normalizeWalletLog({ amount: 5000, raw_data: {} }),
      normalizeWalletLog({ amount: -2000, raw_data: {} }),
    ];
    const summary = summarizeWalletLogs(logs);
    expect(Number.isNaN(summary.totalIn)).toBe(false);
    expect(summary).toEqual({ totalIn: 5000, totalOut: 2000, circulating: 3000 });
  });

  it('mengembalikan nol untuk daftar kosong', () => {
    expect(summarizePointLogs([])).toEqual({ totalIn: 0, totalOut: 0, circulating: 0 });
    expect(summarizeWalletLogs([])).toEqual({ totalIn: 0, totalOut: 0, circulating: 0 });
  });
});

describe('tampilan', () => {
  it('mengenali tipe ledger yang menambah saldo', () => {
    expect(isEarningPointType('EARN')).toBe(true);
    expect(isEarningPointType('bonus')).toBe(true);
    expect(isEarningPointType('REDEEM')).toBe(false);
    expect(isEarningPointType('PENALTY')).toBe(false);
  });

  it('mengganti SEMUA garis bawah pada label tipe', () => {
    // Regresi: versi lama memakai replace('_', ' ') yang hanya mengganti
    // pemisah pertama sehingga "A_B_C" tampil sebagai "A B_C".
    expect(ledgerTypeLabel('TOPUP_ADMIN')).toBe('TOPUP ADMIN');
    expect(ledgerTypeLabel('A_B_C')).toBe('A B C');
  });

  it('memformat angka gaya Indonesia', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
    expect(formatNumber(0)).toBe('0');
  });

  it('memformat rupiah, termasuk nilai negatif', () => {
    expect(formatRupiah(1234567)).toBe('Rp1.234.567');
    expect(formatRupiah(-165000)).toBe('-Rp165.000');
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('memformat nilai bertanda', () => {
    expect(formatSigned(5)).toBe('+5');
    expect(formatSigned(-5)).toBe('-5');
    expect(formatSigned(0)).toBe('0');
    expect(formatSignedRupiah(208900)).toBe('+Rp208.900');
    expect(formatSignedRupiah(-165000)).toBe('-Rp165.000');
    expect(formatSignedRupiah(0)).toBe('Rp0');
  });

  it('tidak menghasilkan "NaN" untuk masukan rusak', () => {
    expect(formatNumber(Number.NaN)).toBe('0');
    expect(formatRupiah(Number.NaN)).toBe('Rp0');
    expect(formatSigned(Number.NaN)).toBe('0');
  });
});
