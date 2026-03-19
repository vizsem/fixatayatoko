"use client";

import { useState } from "react";

// ── KATEGORI & BIAYA ADMIN SHOPEE 2026 ───────────────────────
const KATEGORI = [
  { id:"fmcg",       label:"🍜 Makanan & FMCG",              kat:"A", admin:10,   contoh:"Indomie, snack, minuman, bahan makanan kering" },
  { id:"sembako",    label:"🛒 Sembako & Kebutuhan Dapur",   kat:"A", admin:10,   contoh:"Beras, minyak, gula, tepung, bumbu" },
  { id:"fashion_w",  label:"👗 Fashion Wanita",              kat:"A", admin:10,   contoh:"Baju, dress, rok, blouse, gamis" },
  { id:"fashion_p",  label:"👕 Fashion Pria",                kat:"A", admin:10,   contoh:"Kaos, kemeja, celana, jaket" },
  { id:"fashion_m",  label:"🧕 Fashion Muslim",              kat:"A", admin:10,   contoh:"Gamis, hijab, sarung, koko" },
  { id:"kebersihan", label:"🧼 Kebersihan & Peralatan Rumah",kat:"A", admin:10,   contoh:"Pembersih, lampu, karpet, dekorasi" },
  { id:"olahraga",   label:"⚽ Olahraga & Hobi",             kat:"A", admin:10,   contoh:"Alat olahraga, hobi, outdoor" },
  { id:"elektronik", label:"🔌 Elektronik & Aksesoris",     kat:"B", admin:9.5,  contoh:"Kabel, charger, baterai, adaptor" },
  { id:"audio",      label:"🎮 Audio & Gaming",              kat:"B", admin:9.5,  contoh:"Headset, speaker, konsol game" },
  { id:"skincare",   label:"💄 Skincare & Kecantikan",       kat:"B", admin:9,    contoh:"Serum, moisturizer, sunscreen, makeup" },
  { id:"tas",        label:"👜 Tas & Dompet",                kat:"B", admin:9,    contoh:"Tas wanita, tas pria, dompet" },
  { id:"jam",        label:"⌚ Jam Tangan",                  kat:"B", admin:9,    contoh:"Jam tangan pria, wanita" },
  { id:"perawatan",  label:"🧴 Perawatan Diri & Tubuh",      kat:"B", admin:9,    contoh:"Sampo, sabun mandi, deodoran" },
  { id:"popok",      label:"🍼 Popok & Perlengkapan Bayi",   kat:"B", admin:9,    contoh:"Popok, tisu basah, botol susu" },
  { id:"fashion_b",  label:"👶 Fashion Bayi & Anak",         kat:"B", admin:9,    contoh:"Baju bayi, sepatu anak, aksesoris" },
  { id:"susu",       label:"🥛 Susu Formula & Makanan Bayi", kat:"C", admin:6.75, contoh:"Susu formula, bubur bayi, MPASI" },
  { id:"suplemen",   label:"💊 Vitamin & Suplemen",          kat:"C", admin:6.5,  contoh:"Vitamin C, multivitamin" },
  { id:"baby_gear",  label:"🧸 Perlengkapan Bayi & Anak",   kat:"C", admin:6.75, contoh:"Stroller, car seat, mainan edukatif" },
  { id:"tv_ac",      label:"📺 Elektronik High-End",         kat:"D", admin:5.25, contoh:"TV, AC, kulkas, mesin cuci" },
  { id:"hp",         label:"📱 HP & Tablet",                 kat:"D", admin:5.25, contoh:"Smartphone, tablet" },
  { id:"laptop",     label:"💻 Laptop & Komputer",           kat:"D", admin:5.25, contoh:"Laptop, PC, monitor" },
  { id:"kamera",     label:"📷 Kamera & Drone",              kat:"D", admin:5.25, contoh:"Kamera mirrorless, drone" },
  { id:"logam",      label:"🥇 Logam Mulia & Perhiasan",    kat:"E", admin:4.25, contoh:"Emas batangan, perhiasan berharga" },
  { id:"emoney",     label:"🎫 E-Money & Voucher",           kat:"X", admin:2.5,  contoh:"ShopeePay, voucher, tiket" },
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
const KAT_LABEL  = { A:"Kat A · 10%", B:"Kat B · 9–9.5%", C:"Kat C · 6.5–6.75%", D:"Kat D · 5.25%", E:"Kat E · 4.25%", X:"Khusus · 2.5%" };

// Estimasi % Ongkir XTRA per kategori
function getOngkirPct(k: string): number {
  const rates = {A:5.5,B:4,C:3.5,D:2.5,E:1.5} as const;
  return rates[k as keyof typeof rates] || 3;
}

// ── SEMUA PROGRAM YANG MENAMBAH BIAYA (10 program) ────────────
// Urut dari yang paling sering dipakai
const ALL_PROGRAMS = [
  {
    id:"proses", label:"Biaya Proses Pesanan",
    badge:"WAJIB", badgeCls:"bg-red-100 text-red-700",
    tarif:"Rp1.250 flat per pesanan selesai",
    catatan:"Berlaku sejak Juli 2025. Dipotong otomatis. Tetap kena saat retur.",
    flat:1250, wajib:true, color:"gray"
  },
  {
    id:"ongkir", label:"Gratis Ongkir XTRA",
    badge:"Sangat Disarankan", badgeCls:"bg-green-100 text-green-700",
    tarif:"Bervariasi per kategori (~1.5–5.5%), MAKS Rp10.000/produk",
    catatan:"Kat A ~5.5% · Kat B ~4% · Kat C ~3.5% · Kat D ~2.5% · Kat E ~1.5%. Badge Gratis Ongkir = CTR 2–3× lebih tinggi.",
    isPct:true, maxFlat:10000, wajib:false, color:"green"
  },
  {
    id:"promo_xtra", label:"Promo XTRA",
    badge:"Opsional", badgeCls:"bg-blue-100 text-blue-700",
    tarif:"~2% dari harga netto, MAKS Rp10.000/produk",
    catatan:"Program promosi tambahan Shopee. Bisa dikombinasikan dengan Gratis Ongkir XTRA.",
    pct:2, maxFlat:10000, wajib:false, color:"blue"
  },
  {
    id:"spaylater_3", label:"SPayLater XTRA 0% (Tenor 3 Bulan)",
    badge:"Opsional", badgeCls:"bg-purple-100 text-purple-700",
    tarif:"2.5% dari harga netto",
    catatan:"Dikenakan ke seller jika pembeli memilih cicilan SPayLater tenor 3 bulan. Kebijakan baru Jan 2026.",
    pct:2.5, wajib:false, color:"purple"
  },
  {
    id:"spaylater_6", label:"SPayLater XTRA 0% (Tenor 6 Bulan)",
    badge:"Opsional", badgeCls:"bg-purple-100 text-purple-700",
    tarif:"4.0% dari harga netto",
    catatan:"Dikenakan ke seller jika pembeli memilih cicilan SPayLater tenor 6 bulan.",
    pct:4.0, wajib:false, color:"purple"
  },
  {
    id:"preorder", label:"Biaya Layanan Pre-Order",
    badge:"Opsional", badgeCls:"bg-orange-100 text-orange-700",
    tarif:"3% per kuantitas terjual dari harga netto",
    catatan:"Berlaku Jan 2026. Pengecualian: produk custom/kerajinan, produk baru <30 hari, produk via Shopee Live.",
    pct:3.0, wajib:false, color:"orange"
  },
  {
    id:"affiliate", label:"Shopee Affiliate Program",
    badge:"Opsional", badgeCls:"bg-pink-100 text-pink-700",
    tarif:"Komisi diset seller (5–20%), + PPN · cap Rp100.000–500.000/produk",
    catatan:"Seller bayar komisi ke Shopee dulu, lalu Shopee teruskan ke affiliate. Dihitung dari harga netto (setelah diskon, ongkir, voucher). BELUM termasuk PPN — PPN ditambahkan di atas tarif komisi.",
    isPctRange:true, minPct:5, maxPct:20, defaultPct:8, wajib:false, color:"pink"
  },
  {
    id:"live_xtra", label:"Shopee Live XTRA / LiveXtra Ads",
    badge:"Opsional", badgeCls:"bg-rose-100 text-rose-700",
    tarif:"Subsidi & biaya iklan sesuai program aktif (~2–5%)",
    catatan:"Shopee Live memiliki program subsidi tertentu dan opsi boost berbayar. Biaya variatif tergantung paket LiveXtra yang dipilih.",
    pct:3, wajib:false, color:"rose"
  },
  {
    id:"ads", label:"Shopee Ads (Iklan Produk)",
    badge:"Opsional", badgeCls:"bg-red-100 text-red-700",
    tarif:"Sesuai budget (estimasi ~3% dari nilai penjualan)",
    catatan:"Cost per click atau cost per impression. Rekomendasikan hanya jika margin >20%. ROAS target minimal 3–5×.",
    pct:3.0, wajib:false, color:"red"
  },
  {
    id:"cod", label:"Biaya Layanan COD (Cash on Delivery)",
    badge:"Jika Aktif", badgeCls:"bg-yellow-100 text-yellow-700",
    tarif:"~2% dari nilai transaksi COD",
    catatan:"Berlaku jika seller mengaktifkan metode pembayaran COD. Tidak semua kategori mendukung COD.",
    pct:2.0, wajib:false, color:"yellow"
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

const formatRp = (n: number): string => "Rp"+Math.round(n).toLocaleString("id-ID");

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
  const [kat,      setKat]      = useState(KATEGORI[1]);
  const [showKat,  setShowKat]  = useState(false);
  const [hargaBeli,setHargaBeli]= useState(2900);
  const [hargaJual,setHargaJual]= useState(5000);
  const [ops,      setOps]      = useState(INIT_OPS);
  const [mainTab,  setMainTab]  = useState("kalkulator");
  const [strTab,   setStrTab]   = useState("listing");

  // Toggle program
  const [active, setActive] = useState<Record<string, boolean>>(
    ALL_PROGRAMS.reduce((a,p)=>({...a,[p.id]:p.wajib}),{})
  );
  const [affiliatePct, setAffiliatePct] = useState(8);
  const [livePct,      setLivePct]      = useState(3);

  const totalOps = ops.reduce((s,o)=>s+o.nominal,0);
  const adminNom = (kat.admin/100)*hargaJual;

  // Hitung semua potongan platform
  let totalPlatform = adminNom;
  const detailPlat = [{label:`Biaya Admin Kat.${kat.kat} (${kat.admin}%)`,nom:adminNom,wajib:true}];

  ALL_PROGRAMS.forEach(p=>{
    if(!active[p.id]) return;
    let nom = 0;
    if(p.flat){ nom=p.flat; }
    else if(p.id==="ongkir"){ nom=Math.min((getOngkirPct(kat.kat)/100)*hargaJual, p.maxFlat || 10000); }
    else if(p.id==="promo_xtra"){ nom=Math.min(((p.pct || 0)/100)*hargaJual, p.maxFlat || 10000); }
    else if(p.id==="affiliate"){ nom=(affiliatePct/100)*hargaJual * 1.11; } // + PPN 11%
    else if(p.id==="live_xtra"){ nom=(livePct/100)*hargaJual; }
    else if(p.pct){ nom=(p.pct/100)*hargaJual; }
    totalPlatform+=nom;
    detailPlat.push({
      label: p.id==="ongkir"?`${p.label} (~${getOngkirPct(kat.kat)}%, maks Rp10rb)`:
             p.id==="affiliate"?`${p.label} (${affiliatePct}% + PPN 11%)`:
             p.id==="live_xtra"?`${p.label} (~${livePct}%)`:
             p.flat?p.label:`${p.label}`,
      nom, wajib:p.wajib||false
    });
  });

  const cuan      = hargaJual - totalPlatform - hargaBeli - totalOps;
  const marginPct = hargaJual>0?(cuan/hargaJual)*100:0;
  const roiPct    = (hargaBeli+totalOps)>0?(cuan/(hargaBeli+totalOps))*100:0;
  const potPct    = hargaJual>0?((totalPlatform+totalOps)/hargaJual)*100:0;

  function calcH(tm=0){
    const base=hargaBeli+totalOps;
    for(let h=base;h<=10_000_000;h+=10){
      let pot=(kat.admin/100)*h;
      ALL_PROGRAMS.forEach(p=>{
        if(!active[p.id]) return;
        if(p.flat) pot+=p.flat;
        else if(p.id==="ongkir") pot+=Math.min((getOngkirPct(kat.kat)/100)*h, p.maxFlat || 10000);
        else if(p.id==="promo_xtra") pot+=Math.min(((p.pct || 0)/100)*h, p.maxFlat || 10000);
        else if(p.id==="affiliate") pot+=(affiliatePct/100)*h*1.11;
        else if(p.id==="live_xtra") pot+=(livePct/100)*h;
        else if(p.pct) pot+=(p.pct/100)*h;
      });
      const c=h-pot-base;
      if((c/h)*100>=tm) return Math.ceil(h/100)*100;
    }
    return base;
  }
  const bep=calcH(0), h20=calcH(20), h30=calcH(30);

  const status = cuan>0?{label:"✅ UNTUNG",cls:"text-green-700 bg-green-50 border-green-300"}
    :cuan===0?{label:"⚠️ IMPAS",cls:"text-yellow-700 bg-yellow-50 border-yellow-300"}
    :{label:"❌ RUGI",cls:"text-red-700 bg-red-50 border-red-300"};

  const activeStr = STRATEGI.find(s=>s.id===strTab);
  const strIdx    = STRATEGI.findIndex(s=>s.id===strTab);

  const PROG_BG = {
    gray:"bg-gray-50 border-gray-200", green:"bg-green-50 border-green-200",
    blue:"bg-blue-50 border-blue-200", purple:"bg-purple-50 border-purple-200",
    orange:"bg-orange-50 border-orange-200", pink:"bg-pink-50 border-pink-200",
    rose:"bg-rose-50 border-rose-200", red:"bg-red-50 border-red-200",
    yellow:"bg-yellow-50 border-yellow-200",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50" style={{fontFamily:"system-ui,sans-serif"}}>

      {/* HEADER MODERN */}
      <div className="bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 p-8 text-white shadow-2xl rounded-b-3xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
        <div className="max-w-7xl mx-auto flex items-center gap-6 relative z-10">
          <div className="bg-white/95 backdrop-blur rounded-3xl p-3 shadow-xl border border-white/20">
            <svg width="40" height="40" viewBox="0 0 100 100" className="drop-shadow-lg">
              <circle cx="50" cy="50" r="48" fill="#EE4D2D"/>
              <text x="50" y="68" textAnchor="middle" fontSize="48" fill="white" fontWeight="bold">S</text>
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold leading-tight mb-2 bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">
              Kalkulator Cuan + Strategi Shopee 2026
            </h1>
            <p className="text-orange-100 text-base font-medium opacity-90">
              10 Program biaya akurat · Panduan dari Shopee Seller Education Hub
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold border border-white/30">Update Januari 2026</span>
              <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold border border-white/30">10+ Program Shopee</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN TABS */}
      <div className="max-w-7xl mx-auto px-3 pt-3">
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-orange-200 mb-4">
          {[["kalkulator","🧮 Kalkulator"],["semua_program","📋 10 Program Biaya"],["strategi","💡 Strategi Penjualan"]].map(([t,l])=>(
            <button key={t} onClick={()=>setMainTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mainTab===t?"bg-orange-500 text-white":"text-gray-500 hover:text-orange-500"}`}>
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
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Kategori Produk</p>
              <button onClick={()=>setShowKat(!showKat)}
                className="w-full flex items-center justify-between bg-gray-50 border-2 border-gray-200 hover:border-orange-400 rounded-xl px-3 py-2.5 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{kat.label.split(" ")[0]}</span>
                  <div className="text-left">
                    <p className="font-semibold text-gray-800 text-sm">{kat.label.replace(/^[^\s]+\s/,"")}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold border ${KAT_COLOR[kat.kat as keyof typeof KAT_COLOR]}`}>Kat. {kat.kat}</span>
                      <span className="text-xs font-bold text-orange-600">Admin {kat.admin}%</span>
                    </div>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">{showKat?"▲":"▼"}</span>
              </button>
              {showKat&&(
                <div className="mt-2 border border-orange-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  {KAT_GROUPS.map(g=>(
                    <div key={g}>
                      <div className={`px-3 py-1.5 text-xs font-bold sticky top-0 border-b ${KAT_COLOR[g as keyof typeof KAT_COLOR]}`}>{KAT_LABEL[g as keyof typeof KAT_LABEL]}</div>
                      {KATEGORI.filter(k=>k.kat===g).map(k=>(
                        <button key={k.id} onClick={()=>{setKat(k);setShowKat(false);}}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-orange-50 text-left transition-all ${kat.id===k.id?"bg-orange-50 text-orange-700 font-semibold":"text-gray-700"}`}>
                          <span>{k.label.split(" ")[0]}</span>
                          <div className="flex-1 min-w-0"><p>{k.label.replace(/^[^\s]+\s/,"")}</p><p className="text-gray-400 truncate">{k.contoh}</p></div>
                          {kat.id===k.id&&<span className="text-orange-500">✓</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Harga Beli & Jual */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Modal / Harga Beli</p>
                <div className="flex items-center gap-2">
                  <input type="range" min={100} max={5000000} step={100} value={hargaBeli}
                    onChange={e=>setHargaBeli(Number(e.target.value))} className="flex-1 accent-orange-500"/>
                  <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 min-w-fit">
                    <span className="text-orange-500 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaBeli} onChange={e=>setHargaBeli(Number(e.target.value))}
                      className="w-20 bg-transparent text-orange-600 font-bold text-xs outline-none"/>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Harga Jual</p>
                <div className="flex items-center gap-2">
                  <input type="range" min={Math.max(bep,100)} max={Math.max(hargaBeli*5,1000000)} step={100}
                    value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))} className="flex-1 accent-orange-500"/>
                  <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 min-w-fit">
                    <span className="text-orange-500 font-bold text-xs">Rp</span>
                    <input type="number" value={hargaJual} onChange={e=>setHargaJual(Number(e.target.value))}
                      className="w-20 bg-transparent text-orange-600 font-bold text-xs outline-none"/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  <button onClick={()=>setHargaJual(bep)} className="text-xs bg-red-50 border border-red-200 text-red-600 rounded-lg py-1.5 font-semibold">BEP {formatRp(bep)}</button>
                  <button onClick={()=>setHargaJual(h20)} className="text-xs bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg py-1.5 font-semibold">Margin 20%</button>
                  <button onClick={()=>setHargaJual(h30)} className="text-xs bg-green-50 border border-green-200 text-green-700 rounded-lg py-1.5 font-semibold">Margin 30%</button>
                </div>
              </div>
            </div>

            {/* Biaya Ops */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-orange-400">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🏭 Biaya Operasional</p>
                <span className="text-xs font-bold text-orange-500">{formatRp(totalOps)}/pesanan</span>
              </div>
              <div className="space-y-1.5">
                {ops.map((o,i)=>(
                  <div key={o.id} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{o.label}</span>
                    <NominalInput value={o.nominal} onChange={val=>{const n=[...ops];n[i]={...o,nominal:val};setOps(n);}}/>
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-400 mt-1.5">✏️ Klik angka untuk edit</p>
            </div>

            {/* Program Aktif dengan Desain Modern */}
            <div className="bg-gradient-to-br from-white to-orange-50 rounded-3xl p-5 shadow-lg border border-orange-100">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">⚙️ Aktifkan Program</p>
                <button onClick={()=>setMainTab("semua_program")} className="text-xs text-orange-600 hover:text-orange-800 font-semibold transition-all transform hover:scale-105">
                  📋 Lihat detail 10 program →
                </button>
              </div>
              <div className="space-y-3">
                {ALL_PROGRAMS.map((p,i)=>{
                  const isActive = active[p.id];
                  const isDisabled = p.wajib;
                  return (
                    <div key={p.id} className={`rounded-2xl p-3 transition-all duration-300 transform hover:scale-[1.02] ${
                      isActive ? 'bg-gradient-to-r from-orange-100 to-amber-50 border-2 border-orange-300 shadow-md' : 
                      isDisabled ? 'bg-gray-100 border border-gray-200 opacity-75' : 
                      'bg-white border border-gray-200 hover:border-orange-300 hover:shadow-md'
                    }`}>
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          id={`kal_${p.id}`} 
                          checked={isActive} 
                          disabled={isDisabled}
                          onChange={e=>setActive(prev=>({...prev,[p.id]:e.target.checked}))}
                          className="accent-orange-500 w-4 h-4 mt-0.5 flex-shrink-0 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <label htmlFor={`kal_${p.id}`} className={`text-sm font-semibold ${
                              isDisabled ? 'text-gray-500' : isActive ? 'text-orange-800' : 'text-gray-700 cursor-pointer hover:text-orange-700'
                            }`}>
                              {p.label}
                            </label>
                            {p.wajib&&<span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Wajib</span>}
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                              p.id==="ongkir" ? 'bg-blue-100 text-blue-700' :
                              p.id==="promo" ? 'bg-red-100 text-red-700' :
                              p.id==="affiliate" ? 'bg-purple-100 text-purple-700' :
                              p.id==="live_xtra" ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {p.id==="ongkir"?`~${getOngkirPct(kat.kat)}%`:
                               p.flat?formatRp(p.flat):
                               p.id==="affiliate"?`${affiliatePct}%+PPN`:
                               p.id==="live_xtra"?`~${livePct}%`:
                               p.pct?`${p.pct}%`:""}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{p.catatan}</p>
                        </div>
                      </div>
                      {/* Affiliate komisi slider */}
                      {p.id==="affiliate" && isActive && (
                        <div className="mt-3 pl-7">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-medium">Set komisi:</span>
                            {[1,5,8,10,12,15].map(v=>(
                              <button key={v} onClick={()=>setAffiliatePct(v)}
                                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all transform hover:scale-105 ${
                                  affiliatePct===v ? 
                                  'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md' : 
                                  'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
                                }`}>
                                {v}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Live XTRA slider */}
                      {p.id==="live_xtra" && isActive && (
                        <div className="mt-3 pl-7">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-medium">Est. biaya:</span>
                            {[2,3,5].map(v=>(
                              <button key={v} onClick={()=>setLivePct(v)}
                                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all transform hover:scale-105 ${
                                  livePct===v ? 
                                  'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md' : 
                                  'bg-white text-pink-600 border border-pink-200 hover:bg-pink-50'
                                }`}>
                                {v}%
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KANAN: Hasil */}
          <div className="space-y-3">
            <div className={`rounded-2xl p-4 border-2 shadow-sm ${status.cls}`}>
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-base">Hasil Akhir</p>
                <span className={`font-bold text-xs px-2 py-1 rounded-full border-2 ${status.cls}`}>{status.label}</span>
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between font-semibold text-sm text-gray-800 pb-1">
                  <span>Harga Jual</span><span>{formatRp(hargaJual)}</span>
                </div>
                <div className="border-t border-dashed mb-1"/>
                {detailPlat.map((d,i)=>(
                  <div key={i} className={`flex justify-between ${i===0?"text-red-600 font-semibold text-sm":d.wajib?"text-red-500 font-medium":"text-orange-500 pl-2"}`}>
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
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">💡 Tips Otomatis</p>
              {cuan<0&&<div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700"><p className="font-bold mb-1">🚨 Masih Merugi!</p><p>• Naikkan harga ke minimal <strong>{formatRp(bep)}</strong></p><p>• Nonaktifkan program opsional (affiliate, live ads, COD)</p><p>• Beli packing grosir untuk tekan biaya operasional</p></div>}
              {cuan>=0&&marginPct<15&&<div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800"><p className="font-bold mb-1">⚠️ Margin Tipis</p><p>• Target harga <strong>{formatRp(h20)}</strong> untuk margin 20%</p><p>• Nonaktifkan affiliate/COD jika tidak membawa volume signifikan</p><p>• Fokus bundling untuk naikkan nilai pesanan</p></div>}
              {cuan>=0&&marginPct>=15&&<div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800"><p className="font-bold mb-1">✅ Margin Sehat! Saatnya Scale Up</p><p>• Aktifkan Shopee Affiliate untuk dorong volume lewat kreator</p><p>• Coba Shopee Ads dengan budget kecil dulu (Rp30rb/hari)</p><p>• Daftarkan produk ke Flash Sale & Campaign Double Date</p></div>}
            </div>

            {/* Quick nav ke strategi */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-white">
              <p className="font-bold mb-2 text-sm">📚 Pelajari Strategi Penjualan</p>
              <div className="grid grid-cols-2 gap-1.5">
                {STRATEGI.map(s=>(
                  <button key={s.id} onClick={()=>{setMainTab("strategi");setStrTab(s.id);}}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-xl p-2 text-left transition-all">
                    <p className="text-xs text-white font-semibold">{s.icon} {s.title}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SEMUA PROGRAM ── */}
      {mainTab==="semua_program" && (
        <div className="max-w-3xl mx-auto px-3 pb-6 space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
            <p className="font-bold text-gray-800 text-base mb-1">📋 10 Program yang Menambah Biaya Seller Shopee 2026</p>
            <p className="text-xs text-gray-500 mb-4">Sumber: seller.shopee.co.id, help.shopee.co.id · Update Januari 2026<br/>Semua biaya dihitung dari <strong>harga netto</strong> (harga setelah dikurangi diskon penjual)</p>
            <div className="space-y-3">
              {ALL_PROGRAMS.map((p,i)=>(
                <div key={p.id} className={`border rounded-xl p-4 ${PROG_BG[p.color as keyof typeof PROG_BG]}`}>
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                      <p className="font-bold text-gray-800 text-sm">{p.label}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${p.badgeCls}`}>{p.badge}</span>
                  </div>
                  <p className="text-xs font-bold text-orange-600 pl-8 mb-1">{p.tarif}</p>
                  <p className="text-xs text-gray-600 pl-8 leading-relaxed">{p.catatan}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Skenario Total Potongan */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
            <p className="font-bold text-gray-800 mb-3">🧮 Skenario Total Potongan (Kategori A, harga Rp10.000)</p>
            {[
              {nama:"Minimal — wajib saja",             pct:"~11.25%",  cls:"bg-green-50 border-green-200",  items:["Admin 10%","Proses Rp1.250"]},
              {nama:"Sedang — + Ongkir XTRA",           pct:"~16.75%",  cls:"bg-yellow-50 border-yellow-200",items:["Admin 10%","Ongkir XTRA 5.5%","Proses Rp1.250"]},
              {nama:"Tinggi — + SPayLater 3 bln",       pct:"~19.25%",  cls:"bg-orange-50 border-orange-200",items:["Admin 10%","Ongkir XTRA 5.5%","SPayLater 2.5%","Proses Rp1.250"]},
              {nama:"+ Affiliate 8%",                   pct:"~28.1%",   cls:"bg-red-50 border-red-200",       items:["Admin 10%","Ongkir XTRA 5.5%","Affiliate 8%+PPN","SPayLater 2.5%","Proses Rp1.250"]},
              {nama:"Semua program aktif (terburuk)",   pct:"~34%+",    cls:"bg-red-100 border-red-300",      items:["Admin 10%","Ongkir 5.5%","Promo XTRA 2%","Affiliate 8%+PPN","SPayLater 6bln 4%","PO 3%","Ads 3%","COD 2%","Live 3%","Proses Rp1.250"]},
            ].map((s,i)=>(
              <div key={i} className={`mb-2 p-3 rounded-xl border ${s.cls}`}>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-700">{s.nama}</p>
                  <span className={`text-sm font-bold ${i>=3?"text-red-600":i>=2?"text-orange-600":"text-green-600"}`}>{s.pct}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{s.items.join(" + ")}</p>
              </div>
            ))}
            <div className="mt-3 bg-orange-500 rounded-xl p-3 text-white text-xs">
              <p className="font-bold mb-1">⚠️ Poin Penting tentang Shopee Affiliate</p>
              <p>• Biaya komisi affiliate <strong>belum termasuk PPN 11%</strong> — jadi komisi 8% sebenarnya = 8% × 1.11 = <strong>8.88%</strong> yang ditanggung seller</p>
              <p className="mt-1">• Affiliate hanya cocok untuk produk dengan margin &gt;25%. Untuk sembako/FMCG margin tipis, pertimbangkan matang-matang sebelum aktifkan</p>
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
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${strTab===s.id?"text-white shadow-md":"bg-white text-gray-600 border border-gray-200 hover:bg-orange-50"}`}
                  style={strTab===s.id?{background:`linear-gradient(135deg,${s.color.replace("from-","").split(" ")[0].replace(/\w+/,c=>`var(--tw-${c})`)},${s.color.split("to-")[1]})`}:{}}>
                  <span className="text-base">{s.icon}</span>
                  <span>{s.title}</span>
                </button>
              ))}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mt-2">
                <p className="text-xs text-orange-700 font-semibold mb-1">📚 Belajar Lebih Lanjut</p>
                <a href="https://seller.shopee.co.id/edu/courses" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-orange-600 underline">Shopee Seller Education Hub →</a>
              </div>
            </div>
            {activeStr && (
              <div className="flex-1 min-w-0">
                <div className={`bg-gradient-to-r ${activeStr.color} rounded-2xl p-5 mb-4 text-white shadow-md`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{activeStr.icon}</span>
                    <div>
                      <h2 className="text-xl font-bold">{activeStr.title}</h2>
                      <p className="text-white text-opacity-80 text-sm">Panduan dari Shopee Seller Education Hub</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeStr.tips.map((tip,i)=>(
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-r ${activeStr.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>{i+1}</div>
                        <p className="font-bold text-gray-800 text-sm">{tip.sub}</p>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{tip.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4">
                  {strIdx>0?<button onClick={()=>setStrTab(STRATEGI[strIdx-1].id)} className="text-xs text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50">← {STRATEGI[strIdx-1].title}</button>:<div/>}
                  {strIdx<STRATEGI.length-1?<button onClick={()=>setStrTab(STRATEGI[strIdx+1].id)} className={`text-xs text-white bg-gradient-to-r ${STRATEGI[strIdx+1].color} rounded-xl px-3 py-2`}>{STRATEGI[strIdx+1].title} →</button>:<div/>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 pb-4">help.shopee.co.id · seller.shopee.co.id/edu · Update Januari 2026</p>
    </div>
  );
}