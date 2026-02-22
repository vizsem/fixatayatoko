import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('Format Utility', () => {
  it('should format currency correctly for IDR', () => {
    // Intl.NumberFormat might output non-breaking space
    const formatted = formatCurrency(1000);
    expect(formatted.replace(/\s/g, ' ')).toMatch(/Rp\s1\.000/);
    
    expect(formatCurrency(0).replace(/\s/g, ' ')).toMatch(/Rp\s0/);
  });

  it('should format date correctly for Indonesian locale', () => {
    const date = new Date('2023-01-01');
    expect(formatDate(date)).toBe('1 Januari 2023');
  });
});
