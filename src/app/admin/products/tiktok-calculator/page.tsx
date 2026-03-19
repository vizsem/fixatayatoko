"use client";

import { useState } from "react";

// ── KATEGORI & KOMISI (Feb 2026) ─────────────────────────────
const KATEGORI = [
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
const GRP_LABEL = {"1":"Grup 1 · 5.25%","2":"Grup 2 · 6.30%","3":"Grup 3 · 3.15%","4":"Grup 4 · 1.58%","5":"Grup 5 · 1.05%","D":"Default · 6.97%"};
const GRP_COLOR = {"1":"bg-blue-100 text-blue-700 border-blue-300","2":"bg-orange-100 text-orange-700 border-orange-300","3":"bg-purple-100 text-purple-700 border-purple-300","4":"bg-red-100 text-red-700 border-red-300","5":"bg-red-200 text-red-800 border-red-400","D":"bg-gray-100 text-gray-700 border-gray-300"};
const GROUPS = ["1","2","3","4","5","D"];

const INIT_OPS = [
  {id:"lakban",  label:"🏷️ Lakban",        nominal:500},
  {id:"termal",  label:"🧾 Kertas Termal",  nominal:200},
  {id:"bubble",  label:"🫧 Bubble Wrap",    nominal:500},
  {id:"kardus",  label:"📦 Kardus/Plastik", nominal:1500},
  {id:"krywn",   label:"👷 Upah Karyawan",  nominal:2000},
  {id:"listrik", label:"💡 Listrik & WiFi", nominal:200},
];

const formatRp = (n: number): string => "Rp"+Math.round(n).toLocaleString("id-ID");

// ── SEMUA PROGRAM (lengkap, akurat, per platform) ────────────
// Sumber: seller-id.tokopedia.com/university Feb 2026
const ALL_PROGRAMS = [
  // === WAJIB ===
  {
    id:"komisi_platform", label:"Komisi Platform",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tiktok:true, tokopedia:true,
    tarif:"1.05%–6.97% sesuai kategori (inkl. pajak)",
    catatan:"Dihitung dari harga item dikurangi diskon penjual. TIDAK termasuk ongkir & diskon platform.",
    isKomisi:true,
  },
  {
    id:"komisi_dinamis", label:"Komisi Dinamis",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tiktok:true, tokopedia:true,
    tarif:"4–6%, cap Rp40.000/item",
    catatan:"Berlaku sejak 10 Juni 2025. Diinvestasikan kembali untuk program Xtra Voucher Shipping. Tetap kena saat retur setelah terkirim.",
    isPct:true, pct:4, minPct:4, maxPct:6,
  },
  {
    id:"biaya_proses", label:"Biaya Pemrosesan Order",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tiktok:true, tokopedia:true,
    tarif:"Rp1.250 flat per pesanan terkirim",
    catatan:"Berlaku sejak 11 Agustus 2025. Tetap kena saat retur setelah terkirim. Seller baru: gratis 50 pesanan pertama (dikembalikan akhir bulan).",
    flat:1250,
  },
  // === OPSIONAL ===
  {
    id:"gratis_ongkir", label:"Gratis Ongkir XTRA",
    badge:"Sangat Disarankan", badgeCls:"bg-green-100 text-green-700",
    tiktok:true, tokopedia:true,
    tarif:"~4–6% per pesanan tergantung kategori (maks variatif)",
    catatan:"TikTok Shop: mayoritas 5–5.5%. Tokopedia: program Bebas Ongkir serupa. Badge gratis ongkir terbukti meningkatkan traffic & konversi signifikan.",
    isPct:true, pct:5.5,
  },
  {
    id:"voucher_xtra", label:"Voucher XTRA Program",
    badge:"Opsional", badgeCls:"bg-blue-100 text-blue-700",
    tiktok:true, tokopedia:true,
    tarif:"~3.5%, maks Rp20.000/item",
    catatan:"Program voucher subsidi platform (terpisah dari Gratis Ongkir XTRA). Seller dilaporkan pernah diaktifkan otomatis — cek Seller Center secara berkala!",
    isPct:true, pct:3.5, maxFlat:20000,
  },
  {
    id:"pre_order", label:"Biaya Layanan Pre-Order",
    badge:"Opsional", badgeCls:"bg-orange-100 text-orange-700",
    tiktok:true, tokopedia:false, // ⚠️ HANYA TikTok Shop, TIDAK berlaku di Tokopedia
    tarif:"+3% per produk terjual",
    catatan:"⚠️ HANYA berlaku di TikTok Shop, TIDAK di Tokopedia. Di Tokopedia, pre-order tidak dikenai biaya tambahan.",
    isPct:true, pct:3,
  },
  {
    id:"afiliasi", label:"Komisi Afiliasi Kreator",
    badge:"Opsional", badgeCls:"bg-pink-100 text-pink-700",
    tiktok:true, tokopedia:true,
    tarif:"2–15% (diset oleh seller, bisa lebih tinggi)",
    catatan:"Seller set komisi per produk. Kreator promosi via link unik/video. Jika transaksi, seller bayar komisi ke platform lalu diteruskan ke kreator.",
    isPct:true, pct:5, minPct:2, maxPct:15,
  },
  {
    id:"gmv_max", label:"GMV Max / Shop Ads (dapat diskon komisi!)",
    badge:"Strategis", badgeCls:"bg-green-100 text-green-700",
    tiktok:true, tokopedia:false,
    tarif:"Biaya iklan % dari GMV → dapat diskon komisi platform",
    catatan:"Spend >1% GMV → diskon 15% komisi platform (kategori tertentu). Spend >3% GMV → diskon 30% komisi SEMUA order toko. Berlaku sejak 13 Feb 2026.",
    isGmvMax:true,
  },
  {
    id:"topads", label:"TopAds Tokopedia",
    badge:"Opsional", badgeCls:"bg-green-100 text-green-700",
    tiktok:false, tokopedia:true,
    tarif:"Sesuai budget (CPC Rp200–500+)",
    catatan:"Produk muncul di posisi teratas pencarian Tokopedia. Bayar per klik (CPC). Rekomendasikan jika margin >20%.",
    isPct:true, pct:3,
  },
  {
    id:"live_ads", label:"LIVE Ads / TikTok Ads",
    badge:"Opsional", badgeCls:"bg-rose-100 text-rose-700",
    tiktok:true, tokopedia:false,
    tarif:"~2–5% atau sesuai budget iklan",
    catatan:"Boost penonton LIVE. Tarif komisi platform lebih rendah untuk transaksi via LIVE (berlaku sejak 13 Feb 2026).",
    isPct:true, pct:3,
  },
  {
    id:"cashback_bonus", label:"Biaya Layanan Cashback Bonus",
    badge:"Perhatikan!", badgeCls:"bg-yellow-100 text-yellow-700",
    tiktok:true, tokopedia:true,
    tarif:"Variatif — bisa diaktifkan platform tanpa konfirmasi",
    catatan:"⚠️ Seller melaporkan komponen ini muncul di statement pemotongan tanpa persetujuan. Selalu cek dashboard settlement secara rutin. Bisa dinonaktifkan via Seller Center.",
    isPct:true, pct:2,
  },
];

function NominalInput({value,onChange}:{value:number;onChange:(val:number)=>void}){
  return(
    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">
      <span className="text-gray-400 text-xs">Rp</span>
      <input type="number" value={value} onChange={e=>onChange(Number(e.target.value))}
        className="w-14 bg-transparent text-gray-700 text-xs font-bold outline-none text-right"/>
    </div>
  );
}

// ── STRATEGI ─────────────────────────────────────────────────
const STRATEGI = [
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
    {sub:"Tarif Komisi Lebih Rendah via LIVE",desc:"Sejak 13 Feb 2026, transaksi via LIVE mendapat tarif komisi platform lebih rendah. Manfaatkan ini untuk jual produk margin tipis via LIVE agar tetap untung."},
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
    {sub:"Ramadan & Harbolnas 2026",desc:"Ramadan TikTok Shop mulai 9 Feb, Tokopedia mulai 18 Feb 2026. Siapkan stok, promo, dan konten 2 minggu sebelum. Penjualan bisa naik 3–5×."},
    {sub:"Repeat Customer Program",desc:"Voucher khusus pembeli lama 5× lebih murah dari cari pembeli baru. Set voucher follow prize di TikTok Shop & kupon toko di Tokopedia untuk dorong repeat order."},
  ]},
];

