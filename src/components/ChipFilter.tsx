'use client';

import React from 'react';

export type ChipKey = 'SEMUA' | 'AKUN' | 'INFO' | 'PROMO' | 'KUPON' | 'POIN' | 'BANTUAN' | 'MAKANAN' | 'MINUMAN' | 'SEMBAKO' | 'DISKON' | 'ONGKIR' | 'KONTAK' | 'CASHBACK' | 'TOKO';

export interface ChipItem {
  key: ChipKey;
  label: string;
}

export interface ChipFilterProps {
  items: ChipItem[];
  value: ChipKey;
  onChange: (key: ChipKey) => void;
  className?: string;
}

export const DEFAULT_CHIPS: ChipItem[] = [
  { key: 'SEMUA', label: 'Semua' },
  { key: 'AKUN', label: 'Akun' },
  { key: 'INFO', label: 'Info' },
  { key: 'PROMO', label: 'Promo' },
  { key: 'KUPON', label: 'Kupon' },
  { key: 'POIN', label: 'Poin' },
  { key: 'BANTUAN', label: 'Bantuan' },
];

export function ChipFilter({ items, value, onChange, className }: ChipFilterProps) {
  const containerCls = `px-4 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide ${className || ''}`;
  const baseBtn =
    'inline-flex items-center rounded-full border border-neutral-200 px-3 py-1.5 text-[10px] font-medium mr-2';
  const inactive =
    'bg-[#EFF3F6] text-gray-700';
  const active =
    'bg-green-600 text-white';

  return (
    <div className={containerCls}>
      {items.map((it) => {
        const isActive = it.key === value;
        const cls = `${baseBtn} ${isActive ? active : inactive}`;
        return (
          <button
            key={it.key}
            type="button"
            className={cls}
            onClick={() => onChange(it.key)}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
