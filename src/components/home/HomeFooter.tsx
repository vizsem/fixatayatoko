'use client';

import Link from 'next/link';
import { 
  Phone, MapPin, Clock, Truck, ShieldCheck, 
  Printer, Home as HomeIcon, Grid, ShoppingCart, 
  FileText, User 
} from 'lucide-react';

interface HomeFooterProps {
  cartCount: number;
}

export const HomeFooter = ({ cartCount }: HomeFooterProps) => {
  return (
    <>
      <footer className="mt-12 md:mt-16 bg-gray-900 text-white pt-10 md:pt-16 pb-20 md:pb-16 rounded-t-[2.5rem] md:rounded-t-[3rem] px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12">
          {/* Brand & Deskripsi */}
          <div className="space-y-3 md:space-y-4">
            <h2 className="text-xl md:text-2xl font-black tracking-tighter text-green-400 uppercase">ATAYATOKO</h2>
            <p className="text-gray-400 text-[13px] md:text-sm leading-relaxed max-w-sm">
              Pusat belanja sembako grosir dan eceran termurah di Kediri. Melayani pengiriman cepat langsung ke depan pintu Anda.
            </p>
          </div>

          {/* Kontak & Lokasi */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-500 mb-2 md:mb-4">Hubungi Kami</h3>
            <div className="space-y-2 md:space-y-3">
              <a href="https://wa.me/6285853161174" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-gray-300 hover:text-green-400 transition-colors">
                <div className="p-1.5 bg-gray-800 rounded-lg"><Phone size={14} /></div>
                <span className="text-[13px] md:text-sm">0858-5316-1174</span>
              </a>
              <div className="flex items-start gap-3 text-sm text-gray-300">
                <div className="p-1.5 bg-gray-800 rounded-lg shrink-0"><MapPin size={14} /></div>
                <span className="text-[13px] md:text-sm">Kediri, Jawa Timur, Indonesia</span>
              </div>
            </div>
          </div>

          {/* Jam Operasional & Kebijakan */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-500 mb-2 md:mb-4">Layanan Pelanggan</h3>
            <ul className="space-y-2 md:space-y-3 text-[13px] md:text-sm text-gray-300">
              <li className="flex items-center gap-2"><Clock size={12} className="text-gray-500" /> Buka Setiap Hari (08:00 - 21:00)</li>
              <li className="flex items-center gap-2"><Truck size={12} className="text-gray-500" /> Gratis Ongkir (S&K Berlaku)</li>
              <li className="flex items-center gap-2"><ShieldCheck size={12} className="text-gray-500" /> Garansi Retur Barang Rusak</li>
            </ul>
          </div>

          {/* Tautan Internal */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-500 mb-2 md:mb-4">Internal</h3>
            <ul className="space-y-2 md:space-y-3">
              <li>
                <Link href="/profil/login" className="text-[13px] md:text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <ShieldCheck size={12} /> Panel Admin
                </Link>
              </li>
              <li>
                <Link href="/cashier" className="text-[13px] md:text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                  <Printer size={12} /> Sistem Kasir
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="max-w-7xl mx-auto border-t border-gray-800 pt-6 md:pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-[10px] md:text-xs font-bold text-gray-500 tracking-tight">© {new Date().getFullYear()} ATAYATOKO. All rights reserved.</p>
          <div className="flex gap-4">
            <span className="text-[10px] md:text-xs font-bold text-gray-600">Aman & Terpercaya</span>
          </div>
        </div>
      </footer>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50">
        <Link href="/" className="flex flex-col items-center gap-1 text-green-600">
          <HomeIcon size={20} /><span className="text-[8px] font-black uppercase">Beranda</span>
        </Link>
        <Link href="/semua-kategori" className="flex flex-col items-center gap-1 text-gray-400">
          <Grid size={20} /><span className="text-[8px] font-black uppercase">Katalog</span>
        </Link>
        <Link href="/cart" className="flex flex-col items-center gap-1 text-gray-400 relative">
          <div className="relative">
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center animate-bounce">{cartCount}</span>}
          </div>
          <span className="text-[8px] font-black uppercase">Keranjang</span>
        </Link>
        <Link href="/orders" className="flex flex-col items-center gap-1 text-gray-400">
          <FileText size={20} /><span className="text-[8px] font-black uppercase">Pesanan</span>
        </Link>
        <Link href="/profil" className="flex flex-col items-center gap-1 text-gray-400">
          <User size={20} /><span className="text-[8px] font-black uppercase">Akun</span>
        </Link>
      </nav>
    </>
  );
};
