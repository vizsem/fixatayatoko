"use client";

import { useState, useEffect } from "react";
import { sbGetDoc } from '@/lib/supabase-helpers';

// ── KATEGORI & BIAYA ADMIN SHOPEE (Update Terbaru 2026) ────────
const KATEGORI = [
  { id:"snack_bakpia", label:"🍪 Snack, Bakpia & Roti Abon",   kat:"B", adminStar:9.0, adminMall:10.2, contoh:"Bakpia abon, roti, pia, biskuit, snack ringan" },
  { id:"fmcg",       label:"🍜 Makanan & FMCG Umum",         kat:"A", adminStar:10.0, adminMall:11.7, contoh:"Indomie, minuman instan, bahan kering" },
  { id:"sembako",    label:"🛒 Sembako & Kebutuhan Dapur",   kat:"A", adminStar:10.0, adminMall:11.7, contoh:"Beras, minyak, gula, tepung, bumbu" },
  { id:"fashion_w",  label:"👗 Fashion Wanita",              kat:"A", adminStar:10.0, adminMall:11.7, contoh:"Baju, dress, rok, blouse, gamis" },
  { id:"fashion_p",  label:"👕 Fashion Pria",                kat:"A", adminStar:10.0, adminMall:11.7, contoh:"Kaos, kemeja, celana, jaket" },
  { id:"fashion_m",  label:"🧕 Fashion Muslim",              kat:"A", adminStar:10.0, adminMall:11.7, contoh:"Gamis, hijab, sarung, koko" },
  { id:"kebersihan", label:"🧼 Kebersihan & Rumah Tangga",   kat:"A", adminStar:10.0, adminMall:11.7, contoh:"Pembersih, lampu, karpet, dekorasi" },
  { id:"olahraga",   label:"⚽ Olahraga & Outdoor",          kat:"A", adminStar:10.0, adminMall:11.7, contoh:"Alat olahraga, jersey, hobi, outdoor" },
  { id:"elektronik", label:"🔌 Elektronik & Aksesoris",     kat:"B", adminStar:9.5,  adminMall:10.45,contoh:"Kabel, charger, baterai, adaptor" },
  { id:"audio",      label:"🎮 Audio & Gaming",              kat:"B", adminStar:9.5,  adminMall:10.45,contoh:"Headset, speaker, konsol game" },
  { id:"skincare",   label:"💄 Skincare & Kecantikan",       kat:"B", adminStar:9.0,  adminMall:10.2, contoh:"Serum, moisturizer, sunscreen, makeup" },
  { id:"tas",        label:"👜 Tas & Dompet",                kat:"B", adminStar:9.0,  adminMall:10.2, contoh:"Tas wanita, tas pria, dompet" },
  { id:"jam",        label:"⌚ Jam Tangan",                  kat:"B", adminStar:9.0,  adminMall:10.2, contoh:"Jam tangan pria, wanita" },
  { id:"perawatan",  label:"🧴 Perawatan Diri & Tubuh",      kat:"B", adminStar:9.0,  adminMall:10.2, contoh:"Sampo, sabun mandi, deodoran" },
  { id:"popok",      label:"🍼 Popok & Perlengkapan Bayi",   kat:"B", adminStar:9.0,  adminMall:10.2, contoh:"Popok, tisu basah, botol susu" },
  { id:"fashion_b",  label:"👶 Fashion Bayi & Anak",         kat:"B", adminStar:9.0,  adminMall:10.2, contoh:"Baju bayi, sepatu anak, aksesoris" },
  { id:"susu",       label:"🥛 Susu Formula & Makanan Bayi", kat:"C", adminStar:6.75, adminMall:7.7,  contoh:"Susu formula, bubur bayi, MPASI" },
  { id:"suplemen",   label:"💊 Vitamin & Suplemen",          kat:"C", adminStar:6.5,  adminMall:7.2,  contoh:"Vitamin C, suplemen kesehatan" },
  { id:"baby_gear",  label:"🧸 Stroller & Perlengkapan Bayi",kat:"C", adminStar:6.75, adminMall:7.7,  contoh:"Stroller, car seat, mainan anak" },
  { id:"tv_ac",      label:"📺 Elektronik High-End",         kat:"D", adminStar:5.25, adminMall:4.7,  contoh:"TV, AC, kulkas, mesin cuci" },
  { id:"hp",         label:"📱 HP & Tablet",                 kat:"D", adminStar:5.25, adminMall:4.7,  contoh:"Smartphone, tablet" },
  { id:"laptop",     label:"💻 Laptop & Komputer",           kat:"D", adminStar:5.25, adminMall:5.2,  contoh:"Laptop, PC, monitor" },
  { id:"kamera",     label:"📷 Kamera & Drone",              kat:"D", adminStar:5.25, adminMall:5.2,  contoh:"Kamera mirrorless, drone" },
  { id:"logam",      label:"🥇 Logam Mulia & Perhiasan",    kat:"E", adminStar:4.25, adminMall:4.2,  contoh:"Emas batangan, perhiasan berharga" },
  { id:"emoney",     label:"🎫 E-Money & Voucher",           kat:"X", adminStar:2.5,  adminMall:2.5,  contoh:"ShopeePay, voucher, tiket" },
];

const KAT_COLOR = {
  A:"bg-red-100 text-red-700 border-red-300",
  B:"bg-orange-100 text-orange-700 border-orange-300",
  C:"bg-yellow-100 text-yellow-700 border-yellow-300",
  D:"bg-blue-100 text-blue-700 border-blue-300",
  E:"bg-green-100 text-green-700 border-green-300",
  X:"bg-purple-100 text-purple-700 border-purple-300",
};
const KAT_GROUPS = ["A","B","C","D","E","X"];
const KAT_LABEL = {
  A:"Kat A · Star 10% / Mall 11.7%",
  B:"Kat B · Star 9–9.5% / Mall 10.2–10.45%",
  C:"Kat C · Star 6.5–6.75% / Mall 7.2–7.7%",
  D:"Kat D · Star 5.25% / Mall 4.7–5.2%",
  E:"Kat E · Star 4.25% / Mall 4.2%",
  X:"Khusus · 2.5%",
};

// Estimasi tarif Gratis Ongkir XTRA per kategori & ukuran paket
// Pada bukti settlement Shopee riil, subkategori makanan/snack & kategori E kena 6.0% (maks Rp40.000)
function getOngkirPct(k: string, isBigPackage = false): { pct: number; cap: number } {
  if (isBigPackage) {
    const ratesBig = { A: 8.0, B: 7.0, C: 6.0, D: 4.5, E: 3.0 } as const;
    return { pct: ratesBig[k as keyof typeof ratesBig] || 6.0, cap: 60000 };
  }
  const ratesRegular = { A: 6.0, B: 6.0, C: 4.0, D: 3.0, E: 2.0 } as const;
  return { pct: ratesRegular[k as keyof typeof ratesRegular] || 6.0, cap: 40000 };
}

