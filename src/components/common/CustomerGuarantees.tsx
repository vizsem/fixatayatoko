'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Truck, ShieldCheck, Tag, Lock, ChevronRight, 
  X, CheckCircle2, AlertCircle, Sparkles, HelpCircle 
} from 'lucide-react';

export interface CustomerGuaranteesProps {
  variant?: 'compact' | 'full' | 'cards' | 'checkout';
  className?: string;
}

export const GUARANTEE_ITEMS = [
  {
    id: 'ongkir',
    icon: Truck,
    title: 'Gratis Ongkir Kediri Kota',
    tag: 'HEMAT ONGKIR',
    shortDesc: 'Pengiriman gratis langsung ke depan pintu untuk wilayah Kediri Kota.',
    fullDesc:
      'Kami menyediakan layanan pesan-antar Gratis Ongkir untuk seluruh wilayah Kediri Kota & sekitarnya sesuai syarat minimum belanja yang tertera saat checkout. Armada kurir kami memastikan pesanan sembako Anda sampai dengan cepat, rapi, dan higienis.',
    link: '/syarat-ketentuan',
    color: 'emerald',
  },
  {
    id: 'retur',
    icon: ShieldCheck,
    title: 'Garansi Retur 1x24 Jam',
    tag: '100% PASTI AMAN',
    shortDesc: 'Kemasan rusak, bocor, atau salah barang? Laporkan 1x24 jam, langsung diganti.',
    fullDesc:
      'Jika produk yang Anda terima dalam kondisi kemasan rusak, telur pecah, minyak bocor, atau kadaluarsa, cukup foto/video dan hubungi admin kami via WhatsApp dalam waktu maksimal 1x24 jam setelah barang diterima. Kami akan kirimkan produk pengganti baru atau pengembalian dana 100%.',
    link: '/syarat-ketentuan',
    color: 'blue',
  },
  {
    id: 'grosir',
    icon: Tag,
    title: 'Harga Grosir Otomatis',
    tag: 'GROSIR & ECER',
    shortDesc: 'Harga otomatis turun lebih murah jika belanja dalam jumlah grosir / karton.',
    fullDesc:
      'Sistem ATAYATOKO otomatis memberikan potongan harga grosir saat jumlah pesanan mencapai batas minimum grosir (misal: 1 karton / 12 pcs / 24 pcs). Sangat cocok untuk belanja hemat keluarga maupun pasokan warung & UMKM kuliner tanpa perlu tawar-menawar manual.',
    link: '/semua-kategori',
    color: 'amber',
  },
  {
    id: 'privasi',
    icon: Lock,
    title: 'Privasi & Data Terlindungi',
    tag: 'TERENKRIPSI SSL',
    shortDesc: 'Nomor WhatsApp dan alamat rumah Anda 100% aman dan tidak disalahgunakan.',
    fullDesc:
      'Kami menjamin kerahasiaan penuh atas data pribadi pelanggan. Nomor WhatsApp, nomor telepon, dan alamat pengiriman Anda hanya digunakan secara eksklusif untuk proses verifikasi pesanan dan pengantaran kurir. Data tidak pernah diperjualbelikan kepada pihak ketiga manapun.',
    link: '/kebijakan-privasi',
    color: 'purple',
  },
];

export default function CustomerGuarantees({ variant = 'full', className = '' }: CustomerGuaranteesProps) {
  const [activeModal, setActiveModal] = useState<typeof GUARANTEE_ITEMS[0] | null>(null);

  // 1. Variant: Cards (Cocok untuk Homepage)
  if (variant === 'cards' || variant === 'full') {
    return (
      <section className={`py-6 md:py-10 ${className}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <Sparkles size={16} />
                </span>
                <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">
                  Jaminan Transaksi ATAYATOKO
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Penting Diketahui Sebelum Belanja
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Komitmen kami memberikan pengalaman belanja sembako yang transparan, hemat, dan terpercaya di Kediri.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {GUARANTEE_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveModal(item)}
                  className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Icon size={22} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-full border border-emerald-100/60">
                        {item.tag}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-900 text-sm md:text-base mb-1.5 group-hover:text-emerald-700 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.shortDesc}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                    <span>Pelajari Ketentuan</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Info Detail */}
        {activeModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-100 relative">
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                  {React.createElement(activeModal.icon, { size: 24 })}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    {activeModal.tag}
                  </span>
                  <h3 className="text-lg font-black text-slate-900">{activeModal.title}</h3>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs md:text-sm text-slate-700 leading-relaxed mb-6">
                {activeModal.fullDesc}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Tutup
                </button>
                <Link
                  href={activeModal.link}
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl text-center transition-colors shadow-sm"
                >
                  Baca Halaman Resmi
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  // 2. Variant: Compact (Cocok untuk Product Detail Page)
  if (variant === 'compact') {
    return (
      <div className={`bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 ${className}`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1">
          <ShieldCheck size={14} className="text-emerald-600" /> Jaminan Layanan Belanja
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-start gap-2 text-slate-700">
            <Truck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Gratis Ongkir</strong> Kediri Kota</span>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Garansi Retur 1x24 Jam</strong> bila rusak</span>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <Tag size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Harga Grosir Otomatis</strong> sesuai qty</span>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <Lock size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Data & WhatsApp Aman</strong> 100% terjaga</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Variant: Checkout (Untuk Ringkasan Keranjang / Checkout)
  return (
    <div className={`bg-emerald-50/70 rounded-2xl p-4 border border-emerald-100 text-xs text-slate-700 space-y-2 ${className}`}>
      <div className="flex items-center gap-2 font-bold text-emerald-950">
        <ShieldCheck size={16} className="text-emerald-600" />
        <span>Pesanan Anda Dilindungi 4 Jaminan Resmi:</span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600">
        <li className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
          <span>Gratis Ongkir Area Kediri Kota</span>
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
          <span>Garansi Retur 1x24 Jam (Barang Rusak/Bocor)</span>
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
          <span>Harga Grosir Otomatis Terpasang</span>
        </li>
        <li className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
          <span>Privasi Nomor WhatsApp & Alamat Terjamin</span>
        </li>
      </ul>
    </div>
  );
}
