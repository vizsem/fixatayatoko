'use client';

import Link from 'next/link';
import { 
  Phone, MapPin, Clock, Truck, ShieldCheck, 
  Printer, Home as HomeIcon, Grid, ShoppingCart, 
  FileText, User, Mail, HelpCircle, FileCheck
} from 'lucide-react';

interface HomeFooterProps {
  cartCount: number;
}

export const HomeFooter = ({ cartCount }: HomeFooterProps) => {
  return (
    <>
      <footer className="mt-12 md:mt-16 bg-slate-950 text-white pt-12 md:pt-16 pb-24 md:pb-12 rounded-t-[2.5rem] md:rounded-t-[3rem] px-6 border-t border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-10 md:mb-12">
          {/* Brand & Deskripsi */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-400 uppercase">
                ATAYATOKO
              </span>
            </div>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Pusat belanja sembako grosir dan eceran termurah di Kediri. Menyediakan beras, minyak goreng, gula, tepung, dan kebutuhan pokok lainnya dengan layanan pesan antar gratis ongkir.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400 font-bold">
              <ShieldCheck size={16} /> Belanja Nyaman, Pasti Aman & Segar
            </div>
          </div>

          {/* Informasi & Perusahaan */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-[11px] md:text-xs font-black tracking-widest text-slate-400 uppercase">
              Informasi Toko
            </h3>
            <ul className="space-y-2.5 text-xs md:text-sm">
              <li>
                <Link href="/tentang" className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Tentang Kami (About Us)
                </Link>
              </li>
              <li>
                <Link href="/kontak" className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hubungi Kami (Contact)
                </Link>
              </li>
              <li>
                <Link href="/semua-kategori" className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Katalog Semua Produk
                </Link>
              </li>
              <li>
                <Link href="/promo" className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Promo & Diskon Menarik
                </Link>
              </li>
            </ul>
          </div>

          {/* Kebijakan & Legalitas (Wajib Google AdSense & Hukum) */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-[11px] md:text-xs font-black tracking-widest text-slate-400 uppercase">
              Kebijakan & Bantuan
            </h3>
            <ul className="space-y-2.5 text-xs md:text-sm">
              <li>
                <Link href="/kebijakan-privasi" className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <FileCheck size={14} className="text-emerald-400" /> Kebijakan Privasi (Privacy Policy)
                </Link>
              </li>
              <li>
                <Link href="/syarat-ketentuan" className="text-slate-300 hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <FileText size={14} className="text-emerald-400" /> Syarat & Ketentuan (Terms of Service)
                </Link>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <Truck size={14} className="text-slate-500" /> Gratis Ongkir Kediri Kota (S&K)
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <ShieldCheck size={14} className="text-slate-500" /> Garansi Retur 1x24 Jam
              </li>
            </ul>
          </div>

          {/* Kontak & Lokasi */}
          <div className="space-y-3 md:space-y-4">
            <h3 className="text-[11px] md:text-xs font-black tracking-widest text-slate-400 uppercase">
              Layanan Pelanggan
            </h3>
            <div className="space-y-2.5 text-xs md:text-sm">
              <a 
                href="https://wa.me/6285853161174" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3 text-slate-300 hover:text-emerald-400 transition-colors p-2 bg-slate-900 rounded-xl border border-slate-800"
              >
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg"><Phone size={14} /></div>
                <span className="font-bold">0858-5316-1174</span>
              </a>
              <div className="flex items-start gap-2.5 text-slate-400">
                <MapPin size={15} className="text-slate-500 shrink-0 mt-0.5" />
                <span>Jl. Pandan 98, Semen, Kediri, Jawa Timur</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400">
                <Clock size={15} className="text-slate-500 shrink-0" />
                <span>Buka Setiap Hari: 08:00 - 21:00 WIB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="max-w-7xl mx-auto border-t border-slate-800/80 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-[11px] text-slate-500 font-medium">
            © {new Date().getFullYear()} <strong className="text-slate-300">ATAYATOKO</strong>. Seluruh hak cipta dilindungi undang-undang.
          </p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-[11px] text-slate-400 font-medium">
            <Link href="/tentang" className="hover:text-emerald-400 transition-colors">Tentang Kami</Link>
            <Link href="/kontak" className="hover:text-emerald-400 transition-colors">Kontak</Link>
            <Link href="/kebijakan-privasi" className="hover:text-emerald-400 transition-colors">Kebijakan Privasi</Link>
            <Link href="/syarat-ketentuan" className="hover:text-emerald-400 transition-colors">Syarat & Ketentuan</Link>
            <Link href="/profil/login" className="text-slate-600 hover:text-slate-400 transition-colors">Panel Admin</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 px-6 py-2.5 flex justify-between items-center z-50">
        <Link href="/" className="flex flex-col items-center gap-0.5 text-emerald-600">
          <HomeIcon size={20} /><span className="text-[10px] font-bold">Beranda</span>
        </Link>
        <Link href="/semua-kategori" className="flex flex-col items-center gap-0.5 text-gray-400">
          <Grid size={20} /><span className="text-[10px] font-bold">Katalog</span>
        </Link>
        <Link href="/cart" className="flex flex-col items-center gap-0.5 text-gray-400 relative">
          <div className="relative">
            <ShoppingCart size={20} />
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center animate-bounce">{cartCount}</span>}
          </div>
          <span className="text-[10px] font-bold">Keranjang</span>
        </Link>
        <Link href="/orders" className="flex flex-col items-center gap-0.5 text-gray-400">
          <FileText size={20} /><span className="text-[10px] font-bold">Pesanan</span>
        </Link>
        <Link href="/profil" className="flex flex-col items-center gap-0.5 text-gray-400">
          <User size={20} /><span className="text-[10px] font-bold">Akun</span>
        </Link>
      </nav>
    </>
  );
};
