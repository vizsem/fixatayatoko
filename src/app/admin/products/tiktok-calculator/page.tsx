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

// ── OPSI SKEMA CO-FUNDED VOUCHER TIKTOK SHOP & TOKOPEDIA (Update Gajian & 11.11 2026) ──
interface CoFundedTier {
  id: string;
  group: 'free' | 'xbp' | 'reg' | 'sp' | 'live_fest';
  groupLabel: string;
  label: string;
  diskonPembeli: number;
  platformPct: number;
  sellerPct: number;
  effectiveSellerPct: number;
  minBelanja: number;
  capSeller: number;
  badge: string;
  badgeCls: string;
  channel: string;
}

const CO_FUNDED_TIERS: CoFundedTier[] = [
  // ── 1. Bebas Biaya (100% Platform) ──
  {
    id: "boost_free",
    group: "free",
    groupLabel: "🟢 Bebas Biaya (0% Beban Seller)",
    label: "Voucher Boost (Voucher Platform s/d 20% XBP / 6% Non-XBP)",
    diskonPembeli: 20,
    platformPct: 100,
    sellerPct: 0,
    effectiveSellerPct: 0,
    minBelanja: 0,
    capSeller: 0,
    badge: "100% Platform",
    badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "growth_deal_free",
    group: "free",
    groupLabel: "🟢 Bebas Biaya (0% Beban Seller)",
    label: "Growth Xtra Special Deal Program (100% Subsidi TikTok Shop)",
    diskonPembeli: 25,
    platformPct: 100,
    sellerPct: 0,
    effectiveSellerPct: 0,
    minBelanja: 0,
    capSeller: 0,
    badge: "100% Subsidi TikTok",
    badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    channel: "TTS by Tokopedia"
  },

  // ── 2. [XBP] Co-Funded Voucher (Platform 65% : Penjual 35%) ──
  {
    id: "xbp_10_60k",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 10% (Beban Seller 3.50%) · Min. Belanja Rp60k (TTS Only)",
    diskonPembeli: 10,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 3.50,
    minBelanja: 60000,
    capSeller: 350000,
    badge: "XBP 3.5%",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "TTS Only"
  },
  {
    id: "xbp_10_100k",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 10% (Beban Seller 3.50%) · Min. Belanja Rp100k (Toko Only)",
    diskonPembeli: 10,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 3.50,
    minBelanja: 100000,
    capSeller: 420000,
    badge: "XBP 3.5%",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "Toko Only"
  },
  {
    id: "xbp_20_75k",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 20% (Beban Seller 7.00%) · Min. Belanja Rp75k (TTS Only)",
    diskonPembeli: 20,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 7.00,
    minBelanja: 75000,
    capSeller: 17500,
    badge: "XBP 7.0%",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "TTS Only"
  },
  {
    id: "xbp_20_100k",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 20% (Beban Seller 7.00%) · Min. Belanja Rp100k (TTS & Toko)",
    diskonPembeli: 20,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 7.00,
    minBelanja: 100000,
    capSeller: 35000,
    badge: "XBP 7.0%",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "xbp_20_130k",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 20% (Beban Seller 7.00%) · Min. Belanja Rp130k (TTS & Toko)",
    diskonPembeli: 20,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 7.00,
    minBelanja: 130000,
    capSeller: 87500,
    badge: "XBP 7.0%",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "xbp_25_300k",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 25% (Beban Seller 8.75%) · Min. Belanja Rp300k (TTS & Toko)",
    diskonPembeli: 25,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 8.75,
    minBelanja: 300000,
    capSeller: 105000,
    badge: "XBP 8.75%",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "xbp_30_500k",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 30% (Beban Seller 10.50%) · Min. Belanja Rp500k (TTS & Toko)",
    diskonPembeli: 30,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 10.50,
    minBelanja: 500000,
    capSeller: 175000,
    badge: "XBP 10.5%",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "xbp_35_peak",
    group: "xbp",
    groupLabel: "🟣 [XBP] Co-Funded (Platform 65% : Seller 35%)",
    label: "Diskon 35% Peak Day (Beban Seller 12.25%) · Min. Rp1.8jt",
    diskonPembeli: 35,
    platformPct: 65,
    sellerPct: 35,
    effectiveSellerPct: 12.25,
    minBelanja: 1800000,
    capSeller: 350000,
    badge: "XBP 12.25% Peak",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    channel: "Peak Day TTS & Toko"
  },

  // ── 3. Co-Funded Voucher Reguler (Platform 40% : Penjual 60%) ──
  {
    id: "reg_10_60k",
    group: "reg",
    groupLabel: "🟠 Co-Funded Reguler (Platform 40% : Seller 60%)",
    label: "Diskon 10% (Beban Seller 6.00%) · Min. Belanja Rp60k (TTS Only)",
    diskonPembeli: 10,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 6.00,
    minBelanja: 60000,
    capSeller: 600000,
    badge: "Reguler 6.0%",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    channel: "TTS Only"
  },
  {
    id: "reg_20_75k",
    group: "reg",
    groupLabel: "🟠 Co-Funded Reguler (Platform 40% : Seller 60%)",
    label: "Diskon 20% (Beban Seller 12.00%) · Min. Belanja Rp75k (TTS Only)",
    diskonPembeli: 20,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 12.00,
    minBelanja: 75000,
    capSeller: 30000,
    badge: "Reguler 12.0%",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    channel: "TTS Only"
  },
  {
    id: "reg_20_100k",
    group: "reg",
    groupLabel: "🟠 Co-Funded Reguler (Platform 40% : Seller 60%)",
    label: "Diskon 20% (Beban Seller 12.00%) · Min. Belanja Rp100k (TTS & Toko)",
    diskonPembeli: 20,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 12.00,
    minBelanja: 100000,
    capSeller: 60000,
    badge: "Reguler 12.0%",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "reg_20_130k",
    group: "reg",
    groupLabel: "🟠 Co-Funded Reguler (Platform 40% : Seller 60%)",
    label: "Diskon 20% (Beban Seller 12.00%) · Min. Belanja Rp130k (TTS & Toko)",
    diskonPembeli: 20,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 12.00,
    minBelanja: 130000,
    capSeller: 150000,
    badge: "Reguler 12.0%",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "reg_25_300k",
    group: "reg",
    groupLabel: "🟠 Co-Funded Reguler (Platform 40% : Seller 60%)",
    label: "Diskon 25% (Beban Seller 15.00%) · Min. Belanja Rp300k (TTS & Toko)",
    diskonPembeli: 25,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 15.00,
    minBelanja: 300000,
    capSeller: 180000,
    badge: "Reguler 15.0%",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "reg_30_500k",
    group: "reg",
    groupLabel: "🟠 Co-Funded Reguler (Platform 40% : Seller 60%)",
    label: "Diskon 30% (Beban Seller 18.00%) · Min. Belanja Rp500k (TTS & Toko)",
    diskonPembeli: 30,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 18.00,
    minBelanja: 500000,
    capSeller: 300000,
    badge: "Reguler 18.0%",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    channel: "TTS & Toko"
  },
  {
    id: "reg_35_peak",
    group: "reg",
    groupLabel: "🟠 Co-Funded Reguler (Platform 40% : Seller 60%)",
    label: "Diskon 35% Peak Day (Beban Seller 21.00%) · Min. Rp1.8jt",
    diskonPembeli: 35,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 21.00,
    minBelanja: 1800000,
    capSeller: 600000,
    badge: "Reguler 21.0% Peak",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    channel: "Peak Day TTS & Toko"
  },

  // ── 4. Spesial Co-Funded Voucher (Platform 45% : Penjual 55%) ──
  {
    id: "sp_8_50k",
    group: "sp",
    groupLabel: "🟡 Spesial Co-Funded (Platform 45% : Seller 55%)",
    label: "Always On 8% (Beban Seller 4.40%) · Min. Belanja Rp50k",
    diskonPembeli: 8,
    platformPct: 45,
    sellerPct: 55,
    effectiveSellerPct: 4.40,
    minBelanja: 50000,
    capSeller: 660000,
    badge: "Spesial 4.4%",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    channel: "Always On"
  },
  {
    id: "sp_20_150k",
    group: "sp",
    groupLabel: "🟡 Spesial Co-Funded (Platform 45% : Seller 55%)",
    label: "Always On 20% (Beban Seller 11.00%) · Min. Belanja Rp150k",
    diskonPembeli: 20,
    platformPct: 45,
    sellerPct: 55,
    effectiveSellerPct: 11.00,
    minBelanja: 150000,
    capSeller: 440000,
    badge: "Spesial 11.0%",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    channel: "Always On"
  },
  {
    id: "sp_25_500k",
    group: "sp",
    groupLabel: "🟡 Spesial Co-Funded (Platform 45% : Seller 55%)",
    label: "Jam Puncak 25% (Beban Seller 13.75%) · Min. Belanja Rp500k",
    diskonPembeli: 25,
    platformPct: 45,
    sellerPct: 55,
    effectiveSellerPct: 13.75,
    minBelanja: 500000,
    capSeller: 330000,
    badge: "Jam Puncak 13.75%",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    channel: "Jam Puncak"
  },
  {
    id: "sp_35_800k",
    group: "sp",
    groupLabel: "🟡 Spesial Co-Funded (Platform 45% : Seller 55%)",
    label: "Hari Puncak 35% (Beban Seller 19.25%) · Min. Belanja Rp800k",
    diskonPembeli: 35,
    platformPct: 45,
    sellerPct: 55,
    effectiveSellerPct: 19.25,
    minBelanja: 800000,
    capSeller: 440000,
    badge: "Hari Puncak 19.25%",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    channel: "Hari Puncak"
  },

  // ── 5. ID 2026 LIVE Festival Q3 2026 (Subsidi Platform 40% - 90%) ──
  {
    id: "live_50_peak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 90% : Toko 10%)",
    label: "Diskon 50% Peak (Toko 5.00% · Cap Rp1rb) · Min. Belanja Rp10k",
    diskonPembeli: 50,
    platformPct: 90,
    sellerPct: 10,
    effectiveSellerPct: 5.00,
    minBelanja: 10000,
    capSeller: 1000,
    badge: "LIVE Fest 50% (Toko 10%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Peak (11 am & 6 pm)"
  },
  {
    id: "live_25_peak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 80% : Toko 20%)",
    label: "Diskon 25% Peak (Toko 5.00% · Cap Rp75rb) · Min. Belanja Rp1.5jt",
    diskonPembeli: 25,
    platformPct: 80,
    sellerPct: 20,
    effectiveSellerPct: 5.00,
    minBelanja: 1500000,
    capSeller: 75000,
    badge: "LIVE Fest 25% (Toko 20%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Peak (11 am & 6 pm)"
  },
  {
    id: "live_22_peak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 77% : Toko 23%)",
    label: "Diskon 22% Peak (Toko 5.06% · Cap Rp92rb) · Min. Belanja Rp500k",
    diskonPembeli: 22,
    platformPct: 77,
    sellerPct: 23,
    effectiveSellerPct: 5.06,
    minBelanja: 500000,
    capSeller: 92000,
    badge: "LIVE Fest 22% (Toko 23%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Peak (11 am & 6 pm)"
  },
  {
    id: "live_20_peak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 75% : Toko 25%)",
    label: "Diskon 20% Peak (Toko 5.00% · Cap Rp75rb) · Min. Belanja Rp300k",
    diskonPembeli: 20,
    platformPct: 75,
    sellerPct: 25,
    effectiveSellerPct: 5.00,
    minBelanja: 300000,
    capSeller: 75000,
    badge: "LIVE Fest 20% (Toko 25%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Peak (11 am & 6 pm)"
  },
  {
    id: "live_17_peak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 71% : Toko 29%)",
    label: "Diskon 17% Peak (Toko 4.93% · Cap Rp58rb) · Min. Belanja Rp200k",
    diskonPembeli: 17,
    platformPct: 71,
    sellerPct: 29,
    effectiveSellerPct: 4.93,
    minBelanja: 200000,
    capSeller: 58000,
    badge: "LIVE Fest 17% (Toko 29%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Peak (11 am & 6 pm)"
  },
  {
    id: "live_15_nonpeak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 70% : Toko 30%)",
    label: "Diskon 15% Non-Peak (Toko 4.50% · Cap Rp45rb) · Min. Belanja Rp150k",
    diskonPembeli: 15,
    platformPct: 70,
    sellerPct: 30,
    effectiveSellerPct: 4.50,
    minBelanja: 150000,
    capSeller: 45000,
    badge: "LIVE Fest 15% (Toko 30%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Non-Peak"
  },
  {
    id: "live_11_nonpeak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 64% : Toko 36%)",
    label: "Diskon 11% Non-Peak (Toko 3.96% · Cap Rp36rb) · Min. Belanja Rp100k",
    diskonPembeli: 11,
    platformPct: 64,
    sellerPct: 36,
    effectiveSellerPct: 3.96,
    minBelanja: 100000,
    capSeller: 36000,
    badge: "LIVE Fest 11% (Toko 36%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Non-Peak"
  },
  {
    id: "live_5_nonpeak",
    group: "live_fest",
    groupLabel: "🎙️ LIVE Festival Q3 2026 (Platform 40% : Toko 60%)",
    label: "Diskon 5% Non-Peak (Toko 3.00% · Cap Rp1.2jt) · Min. Belanja Rp50k",
    diskonPembeli: 5,
    platformPct: 40,
    sellerPct: 60,
    effectiveSellerPct: 3.00,
    minBelanja: 50000,
    capSeller: 1200000,
    badge: "LIVE Fest 5% (Toko 60%)",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    channel: "LIVE Festival Non-Peak"
  }
];

