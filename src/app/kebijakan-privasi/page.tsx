import { Metadata } from 'next';
import Link from 'next/link';
import { 
  ShieldCheck, Lock, Eye, FileText, Bell, CheckCircle2, 
  ChevronLeft, Database, Globe, UserCheck, AlertTriangle, Shield 
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi (Privacy Policy) | ATAYATOKO Sembako Kediri',
  description:
    'Kebijakan Privasi resmi ATAYATOKO Kediri sesuai UU Pelindungan Data Pribadi (UU PDP No. 27/2022) dan standar verifikasi periklanan Google AdSense.',
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
              Kepatuhan UU PDP No. 27/2022 & Standar Google
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Kebijakan Privasi (Privacy Policy)
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
            Pemberitahuan hukum mengenai transparansi pengumpulan, pemrosesan, penyimpanan, dan perlindungan data pribadi pelanggan di platform ATAYATOKO.
          </p>
          <p className="text-xs text-slate-400 mt-4 font-medium">
            Terakhir diperbarui & berlaku efektif: <span className="text-emerald-400 font-bold">{lastUpdated}</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200/80 space-y-10 text-slate-700 leading-relaxed">
          
          {/* Komitmen Perlindungan Data */}
          <div className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-xs md:text-sm text-slate-700 space-y-2">
            <p className="font-bold text-emerald-950 flex items-center gap-2">
              <Shield size={18} className="text-emerald-600" />
              Komitmen Kepatuhan Hukum Privasi:
            </p>
            <p className="text-slate-600 leading-relaxed">
              ATAYATOKO menghormati hak privasi setiap pengunjung dan pelanggan. Kebijakan Privasi ini disusun berdasarkan ketentuan <strong>Undang-Undang Republik Indonesia No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)</strong>, <strong>Undang-Undang No. 1 Tahun 2024 tentang Perubahan Kedua atas UU ITE</strong>, serta kebijakan privasi periklanan internasional <strong>Google AdSense</strong>.
            </p>
          </div>

          {/* 1. Kategori Data Pribadi yang Dikumpulkan */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Eye className="text-emerald-600" size={22} />
              <h2>1. Jenis Data Pribadi yang Kami Kumpulkan</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Untuk kelancaran transaksi, verifikasi pesanan, dan pengantaran sembako ke lokasi Anda, kami mengumpulkan jenis data berikut:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Identitas Kontak:</strong> Nama lengkap, nomor WhatsApp/telepon seluler aktif, dan alamat email (apabila login akun).</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Data Pengantaran Fisik:</strong> Alamat rumah/kantor lengkap, kelurahan, kecamatan, patokan jalan, dan koordinat kirim area Kediri.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Data Transaksi:</strong> Rincian item sembako yang dibeli, harga satuan, nilai total, metode pembayaran, bukti transfer, dan status pesanan.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Data Log & Teknis:</strong> Alamat IP, jenis browser, preferensi bahasa, dan waktu kunjungan untuk monitoring keamanan situs.</span>
              </li>
            </ul>
          </section>

          {/* 2. Tujuan & Dasar Pemrosesan Data */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Lock className="text-emerald-600" size={22} />
              <h2>2. Dasar Hukum & Tujuan Pemrosesan Data</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Sesuai dengan Pasal 20 UU PDP, pemrosesan data pribadi Anda dilakukan atas dasar <strong>persetujuan yang sah</strong> dan <strong>pelaksanaan kewajiban perjanjian jual-beli</strong> untuk tujuan:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li>Memproses checkout, pengemasan sembako, dan penugasan armada kurir ATAYATOKO ke alamat Anda.</li>
              <li>Menghubungi pembeli melalui WhatsApp untuk konfirmasi jam tiba pengantaran atau ketersediaan stok produk.</li>
              <li>Penerbitan nota/struk belanja digital yang sah dan pencatatan poin belanja member.</li>
              <li>Pencegahan penipuan transaksi, pesanan fiktif COD, dan perlindungan keamanan server.</li>
            </ul>
          </section>

          {/* 3. Klausul Wajib Google AdSense, Cookies, & DART */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Globe className="text-emerald-600" size={22} />
              <h2>3. Kebijakan Cookies, Google Analytics, & Google AdSense</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Website ini menggunakan <em>cookies</em> dan teknologi pelacak serupa untuk menyimpan preferensi keranjang belanja pelanggan:
            </p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs md:text-sm text-slate-600">
              <p><strong>Pengungkapan Wajib untuk Iklan Pihak Ketiga (Google AdSense):</strong></p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>Vendor pihak ketiga, termasuk <strong>Google</strong>, menggunakan cookie untuk menayangkan iklan berdasarkan kunjungan pengguna sebelumnya ke website kami atau situs web lain di internet.</li>
                <li>Penggunaan <strong>Cookie Periklanan Google (seperti Cookie DART)</strong> memungkinkan Google dan mitranya untuk menayangkan iklan yang relevan kepada pengunjung berdasarkan data penjelajahan.</li>
                <li>Pengunjung dapat memilih untuk tidak menggunakan iklan hasil personalisasi (opt-out) dengan mengunjungi <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold">Setelan Iklan Google</a> atau melalui <a href="https://www.aboutads.info" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold">aboutads.info</a>.</li>
                <li>Anda juga dapat mematikan cookies sepenuhnya melalui menu pengaturan browser Anda kapan saja tanpa membatalkan fungsi belanja dasar.</li>
              </ul>
            </div>
          </section>

          {/* 4. Penyimpanan & Keamanan Data (Enkripsi SSL) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Database className="text-emerald-600" size={22} />
              <h2>4. Masa Retensi & Standar Keamanan Data</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li><strong>Enkripsi Modern:</strong> Seluruh komunikasi data antara perangkat Anda dan server kami dilindungi protokol enkripsi <strong>SSL/TLS (HTTPS 256-bit)</strong>.</li>
              <li><strong>Akses Terbatas:</strong> Hanya staf administrasi dan kurir yang bertugas yang memiliki akses terbatas terhadap nomor telepon dan alamat pengiriman Anda demi keperluan serah terima barang.</li>
              <li><strong>Masa Simpan (Retensi):</strong> Data riwayat transaksi disimpan selama maksimal 5 (lima) tahun sesuai kepatuhan hukum pembukuan usaha dan perpajakan Republik Indonesia, setelah itu data akan dimusnahkan atau dianonymisasi.</li>
              <li><strong>Protokol Insiden Keamanan:</strong> Dalam hal terjadi kegagalan pelindungan data pribadi (data breach), kami akan menyampaikan pemberitahuan tertulis kepada Anda dan otoritas yang berwenang dalam waktu paling lambat 3 x 24 jam sesuai amanat Pasal 46 UU PDP.</li>
            </ul>
          </section>

          {/* 5. Hak-Hak Pelanggan sebagai Subjek Data */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <UserCheck className="text-emerald-600" size={22} />
              <h2>5. Hak-Hak Anda sebagai Subjek Data Pribadi</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Berdasarkan Pasal 5 sampai Pasal 13 UU No. 27 Tahun 2022, setiap pengguna website ATAYATOKO memiliki hak mutlak:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-xs md:text-sm">
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Hak mengakses dan memperoleh salinan data pribadi Anda.</span>
              </li>
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Hak memperbarui atau memperbaiki kesalahan data pribadi.</span>
              </li>
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Hak menghapus atau memusnahkan riwayat data Anda dari sistem kami.</span>
              </li>
              <li className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Hak menarik kembali persetujuan pemrosesan data sewaktu-waktu.</span>
              </li>
            </ul>
          </section>

          {/* 6. Privasi Anak di Bawah Umur */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <AlertTriangle className="text-emerald-600" size={22} />
              <h2>6. Privasi Pengguna di Bawah Umur</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Layanan ATAYATOKO ditujukan untuk masyarakat umum dan usaha dagang. Kami tidak secara sengaja mengumpulkan data pribadi dari anak-anak di bawah usia 18 tahun tanpa persetujuan eksplisit dari orang tua atau wali yang sah. Jika Anda mengetahui anak di bawah umur memberikan data tanpa izin, harap hubungi kami untuk penghapusan segera.
            </p>
          </section>

          {/* 7. Perubahan Kebijakan & Petugas Kontak Perlindungan Data */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Bell className="text-emerald-600" size={22} />
              <h2>7. Perubahan Kebijakan & Kontak Petugas Privasi</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Kami dapat memperbarui Kebijakan Privasi ini secara berkala mengikuti perkembangan teknologi dan regulasi pemerintah. Untuk melaksanakan hak subjek data atau mengajukan pertanyaan mengenai perlindungan data pribadi Anda, silakan hubungi:
            </p>
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs md:text-sm text-slate-800 space-y-1.5">
              <p className="font-bold text-emerald-950">Petugas Pelindungan Data (Data Protection Officer) - ATAYATOKO</p>
              <p>📍 Alamat Usaha: Jl. Pandan 98, Semen, Kediri, Jawa Timur, Indonesia</p>
              <p>📱 WhatsApp Resmi: <a href="https://wa.me/6285853161174" className="text-emerald-700 font-bold underline" target="_blank" rel="noopener noreferrer">0858-5316-1174</a></p>
              <p>✉️ Email Khusus Privasi: <a href="mailto:info@atayatoko.com" className="text-emerald-700 font-bold underline">info@atayatoko.com</a></p>
              <p>🕒 Jam Layanan: Buka Setiap Hari (08:00 - 21:00 WIB)</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
