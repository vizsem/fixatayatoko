import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Building2, ShieldCheck, Truck, Users, Award, 
  ChevronLeft, Phone, MapPin, Mail, ArrowRight, HeartHandshake, CheckCircle 
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tentang Kami (About Us) | ATAYATOKO Sembako Kediri',
  description:
    'Profil ATAYATOKO, pusat belanja grosir dan eceran sembako terpercaya di Kediri. Melayani pengiriman cepat gratis ongkir, pasokan UMKM, dan harga paling kompetitif.',
  alternates: {
    canonical: 'https://atayatoko.aty0.com/tentang',
  },
};

export default function TentangPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-16">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white py-14 md:py-20 px-4 sm:px-6 lg:px-8 border-b border-emerald-900/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-4xl mx-auto relative z-10 text-center md:text-left">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-6 transition-colors bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-sm"
          >
            <ChevronLeft size={16} /> Kembali ke Beranda
          </Link>
          <div className="flex items-center justify-center md:justify-start gap-2.5 mb-3">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-widest rounded-full border border-emerald-500/30">
              Pusat Grosir & Eceran Kediri
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Tentang ATAYATOKO
          </h1>
          <p className="text-base md:text-lg text-slate-300 max-w-2xl leading-relaxed">
            Mitra belanja sembako terpercaya untuk keluarga, toko kelontong, dan UMKM kuliner di wilayah Kediri dan sekitarnya.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Story Section */}
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900">Cerita & Komitmen Kami</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Perjalanan ATAYATOKO</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            ATAYATOKO berawal dari dedikasi untuk menyediakan sembako berkualitas tinggi dengan harga yang jujur dan terjangkau bagi masyarakat Kediri. Kami memahami bahwa kebutuhan pokok seperti beras, minyak goreng, gula, tepung, telur, dan bumbu dapur adalah urat nadi setiap rumah tangga dan usaha kuliner.
          </p>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            Dengan memadukan toko fisik dan platform digital yang modern, kami hadir untuk mempermudah belanja sembako tanpa perlu antre panjang atau repot membawa beban berat. Cukup pesan lewat website atau WhatsApp, kurir kami siap mengantarkan pesanan langsung ke depan pintu Anda.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-center">
              <p className="text-2xl md:text-3xl font-black text-emerald-700 mb-1">100%</p>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Produk Asli & Segar</p>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-center">
              <p className="text-2xl md:text-3xl font-black text-emerald-700 mb-1">Gratis</p>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ongkir Area Kediri Kota</p>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-center">
              <p className="text-2xl md:text-3xl font-black text-emerald-700 mb-1">Hemat</p>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Harga Grosir Otomatis</p>
            </div>
          </div>
        </div>

        {/* Visi & Misi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700 font-black text-lg">
              <Award size={22} />
              <h3>Visi Kami</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Menjadi distributor dan penyedia sembako digital nomor satu di Kediri yang dikenal atas kejujuran timbangan, kestabilan harga, dan keunggulan pelayanan pelanggan.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-700 font-black text-lg">
              <HeartHandshake size={22} />
              <h3>Misi Kami</h3>
            </div>
            <ul className="text-xs md:text-sm text-slate-600 space-y-2.5">
              <li className="flex items-start gap-2">
                <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Menjamin ketersediaan stok sembako pokok setiap hari.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Memberikan harga grosir terbaik untuk mendukung warung kelontong & UMKM.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Menyediakan pengiriman cepat, aman, dan garansi retur jika produk rusak.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Keunggulan Belanja */}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-3xl p-6 md:p-10 shadow-lg space-y-6">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-center md:text-left">
            Kenapa Memilih ATAYATOKO?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="p-3 bg-white/10 rounded-2xl w-fit text-emerald-400">
                <Truck size={22} />
              </div>
              <h3 className="font-bold text-sm text-white">Pengiriman Cepat & Gratis</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Pesanan diantar langsung oleh armada kurir kami untuk memastikan barang sampai aman dan higienis.
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-3 bg-white/10 rounded-2xl w-fit text-emerald-400">
                <ShieldCheck size={22} />
              </div>
              <h3 className="font-bold text-sm text-white">Garansi 100% Produk Bagus</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kemasan bocor atau cacat? Laporkan dalam 1x24 jam dan kami siap mengganti tanpa ribet.
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-3 bg-white/10 rounded-2xl w-fit text-emerald-400">
                <Users size={22} />
              </div>
              <h3 className="font-bold text-sm text-white">Dukungan Pelanggan Ramah</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tim admin kami selalu siap melayani konsultasi pesanan partai besar maupun eceran via WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="font-black text-slate-900 text-lg">Punya Pertanyaan atau Kebutuhan Grosir?</h3>
            <p className="text-xs md:text-sm text-slate-500">Hubungi kami sekarang untuk penawaran harga terbaik!</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/kontak"
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              Halaman Kontak <ArrowRight size={14} />
            </Link>
            <a
              href="https://wa.me/6285853161174"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              <Phone size={14} /> Chat WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}