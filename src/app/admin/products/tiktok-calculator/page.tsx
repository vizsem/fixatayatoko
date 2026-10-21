"use client";

import { useState, useEffect } from "react";
import { sbGetDoc } from '@/lib/supabase-helpers';

// ── KATEGORI & KOMISI (Update Terbaru 2026 - Tokopedia & TikTok Shop) ──
const KATEGORI = [
  // === GRUP B: Snack, Bakpia, Roti Abon (Komisi 9.5% — Sesuai Settlement Nyata Okt 2026) ===
  { id:"snack_bakpia", label:"🍪 Snack, Bakpia & Roti Abon", grp:"B", komisi:9.50, contoh:"Bakpia abon, roti, kue, biskuit, oleh-oleh" },
  { id:"makanan",   label:"🍜 Makanan & Minuman",           grp:"1", komisi:5.25, contoh:"Indomie, snack, minuman, sembako" },
  { id:"sembako",   label:"🛒 Sembako & Bumbu Dapur",       grp:"1", komisi:5.25, contoh:"Beras, minyak, gula, tepung, bumbu" },
  { id:"fashion_w", label:"👗 Fashion Wanita",              grp:"1", komisi:5.25, contoh:"Baju, dress, rok, blouse" },
  { id:"fashion_p", label:"👕 Fashion Pria",                grp:"1", komisi:5.25, contoh:"Kaos, kemeja, celana, jaket" },
  { id:"fashion_m", label:"🧕 Fashion Muslim",              grp:"1", komisi:5.25, contoh:"Gamis, hijab, sarung, koko" },
  { id:"fashion_b", label:"👶 Fashion Bayi & Anak",         grp:"1", komisi:5.25, contoh:"Baju bayi, sepatu anak" },
  { id:"kecantikan",label:"💄 Kecantikan & Skincare",       grp:"1", komisi:5.25, contoh:"Serum, moisturizer, makeup" },
  { id:"perawatan", label:"🧴 Perawatan Diri & Tubuh",      grp:"1", komisi:5.25, contoh:"Sampo, sabun, deodoran" },
  { id:"ibu_bayi",  label:"🍼 Ibu & Bayi",                  grp:"1", komisi:5.25, contoh:"Popok, susu, perlengkapan bayi" },
  { id:"rumah",     label:"🏠 Rumah Tangga",                grp:"1", komisi:5.25, contoh:"Peralatan rumah, lampu, karpet" },
  { id:"dapur",     label:"🍳 Dapur & Peralatan",           grp:"1", komisi:5.25, contoh:"Wajan, panci, peralatan masak" },
  { id:"olahraga",  label:"⚽ Olahraga & Outdoor",          grp:"1", komisi:5.25, contoh:"Alat olahraga, jersey, outdoor" },
  { id:"buku",      label:"📚 Buku & Alat Tulis",           grp:"1", komisi:5.25, contoh:"Buku, alat tulis, kantor" },
  { id:"mainan",    label:"🧸 Mainan & Hobi",               grp:"1", komisi:5.25, contoh:"Mainan anak, hobi, koleksi" },
  { id:"otomotif",  label:"🚗 Otomotif Aksesoris",          grp:"1", komisi:5.25, contoh:"Aksesoris motor/mobil, helm" },
  { id:"kesehatan", label:"💊 Kesehatan & Suplemen",        grp:"2", komisi:6.30, contoh:"Vitamin, suplemen, alat kesehatan" },
  { id:"elektronik",label:"🔌 Elektronik Umum",             grp:"2", komisi:6.30, contoh:"Kabel, charger, baterai, LED" },
  { id:"gaming",    label:"🎮 Gaming & Konsol",             grp:"2", komisi:6.30, contoh:"Konsol, joystick, headset gaming" },
  { id:"hp",        label:"📱 HP & Tablet",                 grp:"3", komisi:3.15, contoh:"Smartphone, tablet, smartwatch" },
  { id:"laptop",    label:"💻 Laptop & Komputer",           grp:"3", komisi:3.15, contoh:"Laptop, PC, monitor, printer" },
  { id:"kamera",    label:"📷 Kamera & Drone",              grp:"3", komisi:3.15, contoh:"Kamera mirrorless, DSLR, drone" },
  { id:"logam",     label:"🥇 Logam Mulia & Perhiasan",    grp:"3", komisi:3.15, contoh:"Emas batangan, perhiasan, berlian" },
  { id:"hp_komp",   label:"📲 HP Komponen & Spare Part",   grp:"4", komisi:1.58, contoh:"Baterai HP, layar, komponen" },
  { id:"kendaraan", label:"🏍️ Kendaraan Motor/Mobil",     grp:"5", komisi:1.05, contoh:"Motor, mobil, kendaraan" },
  { id:"lainnya",   label:"📦 Produk Lainnya (Default)",    grp:"D", komisi:6.97, contoh:"Produk di luar kategori resmi" },
];

const GRP_LABEL = {"B":"Snack/Bakpia/Kue · 9.5%","1":"Grup 1 · 5.25%","2":"Grup 2 · 6.30%","3":"Grup 3 · 3.15%","4":"Grup 4 · 1.58%","5":"Grup 5 · 1.05%","D":"Default · 6.97%"};
const GRP_COLOR = {"B":"bg-amber-100 text-amber-700 border-amber-400","1":"bg-blue-100 text-blue-700 border-blue-300","2":"bg-orange-100 text-orange-700 border-orange-300","3":"bg-purple-100 text-purple-700 border-purple-300","4":"bg-red-100 text-red-700 border-red-300","5":"bg-red-200 text-red-800 border-red-400","D":"bg-gray-100 text-gray-700 border-gray-300"};
const GROUPS = ["B","1","2","3","4","5","D"];

const INIT_OPS = [
  {id:"lakban",  label:"🏷️ Lakban",        nominal:500},
  {id:"termal",  label:"🧾 Kertas Termal",  nominal:200},
  {id:"bubble",  label:"🫧 Bubble Wrap",    nominal:500},
  {id:"kardus",  label:"📦 Kardus/Plastik", nominal:1500},
  {id:"krywn",   label:"👷 Upah Karyawan",  nominal:2000},
  {id:"listrik", label:"💡 Listrik & WiFi", nominal:200},
];

const formatRp = (n: number): string => "Rp" + Math.round(n).toLocaleString("id-ID");

// ── SEMUA PROGRAM BIAYA (Lengkap & Terupdate) ────────────────
const ALL_PROGRAMS = [
  // === WAJIB ===
  {
    id:"komisi_platform", label:"Komisi Platform",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tiktok:true, tokopedia:true,
    tarif:"1.05%–9.5% sesuai kategori (Snack/Bakpia 9.5%, Makanan Umum 5.25%)",
    catatan:"Dihitung dari harga item dikurangi diskon penjual. TIDAK termasuk ongkir & diskon platform. Settlement nyata Bakpia Rp14.892: komisi bruto 9.5% = Rp1.414, setelah diskon komisi platform Rp156 → netto Rp1.258.",
    isKomisi:true,
  },
  {
    id:"komisi_dinamis", label:"Komisi Dinamis (Free Shipping Subsidy)",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tiktok:true, tokopedia:true,
    tarif:"4–6.5%, cap Rp60.000 per item",
    catatan:"Diterapkan pada pesanan terkirim untuk mendanai subsidi pengiriman. Settlement nyata Bakpia Rp14.892: Komisi Dinamis 6.5% = Rp968. Cap standar Rp60.000/item.",
    isPct:true, pct:6.5, minPct:4, maxPct:6.5,
  },
  {
    id:"biaya_proses", label:"Biaya Pemrosesan Order",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tiktok:true, tokopedia:true,
    tarif:"Rp1.250 flat per pesanan terkirim",
    catatan:"Berlaku sejak 11 Agustus 2025. Tetap kena saat retur setelah terkirim. Seller baru dapat bebas biaya untuk 50 pesanan pertama.",
    flat:1250,
  },
  {
    id:"pph22", label:"PPh Pasal 22 (Pajak e-Commerce)",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tiktok:true, tokopedia:true,
    tarif:"0.5% dari nilai transaksi (dipungut platform)",
    catatan:"Dipungut platform sejak 2022. Settlement nyata Bakpia Rp14.892: PPh 22 = Rp74 (0.5%).",
    isPct:true, pct:0.5,
  },
  {
    id:"growth_xtra", label:"Biaya Layanan Program Growth Xtra",
    badge:"Program Aktif", badgeCls:"bg-amber-100 text-amber-800",
    tiktok:true, tokopedia:false,
    tarif:"~3.5% per pesanan",
    catatan:"Program Growth Xtra TikTok Shop untuk mendorong pertumbuhan penjualan. Settlement nyata Bakpia Rp14.892: Growth Xtra 3.5% = Rp521. Cek Seller Center apakah toko Anda terdaftar.",
    isPct:true, pct:3.5,
  },
  {
    id:"biaya_logistik", label:"Biaya Layanan Logistik",
    badge:"Kondisional", badgeCls:"bg-amber-100 text-amber-800",
    tiktok:true, tokopedia:true,
    tarif:"Rp540 – Rp5.060 per pesanan (tergantung rute & kurir)",
    catatan:"Pada settlement nyata Bakpia Rp14.892: biaya logistik Rp0 (ongkir ditanggung pembeli). Dikenakan jika platform yang menanggung subsidi ongkir.",
    flat:1000,
  },
  {
    id:"mall_fee", label:"Biaya Layanan Mall / Official Store",
    badge:"Khusus Mall", badgeCls:"bg-purple-100 text-purple-700",
    tiktok:true, tokopedia:true,
    tarif:"1.8%, maks Rp50.000 per item",
    catatan:"Khusus toko berstatus Mall atau Official Store terverifikasi.",
    isPct:true, pct:1.8, maxFlat:50000,
  },
  // === OPSIONAL / PROMOSI ===
  {
    id:"gratis_ongkir", label:"Gratis Ongkir XTRA",
    badge:"Sangat Disarankan", badgeCls:"bg-green-100 text-green-700",
    tiktok:true, tokopedia:true,
    tarif:"~4–6% per pesanan (umumnya 5.5%)",
    catatan:"TikTok Shop: 5–5.5%. Tokopedia: Bebas Ongkir. Meningkatkan konversi dan visibilitas di pencarian.",
    isPct:true, pct:5.5,
  },
  {
    id:"voucher_xtra", label:"Voucher XTRA Program",
    badge:"Opsional", badgeCls:"bg-blue-100 text-blue-700",
    tiktok:true, tokopedia:true,
    tarif:"~3.5%, maks Rp20.000/item",
    catatan:"Program voucher subsidi platform. Wajib cek berkala di Seller Center karena bisa di-enroll otomatis.",
    isPct:true, pct:3.5, maxFlat:20000,
  },
  {
    id:"pre_order", label:"Biaya Layanan Pre-Order",
    badge:"Opsional", badgeCls:"bg-orange-100 text-orange-700",
    tiktok:true, tokopedia:false, // ⚠️ HANYA TikTok Shop, Tokopedia GRATIS
    tarif:"+3% per produk terjual",
    catatan:"⚠️ HANYA berlaku di TikTok Shop (+3%). Di Tokopedia, fitur Pre-Order GRATIS (0%).",
    isPct:true, pct:3,
  },
  {
    id:"afiliasi", label:"Komisi Afiliasi Kreator",
    badge:"Opsional", badgeCls:"bg-pink-100 text-pink-700",
    tiktok:true, tokopedia:true,
    tarif:"0.5–15% (diset oleh seller)",
    catatan:"Settlement nyata Bakpia: Komisi afiliasi Rp71 (~0.48%). Seller menentukan komisi per produk. Dibayarkan jika terjadi penjualan via link/video/live kreator.",
    isPct:true, pct:5, minPct:0.5, maxPct:15,
  },
  {
    id:"gmv_max", label:"GMV Max / Shop Ads (Diskon Komisi Platform)",
    badge:"Strategis", badgeCls:"bg-green-100 text-green-700",
    tiktok:true, tokopedia:false,
    tarif:"Biaya iklan % GMV → Diskon komisi 15% - 30%",
    catatan:"Spend >1% GMV → diskon 15% komisi platform. Spend >3% GMV → diskon 30% komisi SEMUA order toko.",
    isGmvMax:true,
  },
  {
    id:"topads", label:"TopAds Tokopedia",
    badge:"Opsional", badgeCls:"bg-green-100 text-green-700",
    tiktok:false, tokopedia:true,
    tarif:"Sesuai budget (CPC Rp200–500+)",
    catatan:"Produk muncul di posisi teratas pencarian Tokopedia. Bayar per klik (CPC).",
    isPct:true, pct:3,
  },
  {
    id:"live_ads", label:"LIVE Ads / TikTok Ads",
    badge:"Opsional", badgeCls:"bg-rose-100 text-rose-700",
    tiktok:true, tokopedia:false,
    tarif:"~2–5% atau sesuai budget iklan",
    catatan:"Meningkatkan penonton siaran LIVE. Transaksi via LIVE mendapatkan tarif komisi platform lebih hemat.",
    isPct:true, pct:3,
  },
  {
    id:"cashback_bonus", label:"Biaya Layanan Cashback Bonus",
    badge:"Perhatikan!", badgeCls:"bg-yellow-100 text-yellow-700",
    tiktok:true, tokopedia:true,
    tarif:"~2% variatif",
    catatan:"⚠️ Bisa aktif otomatis dari sistem promosi. Selalu cek dashboard settlement secara berkala.",
    isPct:true, pct:2,
  },
];