// ── SEMUA PROGRAM BIAYA SHOPEE TERBARU ────────────────────────
const ALL_PROGRAMS = [
  {
    id:"proses", label:"Biaya Proses Pesanan",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tarif:"Rp1.250 flat per pesanan terselesaikan",
    catatan:"Berlaku untuk seluruh tipe penjual (Non-Star, Star, Star+, Mall).",
    flat:1250, wajib:true, color:"gray"
  },
  {
    id:"mall_service", label:"Biaya Layanan Shopee Mall",
    badge:"Khusus Mall", badgeCls:"bg-purple-100 text-purple-700",
    tarif:"1.8% dari harga netto (maks Rp50.000 / item)",
    catatan:"Khusus toko berstatus Shopee Mall / Official Store.",
    pct:1.8, maxFlat:50000, wajib:false, color:"purple"
  },
  {
    id:"ongkir", label:"Gratis Ongkir XTRA",
    badge:"Sangat Disarankan", badgeCls:"bg-green-100 text-green-700",
    tarif:"1.5%–5.5% (biasa, cap Rp40rb) atau s/d 8.0% (paket besar, cap Rp60rb)",
    catatan:"Badge Gratis Ongkir terbukti meningkatkan traffic & filter pembeli hingga 3x lipat.",
    isPct:true, wajib:false, color:"green"
  },
  {
    id:"promo_xtra", label:"Biaya Layanan Promo XTRA",
    badge:"Opsional", badgeCls:"bg-blue-100 text-blue-700",
    tarif:"4.5% dari harga produk (maks Rp60.000 / item)",
    catatan:"Memberikan voucher cashback koin Shopee ekstra untuk pembeli produk tokomu.",
    pct:4.5, maxFlat:60000, wajib:false, color:"blue"
  },
  {
    id:"pph22", label:"Pajak Penghasilan (PPh 22 e-Commerce)",
    badge:"Pajak PMK", badgeCls:"bg-yellow-100 text-yellow-800",
    tarif:"0.5% dari harga produk",
    catatan:"Dipotong langsung oleh Shopee sebagai pemungut pajak PPh 22 e-commerce sesuai peraturan perpajakan.",
    pct:0.5, wajib:false, color:"yellow"
  },
  {
    id:"live_video", label:"Shopee Live & Shopee Video XTRA",
    badge:"Populer", badgeCls:"bg-rose-100 text-rose-700",
    tarif:"~3% (atau diskon 2% jika ikut Promo XTRA)",
    catatan:"Transaksi via keranjang oranye Shopee Live & Video. Diskon komisi jika toko sudah gabung Promo XTRA.",
    pct:3, wajib:false, color:"rose"
  },
  {
    id:"spaylater_3", label:"SPayLater XTRA 0% (Tenor 3 Bulan)",
    badge:"Opsional", badgeCls:"bg-indigo-100 text-indigo-700",
    tarif:"2.5% dari harga netto",
    catatan:"Ditanggung seller saat pembeli checkout dengan cicilan SPayLater 0% tenor 3 bulan.",
    pct:2.5, wajib:false, color:"indigo"
  },
  {
    id:"spaylater_6", label:"SPayLater XTRA 0% (Tenor 6 Bulan)",
    badge:"Opsional", badgeCls:"bg-indigo-100 text-indigo-700",
    tarif:"4.0% dari harga netto",
    catatan:"Ditanggung seller saat pembeli checkout dengan cicilan SPayLater 0% tenor 6 bulan.",
    pct:4.0, wajib:false, color:"indigo"
  },
  {
    id:"preorder", label:"Biaya Layanan Pre-Order",
    badge:"Opsional", badgeCls:"bg-orange-100 text-orange-700",
    tarif:"3.0% per kuantitas terjual",
    catatan:"Dikecualikan untuk produk custom/kerajinan atau penjualan via Shopee Live.",
    pct:3.0, wajib:false, color:"orange"
  },
  {
    id:"affiliate", label:"Shopee Affiliate Program",
    badge:"Opsional", badgeCls:"bg-pink-100 text-pink-700",
    tarif:"Komisi seller (5–20%) + PPN 11%",
    catatan:"Seller bayar komisi ke Shopee jika ada transaksi via link afiliasi. Biaya komisi belum termasuk PPN 11%.",
    isPctRange:true, minPct:5, maxPct:20, defaultPct:8, wajib:false, color:"pink"
  },
  {
    id:"ads", label:"Iklan Shopee (Shopee Ads)",
    badge:"Opsional", badgeCls:"bg-red-100 text-red-700",
    tarif:"Estimasi ~3%–5% dari nilai penjualan",
    catatan:"Iklan pencarian kata kunci dan produk serupa. Rekomendasikan jika margin kotor >20%.",
    pct:3.0, wajib:false, color:"red"
  },
  {
    id:"cod", label:"Biaya Layanan COD (Bayar di Tempat)",
    badge:"Jika Aktif", badgeCls:"bg-yellow-100 text-yellow-700",
    tarif:"~2% dari nilai transaksi COD",
    catatan:"Dikenakan jika pembeli memilih pembayaran COD di tempat.",
    pct:2.0, wajib:false, color:"yellow"
  },
];

// ── DIREKTORI LENGKAP JENIS CAMPAIGN & PROMOSI SHOPEE ─────────
const CAMPAIGN_SHOPEE = [
  {
    id: "mega_shopee",
    icon: "🔥",
    nama: "Mega Campaign (Tanggal Kembar & Akhir Tahun)",
    kategori: "Platform Campaign",
    badge: "Traffic Masif",
    badgeCls: "bg-red-500/20 text-red-700 border-red-300",
    jadwal: "9.9 Super Shopping Day, 10.10, 11.11 Big Sale, 12.12 Birthday Sale, Big Ramadan Sale",
    diskonMin: "Diskon 10% - 30% dari harga terendah 30 hari",
    manfaat: "Banner beranda utama, voucher cashback & gratis ongkir ekstra dari Shopee, eksposur 5x-10x hari normal.",
    kriteria: "Poin penalti <3, respons chat ≥85%, stok aman, siap kirim <24 jam.",
    tipsCuan: "Hitung harga BEP diskon campaign sebelum daftar. Alokasikan stok khusus produk terlaris.",
    color: "from-red-500 to-rose-600",
  },
  {
    id: "payday_shopee",
    icon: "💳",
    nama: "Pesta Gajian Shopee (Payday Sale)",
    kategori: "Platform Campaign",
    badge: "Konversi Tinggi",
    badgeCls: "bg-blue-500/20 text-blue-700 border-blue-300",
    jadwal: "Setiap tanggal 25 s/d 27 akhir bulan",
    diskonMin: "Diskon 5% - 15% atau voucher toko minimal belanja tertentu",
    manfaat: "Menangkap puncak daya beli gaji bulanan. Traffic belanja sangat responsif.",
    kriteria: "Semua Star Seller & Mall yang tidak terkena pembatasan akun.",
    tipsCuan: "Lakukan Shopee Live streaming maraton di tanggal 25-26 dengan flash sale toko.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "super_brand_day",
    icon: "👑",
    nama: "Super Brand Day (SBD) / Brand Festival",
    kategori: "Platform Campaign",
    badge: "Eksklusif Mall",
    badgeCls: "bg-purple-500/20 text-purple-700 border-purple-300",
    jadwal: "Event 24 jam khusus brand terpilih sesuai kalender promosi",
    diskonMin: "Eksklusif launching produk baru / diskon hingga 50%",
    manfaat: "Pengambilalihan penuh (takeover) halaman beranda Shopee selama 24 jam penuh.",
    kriteria: "Khusus toko berstatus Shopee Mall / Official Store dengan komitmen GMV tinggi.",
    tipsCuan: "Siapkan bundle eksklusif kemasan khusus agar menaikkan nilai keranjang belanja (AOV).",
    color: "from-purple-500 to-pink-600",
  },
  {
    id: "flash_sale_shopee",
    icon: "⚡",
    nama: "Flash Sale Shopee (Slot Beranda Resmi)",
    kategori: "Platform Kurasi",
    badge: "Slot Terbatas",
    badgeCls: "bg-amber-500/20 text-amber-700 border-amber-300",
    jadwal: "Sesi waktu harian (00.00, 12.00, 18.00, 20.00 WIB)",
    diskonMin: "Diskon dalam (20% - 50%) dan harga terendah dalam 30 hari",
    manfaat: "Produk tampil di widget Flash Sale beranda Shopee. Ratusan pesanan dalam hitungan menit.",
    kriteria: "Produk dikurasi atau dinominasikan oleh tim kategori Shopee. Stok wajib dikunci.",
    tipsCuan: "Gunakan untuk produk penetrasi pasar atau cuci gudang perputaran modal cepat.",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "flash_sale_toko",
    icon: "⏱️",
    nama: "Flash Sale Toko Saya (Mandiri)",
    kategori: "Fitur Promosi Toko",
    badge: "Paling Fleksibel",
    badgeCls: "bg-yellow-500/20 text-yellow-700 border-yellow-300",
    jadwal: "Dibuat sendiri oleh seller via Seller Centre (durasi 1 - 24 jam)",
    diskonMin: "Bebas ditentukan seller dengan batasan kuota stok",
    manfaat: "Timer hitung mundur visual langsung di halaman produk. Memicu urgensi checkout.",
    kriteria: "Tersedia untuk semua seller aktif. Tidak perlu persetujuan tim Shopee.",
    tipsCuan: "Pasang di jam ramai (12.00 - 13.00 & 19.30 - 21.00) dengan kuota terbatas (cth: 25 unit).",
    color: "from-yellow-500 to-amber-600",
  },
  {
    id: "live_video_deals",
    icon: "🎥",
    nama: "Shopee Live & Shopee Video Deals",
    kategori: "Live & Content Shopping",
    badge: "Voucher Diskon 50%",
    badgeCls: "bg-rose-500/20 text-rose-700 border-rose-300",
    jadwal: "Setiap sesi live streaming & etalase Shopee Video",
    diskonMin: "Harga eksklusif live atau voucher diskon s/d 50% dari Shopee",
    manfaat: "Voucher subsidi besar dari Shopee untuk penonton Live. Konversi 3x lipat dibanding etalase biasa.",
    kriteria: "Cukup sematkan produk ke etalase keranjang oranye saat sesi live streaming.",
    tipsCuan: "Gunakan LiveXtra untuk mendapat subsidi voucher diskon live lebih melimpah dari Shopee.",
    color: "from-rose-500 to-pink-600",
  },
  {
    id: "voucher_toko",
    icon: "🎟️",
    nama: "Voucher Toko Saya & Voucher Ikuti Toko",
    kategori: "Retensi Pelanggan",
    badge: "Wajib Aktif",
    badgeCls: "bg-emerald-500/20 text-emerald-700 border-emerald-300",
    jadwal: "Aktif 24/7 di profil toko, halaman produk, dan chat",
    diskonMin: "Nominal potongan (cth: Rp5.000 min. Rp50rb) atau % koin cashback",
    manfaat: "Voucher Ikuti Toko mengunci penonton jadi pengikut setia; Voucher toko mendorong repeat order.",
    kriteria: "Bisa diatur publik (tampil di toko) atau voucher privat khusus klaim chat/live.",
    tipsCuan: "Set syarat minimum belanja sedikit di atas rata-rata harga produk agar pembeli tambah barang.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "paket_diskon",
    icon: "📦",
    nama: "Paket Diskon & Kombo Hemat (Bundling)",
    kategori: "Strategi Margin",
    badge: "Hemat Biaya Proses",
    badgeCls: "bg-cyan-500/20 text-cyan-700 border-cyan-300",
    jadwal: "Diatur via Promosi Saya > Paket Diskon / Kombo Hemat",
    diskonMin: "Beli 2 Diskon 5%, Beli 3 Diskon 10%, atau Beli Produk A Dapat Diskon Produk B",
    manfaat: "Biaya proses Rp1.250 dan bubble/kardus packing hanya dihitung 1x untuk 2-3 produk!",
    kriteria: "Cocok untuk produk FMCG, sembako, busana, kosmetik, dan barang komplementer.",
    tipsCuan: "Jual produk margin tebal sebagai pelengkap dari produk margin tipis untuk mengangkat profit.",
    color: "from-cyan-500 to-blue-600",
  },
  {
    id: "gwp_shopee",
    icon: "🎁",
    nama: "Hadiah Gratis (Gift with Purchase - GWP)",
    kategori: "Perlindungan Harga",
    badge: "Tanpa Rusak Harga",
    badgeCls: "bg-fuchsia-500/20 text-fuchsia-700 border-fuchsia-300",
    jadwal: "Event peluncuran atau periode campaign",
    diskonMin: "Bukan potongan harga tunai, melainkan bonus sample atau pouch/merchandise",
    manfaat: "Harga produk tetap terjaga tanpa merusak pasaran, pembeli merasa mendapatkan nilai lebih.",
    kriteria: "Hadiah disetting di menu Promosi Saya > Hadiah Gratis di Seller Centre.",
    tipsCuan: "Gunakan sampel produk varian lain untuk mengenalkan produk baru Anda ke pembeli.",
    color: "from-fuchsia-500 to-pink-600",
  },
];

