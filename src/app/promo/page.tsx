// src/app/promo/page.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChipFilter, DEFAULT_CHIPS, ChipKey } from '@/components/ChipFilter';

type Card = {
  id: string;
  category: ChipKey;
  title: string;
  desc: string;
  href: string;
  cta: string;
  emoji: string;
  colorCls: string;
};

const ALL_CARDS: Card[] = [
  {
    id: 'promo-beras',
    category: 'PROMO',
    title: 'Diskon 50% Beras Premium',
    desc: 'Beli 5kg, dapat 10kg! Hanya minggu ini.',
    href: '/semua-kategori',
    cta: 'Beli Sekarang',
    emoji: '🔥',
    colorCls: 'bg-red-100 text-red-600',
  },
  {
    id: 'kupon-ongkir',
    category: 'KUPON',
    title: 'Kupon Gratis Ongkir',
    desc: 'Untuk pembelian minimal Rp100.000.',
    href: '/cart',
    cta: 'Klaim Kupon',
    emoji: '🎁',
    colorCls: 'bg-green-100 text-green-600',
  },
  {
    id: 'promo-b2g1',
    category: 'PROMO',
    title: 'Buy 2 Get 1 Free',
    desc: 'Untuk semua produk snack & kue.',
    href: '/semua-kategori',
    cta: 'Lihat Produk',
    emoji: '🎉',
    colorCls: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'info-jam-layanan',
    category: 'INFO',
    title: 'Jam Layanan Diperbarui',
    desc: 'Operasional: 08.00–21.00 WIB setiap hari.',
    href: '/tentang',
    cta: 'Pelajari',
    emoji: '🕒',
    colorCls: 'bg-sky-100 text-sky-600',
  },
  {
    id: 'akun-verifikasi',
    category: 'AKUN',
    title: 'Verifikasi Akun',
    desc: 'Lengkapi data untuk keamanan dan kemudahan checkout.',
    href: '/profil',
    cta: 'Lengkapi Profil',
    emoji: '✅',
    colorCls: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: 'poin-reward',
    category: 'POIN',
    title: 'Program Poin',
    desc: 'Kumpulkan poin dan tukar dengan voucher menarik.',
    href: '/vouchers',
    cta: 'Cek Poin',
    emoji: '🏅',
    colorCls: 'bg-yellow-100 text-yellow-700',
  },
  {
    id: 'bantuan-pusat',
    category: 'BANTUAN',
    title: 'Pusat Bantuan',
    desc: 'Butuh bantuan? Lihat panduan dan FAQ lengkap.',
    href: '/kontak',
    cta: 'Hubungi Kami',
    emoji: '❓',
    colorCls: 'bg-purple-100 text-purple-600',
  },
];

export default function PromoPage() {
  const [active, setActive] = useState<ChipKey>('INFO');

  const cards = useMemo(() => {
    if (active === 'SEMUA') return ALL_CARDS;
    return ALL_CARDS.filter(c => c.category === active);
  }, [active]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Promo & Info</h1>
          <p className="text-sm md:text-base text-gray-600">Filter berdasarkan kategori yang kamu inginkan</p>
        </div>

        <ChipFilter items={DEFAULT_CHIPS} value={active} onChange={setActive} />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
          {cards.map(card => (
            <div key={card.id} className="bg-white rounded-lg shadow-md p-6">
              <div className={`${card.colorCls} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <span className="text-2xl">{card.emoji}</span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 text-center">{card.title}</h3>
              <p className="text-gray-600 mb-4 text-center">{card.desc}</p>
              <div className="text-center">
                <Link href={card.href} className="inline-block bg-black text-white px-4 py-2 rounded">
                  {card.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 bg-yellow-50 rounded-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Syarat & Ketentuan</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Promo berlaku selama stok masih tersedia</li>
            <li>Tidak bisa digabungkan dengan promo lain</li>
            <li>Gratis ongkir hanya berlaku di wilayah Kediri</li>
            <li>Kupon tidak bisa ditukarkan dengan uang tunai</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
