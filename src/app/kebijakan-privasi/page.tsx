import { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Lock, Eye, FileText, Bell, CheckCircle2, ChevronLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi (Privacy Policy) | ATAYATOKO Sembako Kediri',
  description:
    'Kebijakan Privasi ATAYATOKO menjelaskan bagaimana kami mengumpulkan, menggunakan, dan melindungi data pribadi Anda saat bertransaksi di website kami.',
  alternates: {
    canonical: 'https://atayatoko.aty0.com/kebijakan-privasi',
  },
};

export default function KebijakanPrivasiPage() {
  const lastUpdated = '27 September 2026';

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white py-12 md:py-16 px-4 sm:px-6 lg:px-8 border-b border-emerald-900/30">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-xs font-bold uppercase tracking-wider mb-6 transition-colors bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm"
          >
            <ChevronLeft size={16} /> Kembali ke Beranda
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <ShieldCheck size={28} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
              Dokumen Legal Resmi
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Kebijakan Privasi
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
            Komitmen kami di ATAYATOKO untuk melindungi informasi pribadi Anda dengan standar transparansi dan keamanan terbaik.
          </p>
          <p className="text-xs text-slate-400 mt-4 font-medium">
            Terakhir diperbarui: <span className="text-emerald-400 font-bold">{lastUpdated}</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200/80 space-y-10 text-slate-700 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Eye className="text-emerald-600" size={22} />
              <h2>1. Informasi yang Kami Kumpulkan</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Untuk memproses pesanan sembako, pengiriman gratis ongkir, dan memberikan layanan belanja terbaik, ATAYATOKO mengumpulkan informasi berikut:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Data Kontak:</strong> Nama lengkap, nomor WhatsApp/telepon aktif, dan alamat email.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Data Pengiriman:</strong> Alamat pengiriman lengkap, kelurahan/kecamatan di area Kediri & sekitarnya, serta catatan kurir.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Riwayat Transaksi:</strong> Daftar item sembako yang dibeli, nomor nota/pesanan, dan status pembayaran.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Data Teknis:</strong> Alamat IP perangkat, cookies sesi keranjang belanja, dan log peramban untuk performa web.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Lock className="text-emerald-600" size={22} />
              <h2>2. Penggunaan Informasi Pribadi</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Informasi yang Anda berikan kami gunakan secara ketat hanya untuk kepentingan:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li>Memproses dan mengonfirmasi pesanan produk sembako Anda.</li>
              <li>Menghubungi Anda melalui WhatsApp/telepon mengenai ketersediaan stok atau konfirmasi pengantaran kurir.</li>
              <li>Menyimpan struk digital transaksi dan poin belanja member ATAYATOKO.</li>
              <li>Meningkatkan kenyamanan, keamanan sistem, dan kecepatan website kami.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <FileText className="text-emerald-600" size={22} />
              <h2>3. Penggunaan Cookies & Layanan Pihak Ketiga (Google & Analitik)</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Website kami menggunakan <em>Cookies</em> untuk menyimpan preferensi keranjang belanja Anda agar tidak hilang saat berpindah halaman.
            </p>
            <p className="text-sm md:text-base text-slate-600">
              Kami juga dapat bekerja sama dengan pihak ketiga seperti <strong>Google Analytics</strong> dan jaringan periklanan resmi (termasuk <strong>Google AdSense</strong>) yang mungkin menggunakan cookies (seperti Cookie DART) untuk menampilkan iklan yang relevan bagi pengunjung berdasarkan kunjungan ke situs ini atau situs lainnya di internet. Anda dapat menonaktifkan penggunaan cookies melalui pengaturan browser Anda kapan saja.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <ShieldCheck className="text-emerald-600" size={22} />
              <h2>4. Keamanan & Perlindungan Data</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Kami menjunjung tinggi keamanan data pelanggan. Kami <strong>TIDAK PERNAH</strong> menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan komersial di luar eksekusi pengantaran pesanan Anda. Seluruh transmisi data di website kami dilindungi oleh enkripsi SSL/TLS (HTTPS).
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Bell className="text-emerald-600" size={22} />
              <h2>5. Hak Pengguna & Kontak Kami</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Sebagai pengguna, Anda berhak memperbarui, mengoreksi, atau meminta penghapusan riwayat data pribadi Anda dari sistem kami dengan menghubungi kontak resmi kami:
            </p>
            <div className="mt-4 p-5 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs md:text-sm text-slate-800 space-y-1.5">
              <p className="font-bold text-emerald-950">ATAYATOKO - Pusat Grosir & Eceran Sembako Kediri</p>
              <p>📍 Alamat: Jl. Pandan 98, Semen, Kediri, Jawa Timur, Indonesia</p>
              <p>📱 WhatsApp: <a href="https://wa.me/6285853161174" className="text-emerald-700 font-bold underline" target="_blank" rel="noopener noreferrer">0858-5316-1174</a></p>
              <p>✉️ Email: <a href="mailto:info@atayatoko.com" className="text-emerald-700 font-bold underline">info@atayatoko.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