// ── DIREKTORI LENGKAP JENIS CAMPAIGN & PROMOSI TIKTOK SHOP ────
const CAMPAIGN_TYPES = [
  {
    id: "mega_sale",
    icon: "🔥",
    nama: "Mega Sale (Double Date & Akhir Tahun)",
    kategori: "Platform Campaign",
    badge: "Traffic Tertinggi",
    badgeCls: "bg-red-500/20 text-red-300 border-red-500/40",
    jadwal: "9.9, 10.10, 11.11, 12.12, Ramadan Ekstra Seru, Harbolnas",
    diskonMin: "Diskon min. 10% - 30% dari harga terendah 30 hari",
    manfaat: "Banner beranda utama, subsidi voucher platform melimpah, live mega stream, lonjakan order hingga 5x–10x.",
    kriteria: "Rating produk ≥ 4.5, respon chat >85%, fulfillment <24 jam, stok wajib siap & dialokasikan khusus.",
    tipsCuan: "Hitung harga BEP diskon sebelum daftar. Naikkan volume dan fokus jual produk hero/bestseller.",
    color: "from-red-600 to-rose-700",
  },
  {
    id: "payday",
    icon: "💳",
    nama: "Payday Sale (Pesta Gajian Bulanan)",
    kategori: "Platform Campaign",
    badge: "Konversi Tinggi",
    badgeCls: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    jadwal: "Setiap tanggal 25 s/d akhir bulan (atau s/d tanggal 2-3 bulan berikutnya)",
    diskonMin: "Diskon 5% - 15% atau voucher toko spesial",
    manfaat: "Menangkap momen daya beli puncak pembeli saat gajian cair. Traffic organik naik 2x-3x.",
    kriteria: "Semua seller dengan skor performa toko normal. Produk ready stock siap kirim.",
    tipsCuan: "Kombinasikan dengan LIVE maraton di tanggal 25-28. Berikan voucher bundling/paket hemat.",
    color: "from-blue-600 to-indigo-700",
  },
  {
    id: "co_funded",
    icon: "🤝",
    nama: "Co-Funded Campaign (Patungan Subsidi Platform)",
    kategori: "Platform & Seller Joint",
    badge: "Sangat Disukai Pembeli",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    jadwal: "Event tematik mingguan / bulanan di menu Campaign Seller Center",
    diskonMin: "Subsidi dibagi 50:50 (contoh: Voucher Rp20rb, seller Rp10rb & platform Rp10rb)",
    manfaat: "Produk mendapat label eksklusif 'Super Voucher', pembeli belanja lebih royal tanpa margin seller habis total.",
    kriteria: "Produk terdaftar di campaign resmi, memiliki riwayat penjualan aktif dan ulasan positif.",
    tipsCuan: "Pastikan margin produk >25% agar porsi subsidi seller (misal 5-7%) tidak menggerus laba bersih.",
    color: "from-amber-600 to-orange-700",
  },
  {
    id: "brand_day",
    icon: "👑",
    nama: "Super Brand Day / Category Thematic Day",
    kategori: "Platform Campaign",
    badge: "Official & Star Seller",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    jadwal: "Sesuai kalender bulanan per kategori (Beauty Day, Fashion Week, Mom & Baby Seru)",
    diskonMin: "Eksklusif promo produk unggulan & bundle pack",
    manfaat: "Eksposur masif pada etalase kategori tertentu, push notifikasi ke pengguna relevan.",
    kriteria: "Diutamakan Mall / Official Store atau seller terpilih oleh tim kategori TikTok.",
    tipsCuan: "Luncurkan varian baru atau kemasan bundle khusus untuk mengunci pasar.",
    color: "from-purple-600 to-pink-700",
  },
  {
    id: "flash_sale",
    icon: "⚡",
    nama: "Seller Flash Sale & LIVE Flash Sale",
    kategori: "Seller Promotion Tool",
    badge: "Paling Efektif di Live",
    badgeCls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    jadwal: "Bisa diatur kapan saja (durasi 30 menit s/d 24 jam) via Seller Center",
    diskonMin: "Bebas ditentukan seller (umumnya 10% - 25% dengan batas stok)",
    manfaat: "Countdown timer visual memicu FOMO (fear of missing out). Pembeli langsung check out seketika.",
    kriteria: "Bisa diset khusus slot saat LIVE Streaming atau untuk display etalase produk.",
    tipsCuan: "Batasi kuota stok flash sale (misal 50 unit pertama). Begitu habis, kembalikan ke harga normal.",
    color: "from-yellow-600 to-amber-700",
  },
  {
    id: "voucher_toko",
    icon: "🎟️",
    nama: "Voucher Toko & Follow Prize",
    kategori: "Seller Promotion Tool",
    badge: "Retensi Pelanggan",
    badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    jadwal: "Sepanjang waktu aktif di profil toko, video, dan live",
    diskonMin: "Voucher nominal (cth: Rp5.000 min. beli Rp50rb) atau % (5% maks Rp10rb)",
    manfaat: "Follow Prize memikat penonton jadi pengikut setia; Voucher repeat order mendongkrak LTV.",
    kriteria: "Bisa dibuat publik (semua pembeli) atau voucher privat (khusus live / chat).",
    tipsCuan: "Gunakan batas minimum belanja (misal min. belanja Rp100.000 untuk voucher Rp10.000) agar basket size naik.",
    color: "from-emerald-600 to-teal-700",
  },
  {
    id: "combo_bundle",
    icon: "📦",
    nama: "Paket Diskon / Bundling & Beli Banyak Hemat",
    kategori: "Seller Promotion Tool",
    badge: "Hemat Biaya Proses",
    badgeCls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    jadwal: "Diatur via menu Promosi → Paket Diskon",
    diskonMin: "Beli 2 Diskon 5%, Beli 3 Diskon 10%, atau Paket Combo Produk A + B",
    manfaat: "Biaya proses flat Rp1.250 dan operasional packing hanya dihitung 1x, margin per unit meningkat!",
    kriteria: "Cocok untuk produk FMCG, sembako, kaos/pakaian, aksesoris, dan kosmetik.",
    tipsCuan: "Gabungkan produk fast-moving dengan produk slow-moving untuk percepat perputaran stok.",
    color: "from-cyan-600 to-blue-700",
  },
  {
    id: "gwp",
    icon: "🎁",
    nama: "Hadiah dengan Pembelian (Gift with Purchase - GWP)",
    kategori: "Seller Promotion Tool",
    badge: "Tanpa Rusak Harga Jual",
    badgeCls: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40",
    jadwal: "Event peluncuran produk atau momen campaign",
    diskonMin: "Bukan diskon harga, melainkan bonus free sample atau merchandise khusus",
    manfaat: "Menjaga harga jual pasar tidak rusak (tidak perang harga) namun tetap bernilai tinggi di mata pembeli.",
    kriteria: "Hadiah dimasukkan ke sistem promosi toko di Seller Center.",
    tipsCuan: "Berikan sample produk varian baru Anda agar pembeli mencoba dan repeat order produk tersebut.",
    color: "from-fuchsia-600 to-pink-700",
  },
];

