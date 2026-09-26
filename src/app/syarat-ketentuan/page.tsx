import { Metadata } from 'next';
import Link from 'next/link';
import { 
  FileText, ShoppingBag, Truck, AlertCircle, Scale, RefreshCw, 
  ChevronLeft, CheckCircle2, ShieldAlert, Ban, Gavel, HelpCircle 
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan Layanan (Terms of Service) | ATAYATOKO Sembako Kediri',
  description:
    'Syarat dan Ketentuan resmi transaksi jual beli sembako eceran & grosir di ATAYATOKO Kediri, mencakup hak konsumen, batasan tanggung jawab, kebijakan COD, garansi retur, dan yurisdiksi hukum.',
  alternates: {
    canonical: 'https://atayatoko.aty0.com/syarat-ketentuan',
  },
};

export default function SyaratKetentuanPage() {
  const lastUpdated = '27 September 2026';

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white py-12 md:py-16 px-4 sm:px-6 lg:px-8 border-b border-blue-900/30">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-xs font-bold uppercase tracking-wider mb-6 transition-colors bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm"
          >
            <ChevronLeft size={16} /> Kembali ke Beranda
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
              <Scale size={28} />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">
              Perjanjian Penggunaan Layanan (Legal Agreement)
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Syarat & Ketentuan Layanan
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
            Perjanjian ini mengikat secara hukum antara Pengguna (Pelanggan) dan ATAYATOKO sesuai peraturan perundang-undangan Republik Indonesia (UU ITE & UU Perlindungan Konsumen).
          </p>
          <p className="text-xs text-slate-400 mt-4 font-medium">
            Terakhir diperbarui & berlaku efektif: <span className="text-blue-400 font-bold">{lastUpdated}</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200/80 space-y-10 text-slate-700 leading-relaxed">
          
          {/* Ringkasan Hukum */}
          <div className="p-5 bg-blue-50/70 rounded-2xl border border-blue-100 text-xs md:text-sm text-slate-700 space-y-2">
            <p className="font-bold text-blue-950 flex items-center gap-2">
              <Scale size={18} className="text-blue-600" />
              Pemberitahuan Penting untuk Seluruh Pelanggan:
            </p>
            <p className="text-slate-600 leading-relaxed">
              Dengan mengakses, mendaftar, atau membuat pesanan sembako di website <strong>atayatoko.aty0.com</strong>, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat oleh seluruh Syarat dan Ketentuan ini. Jika Anda tidak menyetujui salah satu ketentuan, mohon untuk tidak menggunakan layanan kami.
            </p>
          </div>

          {/* 1. Definisi & Ketentuan Akun */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <FileText className="text-blue-600" size={22} />
              <h2>1. Definisi & Ketentuan Akun</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li><strong>ATAYATOKO</strong> adalah penyedia platform digital dan toko fisik distributor sembako grosir dan eceran yang berdomisili di Kediri, Jawa Timur.</li>
              <li><strong>Pengguna / Pelanggan</strong> adalah setiap individu atau badan usaha yang mengakses situs atau melakukan pemesanan produk.</li>
              <li>Pengguna wajib berusia minimal 18 tahun atau di bawah pengawasan wali/orang tua yang sah saat melakukan transaksi.</li>
              <li>Pengguna bertanggung jawab penuh atas kebenaran data nomor WhatsApp, nama penerima, dan alamat pengiriman yang dimasukkan ke dalam sistem.</li>
            </ul>
          </section>

          {/* 2. Pemesanan, Ketersediaan Stok, & Typo Harga */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <ShoppingBag className="text-blue-600" size={22} />
              <h2>2. Ketentuan Pemesanan, Stok, & Kesalahan Tampilan (Typo)</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li><strong>Ketersediaan Stok:</strong> Seluruh pesanan bergantung pada ketersediaan stok fisik riil di gudang kami. Jika terjadi kekosongan stok mendadak, admin kami berhak mengonfirmasi barang pengganti sejenis atau mengembalikan dana pesanan.</li>
              <li><strong>Koreksi Kesalahan Sistem (Typo):</strong> Jika terjadi kesalahan teknis pada sistem yang mengakibatkan harga produk ditampilkan tidak wajar (misalnya: produk Rp100.000 tertera Rp100 karena bug sistem), ATAYATOKO berhak membatalkan pesanan tersebut secara sepihak dan mengembalikan dana penuh tanpa dikenai tuntutan ganti rugi.</li>
              <li><strong>Harga Grosir Otomatis:</strong> Harga grosir hanya berlaku jika kuantiti pemesanan memenuhi ambang batas minimum grosir yang telah ditetapkan sistem per item produk.</li>
            </ul>
          </section>

          {/* 3. Pembayaran & Kebijakan COD (Cash On Delivery) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Ban className="text-blue-600" size={22} />
              <h2>3. Ketentuan Pembayaran & Larangan Order Fiktif (Anti-Fake Order)</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Kami menerima metode pembayaran Transfer Bank, QRIS, dan Bayar di Tempat (COD) khusus wilayah jangkauan kurir kami:
            </p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs md:text-sm text-slate-600">
              <p><strong>Ketentuan Bayar di Tempat (COD):</strong></p>
              <ul className="list-disc list-inside space-y-1.5 pl-2">
                <li>Pelanggan wajib menyiapkan uang pas saat kurir tiba di alamat tujuan.</li>
                <li>Pelanggan <strong>DILARANG MENOLAK</strong> pembayaran pesanan COD tanpa alasan kerusakan fisik yang sah.</li>
                <li>Penolakan pembayaran sepihak, pesanan fiktif, atau memberikan alamat palsu yang merugikan operasional toko dapat dikenakan sanksi pemblokiran nomor akun permanen dan berpotensi diproses sesuai <strong>Pasal 378 KUHP tentang Penipuan</strong> dan <strong>UU ITE No. 1 Tahun 2024</strong>.</li>
              </ul>
            </div>
          </section>

          {/* 4. Pengiriman & Wilayah Gratis Ongkir */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Truck className="text-blue-600" size={22} />
              <h2>4. Ketentuan Pengiriman & Wilayah Layanan</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li><strong>Gratis Ongkir:</strong> Berlaku eksklusif untuk alamat pengantaran di wilayah Kediri Kota dan sekitarnya sesuai batas minimal pembelanjaan yang tertera saat checkout.</li>
              <li><strong>Kewajiban Penerima:</strong> Pelanggan atau perwakilan yang ditunjuk wajib berada di alamat tujuan saat kurir mengantarkan barang. Jika alamat kosong dan tidak dapat dihubungi via telepon/WhatsApp, pengantaran ulang berikutnya dapat dikenakan biaya kirim tambahan.</li>
              <li>Waktu estimasi pengiriman adalah panduan operasional normal dan bukan merupakan jaminan mutlak waktu sampai, bergantung pada kondisi rute dan volume pengantaran harian.</li>
            </ul>
          </section>

          {/* 5. Kebijakan Retur & Batas Klaim Garansi 1x24 Jam */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <RefreshCw className="text-blue-600" size={22} />
              <h2>5. Kebijakan Retur & Penggantian Barang Rusak</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Untuk melindungi hak konsumen sesuai UU No. 8 Tahun 1999 tentang Perlindungan Konsumen, klaim barang bermasalah diatur secara transparan:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li><strong>Batas Waktu Pelaporan:</strong> Klaim barang rusak, kemasan bocor, pecah, kadaluarsa, atau salah barang wajib dilaporkan kepada customer service kami paling lambat <strong>1 x 24 jam</strong> sejak paket diterima pelanggan.</li>
              <li><strong>Syarat Wajib Klaim:</strong> Wajib melampirkan foto jelas label resi pesanan dan video unboxing/foto kondisi kerusakan fisik saat barang pertama kali dibuka.</li>
              <li><strong>Penyelesaian Klaim:</strong> Apabila terbukti kelalaian ada pada pihak kami atau kurir pengantar, kami akan mengirimkan barang pengganti tanpa biaya tambahan atau melakukan pengembalian dana (refund) penuh.</li>
              <li>Kerusakan yang timbul akibat kesalahan cara penyimpanan oleh pelanggan setelah lewat dari 1x24 jam (misal: beras lembab terkena hujan setelah disimpan pelanggan) berada di luar tanggung jawab ATAYATOKO.</li>
            </ul>
          </section>

          {/* 6. Batasan Tanggung Jawab & Keadaan Kahar (Force Majeure) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <ShieldAlert className="text-blue-600" size={22} />
              <h2>6. Batasan Tanggung Jawab & Keadaan Kahar (Force Majeure)</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li>ATAYATOKO dibebaskan dari tanggung jawab atas keterlambatan atau kegagalan pemenuhan pesanan yang diakibatkan oleh kejadian di luar kendali wajar kami (<em>Force Majeure</em>), termasuk namun tidak terbatas pada: bencana alam, banjir, gempa bumi, cuaca ekstrem, kerusuhan, kebijakan lockdown pemerintah, pemadaman listrik massal, atau gangguan infrastruktur internet nasional.</li>
              <li>Dalam keadaan kahar, ATAYATOKO akan mengupayakan komunikasi secepatnya kepada pelanggan untuk penjadwalan ulang pengantaran atau pengembalian dana secara damai.</li>
            </ul>
          </section>

          {/* 7. Hak Kekayaan Intelektual */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <AlertCircle className="text-blue-600" size={22} />
              <h2>7. Hak Kekayaan Intelektual</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Seluruh nama dagang, logo ATAYATOKO, desain website, susunan katalog, dan materi teks yang ada pada situs ini dilindungi oleh Undang-Undang Hak Cipta dan Merek Dagang Republik Indonesia. Pengambilan atau penggunaan aset visual/data komersial tanpa izin tertulis dari manajemen ATAYATOKO merupakan pelanggaran hukum.
            </p>
          </section>

          {/* 8. Hukum yang Berlaku & Penyelesaian Sengketa (Yurisdiksi) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Gavel className="text-blue-600" size={22} />
              <h2>8. Hukum yang Berlaku & Penyelesaian Sengketa</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li>Syarat dan Ketentuan ini diatur dan ditafsirkan sepenuhnya berdasarkan hukum positif <strong>Negara Kesatuan Republik Indonesia</strong>.</li>
              <li>Apabila timbul perselisihan atau sengketa antara Pengguna dan ATAYATOKO, kedua belah pihak sepakat untuk menyelesaikan permasalahan terlebih dahulu melalui <strong>Musyawarah untuk Mufakat</strong> secara kekeluargaan.</li>
              <li>Jika musyawarah mufakat tidak tercapai dalam kurun waktu 30 (tiga puluh) hari kalender, maka sengketa akan diselesaikan melalui domisili hukum yurisdiksi <strong>Pengadilan Negeri Kota/Kabupaten Kediri</strong>.</li>
            </ul>
          </section>

          {/* 9. Kontak Saluran Resmi */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <HelpCircle className="text-blue-600" size={22} />
              <h2>9. Saluran Komunikasi Resmi</h2>
            </div>
            <p className="text-xs md:text-sm text-slate-600">
              Jika Anda memiliki pertanyaan, klarifikasi klausul, atau ingin mengajukan laporan mengenai ketentuan ini, silakan hubungi saluran resmi kami:
            </p>
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs md:text-sm text-slate-800 space-y-1.5">
              <p className="font-bold text-slate-900">Manajemen Operasional ATAYATOKO Kediri</p>
              <p>📍 Alamat: Jl. Pandan 98, Semen, Kediri, Jawa Timur, Indonesia</p>
              <p>📱 WhatsApp Resmi: <a href="https://wa.me/6285853161174" className="text-blue-700 font-bold underline" target="_blank" rel="noopener noreferrer">0858-5316-1174</a></p>
              <p>✉️ Email Dukungan: <a href="mailto:info@atayatoko.com" className="text-blue-700 font-bold underline">info@atayatoko.com</a></p>
              <p>🕒 Jam Layanan: Buka Setiap Hari (08:00 - 21:00 WIB)</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
