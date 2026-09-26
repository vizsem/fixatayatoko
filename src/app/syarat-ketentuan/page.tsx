import { Metadata } from 'next';
import Link from 'next/link';
import { FileText, ShoppingBag, Truck, AlertCircle, Scale, RefreshCw, ChevronLeft, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan (Terms of Service) | ATAYATOKO Sembako Kediri',
  description:
    'Syarat dan Ketentuan pembelian, harga grosir & eceran, pengiriman gratis ongkir wilayah Kediri, serta garansi retur di ATAYATOKO.',
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
              Ketentuan Layanan
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4">
            Syarat & Ketentuan
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl leading-relaxed">
            Harap membaca syarat dan ketentuan berikut sebelum melakukan pemesanan sembako grosir maupun eceran di website ATAYATOKO.
          </p>
          <p className="text-xs text-slate-400 mt-4 font-medium">
            Terakhir diperbarui: <span className="text-blue-400 font-bold">{lastUpdated}</span>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200/80 space-y-10 text-slate-700 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <ShoppingBag className="text-blue-600" size={22} />
              <h2>1. Ketentuan Pemesanan & Pembelian</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Dengan melakukan pemesanan di website ATAYATOKO, Anda menyetujui ketentuan berikut:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Akurasi Informasi:</strong> Pelanggan wajib mengisi nama, nomor WhatsApp aktif, dan alamat pengiriman dengan benar dan jelas.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Harga Grosir & Eceran:</strong> Harga eceran berlaku untuk pembelian satuan, sedangkan harga grosir otomatis aktif sesuai minimal pembelian tertentu.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Ketersediaan Stok:</strong> Stok produk diperbarui secara berkala. Jika terjadi stok habis mendadak pada barang pesanan Anda, admin kami akan segera mengonfirmasi alternatif atau pengembalian dana.</span>
              </li>
              <li className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs md:text-sm">
                <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" size={16} />
                <span><strong>Metode Pembayaran:</strong> Kami menerima pembayaran Transfer Bank, QRIS, dan Bayar di Tempat (COD) untuk wilayah jangkauan kurir kami.</span>
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <Truck className="text-blue-600" size={22} />
              <h2>2. Pengiriman & Wilayah Layanan (Gratis Ongkir)</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Layanan pengiriman sembako ATAYATOKO diatur dengan ketentuan:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li><strong>Gratis Ongkir:</strong> Berlaku untuk pengiriman wilayah Kediri Kota & sekitarnya sesuai syarat minimum belanja yang tertera pada saat checkout.</li>
              <li><strong>Jadwal Pengiriman:</strong> Pesanan yang masuk pada jam operasional (08:00 - 17:00) akan diproses untuk pengiriman di hari yang sama atau hari berikutnya (H+1).</li>
              <li><strong>Penerimaan Barang:</strong> Pastikan ada pihak yang menerima barang di alamat tujuan saat kurir kami tiba.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <RefreshCw className="text-blue-600" size={22} />
              <h2>3. Kebijakan Garansi & Retur Barang Rusak</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Kami menjamin kepuasan pelanggan dengan kebijakan retur sebagai berikut:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs md:text-sm text-slate-600 pl-2">
              <li>Jika produk diterima dalam keadaan rusak, kemasan bocor, kadaluarsa, atau tidak sesuai pesanan, laporkan kepada kurir atau melalui WhatsApp dalam waktu maksimal <strong>1 x 24 jam</strong> setelah barang diterima.</li>
              <li>Sertakan bukti foto atau video saat barang diterima.</li>
              <li>Barang pengganti akan kami kirimkan tanpa biaya tambahan atau dana akan dikembalikan sesuai nilai barang yang bermasalah.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <AlertCircle className="text-blue-600" size={22} />
              <h2>4. Pembatasan Tanggung Jawab & Hak Cipta</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              Seluruh logo, merek dagang ATAYATOKO, foto produk, tata letak, dan konten yang ada di website ini merupakan hak milik ATAYATOKO dan dilindungi oleh undang-undang hak cipta Republik Indonesia. Dilarang menggandakan materi web tanpa izin tertulis dari pihak pengelola.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-black text-lg md:text-xl">
              <FileText className="text-blue-600" size={22} />
              <h2>5. Perubahan Ketentuan</h2>
            </div>
            <p className="text-sm md:text-base text-slate-600">
              ATAYATOKO berhak mengubah atau memperbarui Syarat & Ketentuan ini sewaktu-waktu tanpa pemberitahuan sebelumnya. Perubahan akan langsung berlaku setelah diterbitkan pada halaman ini.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