function NominalInput({value,onChange}:{value:number;onChange:(val:number)=>void}){
  return(
    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">
      <span className="text-gray-400 text-xs">Rp</span>
      <input type="number" value={value} onChange={e=>onChange(Number(e.target.value))}
        className="w-16 bg-transparent text-gray-700 text-xs font-bold outline-none text-right"/>
    </div>
  );
}

// ── STRATEGI BISNIS & PENJUALAN ─────────────────────────────
const STRATEGI = [
  { id:"campaign_guide", icon:"🎪", title:"Panduan Eksekusi Campaign", color:"from-rose-500 to-pink-600", tips:[
    {sub:"Pendaftaran Tepat Waktu",desc:"Pendaftaran Mega Sale ditutup H-7 atau H-14 sebelum event. Cek tab 'Promosi > Campaign' di Seller Center setiap Senin dan daftarkan SKU unggulan sedini mungkin."},
    {sub:"Alokasi Kuota Stok Khusus",desc:"Pisahkan stok fisik khusus untuk pesanan campaign. Jangan sampai overselling (stok habis tapi tetap kebeli) karena pembatalan otomatis kena poin penalti berat."},
    {sub:"Dasar Hitung Komisi yang Benar",desc:"Ingat! Komisi TikTok Shop dihitung dari (Harga Jual - Diskon Seller). Ikut diskon campaign tidak melipatgandakan potongan persentase platform, tapi justru memangkas nominal komisi."},
    {sub:"Sinergi Live + Flash Sale",desc:"Saat jam peak campaign (19.00-23.00), aktifkan LIVE Flash Sale tiap 30 menit. Beritahu penonton 'Hanya 20 slot di keranjang kuning!' untuk memacu impulsivitas."},
  ]},
  { id:"setup",     icon:"🏪", title:"Setup Toko Profesional",   color:"from-cyan-500 to-blue-500",   tips:[
    {sub:"Profil Toko Lengkap",desc:"Isi nama toko, logo, banner, dan deskripsi toko. Profil profesional meningkatkan kepercayaan dan konversi pembeli baru yang belum mengenal tokomu."},
    {sub:"Foto & Deskripsi Produk",desc:"Min. 5 foto per produk: tampak depan, belakang, detail, berat/ukuran, lifestyle. Deskripsi: spesifikasi, isi paket, cara penyimpanan, FAQ."},
    {sub:"Optimasi Judul (SEO)",desc:"Format: [Merek] + [Nama Produk] + [Spesifikasi]. Contoh: 'Indomie Goreng Original 40 Bungkus 1 Dus Hemat'. Bantu produk muncul di pencarian organik."},
    {sub:"Variasi dalam 1 Listing",desc:"Buat semua varian (satuan, paket 5, 1 dus) dalam satu listing. Semua ulasan terkumpul jadi satu — toko terlihat lebih berpengalaman lebih cepat."},
  ]},
  { id:"konten",    icon:"🎬", title:"Konten Video & FYP",        color:"from-pink-500 to-rose-500",   tips:[
    {sub:"Hook 3 Detik Pertama",desc:"Mulai video dengan kalimat kuat: 'Harga gila! Indomie 1 dus cuma Rp120rb!' Penonton yang tidak skip dalam 3 detik pertama 5× lebih mungkin menonton sampai habis."},
    {sub:"Format Video Terbaik",desc:"Durasi 30–60 detik. Struktur: hook → tunjukkan produk → harga → CTA. Gunakan teks overlay, musik trending, dan close-up produk yang jelas."},
    {sub:"Konten Edukatif + Jualan",desc:"Buat video 'tips hemat belanja', 'cara masak instan 5 menit', atau 'perbandingan harga online vs warung'. Konten informatif lebih viral daripada sekadar promosi."},
    {sub:"Konsistensi Posting",desc:"Upload 1–2 video/hari di jam peak: 06.00–09.00, 11.00–13.00, 19.00–22.00. Akun aktif lebih disukai algoritma TikTok dan mendapat distribusi lebih luas."},
  ]},
  { id:"live",      icon:"📡", title:"Live Selling & LIVE Ads",   color:"from-red-500 to-pink-500",    tips:[
    {sub:"Jadwal & Durasi Live",desc:"Live minimal 3× seminggu, durasi 1–3 jam. Jam terbaik: 11.00–13.00 & 19.30–22.00. Konsistensi membangun penonton setia yang notifikasi setiap kamu live."},
    {sub:"Flash Deal Eksklusif Live",desc:"Tawarkan harga HANYA saat live: 'Harga ini cuma 15 menit!' Tampilkan countdown timer dan stok real-time. Konversi live 3–5× lebih tinggi dari listing biasa."},
    {sub:"Tarif Komisi Lebih Rendah via LIVE",desc:"Transaksi via LIVE mendapat tarif komisi platform lebih hemat. Manfaatkan ini untuk jual produk margin tipis via LIVE agar tetap untung."},
    {sub:"LIVE Ads untuk Boost Penonton",desc:"Aktifkan LIVE Ads selama siaran. Biaya ~2–5% tapi jangkauan penonton bisa 3–10× lebih besar. Gunakan saat stok cukup dan produk terbukti laku."},
  ]},
  { id:"afiliasi",  icon:"🤝", title:"Program Afiliasi & Kreator", color:"from-violet-500 to-purple-500", tips:[
    {sub:"Open vs Target Collaboration",desc:"Open Collaboration: semua kreator bisa promosi produkmu. Target Collaboration: undang kreator spesifik. Mulai dengan Open untuk volume, lalu Target untuk kreator terbaik."},
    {sub:"Set Komisi yang Tepat",desc:"Rata-rata komisi FMCG/sembako: 3–8%. Terlalu rendah = kreator tidak tertarik. Terlalu tinggi = margin habis. Uji 5% dulu, pantau konversinya."},
    {sub:"Pilih Kreator Relevan",desc:"Kreator 10–100K followers dengan niche ibu rumah tangga/food/lifestyle sering lebih efektif dari mega-influencer. Cek engagement rate, bukan hanya followers."},
    {sub:"Pantau Dashboard Afiliasi",desc:"Cek kreator mana paling banyak hasilkan transaksi. Hubungi langsung untuk Target Collaboration dengan brief produk dan komisi lebih tinggi."},
  ]},
  { id:"ads",       icon:"📢", title:"Shop Ads & GMV Max",         color:"from-green-500 to-teal-500",  tips:[
    {sub:"Strategi GMV Max Cerdas",desc:"Spend GMV Max >3% dari GMV toko → diskon 30% komisi platform untuk SEMUA order. Kalkulasi: apakah penghematan komisi > biaya iklan? Jika ya, GMV Max lebih hemat!"},
    {sub:"In-Feed Ads untuk Produk Baru",desc:"Budget Rp30–50rb/hari untuk test konversi produk baru. Pantau ROAS minimal 3× sebelum scale up. Hentikan iklan jika ROAS <2× dalam 7 hari."},
    {sub:"TopAds Tokopedia",desc:"Target kata kunci long-tail di Tokopedia: 'indomie goreng 1 dus murah'. CPC Rp200–500. Fokus pada kata kunci transaksional (niat beli tinggi)."},
    {sub:"Analisis Data Mingguan",desc:"Pantau: CTR, konversi, ROAS, dan cost per order. Fokus budget ke produk terbukti convert. Nonaktifkan iklan produk dengan ROAS <2× konsisten."},
  ]},
  { id:"tokopedia", icon:"🟢", title:"Fitur Khusus Tokopedia",     color:"from-green-400 to-emerald-500", tips:[
    {sub:"Pre-Order GRATIS di Tokopedia",desc:"⭐ Fakta penting: biaya Pre-Order 3% HANYA berlaku di TikTok Shop, TIDAK di Tokopedia. Manfaatkan ini — jual produk pre-order di Tokopedia untuk hindari biaya 3% tambahan."},
    {sub:"Power Merchant & Power Merchant PRO",desc:"Upgrade ke PM untuk dapat badge kepercayaan, tarif komisi lebih rendah, dan prioritas di hasil pencarian. Syarat: min. 3 produk aktif, fulfillment rate >95%."},
    {sub:"Flash Sale Tokopedia",desc:"Daftarkan produk ke Flash Sale Tokopedia. Pastikan stok cukup dan harga masih di atas BEP setelah semua potongan. Flash sale meningkatkan visibilitas drastis."},
    {sub:"Bebas Ongkir Tokopedia",desc:"Aktifkan via Seller Center: Iklan & Promosi → Bebas Ongkir. Aktifkan SiCepat Reguler & AnterAja Reguler. Produk dengan badge bebas ongkir mendapat CTR 2–3× lebih tinggi."},
  ]},
  { id:"performa",  icon:"📊", title:"Performa & Analitik Toko",   color:"from-amber-500 to-orange-500", tips:[
    {sub:"Pantau 5 Metrik Utama",desc:"(1) Tingkat konversi, (2) Sumber traffic, (3) Produk terlaris, (4) Jam transaksi terbanyak, (5) Rating & response time. Evaluasi setiap Senin pagi."},
    {sub:"Cek Settlement Rutin",desc:"⚠️ Selalu cek dashboard settlement TikTok Shop/Tokopedia setiap minggu. Ada komponen seperti 'Biaya Layanan Cashback Bonus' dan 'Voucher XTRA' yang bisa muncul tiba-tiba."},
    {sub:"Response Time <1 Jam",desc:"Gunakan auto-reply untuk pertanyaan umum (harga, stok, ongkir). Seller respons cepat dapat badge 'Respon Cepat' = lebih dipercaya pembeli baru."},
    {sub:"Fulfillment Rate >95%",desc:"Proses pesanan dalam 12 jam. Fulfillment rate rendah langsung menurunkan skor toko dan visibilitas produk di pencarian organik."},
  ]},
  { id:"growth",    icon:"🚀", title:"Strategi Pertumbuhan",        color:"from-indigo-500 to-blue-600", tips:[
    {sub:"Target per Fase",desc:"Bln 1–3: 20–50 order/bln, 1 produk. Bln 4–6: 100–200 order, 3–5 SKU. Bln 7–12: 500+ order, scale ads. Jangan expand terlalu awal sebelum 1 produk stabil."},
    {sub:"Bundling & Upsell",desc:"Paket combo: produk utama + produk pelengkap. Nilai pesanan naik → biaya Rp1.250/pesanan jadi lebih efisien per unit. Margin per unit membaik."},
    {sub:"Repeat Customer Program",desc:"Voucher khusus pembeli lama 5× lebih murah dari cari pembeli baru. Set voucher follow prize di TikTok Shop & kupon toko di Tokopedia untuk dorong repeat order."},
  ]},
];