export default function App() {
  const [platform, setPlatform] = useState("tiktok"); // tiktok | tokopedia
  const [kat,      setKat]      = useState(KATEGORI[0]);
  const [showKat,  setShowKat]  = useState(false);
  const [hargaBeli,setHargaBeli]= useState(2900);
  const [hargaJual,setHargaJual]= useState(5000);
  const [ops,      setOps]      = useState(INIT_OPS);
  const [mainTab,  setMainTab]  = useState("kalkulator");
  const [strTab,   setStrTab]   = useState("setup");

  // Program toggles
  const [active, setActive] = useState({
    komisi_dinamis: true, biaya_proses: true,
    gratis_ongkir:false, voucher_xtra:false, pre_order:false,
    afiliasi:false, gmv_max:false, topads:false, live_ads:false, cashback_bonus:false,
  });
  const [dinamisPct, setDinamisPct]   = useState(4);
  const [afiliasiPct,setAfiliasiPct]  = useState(5);
  const [gmvPct,     setGmvPct]       = useState(3);
  const [liveAdsPct, setLiveAdsPct]   = useState(3);

  const totalOps = ops.reduce((s,o)=>s+o.nominal,0);

  // GMV Max discount on platform commission
  const gmvDisc    = (platform==="tiktok" && active.gmv_max)
    ? (gmvPct>=3?0.30:gmvPct>=1?0.15:0) : 0;
  const komisiBase = kat.komisi*(1-gmvDisc);
  const komisiNom  = (komisiBase/100)*hargaJual;
  const dinNom     = active.komisi_dinamis ? Math.min((dinamisPct/100)*hargaJual,40000) : 0;
  const prosesNom  = active.biaya_proses   ? 1250 : 0;
  const ongkirNom  = active.gratis_ongkir  ? (5.5/100)*hargaJual : 0;
  const voucherNom = active.voucher_xtra   ? Math.min((3.5/100)*hargaJual,20000) : 0;
  const poNom      = (active.pre_order && platform==="tiktok") ? (3/100)*hargaJual : 0;
  const afilNom    = active.afiliasi       ? (afiliasiPct/100)*hargaJual : 0;
  const gmvNom     = (active.gmv_max && platform==="tiktok") ? (gmvPct/100)*hargaJual : 0;
  const topadNom   = (active.topads && platform==="tokopedia") ? (3/100)*hargaJual : 0;
  const liveNom    = (active.live_ads && platform==="tiktok") ? (liveAdsPct/100)*hargaJual : 0;
  const cashNom    = active.cashback_bonus ? (2/100)*hargaJual : 0;

  const totalPlatform = komisiNom+dinNom+prosesNom+ongkirNom+voucherNom+poNom+afilNom+gmvNom+topadNom+liveNom+cashNom;
  const cuan          = hargaJual - totalPlatform - hargaBeli - totalOps;
  const marginPct     = hargaJual>0?(cuan/hargaJual)*100:0;
  const roiPct        = (hargaBeli+totalOps)>0?(cuan/(hargaBeli+totalOps))*100:0;
  const potPct        = hargaJual>0?((totalPlatform+totalOps)/hargaJual)*100:0;

  function calcH(tm=0){
    const base=hargaBeli+totalOps;
    for(let h=base;h<=10_000_000;h+=10){
      const kb=kat.komisi*(1-gmvDisc);
      const kn=(kb/100)*h;
      const dn=active.komisi_dinamis?Math.min((dinamisPct/100)*h,40000):0;
      const pn=active.biaya_proses?1250:0;
      const on=active.gratis_ongkir?(5.5/100)*h:0;
      const vn=active.voucher_xtra?Math.min((3.5/100)*h,20000):0;
      const po=(active.pre_order&&platform==="tiktok")?(3/100)*h:0;
      const an=active.afiliasi?(afiliasiPct/100)*h:0;
      const gn=(active.gmv_max&&platform==="tiktok")?(gmvPct/100)*h:0;
      const tn=(active.topads&&platform==="tokopedia")?(3/100)*h:0;
      const ln=(active.live_ads&&platform==="tiktok")?(liveAdsPct/100)*h:0;
      const cn=active.cashback_bonus?(2/100)*h:0;
      const pot=kn+dn+pn+on+vn+po+an+gn+tn+ln+cn;
      if((h-pot-base)/h*100>=tm) return Math.ceil(h/100)*100;
    }
    return base;
  }
  const bep=calcH(0), h20=calcH(20), h30=calcH(30);

  const status=cuan>0?{label:"✅ UNTUNG",cls:"text-green-700 bg-green-50 border-green-300"}
    :cuan===0?{label:"⚠️ IMPAS",cls:"text-yellow-700 bg-yellow-50 border-yellow-300"}
    :{label:"❌ RUGI",cls:"text-red-700 bg-red-50 border-red-300"};

  const detailPlat=[
    {label:`Komisi Platform Grp ${kat.grp}${gmvDisc>0?` (diskon GMV ${(gmvDisc*100).toFixed(0)}%)`:""}  (${komisiBase.toFixed(2)}%)`,nom:komisiNom,show:true,wajib:true},
    {label:`Komisi Dinamis (${dinamisPct}%, cap Rp40rb)`,nom:dinNom,show:active.komisi_dinamis,wajib:true},
    {label:"Biaya Pemrosesan Order",nom:prosesNom,show:active.biaya_proses,wajib:true},
    {label:"Gratis Ongkir XTRA (~5.5%)",nom:ongkirNom,show:active.gratis_ongkir},
    {label:"Voucher XTRA (3.5%, cap Rp20rb)",nom:voucherNom,show:active.voucher_xtra},
    {label:"Pre-Order 3% (TikTok only)",nom:poNom,show:active.pre_order&&platform==="tiktok"},
    {label:`Afiliasi Kreator (${afiliasiPct}%)`,nom:afilNom,show:active.afiliasi},
    {label:`GMV Max Ads (${gmvPct}%)`,nom:gmvNom,show:active.gmv_max&&platform==="tiktok"},
    {label:"TopAds Tokopedia (~3%)",nom:topadNom,show:active.topads&&platform==="tokopedia"},
    {label:`LIVE Ads (~${liveAdsPct}%)`,nom:liveNom,show:active.live_ads&&platform==="tiktok"},
    {label:"Biaya Cashback Bonus (~2%)",nom:cashNom,show:active.cashback_bonus},
  ].filter(d=>d.show);

  const activeStr=STRATEGI.find(s=>s.id===strTab);
  const strIdx=STRATEGI.findIndex(s=>s.id===strTab);

  const platformPrograms = ALL_PROGRAMS.filter(p =>
    platform==="tiktok" ? p.tiktok : p.tokopedia
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black" style={{fontFamily:"system-ui,sans-serif"}}>

      {/* HEADER MODERN */}
      <div className="p-8 shadow-2xl rounded-b-3xl relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f0f0f 0%,#1a0a1e 40%,#2d0a1a 100%)"}}>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-transparent"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex items-center gap-6 mb-6">
            <div className="flex -space-x-2">
              <div className="w-12 h-12 rounded-3xl bg-black/80 backdrop-blur flex items-center justify-center border-2 border-gray-700 shadow-xl">
                <svg width="28" height="28" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#010101"/><text x="16" y="22" textAnchor="middle" fontSize="20" fill="white">♪</text></svg>
              </div>
              <div className="w-12 h-12 rounded-3xl flex items-center justify-center border-2 border-green-500 shadow-xl" style={{background:"linear-gradient(135deg,#03ac0e,#10b981)"}}>
                <span className="text-white font-black text-base">T</span>
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white leading-tight mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Kalkulator Cuan + Strategi TikTok Shop & Tokopedia 2026
              </h1>
              <p className="text-gray-300 text-base font-medium opacity-90">
                Komisi akurat · Semua program biaya · Panduan dari Tokopedia & TikTok Shop Academy
              </p>
              <div className="flex items-center gap-3 mt-4">
                <span className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur px-4 py-2 rounded-full text-xs font-semibold text-purple-300 border border-purple-500/30">Update Februari 2026</span>
                <span className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur px-4 py-2 rounded-full text-xs font-semibold text-green-300 border border-green-500/30">Komisi 1.05% - 6.97%</span>
              </div>
            </div>
          </div>
          {/* Platform Switch */}
          <div className="flex gap-3">
            <button onClick={()=>setPlatform("tiktok")}
              className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-2xl font-bold text-sm transition-all transform hover:scale-105 ${platform==="tiktok"?"bg-white text-gray-900 shadow-xl":"bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 backdrop-blur"}`}>
              <span className="text-lg">♪</span> TikTok Shop
            </button>
            <button onClick={()=>setPlatform("tokopedia")}
              className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-2xl font-bold text-sm transition-all transform hover:scale-105 ${platform==="tokopedia"?"bg-white text-gray-900 shadow-xl":"bg-gray-800/80 text-gray-300 hover:bg-gray-700/80 backdrop-blur"}`}>
              <span className="text-green-500 text-lg">🟢</span> Tokopedia
            </button>
          </div>
        </div>
      </div>

      {/* MAIN TABS */}
      <div className="max-w-7xl mx-auto px-3 pt-3">
        <div className="flex bg-gray-800 rounded-xl p-1 mb-4">
          {[["kalkulator","🧮 Kalkulator"],["semua_program","📋 Semua Program"],["strategi","💡 Strategi"]].map(([t,l])=>(
            <button key={t} onClick={()=>setMainTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mainTab===t?"bg-white text-gray-900":"text-gray-400 hover:text-white"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── KALKULATOR ── */}
      {mainTab==="kalkulator" && (
        <div className="max-w-7xl mx-auto px-3 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* KIRI */}
          <div className="space-y-3">

            {/* Kategori */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Kategori Produk</p>
              <button onClick={()=>setShowKat(!showKat)}
                className="w-full flex items-center justify-between bg-gray-700 border border-gray-600 hover:border-pink-500 rounded-xl px-3 py-2.5 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{kat.label.split(" ")[0]}</span>
                  <div className="text-left">
                    <p className="font-semibold text-white text-sm">{kat.label.replace(/^[^\s]+\s/,"")}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold border ${GRP_COLOR[kat.grp as keyof typeof GRP_COLOR]}`}>Grup {kat.grp}</span>
                      <span className="text-xs font-bold text-pink-400">Komisi {kat.komisi}%</span>
                    </div>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">{showKat?"▲":"▼"}</span>
              </button>
              {showKat&&(
                <div className="mt-2 rounded-xl overflow-hidden max-h-60 overflow-y-auto border border-gray-600">
                  {GROUPS.map(g=>(
                    <div key={g}>
                      <div className={`px-3 py-1.5 text-xs font-bold sticky top-0 border-b ${GRP_COLOR[g as keyof typeof GRP_COLOR]}`}>{GRP_LABEL[g as keyof typeof GRP_LABEL]}</div>
                      {KATEGORI.filter(k=>k.grp===g).map(k=>(
                        <button key={k.id} onClick={()=>{setKat(k);setShowKat(false);}}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-600 text-left transition-all ${kat.id===k.id?"bg-gray-600 text-pink-300 font-semibold":"text-gray-300"}`}>
                          <span>{k.label.split(" ")[0]}</span>
                          <div className="flex-1 min-w-0"><p>{k.label.replace(/^[^\s]+\s/,"")}</p><p className="text-gray-500 truncate">{k.contoh}</p></div>
                          {kat.id===k.id&&<span className="text-pink-400">✓</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Harga */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Modal / Harga Beli</p>
                <div className="flex items-center gap-2">
                  <input type="range" min={100} max={5000000} step={100} value={hargaBeli}
                    onChange={e=>setHargaBeli(Number(e.target.value))} className="flex-1 accent-pink-500"/>
                  <div className="flex items-center gap-1 bg-gray-700 border border-pink-500 rounded-lg px-2 py-1 min-w-fit">
                    <span className="text-pink-400 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaBeli} onChange={e=>setHargaBeli(Number(e.target.value))}
                      className="w-20 bg-transparent text-pink-300 font-bold text-xs outline-none"/>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Harga Jual</p>
                <div className="flex items-center gap-2">
                  <input type="range" min={Math.max(bep,100)} max={Math.max(hargaBeli*5,1000000)} step={100}
                    value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))} className="flex-1 accent-pink-500"/>
                  <div className="flex items-center gap-1 bg-gray-700 border border-pink-500 rounded-lg px-2 py-1 min-w-fit">
                    <span className="text-pink-400 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))}
                      className="w-20 bg-transparent text-pink-300 font-bold text-xs outline-none"/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  <button onClick={()=>setHargaJual(bep)} className="text-xs bg-red-900 border border-red-700 text-red-300 rounded-lg py-1.5 font-semibold">BEP {formatRp(bep)}</button>
                  <button onClick={()=>setHargaJual(h20)} className="text-xs bg-yellow-900 border border-yellow-700 text-yellow-300 rounded-lg py-1.5 font-semibold">Margin 20%</button>
                  <button onClick={()=>setHargaJual(h30)} className="text-xs bg-green-900 border border-green-700 text-green-300 rounded-lg py-1.5 font-semibold">Margin 30%</button>
                </div>
              </div>
            </div>

            {/* Biaya Ops */}
            <div className="bg-gray-800 rounded-2xl p-4 border-l-4 border-pink-500">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🏭 Biaya Operasional</p>
                <span className="text-xs font-bold text-pink-400">{formatRp(totalOps)}/pesanan</span>
              </div>
              <div className="space-y-1.5">
                {ops.map((o,i)=>(
                  <div key={o.id} className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{o.label}</span>
                    <NominalInput value={o.nominal} onChange={(val: number)=>{const n=[...ops];n[i]={...o,nominal:val};setOps(n);}}/>
                  </div>
                ))}
              </div>
              <p className="text-xs text-pink-400 mt-1.5">✏️ Klik angka untuk edit</p>
            </div>

            {/* Program */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">⚙️ Program {platform==="tiktok"?"TikTok Shop":"Tokopedia"}</p>
                <button onClick={()=>setMainTab("semua_program")} className="text-xs text-pink-400 underline">Detail lengkap →</button>
              </div>
              <div className="space-y-2.5">
                {/* Komisi Platform — info only */}
                <div className="bg-red-950 border border-red-800 rounded-xl p-2.5">
                  <p className="text-xs text-red-300 font-semibold">Komisi Platform Grup {kat.grp} — {komisiBase.toFixed(2)}% {gmvDisc>0&&<span className="text-green-400">(diskon {(gmvDisc*100).toFixed(0)}% GMV Max)</span>}</p>
                  <p className="text-xs text-red-500 mt-0.5">Otomatis dihitung · dihitung dari harga item - diskon penjual</p>
                </div>

                {/* Komisi Dinamis */}
                <div className="bg-red-950 border border-red-800 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <input type="checkbox" checked={active.komisi_dinamis} onChange={e=>setActive(p=>({...p,komisi_dinamis:e.target.checked}))} className="accent-red-500 w-3 h-3"/>
                    <p className="text-xs font-semibold text-red-300">Komisi Dinamis <span className="text-red-500">(wajib jika terintegrasi)</span></p>
                  </div>
                  <p className="text-xs text-red-500 pl-5 mb-1.5">4–6%, cap Rp40.000/item · berlaku Jun 2025</p>
                  <div className="flex items-center gap-1.5 pl-5">
                    {[4,5,6].map(v=>(
                      <button key={v} onClick={()=>setDinamisPct(v)}
                        className={`text-xs px-2 py-0.5 rounded-lg font-bold border transition-all ${dinamisPct===v?"bg-red-500 text-white border-red-500":"bg-gray-700 text-red-400 border-red-700"}`}>{v}%</button>
                    ))}
                  </div>
                </div>

                {/* Biaya Proses */}
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={active.biaya_proses} disabled className="accent-gray-500 w-3 h-3 mt-0.5"/>
                  <div><p className="text-xs text-gray-400 font-medium">Biaya Pemrosesan Order <span className="text-pink-500">(wajib)</span></p><p className="text-xs text-gray-600">Rp1.250 flat · Agt 2025</p></div>
                </div>

                {/* Gratis Ongkir */}
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={active.gratis_ongkir} onChange={e=>setActive(p=>({...p,gratis_ongkir:e.target.checked}))} className="accent-green-500 w-3 h-3 mt-0.5"/>
                  <div><p className="text-xs text-gray-300 font-medium">Gratis Ongkir XTRA (~5–5.5%)</p><p className="text-xs text-gray-500">Mayoritas 5–5.5% · meningkatkan konversi signifikan</p></div>
                </div>

                {/* Voucher XTRA */}
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={active.voucher_xtra} onChange={e=>setActive(p=>({...p,voucher_xtra:e.target.checked}))} className="accent-blue-500 w-3 h-3 mt-0.5"/>
                  <div><p className="text-xs text-gray-300 font-medium">Voucher XTRA (~3.5%, cap Rp20rb)</p><p className="text-xs text-gray-500 text-yellow-600">⚠️ Bisa aktif otomatis! Selalu cek Seller Center</p></div>
                </div>

                {/* Pre-Order — hanya TikTok */}
                {platform==="tiktok" && (
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={active.pre_order} onChange={e=>setActive(p=>({...p,pre_order:e.target.checked}))} className="accent-orange-500 w-3 h-3 mt-0.5"/>
                    <div><p className="text-xs text-gray-300 font-medium">Pre-Order (+3%) <span className="text-blue-400">[TikTok only]</span></p><p className="text-xs text-gray-500">Tidak berlaku di Tokopedia</p></div>
                  </div>
                )}
                {platform==="tokopedia" && (
                  <div className="flex items-start gap-2 opacity-50">
                    <input type="checkbox" disabled className="w-3 h-3 mt-0.5"/>
                    <div><p className="text-xs text-gray-400 line-through">Pre-Order (+3%)</p><p className="text-xs text-green-500 font-semibold">✓ GRATIS di Tokopedia! Manfaatkan ini.</p></div>
                  </div>
                )}

                {/* Afiliasi */}
                <div>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={active.afiliasi} onChange={e=>setActive(p=>({...p,afiliasi:e.target.checked}))} className="accent-pink-500 w-3 h-3 mt-0.5"/>
                    <div><p className="text-xs text-gray-300 font-medium">Komisi Afiliasi Kreator</p><p className="text-xs text-gray-500">2–15% per transaksi via kreator</p></div>
                  </div>
                  {active.afiliasi&&<div className="flex items-center gap-1.5 mt-1 pl-5">
                    {[3,5,8,10,15].map(v=>(
                      <button key={v} onClick={()=>setAfiliasiPct(v)}
                        className={`text-xs px-1.5 py-0.5 rounded-lg font-bold border transition-all ${afiliasiPct===v?"bg-pink-500 text-white border-pink-500":"bg-gray-700 text-pink-400 border-gray-600"}`}>{v}%</button>
                    ))}
                  </div>}
                </div>

                {/* GMV Max — TikTok only */}
                {platform==="tiktok" && (
                  <div className="bg-green-950 border border-green-800 rounded-xl p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <input type="checkbox" checked={active.gmv_max} onChange={e=>setActive(p=>({...p,gmv_max:e.target.checked}))} className="accent-green-500 w-3 h-3"/>
                      <p className="text-xs text-green-300 font-semibold">GMV Max / Shop Ads 🎁 Diskon komisi!</p>
                    </div>
                    <p className="text-xs text-green-600 pl-5 mb-1.5">Spend &gt;1%→ -15% komisi · Spend &gt;3%→ -30% komisi</p>
                    {active.gmv_max&&<div className="flex items-center gap-1.5 pl-5">
                      {[1,2,3,5].map(v=>(
                        <button key={v} onClick={()=>setGmvPct(v)}
                          className={`text-xs px-1.5 py-0.5 rounded-lg font-bold border transition-all ${gmvPct===v?"bg-green-500 text-white border-green-500":"bg-gray-700 text-green-400 border-gray-600"}`}>{v}%</button>
                      ))}
                    </div>}
                    {active.gmv_max&&gmvDisc>0&&<p className="text-xs text-green-400 font-bold mt-1 pl-5">✓ Komisi {kat.komisi}% → {komisiBase.toFixed(2)}% (hemat {(gmvDisc*100).toFixed(0)}%)</p>}
                  </div>
                )}

                {/* TopAds — Tokopedia only */}
                {platform==="tokopedia" && (
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={active.topads} onChange={e=>setActive(p=>({...p,topads:e.target.checked}))} className="accent-green-500 w-3 h-3 mt-0.5"/>
                    <div><p className="text-xs text-gray-300 font-medium">TopAds Tokopedia (~3%)</p><p className="text-xs text-gray-500">Posisi teratas pencarian · CPC Rp200–500+</p></div>
                  </div>
                )}

                {/* LIVE Ads — TikTok only */}
                {platform==="tiktok" && (
                  <div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={active.live_ads} onChange={e=>setActive(p=>({...p,live_ads:e.target.checked}))} className="accent-rose-500 w-3 h-3 mt-0.5"/>
                      <div><p className="text-xs text-gray-300 font-medium">LIVE Ads <span className="text-green-400">(komisi lebih rendah via LIVE!)</span></p><p className="text-xs text-gray-500">Transaksi via LIVE = tarif komisi platform lebih murah</p></div>
                    </div>
                    {active.live_ads&&<div className="flex items-center gap-1.5 mt-1 pl-5">
                      {[2,3,5].map(v=>(
                        <button key={v} onClick={()=>setLiveAdsPct(v)}
                          className={`text-xs px-1.5 py-0.5 rounded-lg font-bold border transition-all ${liveAdsPct===v?"bg-rose-500 text-white border-rose-500":"bg-gray-700 text-rose-400 border-gray-600"}`}>{v}%</button>
                      ))}
                    </div>}
                  </div>
                )}

                {/* Cashback Bonus ⚠️ */}
                <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <input type="checkbox" checked={active.cashback_bonus} onChange={e=>setActive(p=>({...p,cashback_bonus:e.target.checked}))} className="accent-yellow-500 w-3 h-3"/>
                    <p className="text-xs text-yellow-300 font-semibold">⚠️ Biaya Layanan Cashback Bonus (~2%)</p>
                  </div>
                  <p className="text-xs text-yellow-600 pl-5">Bisa aktif otomatis tanpa konfirmasi seller. Selalu cek dashboard settlement Seller Center setiap minggu!</p>
                </div>
              </div>
            </div>
          </div>

          {/* KANAN: Hasil */}
          <div className="space-y-3">
            <div className={`rounded-2xl p-4 border-2 shadow-sm ${status.cls}`}>
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-base">Hasil Akhir — {platform==="tiktok"?"TikTok Shop":"Tokopedia"}</p>
                <span className={`font-bold text-xs px-2 py-1 rounded-full border-2 ${status.cls}`}>{status.label}</span>
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between font-semibold text-sm text-gray-800 pb-1">
                  <span>Harga Jual</span><span>{formatRp(hargaJual)}</span>
                </div>
                <div className="border-t border-dashed mb-1"/>
                {detailPlat.map((d,i)=>(
                  <div key={i} className={`flex justify-between ${d.wajib?"text-red-600 font-medium text-sm":"text-orange-500"}`}>
                    <span className="text-xs">{d.label}</span><span className="ml-1">-{formatRp(d.nom)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-orange-500 font-medium pt-0.5">
                  <span>Biaya Operasional</span><span>-{formatRp(totalOps)}</span>
                </div>
                <div className="flex justify-between text-red-500 font-medium">
                  <span>Modal / Harga Beli</span><span>-{formatRp(hargaBeli)}</span>
                </div>
                <div className="border-t pt-1.5 mt-1 flex justify-between text-base font-bold">
                  <span>Keuntungan Bersih</span>
                  <span className={cuan>=0?"text-green-600":"text-red-600"}>{cuan>=0?"+":""}{formatRp(cuan)}</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[{label:"Margin",val:marginPct,d:marginPct.toFixed(1)+"%"},{label:"ROI",val:roiPct,d:roiPct.toFixed(1)+"%"},{label:"Total Potong",val:100,d:potPct.toFixed(1)+"%"}].map(s=>(
                  <div key={s.label} className="bg-white bg-opacity-70 rounded-xl p-2 text-center">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className={`font-bold text-sm ${s.val>=20?"text-green-600":s.val>=10?"text-orange-500":"text-red-500"}`}>{s.d}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Tips */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">💡 Tips Otomatis</p>
              {cuan<0&&<div className="bg-red-950 border border-red-800 rounded-xl p-3 text-xs text-red-300"><p className="font-bold mb-1">🚨 Masih Merugi!</p><p>• Naikkan ke BEP: <strong>{formatRp(bep)}</strong></p><p>• Matikan Voucher XTRA & Cashback Bonus jika ada</p><p>• Nonaktifkan program opsional dulu</p></div>}
              {cuan>=0&&marginPct<15&&<div className="bg-yellow-950 border border-yellow-800 rounded-xl p-3 text-xs text-yellow-300"><p className="font-bold mb-1">⚠️ Margin Tipis</p><p>• Target: <strong>{formatRp(h20)}</strong> untuk margin 20%</p>{platform==="tiktok"&&<p>• Coba jual via LIVE untuk tarif komisi lebih rendah!</p>}{platform==="tokopedia"&&<p>• Manfaatkan Pre-Order GRATIS di Tokopedia</p>}</div>}
              {cuan>=0&&marginPct>=15&&<div className="bg-green-950 border border-green-800 rounded-xl p-3 text-xs text-green-300"><p className="font-bold mb-1">✅ Margin Sehat! Scale Up</p>{platform==="tiktok"&&<p>• Coba GMV Max untuk diskon komisi 30%</p>}<p>• Aktifkan program afiliasi kreator</p><p>• Daftarkan ke Flash Sale & Campaign</p></div>}
            </div>

            {/* Quick nav strategi */}
            <div className="rounded-2xl p-4" style={{background:"linear-gradient(135deg,#0f0f0f,#2d0a1a)"}}>
              <p className="font-bold text-white mb-2 text-sm">📚 Pelajari Strategi Penjualan</p>
              <div className="grid grid-cols-2 gap-1.5">
                {STRATEGI.map(s=>(
                  <button key={s.id} onClick={()=>{setMainTab("strategi");setStrTab(s.id);}}
                    className="bg-white bg-opacity-10 hover:bg-opacity-20 rounded-xl p-2 text-left transition-all border border-white border-opacity-10">
                    <p className="text-xs text-white font-semibold">{s.icon} {s.title}</p>
                  </button>
                ))}
              </div>
              <a href="https://seller-id.tokopedia.com/university/home?identity=1&role=seller" target="_blank" rel="noopener noreferrer"
                className="block mt-2 text-center text-xs text-green-400 underline">🟢 Tokopedia & TikTok Shop Academy →</a>
            </div>
          </div>
        </div>
      )}

      {/* ── SEMUA PROGRAM ── */}
      {mainTab==="semua_program" && (
        <div className="max-w-3xl mx-auto px-3 pb-6 space-y-3">
          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <button onClick={()=>setPlatform("tiktok")} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${platform==="tiktok"?"bg-pink-600 text-white":"bg-gray-700 text-gray-400"}`}>♪ TikTok Shop</button>
              <button onClick={()=>setPlatform("tokopedia")} className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${platform==="tokopedia"?"bg-green-600 text-white":"bg-gray-700 text-gray-400"}`}>🟢 Tokopedia</button>
            </div>
            <p className="font-bold text-white text-base mb-1">📋 Semua Program Biaya — {platform==="tiktok"?"TikTok Shop":"Tokopedia"}</p>
            <p className="text-xs text-gray-400 mb-4">Sumber: seller-id.tokopedia.com · Update 13 Feb 2026</p>
            <div className="space-y-3">
              {platformPrograms.map((p,i)=>(
                <div key={p.id} className={`border rounded-xl p-4 ${p.badge==="WAJIB"?"border-red-800 bg-red-950":p.badge==="Perhatikan!"?"border-yellow-800 bg-yellow-950":"border-gray-700 bg-gray-700"}`}>
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-pink-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                      <p className="font-bold text-white text-sm">{p.label}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${p.badgeCls}`}>{p.badge}</span>
                      {!p.tiktok&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-green-900 text-green-400 font-semibold">Tokopedia only</span>}
                      {!p.tokopedia&&<span className="text-xs px-1.5 py-0.5 rounded-full bg-pink-900 text-pink-400 font-semibold">TikTok only</span>}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-pink-400 pl-8 mb-1">{p.tarif}</p>
                  <p className="text-xs text-gray-300 pl-8 leading-relaxed">{p.catatan}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Skenario */}
          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <p className="font-bold text-white mb-3">🧮 Skenario Potongan (Grup 1, harga Rp10.000)</p>
            {[
              {nama:"Minimal TikTok (wajib)",  pct:"~11.5%",cls:"bg-green-950 border-green-800", items:["Komisi 5.25%","Dinamis 4%","Proses Rp1.250"]},
              {nama:"Minimal Tokopedia (wajib)",pct:"~10.5%",cls:"bg-green-950 border-green-800", items:["Komisi 5.25%","Dinamis 4%","Proses Rp1.250","(PO gratis!)"]},
              {nama:"Sedang (+ Ongkir XTRA)",  pct:"~17%",  cls:"bg-yellow-950 border-yellow-800",items:["Komisi 5.25%","Dinamis 4%","Ongkir 5.5%","Proses Rp1.250"]},
              {nama:"+ Voucher XTRA + Afiliasi",pct:"~25%",  cls:"bg-orange-950 border-orange-800",items:["Komisi 5.25%","Dinamis 4%","Ongkir 5.5%","Voucher 3.5%","Afiliasi 5%","Proses Rp1.250"]},
              {nama:"Dengan GMV Max 3% (TikTok)",pct:"~19.8%",cls:"bg-blue-950 border-blue-800",  items:["Komisi 3.68% (diskon 30%)","Dinamis 4%","Ongkir 5.5%","GMV Ads 3%","Proses Rp1.250"]},
              {nama:"Terburuk + Cashback Bonus",pct:"~28%+", cls:"bg-red-950 border-red-800",    items:["Komisi 5.25%","Dinamis 6%","Ongkir 5.5%","Voucher 3.5%","Cashback 2%","Afiliasi 5%","Proses Rp1.250"]},
            ].map((s,i)=>(
              <div key={i} className={`mb-2 p-3 rounded-xl border ${s.cls}`}>
                <div className="flex justify-between">
                  <p className="text-sm font-semibold text-gray-200">{s.nama}</p>
                  <span className={`text-sm font-bold ${i>=4?"text-blue-400":i>=3?"text-red-400":i>=2?"text-yellow-400":"text-green-400"}`}>{s.pct}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{s.items.join(" + ")}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 text-white" style={{background:"linear-gradient(135deg,#0f0f0f,#2d0a1a)"}}>
            <p className="font-bold mb-2">📌 Catatan Penting</p>
            <div className="space-y-1 text-xs text-pink-100">
              <p>• <strong className="text-white">Komisi Dinamis TERPISAH</strong> dari komisi platform — banyak seller tidak tahu ada 2 komponen ini!</p>
              <p>• <strong className="text-white">Pre-Order 3% HANYA TikTok Shop</strong> — di Tokopedia pre-order GRATIS, manfaatkan ini!</p>
              <p>• <strong className="text-white">Voucher XTRA & Cashback Bonus</strong> bisa aktif otomatis — selalu cek Seller Center tiap minggu</p>
              <p>• GMV Max: spend 3% dapat diskon 30% komisi → bisa lebih hemat dari tidak pasang iklan</p>
              <p>• Semua tarif sudah inkl. PPN · Cek terbaru: seller-id.tokopedia.com</p>
            </div>
          </div>
        </div>
      )}

      {/* ── STRATEGI ── */}
      {mainTab==="strategi" && (
        <div className="max-w-7xl mx-auto px-3 pb-6">
          <div className="flex gap-3">
            <div className="w-44 flex-shrink-0 space-y-1.5">
              {STRATEGI.map(s=>(
                <button key={s.id} onClick={()=>setStrTab(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${strTab===s.id?"text-white shadow-lg":"bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700"}`}
                  style={strTab===s.id?{background:`linear-gradient(135deg,var(--tw-gradient-from,#6366f1),var(--tw-gradient-to,#8b5cf6))`}:{}}>
                  <span className="text-base">{s.icon}</span><span>{s.title}</span>
                </button>
              ))}
              <div className="bg-gray-800 border border-green-800 rounded-xl p-3 mt-2">
                <p className="text-xs text-green-400 font-semibold mb-1">📚 Sumber Resmi</p>
                <a href="https://seller-id.tokopedia.com/university/home?identity=1&role=seller" target="_blank" rel="noopener noreferrer" className="text-xs text-green-500 underline">Tokopedia & TikTok Academy →</a>
              </div>
            </div>
            {activeStr&&(
              <div className="flex-1 min-w-0">
                <div className={`bg-gradient-to-r ${activeStr.color} rounded-2xl p-5 mb-4 text-white shadow-lg`}>
                  <div className="flex items-center gap-3"><span className="text-3xl">{activeStr.icon}</span><div><h2 className="text-xl font-bold">{activeStr.title}</h2><p className="text-white text-opacity-80 text-sm">Panduan dari Tokopedia & TikTok Shop Academy</p></div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeStr.tips.map((tip,i)=>(
                    <div key={i} className="bg-gray-800 rounded-2xl p-4 border border-gray-700 hover:border-gray-500 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-r ${activeStr.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{i+1}</div>
                        <p className="font-bold text-white text-sm">{tip.sub}</p>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{tip.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4">
                  {strIdx>0?<button onClick={()=>setStrTab(STRATEGI[strIdx-1].id)} className="text-xs text-gray-400 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 hover:bg-gray-700">← {STRATEGI[strIdx-1].title}</button>:<div/>}
                  {strIdx<STRATEGI.length-1?<button onClick={()=>setStrTab(STRATEGI[strIdx+1].id)} className={`text-xs text-white bg-gradient-to-r ${STRATEGI[strIdx+1].color} rounded-xl px-3 py-2`}>{STRATEGI[strIdx+1].title} →</button>:<div/>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-600 pb-4">seller-id.tokopedia.com/university · Update 13 Feb 2026</p>
    </div>
  );
}