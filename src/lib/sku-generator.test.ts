import { describe, it, expect } from 'vitest';
import {
  getCategoryPrefix,
  generateVariantSuffix,
  generateVariantSku,
  formatDisplaySku,
} from './sku-generator';

describe('sku-generator (Skema 1 Kategori)', () => {
  it('menentukan prefiks kategori 3 huruf dengan tepat', () => {
    expect(getCategoryPrefix('Sembako')).toBe('SBK');
    expect(getCategoryPrefix('Beras & Biji-bijian')).toBe('SBK');
    expect(getCategoryPrefix('Minyak Goreng')).toBe('SBK');
    expect(getCategoryPrefix('Snack & Biskuit')).toBe('SNK');
    expect(getCategoryPrefix('Minuman')).toBe('MNM');
    expect(getCategoryPrefix('Kopi & Teh')).toBe('MNM');
    expect(getCategoryPrefix('Bumbu Dapur')).toBe('BMB');
    expect(getCategoryPrefix('Kebersihan')).toBe('KBR');
    expect(getCategoryPrefix('Rokok')).toBe('ROK');
    expect(getCategoryPrefix('Umum')).toBe('PRD');
  });

  it('menebak prefiks dari nama produk jika kategori kosong/umum', () => {
    expect(getCategoryPrefix('', 'Indomie Goreng')).toBe('MIE');
    expect(getCategoryPrefix('', 'Minyak Goreng Sania 2L')).toBe('SBK');
    expect(getCategoryPrefix('', 'Kopi Kapal Api')).toBe('MNM');
  });

  it('menghasilkan suffix varian yang ringkas dan bermakna', () => {
    expect(generateVariantSuffix('Cokelat')).toBe('CKT');
    expect(generateVariantSuffix('Rasa Keju')).toBe('KJU');
    expect(generateVariantSuffix('Strawberry')).toBe('STR');
    expect(generateVariantSuffix('Original')).toBe('ORI');
    expect(generateVariantSuffix('Pedas')).toBe('PDS');
    expect(generateVariantSuffix('1KG')).toBe('1KG');
    expect(generateVariantSuffix('250ML')).toBe('250ML');
    expect(generateVariantSuffix('XL')).toBe('XL');
  });

  it('membuat SKU varian lengkap yang rapi', () => {
    expect(generateVariantSku('SBK-0001', 'Coklat')).toBe('SBK-0001-CKT');
    expect(generateVariantSku('SNK-0012', 'Keju')).toBe('SNK-0012-KJU');
    expect(generateVariantSku('MNM-0005', '1kg')).toBe('MNM-0005-1KG');
  });

  it('merapikan tampilan SKU legacy / UUID panjang di UI', () => {
    expect(formatDisplaySku('SBK-0001')).toBe('SBK-0001');
    expect(formatDisplaySku('SNK-0012-CKT')).toBe('SNK-0012-CKT');
    expect(formatDisplaySku('prod_1740578942189_a3f9k')).toBe('PRD-A3F9K');
    expect(formatDisplaySku('d290f1ee-6c54-4b01-90e6-d701748f0851')).toBe('ID-D290F1');
    expect(formatDisplaySku('')).toBe('PRD-N/A');
  });
});