const INIT_OPS = [
  {id:"lakban",  label:"🏷️ Lakban",         nominal:500},
  {id:"termal",  label:"🧾 Kertas Termal",   nominal:200},
  {id:"bubble",  label:"🫧 Bubble Wrap",     nominal:500},
  {id:"kardus",  label:"📦 Kardus/Plastik",  nominal:1500},
  {id:"krywn",   label:"👷 Upah Karyawan",   nominal:2000},
  {id:"listrik", label:"💡 Listrik & WiFi",  nominal:200},
];

const formatRp = (n: number): string => "Rp" + Math.round(n).toLocaleString("id-ID");

function NominalInput({value,onChange}:{value:number;onChange:(val:number)=>void}){
  return(
    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">
      <span className="text-gray-400 text-xs">Rp</span>
      <input type="number" value={value} onChange={e=>onChange(Number(e.target.value))}
        className="w-16 bg-transparent text-gray-700 text-xs font-bold outline-none text-right"/>
    </div>
  );
}

// ── STRATEGI BISNIS SHOPEE ───────────────────────────────────
const STRATEGI = [
  { id:"campaign_shopee", icon:"🎪", title:"Eksekusi Campaign Shopee", color:"from-red-500 to-orange-500", tips:[
    {sub:"Nominasi Produk Awal Waktu", desc:"Pendaftaran campaign tanggal kembar Shopee (Double Date) dibuka H-30 hingga H-14. Segera cek menu 'Promosi Saya > Kampanye' dan ajukan produk sebelum kuota slot habis."},
    {sub:"Dasar Hitung Komisi Netto", desc:"Ingat! Biaya admin Shopee dihitung dari Harga Produk dikurangi Diskon Penjual. Ikut diskon campaign otomatis menurunkan nominal potongan admin Shopee."},
    {sub:"Kunci Stok Campaign", desc:"Stok yang didaftarkan ke Flash Sale resmi Shopee akan dikunci otomatis. Pastikan stok fisik benar-benar ada di gudang agar tidak terkena penalti poin keterlambatan/pembatalan."},
    {sub:"Push via Shopee Live", desc:"Selama hari H campaign, jalankan sesi Shopee Live berdurasi panjang (minimal 2-4 jam). Bagikan voucher koin Shopee Live untuk menarik penonton ke keranjang oranye."},
  ]},
  { id:"listing", icon:"📸", title:"Optimasi Listing", color:"from-orange-400 to-amber-400", tips:[
    {sub:"Judul SEO", desc:"Gunakan kata kunci spesifik: merek + nama produk + spesifikasi. Contoh: 'Indomie Goreng Original 40 Bungkus 1 Dus'. Bantu produk muncul di pencarian organik."},
    {sub:"Foto Produk 5+", desc:"Min. 5 foto: tampak depan, belakang, detail, berat/ukuran, dan lifestyle. Resolusi min. 500×500px. Foto buram = pembeli langsung scroll."},
    {sub:"Deskripsi Lengkap", desc:"Cantumkan: berat bersih, isi per paket, tanggal kadaluarsa, cara penyimpanan, dan FAQ. Makin lengkap, makin sedikit pertanyaan masuk = hemat waktu."},
    {sub:"Variasi dalam 1 Listing", desc:"Buat semua varian (satuan, paket 5, 1 dus) dalam satu listing. Semua ulasan terkumpul jadi satu — toko terlihat lebih berpengalaman lebih cepat."},
  ]},
  { id:"harga", icon:"💰", title:"Strategi Harga", color:"from-green-400 to-teal-400", tips:[
    {sub:"Rumus Harga Jual yang Benar", desc:"Harga Jual = (HPP + Target Profit) ÷ (1 – % Total Potongan). JANGAN sekadar HPP + profit. Biaya Shopee dihitung dari harga jual akhir, bukan dari HPP."},
    {sub:"Harga Psikologis", desc:"Gunakan Rp9.900 bukan Rp10.000. Rp29.500 bukan Rp30.000. Di mata pembeli angka ini terasa jauh lebih murah walaupun selisihnya hanya ratusan rupiah."},
    {sub:"Bundling Paket Hemat", desc:"Jual paket 5/10/40 pcs dengan harga per unit lebih murah dari satuan. Meningkatkan nilai pesanan rata-rata — biaya proses Rp1.250/pesanan jadi lebih efisien."},
    {sub:"Pantau Kompetitor Mingguan", desc:"Cek harga top seller di kategorimu setiap Senin. Jangan perang harga — bedakan di layanan, packaging, dan kecepatan pengiriman."},
  ]},
  { id:"promo", icon:"🎯", title:"Program Promosi Shopee", color:"from-red-400 to-pink-400", tips:[
    {sub:"Flash Sale Toko", desc:"Jadwalkan flash sale jam 12.00 & 20.00 (jam ramai). Batasi kuota agar stok tidak habis sekaligus. Buat urgency: 'Stok tinggal 5!'"},
    {sub:"Voucher Toko Strategis", desc:"Buat voucher cashback Rp5.000 min. belanja Rp50.000 untuk mendorong repeat order. Voucher follower toko untuk mempertahankan pembeli lama."},
    {sub:"Double Date Campaign", desc:"Daftar produk ke campaign 9.9, 10.10, 11.11, 12.12 jauh sebelumnya. Siapkan stok ekstra. Penjualan bisa naik 3–5× dari hari normal."},
    {sub:"Gratis Ongkir XTRA", desc:"Wajib diaktifkan! Badge gratis ongkir meningkatkan CTR 2–3×. Kalkulasi biaya 5.5% (Kat A) ke dalam harga jual agar tidak memangkas margin."},
  ]},
  { id:"affiliate", icon:"🤝", title:"Shopee Affiliate Program", color:"from-pink-400 to-rose-500", tips:[
    {sub:"Cara Kerja (Sisi Seller)", desc:"Seller set komisi per produk (5–20%). Kreator/affiliator promosi via link unik. Jika terjadi transaksi, seller bayar komisi ke Shopee, lalu Shopee teruskan ke affiliator. Biaya BELUM termasuk PPN."},
    {sub:"Set Komisi yang Tepat", desc:"Terlalu rendah (<5%) = kreator tidak tertarik promosi produkmu. Terlalu tinggi (>15%) = margin habis. Uji coba 8–10% untuk kategori FMCG/sembako dulu, pantau konversinya."},
    {sub:"Aktifkan untuk Produk Margin Tebal", desc:"Jangan aktifkan affiliate untuk produk dengan margin tipis. Produk dengan margin >25% adalah kandidat ideal. Affiliate cocok untuk scale volume, bukan produk merugi."},
    {sub:"Pantau via Dashboard Affiliate", desc:"Cek dashboard seller: lihat kreator mana yang paling banyak hasilkan transaksi. Hubungi kreator terbaik untuk kolaborasi langsung (Target Collaboration) dengan komisi lebih tinggi."},
  ]},
  { id:"live", icon:"🎥", title:"Shopee Live", color:"from-pink-500 to-rose-400", tips:[
    {sub:"Jadwal Konsisten Prime Time", desc:"Live minimal 3× seminggu. Jam terbaik: 11.00–13.00 & 19.30–22.00. Konsistensi jadwal membangun penonton setia yang notifikasi setiap kamu live."},
    {sub:"Flash Deal Eksklusif Live", desc:"Tawarkan harga yang hanya berlaku saat live: 'Harga ini cuma 30 menit!' Tampilkan countdown timer dan stok real-time. Konversi live bisa 3–5× lebih tinggi dari listing biasa."},
    {sub:"Produk Live Bebas Biaya PO", desc:"Produk yang terjual via Shopee Live dikecualikan dari biaya layanan Pre-Order. Manfaatkan ini untuk jual produk PO tanpa tambahan biaya 3%."},
    {sub:"LiveXtra Ads untuk Boost", desc:"Aktifkan LiveXtra Ads untuk perluas jangkauan siaran. Biaya ~2–5% tergantung paket. Gunakan hanya saat stok cukup dan produk terbukti convert."},
  ]},
  { id:"ads", icon:"📢", title:"Shopee Ads", color:"from-blue-400 to-indigo-400", tips:[
    {sub:"Mulai Kecil, Pantau ROAS", desc:"Test Rp20.000–50.000/hari per produk unggulan. Hentikan iklan jika ROAS di bawah 3× dalam 7 hari. Scale up ke produk yang terbukti profitable."},
    {sub:"Kata Kunci Long-Tail", desc:"Target 'indomie goreng 1 dus murah' bukan sekadar 'indomie'. Kata kunci spesifik lebih murah dan konversinya lebih tinggi karena niat beli lebih jelas."},
    {sub:"Iklan Produk Terbukti", desc:"Pasang ads hanya untuk produk dengan rating ≥4.5, ulasan ≥20, dan konversi organik positif. Jangan buang budget di produk yang secara organik belum terbukti."},
    {sub:"Gabungkan dengan Promo", desc:"Aktifkan Shopee Ads bersamaan dengan voucher toko atau flash sale. Iklan membawa traffic, promo menutup deal. Kombinasi ini terbukti meningkatkan konversi secara signifikan."},
  ]},
  { id:"performa", icon:"⭐", title:"Performa & Star Seller", color:"from-yellow-400 to-orange-400", tips:[
    {sub:"5 Metrik Kunci", desc:"Pantau mingguan: (1) Tingkat respons chat, (2) Kecepatan proses pesanan, (3) Fulfillment rate, (4) Rating produk, (5) Jumlah ulasan bintang 5. Semua ini pengaruhi visibilitas organik."},
    {sub:"Respons Chat <1 Jam", desc:"Aktifkan notifikasi HP dan buat quick replies untuk pertanyaan umum (harga, stok, ongkir). Seller respons cepat dapat badge 'Respon Cepat' = lebih dipercaya pembeli."},
    {sub:"Syarat Star Seller", desc:"Respons ≥85% · Penjualan ≥25/bulan · Rating ≥4.5 · Fulfillment rate ≥95%. Status Star Seller meningkatkan kepercayaan dan visibilitas produk di halaman pencarian."},
    {sub:"Kelola Ulasan Negatif", desc:"Respons setiap ulasan negatif dengan solusi konkret dan profesional. Satu respons baik di ulasan negatif justru meningkatkan kepercayaan calon pembeli baru yang membacanya."},
  ]},
  { id:"growth", icon:"🚀", title:"Strategi Pertumbuhan", color:"from-violet-400 to-purple-500", tips:[
    {sub:"Target per Fase", desc:"Bln 1–2: 5–20 order/bulan. Bln 3–6: 50–100 order. Bln 7–12: 200–500 order. Kuasai 1 produk dulu sampai 100+ order/bulan sebelum expand SKU baru."},
    {sub:"Analisis Data Mingguan", desc:"Gunakan Shopee Seller Analytics: produk terlaris, sumber traffic organik vs ads, jam transaksi terbanyak, dan rasio klik→beli. Evaluasi setiap Senin pagi."},
    {sub:"Repeat Customer Program", desc:"Gunakan voucher khusus followers + Follow Prize. Mempertahankan pembeli lama 5× lebih murah dari mencari pembeli baru. Target 30%+ penjualan dari repeat customer."},
    {sub:"Ramadan & Harbolnas", desc:"Persiapkan stok, konten, dan promo 2 minggu sebelum Ramadan & double date. Penjualan bisa naik 3–5×. Daftarkan produk ke campaign Shopee jauh sebelum periode campaign dimulai."},
  ]},
];