// ── DIREKTORI LENGKAP JENIS CAMPAIGN & PROMOSI TIKTOK SHOP ────
const CAMPAIGN_TYPES = [
  {
    id: "live_fest_q3",
    icon: "🎙️",
    nama: "ID 2026 TikTok Shop | LIVE Festival Q3 2026",
    kategori: "Joint Campaign [Co-funded Voucher] TikTok Shop LIVE",
    badge: "Subsidi s/d 90%",
    badgeCls: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    jadwal: "14/07/2026 - 31/12/2026 (Aktif Setiap Selasa: 14, 21, 28 Jul, 11, 18 Ags, 15, 22, 29 Sep)",
    diskonMin: "Diskon 5% s/d 50% (Peak Hour 11.00 & 18.00 w/ subsidi TikTok hingga 90%)",
    manfaat: "Traffic masif penonton LIVE, voucher subsidi platform hingga 90% (diskon 50% beban seller hanya 10% maks Rp1.000), mendorong checkout spontan.",
    kriteria: "TikTok Shop by Tokopedia saja. Harga produk harus kompetitif dan lebih rendah dari harga 14 hari terakhir (≤ L14D).",
    tipsCuan: "🔥 Wajib ikuti tier Diskon 50% (Peak Hour)! Beban toko hanya 10% (maks Rp1.000) tapi diskon pembeli 50%, pembeli langsung borong saat LIVE!",
    color: "from-rose-600 to-red-700",
  },
  {
    id: "growth_deal",
    icon: "🌟",
    nama: "Growth Xtra Special Deal Program",
    kategori: "100% Platform Funded (Gratis)",
    badge: "Bebas Biaya Seller",
    badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    jadwal: "28/04/2026 - 30/04/2027 (TikTok Shop by Tokopedia)",
    diskonMin: "Voucher platform hingga 25% didanai 100% oleh TikTok Shop (Seller: Rp0)",
    manfaat: "Lencana campaign, banner di TikTok/Live/video pendek, voucher platform 100% didanai tanpa biaya sedikit pun dari seller.",
    kriteria: "Seller terdaftar di program Growth Xtra (XBP), harga memenuhi L30D level T1.",
    tipsCuan: "✅ Wajib didaftarkan! Beban biaya seller 0% dan conversion rate melonjak tinggi.",
    color: "from-emerald-600 to-teal-700",
  },
  {
    id: "voucher_boost",
    icon: "🚀",
    nama: "Voucher Boost - Gajian Sale & 11.11",
    kategori: "Platform Funded (Gratis)",
    badge: "Gratis Tanpa Biaya",
    badgeCls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    jadwal: "Gajian Sale (23-28/29 Okt) & 11.11 (2-12 Nov)",
    diskonMin: "Voucher platform s/d 20% (Seller XBP) atau s/d 6% (Non-XBP)",
    manfaat: "Exposure di Campaign Tab & H5 Main Page, lencana eksklusif, insentif voucher platform gratis.",
    kriteria: "Semua seller toko buka, harga kompetitif ≤ L30D.",
    tipsCuan: "✅ Daftarkan seluruh SKU produk aktif untuk menikmati traffic gratis tanpa potongan tambahan.",
    color: "from-cyan-600 to-blue-700",
  },
  {
    id: "xbp_co_funded",
    icon: "🟣",
    nama: "[XBP] Co-Funded Voucher (Platform 65% : Seller 35%)",
    kategori: "Joint Campaign (Khusus Seller XBP)",
    badge: "Paling Menguntungkan",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    jadwal: "Gajian Sale (23-28 Okt) & Double Date 11.11 (2-12 Nov)",
    diskonMin: "Diskon 10% - 35% (Seller hanya menanggung 35% dari nilai voucher!)",
    manfaat: "Platform menanggung 65%! Beban seller hanya 3.5% (voucher 10%) s/d 7.0% (voucher 20%).",
    kriteria: "Khusus seller yang terdaftar dalam program XBP / Growth Xtra.",
    tipsCuan: "Paling direkomendasikan dibanding reguler karena platform menanggung porsi mayoritas (65%).",
    color: "from-purple-600 to-pink-700",
  },
  {
    id: "reg_co_funded",
    icon: "🟠",
    nama: "Co-Funded Voucher Reguler (Platform 40% : Seller 60%)",
    kategori: "Joint Campaign (Seller Non-XBP)",
    badge: "Perhatikan Margin!",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    jadwal: "Gajian Sale (23-28 Okt) & Double Date 11.11 (2-12 Nov)",
    diskonMin: "Diskon 10% - 35% (Seller menanggung 60% dari nilai voucher)",
    manfaat: "Mendongkrak traffic saat event puncak dengan subsidi platform 40%.",
    kriteria: "Seller terbuka untuk semua kategori dengan harga kompetitif ≤ L30D.",
    tipsCuan: "⚠️ Beban seller 6% s/d 12%! Hanya ikuti jika margin kotor produk Anda di atas 25%.",
    color: "from-orange-600 to-amber-700",
  },
  {
    id: "sp_co_funded",
    icon: "🟡",
    nama: "Spesial Co-Funded Voucher (Platform 45% : Seller 55%)",
    kategori: "Joint Campaign Spesial",
    badge: "Pilihan Always On",
    badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    jadwal: "Gajian Sale (23-28 Okt) & Double Date 11.11 (2-12 Nov)",
    diskonMin: "Always On 8% (Seller 4.4%) & Always On 20% (Seller 11.0%)",
    manfaat: "Voucher selalu aktif (Always On) sepanjang periode campaign berlangsung.",
    kriteria: "Produk dengan harga kompetitif di semua platform.",
    tipsCuan: "Gunakan Always On 8% (beban hanya 4.4%) untuk produk fast-moving agar tidak menguras laba.",
    color: "from-amber-600 to-yellow-700",
  },
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
  const [qty, setQty] = useState(1); // Jumlah quantity produk yang dihitung
  const [opsPerPesanan, setOpsPerPesanan] = useState(true); // true = 1 paket per pesanan (hemat), false = per pcs
  const [customTargetMargin, setCustomTargetMargin] = useState<number>(15); // Target margin custom (%)
  const [targetProfitMode, setTargetProfitMode] = useState<"percent" | "nominal">("percent"); // Mode target profit: persen (%) vs nominal (Rp)
  const [customTargetNominal, setCustomTargetNominal] = useState<number>(5000); // Target profit nominal custom (Rp)
  const [targetNominalScope, setTargetNominalScope] = useState<"per_pcs" | "per_order">("per_pcs"); // per_pcs vs per_order
  const [ops, setOps] = useState(INIT_OPS);
  const [mainTab, setMainTab] = useState("kalkulator");
  const [strTab, setStrTab] = useState("campaign_guide");
  const [matrixFilter, setMatrixFilter] = useState<string>("all");

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
  const [afiliasiPct, setAfiliasiPct] = useState(1); // Default komisi afiliasi 1% (populer untuk sembako/FMCG)
  const [gmvPct, setGmvPct] = useState(3);
  const [liveAdsPct, setLiveAdsPct] = useState(3);

  // Simulasi Diskon Campaign / Promosi Seller
  const [ikutPromo, setIkutPromo] = useState(false);
  const [diskonType, setDiskonType] = useState<"pct"|"nominal">("pct");
  const [diskonVal, setDiskonVal] = useState(10); // misal diskon 10%

  // Simulasi Co-Funded Campaign Voucher (Gajian Sale & 11.11 2026)
  const [selectedCoFunded, setSelectedCoFunded] = useState<string>("none");
  const activeCoFundedTier = CO_FUNDED_TIERS.find(t => t.id === selectedCoFunded);

  // Simulasi Voucher Tambahan Platform (0% - 25%, misal Voucher Toko/Live TikTok)
  const [voucherPlatformPct, setVoucherPlatformPct] = useState<number>(0);

  const totalOps = ops.reduce((s,o)=>s+o.nominal,0);
  const totalOpsEffective = opsPerPesanan ? totalOps : totalOps * qty;

  const subtotalKatalog = hargaJual * qty;
  const subtotalHPP = hargaBeli * qty;

  // Perhitungan Diskon Seller (mengurangi dasar perhitungan komisi platform)
  const diskonSellerNominal = !ikutPromo
    ? 0
    : diskonType === "pct"
      ? Math.round(((diskonVal / 100) * hargaJual) * qty)
      : Math.min(diskonVal * qty, subtotalKatalog);

  // Harga setelah diskon seller (Dasar Perhitungan Komisi Platform & Dinamis)
  const hargaSetelahDiskon = Math.max(0, subtotalKatalog - diskonSellerNominal);

  // Cek apakah memenuhi syarat Min. Belanja Voucher Co-Funded
  const isCoFundedMinBelanjaMet = activeCoFundedTier
    ? (hargaSetelahDiskon >= activeCoFundedTier.minBelanja)
    : false;

  // Nominal voucher yang dinikmati pembeli dari program Co-Funded / Boost
  const coFundedDiskonPembeli = (activeCoFundedTier && isCoFundedMinBelanjaMet)
    ? Math.round((activeCoFundedTier.diskonPembeli / 100) * hargaSetelahDiskon)
    : 0;

  // Subsidi Co-Funded Voucher yang ditanggung Seller (jika aktif & min belanja terpenuhi)
  const coFundedNom = (activeCoFundedTier && isCoFundedMinBelanjaMet && activeCoFundedTier.effectiveSellerPct > 0)
    ? Math.round(Math.min((activeCoFundedTier.effectiveSellerPct / 100) * hargaSetelahDiskon, activeCoFundedTier.capSeller))
    : 0;

  // Porsi subsidi voucher yang ditanggung platform
  const subsidiPlatformCoFunded = Math.max(0, coFundedDiskonPembeli - coFundedNom);

  // Simulasi Voucher Tambahan Platform (100% Platform)
  const voucherPlatformNominal = voucherPlatformPct > 0
    ? Math.round((voucherPlatformPct / 100) * hargaSetelahDiskon)
    : 0;

  // Total Diskon Voucher yang Dinikmati Pembeli
  const totalVoucherPembeli = coFundedDiskonPembeli + voucherPlatformNominal;

  // ESTIMASI NOMINAL AKHIR YANG DIBAYAR PEMBELI DI KASIR / CHECKOUT
  const nominalDibayarPembeli = Math.max(0, hargaSetelahDiskon - totalVoucherPembeli);
  const nominalDibayarPembeliPerPcs = qty > 0 ? Math.round(nominalDibayarPembeli / qty) : 0;

  // GMV Max discount on platform commission
  const gmvDisc = (platform==="tiktok" && active.gmv_max)
    ? (gmvPct>=3?0.30:gmvPct>=1?0.15:0) : 0;
  
  const komisiBase = kat.komisi * (1 - gmvDisc);
  const komisiNom = Math.round((komisiBase / 100) * hargaSetelahDiskon);
  const dinNom = active.komisi_dinamis ? Math.round(Math.min((dinamisPct / 100) * hargaSetelahDiskon, dinamisCap * qty)) : 0;
  const prosesNom = active.biaya_proses ? 1250 : 0; // Flat Rp1.250 per order
  const pph22Nom = active.pph22 ? Math.round((0.5 / 100) * hargaSetelahDiskon) : 0;
  const growthXtraNom = (active.growth_xtra && platform==="tiktok") ? Math.round((growthXtraPct / 100) * hargaSetelahDiskon) : 0;
  const logistikNom = active.biaya_logistik ? biayaLogistikNom : 0;
  const mallNom = (active.mall_fee || isMall) ? Math.round(Math.min((1.8 / 100) * hargaSetelahDiskon, 50000 * qty)) : 0;
  const ongkirNom = active.gratis_ongkir ? Math.round((5.5 / 100) * hargaSetelahDiskon) : 0;
  const voucherNom = active.voucher_xtra ? Math.round(Math.min((3.5 / 100) * hargaSetelahDiskon, 20000 * qty)) : 0;
  const poNom = (active.pre_order && platform==="tiktok") ? Math.round((3 / 100) * hargaSetelahDiskon) : 0;
  const afilNom = active.afiliasi ? Math.round((afiliasiPct / 100) * hargaSetelahDiskon) : 0;
  const gmvNom = (active.gmv_max && platform==="tiktok") ? Math.round((gmvPct / 100) * hargaSetelahDiskon) : 0;
  const topadNom = (active.topads && platform==="tokopedia") ? Math.round((3 / 100) * hargaSetelahDiskon) : 0;
  const liveNom = (active.live_ads && platform==="tiktok") ? Math.round((liveAdsPct / 100) * hargaSetelahDiskon) : 0;
  const cashNom = active.cashback_bonus ? Math.round((2 / 100) * hargaSetelahDiskon) : 0;

  const totalPlatform = komisiNom + dinNom + prosesNom + pph22Nom + growthXtraNom + logistikNom + mallNom + ongkirNom + voucherNom + poNom + afilNom + gmvNom + topadNom + liveNom + cashNom;
  
  // Jumlah Penyelesaian Pembayaran = yang masuk ke saldo TikTok/platform (setelah fee platform & subsidi voucher seller)
  const jumlahPenyelesaian = hargaSetelahDiskon - totalPlatform - coFundedNom;

  // Keuntungan Bersih: Pembeli bayar - Potongan Platform - Subsidi Co-Funded - Modal Beli - Ops
  const cuan = jumlahPenyelesaian - subtotalHPP - totalOpsEffective;
  const marginPct = hargaSetelahDiskon > 0 ? (cuan / hargaSetelahDiskon) * 100 : 0;
  const roiPct = (subtotalHPP + totalOpsEffective) > 0 ? (cuan / (subtotalHPP + totalOpsEffective)) * 100 : 0;
  const potPct = hargaSetelahDiskon > 0 ? ((totalPlatform + coFundedNom + totalOpsEffective) / hargaSetelahDiskon) * 100 : 0;

  // Nilai Per Pcs
  const cuanPerPcs = qty > 0 ? Math.round(cuan / qty) : 0;
  const jumlahPenyelesaianPerPcs = qty > 0 ? Math.round(jumlahPenyelesaian / qty) : 0;
  const totalPlatformPerPcs = qty > 0 ? Math.round(totalPlatform / qty) : 0;

  // Fungsi kalkulasi target harga jual per pcs untuk mencapai target net margin tertentu
  function calcH(tm=0, targetQty=qty){
    const opsEff = opsPerPesanan ? totalOps : totalOps * targetQty;
    const base = (hargaBeli * targetQty) + opsEff;
    const startH = Math.max(10, Math.floor(hargaBeli * 0.9));
    for(let h = startH; h <= 10_000_000; h += 25){
      const sub = h * targetQty;
      const disc = !ikutPromo ? 0 : (diskonType === "pct" ? (diskonVal/100)*sub : Math.min(diskonVal * targetQty, sub));
      const hClean = Math.max(0, sub - disc);
      const kb = kat.komisi * (1 - gmvDisc);
      const kn = Math.round((kb / 100) * hClean);
      const dn = active.komisi_dinamis ? Math.round(Math.min((dinamisPct / 100) * hClean, dinamisCap * targetQty)) : 0;
      const pn = active.biaya_proses ? 1250 : 0;
      const ppn = active.pph22 ? Math.round((0.5 / 100) * hClean) : 0;
      const gxn = (active.growth_xtra && platform==="tiktok") ? Math.round((growthXtraPct / 100) * hClean) : 0;
      const ln = active.biaya_logistik ? biayaLogistikNom : 0;
      const mn = (active.mall_fee || isMall) ? Math.round(Math.min((1.8 / 100) * hClean, 50000 * targetQty)) : 0;
      const on = active.gratis_ongkir ? Math.round((5.5 / 100) * hClean) : 0;
      const vn = active.voucher_xtra ? Math.round(Math.min((3.5 / 100) * hClean, 20000 * targetQty)) : 0;
      const po = (active.pre_order && platform==="tiktok") ? Math.round((3 / 100) * hClean) : 0;
      const an = active.afiliasi ? Math.round((afiliasiPct / 100) * hClean) : 0;
      const gn = (active.gmv_max && platform==="tiktok") ? Math.round((gmvPct / 100) * hClean) : 0;
      const tn = (active.topads && platform==="tokopedia") ? Math.round((3 / 100) * hClean) : 0;
      const lvn = (active.live_ads && platform==="tiktok") ? Math.round((liveAdsPct / 100) * hClean) : 0;
      const cn = active.cashback_bonus ? Math.round((2 / 100) * hClean) : 0;
      const cfn = (activeCoFundedTier && activeCoFundedTier.effectiveSellerPct > 0 && hClean >= activeCoFundedTier.minBelanja)
        ? Math.round(Math.min((activeCoFundedTier.effectiveSellerPct / 100) * hClean, activeCoFundedTier.capSeller))
        : 0;
      const pot = kn + dn + pn + ppn + gxn + ln + mn + on + vn + po + an + gn + tn + lvn + cn + cfn;
      if(hClean > 0 && ((hClean - pot - base) / hClean) * 100 >= tm) {
        return Math.ceil(h / 50) * 50;
      }
    }
    return hargaBeli;
  }
  const bep = calcH(0);
  const h10 = calcH(10); // Penetrasi / Promo Kilat
  const h15 = calcH(15); // Rekomendasi Seimbang (Logis & Relevan)
  const h20 = calcH(20); // Margin Sehat
  const h25 = calcH(25); // Margin Campaign & Ads
  const h30 = calcH(30); // Margin Tebal
  const customTargetPrice = calcH(customTargetMargin);

  // Fungsi kalkulasi target harga jual per pcs untuk mencapai target profit nominal bersih (Rp)
  function calcHNominal(targetProfitPerPcs = 5000, targetQty = qty) {
    const opsEff = opsPerPesanan ? totalOps : totalOps * targetQty;
    const base = (hargaBeli * targetQty) + opsEff;
    const targetNetTotal = targetProfitPerPcs * targetQty;
    const startH = Math.max(10, Math.floor(hargaBeli * 0.9));
    for (let h = startH; h <= 20_000_000; h += 25) {
      const sub = h * targetQty;
      const disc = !ikutPromo ? 0 : (diskonType === "pct" ? (diskonVal / 100) * sub : Math.min(diskonVal * targetQty, sub));
      const hClean = Math.max(0, sub - disc);
      const kb = kat.komisi * (1 - gmvDisc);
      const kn = Math.round((kb / 100) * hClean);
      const dn = active.komisi_dinamis ? Math.round(Math.min((dinamisPct / 100) * hClean, dinamisCap * targetQty)) : 0;
      const pn = active.biaya_proses ? 1250 : 0;
      const ppn = active.pph22 ? Math.round((0.5 / 100) * hClean) : 0;
      const gxn = (active.growth_xtra && platform === "tiktok") ? Math.round((growthXtraPct / 100) * hClean) : 0;
      const ln = active.biaya_logistik ? biayaLogistikNom : 0;
      const mn = (active.mall_fee || isMall) ? Math.round(Math.min((1.8 / 100) * hClean, 50000 * targetQty)) : 0;
      const on = active.gratis_ongkir ? Math.round((5.5 / 100) * hClean) : 0;
      const vn = active.voucher_xtra ? Math.round(Math.min((3.5 / 100) * hClean, 20000 * targetQty)) : 0;
      const po = (active.pre_order && platform === "tiktok") ? Math.round((3 / 100) * hClean) : 0;
      const an = active.afiliasi ? Math.round((afiliasiPct / 100) * hClean) : 0;
      const gn = (active.gmv_max && platform === "tiktok") ? Math.round((gmvPct / 100) * hClean) : 0;
      const tn = (active.topads && platform === "tokopedia") ? Math.round((3 / 100) * hClean) : 0;
      const lvn = (active.live_ads && platform === "tiktok") ? Math.round((liveAdsPct / 100) * hClean) : 0;
      const cn = active.cashback_bonus ? Math.round((2 / 100) * hClean) : 0;
      const cfn = (activeCoFundedTier && activeCoFundedTier.effectiveSellerPct > 0 && hClean >= activeCoFundedTier.minBelanja)
        ? Math.round(Math.min((activeCoFundedTier.effectiveSellerPct / 100) * hClean, activeCoFundedTier.capSeller))
        : 0;
      const pot = kn + dn + pn + ppn + gxn + ln + mn + on + vn + po + an + gn + tn + lvn + cn + cfn;
      const netProfit = hClean - pot - base;
      if (netProfit >= targetNetTotal) {
        return Math.ceil(h / 50) * 50;
      }
    }
    return Math.max(hargaBeli + targetProfitPerPcs, 1000);
  }

  // Preset kalkulasi harga nominal target cuan bersih per pcs
  const effTargetNominalPerPcs = targetNominalScope === "per_order" ? Math.max(1, Math.round(customTargetNominal / (qty || 1))) : customTargetNominal;
  const customTargetNominalPrice = calcHNominal(effTargetNominalPerPcs);

  const n2k = calcHNominal(2000);
  const n5k = calcHNominal(5000);
  const n10k = calcHNominal(10000);
  const n15k = calcHNominal(15000);
  const n25k = calcHNominal(25000);
  const n50k = calcHNominal(50000);

  // ── KALKULASI REKOMENDASI IKUT PROGRAM TIKTOK SHOP / CO-FUNDED ──
  function getProgramRecommendation(tier: CoFundedTier, currentHpp = hargaBeli, currentQty = qty) {
    const opsEff = opsPerPesanan ? totalOps : totalOps * currentQty;
    const baseModal = (currentHpp * currentQty) + opsEff;
    const minUnitForVoucher = Math.ceil(tier.minBelanja / currentQty);

    let bepPrice = currentHpp;
    let idealPrice = currentHpp;
    let maxPrice = currentHpp;

    const startH = Math.max(10, Math.floor(currentHpp * 0.9));
    for (let h = startH; h <= 10_000_000; h += 25) {
      const sub = h * currentQty;
      const hClean = sub;
      const kb = kat.komisi * (1 - gmvDisc);
      const kn = Math.round((kb / 100) * hClean);
      const dn = active.komisi_dinamis ? Math.round(Math.min((dinamisPct / 100) * hClean, dinamisCap * currentQty)) : 0;
      const pn = active.biaya_proses ? 1250 : 0;
      const ppn = active.pph22 ? Math.round((0.5 / 100) * hClean) : 0;
      const gxn = (active.growth_xtra && platform === "tiktok") ? Math.round((growthXtraPct / 100) * hClean) : 0;
      const ln = active.biaya_logistik ? biayaLogistikNom : 0;
      const mn = (active.mall_fee || isMall) ? Math.round(Math.min((1.8 / 100) * hClean, 50000 * currentQty)) : 0;
      const on = active.gratis_ongkir ? Math.round((5.5 / 100) * hClean) : 0;
      const vn = active.voucher_xtra ? Math.round(Math.min((3.5 / 100) * hClean, 20000 * currentQty)) : 0;
      const po = (active.pre_order && platform === "tiktok") ? Math.round((3 / 100) * hClean) : 0;
      const an = active.afiliasi ? Math.round((afiliasiPct / 100) * hClean) : 0;
      const cfn = (tier.effectiveSellerPct > 0 && hClean >= tier.minBelanja)
        ? Math.round(Math.min((tier.effectiveSellerPct / 100) * hClean, tier.capSeller))
        : 0;
      const pot = kn + dn + pn + ppn + gxn + ln + mn + on + vn + po + an + cfn;
      const margin = hClean > 0 ? ((hClean - pot - baseModal) / hClean) * 100 : 0;

      if (margin >= 0 && bepPrice === currentHpp) {
        bepPrice = Math.ceil(h / 50) * 50;
      }
      if (margin >= 15 && idealPrice === currentHpp) {
        idealPrice = Math.ceil(h / 50) * 50;
      }
      if (margin >= 25 && maxPrice === currentHpp) {
        maxPrice = Math.ceil(h / 50) * 50;
        break;
      }
    }

    const recMinPrice = Math.max(bepPrice, minUnitForVoucher);
    const recIdealPrice = Math.max(idealPrice, minUnitForVoucher);
    const recMaxPrice = Math.max(maxPrice, Math.ceil(recIdealPrice * 1.3));

    const subIdeal = recIdealPrice * currentQty;
    const kb = kat.komisi * (1 - gmvDisc);
    const kn = Math.round((kb / 100) * subIdeal);
    const dn = active.komisi_dinamis ? Math.round(Math.min((dinamisPct / 100) * subIdeal, dinamisCap * currentQty)) : 0;
    const pn = active.biaya_proses ? 1250 : 0;
    const ppn = active.pph22 ? Math.round((0.5 / 100) * subIdeal) : 0;
    const gxn = (active.growth_xtra && platform === "tiktok") ? Math.round((growthXtraPct / 100) * subIdeal) : 0;
    const ln = active.biaya_logistik ? biayaLogistikNom : 0;
    const mn = (active.mall_fee || isMall) ? Math.round(Math.min((1.8 / 100) * subIdeal, 50000 * currentQty)) : 0;
    const on = active.gratis_ongkir ? Math.round((5.5 / 100) * subIdeal) : 0;
    const vn = active.voucher_xtra ? Math.round(Math.min((3.5 / 100) * subIdeal, 20000 * currentQty)) : 0;
    const po = (active.pre_order && platform === "tiktok") ? Math.round((3 / 100) * subIdeal) : 0;
    const an = active.afiliasi ? Math.round((afiliasiPct / 100) * subIdeal) : 0;
    const cfn = (tier.effectiveSellerPct > 0 && subIdeal >= tier.minBelanja)
      ? Math.round(Math.min((tier.effectiveSellerPct / 100) * subIdeal, tier.capSeller))
      : 0;
    const pot = kn + dn + pn + ppn + gxn + ln + mn + on + vn + po + an + cfn;
    const settlement = subIdeal - pot;
    const netProfitTotal = settlement - baseModal;
    const netProfitPerPcs = Math.round(netProfitTotal / currentQty);
    const netMarginPct = subIdeal > 0 ? (netProfitTotal / subIdeal) * 100 : 0;

    const buyerVoucherNominal = Math.round((tier.diskonPembeli / 100) * subIdeal);
    const buyerCheckout = Math.max(0, subIdeal - buyerVoucherNominal);
    const buyerCheckoutPerPcs = Math.round(buyerCheckout / currentQty);

    const hppMin = tier.minBelanja > 0 ? Math.max(500, Math.round((tier.minBelanja * 0.2) / currentQty)) : 1000;
    const hppMax = tier.minBelanja > 0 ? Math.max(2000, Math.round((tier.minBelanja * 0.75) / currentQty)) : 500000;

    let statusBadge = "🟢 Sangat Cocok";
    let statusCls = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    let statusTips = `HPP ${formatRp(currentHpp)} & Qty ${currentQty} pcs sangat ideal untuk program ini.`;

    if (tier.minBelanja > 0 && (currentHpp * currentQty * 1.5) < tier.minBelanja) {
      const neededQty = Math.ceil(tier.minBelanja / (currentHpp * 1.5 || 1));
      statusBadge = "📦 Butuh Bundling";
      statusCls = "bg-amber-500/20 text-amber-300 border-amber-500/40";
      statusTips = `HPP satuan murah (${formatRp(currentHpp)}). Buat paket isi ${neededQty} pcs agar pembeli memenuhi Min. Belanja ${formatRp(tier.minBelanja)}.`;
    } else if (tier.minBelanja > 0 && currentHpp > hppMax) {
      statusBadge = "⚠️ HPP Tinggi";
      statusCls = "bg-blue-500/20 text-blue-300 border-blue-500/40";
      statusTips = `HPP (${formatRp(currentHpp)}) cukup besar, Anda bisa ikut tier voucher belanja yang lebih tinggi untuk diskon lebih besar.`;
    }

    return {
      hppMin,
      hppMax,
      recMinPrice,
      recIdealPrice,
      recMaxPrice,
      netProfitTotal,
      netProfitPerPcs,
      netMarginPct,
      buyerCheckout,
      buyerCheckoutPerPcs,
      buyerVoucherNominal,
      sellerSubsidy: cfn,
      platformSubsidy: Math.max(0, buyerVoucherNominal - cfn),
      statusBadge,
      statusCls,
      statusTips
    };
  }

  const currentProgramRec = activeCoFundedTier ? getProgramRecommendation(activeCoFundedTier) : null;

  const status = cuan > 0
    ? {label:"✅ UNTUNG", cls:"text-green-700 bg-green-50 border-green-300"}
    : cuan === 0
      ? {label:"⚠️ IMPAS", cls:"text-yellow-700 bg-yellow-50 border-yellow-300"}
      : {label:"❌ RUGI", cls:"text-red-700 bg-red-50 border-red-300"};

  const detailPlat = [
    {label:`Komisi Platform Grp ${kat.grp}${gmvDisc>0?` (diskon GMV ${(gmvDisc*100).toFixed(0)}%)`:""} (${komisiBase.toFixed(2)}%)`, nom:komisiNom, show:true, wajib:true},
    {label:`Komisi Dinamis (${dinamisPct}%, cap Rp${(dinamisCap/1000).toFixed(0)}rb/item)`, nom:dinNom, show:active.komisi_dinamis, wajib:true},
    {label:"Biaya Pemrosesan Order (Flat Rp1.250 / order)", nom:prosesNom, show:active.biaya_proses, wajib:true},
    {label:"PPh Pasal 22 (0.5% pajak e-Commerce)", nom:pph22Nom, show:active.pph22, wajib:true},
    {label:`Biaya Layanan Growth Xtra (${growthXtraPct}%)`, nom:growthXtraNom, show:active.growth_xtra && platform==="tiktok"},
    {label:`Biaya Layanan Logistik Platform`, nom:logistikNom, show:active.biaya_logistik},
    {label:"Biaya Layanan Mall (1.8%, cap Rp50rb/item)", nom:mallNom, show:(active.mall_fee || isMall)},
    {label:"Gratis Ongkir XTRA (~5.5%)", nom:ongkirNom, show:active.gratis_ongkir},
    {label:"Voucher XTRA (3.5%, cap Rp20rb/item)", nom:voucherNom, show:active.voucher_xtra},
    {label:"Pre-Order 3% (TikTok only)", nom:poNom, show:active.pre_order && platform==="tiktok"},
    {label:`Afiliasi Kreator (${afiliasiPct}%)`, nom:afilNom, show:active.afiliasi},
    {label:`GMV Max Ads (${gmvPct}%)`, nom:gmvNom, show:active.gmv_max && platform==="tiktok"},
    {label:"TopAds Tokopedia (~3%)", nom:topadNom, show:active.topads && platform==="tokopedia"},
    {label:`LIVE Ads (~${liveAdsPct}%)`, nom:liveNom, show:active.live_ads && platform==="tiktok"},
    {label:"Biaya Layanan Cashback Bonus (~2%)", nom:cashNom, show:active.cashback_bonus},
    {label:`Subsidi Co-Funded Voucher (${activeCoFundedTier?.badge || 'Event'})`, nom:coFundedNom, show:Boolean(coFundedNom > 0)},
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
    
    if (qty > 1) {
      saran.push(`📦 Simulasi Paket ${qty} Pcs: Biaya proses order flat Rp1.250 & biaya operasional terbagi rata ke ${qty} produk. Margin per unit naik signifikan dibanding jual eceran 1 pcs!`);
    }

    if (active.afiliasi) {
      if (afiliasiPct <= 1) {
        saran.push("🤝 Komisi Afiliasi 1% Aktif: Sangat tepat untuk produk fast-moving/sembako. Kreator bisa sematkan ke keranjang kuning tanpa membebani laba toko.");
      } else {
        saran.push(`🤝 Komisi Afiliasi ${afiliasiPct}% Aktif: Nilai komisi yang menggiurkan bagi affiliator dan kreator video/live TikTok.`);
      }
    }

    if (totalVoucherPembeli > 0) {
      saran.push(`🎟️ Simulasi Voucher Aktif: Pembeli checkout di harga ${formatRp(nominalDibayarPembeli)} (diskon ${formatRp(totalVoucherPembeli)}), saldo masuk tokomu tetap aman ${formatRp(jumlahPenyelesaian)}!`);
    }

    if (ikutPromo) {
      saran.push(`🎯 Diskon Penjual Aktif: Diskon ${diskonType==="pct"?`${diskonVal}%`:formatRp(diskonVal)}. Mengurangi dasar komisi platform secara resmi.`);
    }

    if (margin < 10) {
      saran.push("🔴 Margin Tipis (<10%). Rekomendasi: Gunakan tombol '🎯 Rekomendasi (15%)' di atas untuk menaikkan harga jual secara proporsional agar tidak berisiko boncos saat ada retur!");
    } else if (margin >= 10 && margin <= 25) {
      saran.push("🟢 Margin Sehat (10-25%). Skema harga sangat ideal! Toko aman dari rugi, harga tidak kemahalan bagi pembeli, dan konversi checkout tinggi.");
    } else {
      saran.push("💎 Margin Tebal (>25%). Sangat aman ikut Joint Campaign Co-Funded (diskon 20-35%) atau push GMV Max Ads.");
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
                    setHargaBeli(0); setHargaJual(14892); setQty(1);
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
        <div className="grid grid-cols-2 sm:grid-cols-5 bg-gray-900/80 border border-gray-800 rounded-2xl p-1 gap-1 mb-4 shadow-sm">
          {[
            ["kalkulator", "🧮 Kalkulator Cuan"],
            ["matriks_program", "🎯 Rekomendasi Program & HPP"],
            ["campaign", "🎪 Jenis Campaign & Promo"],
            ["semua_program", "📋 Semua Program Biaya"],
            ["strategi", "💡 Panduan Strategi"],
          ].map(([t,l])=>(
            <button key={t} onClick={()=>setMainTab(t)}
              className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${mainTab===t?"bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md":"text-gray-400 hover:text-white hover:bg-gray-800/50"}`}>
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

            {/* Modal & Menu Jumlah Quantity & Harga Jual */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 shadow-md space-y-4">
              
              {/* Modal HPP Satuan */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">1. Modal / Harga Beli (HPP per Unit/Pcs)</p>
                  <span className="text-xs font-bold text-gray-300">{formatRp(hargaBeli)} / pcs</span>
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

              {/* FITUR BARU: MENU JUMLAH QUANTITY (Qty) YANG DIHITUNG */}
              <div className="bg-gradient-to-r from-purple-950/40 via-pink-950/30 to-gray-900 border border-pink-500/40 rounded-2xl p-3.5 space-y-3 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-pink-600/80 text-white flex items-center justify-center text-xs font-bold shadow">📦</span>
                    <div>
                      <p className="text-xs font-black text-white tracking-wide">Jumlah Quantity (Qty) yang Dihitung</p>
                      <p className="text-[11px] text-pink-300/80">Simulasi pesanan satuan, grosir, atau paket bundling</p>
                    </div>
                  </div>
                  
                  {/* Stepper Counter */}
                  <div className="flex items-center gap-1.5 bg-gray-900/90 border border-pink-500/60 rounded-xl p-1 self-start sm:self-auto">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-pink-600 text-white rounded-lg text-sm font-black transition-all active:scale-95"
                      title="Kurangi 1"
                    >
                      -
                    </button>
                    <div className="flex items-center px-2">
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={qty}
                        onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-12 bg-transparent text-center font-black text-sm text-pink-300 outline-none"
                      />
                      <span className="text-xs text-gray-400 font-bold ml-0.5">pcs</span>
                    </div>
                    <button
                      onClick={() => setQty(qty + 1)}
                      className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-pink-600 text-white rounded-lg text-sm font-black transition-all active:scale-95"
                      title="Tambah 1"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Preset Qty Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-gray-400 mr-1">Pilihan Cepat:</span>
                  {[1, 2, 3, 4, 5, 10, 20, 50, 100].map(q => (
                    <button
                      key={q}
                      onClick={() => setQty(q)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all ${
                        qty === q
                          ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white border-pink-400 shadow-md scale-105"
                          : "bg-gray-800/80 text-gray-300 border-gray-700 hover:border-pink-500/50 hover:text-white"
                      }`}
                    >
                      {q} pcs
                    </button>
                  ))}
                </div>

                {/* Subtotal Bar & Packing Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-pink-900/30 text-xs">
                  <div className="bg-gray-900/70 p-2 rounded-xl border border-gray-800">
                    <p className="text-[10px] text-gray-400 font-medium uppercase">Total Modal (HPP × {qty} pcs):</p>
                    <p className="font-extrabold text-white text-sm mt-0.5">{formatRp(subtotalHPP)}</p>
                  </div>
                  <div className="bg-gray-900/70 p-2 rounded-xl border border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">Biaya Packing Operasional:</p>
                      <p className="font-bold text-pink-300 text-xs mt-0.5">{formatRp(totalOpsEffective)}</p>
                    </div>
                    <button
                      onClick={() => setOpsPerPesanan(!opsPerPesanan)}
                      className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-2 py-1 rounded-lg font-semibold transition-all"
                      title="Klik untuk ganti mode hitung biaya packing"
                    >
                      {opsPerPesanan ? "📦 1 Paket (Hemat)" : "🛍️ Per Pcs"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Harga Jual Normal Satuan */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">2. Harga Jual Normal (Katalog Toko per Unit)</p>
                    <p className="text-[11px] text-gray-500">Subtotal Katalog: <strong className="text-pink-300">{formatRp(subtotalKatalog)}</strong> ({qty} pcs)</p>
                  </div>
                  <span className="text-xs font-bold text-pink-400">{formatRp(hargaJual)} / pcs</span>
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
              </div>

              {/* FITUR BARU: SKEMA UNTUNG LOGIS & RELEVAN (DUAL MODE: PERSEN % & NOMINAL RP) */}
              <div className="bg-gray-950/70 border border-gray-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎯</span>
                    <div>
                      <p className="text-xs font-black text-white">Target Profit & Skema Harga Logis</p>
                      <p className="text-[10px] text-gray-400">Tentukan target untung dalam <span className="text-pink-400 font-semibold">Persen (%)</span> atau <span className="text-emerald-400 font-semibold">Nominal Bersih (Rp)</span></p>
                    </div>
                  </div>

                  {/* Switcher Mode: Persen vs Nominal */}
                  <div className="flex bg-gray-900 p-0.5 rounded-xl border border-gray-800 text-[11px] font-bold self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setTargetProfitMode("percent")}
                      className={`py-1 px-2.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        targetProfitMode === "percent"
                          ? "bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span>📊</span> Persen (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetProfitMode("nominal")}
                      className={`py-1 px-2.5 rounded-lg transition-all flex items-center gap-1.5 ${
                        targetProfitMode === "nominal"
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      <span>💵</span> Nominal (Rp)
                    </button>
                  </div>
                </div>

                {/* KONTEN JIKA MODE: PERSEN (%) */}
                {targetProfitMode === "percent" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {/* BEP */}
                      <button
                        onClick={() => setHargaJual(bep)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-red-950/40 border-red-800/80 hover:bg-red-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-red-300">🛑 BEP (Impas 0%)</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(bep)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Batas modal balik 100%</p>
                      </button>

                      {/* Penetrasi 10% */}
                      <button
                        onClick={() => setHargaJual(h10)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-amber-950/40 border-amber-800/80 hover:bg-amber-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-300">⚡ Penetrasi (10%)</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(h10)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Murah, kejar volume & FYP</p>
                      </button>

                      {/* Rekomendasi Seimbang 15% (Highlight) */}
                      <button
                        onClick={() => setHargaJual(h15)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-gradient-to-br from-emerald-950/70 to-teal-950/70 border-emerald-500/80 hover:border-emerald-400 shadow-md relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-emerald-300">🎯 Rekomendasi (15%)</span>
                          <span className="text-[9px] bg-emerald-500 text-gray-950 px-1 rounded font-black">IDEAL</span>
                        </div>
                        <p className="text-xs font-extrabold text-emerald-100 mt-1">{formatRp(h15)}</p>
                        <p className="text-[10px] text-emerald-300/80 mt-0.5">Pas di pembeli, cuan aman</p>
                      </button>

                      {/* Margin Sehat 20% */}
                      <button
                        onClick={() => setHargaJual(h20)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-blue-950/40 border-blue-800/80 hover:bg-blue-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-300">🛡️ Margin Sehat (20%)</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(h20)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Cover retur & operasional</p>
                      </button>

                      {/* Campaign & Ads 25% */}
                      <button
                        onClick={() => setHargaJual(h25)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-purple-950/40 border-purple-800/80 hover:bg-purple-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-purple-300">🎪 Campaign (25%)</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(h25)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Ruang diskon voucher & ads</p>
                      </button>

                      {/* Margin Tebal 30% */}
                      <button
                        onClick={() => setHargaJual(h30)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-pink-950/40 border-pink-800/80 hover:bg-pink-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-pink-300">💎 Premium (30%)</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(h30)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Produk unik / tanpa saingan</p>
                      </button>
                    </div>

                    {/* Custom Target Margin Input */}
                    <div className="pt-2 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-[11px]">Ketik Margin Custom:</span>
                        <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-0.5">
                          <input
                            type="number"
                            min={1}
                            max={80}
                            value={customTargetMargin}
                            onChange={e => setCustomTargetMargin(Math.max(1, Number(e.target.value)))}
                            className="w-12 bg-transparent text-white font-bold text-xs outline-none text-right"
                          />
                          <span className="text-gray-400 font-bold text-xs">%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setHargaJual(customTargetPrice)}
                        className="bg-gray-800 hover:bg-pink-600 text-pink-300 hover:text-white px-3 py-1 rounded-xl font-bold transition-all border border-pink-500/40 text-[11px] self-end sm:self-auto"
                      >
                        Terapkan Harga {formatRp(customTargetPrice)} ({customTargetMargin}%) →
                      </button>
                    </div>
                  </div>
                )}

                {/* KONTEN JIKA MODE: NOMINAL (RP / RIBUAN) */}
                {targetProfitMode === "nominal" && (
                  <div className="space-y-3">
                    {/* Sub-header Scope (Per Pcs vs Per Pesanan) */}
                    <div className="flex items-center justify-between bg-gray-900/80 px-2.5 py-1.5 rounded-xl border border-gray-800 text-xs">
                      <span className="text-[11px] text-gray-400 font-medium">Hitung target cuan untuk:</span>
                      <div className="flex items-center gap-1 bg-gray-950 p-0.5 rounded-lg border border-gray-700">
                        <button
                          type="button"
                          onClick={() => setTargetNominalScope("per_pcs")}
                          className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all ${
                            targetNominalScope === "per_pcs"
                              ? "bg-emerald-600 text-white"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Per Pcs
                        </button>
                        <button
                          type="button"
                          onClick={() => setTargetNominalScope("per_order")}
                          className={`px-2 py-0.5 text-[10px] rounded font-bold transition-all ${
                            targetNominalScope === "per_order"
                              ? "bg-teal-600 text-white"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          Per Pesanan ({qty} Pcs)
                        </button>
                      </div>
                    </div>

                    {/* Grid 6 Tombol Preset Nominal Cuan */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {/* +Rp2.000 */}
                      <button
                        onClick={() => setHargaJual(n2k)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-amber-950/40 border-amber-800/80 hover:bg-amber-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-amber-300">⚡ +Rp2.000 / pcs</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(n2k)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Volume cepat, harga kompetitif</p>
                      </button>

                      {/* +Rp5.000 (Ideal) */}
                      <button
                        onClick={() => setHargaJual(n5k)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-gradient-to-br from-emerald-950/70 to-teal-950/70 border-emerald-500/80 hover:border-emerald-400 shadow-md relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-emerald-300">🎯 +Rp5.000 / pcs</span>
                          <span className="text-[9px] bg-emerald-500 text-gray-950 px-1 rounded font-black">IDEAL</span>
                        </div>
                        <p className="text-xs font-extrabold text-emerald-100 mt-1">{formatRp(n5k)}</p>
                        <p className="text-[10px] text-emerald-300/80 mt-0.5">Standar logis paling seimbang</p>
                      </button>

                      {/* +Rp10.000 */}
                      <button
                        onClick={() => setHargaJual(n10k)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-blue-950/40 border-blue-800/80 hover:bg-blue-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-300">🛡️ +Rp10.000 / pcs</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(n10k)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Nyaman, aman biaya retur</p>
                      </button>

                      {/* +Rp15.000 */}
                      <button
                        onClick={() => setHargaJual(n15k)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-purple-950/40 border-purple-800/80 hover:bg-purple-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-purple-300">🎪 +Rp15.000 / pcs</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(n15k)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Tebal, siap bakar voucher ads</p>
                      </button>

                      {/* +Rp25.000 */}
                      <button
                        onClick={() => setHargaJual(n25k)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-pink-950/40 border-pink-800/80 hover:bg-pink-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-pink-300">💎 +Rp25.000 / pcs</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(n25k)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Cocok fashion / elektronik</p>
                      </button>

                      {/* +Rp50.000 */}
                      <button
                        onClick={() => setHargaJual(n50k)}
                        className="p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] bg-indigo-950/40 border-indigo-800/80 hover:bg-indigo-950/70"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-300">👑 +Rp50.000 / pcs</span>
                        </div>
                        <p className="text-xs font-extrabold text-white mt-1">{formatRp(n50k)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Produk eksklusif / margin jumbo</p>
                      </button>
                    </div>

                    {/* Custom Target Nominal Input */}
                    <div className="pt-2 border-t border-gray-800 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-[11px]">Ketik Nominal Cuan:</span>
                          <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-0.5">
                            <span className="text-emerald-400 font-bold text-xs">Rp</span>
                            <input
                              type="number"
                              min={100}
                              step={500}
                              value={customTargetNominal}
                              onChange={e => setCustomTargetNominal(Math.max(0, Number(e.target.value)))}
                              className="w-24 bg-transparent text-white font-bold text-xs outline-none"
                            />
                            <span className="text-gray-500 text-[10px]">/{targetNominalScope === "per_pcs" ? "pcs" : "order"}</span>
                          </div>
                        </div>

                        {/* Preset Chips */}
                        <div className="flex items-center gap-1">
                          {[3000, 7500, 12000, 20000].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setCustomTargetNominal(v)}
                              className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-all ${
                                customTargetNominal === v
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-800 text-gray-400 hover:text-white"
                              }`}
                            >
                              +{v >= 1000 ? `${v / 1000}rb` : v}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Baris Ringkasan & Tombol Terapkan */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                        <p className="text-[11px] text-emerald-300">
                          Target bersih: <strong className="text-white">{formatRp(effTargetNominalPerPcs)}/pcs</strong>
                          {qty > 1 && (
                            <span className="text-gray-400"> (Total {formatRp(effTargetNominalPerPcs * qty)} untuk {qty} pcs)</span>
                          )}
                        </p>
                        <button
                          onClick={() => setHargaJual(customTargetNominalPrice)}
                          className="bg-emerald-950 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3 py-1 rounded-xl font-bold transition-all border border-emerald-500/50 text-[11px] self-end sm:self-auto shadow-sm"
                        >
                          Terapkan Harga {formatRp(customTargetNominalPrice)} (+{formatRp(effTargetNominalPerPcs)}) →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* FITUR: Simulasi Diskon Campaign Seller */}
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
                      <button onClick={()=>setDiskonType("nominal")} className={`text-[10px] font-bold px-2 py-0.5 rounded ${diskonType==="nominal"?"bg-pink-600 text-white":"text-gray-400"}`}>Rp/pcs</button>
                    </div>
                  )}
                </div>

                {ikutPromo && (
                  <div className="mt-2.5 bg-pink-950/30 border border-pink-800/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-gray-300 font-medium">Besaran Diskon Penjual:</span>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={diskonVal} onChange={e=>setDiskonVal(Math.max(0, Number(e.target.value)))}
                          className="w-20 bg-gray-800 border border-pink-500 rounded-lg px-2 py-1 text-right text-xs font-bold text-white outline-none"/>
                        <span className="text-xs font-bold text-pink-400">{diskonType==="pct"?"%":"Rp/pcs"}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-300 pt-1 border-t border-pink-900/40">
                      <span>Total Diskon Penjual ({qty} pcs):</span>
                      <span className="font-extrabold text-pink-400">-{formatRp(diskonSellerNominal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-300">
                      <span>Subtotal Bersih Penjual (Basis Komisi Platform):</span>
                      <span className="font-extrabold text-white text-sm">{formatRp(hargaSetelahDiskon)}</span>
                    </div>
                    <p className="text-[11px] text-pink-300/80 leading-relaxed">
                      💡 Komisi resmi TikTok Shop dihitung dari <strong>(Harga Jual × Qty - Diskon Seller)</strong>.
                    </p>
                  </div>
                )}
              </div>

              {/* FITUR KHUSUS: SIMULASI CAMPAIGN CO-FUNDED GAJIAN SALE & 11.11 2026 */}
              <div className="pt-3 border-t border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <span>🤝</span> Skema Co-Funded Voucher (Gajian & 11.11)
                  </span>
                  {selectedCoFunded !== 'none' && (
                    <button onClick={()=>setSelectedCoFunded('none')} className="text-[10px] text-gray-400 hover:text-white underline">
                      Reset
                    </button>
                  )}
                </div>

                <select
                  value={selectedCoFunded}
                  onChange={e=>setSelectedCoFunded(e.target.value)}
                  className="w-full bg-gray-800 border border-amber-600/70 rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="none">-- Tidak Ikut Co-Funded (Normal / Mandiri) --</option>
                  <optgroup label="🟢 Bebas Biaya (100% Subsidi Platform / 0% Beban Toko)">
                    <option value="boost_free">Voucher Boost (Gratis 0% Beban Toko - Platform s/d 20%)</option>
                    <option value="growth_deal_free">Growth Xtra Special Deal (100% Subsidi TikTok - 0% Toko)</option>
                  </optgroup>
                  <optgroup label="🟣 [XBP] Co-Funded (Platform 65% : Toko 35%)">
                    <option value="xbp_10_60k">Disc 10% (Toko 3.50%) · Min Rp60k (TTS Only)</option>
                    <option value="xbp_10_100k">Disc 10% (Toko 3.50%) · Min Rp100k (Toko Only)</option>
                    <option value="xbp_20_75k">Disc 20% (Toko 7.00%) · Min Rp75k (TTS Only)</option>
                    <option value="xbp_20_100k">Disc 20% (Toko 7.00%) · Min Rp100k (TTS & Toko)</option>
                    <option value="xbp_20_130k">Disc 20% (Toko 7.00%) · Min Rp130k (TTS & Toko)</option>
                    <option value="xbp_25_300k">Disc 25% (Toko 8.75%) · Min Rp300k (TTS & Toko)</option>
                    <option value="xbp_30_500k">Disc 30% (Toko 10.50%) · Min Rp500k (TTS & Toko)</option>
                    <option value="xbp_35_peak">Disc 35% Peak (Toko 12.25%) · Min Rp1.8jt (Peak Day)</option>
                  </optgroup>
                  <optgroup label="🟠 Co-Funded Reguler (Platform 40% : Toko 60%)">
                    <option value="reg_10_60k">Disc 10% (Toko 6.00%) · Min Rp60k (TTS Only)</option>
                    <option value="reg_20_75k">Disc 20% (Toko 12.00%) · Min Rp75k (TTS Only)</option>
                    <option value="reg_20_100k">Disc 20% (Toko 12.00%) · Min Rp100k (TTS & Toko)</option>
                    <option value="reg_20_130k">Disc 20% (Toko 12.00%) · Min Rp130k (TTS & Toko)</option>
                    <option value="reg_25_300k">Disc 25% (Toko 15.00%) · Min Rp300k (TTS & Toko)</option>
                    <option value="reg_30_500k">Disc 30% (Toko 18.00%) · Min Rp500k (TTS & Toko)</option>
                    <option value="reg_35_peak">Disc 35% Peak (Toko 21.00%) · Min Rp1.8jt (Peak Day)</option>
                  </optgroup>
                  <optgroup label="🎙️ [ID 2026] LIVE Festival Q3 2026 (Platform 40% - 90% : Toko 10% - 60%)">
                    <option value="live_50_peak">🔥 Disc 50% Peak (Toko 5.00% · Cap Rp1rb) · Min Rp10k (Plat 90% : Toko 10%)</option>
                    <option value="live_25_peak">⚡ Disc 25% Peak (Toko 5.00% · Cap Rp75rb) · Min Rp1.5jt (Plat 80% : Toko 20%)</option>
                    <option value="live_22_peak">⚡ Disc 22% Peak (Toko 5.06% · Cap Rp92rb) · Min Rp500k (Plat 77% : Toko 23%)</option>
                    <option value="live_20_peak">⚡ Disc 20% Peak (Toko 5.00% · Cap Rp75rb) · Min Rp300k (Plat 75% : Toko 25%)</option>
                    <option value="live_17_peak">⚡ Disc 17% Peak (Toko 4.93% · Cap Rp58rb) · Min Rp200k (Plat 71% : Toko 29%)</option>
                    <option value="live_15_nonpeak">🎙️ Disc 15% Non-Peak (Toko 4.50% · Cap Rp45rb) · Min Rp150k (Plat 70% : Toko 30%)</option>
                    <option value="live_11_nonpeak">🎙️ Disc 11% Non-Peak (Toko 3.96% · Cap Rp36rb) · Min Rp100k (Plat 64% : Toko 36%)</option>
                    <option value="live_5_nonpeak">🎙️ Disc 5% Non-Peak (Toko 3.00% · Cap Rp1.2jt) · Min Rp50k (Plat 40% : Toko 60%)</option>
                  </optgroup>
                  <optgroup label="🟡 Spesial Co-Funded (Platform 45% : Toko 55%)">
                    <option value="sp_8_50k">Always On 8% (Toko 4.40%) · Min Rp50k</option>
                    <option value="sp_20_150k">Always On 20% (Toko 11.00%) · Min Rp150k</option>
                    <option value="sp_25_500k">Jam Puncak 25% (Toko 13.75%) · Min Rp500k</option>
                    <option value="sp_35_800k">Hari Puncak 35% (Toko 19.25%) · Min Rp800k</option>
                  </optgroup>
                </select>

                {activeCoFundedTier && (
                  <div className="mt-2.5 bg-gray-800/90 border border-amber-600/40 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-300">Proporsi Patungan Voucher:</span>
                      <span className="font-extrabold text-amber-300">
                        Platform {activeCoFundedTier.platformPct}% : Toko {activeCoFundedTier.sellerPct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-300">Voucher yang Diterima Pembeli:</span>
                      <span className="font-extrabold text-emerald-400">
                        {isCoFundedMinBelanjaMet ? `${activeCoFundedTier.diskonPembeli}% (-${formatRp(coFundedDiskonPembeli)})` : `Belum Aktif (Min. ${formatRp(activeCoFundedTier.minBelanja)})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-300">Beban Subsidi Toko:</span>
                      <span className="font-extrabold text-red-400">
                        {activeCoFundedTier.effectiveSellerPct > 0
                          ? (isCoFundedMinBelanjaMet ? `-${activeCoFundedTier.effectiveSellerPct}% (-${formatRp(coFundedNom)})` : 'Rp0 (Syarat Belanja Belum Cukup)')
                          : 'Rp0 (100% Ditanggung Platform)'}
                      </span>
                    </div>

                    {activeCoFundedTier.minBelanja > 0 && (
                      <div className="pt-2 border-t border-gray-700/60">
                        {isCoFundedMinBelanjaMet ? (
                          <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <span>✅</span> Subtotal pesanan ({formatRp(hargaSetelahDiskon)} untuk {qty} pcs) memenuhi syarat Min. Belanja ({formatRp(activeCoFundedTier.minBelanja)}).
                          </p>
                        ) : (
                          <div className="bg-amber-950/40 border border-amber-700/60 rounded-lg p-2 space-y-1">
                            <p className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
                              <span>⚠️</span> Subtotal pesanan ({formatRp(hargaSetelahDiskon)}) &lt; Min. Belanja ({formatRp(activeCoFundedTier.minBelanja)}).
                            </p>
                            <p className="text-[10px] text-gray-300">
                              Voucher akan aktif jika pembeli memesan minimal <strong>{Math.ceil(activeCoFundedTier.minBelanja / (hargaSetelahDiskon/qty || 1))} pcs</strong>.
                              <button
                                onClick={() => setQty(Math.ceil(activeCoFundedTier.minBelanja / (hargaSetelahDiskon/qty || 1)))}
                                className="ml-2 underline text-amber-400 font-bold hover:text-white"
                              >
                                Set Qty ke {Math.ceil(activeCoFundedTier.minBelanja / (hargaSetelahDiskon/qty || 1))} pcs →
                              </button>
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Interactive Program Recommendation Box */}
                    {currentProgramRec && (
                      <div className="mt-3 bg-gradient-to-br from-indigo-950/70 via-gray-900 to-purple-950/60 border border-indigo-500/50 rounded-xl p-3.5 space-y-3 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🎯</span>
                            <div>
                              <h4 className="text-xs font-black text-white">Rekomendasi Ikut Program Ini</h4>
                              <p className="text-[10px] text-indigo-300">Analisis margin & simulasi harga untuk {qty} pcs</p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${currentProgramRec.statusCls}`}>
                            {currentProgramRec.statusBadge}
                          </span>
                        </div>

                        {/* Saran Strategi / Tips */}
                        <div className="text-[11px] text-gray-200 bg-black/40 p-2.5 rounded-lg border border-white/10 flex items-start gap-2">
                          <span className="text-amber-400 text-sm mt-0.5">💡</span>
                          <div className="leading-snug">{currentProgramRec.statusTips}</div>
                        </div>

                        {/* Grid Rekomendasi HPP, Harga Jual, Cuan & Bayar Pembeli */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {/* 1. Rekomendasi HPP Modal */}
                          <div className="bg-gray-900/90 p-2.5 rounded-xl border border-gray-700/70">
                            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                              <span>📦 Rekomendasi HPP:</span>
                              <span className="font-semibold text-gray-300">Modal Satuan</span>
                            </div>
                            <div className="font-black text-white text-sm">
                              {formatRp(currentProgramRec.hppMin)} – {formatRp(currentProgramRec.hppMax)}
                            </div>
                            <div className="text-[10px] mt-1 text-gray-400">
                              Modal Anda: <strong className={hargaBeli >= currentProgramRec.hppMin && hargaBeli <= currentProgramRec.hppMax ? "text-emerald-400" : "text-amber-400"}>{formatRp(hargaBeli)}</strong>
                            </div>
                          </div>

                          {/* 2. Rekomendasi Harga Jual */}
                          <div className="bg-gray-900/90 p-2.5 rounded-xl border border-indigo-500/50 shadow-inner">
                            <div className="flex items-center justify-between text-[10px] text-indigo-300 mb-1">
                              <span>🏷️ Rekomendasi Harga Jual:</span>
                              <span className="font-semibold text-indigo-200">Per Pcs</span>
                            </div>
                            <div className="font-black text-indigo-300 text-sm">
                              {formatRp(currentProgramRec.recIdealPrice)}
                            </div>
                            <div className="text-[10px] mt-1 text-gray-400">
                              Rentang: <span className="text-gray-300">{formatRp(currentProgramRec.recMinPrice)} (BEP)</span> s/d <span className="text-gray-300">{formatRp(currentProgramRec.recMaxPrice)}</span>
                            </div>
                          </div>

                          {/* 3. Estimasi Dibayar Pembeli di Checkout */}
                          <div className="bg-gray-900/90 p-2.5 rounded-xl border border-pink-500/50">
                            <div className="flex items-center justify-between text-[10px] text-pink-300 mb-1">
                              <span>🛒 Dibayar Pembeli:</span>
                              <span className="font-semibold text-pink-200">{qty} Pcs</span>
                            </div>
                            <div className="font-black text-pink-200 text-sm">
                              {formatRp(currentProgramRec.buyerCheckoutPerPcs)} <span className="text-[10px] font-normal text-pink-300">/ pcs</span>
                            </div>
                            <div className="text-[10px] mt-1 text-gray-400">
                              Total Checkout: <strong className="text-white">{formatRp(currentProgramRec.buyerCheckout)}</strong> (Hemat {formatRp(currentProgramRec.buyerVoucherNominal)})
                            </div>
                          </div>

                          {/* 4. Kisaran Keuntungan Bersih (Profit) */}
                          <div className="bg-gray-900/90 p-2.5 rounded-xl border border-emerald-500/50">
                            <div className="flex items-center justify-between text-[10px] text-emerald-300 mb-1">
                              <span>💰 Estimasi Profit Bersih:</span>
                              <span className="font-semibold text-emerald-200">Margin {currentProgramRec.netMarginPct}%</span>
                            </div>
                            <div className="font-black text-emerald-400 text-sm">
                              +{formatRp(currentProgramRec.netProfitPerPcs)} <span className="text-[10px] font-normal text-emerald-300">/ pcs</span>
                            </div>
                            <div className="text-[10px] mt-1 text-gray-400">
                              Total Order: <strong className="text-emerald-300">+{formatRp(currentProgramRec.netProfitTotal)}</strong> (sudah potong fee & subsidi)
                            </div>
                          </div>
                        </div>

                        {/* Tombol Terapkan Cepat & Keterangan Patungan */}
                        <div className="pt-2 border-t border-gray-700/60 flex flex-col sm:flex-row items-center justify-between gap-2">
                          <div className="text-[10px] text-gray-400 text-center sm:text-left">
                            Porsi Subsidi: Platform <span className="text-emerald-400 font-bold">{formatRp(currentProgramRec.platformSubsidy)}</span> | Toko <span className="text-amber-400 font-bold">{formatRp(currentProgramRec.sellerSubsidy)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHargaJual(currentProgramRec.recIdealPrice)}
                            className="w-full sm:w-auto px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                          >
                            <span>🎯 Terapkan Harga Rekomendasi ({formatRp(currentProgramRec.recIdealPrice)}) →</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Simulasi Tambahan Voucher Platform 100% */}
                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-gray-400">Voucher Platform Tambahan:</span>
                    {[0, 5, 10, 15, 20].map(p => (
                      <button
                        key={p}
                        onClick={() => setVoucherPlatformPct(p)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                          voucherPlatformPct === p
                            ? "bg-cyan-600 text-white border-cyan-400"
                            : "bg-gray-800 text-cyan-300 border-gray-700"
                        }`}
                      >
                        {p === 0 ? "0%" : `${p}%`}
                      </button>
                    ))}
                  </div>
                  {voucherPlatformNominal > 0 && (
                    <span className="text-[10px] text-cyan-300 font-bold">
                      -{formatRp(voucherPlatformNominal)} (100% Platform)
                    </span>
                  )}
                </div>
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
                <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-2.5 col-span-1 sm:col-span-2">
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2 cursor-pointer flex-1">
                      <input type="checkbox" checked={active.afiliasi} onChange={e=>setActive(p=>({...p,afiliasi:e.target.checked}))} className="accent-pink-500 w-3.5 h-3.5 mt-0.5"/>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs text-gray-200 font-bold">Komisi Afiliasi Kreator</p>
                          <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/40 px-1.5 py-0.2 rounded font-bold">
                            Tersedia Pilihan 1%
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">Promosi via video keranjang kuning, showcase profil, & LIVE kreator</p>
                      </div>
                    </label>
                    {active.afiliasi && (
                      <span className="text-xs font-black text-pink-400">
                        {afiliasiPct}% (-{formatRp(afilNom)})
                      </span>
                    )}
                  </div>
                  {active.afiliasi && (
                    <div className="mt-2 pl-5 space-y-1.5 pt-2 border-t border-gray-700/50">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-400 font-medium">Pilihan Tarif:</span>
                        {[1, 2, 3, 5, 8, 10, 15].map(v=>(
                          <button
                            key={v}
                            onClick={()=>setAfiliasiPct(v)}
                            className={`text-xs px-2 py-0.5 rounded-lg font-bold border transition-all ${
                              afiliasiPct===v
                                ? (v===1 ? "bg-amber-500 text-gray-950 border-amber-400 shadow-md font-black" : "bg-pink-600 text-white border-pink-400 shadow-md")
                                : "bg-gray-800 text-pink-300 border-gray-700 hover:border-pink-500"
                            }`}
                          >
                            {v}%{v===1?" ⭐":""}
                          </button>
                        ))}
                        <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-1.5 py-0.5 ml-1">
                          <span className="text-[10px] text-gray-400">Custom:</span>
                          <input
                            type="number"
                            min={0.1}
                            max={50}
                            step={0.1}
                            value={afiliasiPct}
                            onChange={e=>setAfiliasiPct(Math.max(0, Number(e.target.value)))}
                            className="w-12 bg-transparent text-xs font-bold text-white text-right outline-none"
                          />
                          <span className="text-xs text-pink-400 font-bold">%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-300/90 leading-relaxed bg-amber-950/30 border border-amber-800/40 rounded-lg p-1.5">
                        ⭐ <strong>Komisi 1% Afiliasi:</strong> Skema paling aman untuk produk FMCG, sembako, dan snack margin tipis. Kreator tetap bisa memasukkan produk ke Showcase etalase keranjang kuning tanpa menggerus keuntungan pokok toko!
                      </p>
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

          {/* KOLOM KANAN (Hasil Perhitungan, Struk Pembeli & Ringkasan Cuan) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Box Hasil Utama (Aware Quantity & Per Pcs) */}
            <div className={`rounded-2xl p-5 border-2 shadow-2xl ${status.cls}`}>
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="font-black text-base text-gray-900 flex items-center gap-1.5">
                    <span>📊</span> Hasil Transaksi ({qty} Pcs)
                  </p>
                  <p className="text-xs text-gray-600">
                    {platform==="tiktok"?"TikTok Shop":"Tokopedia"} · {qty} unit dlm 1 pesanan
                  </p>
                </div>
                <span className={`font-black text-xs px-3 py-1 rounded-full border-2 ${status.cls}`}>
                  {status.label}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-800">
                <div className="flex justify-between font-bold text-sm text-gray-900">
                  <span>Subtotal Normal ({qty} pcs)</span>
                  <span>{formatRp(subtotalKatalog)} <span className="text-[11px] font-normal text-gray-500">({formatRp(hargaJual)}/pcs)</span></span>
                </div>
                {ikutPromo && diskonSellerNominal > 0 && (
                  <div className="flex justify-between text-pink-700 font-semibold">
                    <span>Diskon Penjual ({diskonType==="pct"?`${diskonVal}%`:formatRp(diskonVal)})</span>
                    <span>-{formatRp(diskonSellerNominal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-gray-900 pb-1 border-b border-gray-300">
                  <span>Subtotal Bersih (Basis Komisi)</span>
                  <span>{formatRp(hargaSetelahDiskon)}</span>
                </div>

                {detailPlat.map((d,i)=>(
                  <div key={i} className={`flex justify-between ${d.wajib?"text-red-700 font-semibold text-xs":"text-orange-700"}`}>
                    <span>{d.label}</span>
                    <span className="font-bold">-{formatRp(d.nom)}</span>
                  </div>
                ))}

                {/* Jumlah Penyelesaian Pembayaran (Saldo Masuk ke Toko) */}
                <div className="flex justify-between items-center text-blue-900 font-bold pt-1.5 pb-1 border-t border-blue-200 bg-blue-100/60 px-2.5 py-1.5 rounded-xl -mx-1">
                  <div>
                    <span className="text-xs font-black">💳 Saldo Masuk ({platform==="tiktok"?"TikTok":"Tokopedia"})</span>
                    <p className="text-[10px] text-blue-700 font-medium">
                      Rata-rata: <strong>{formatRp(jumlahPenyelesaianPerPcs)}</strong> / pcs
                    </p>
                  </div>
                  <span className="font-black text-base text-blue-950">{formatRp(jumlahPenyelesaian)}</span>
                </div>

                <div className="flex justify-between text-orange-800 font-semibold border-t border-gray-200 pt-1">
                  <span>Biaya Operasional & Packing</span>
                  <span>-{formatRp(totalOpsEffective)} <span className="text-[10px] text-gray-500">({opsPerPesanan ? "1 paket" : `${formatRp(totalOps)} × ${qty}`})</span></span>
                </div>
                <div className="flex justify-between text-red-700 font-semibold">
                  <span>Modal HPP Produk ({qty} pcs)</span>
                  <span>-{formatRp(subtotalHPP)} <span className="text-[10px] text-gray-500">({formatRp(hargaBeli)}/pcs)</span></span>
                </div>

                {/* Keuntungan Bersih Akhir */}
                <div className="border-t-2 border-gray-900 pt-2.5 mt-2 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-black text-gray-950 uppercase tracking-wide">Keuntungan Bersih Toko</span>
                    <p className="text-[11px] text-gray-700 font-bold">
                      Rata-rata per pcs: <span className={cuan>=0?"text-green-800":"text-red-800"}>{cuan>=0?"+":""}{formatRp(cuanPerPcs)} / pcs</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black ${cuan>=0?"text-green-700":"text-red-700"}`}>
                      {cuan>=0?"+":""}{formatRp(cuan)}
                    </span>
                    <span className="text-[10px] text-gray-600 block font-semibold">Total {qty} pcs</span>
                  </div>
                </div>
              </div>

              {/* KPI Metrics */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  {label:"Net Margin", val:marginPct, d:marginPct.toFixed(1)+"%"},
                  {label:"ROI Modal", val:roiPct, d:roiPct.toFixed(1)+"%"},
                  {label:"Total Beban", val:potPct, d:potPct.toFixed(1)+"%"},
                ].map(s=>(
                  <div key={s.label} className="bg-white/90 backdrop-blur rounded-xl p-2.5 text-center shadow-sm border border-gray-200">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">{s.label}</p>
                    <p className={`font-black text-sm ${s.label==="Total Beban"?"text-gray-900":(s.val>=20?"text-green-700":s.val>=10?"text-orange-600":"text-red-600")}`}>{s.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FITUR BARU: KARTU ESTIMASI STRUK NOMINAL YANG DIBAYAR PEMBELI (CAMPAIGN & VOUCHER) */}
            <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-black rounded-2xl p-4 border border-cyan-500/40 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-bold border border-cyan-500/40">🛒</span>
                  <div>
                    <p className="text-xs font-black text-white">Struk Checkout Pembeli (Campaign & Voucher)</p>
                    <p className="text-[10px] text-gray-400">Estimasi nominal yang keluar dari dompet pembeli</p>
                  </div>
                </div>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-bold border border-cyan-500/30">
                  Aplikasi TikTok
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-300">
                <div className="flex justify-between">
                  <span>Harga Normal Katalog ({qty} pcs):</span>
                  <span className="font-bold text-white">{formatRp(subtotalKatalog)}</span>
                </div>

                {ikutPromo && diskonSellerNominal > 0 && (
                  <div className="flex justify-between text-pink-400">
                    <span>Diskon Campaign Penjual:</span>
                    <span className="font-bold">-{formatRp(diskonSellerNominal)}</span>
                  </div>
                )}

                {coFundedDiskonPembeli > 0 ? (
                  <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-2 space-y-1">
                    <div className="flex justify-between text-purple-300 font-bold">
                      <span>Voucher Campaign ({activeCoFundedTier?.label.split("·")[0] || "Co-Funded"}):</span>
                      <span className="text-emerald-400 font-black">-{formatRp(coFundedDiskonPembeli)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 pt-0.5 border-t border-purple-900/40">
                      <span>Subsidi TikTok Platform: <strong className="text-cyan-300">{formatRp(subsidiPlatformCoFunded)}</strong></span>
                      <span>Beban Toko: <strong className="text-amber-400">{formatRp(coFundedNom)}</strong></span>
                    </div>
                  </div>
                ) : activeCoFundedTier && !isCoFundedMinBelanjaMet ? (
                  <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-lg p-2">
                    ⚠️ Voucher Co-Funded belum aktif karena belanja &lt; {formatRp(activeCoFundedTier.minBelanja)}.
                  </div>
                ) : null}

                {voucherPlatformNominal > 0 && (
                  <div className="flex justify-between text-cyan-400 font-semibold">
                    <span>Voucher Tambahan Platform ({voucherPlatformPct}%):</span>
                    <span className="font-bold">-{formatRp(voucherPlatformNominal)}</span>
                  </div>
                )}

                {/* TOTAL DIBAYAR PEMBELI */}
                <div className="pt-2 border-t border-gray-700/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-white uppercase tracking-wider block">
                      Total Dibayar Pembeli:
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      Rata-rata: {formatRp(nominalDibayarPembeliPerPcs)} / pcs
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-emerald-400">
                      {formatRp(nominalDibayarPembeli)}
                    </span>
                    {subtotalKatalog > nominalDibayarPembeli && (
                      <span className="text-[10px] text-gray-400 block">
                        Hemat {formatRp(subtotalKatalog - nominalDibayarPembeli)} ({(((subtotalKatalog - nominalDibayarPembeli)/subtotalKatalog)*100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Ringkasan Win-Win */}
                <div className="pt-2 border-t border-gray-800 bg-gray-900/70 -mx-4 -mb-4 p-3 rounded-b-2xl flex items-center justify-between text-[11px]">
                  <div>
                    <span className="text-gray-400 block">Pembeli Puas:</span>
                    <strong className="text-cyan-300">{formatRp(nominalDibayarPembeli)}</strong>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400 block">Saldo Masuk:</span>
                    <strong className="text-blue-300">{formatRp(jumlahPenyelesaian)}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block">Laba Bersih Toko:</span>
                    <strong className={cuan>=0?"text-emerald-400":"text-red-400"}>
                      {cuan>=0?"+":""}{formatRp(cuan)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Rekomendasi Target Harga Ideal (6 Skema - Persen & Nominal) */}
            <div className="bg-gray-900/90 rounded-2xl p-4 border border-gray-800 shadow-md">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  🎯 6 Skema Harga ({targetProfitMode === "percent" ? "%" : "Rp"})
                </p>
                <div className="flex items-center gap-1 bg-gray-800 p-0.5 rounded-lg border border-gray-700 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setTargetProfitMode("percent")}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      targetProfitMode === "percent" ? "bg-pink-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetProfitMode("nominal")}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      targetProfitMode === "nominal" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Rp
                  </button>
                </div>
              </div>

              {/* Grid 6 Tombol Sesuai Mode */}
              {targetProfitMode === "percent" ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <button
                    onClick={() => setHargaJual(bep)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-red-400 font-bold truncate">Impas (BEP 0%)</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(bep)}</p>
                    <p className="text-[9px] text-gray-400">Modal balik</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(h10)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-amber-400 font-bold truncate">Penetrasi 10%</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(h10)}</p>
                    <p className="text-[9px] text-gray-400">Volume FYP</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(h15)}
                    className="bg-emerald-950/60 hover:bg-emerald-900/60 p-2 rounded-xl border border-emerald-500/60 transition-all text-left shadow-sm"
                  >
                    <p className="text-[10px] text-emerald-300 font-black truncate">⭐ Ideal 15%</p>
                    <p className="text-xs font-extrabold text-emerald-100 mt-0.5">{formatRp(h15)}</p>
                    <p className="text-[9px] text-emerald-300/80">Logis & aman</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(h20)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-blue-400 font-bold truncate">Sehat 20%</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(h20)}</p>
                    <p className="text-[9px] text-gray-400">Cover retur</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(h25)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-purple-400 font-bold truncate">Campaign 25%</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(h25)}</p>
                    <p className="text-[9px] text-gray-400">Buffer voucher</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(h30)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-pink-400 font-bold truncate">Premium 30%</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(h30)}</p>
                    <p className="text-[9px] text-gray-400">Margin tebal</p>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <button
                    onClick={() => setHargaJual(n2k)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-amber-400 font-bold truncate">+Rp2.000/pcs</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(n2k)}</p>
                    <p className="text-[9px] text-gray-400">Volume cepat</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(n5k)}
                    className="bg-emerald-950/60 hover:bg-emerald-900/60 p-2 rounded-xl border border-emerald-500/60 transition-all text-left shadow-sm"
                  >
                    <p className="text-[10px] text-emerald-300 font-black truncate">⭐ +Rp5.000</p>
                    <p className="text-xs font-extrabold text-emerald-100 mt-0.5">{formatRp(n5k)}</p>
                    <p className="text-[9px] text-emerald-300/80">Standar ideal</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(n10k)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-blue-400 font-bold truncate">+Rp10.000/pcs</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(n10k)}</p>
                    <p className="text-[9px] text-gray-400">Aman retur</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(n15k)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-purple-400 font-bold truncate">+Rp15.000/pcs</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(n15k)}</p>
                    <p className="text-[9px] text-gray-400">Siap promo</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(n25k)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-pink-400 font-bold truncate">+Rp25.000/pcs</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(n25k)}</p>
                    <p className="text-[9px] text-gray-400">Fashion/gadget</p>
                  </button>

                  <button
                    onClick={() => setHargaJual(n50k)}
                    className="bg-gray-800/80 hover:bg-gray-700/80 p-2 rounded-xl border border-gray-700 transition-all text-left"
                  >
                    <p className="text-[10px] text-indigo-400 font-bold truncate">+Rp50.000/pcs</p>
                    <p className="text-xs font-extrabold text-white mt-0.5">{formatRp(n50k)}</p>
                    <p className="text-[9px] text-gray-400">Super cuan</p>
                  </button>
                </div>
              )}
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

      {/* ── TAB: MATRIKS REKOMENDASI PROGRAM & HPP ── */}
      {mainTab === "matriks_program" && (
        <div className="max-w-7xl mx-auto px-4 pb-8 space-y-5">
          {/* Header Card with interactive HPP & Qty Quick Tweak */}
          <div className="bg-gradient-to-r from-gray-900 via-indigo-950/60 to-purple-950/50 rounded-2xl p-5 border border-indigo-500/40 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🎯</span>
                  <h2 className="text-xl font-black text-white">
                    Matriks Rekomendasi Program, HPP & Harga Jual
                  </h2>
                </div>
                <p className="text-xs text-indigo-200">
                  Rekomendasi otomatis HPP ideal, rentang harga jual aman (BEP s/d Ideal Cuan), dan estimasi profit untuk seluruh program campaign (LIVE Festival Q3 2026, XBP Gajian & 11.11, Bebas Biaya Komisi, Always On).
                </p>
              </div>

              {/* Quick Input Bar: Modal HPP & Qty */}
              <div className="flex flex-wrap items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/10">
                <div>
                  <label className="text-[10px] text-gray-400 block font-semibold mb-0.5">Modal HPP Satuan</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      value={hargaBeli}
                      onChange={(e) => setHargaBeli(Math.max(1, Number(e.target.value)))}
                      className="w-28 pl-8 pr-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white font-bold focus:ring-1 focus:ring-pink-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 block font-semibold mb-0.5">Jumlah Qty</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                      className="w-16 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white font-bold text-center focus:ring-1 focus:ring-pink-500"
                    />
                    <div className="flex gap-1">
                      {[1, 2, 3, 5].map(q => (
                        <button
                          key={q}
                          onClick={() => setQty(q)}
                          className={`px-1.5 py-1 text-[10px] rounded font-bold transition-all ${qty === q ? "bg-pink-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                        >
                          {q}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400 font-bold mr-1">Filter Program:</span>
              {[
                ["all", "Semua Program"],
                ["live_fest", "🎙️ LIVE Festival Q3 2026 (8 Tier)"],
                ["xbp_gajian", "⭐ XBP Gajian & 11.11 (4 Tier)"],
                ["bebas_biaya", "🛡️ Bebas Biaya Komisi (3 Tier)"],
                ["reg_spesial", "🟠 Reguler & Spesial (8 Tier)"],
              ].map(([filterKey, label]) => (
                <button
                  key={filterKey}
                  onClick={() => setMatrixFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    matrixFilter === filterKey
                      ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md"
                      : "bg-gray-800/80 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Program Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CO_FUNDED_TIERS
              .filter(tier => {
                if (matrixFilter === "all") return true;
                if (matrixFilter === "live_fest") return tier.group === "live_fest";
                if (matrixFilter === "xbp_gajian") return tier.group === "xbp";
                if (matrixFilter === "bebas_biaya") return tier.group === "free";
                if (matrixFilter === "reg_spesial") return tier.group === "reg" || tier.group === "sp";
                return true;
              })
              .map(tier => {
                const rec = getProgramRecommendation(tier);
                const isSelected = selectedCoFunded === tier.id;
                const isHppMatch = hargaBeli >= rec.hppMin && hargaBeli <= rec.hppMax;

                return (
                  <div
                    key={tier.id}
                    className={`bg-gray-900/90 rounded-2xl p-4 border transition-all shadow-md flex flex-col justify-between ${
                      isSelected
                        ? "border-pink-500/80 ring-2 ring-pink-500/30"
                        : "border-gray-800 hover:border-gray-700"
                    }`}
                  >
                    <div>
                      {/* Header Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">
                              {tier.group === "live_fest" ? "🎙️" : tier.group === "xbp" ? "⭐" : tier.group === "free" ? "🛡️" : "🤝"}
                            </span>
                            <span className="font-extrabold text-white text-sm">
                              {tier.label.split("·")[0]}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {tier.group === "live_fest"
                              ? "TikTok Shop LIVE Festival Q3 2026"
                              : tier.group === "xbp"
                              ? "XBP Extra Voucher Gajian Sale & 11.11"
                              : tier.group === "free"
                              ? "Program Bebas Biaya Komisi Extra"
                              : "Co-Funded Campaign Reguler / Spesial"}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${rec.statusCls}`}>
                            {rec.statusBadge}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold">
                            Min. Belanja: <strong className="text-white">{formatRp(tier.minBelanja)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Info Proporsi & Voucher */}
                      <div className="bg-black/30 rounded-xl p-2.5 mb-3 border border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-gray-400 block text-[10px]">Proporsi Patungan:</span>
                          <span className="font-bold text-amber-300">
                            Plat. {tier.platformPct}% : Toko {tier.sellerPct}%
                          </span>
                          <span className="text-[9px] text-gray-500 block">
                            Beban Seller: {tier.effectiveSellerPct}% (Cap {formatRp(tier.capSeller)})
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Voucher Pembeli:</span>
                          <span className="font-bold text-emerald-400">
                            Diskon {tier.diskonPembeli}%
                          </span>
                          <span className="text-[9px] text-gray-400 block">
                            Min. Belanja: {formatRp(tier.minBelanja)}
                          </span>
                        </div>
                      </div>

                      {/* Tips Kelayakan */}
                      <div className="text-[11px] text-gray-300 bg-gray-800/60 p-2 rounded-lg border border-gray-700/60 mb-3 flex items-start gap-1.5">
                        <span className="text-amber-400 text-xs">💡</span>
                        <div className="leading-snug text-[10px] sm:text-[11px]">{rec.statusTips}</div>
                      </div>

                      {/* 4 Kolom Rekomendasi Utama */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] mb-3">
                        {/* 1. Rekomendasi HPP */}
                        <div className="bg-gray-800/40 p-2 rounded-lg border border-gray-700/50">
                          <span className="text-gray-400 text-[10px] block">Rekomendasi HPP:</span>
                          <span className="font-bold text-white text-xs block">
                            {formatRp(rec.hppMin)} – {formatRp(rec.hppMax)}
                          </span>
                          <span className={`text-[9px] font-semibold block mt-0.5 ${isHppMatch ? "text-emerald-400" : "text-amber-400"}`}>
                            {isHppMatch ? "✅ Modal Anda Pas" : hargaBeli < rec.hppMin ? "📦 Perlu Bundling" : "⚠️ HPP Tinggi"}
                          </span>
                        </div>

                        {/* 2. Rekomendasi Harga Jual */}
                        <div className="bg-indigo-950/30 p-2 rounded-lg border border-indigo-700/40">
                          <span className="text-indigo-300 text-[10px] block">Rekomendasi Jual:</span>
                          <span className="font-extrabold text-indigo-200 text-xs block">
                            {formatRp(rec.recIdealPrice)} <span className="text-[9px] font-normal text-indigo-300">/ pcs</span>
                          </span>
                          <span className="text-[9px] text-gray-400 block mt-0.5">
                            Rentang: {formatRp(rec.recMinPrice)} (BEP) s/d {formatRp(rec.recMaxPrice)}
                          </span>
                        </div>

                        {/* 3. Estimasi Dibayar Pembeli */}
                        <div className="bg-pink-950/30 p-2 rounded-lg border border-pink-700/40">
                          <span className="text-pink-300 text-[10px] block">Bayar Pembeli:</span>
                          <span className="font-extrabold text-pink-200 text-xs block">
                            {formatRp(rec.buyerCheckoutPerPcs)} <span className="text-[9px] font-normal text-pink-300">/ pcs</span>
                          </span>
                          <span className="text-[9px] text-gray-400 block mt-0.5">
                            Total: {formatRp(rec.buyerCheckout)} (Hemat {formatRp(rec.buyerVoucherNominal)})
                          </span>
                        </div>

                        {/* 4. Estimasi Keuntungan Bersih */}
                        <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-700/40">
                          <span className="text-emerald-300 text-[10px] block">Profit Bersih:</span>
                          <span className="font-extrabold text-emerald-300 text-xs block">
                            +{formatRp(rec.netProfitPerPcs)} <span className="text-[9px] font-normal text-emerald-400">/ pcs</span>
                          </span>
                          <span className="text-[9px] text-emerald-400/80 block mt-0.5">
                            Total +{formatRp(rec.netProfitTotal)} ({rec.netMarginPct}% Margin)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Action */}
                    <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-gray-400">
                        Subsidi Toko: <strong className="text-amber-300">{formatRp(rec.sellerSubsidy)}</strong>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCoFunded(tier.id);
                          setHargaJual(rec.recIdealPrice);
                          setMainTab("kalkulator");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow active:scale-95 flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-emerald-600 text-white hover:bg-emerald-500"
                            : "bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white"
                        }`}
                      >
                        <span>{isSelected ? "✅ Sedang Dipilih" : "🎯 Pilih & Pasang Harga Ini"}</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
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