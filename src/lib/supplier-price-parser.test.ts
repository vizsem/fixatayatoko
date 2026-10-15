import { describe, it, expect } from 'vitest';
import { parseSupplierPriceBroadcast, sanitizePriceString, normalizeSupplierUnit } from './supplier-price-parser';

describe('supplier-price-parser', () => {
  it('correctly cleans up typo prices with letters O and extra zeroes', () => {
    expect(sanitizePriceString('252.OOO')).toBe(252000);
    expect(sanitizePriceString('207.500')).toBe(207500);
    expect(sanitizePriceString('111.000')).toBe(111000);
    expect(sanitizePriceString('238.5000')).toBe(2385000);
  });

  it('normalizes multi-units', () => {
    expect(normalizeSupplierUnit('ctn')).toEqual({ unit: 'CTN', count: 1 });
    expect(normalizeSupplierUnit('3 pcs')).toEqual({ unit: 'PCS', count: 3 });
    expect(normalizeSupplierUnit('2ctn')).toEqual({ unit: 'CTN', count: 2 });
    expect(normalizeSupplierUnit('slop')).toEqual({ unit: 'SLOP', count: 1 });
    expect(normalizeSupplierUnit('bal')).toEqual({ unit: 'BAL', count: 1 });
    expect(normalizeSupplierUnit('sak')).toEqual({ unit: 'SAK', count: 1 });
  });

  it('parses real broadcast sample accurately', () => {
    const sample = `HARGA HEBOH STOCK POINT INDOGROSIR
KEDIRI
PERIODE 12 SEPTEMBER 2026

🥨SEMBAKO & BUMBU DAPUR

Lahap Lele 5kg : KOSONG/pcs
Sedap Wangi 5kg : kosong /pcs
Rizky 800ml BTL : 207.500/ctn
Ajinomoto micin 250g : 37.500/3 pcs
Sasa tepung serba guna : 252.OOO/ctn 
Indomie soto mie : 107.000/ctn (max 10 ctn)
wismilak diplomat 12 ;252.000
Downy 10/8ml : kosongctn
sprite 390ML 40.700
`;

    const res = parseSupplierPriceBroadcast(sample);
    expect(res.supplierName).toContain('Indogrosir Kediri');
    expect(res.periodDate).toBe('12 SEPTEMBER 2026');
    expect(res.totalParsed).toBe(9);

    const lahap = res.items.find(i => i.name.includes('Lahap Lele'));
    expect(lahap?.isKosong).toBe(true);
    expect(lahap?.unit).toBe('PCS');

    const rizky = res.items.find(i => i.name.includes('Rizky'));
    expect(rizky?.price).toBe(207500);
    expect(rizky?.unit).toBe('CTN');

    const ajinomoto = res.items.find(i => i.name.includes('Ajinomoto'));
    expect(ajinomoto?.price).toBe(37500);
    expect(ajinomoto?.unit).toBe('PCS');
    expect(ajinomoto?.unitCount).toBe(3);

    const sasa = res.items.find(i => i.name.includes('Sasa tepung'));
    expect(sasa?.price).toBe(252000);

    const indomie = res.items.find(i => i.name.includes('Indomie soto'));
    expect(indomie?.notes).toBe('max 10 ctn');

    const wismilak = res.items.find(i => i.name.includes('wismilak'));
    expect(wismilak?.price).toBe(252000);

    const sprite = res.items.find(i => i.name.includes('sprite'));
    expect(sprite?.price).toBe(40700);
  });
});