export default function App() {
  const [platform, setPlatform] = useState("tiktok"); // tiktok | tokopedia
  const [isMall, setIsMall] = useState(false); // Mall / Official Store
  const [kat, setKat] = useState(KATEGORI[0]);
  const [showKat, setShowKat] = useState(false);
  const [hargaBeli, setHargaBeli] = useState(2900);
  const [hargaJual, setHargaJual] = useState(5000);
  const [ops, setOps] = useState(INIT_OPS);
  const [mainTab, setMainTab] = useState("kalkulator");
  const [strTab, setStrTab] = useState("campaign_guide");

  // Program toggles
  const [active, setActive] = useState({
    komisi_dinamis: true,
    biaya_proses: true,
    pph22: true,           // PPh Pasal 22 0.5% — wajib
    growth_xtra: true,     // Growth Xtra 3.5% — aktif default sesuai settlement nyata
    biaya_logistik: false,
    mall_fee: false,
    gratis_ongkir: false,
    voucher_xtra: false,
    pre_order: false,
    afiliasi: false,
    gmv_max: false,
    topads: false,
    live_ads: false,
    cashback_bonus: false,
  });

  // Nilai parameter
  const [dinamisPct, setDinamisPct] = useState(6.5); // 6.5% sesuai settlement nyata Okt 2026
  const [dinamisCap, setDinamisCap] = useState(60000); // Rp60.000 terbaru vs Rp40.000
  const [growthXtraPct, setGrowthXtraPct] = useState(3.5); // 3.5% sesuai settlement
  const [biayaLogistikNom, setBiayaLogistikNom] = useState(1000);
  const [afiliasiPct, setAfiliasiPct] = useState(5);
  const [gmvPct, setGmvPct] = useState(3);
  const [liveAdsPct, setLiveAdsPct] = useState(3);

  // Simulasi Diskon Campaign / Promosi Seller
  const [ikutPromo, setIkutPromo] = useState(false);
  const [diskonType, setDiskonType] = useState<"pct"|"nominal">("pct");
  const [diskonVal, setDiskonVal] = useState(10); // misal diskon 10%

  const totalOps = ops.reduce((s,o)=>s+o.nominal,0);

  // Perhitungan Diskon Seller (mengurangi dasar perhitungan komisi)
  const diskonSellerNominal = !ikutPromo
    ? 0
    : diskonType === "pct"
      ? (diskonVal / 100) * hargaJual
      : Math.min(diskonVal, hargaJual);

  // Harga setelah diskon seller (Dasar Perhitungan Komisi Platform & Dinamis)
  const hargaSetelahDiskon = Math.max(0, hargaJual - diskonSellerNominal);

  // GMV Max discount on platform commission
  const gmvDisc = (platform==="tiktok" && active.gmv_max)
    ? (gmvPct>=3?0.30:gmvPct>=1?0.15:0) : 0;
  
  const komisiBase = kat.komisi * (1 - gmvDisc);
  const komisiNom = Math.round((komisiBase / 100) * hargaSetelahDiskon);
  const dinNom = active.komisi_dinamis ? Math.round(Math.min((dinamisPct / 100) * hargaSetelahDiskon, dinamisCap)) : 0;
  const prosesNom = active.biaya_proses ? 1250 : 0;
  const pph22Nom = active.pph22 ? Math.round((0.5 / 100) * hargaSetelahDiskon) : 0;
  const growthXtraNom = (active.growth_xtra && platform==="tiktok") ? Math.round((growthXtraPct / 100) * hargaSetelahDiskon) : 0;
  const logistikNom = active.biaya_logistik ? biayaLogistikNom : 0;
  const mallNom = (active.mall_fee || isMall) ? Math.round(Math.min((1.8 / 100) * hargaSetelahDiskon, 50000)) : 0;
  const ongkirNom = active.gratis_ongkir ? Math.round((5.5 / 100) * hargaSetelahDiskon) : 0;
  const voucherNom = active.voucher_xtra ? Math.round(Math.min((3.5 / 100) * hargaSetelahDiskon, 20000)) : 0;
  const poNom = (active.pre_order && platform==="tiktok") ? Math.round((3 / 100) * hargaSetelahDiskon) : 0;
  const afilNom = active.afiliasi ? Math.round((afiliasiPct / 100) * hargaSetelahDiskon) : 0;
  const gmvNom = (active.gmv_max && platform==="tiktok") ? Math.round((gmvPct / 100) * hargaSetelahDiskon) : 0;
  const topadNom = (active.topads && platform==="tokopedia") ? Math.round((3 / 100) * hargaSetelahDiskon) : 0;
  const liveNom = (active.live_ads && platform==="tiktok") ? Math.round((liveAdsPct / 100) * hargaSetelahDiskon) : 0;
  const cashNom = active.cashback_bonus ? Math.round((2 / 100) * hargaSetelahDiskon) : 0;

  const totalPlatform = komisiNom + dinNom + prosesNom + pph22Nom + growthXtraNom + logistikNom + mallNom + ongkirNom + voucherNom + poNom + afilNom + gmvNom + topadNom + liveNom + cashNom;
  
  // Jumlah Penyelesaian Pembayaran = yang masuk ke saldo TikTok/platform
  const jumlahPenyelesaian = hargaSetelahDiskon - totalPlatform;

  // Keuntungan Bersih: Pembeli bayar (Harga Jual - Diskon Seller) - Potongan Platform - Modal Beli - Ops
  const cuan = jumlahPenyelesaian - hargaBeli - totalOps;
  const marginPct = hargaSetelahDiskon > 0 ? (cuan / hargaSetelahDiskon) * 100 : 0;
  const roiPct = (hargaBeli + totalOps) > 0 ? (cuan / (hargaBeli + totalOps)) * 100 : 0;
  const potPct = hargaSetelahDiskon > 0 ? ((totalPlatform + totalOps) / hargaSetelahDiskon) * 100 : 0;

  // Fungsi kalkulasi target harga jual
  function calcH(tm=0){
    const base = hargaBeli + totalOps;
    for(let h = base; h <= 10_000_000; h += 10){
      const disc = !ikutPromo ? 0 : (diskonType === "pct" ? (diskonVal/100)*h : diskonVal);
      const hClean = Math.max(0, h - disc);
      const kb = kat.komisi * (1 - gmvDisc);
      const kn = Math.round((kb / 100) * hClean);
      const dn = active.komisi_dinamis ? Math.round(Math.min((dinamisPct / 100) * hClean, dinamisCap)) : 0;
      const pn = active.biaya_proses ? 1250 : 0;
      const ppn = active.pph22 ? Math.round((0.5 / 100) * hClean) : 0;
      const gxn = (active.growth_xtra && platform==="tiktok") ? Math.round((growthXtraPct / 100) * hClean) : 0;
      const ln = active.biaya_logistik ? biayaLogistikNom : 0;
      const mn = (active.mall_fee || isMall) ? Math.round(Math.min((1.8 / 100) * hClean, 50000)) : 0;
      const on = active.gratis_ongkir ? Math.round((5.5 / 100) * hClean) : 0;
      const vn = active.voucher_xtra ? Math.round(Math.min((3.5 / 100) * hClean, 20000)) : 0;
      const po = (active.pre_order && platform==="tiktok") ? Math.round((3 / 100) * hClean) : 0;
      const an = active.afiliasi ? Math.round((afiliasiPct / 100) * hClean) : 0;
      const gn = (active.gmv_max && platform==="tiktok") ? Math.round((gmvPct / 100) * hClean) : 0;
      const tn = (active.topads && platform==="tokopedia") ? Math.round((3 / 100) * hClean) : 0;
      const lvn = (active.live_ads && platform==="tiktok") ? Math.round((liveAdsPct / 100) * hClean) : 0;
      const cn = active.cashback_bonus ? Math.round((2 / 100) * hClean) : 0;
      const pot = kn + dn + pn + ppn + gxn + ln + mn + on + vn + po + an + gn + tn + lvn + cn;
      if(hClean > 0 && ((hClean - pot - base) / hClean) * 100 >= tm) {
        return Math.ceil(h / 100) * 100;
      }
    }
    return base;
  }
  const bep = calcH(0), h20 = calcH(20), h30 = calcH(30);

  const status = cuan > 0
    ? {label:"✅ UNTUNG", cls:"text-green-700 bg-green-50 border-green-300"}
    : cuan === 0
      ? {label:"⚠️ IMPAS", cls:"text-yellow-700 bg-yellow-50 border-yellow-300"}
      : {label:"❌ RUGI", cls:"text-red-700 bg-red-50 border-red-300"};

  const detailPlat = [
    {label:`Komisi Platform Grp ${kat.grp}${gmvDisc>0?` (diskon GMV ${(gmvDisc*100).toFixed(0)}%)`:""} (${komisiBase.toFixed(2)}%)`, nom:komisiNom, show:true, wajib:true},
    {label:`Komisi Dinamis (${dinamisPct}%, cap Rp${(dinamisCap/1000).toFixed(0)}rb)`, nom:dinNom, show:active.komisi_dinamis, wajib:true},
    {label:"Biaya Pemrosesan Order (Flat Rp1.250)", nom:prosesNom, show:active.biaya_proses, wajib:true},
    {label:"PPh Pasal 22 (0.5% pajak e-Commerce)", nom:pph22Nom, show:active.pph22, wajib:true},
    {label:`Biaya Layanan Growth Xtra (${growthXtraPct}%)`, nom:growthXtraNom, show:active.growth_xtra && platform==="tiktok"},
    {label:`Biaya Layanan Logistik Platform`, nom:logistikNom, show:active.biaya_logistik},
    {label:"Biaya Layanan Mall (1.8%, cap Rp50rb)", nom:mallNom, show:(active.mall_fee || isMall)},
    {label:"Gratis Ongkir XTRA (~5.5%)", nom:ongkirNom, show:active.gratis_ongkir},
    {label:"Voucher XTRA (3.5%, cap Rp20rb)", nom:voucherNom, show:active.voucher_xtra},
    {label:"Pre-Order 3% (TikTok only)", nom:poNom, show:active.pre_order && platform==="tiktok"},
    {label:`Afiliasi Kreator (${afiliasiPct}%)`, nom:afilNom, show:active.afiliasi},
    {label:`GMV Max Ads (${gmvPct}%)`, nom:gmvNom, show:active.gmv_max && platform==="tiktok"},
    {label:"TopAds Tokopedia (~3%)", nom:topadNom, show:active.topads && platform==="tokopedia"},
    {label:`LIVE Ads (~${liveAdsPct}%)`, nom:liveNom, show:active.live_ads && platform==="tiktok"},
    {label:"Biaya Layanan Cashback Bonus (~2%)", nom:cashNom, show:active.cashback_bonus},
  ].filter(d=>d.show);

  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  useEffect(() => {
    const fetchAiPrompt = async () => {
      try {
        const snap = await sbGetDoc('settings', "system");
        if (snap.exists()) {
          const data = snap.data();
          if (data.store?.aiPromptTiktok) {
            setAiPrompt(data.store.aiPromptTiktok);
          }
        }
      } catch (err) {
        console.error("Failed to load AI Prompt", err);
      }
    };
    fetchAiPrompt();
  }, []);
  
  // Fungsi Rekomendasi AI
  const getAiStrategy = () => {
    let margin = (cuan / hargaSetelahDiskon) * 100;
    let saran = [];
    
    if (ikutPromo) {
      saran.push(`🎯 Simulasi Campaign Aktif: Diskon penjual ${diskonType==="pct"?`${diskonVal}%`:formatRp(diskonVal)}. Mengurangi dasar komisi platform.`);
    }

    if (margin < 10) {
      saran.push("🔴 Margin Tipis (<10%). Jangan ikut Voucher XTRA atau diskon tinggi bersamaan. Fokus promosi organik & bundling paket!");
    } else if (margin >= 10 && margin <= 25) {
      saran.push("🟡 Margin Sehat (10-25%). Waktunya scale-up! Pasang Afiliasi kreator (5-8%) atau aktifkan Gratis Ongkir.");
    } else {
      saran.push("🟢 Margin Tebal (>25%). Sangat aman ikut Mega Sale / Co-Funded Campaign dan push LIVE Ads serta komisi afiliasi 10-15%.");
    }

    if (platform === "tiktok") {
      saran.push("💡 Tips TikTok: Transaksi via LIVE mendapatkan tarif komisi platform lebih hemat. Siapkan LIVE Flash Sale saat jam 19.30 - 22.00.");
      if (active.gmv_max && gmvPct >= 3) {
        saran.push("✨ GMV Max >3% aktif: Anda menghemat 30% komisi platform di seluruh pesanan toko!");
      }
    } else {
      saran.push("💡 Tips Tokopedia: Fitur Pre-Order 100% GRATIS (di TikTok kena biaya 3%). Manfaatkan untuk produk custom/PO.");
    }

    if (aiPrompt) {
      aiPrompt.split("\n").filter(Boolean).forEach(p => saran.push(p));
    }

    return saran;
  };

  const activeStr = STRATEGI.find(s=>s.id===strTab);
  const strIdx = STRATEGI.findIndex(s=>s.id===strTab);

  const platformPrograms = ALL_PROGRAMS.filter(p =>
    platform==="tiktok" ? p.tiktok : p.tokopedia
  );

  return (
    <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-black text-gray-100 min-h-screen" style={{fontFamily:"system-ui,sans-serif"}}>

      {/* HEADER MODERN */}
      <div className="p-6 lg:p-8 shadow-2xl rounded-b-3xl relative overflow-hidden" style={{background:"linear-gradient(135deg,#0c0c0c 0%,#19091f 40%,#2c0919 100%)"}}>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-transparent pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
            <div className="flex -space-x-2">
              <div className="w-14 h-14 rounded-3xl bg-black/80 backdrop-blur flex items-center justify-center border-2 border-gray-700 shadow-xl">
                <svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#010101"/><text x="16" y="22" textAnchor="middle" fontSize="22" fill="white">♪</text></svg>
              </div>
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center border-2 border-green-500 shadow-xl" style={{background:"linear-gradient(135deg,#03ac0e,#10b981)"}}>
                <span className="text-white font-black text-lg">T</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight bg-gradient-to-r from-white via-pink-200 to-gray-300 bg-clip-text text-transparent">
                  Kalkulator Cuan & Campaign TikTok Shop x Tokopedia
                </h1>
                <span className="bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Skema 2026
                </span>
              </div>
              <p className="text-gray-300 text-sm font-medium opacity-90">
                Komisi Terintegrasi · Cap Dinamis Rp60rb · Biaya Logistik & Mall · Simulasi Diskon Campaign Lengkap
              </p>
              
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <span className="bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold px-3 py-1 rounded-full">
                  Komisi 1.05% – 9.5% (Snack/Bakpia)
                </span>
                <span className="bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1 rounded-full">
                  Cap Dinamis Max Rp60.000
                </span>
                <button
                  onClick={() => {
                    // Quick test: Bakpia Rp14.892 → target Rp10.750
                    setKat(KATEGORI.find(k=>k.id==="snack_bakpia") || KATEGORI[0]);
                    setHargaBeli(0); setHargaJual(14892);
                    setActive(prev=>({...prev, komisi_dinamis:true, biaya_proses:true, pph22:true, growth_xtra:true, biaya_logistik:false, gratis_ongkir:false, voucher_xtra:false, afiliasi:true}));
                    setDinamisPct(6.5); setAfiliasiPct(0.48);
                    setGrowthXtraPct(3.5);
                    setOps(INIT_OPS.map(o=>({...o, nominal:0})));
                    setPlatform("tiktok");
                    setMainTab("kalkulator");
                  }}
                  className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  🍪 Uji: Bakpia Rp14.892 → Rp10.750
                </button>
                <button onClick={() => setShowAi(!showAi)} className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 px-3.5 py-1 rounded-full text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm">
                  <span>✨</span> {showAi ? "Tutup AI Strategi" : "Analisis AI Margin"}
                </button>
              </div>

              {showAi && (
                <div className="mt-4 bg-black/75 backdrop-blur-md border border-purple-500/40 rounded-2xl p-4 shadow-xl animate-in fade-in zoom-in duration-200">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    🤖 Rekomendasi AI berdasarkan margin ({marginPct.toFixed(1)}%)
                  </h3>
                  <div className="space-y-1.5">
                    {getAiStrategy().map((saran, i) => (
                      <p key={i} className="text-xs text-gray-200 leading-relaxed">• {saran}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Switch Platform & Tipe Toko */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-800">
            <div className="flex bg-gray-900/90 p-1 rounded-2xl border border-gray-700/80">
              <button onClick={()=>setPlatform("tiktok")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${platform==="tiktok"?"bg-white text-gray-950 shadow-lg":"text-gray-400 hover:text-white"}`}>
                <span>♪</span> TikTok Shop
              </button>
              <button onClick={()=>setPlatform("tokopedia")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${platform==="tokopedia"?"bg-green-500 text-white shadow-lg":"text-gray-400 hover:text-white"}`}>
                <span>🟢</span> Tokopedia
              </button>
            </div>

            <div className="flex bg-gray-900/90 p-1 rounded-2xl border border-gray-700/80">
              <button onClick={()=>{setIsMall(false); setActive(p=>({...p, mall_fee:false}));}}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${!isMall?"bg-gray-800 text-white shadow-md":"text-gray-400 hover:text-white"}`}>
                <span>🏪</span> Regular / Power Merchant
              </button>
              <button onClick={()=>{setIsMall(true); setActive(p=>({...p, mall_fee:true}));}}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${isMall?"bg-purple-600 text-white shadow-md":"text-gray-400 hover:text-white"}`}>
                <span>👑</span> Official Store / Mall (+1.8%)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-gray-900/80 border border-gray-800 rounded-2xl p-1 gap-1 mb-4 shadow-sm">
          {[
            ["kalkulator", "🧮 Kalkulator Cuan"],
            ["campaign", "🎪 Jenis Campaign & Promo"],
            ["semua_program", "📋 Semua Program Biaya"],
            ["strategi", "💡 Panduan Strategi"],
          ].map(([t,l])=>(
            <button key={t} onClick={()=>setMainTab(t)}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${mainTab===t?"bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md":"text-gray-400 hover:text-white hover:bg-gray-800/50"}`}>
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

            {/* Kategori */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 shadow-md">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kategori Produk</p>
                <span className="text-xs text-pink-400 font-semibold">{kat.label.replace(/^[^\s]+\s/,"")}</span>
              </div>
              <button onClick={()=>setShowKat(!showKat)}
                className="w-full flex items-center justify-between bg-gray-800/90 border border-gray-700 hover:border-pink-500 rounded-xl px-3.5 py-3 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{kat.label.split(" ")[0]}</span>
                  <div className="text-left">
                    <p className="font-bold text-white text-sm">{kat.label.replace(/^[^\s]+\s/,"")}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${GRP_COLOR[kat.grp as keyof typeof GRP_COLOR]}`}>Grup {kat.grp}</span>
                      <span className="text-xs font-extrabold text-pink-400">Komisi {kat.komisi}%</span>
                    </div>
                  </div>
                </div>
                <span className="text-gray-400 text-xs px-2 py-1 bg-gray-700 rounded-lg">{showKat?"▲ Tutup":"▼ Ganti"}</span>
              </button>

              {showKat && (
                <div className="mt-3 rounded-xl overflow-hidden max-h-64 overflow-y-auto border border-gray-700 bg-gray-950">
                  {GROUPS.map(g=>(
                    <div key={g}>
                      <div className={`px-3 py-1.5 text-xs font-bold sticky top-0 border-b ${GRP_COLOR[g as keyof typeof GRP_COLOR]}`}>
                        {GRP_LABEL[g as keyof typeof GRP_LABEL]}
                      </div>
                      {KATEGORI.filter(k=>k.grp===g).map(k=>(
                        <button key={k.id} onClick={()=>{setKat(k);setShowKat(false);}}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-800 text-left transition-all border-b border-gray-800/40 ${kat.id===k.id?"bg-pink-950/40 text-pink-300 font-bold":"text-gray-300"}`}>
                          <span>{k.label.split(" ")[0]}</span>
                          <div className="flex-1 min-w-0">
                            <p>{k.label.replace(/^[^\s]+\s/,"")}</p>
                            <p className="text-[11px] text-gray-500 truncate">{k.contoh}</p>
                          </div>
                          {kat.id===k.id&&<span className="text-pink-400 font-bold">✓</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal & Harga Jual */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 shadow-md space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Modal / Harga Beli (HPP Produk)</p>
                  <span className="text-xs font-bold text-gray-300">{formatRp(hargaBeli)}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input type="range" min={100} max={2000000} step={100} value={hargaBeli}
                    onChange={e=>setHargaBeli(Number(e.target.value))} className="flex-1 accent-pink-500"/>
                  <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-xl px-2.5 py-1.5 min-w-fit">
                    <span className="text-gray-400 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaBeli} onChange={e=>setHargaBeli(Number(e.target.value))}
                      className="w-24 bg-transparent text-white font-bold text-xs outline-none"/>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Harga Jual Normal (Katalog Toko)</p>
                  <span className="text-xs font-bold text-pink-400">{formatRp(hargaJual)}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input type="range" min={Math.max(bep,100)} max={Math.max(hargaBeli*4, 1000000)} step={100}
                    value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))} className="flex-1 accent-pink-500"/>
                  <div className="flex items-center gap-1 bg-gray-800 border border-pink-500/60 rounded-xl px-2.5 py-1.5 min-w-fit shadow-inner">
                    <span className="text-pink-400 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))}
                      className="w-24 bg-transparent text-pink-300 font-bold text-xs outline-none"/>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  <button onClick={()=>setHargaJual(bep)} className="text-xs bg-red-950/70 border border-red-800 text-red-300 rounded-xl py-2 font-bold hover:bg-red-900 transition-all">
                    BEP {formatRp(bep)}
                  </button>
                  <button onClick={()=>setHargaJual(h20)} className="text-xs bg-yellow-950/70 border border-yellow-800 text-yellow-300 rounded-xl py-2 font-bold hover:bg-yellow-900 transition-all">
                    Margin 20% ({formatRp(h20)})
                  </button>
                  <button onClick={()=>setHargaJual(h30)} className="text-xs bg-green-950/70 border border-green-800 text-green-300 rounded-xl py-2 font-bold hover:bg-green-900 transition-all">
                    Margin 30% ({formatRp(h30)})
                  </button>
                </div>
              </div>

              {/* FITUR BARU: Simulasi Diskon Campaign Seller */}
              <div className="pt-3 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ikutPromo} onChange={e=>setIkutPromo(e.target.checked)}
                      className="w-4 h-4 accent-pink-500 rounded"/>
                    <span className="text-xs font-bold text-pink-300">🎪 Ikut Campaign / Diskon Penjual</span>
                  </label>
                  {ikutPromo && (
                    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5 border border-gray-700">
                      <button onClick={()=>setDiskonType("pct")} className={`text-[10px] font-bold px-2 py-0.5 rounded ${diskonType==="pct"?"bg-pink-600 text-white":"text-gray-400"}`}>%</button>
                      <button onClick={()=>setDiskonType("nominal")} className={`text-[10px] font-bold px-2 py-0.5 rounded ${diskonType==="nominal"?"bg-pink-600 text-white":"text-gray-400"}`}>Rp</button>
                    </div>
                  )}
                </div>

                {ikutPromo && (
                  <div className="mt-2.5 bg-pink-950/30 border border-pink-800/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-300 font-medium">Besaran Diskon:</span>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={diskonVal} onChange={e=>setDiskonVal(Math.max(0, Number(e.target.value)))}
                          className="w-20 bg-gray-800 border border-pink-500 rounded-lg px-2 py-1 text-right text-xs font-bold text-white outline-none"/>
                        <span className="text-xs font-bold text-pink-400">{diskonType==="pct"?"%":"Rp"}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-300 pt-1 border-t border-pink-900/40">
                      <span>Harga Bersih Pembeli (Basis Komisi):</span>
                      <span className="font-extrabold text-white text-sm">{formatRp(hargaSetelahDiskon)}</span>
                    </div>
                    <p className="text-[11px] text-pink-300/80 leading-relaxed">
                      💡 Komisi platform & dinamis resmi dihitung dari <strong>(Harga Jual - Diskon Seller)</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Biaya Operasional / Packing */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border-l-4 border-pink-500 border-t border-r border-b border-gray-800 shadow-md">
              <div className="flex justify-between items-center mb-2.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">📦 Biaya Operasional & Packing</p>
                <span className="text-xs font-extrabold text-pink-400">{formatRp(totalOps)} / pesanan</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ops.map((o,i)=>(
                  <div key={o.id} className="flex items-center justify-between bg-gray-800/60 px-2.5 py-1.5 rounded-xl border border-gray-800">
                    <span className="text-xs text-gray-300">{o.label}</span>
                    <NominalInput value={o.nominal} onChange={(val: number)=>{const n=[...ops];n[i]={...o,nominal:val};setOps(n);}}/>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">💡 Nilai di atas adalah estimasi per pesanan. Klik nominal untuk mengubah.</p>
            </div>

            {/* Program Biaya Platform & Pengaturan Cap */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 shadow-md space-y-3">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">⚙️ Pengaturan Komisi & Program ({platform==="tiktok"?"TikTok Shop":"Tokopedia"})</p>
                <button onClick={()=>setMainTab("semua_program")} className="text-xs text-pink-400 underline font-semibold">Lihat Detail Program →</button>
              </div>

              {/* Komisi Platform */}
              <div className="bg-red-950/30 border border-red-800/60 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-red-300 font-bold">1. Komisi Platform Grup {kat.grp} — {komisiBase.toFixed(2)}%</p>
                  <span className="text-[10px] bg-red-800/60 text-red-200 px-2 py-0.5 rounded font-bold">WAJIB</span>
                </div>
                {gmvDisc > 0 && <p className="text-xs text-green-400 font-semibold mt-0.5">Diskon GMV Max {(gmvDisc*100).toFixed(0)}% aktif</p>}
                <p className="text-[11px] text-red-400/80 mt-1">Otomatis dihitung dari harga item setelah diskon seller.</p>
              </div>

              {/* Komisi Dinamis dengan Pilihan Cap Terbaru Rp60rb vs Rp40rb */}
              <div className="bg-red-950/30 border border-red-800/60 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={active.komisi_dinamis} onChange={e=>setActive(p=>({...p,komisi_dinamis:e.target.checked}))} className="accent-red-500 w-3.5 h-3.5"/>
                    <p className="text-xs font-bold text-red-300">2. Komisi Dinamis (Free Shipping Voucher Subsidy)</p>
                  </label>
                  <span className="text-[10px] bg-red-800/60 text-red-200 px-2 py-0.5 rounded font-bold">WAJIB</span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Tarif:</span>
                    {[4,5,6,6.5].map(v=>(
                      <button key={v} onClick={()=>setDinamisPct(v)}
                        className={`text-xs px-2 py-0.5 rounded-lg font-bold border transition-all ${
                          dinamisPct===v?"bg-red-500 text-white border-red-500":"bg-gray-800 text-red-400 border-red-900"
                        }`}>{v}%{v===6.5?<span className="text-[9px] ml-0.5">🍪</span>:null}</button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Cap Max:</span>
                    {[60000, 40000].map(c=>(
                      <button key={c} onClick={()=>setDinamisCap(c)}
                        className={`text-xs px-2 py-0.5 rounded-lg font-bold border transition-all ${dinamisCap===c?"bg-pink-600 text-white border-pink-600":"bg-gray-800 text-pink-300 border-gray-700"}`}>
                        Rp{(c/1000).toFixed(0)}rb {c===60000?"(Terbaru)":""}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* PPh 22 + Growth Xtra + Biaya Pemrosesan & Biaya Logistik */}
              <div className="bg-amber-950/30 border border-amber-700/50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-amber-300 mb-1">💡 Potongan Wajib (sesuai settlement nyata Bakpia Rp14.892)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-2.5 flex items-start gap-2">
                    <input type="checkbox" checked={active.biaya_proses} disabled className="accent-gray-500 w-3.5 h-3.5 mt-0.5"/>
                    <div>
                      <p className="text-xs text-gray-300 font-bold">Biaya Pemrosesan Order</p>
                      <p className="text-[11px] text-amber-400">Rp1.250 flat (✓ Verified)</p>
                    </div>
                  </div>

                  <div className="bg-gray-800/80 border border-red-800/40 rounded-xl p-2.5 flex items-start gap-2">
                    <input type="checkbox" checked={active.pph22} onChange={e=>setActive(p=>({...p,pph22:e.target.checked}))} className="accent-red-500 w-3.5 h-3.5 mt-0.5"/>
                    <div>
                      <p className="text-xs text-red-300 font-bold">PPh Pasal 22 (0.5%)</p>
                      <p className="text-[11px] text-amber-400">-Rp74 pada Rp14.892 (✓ Verified)</p>
                    </div>
                  </div>

                  {platform==="tiktok" && (
                    <div className="bg-gray-800/80 border border-amber-700/40 rounded-xl p-2.5 sm:col-span-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={active.growth_xtra} onChange={e=>setActive(p=>({...p,growth_xtra:e.target.checked}))} className="accent-amber-500 w-3.5 h-3.5 mt-0.5"/>
                        <div className="flex-1">
                          <p className="text-xs text-amber-300 font-bold">Biaya Layanan Growth Xtra</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[11px] text-amber-400">-Rp521 pada Rp14.892 (✓ Verified)</p>
                            {active.growth_xtra && (
                              <div className="flex items-center gap-1">
                                {[3, 3.5, 4].map(v=>(
                                  <button key={v} onClick={()=>setGrowthXtraPct(v)}
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${growthXtraPct===v?"bg-amber-600 text-white border-amber-500":"bg-gray-800 text-amber-300 border-gray-700"}`}>{v}%{v===3.5?" 🍪":""}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-2.5 flex items-start justify-between gap-2 sm:col-span-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={active.biaya_logistik} onChange={e=>setActive(p=>({...p,biaya_logistik:e.target.checked}))} className="accent-gray-500 w-3.5 h-3.5 mt-0.5"/>
                      <div>
                        <p className="text-xs text-gray-300 font-bold">Biaya Logistik Platform</p>
                        <p className="text-[11px] text-gray-400">Rp0 di settlement nyata (ongkir ditanggung pembeli)</p>
                      </div>
                    </label>
                    {active.biaya_logistik && (
                      <NominalInput value={biayaLogistikNom} onChange={setBiayaLogistikNom}/>
                    )}
                  </div>
                </div>
              </div>

              {/* Program Tambahan Toggle Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Gratis Ongkir Xtra */}
                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-2.5 flex items-start gap-2">
                  <input type="checkbox" checked={active.gratis_ongkir} onChange={e=>setActive(p=>({...p,gratis_ongkir:e.target.checked}))} className="accent-green-500 w-3.5 h-3.5 mt-0.5"/>
                  <div>
                    <p className="text-xs text-gray-200 font-semibold">Gratis Ongkir XTRA (~5.5%)</p>
                    <p className="text-[11px] text-gray-400">Meningkatkan konversi & CTR</p>
                  </div>
                </div>

                {/* Voucher Xtra */}
                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-2.5 flex items-start gap-2">
                  <input type="checkbox" checked={active.voucher_xtra} onChange={e=>setActive(p=>({...p,voucher_xtra:e.target.checked}))} className="accent-blue-500 w-3.5 h-3.5 mt-0.5"/>
                  <div>
                    <p className="text-xs text-gray-200 font-semibold">Voucher XTRA (~3.5%)</p>
                    <p className="text-[11px] text-gray-400">Cap Rp20.000 / item</p>
                  </div>
                </div>

                {/* Pre-order (Hanya TikTok) */}
                {platform==="tiktok" ? (
                  <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-2.5 flex items-start gap-2">
                    <input type="checkbox" checked={active.pre_order} onChange={e=>setActive(p=>({...p,pre_order:e.target.checked}))} className="accent-orange-500 w-3.5 h-3.5 mt-0.5"/>
                    <div>
                      <p className="text-xs text-gray-200 font-semibold">Pre-Order (+3%) <span className="text-pink-400">[TikTok]</span></p>
                      <p className="text-[11px] text-gray-400">Produk PO dikenai fee 3%</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800/40 border border-gray-800 rounded-xl p-2.5 flex items-start gap-2 opacity-60">
                    <input type="checkbox" disabled className="w-3.5 h-3.5 mt-0.5"/>
                    <div>
                      <p className="text-xs text-gray-400 line-through">Pre-Order (+3%)</p>
                      <p className="text-[11px] text-green-400 font-bold">✓ GRATIS di Tokopedia!</p>
                    </div>
                  </div>
                )}

                {/* Afiliasi Kreator */}
                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-2.5">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={active.afiliasi} onChange={e=>setActive(p=>({...p,afiliasi:e.target.checked}))} className="accent-pink-500 w-3.5 h-3.5 mt-0.5"/>
                    <div>
                      <p className="text-xs text-gray-200 font-semibold">Komisi Afiliasi Kreator</p>
                      <p className="text-[11px] text-gray-400">Promosi via video/live kreator</p>
                    </div>
                  </div>
                  {active.afiliasi && (
                    <div className="flex items-center gap-1 mt-2 pl-5">
                      {[3, 5, 8, 10, 15].map(v=>(
                        <button key={v} onClick={()=>setAfiliasiPct(v)}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${afiliasiPct===v?"bg-pink-600 text-white border-pink-500":"bg-gray-800 text-pink-300 border-gray-700"}`}>{v}%</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* GMV Max (TikTok only) */}
                {platform==="tiktok" && (
                  <div className="bg-green-950/30 border border-green-800/60 rounded-xl p-2.5 col-span-1 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={active.gmv_max} onChange={e=>setActive(p=>({...p,gmv_max:e.target.checked}))} className="accent-green-500 w-3.5 h-3.5"/>
                        <p className="text-xs text-green-300 font-bold">GMV Max / Shop Ads 🎁 Diskon Komisi Platform</p>
                      </label>
                      <span className="text-[10px] bg-green-900/60 text-green-300 px-2 py-0.5 rounded font-semibold">Hemat s/d 30%</span>
                    </div>
                    {active.gmv_max && (
                      <div className="flex items-center gap-2 mt-2 pl-5">
                        <span className="text-xs text-gray-400">Budget:</span>
                        {[1, 2, 3, 5].map(v=>(
                          <button key={v} onClick={()=>setGmvPct(v)}
                            className={`text-xs px-2 py-0.5 rounded font-bold border ${gmvPct===v?"bg-green-600 text-white border-green-500":"bg-gray-800 text-green-300 border-gray-700"}`}>{v}%</button>
                        ))}
                        {gmvDisc > 0 && <span className="text-xs text-green-400 font-bold ml-1">Diskon Komisi: {(gmvDisc*100).toFixed(0)}%</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KOLOM KANAN (Hasil Perhitungan & Ringkasan Cuan) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Box Hasil Utama */}
            <div className={`rounded-2xl p-5 border-2 shadow-2xl ${status.cls}`}>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-extrabold text-base text-gray-900">Hasil Akhir Per Pesanan</p>
                  <p className="text-xs text-gray-600">{platform==="tiktok"?"TikTok Shop":"Tokopedia"} · {isMall?"Official Store / Mall":"Regular Merchant"}</p>
                </div>
                <span className={`font-extrabold text-xs px-3 py-1 rounded-full border-2 ${status.cls}`}>{status.label}</span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-800">
                <div className="flex justify-between font-bold text-sm text-gray-900">
                  <span>Harga Jual Normal</span>
                  <span>{formatRp(hargaJual)}</span>
                </div>
                {ikutPromo && diskonSellerNominal > 0 && (
                  <div className="flex justify-between text-pink-700 font-semibold">
                    <span>Diskon Penjual ({diskonType==="pct"?`${diskonVal}%`:formatRp(diskonVal)})</span>
                    <span>-{formatRp(diskonSellerNominal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-gray-900 pb-1 border-b border-gray-300">
                  <span>Harga Bersih (Diterima Pembeli)</span>
                  <span>{formatRp(hargaSetelahDiskon)}</span>
                </div>

                {detailPlat.map((d,i)=>(
                  <div key={i} className={`flex justify-between ${d.wajib?"text-red-700 font-semibold text-xs":"text-orange-700"}`}>
                    <span>{d.label}</span>
                    <span className="font-bold">-{formatRp(d.nom)}</span>
                  </div>
                ))}

                {/* Jumlah Penyelesaian Pembayaran (Saldo TikTok/Platform) */}
                <div className="flex justify-between text-blue-800 font-bold pt-1 border-t border-blue-200 bg-blue-50/50 px-2 py-1.5 rounded-lg -mx-1">
                  <div>
                    <span className="text-xs">💳 Jumlah Penyelesaian (Masuk Saldo {platform==="tiktok"?"TikTok":"Tokopedia"})</span>
                    {platform==="tiktok" && hargaSetelahDiskon >= 14000 && hargaSetelahDiskon <= 15500 && (
                      <p className="text-[10px] text-blue-600">Settlement nyata Bakpia Rp14.892 → Rp10.750</p>
                    )}
                  </div>
                  <span className="font-black text-sm">{formatRp(jumlahPenyelesaian)}</span>
                </div>

                <div className="flex justify-between text-orange-800 font-semibold border-t border-gray-200 pt-1">
                  <span>Total Biaya Operasional / Packing</span>
                  <span>-{formatRp(totalOps)}</span>
                </div>
                <div className="flex justify-between text-red-700 font-semibold">
                  <span>Modal Produk (HPP)</span>
                  <span>-{formatRp(hargaBeli)}</span>
                </div>

                <div className="border-t-2 border-gray-900 pt-2.5 mt-2 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-black text-gray-950 uppercase tracking-wide">Keuntungan Bersih Toko</span>
                    <p className="text-[10px] text-gray-600">Setelah saldo masuk dikurangi HPP & operasional</p>
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
                  {label:"Total Potongan", val:potPct, d:potPct.toFixed(1)+"%"},
                ].map(s=>(
                  <div key={s.label} className="bg-white/80 backdrop-blur rounded-xl p-2.5 text-center shadow-sm border border-gray-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">{s.label}</p>
                    <p className={`font-black text-sm ${s.label==="Total Potongan"?"text-gray-900":(s.val>=20?"text-green-700":s.val>=10?"text-orange-600":"text-red-600")}`}>{s.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rekomendasi Target Harga */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 shadow-md">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">🎯 Rekomendasi Harga Jual Ideal</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-800/80 p-2.5 rounded-xl border border-gray-700">
                  <p className="text-[11px] text-red-400 font-bold">Impas (BEP)</p>
                  <p className="text-sm font-extrabold text-white mt-0.5">{formatRp(bep)}</p>
                </div>
                <div className="bg-gray-800/80 p-2.5 rounded-xl border border-gray-700">
                  <p className="text-[11px] text-yellow-400 font-bold">Margin 20%</p>
                  <p className="text-sm font-extrabold text-white mt-0.5">{formatRp(h20)}</p>
                </div>
                <div className="bg-gray-800/80 p-2.5 rounded-xl border border-gray-700">
                  <p className="text-[11px] text-green-400 font-bold">Margin 30%</p>
                  <p className="text-sm font-extrabold text-white mt-0.5">{formatRp(h30)}</p>
                </div>
              </div>
            </div>

            {/* Shortcut ke Tab Campaign */}
            <div className="rounded-2xl p-4 shadow-lg text-white" style={{background:"linear-gradient(135deg,#130a1c,#2b091e)"}}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-extrabold text-sm">🎪 Ingin Ikut Campaign TikTok Shop?</p>
                <span className="text-[10px] bg-pink-500/30 text-pink-300 px-2 py-0.5 rounded-full font-bold">Direktori Lengkap</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed mb-3">
                Ketahui jenis-jenis campaign resmi: Mega Sale, Payday, Co-Funded (patungan subsidi), Flash Sale LIVE, hingga Voucher Toko.
              </p>
              <button onClick={()=>setMainTab("campaign")}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-md">
                Buka Panduan & Jenis Campaign →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: JENIS CAMPAIGN & PROMOSI TIKTOK SHOP ── */}
      {mainTab==="campaign" && (
        <div className="max-w-7xl mx-auto px-4 pb-8 space-y-5">
          <div className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <span>🎪</span> Direktori Jenis Campaign & Alat Promosi TikTok Shop
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Panduan lengkap klasifikasi campaign resmi TikTok Shop by Tokopedia, syarat daftar, dan strategi cuan.
                </p>
              </div>
              <button onClick={()=>{setMainTab("kalkulator"); setIkutPromo(true);}}
                className="bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md w-fit">
                🧮 Simulasikan Margin Campaign di Kalkulator
              </button>
            </div>

            {/* Grid Kartu Jenis Campaign */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {CAMPAIGN_TYPES.map((c)=>(
                <div key={c.id} className="bg-gray-800/80 rounded-2xl border border-gray-700/80 p-4 hover:border-pink-500/50 transition-all flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{c.icon}</span>
                        <div>
                          <p className="font-extrabold text-white text-sm">{c.nama}</p>
                          <span className="text-[10px] text-gray-400 font-semibold">{c.kategori}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${c.badgeCls}`}>
                        {c.badge}
                      </span>
                    </div>

                    <div className="space-y-2 mt-3 text-xs">
                      <div className="bg-gray-900/70 p-2.5 rounded-xl border border-gray-800">
                        <p className="text-[11px] font-bold text-gray-400 uppercase">Jadwal / Periode:</p>
                        <p className="text-gray-200 mt-0.5">{c.jadwal}</p>
                      </div>

                      <div className="bg-gray-900/70 p-2.5 rounded-xl border border-gray-800">
                        <p className="text-[11px] font-bold text-gray-400 uppercase">Syarat Diskon / Promo:</p>
                        <p className="text-pink-300 font-semibold mt-0.5">{c.diskonMin}</p>
                      </div>

                      <div className="bg-gray-900/70 p-2.5 rounded-xl border border-gray-800">
                        <p className="text-[11px] font-bold text-gray-400 uppercase">Benefit & Manfaat:</p>
                        <p className="text-gray-300 mt-0.5">{c.manfaat}</p>
                      </div>

                      <div className="bg-gray-900/70 p-2.5 rounded-xl border border-gray-800">
                        <p className="text-[11px] font-bold text-gray-400 uppercase">Kriteria Seller:</p>
                        <p className="text-gray-400 mt-0.5">{c.kriteria}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-700/60 bg-gradient-to-r from-pink-950/20 to-purple-950/20 -mx-4 -mb-4 p-3 rounded-b-2xl">
                    <p className="text-[11px] text-pink-300 font-bold flex items-center gap-1">
                      <span>💡 Tips Cuan:</span> {c.tipsCuan}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rangkuman Matriks Strategi */}
          <div className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 shadow-md">
            <h3 className="font-extrabold text-base text-white mb-3">
              📊 Matriks Rekomendasi: Kapan Harus Ikut Campaign Apa?
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-gray-800/80 text-gray-400 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3 rounded-l-xl">Tujuan Toko</th>
                    <th className="p-3">Jenis Campaign Terbaik</th>
                    <th className="p-3">Beban Diskon Seller</th>
                    <th className="p-3 rounded-r-xl">Tips Margin Aman</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr>
                    <td className="p-3 font-semibold text-white">Clearing Stok / Produk Habis</td>
                    <td className="p-3 text-pink-400 font-bold">Seller Flash Sale (1-3 Jam)</td>
                    <td className="p-3 text-yellow-400 font-semibold">Tinggi (15% - 30%)</td>
                    <td className="p-3">Pasang tepat di harga BEP atau margin tipis 5% demi perputaran kas.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Mendongkrak Penjualan LIVE</td>
                    <td className="p-3 text-pink-400 font-bold">LIVE Flash Sale + LIVE Ads</td>
                    <td className="p-3 text-yellow-400 font-semibold">Sedang (10% - 15%)</td>
                    <td className="p-3">Komisi platform lebih hemat via LIVE, alihkan ke diskon penonton.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Panen Order & Brand Awareness</td>
                    <td className="p-3 text-pink-400 font-bold">Mega Sale (Double Date)</td>
                    <td className="p-3 text-yellow-400 font-semibold">Sedang - Tinggi (10% - 20%)</td>
                    <td className="p-3">Dapatkan subsidi voucher tambahan dari platform. Naikkan stok 3x lipat.</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Menaikkan Nilai Keranjang (AOV)</td>
                    <td className="p-3 text-pink-400 font-bold">Paket Combo / Bundling Beli 2</td>
                    <td className="p-3 text-yellow-400 font-semibold">Rendah (5% - 8%)</td>
                    <td className="p-3">Hemat biaya proses Rp1.250 & ongkos packing, laba bersih per transaksi melonjak!</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Menjaga Harga Tanpa Rusak Pasar</td>
                    <td className="p-3 text-pink-400 font-bold">Hadiah Gratis (GWP) / Free Sample</td>
                    <td className="p-3 text-yellow-400 font-semibold">Rendah (Biaya sampel)</td>
                    <td className="p-3">Harga produk tetap standar, pembeli merasa mendapat nilai ekstra.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: SEMUA PROGRAM BIAYA ── */}
      {mainTab==="semua_program" && (
        <div className="max-w-4xl mx-auto px-4 pb-8 space-y-4">
          <div className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={()=>setPlatform("tiktok")} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${platform==="tiktok"?"bg-pink-600 text-white shadow-md":"bg-gray-800 text-gray-400"}`}>♪ TikTok Shop</button>
              <button onClick={()=>setPlatform("tokopedia")} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${platform==="tokopedia"?"bg-green-600 text-white shadow-md":"bg-gray-800 text-gray-400"}`}>🟢 Tokopedia</button>
            </div>
            
            <h2 className="font-extrabold text-white text-base mb-1">
              📋 Rincian Lengkap Semua Komponen Biaya ({platform==="tiktok"?"TikTok Shop":"Tokopedia"})
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Berdasarkan dokumentasi resmi Seller University Tokopedia & TikTok Shop terbaru.
            </p>

            <div className="space-y-3">
              {platformPrograms.map((p,i)=>(
                <div key={p.id} className={`border rounded-xl p-3.5 ${p.badge==="WAJIB"?"border-red-900/80 bg-red-950/30":p.badge==="Perhatikan!"?"border-yellow-900/80 bg-yellow-950/30":"border-gray-800 bg-gray-800/60"}`}>
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-pink-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                      <p className="font-bold text-white text-sm">{p.label}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${p.badgeCls}`}>{p.badge}</span>
                      {!p.tiktok&&<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900 text-green-400 font-bold">Tokopedia only</span>}
                      {!p.tokopedia&&<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-900 text-pink-400 font-bold">TikTok only</span>}
                    </div>
                  </div>
                  <p className="text-xs font-extrabold text-pink-400 pl-7 mb-1">{p.tarif}</p>
                  <p className="text-xs text-gray-300 pl-7 leading-relaxed">{p.catatan}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Skenario Simulasi Biaya Realistis */}
          <div className="bg-gray-900/90 rounded-2xl p-5 border border-gray-800 shadow-md">
            <p className="font-extrabold text-white text-sm mb-3">🧮 Skenario Potongan Nyata (Contoh Kategori FMCG Grup 1, Harga Rp50.000)</p>
            {[
              {nama:"Minimal Standar (Wajib Saja)", pct:"~11.75%", cls:"bg-green-950/40 border-green-800", items:["Komisi 5.25%","Dinamis 4%","Proses Rp1.250","Logistik Rp1.000"]},
              {nama:"Sedang (+ Gratis Ongkir XTRA)", pct:"~17.25%", cls:"bg-yellow-950/40 border-yellow-800", items:["Komisi 5.25%","Dinamis 4%","Gratis Ongkir 5.5%","Proses Rp1.250","Logistik Rp1.000"]},
              {nama:"Promo Lengkap (+ Voucher XTRA + Afiliasi 5%)", pct:"~25.75%", cls:"bg-orange-950/40 border-orange-800", items:["Komisi 5.25%","Dinamis 4%","Ongkir 5.5%","Voucher 3.5%","Afiliasi 5%","Proses Rp1.250"]},
              {nama:"Mall / Official Store Lengkap", pct:"~27.55%", cls:"bg-purple-950/40 border-purple-800", items:["Mall 1.8%","Komisi 5.25%","Dinamis 4%","Ongkir 5.5%","Voucher 3.5%","Afiliasi 5%","Proses Rp1.250"]},
            ].map((s,i)=>(
              <div key={i} className={`mb-2.5 p-3 rounded-xl border ${s.cls}`}>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-gray-200">{s.nama}</p>
                  <span className={`text-xs font-extrabold ${i>=3?"text-purple-400":i>=2?"text-orange-400":i>=1?"text-yellow-400":"text-green-400"}`}>{s.pct}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{s.items.join(" + ")}</p>
              </div>
            ))}
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
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${strTab===s.id?"bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md":"bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800 hover:text-white"}`}>
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
                      <p className="text-white text-opacity-80 text-xs">Panduan Taktis TikTok Shop & Tokopedia Academy</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeStr.tips.map((tip,i)=>(
                    <div key={i} className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 hover:border-gray-700 transition-all shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-r ${activeStr.color} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>{i+1}</div>
                        <p className="font-bold text-white text-xs sm:text-sm">{tip.sub}</p>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed">{tip.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-4">
                  {strIdx > 0 ? (
                    <button onClick={()=>setStrTab(STRATEGI[strIdx-1].id)} className="text-xs font-semibold text-gray-400 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 hover:bg-gray-800">
                      ← {STRATEGI[strIdx-1].title}
                    </button>
                  ) : <div/>}
                  {strIdx < STRATEGI.length - 1 ? (
                    <button onClick={()=>setStrTab(STRATEGI[strIdx+1].id)} className="text-xs font-semibold text-white bg-pink-600 rounded-xl px-3 py-2 hover:bg-pink-700">
                      {STRATEGI[strIdx+1].title} →
                    </button>
                  ) : <div/>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-600 pb-6">
        TikTok Shop by Tokopedia Seller Academy · Skema Terintegrasi 2026
      </p>
    </div>
  );
}