export default function App() {
  const [isMall, setIsMall] = useState(false); // Star / Star+ vs Shopee Mall
  const [isBigPackage, setIsBigPackage] = useState(false); // Paket Biasa (<5kg) vs Paket Besar (≥5kg)
  const [kat, setKat] = useState(KATEGORI[1]); // Default sembako
  const [showKat, setShowKat] = useState(false);
  const [hargaBeli, setHargaBeli] = useState(2900);
  const [hargaJual, setHargaJual] = useState(5000);
  const [ops, setOps] = useState(INIT_OPS);
  const [mainTab, setMainTab] = useState("kalkulator");
  const [strTab, setStrTab] = useState("campaign_shopee");

  // Simulasi Diskon Campaign Seller
  const [ikutPromo, setIkutPromo] = useState(false);
  const [diskonType, setDiskonType] = useState<"pct"|"nominal">("pct");
  const [diskonVal, setDiskonVal] = useState(10); // misal diskon 10%

  // Toggle program (disesuaikan dengan default toko aktif: Ongkir Xtra + Promo Xtra + PPh 22)
  const [active, setActive] = useState<Record<string, boolean>>({
    proses: true,
    mall_service: false,
    ongkir: true, // 6% (Gratis Ongkir Xtra)
    promo_xtra: true, // 4.5% (Promo Xtra)
    pph22: true, // 0.5% (PPh 22)
    live_video: false,
    spaylater_3: false,
    spaylater_6: false,
    preorder: false,
    affiliate: false,
    ads: false,
    cod: false,
  });

  const [affiliatePct, setAffiliatePct] = useState(8);
  const [livePct, setLivePct] = useState(3);

  // Jika status Mall diaktifkan, aktifkan mall_service
  useEffect(() => {
    setActive(prev => ({ ...prev, mall_service: isMall }));
  }, [isMall]);

  const totalOps = ops.reduce((s,o)=>s+o.nominal,0);

  // Diskon Seller
  const diskonSellerNominal = !ikutPromo
    ? 0
    : diskonType === "pct"
      ? (diskonVal / 100) * hargaJual
      : Math.min(diskonVal, hargaJual);

  // Harga Bersih setelah Diskon Penjual (Dasar Perhitungan Admin & Layanan Shopee)
  const hargaSetelahDiskon = Math.max(0, hargaJual - diskonSellerNominal);

  // Tarif Admin Kategori (Star vs Mall)
  const tarifAdminPct = isMall ? kat.adminMall : kat.adminStar;
  const adminNom = Math.round((tarifAdminPct / 100) * hargaSetelahDiskon);

  // Hitung semua potongan platform Shopee dengan pembulatan presisi
  let totalPlatform = adminNom;
  const detailPlat: Array<{ label: string; nom: number; wajib?: boolean }> = [
    { label: `Biaya Administrasi ${isMall ? "Shopee Mall" : "Star Seller"} Kat.${kat.kat} (${tarifAdminPct}%)`, nom: adminNom, wajib: true }
  ];

  ALL_PROGRAMS.forEach(p => {
    if (!active[p.id]) return;
    let nom = 0;
    if (p.flat) {
      nom = p.flat;
    } else if (p.id === "ongkir") {
      const { pct, cap } = getOngkirPct(kat.kat, isBigPackage);
      nom = Math.round(Math.min((pct / 100) * hargaSetelahDiskon, cap));
    } else if (p.id === "mall_service") {
      nom = isMall ? Math.round(Math.min((1.8 / 100) * hargaSetelahDiskon, 50000)) : 0;
    } else if (p.id === "promo_xtra") {
      nom = Math.round(Math.min(((p.pct || 0) / 100) * hargaSetelahDiskon, p.maxFlat || 60000));
    } else if (p.id === "pph22") {
      nom = Math.round(((p.pct || 0.5) / 100) * hargaSetelahDiskon);
    } else if (p.id === "affiliate") {
      nom = Math.round((affiliatePct / 100) * hargaSetelahDiskon * 1.11); // Komisi + PPN 11%
    } else if (p.id === "live_video") {
      const rate = active.promo_xtra ? 2.0 : livePct; // Diskon 2% jika toko ikut Promo XTRA
      nom = Math.round((rate / 100) * hargaSetelahDiskon);
    } else if (p.pct) {
      nom = Math.round((p.pct / 100) * hargaSetelahDiskon);
    }

    if (nom > 0 || p.wajib) {
      totalPlatform += nom;
      detailPlat.push({
        label: p.id === "ongkir"
          ? `Biaya Gratis Ongkir XTRA (~${getOngkirPct(kat.kat, isBigPackage).pct}%)`
          : p.id === "affiliate"
            ? `${p.label} (${affiliatePct}% + PPN 11%)`
            : p.id === "live_video"
              ? `${p.label} (~${active.promo_xtra ? 2 : livePct}%)`
              : p.id === "mall_service"
                ? `Biaya Layanan Mall (1.8%, cap Rp50rb)`
                : p.flat ? p.label : `${p.label} (${p.pct}%)`,
        nom,
        wajib: p.wajib || false
      });
    }
  });

  // Penghasilan Masuk Saldo Shopee (persis seperti laporan Shopee)
  const penghasilanShopee = hargaSetelahDiskon - totalPlatform;

  // Laba Bersih Toko (setelah modal HPP dan biaya packing/ops)
  const cuan = penghasilanShopee - hargaBeli - totalOps;
  const marginPct = hargaSetelahDiskon > 0 ? (cuan / hargaSetelahDiskon) * 100 : 0;
  const roiPct = (hargaBeli + totalOps) > 0 ? (cuan / (hargaBeli + totalOps)) * 100 : 0;
  const potPct = hargaSetelahDiskon > 0 ? ((totalPlatform + totalOps) / hargaSetelahDiskon) * 100 : 0;

  // Kalkulasi target harga jual ideal
  function calcH(tm=0){
    const base = hargaBeli + totalOps;
    for(let h = base; h <= 10_000_000; h += 10){
      const disc = !ikutPromo ? 0 : (diskonType === "pct" ? (diskonVal/100)*h : diskonVal);
      const hClean = Math.max(0, h - disc);
      let pot = (tarifAdminPct / 100) * hClean;
      ALL_PROGRAMS.forEach(p => {
        if (!active[p.id]) return;
        if (p.flat) pot += p.flat;
        else if (p.id === "ongkir") {
          const { pct, cap } = getOngkirPct(kat.kat, isBigPackage);
          pot += Math.min((pct / 100) * hClean, cap);
        } else if (p.id === "mall_service") {
          if (isMall) pot += Math.min((1.8 / 100) * hClean, 50000);
        } else if (p.id === "promo_xtra") {
          pot += Math.min(((p.pct || 0) / 100) * hClean, p.maxFlat || 60000);
        } else if (p.id === "affiliate") {
          pot += (affiliatePct / 100) * hClean * 1.11;
        } else if (p.id === "live_video") {
          const rate = active.promo_xtra ? 2.0 : livePct;
          pot += (rate / 100) * hClean;
        } else if (p.pct) {
          pot += (p.pct / 100) * hClean;
        }
      });
      const c = hClean - pot - base;
      if (hClean > 0 && (c / hClean) * 100 >= tm) return Math.ceil(h / 100) * 100;
    }
    return base;
  }
  const bep = calcH(0), h20 = calcH(20), h30 = calcH(30);

  const status = cuan > 0
    ? {label:"✅ UNTUNG", cls:"text-green-700 bg-green-50 border-green-300"}
    : cuan === 0
      ? {label:"⚠️ IMPAS", cls:"text-yellow-700 bg-yellow-50 border-yellow-300"}
      : {label:"❌ RUGI", cls:"text-red-700 bg-red-50 border-red-300"};

  const activeStr = STRATEGI.find(s=>s.id===strTab);
  const strIdx = STRATEGI.findIndex(s=>s.id===strTab);

  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  useEffect(() => {
    const fetchAiPrompt = async () => {
      try {
        const snap = await sbGetDoc('settings', "system");
        if (snap.exists()) {
          const data = snap.data();
          if (data.store?.aiPromptShopee) {
            setAiPrompt(data.store.aiPromptShopee);
          }
        }
      } catch (err) {
        console.error("Failed to load AI Prompt Shopee", err);
      }
    };
    fetchAiPrompt();
  }, []);
  
  // Rekomendasi AI Shopee
  const getAiStrategy = () => {
    let margin = (cuan / hargaSetelahDiskon) * 100;
    let saran = [];
    
    if (ikutPromo) {
      saran.push(`🎯 Simulasi Campaign Aktif: Diskon penjual ${diskonType==="pct"?`${diskonVal}%`:formatRp(diskonVal)}. Mengurangi dasar pemotongan admin Shopee.`);
    }

    if (margin < 10) {
      saran.push("🔴 Margin Tipis (<10%). Jangan paksakan ikut Promo XTRA (Cashback Koin) atau flash sale berat dulu. Fokus optimasi judul SEO, variasi, dan paket bundling!");
    } else if (margin >= 10 && margin <= 25) {
      saran.push("🟡 Margin Sehat (10-25%). Waktunya scale-up! Wajib ikut Gratis Ongkir XTRA karena mayoritas pembeli Shopee memfilter toko berdasarkan Gratis Ongkir.");
    } else {
      saran.push("🟢 Margin Tebal (>25%). Sangat aman aktifkan Shopee Live XTRA dan Shopee Affiliate (8-12%) untuk mendatangkan traffic masif lewat kreator.");
    }

    if (isMall) {
      saran.push("👑 Shopee Mall: Anda memiliki badge kepercayaan tertinggi dan prioritas di hasil pencarian. Manfaatkan Super Brand Day dan voucher toko.");
    }

    if (aiPrompt) {
      aiPrompt.split("\n").filter(Boolean).forEach(p => saran.push(p));
    }

    return saran;
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 min-h-screen text-gray-800" style={{fontFamily:"system-ui,sans-serif"}}>

      {/* HEADER SHOPEE MODERN */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 p-6 lg:p-8 text-white shadow-2xl rounded-b-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
            <div className="bg-white rounded-3xl p-3 shadow-2xl border border-white/30 flex items-center justify-center w-16 h-16 flex-shrink-0">
              <svg width="44" height="44" viewBox="0 0 100 100" className="drop-shadow-md">
                <circle cx="50" cy="50" r="48" fill="#EE4D2D"/>
                <text x="50" y="68" textAnchor="middle" fontSize="48" fill="white" fontWeight="bold">S</text>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl lg:text-3xl font-black text-white leading-tight">
                  Kalkulator Cuan & Campaign Shopee 2026
                </h1>
                <span className="bg-white/20 backdrop-blur border border-white/30 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Update Terbaru
                </span>
              </div>
              <p className="text-orange-100 text-sm font-medium opacity-90">
                Skema Star Seller & Shopee Mall · Biaya Proses Rp1.250 · Cap Gratis Ongkir Rp40rb/Rp60rb · Direktori Campaign
              </p>

              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <span className="bg-white/20 border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Admin Star 4.25% - 10.0%
                </span>
                <span className="bg-white/20 border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Admin Mall 4.2% - 11.7%
                </span>
                <button
                  onClick={() => {
                    setKat(KATEGORI[0]); // Snack, Bakpia & Roti Abon (Kat B - Admin 9.0%)
                    setHargaJual(14890);
                    setHargaBeli(7000);
                    setActive(prev => ({ ...prev, ongkir: true, promo_xtra: true, pph22: true }));
                  }}
                  className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-extrabold px-3 py-1 rounded-full text-xs transition-all shadow-md flex items-center gap-1"
                >
                  🍪 Uji Kasus Nyata: Bakpia Rp14.890 → Hasil Rp10.663
                </button>
                <button onClick={() => setShowAi(!showAi)} className="bg-black/20 hover:bg-black/30 backdrop-blur border border-white/30 px-3.5 py-1 rounded-full text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm">
                  <span>✨</span> {showAi ? "Tutup Rekomendasi AI" : "Analisis AI Margin"}
                </button>
              </div>

              {showAi && (
                <div className="mt-4 bg-black/40 backdrop-blur-md border border-white/30 rounded-2xl p-4 shadow-xl animate-in fade-in zoom-in duration-200">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    🤖 Rekomendasi AI Shopee ({marginPct.toFixed(1)}% margin)
                  </h3>
                  <div className="space-y-1.5">
                    {getAiStrategy().map((saran, i) => (
                      <p key={i} className="text-xs text-orange-100 leading-relaxed">• {saran}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Switch Status Toko (Star vs Mall) & Ukuran Paket */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/20">
            <div className="flex bg-black/20 backdrop-blur p-1 rounded-2xl border border-white/20">
              <button onClick={()=>setIsMall(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${!isMall?"bg-white text-orange-600 shadow-lg":"text-white hover:bg-white/10"}`}>
                <span>⭐</span> Star / Star+ Seller
              </button>
              <button onClick={()=>setIsMall(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${isMall?"bg-red-700 text-white shadow-lg":"text-white hover:bg-white/10"}`}>
                <span>👑</span> Shopee Mall (+1.8%)
              </button>
            </div>

            <div className="flex bg-black/20 backdrop-blur p-1 rounded-2xl border border-white/20">
              <button onClick={()=>setIsBigPackage(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${!isBigPackage?"bg-white text-orange-600 shadow-lg":"text-white hover:bg-white/10"}`}>
                <span>📦</span> Paket Biasa (&lt;5 kg, Cap 40rb)
              </button>
              <button onClick={()=>setIsBigPackage(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${isBigPackage?"bg-white text-orange-600 shadow-lg":"text-white hover:bg-white/10"}`}>
                <span>🚛</span> Paket Besar (≥5 kg, Cap 60rb)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-white border border-orange-200 rounded-2xl p-1 gap-1 mb-4 shadow-sm">
          {[
            ["kalkulator", "🧮 Kalkulator Cuan"],
            ["campaign", "🎪 Jenis Campaign Shopee"],
            ["semua_program", "📋 Semua Program Biaya"],
            ["strategi", "💡 Panduan Strategi"],
          ].map(([t,l])=>(
            <button key={t} onClick={()=>setMainTab(t)}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${mainTab===t?"bg-orange-600 text-white shadow-md":"text-gray-600 hover:text-orange-600 hover:bg-orange-50"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: KALKULATOR UTAMA ── */}
      {mainTab==="kalkulator" && (
        <div className="max-w-7xl mx-auto px-4 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* KOLOM KIRI (Input & Konfigurasi) */}
          <div className="lg:col-span-7 space-y-4">

            {/* Kategori Produk */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kategori Produk Shopee</p>
                <span className="text-xs font-bold text-orange-600">{kat.label.replace(/^[^\s]+\s/,"")}</span>
              </div>
              <button onClick={()=>setShowKat(!showKat)}
                className="w-full flex items-center justify-between bg-orange-50/50 border-2 border-orange-100 hover:border-orange-400 rounded-xl px-3.5 py-3 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{kat.label.split(" ")[0]}</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-sm">{kat.label.replace(/^[^\s]+\s/,"")}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${KAT_COLOR[kat.kat as keyof typeof KAT_COLOR]}`}>
                        Kat. {kat.kat}
                      </span>
                      <span className="text-xs font-extrabold text-orange-600">
                        Admin {tarifAdminPct}% ({isMall ? "Shopee Mall" : "Star Seller"})
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-gray-400 text-xs px-2 py-1 bg-white rounded-lg border border-gray-200">{showKat?"▲ Tutup":"▼ Ganti"}</span>
              </button>

              {showKat && (
                <div className="mt-3 rounded-xl overflow-hidden max-h-64 overflow-y-auto border border-orange-200 bg-white">
                  {KAT_GROUPS.map(g=>(
                    <div key={g}>
                      <div className={`px-3 py-1.5 text-xs font-bold sticky top-0 border-b ${KAT_COLOR[g as keyof typeof KAT_COLOR]}`}>
                        {KAT_LABEL[g as keyof typeof KAT_LABEL]}
                      </div>
                      {KATEGORI.filter(k=>k.kat===g).map(k=>(
                        <button key={k.id} onClick={()=>{setKat(k);setShowKat(false);}}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-orange-50 text-left transition-all border-b border-orange-50 ${kat.id===k.id?"bg-orange-100/60 text-orange-800 font-bold":"text-gray-700"}`}>
                          <span>{k.label.split(" ")[0]}</span>
                          <div className="flex-1 min-w-0">
                            <p>{k.label.replace(/^[^\s]+\s/,"")}</p>
                            <p className="text-[11px] text-gray-400 truncate">{k.contoh}</p>
                          </div>
                          {kat.id===k.id&&<span className="text-orange-600 font-bold">✓</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal & Harga Jual */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Modal / Harga Beli (HPP)</p>
                  <span className="text-xs font-bold text-gray-700">{formatRp(hargaBeli)}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input type="range" min={100} max={2000000} step={100} value={hargaBeli}
                    onChange={e=>setHargaBeli(Number(e.target.value))} className="flex-1 accent-orange-500"/>
                  <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-xl px-2.5 py-1.5 min-w-fit">
                    <span className="text-orange-500 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaBeli} onChange={e=>setHargaBeli(Number(e.target.value))}
                      className="w-24 bg-transparent text-gray-900 font-bold text-xs outline-none"/>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Harga Jual Normal (Katalog)</p>
                  <span className="text-xs font-bold text-orange-600">{formatRp(hargaJual)}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input type="range" min={Math.max(bep,100)} max={Math.max(hargaBeli*4, 1000000)} step={100}
                    value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))} className="flex-1 accent-orange-500"/>
                  <div className="flex items-center gap-1 bg-orange-50 border border-orange-400 rounded-xl px-2.5 py-1.5 min-w-fit shadow-inner">
                    <span className="text-orange-500 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))}
                      className="w-24 bg-transparent text-orange-700 font-bold text-xs outline-none"/>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  <button onClick={()=>setHargaJual(bep)} className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl py-2 font-bold hover:bg-red-100 transition-all">
                    BEP {formatRp(bep)}
                  </button>
                  <button onClick={()=>setHargaJual(h20)} className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl py-2 font-bold hover:bg-yellow-100 transition-all">
                    Margin 20% ({formatRp(h20)})
                  </button>
                  <button onClick={()=>setHargaJual(h30)} className="text-xs bg-green-50 border border-green-200 text-green-800 rounded-xl py-2 font-bold hover:bg-green-100 transition-all">
                    Margin 30% ({formatRp(h30)})
                  </button>
                </div>
              </div>

              {/* FITUR SIMULASI DISKON CAMPAIGN SELLER SHOPEE */}
              <div className="pt-3 border-t border-orange-100">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ikutPromo} onChange={e=>setIkutPromo(e.target.checked)}
                      className="w-4 h-4 accent-orange-500 rounded"/>
                    <span className="text-xs font-bold text-orange-800">🎪 Ikut Campaign / Diskon Toko Shopee</span>
                  </label>
                  {ikutPromo && (
                    <div className="flex items-center gap-1 bg-orange-100 rounded-lg p-0.5 border border-orange-200">
                      <button onClick={()=>setDiskonType("pct")} className={`text-[10px] font-bold px-2 py-0.5 rounded ${diskonType==="pct"?"bg-orange-600 text-white":"text-gray-600"}`}>%</button>
                      <button onClick={()=>setDiskonType("nominal")} className={`text-[10px] font-bold px-2 py-0.5 rounded ${diskonType==="nominal"?"bg-orange-600 text-white":"text-gray-600"}`}>Rp</button>
                    </div>
                  )}
                </div>

                {ikutPromo && (
                  <div className="mt-2.5 bg-orange-50/80 border border-orange-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-700 font-medium">Besaran Diskon Penjual:</span>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={diskonVal} onChange={e=>setDiskonVal(Math.max(0, Number(e.target.value)))}
                          className="w-20 bg-white border border-orange-400 rounded-lg px-2 py-1 text-right text-xs font-bold text-gray-900 outline-none"/>
                        <span className="text-xs font-bold text-orange-600">{diskonType==="pct"?"%":"Rp"}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-800 pt-1 border-t border-orange-200">
                      <span>Harga Bersih Pembeli (Dasar Biaya Admin):</span>
                      <span className="font-extrabold text-orange-900 text-sm">{formatRp(hargaSetelahDiskon)}</span>
                    </div>
                    <p className="text-[11px] text-orange-700 leading-relaxed">
                      💡 Sesuai aturan Shopee, potongan admin & komisi dihitung dari <strong>(Harga Asli - Diskon Penjual)</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Biaya Operasional / Packing */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-orange-500 border border-orange-100">
              <div className="flex justify-between items-center mb-2.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">📦 Biaya Operasional & Packing</p>
                <span className="text-xs font-extrabold text-orange-600">{formatRp(totalOps)} / pesanan</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ops.map((o,i)=>(
                  <div key={o.id} className="flex items-center justify-between bg-orange-50/40 px-2.5 py-1.5 rounded-xl border border-orange-100">
                    <span className="text-xs text-gray-700">{o.label}</span>
                    <NominalInput value={o.nominal} onChange={(val: number)=>{const n=[...ops];n[i]={...o,nominal:val};setOps(n);}}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Program Biaya Shopee */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">⚙️ Program Biaya Shopee ({isMall?"Shopee Mall":"Star Seller"})</p>
                <button onClick={()=>setMainTab("semua_program")} className="text-xs text-orange-600 underline font-semibold">Detail Program →</button>
              </div>

              {/* Biaya Admin Kategori */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-red-800 font-bold">1. Biaya Administrasi Kat. {kat.kat} — {tarifAdminPct}%</p>
                  <p className="text-[11px] text-red-600 mt-0.5">Dihitung dari harga produk setelah diskon penjual</p>
                </div>
                <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded font-bold">WAJIB</span>
              </div>

              {/* Biaya Proses Pesanan */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-800 font-bold">2. Biaya Proses Pesanan</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">Rp1.250 flat per pesanan berhasil</p>
                </div>
                <span className="text-[10px] bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-bold">WAJIB</span>
              </div>

              {/* Toggle Program Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Gratis Ongkir Xtra */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-2.5 flex items-start gap-2">
                  <input type="checkbox" checked={active.ongkir} onChange={e=>setActive(p=>({...p,ongkir:e.target.checked}))} className="accent-orange-500 w-3.5 h-3.5 mt-0.5"/>
                  <div>
                    <p className="text-xs text-gray-800 font-bold">Gratis Ongkir XTRA (~{getOngkirPct(kat.kat, isBigPackage).pct}%)</p>
                    <p className="text-[11px] text-gray-500">Maks Rp{(getOngkirPct(kat.kat, isBigPackage).cap/1000).toFixed(0)}rb / item</p>
                  </div>
                </div>

                {/* Promo XTRA / Cashback Xtra */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-2.5 flex items-start gap-2">
                  <input type="checkbox" checked={active.promo_xtra} onChange={e=>setActive(p=>({...p,promo_xtra:e.target.checked}))} className="accent-blue-500 w-3.5 h-3.5 mt-0.5"/>
                  <div>
                    <p className="text-xs text-gray-800 font-bold">Promo XTRA (4.5%)</p>
                    <p className="text-[11px] text-gray-500">Voucher Cashback Koin (cap 60rb)</p>
                  </div>
                </div>

                {/* Live & Video Xtra */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-2.5">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={active.live_video} onChange={e=>setActive(p=>({...p,live_video:e.target.checked}))} className="accent-rose-500 w-3.5 h-3.5 mt-0.5"/>
                    <div>
                      <p className="text-xs text-gray-800 font-bold">Shopee Live & Video Deals</p>
                      <p className="text-[11px] text-gray-500">{active.promo_xtra ? "Diskon jadi 2.0% (Promo XTRA aktif)" : "~3.0% transaksi via Live/Video"}</p>
                    </div>
                  </div>
                  {active.live_video && !active.promo_xtra && (
                    <div className="flex items-center gap-1 mt-2 pl-5">
                      {[2, 3, 5].map(v=>(
                        <button key={v} onClick={()=>setLivePct(v)}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold border ${livePct===v?"bg-rose-500 text-white border-rose-600":"bg-white text-rose-700 border-gray-200"}`}>{v}%</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Shopee Affiliate */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-2.5">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={active.affiliate} onChange={e=>setActive(p=>({...p,affiliate:e.target.checked}))} className="accent-pink-500 w-3.5 h-3.5 mt-0.5"/>
                    <div>
                      <p className="text-xs text-gray-800 font-bold">Shopee Affiliate Program</p>
                      <p className="text-[11px] text-gray-500">Komisi diset seller (+ PPN 11%)</p>
                    </div>
                  </div>
                  {active.affiliate && (
                    <div className="flex items-center gap-1 mt-2 pl-5">
                      {[5, 8, 10, 15].map(v=>(
                        <button key={v} onClick={()=>setAffiliatePct(v)}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${affiliatePct===v?"bg-pink-500 text-white border-pink-600":"bg-white text-pink-700 border-gray-200"}`}>{v}%</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* SPayLater 0% */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-2.5 flex items-start gap-2">
                  <input type="checkbox" checked={active.spaylater_3} onChange={e=>setActive(p=>({...p,spaylater_3:e.target.checked}))} className="accent-indigo-500 w-3.5 h-3.5 mt-0.5"/>
                  <div>
                    <p className="text-xs text-gray-800 font-bold">SPayLater XTRA 0% (3 Bln)</p>
                    <p className="text-[11px] text-gray-500">2.5% jika pembeli cicil 3 bulan</p>
                  </div>
                </div>

                {/* Pre-Order */}
                <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-2.5 flex items-start gap-2">
                  <input type="checkbox" checked={active.preorder} onChange={e=>setActive(p=>({...p,preorder:e.target.checked}))} className="accent-orange-500 w-3.5 h-3.5 mt-0.5"/>
                  <div>
                    <p className="text-xs text-gray-800 font-bold">Pre-Order Shopee (+3.0%)</p>
                    <p className="text-[11px] text-gray-500">Khusus produk pre-order</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN (Hasil Akhir & Ringkasan Laba) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Box Hasil Akhir */}
            <div className={`rounded-2xl p-5 border-2 shadow-xl ${status.cls}`}>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-extrabold text-base text-gray-900">Hasil Akhir Transaksi</p>
                  <p className="text-xs text-gray-600">{isMall ? "Shopee Mall" : "Star / Star+ Seller"} · Kat. {kat.kat}</p>
                </div>
                <span className={`font-extrabold text-xs px-3 py-1 rounded-full border-2 ${status.cls}`}>{status.label}</span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-800">
                <div className="flex justify-between font-bold text-sm text-gray-900">
                  <span>Harga Jual Normal</span>
                  <span>{formatRp(hargaJual)}</span>
                </div>
                {ikutPromo && diskonSellerNominal > 0 && (
                  <div className="flex justify-between text-orange-800 font-semibold">
                    <span>Diskon Penjual ({diskonType==="pct"?`${diskonVal}%`:formatRp(diskonVal)})</span>
                    <span>-{formatRp(diskonSellerNominal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-gray-900 pb-1 border-b border-gray-300">
                  <span>Harga Bersih (Dasar Potongan)</span>
                  <span>{formatRp(hargaSetelahDiskon)}</span>
                </div>

                {detailPlat.map((d,i)=>(
                  <div key={i} className={`flex justify-between ${d.wajib?"text-red-700 font-semibold text-xs":"text-orange-700"}`}>
                    <span>{d.label}</span>
                    <span className="font-bold">-{formatRp(d.nom)}</span>
                  </div>
                ))}

                <div className="border-t border-dashed border-gray-400 pt-1.5 mt-1 flex justify-between items-center text-xs font-extrabold text-blue-900 bg-blue-50/80 p-2 rounded-xl">
                  <span>Total Penghasilan Masuk Saldo Shopee:</span>
                  <span className="text-sm font-black text-blue-800">{formatRp(penghasilanShopee)}</span>
                </div>

                <div className="flex justify-between text-orange-800 font-semibold pt-1">
                  <span>Biaya Operasional / Packing</span>
                  <span>-{formatRp(totalOps)}</span>
                </div>
                <div className="flex justify-between text-red-700 font-semibold">
                  <span>Modal Produk (HPP)</span>
                  <span>-{formatRp(hargaBeli)}</span>
                </div>

                <div className="border-t-2 border-gray-900 pt-2.5 mt-2 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-black text-gray-950 uppercase tracking-wide">Keuntungan Bersih Toko</span>
                    <p className="text-[10px] text-gray-600">Setelah HPP & packing toko Anda</p>
                  </div>
                  <span className={`text-xl font-black ${cuan>=0?"text-green-700":"text-red-700"}`}>
                    {cuan>=0?"+":""}{formatRp(cuan)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  {label:"Net Margin", val:marginPct, d:marginPct.toFixed(1)+"%"},
                  {label:"ROI Modal", val:roiPct, d:roiPct.toFixed(1)+"%"},
                  {label:"Total Potongan", val:100, d:potPct.toFixed(1)+"%"},
                ].map(s=>(
                  <div key={s.label} className="bg-white/80 backdrop-blur rounded-xl p-2.5 text-center shadow-sm border border-gray-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">{s.label}</p>
                    <p className={`font-black text-sm ${s.label==="Total Potongan"?"text-gray-900":(s.val>=20?"text-green-700":s.val>=10?"text-orange-600":"text-red-600")}`}>{s.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Harga Jual */}
            <div className="bg-white rounded-2xl p-4 border border-orange-100 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">🎯 Rekomendasi Harga Jual Shopee</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
                  <p className="text-[11px] text-red-700 font-bold">Impas (BEP)</p>
                  <p className="text-sm font-extrabold text-red-900 mt-0.5">{formatRp(bep)}</p>
                </div>
                <div className="bg-yellow-50 p-2.5 rounded-xl border border-yellow-100">
                  <p className="text-[11px] text-yellow-800 font-bold">Margin 20%</p>
                  <p className="text-sm font-extrabold text-yellow-900 mt-0.5">{formatRp(h20)}</p>
                </div>
                <div className="bg-green-50 p-2.5 rounded-xl border border-green-100">
                  <p className="text-[11px] text-green-800 font-bold">Margin 30%</p>
                  <p className="text-sm font-extrabold text-green-900 mt-0.5">{formatRp(h30)}</p>
                </div>
              </div>
            </div>

            {/* Shortcut ke Tab Campaign */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl p-4 shadow-lg text-white">
              <div className="flex items-center justify-between mb-2">
                <p className="font-extrabold text-sm">🎪 Mau Ikut Mega Campaign Shopee?</p>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Panduan</span>
              </div>
              <p className="text-xs text-orange-100 leading-relaxed mb-3">
                Ketahui jenis-jenis campaign resmi: Mega Sale Tanggal Kembar, Payday, Super Brand Day, Flash Sale, hingga Paket Kombo Hemat.
              </p>
              <button onClick={()=>setMainTab("campaign")}
                className="w-full bg-white text-orange-600 hover:bg-orange-50 font-bold text-xs py-2 rounded-xl transition-all shadow-md">
                Buka Direktori Campaign Shopee →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: JENIS CAMPAIGN SHOPEE ── */}
      {mainTab==="campaign" && (
        <div className="max-w-7xl mx-auto px-4 pb-8 space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <span>🎪</span> Direktori Jenis Campaign & Alat Promosi Shopee
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Panduan lengkap klasifikasi campaign resmi Shopee Indonesia, kriteria pendaftaran, dan tips cuan.
                </p>
              </div>
              <button onClick={()=>{setMainTab("kalkulator"); setIkutPromo(true);}}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md w-fit">
                🧮 Simulasikan Margin Campaign di Kalkulator
              </button>
            </div>

            {/* Grid Kartu Jenis Campaign */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {CAMPAIGN_SHOPEE.map((c)=>(
                <div key={c.id} className="bg-white rounded-2xl border border-orange-100 p-4 hover:border-orange-400 hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{c.icon}</span>
                        <div>
                          <p className="font-extrabold text-gray-900 text-sm">{c.nama}</p>
                          <span className="text-[10px] text-gray-500 font-semibold">{c.kategori}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${c.badgeCls}`}>
                        {c.badge}
                      </span>
                    </div>

                    <div className="space-y-2 mt-3 text-xs">
                      <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                        <p className="text-[11px] font-bold text-gray-500 uppercase">Jadwal / Periode:</p>
                        <p className="text-gray-800 mt-0.5 font-medium">{c.jadwal}</p>
                      </div>

                      <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                        <p className="text-[11px] font-bold text-gray-500 uppercase">Syarat Diskon / Promo:</p>
                        <p className="text-orange-700 font-bold mt-0.5">{c.diskonMin}</p>
                      </div>

                      <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                        <p className="text-[11px] font-bold text-gray-500 uppercase">Benefit & Manfaat:</p>
                        <p className="text-gray-700 mt-0.5">{c.manfaat}</p>
                      </div>

                      <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                        <p className="text-[11px] font-bold text-gray-500 uppercase">Kriteria Seller:</p>
                        <p className="text-gray-600 mt-0.5">{c.kriteria}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-orange-100 bg-orange-50/30 -mx-4 -mb-4 p-3 rounded-b-2xl">
                    <p className="text-[11px] text-orange-800 font-bold flex items-center gap-1">
                      <span>💡 Tips Cuan:</span> {c.tipsCuan}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SEMUA PROGRAM BIAYA ── */}
      {mainTab==="semua_program" && (
        <div className="max-w-4xl mx-auto px-4 pb-8 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm">
            <h2 className="font-extrabold text-gray-900 text-base mb-1">
              📋 Rincian Lengkap Semua Program Biaya Shopee (Star & Mall 2026)
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Sumber: help.shopee.co.id & Shopee Seller Centre · Update Kebijakan 2026.
            </p>

            <div className="space-y-3">
              {ALL_PROGRAMS.map((p,i)=>(
                <div key={p.id} className={`border rounded-xl p-3.5 ${p.badge==="WAJIB"?"border-red-200 bg-red-50/60":"border-orange-100 bg-white"}`}>
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                      <p className="font-bold text-gray-900 text-sm">{p.label}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${p.badgeCls}`}>{p.badge}</span>
                  </div>
                  <p className="text-xs font-extrabold text-orange-600 pl-7 mb-1">{p.tarif}</p>
                  <p className="text-xs text-gray-600 pl-7 leading-relaxed">{p.catatan}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: PANDUAN STRATEGI ── */}
      {mainTab==="strategi" && (
        <div className="max-w-7xl mx-auto px-4 pb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-56 flex-shrink-0 space-y-1.5">
              {STRATEGI.map(s=>(
                <button key={s.id} onClick={()=>setStrTab(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${strTab===s.id?"bg-orange-600 text-white shadow-md":"bg-white text-gray-700 border border-orange-100 hover:bg-orange-50 hover:text-orange-600"}`}>
                  <span className="text-base">{s.icon}</span>
                  <span className="truncate">{s.title}</span>
                </button>
              ))}
            </div>

            {activeStr && (
              <div className="flex-1 min-w-0">
                <div className={`bg-gradient-to-r ${activeStr.color} rounded-2xl p-5 mb-4 text-white shadow-lg`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activeStr.icon}</span>
                    <div>
                      <h2 className="text-lg md:text-xl font-extrabold">{activeStr.title}</h2>
                      <p className="text-white text-opacity-80 text-xs">Panduan Shopee Seller Education Hub</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeStr.tips.map((tip,i)=>(
                    <div key={i} className="bg-white rounded-2xl p-4 border border-orange-100 hover:shadow-md transition-all shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-r ${activeStr.color} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>{i+1}</div>
                        <p className="font-bold text-gray-900 text-xs sm:text-sm">{tip.sub}</p>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{tip.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-4">
                  {strIdx > 0 ? (
                    <button onClick={()=>setStrTab(STRATEGI[strIdx-1].id)} className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">
                      ← {STRATEGI[strIdx-1].title}
                    </button>
                  ) : <div/>}
                  {strIdx < STRATEGI.length - 1 ? (
                    <button onClick={()=>setStrTab(STRATEGI[strIdx+1].id)} className="text-xs font-semibold text-white bg-orange-600 rounded-xl px-3 py-2 hover:bg-orange-700">
                      {STRATEGI[strIdx+1].title} →
                    </button>
                  ) : <div/>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pb-6">
        help.shopee.co.id · seller.shopee.co.id/edu · Skema Shopee Indonesia 2026
      </p>
    </div>
  );
}