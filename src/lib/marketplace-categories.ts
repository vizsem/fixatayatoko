// ── KATALOG KATEGORI RESMI MARKETPLACE & ATURAN OTOMATISASI PENEMPATAN ────────
// Dikalibrasi langsung sesuai struktur kategori Shopee (Kat A-E, X) & TikTok Shop (Grup B, 1-5, D)
// Update data settlement riil 2026

export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  code?: string; // TikTok / Marketplace Category ID
  icon: string;
  group: 'makanan' | 'sembako' | 'perawatan' | 'kebersihan' | 'bayi' | 'fashion' | 'elektronik' | 'lainnya';
  shopeeKat: 'A' | 'B' | 'C' | 'D' | 'E' | 'X';
  shopeeStarAdmin: number;
  shopeeMallAdmin: number;
  tiktokGroup: string;
  tiktokKomisi: number;
  description: string;
  keywords: string[];
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  // ── 1. MAKANAN, SNACK & OLEH-OLEH (Termasuk Bakpia & Roti Abon) ──
  {
    id: 'kue_pastri',
    name: 'Kue Camilan & Roti Pastri (820368)',
    slug: 'kue-camilan-roti-pastri',
    code: '820368',
    icon: '🍪',
    group: 'makanan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: 'B',
    tiktokKomisi: 9.5,
    description: 'Bakpia, roti abon, pia, bolu, kue lapis, cake, brownies, dan olahan pastry camilan khas.',
    keywords: [
      'bakpia', 'abon', 'pia ', 'pia,', 'pia-', 'roti', 'pastri', 'pastry', 'cake', 'bolu', 'brownies',
      'donut', 'donat', 'lapis legit', 'lapis surabaya', 'muffin', 'pie', 'croissant', 'sponge cake', 'bika ambon',
      'bakery', 'sari roti', 'paroti', 'bread', 'bagelen', 'kastengel', 'nastar', 'putri salju'
    ]
  },
  {
    id: 'keripik_snack',
    name: 'Keripik & Camilan Isi (700554)',
    slug: 'keripik-camilan-isi',
    code: '700554',
    icon: '🥔',
    group: 'makanan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Keripik singkong, kentang, pisang, makaroni, pilus, kerupuk, krupuk, dan aneka snack gurih renyah.',
    keywords: [
      'keripik', 'kripik', 'snack', 'chiki', 'taro', 'lays', 'chitato', 'kusuka', 'singkong',
      'makaroni', 'pilus', 'krupuk', 'kerupuk', 'emping', 'twistko', 'twisko', 'cheetos', 'qtela',
      'potabee', 'tic tac', 'sukro', 'kacang atom', 'garuda rous', 'pangsit', 'basreng', 'seblak',
      'pringles', 'oishi', 'panchos', 'popcorn', 'rumput laut', 'nori', 'mister potato', 'maxicorn',
      'piattos', 'ring', 'sponge crunch', 'snack mie', 'soba', 'keripik tempe', 'slondok'
    ]
  },
  {
    id: 'biskuit_wafer',
    name: 'Biskuit, Kue & Wafer (700553)',
    slug: 'biskuit-kue-wafer',
    code: '700553',
    icon: '🧇',
    group: 'makanan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Biskuit, wafer lapis cokelat/vanila, cookies, crackers, malkist, dan kue kering renyah.',
    keywords: [
      'biskuit', 'wafer', 'oreo', 'tango', 'roma', 'khong guan', 'slai olai', 'malkist',
      'crackers', 'gery', 'nabati', 'monde', 'astor', 'chocochips', 'timtam', 'nissin',
      'marie regal', 'better', 'duo', 'wafello', 'chocomania', 'good time', 'beng-beng wafer',
      'hatari', 'kokola', 'biskuwit', 'genji', 'serena', 'crispy crackers'
    ]
  },
  {
    id: 'cokelat_camilan',
    name: 'Cokelat & Camilan Cokelat (700768)',
    slug: 'cokelat-camilan-cokelat',
    code: '700768',
    icon: '🍫',
    group: 'makanan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Cokelat batangan, butir, cokelat pasta, meses, dan camilan balut cokelat premium.',
    keywords: [
      'cokelat', 'coklat', 'chocolate', 'silverqueen', 'cadbury', 'chunky bar', 'beng beng', 'beng-beng',
      'delfi', 'kitkat', 'toblerone', 'choki choki', 'meses', 'ceres', 'nutella', 'ovomaltine', 'top coklat', 'kinder joy'
    ]
  },
  {
    id: 'permen_jelly',
    name: 'Permen (921736)',
    slug: 'permen',
    code: '921736',
    icon: '🍬',
    group: 'makanan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Permen kenyal jelly, mint, permen kopi, permen susu, lolipop, dan chewing gum.',
    keywords: [
      'permen', 'candy', 'yupi', 'mentos', 'kopiko', 'relaxa', 'chupa chups', 'gula-gula',
      'chewy jelly', 'bubble gum', 'alpenliebe', 'foxs', 'kiss', 'frozz', 'blaster', 'tamarin', 'wood',
      'jelly gum', 'yosan', 'lotte gum', 'permen jahe', 'hexos'
    ]
  },
  {
    id: 'mie_instan',
    name: 'Mie Instan (700644)',
    slug: 'mie-instan',
    code: '700644',
    icon: '🍜',
    group: 'makanan',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Mie instan kuah/goreng, cup mie, bihun, soun, spaghetti, makaroni kering, dan pasta instan.',
    keywords: [
      'mie', 'mi ', 'mi,', 'indomie', 'sedap', 'sedaap', 'sarimi', 'pop mie', 'lemonilo',
      'bihun', 'soun', 'spaghetti', 'la fonte', 'sukses isi 2', 'intermi', 'supermi', 'gepuk', 'shin ramyun', 'samyang', 'pasta'
    ]
  },
  {
    id: 'makanan_kaleng',
    name: 'Makanan Kalengan, Stoples, & Kemasan (918280)',
    slug: 'makanan-kalengan-stoples',
    code: '918280',
    icon: '🥫',
    group: 'makanan',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Sarden, kornet sapi, tuna kaleng, buah kaleng (lychee, longan), jamur kaleng, sosis siap makan.',
    keywords: [
      'sarden', 'sardines', 'kornet', 'pronas', 'abc sarden', 'mili', 'narcissus', 'lychee', 'longan',
      'kelengkeng', 'buah kaleng', 'sosis so nice', 'so good', 'kimbo', 'ready to eat', 'tuna in oil',
      'ayam brand', 'king fisher', 'gaga sarden'
    ]
  },
  {
    id: 'bahan_kue',
    name: 'Tepung & Bahan Kue (920968)',
    slug: 'tepung-bahan-kue',
    code: '920968',
    icon: '🥞',
    group: 'sembako',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Tepung terigu, tepung beras, maizena, ragi instan, baking powder, soda kue, vanili, pewarna makanan.',
    keywords: [
      'tepung', 'terigu', 'segitiga biru', 'cakra kembar', 'kunci biru', 'maizena', 'tapioka',
      'rose brand tepung', 'ketan', 'ragi', 'saf-instant', 'fermipan', 'baking powder', 'soda kue',
      'koepoe', 'vanili', 'sp', 'ovalet', 'tbm', 'agar-agar', 'nutrijell', 'swallow globe'
    ]
  },

  // ── 2. MINUMAN, KOPI, TEH & SUSU ──
  {
    id: 'kopi',
    name: 'Kopi (700612)',
    slug: 'kopi',
    code: '700612',
    icon: '☕',
    group: 'makanan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Kopi bubuk hitam, kopi sachet 3-in-1, biji kopi sangrai, kopi celup, kopi siap minum botol/kaleng.',
    keywords: [
      'kopi', 'coffee', 'kapal api', 'torabika', 'tora bika', 'luwak', 'nescafe', 'good day', 'top kopi',
      'white coffee', 'espresso', 'caffino', 'fresco', 'abadi', 'liong', 'gadjah', 'kopi tubruk'
    ]
  },
  {
    id: 'teh',
    name: 'Teh (916488)',
    slug: 'teh',
    code: '916488',
    icon: '🍵',
    group: 'makanan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Teh celup, teh tubruk wangi melati, teh hijau, teh hitam, matcha, teh tarik sachet.',
    keywords: [
      'teh ', 'teh,', 'tea', 'sariwangi', 'tong tji', 'poci', 'sosro', 'matcha', 'greentea',
      'lipton', 'teh cap botol', 'teh dandang', 'teh 2 tang', 'teh gopek', 'teh tarik', 'teh jawa'
    ]
  },
  {
    id: 'susu_kental_manis',
    name: 'Susu Kental Manis (820752)',
    slug: 'susu-kental-manis',
    code: '820752',
    icon: '🥛',
    group: 'sembako',
    shopeeKat: 'C',
    shopeeStarAdmin: 6.75,
    shopeeMallAdmin: 7.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Susu kental manis kaleng, sachet, pouch, creamer kental, untuk kopi & olahan makanan.',
    keywords: [
      'kental manis', 'frisian flag', 'bendera', 'indomilk kental', 'tiga sapi', 'carnation',
      'omela', 'creamer', 'susu kaleng', 'skm'
    ]
  },
  {
    id: 'susu_bubuk_uht',
    name: 'Susu Bubuk & UHT (820496)',
    slug: 'susu-bubuk-uht',
    code: '820496',
    icon: '🧃',
    group: 'makanan',
    shopeeKat: 'C',
    shopeeStarAdmin: 6.75,
    shopeeMallAdmin: 7.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Susu UHT siap minum, susu bubuk keluarga, susu pertumbuhan anak, susu steril kaleng.',
    keywords: [
      'susu uht', 'ultra milk', 'bear brand', 'dancow', 'hilo', 'anlene', 'milo', 'susu steril',
      'diamond milk', 'greenfields', 'cimory', 'chocodrink', 'susu cair', 'zee rtd', 'chil go'
    ]
  },
  {
    id: 'minuman_kemasan',
    name: 'Minuman Segar & Kemasan (916744)',
    slug: 'minuman-segar-kemasan',
    code: '916744',
    icon: '🥤',
    group: 'makanan',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Air mineral, sirup botol, minuman bersoda, minuman isotonik, jus, dan serbuk minuman sachet.',
    keywords: [
      'air mineral', 'le minerale', 'aqua', 'cleo', 'ades', 'pristine', 'nutrisari', 'marimas',
      'jasjus', 'fanta', 'sprite', 'coca cola', 'coca-cola', 'pocari', 'hydro coco', 'floridina', 'teh botol',
      'teh pucuk', 'frestea', 'marjan', 'abc sirup', 'squash', 'larutan cap kaki tiga',
      'kratingdaeng', 'mizone', 'chrysanthemum', 'adem sari', 'country choice', 'buavita', 'olatte', 'fruit tea', 'c1000'
    ]
  },

  // ── 3. SEMBAKO & BUMBU DAPUR ──
  {
    id: 'beras',
    name: 'Beras (917896)',
    slug: 'beras',
    code: '917896',
    icon: '🍚',
    group: 'sembako',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Beras putih pulen, beras merah, beras ketan, beras premium 5kg, 10kg, 25kg.',
    keywords: [
      'beras', 'rice', 'rojolele', 'pandan wangi', 'beras merah', 'mentik', 'maknyus', 'lahap', 'sanina', 'setra ramos'
    ]
  },
  {
    id: 'minyak_goreng',
    name: 'Minyak Goreng (918920)',
    slug: 'minyak-goreng',
    code: '918920',
    icon: '🍳',
    group: 'sembako',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Minyak goreng kelapa sawit pouch 1L & 2L, minyak jagung, minyak wijen, margarin, mentega.',
    keywords: [
      'minyak goreng', 'minyak sayur', 'bimoli', 'sania', 'filma', 'sunco', 'tropical',
      'fortune', 'kunci mas', 'palma', 'rose brand minyak', 'minyak kita', 'blue band', 'palmia', 'forvita', 'mentega', 'margarin', 'minyak'
    ]
  },
  {
    id: 'gula_pemanis',
    name: 'Gula & Pemanis (919048)',
    slug: 'gula-pemanis',
    code: '919048',
    icon: '🥣',
    group: 'sembako',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Gula pasir putih, gula merah aren/kelapa, gula batu, gula halus, madu, stevia pemanis rendah kalori.',
    keywords: [
      'gula pasir', 'gula merah', 'gula aren', 'gulaku', 'gula tebu', 'gula batu', 'gula halus',
      'pemanis', 'stevia', 'diabetasol', 'tropicana slim', 'madu', 'gula'
    ]
  },
  {
    id: 'bumbu_penyedap',
    name: 'Bumbu, Rempah & Bumbu (919176)',
    slug: 'bumbu-rempah-bumbu',
    code: '919176',
    icon: '🧂',
    group: 'sembako',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Penyedap rasa, kaldu jamur/ayam/sapi, kecap manis/asin, saus sambal, saus tiram, garam dapur, bumbu racik.',
    keywords: [
      'bumbu', 'rempah', 'royco', 'masako', 'micin', 'ajinomoto', 'sasa', 'kecap', 'bango',
      'abc kecap', 'saos', 'saus', 'sambal', 'ladaku', 'garam', 'totole', 'kaldu', 'terasi',
      'ketumbar', 'kunyit', 'merica', 'desaku', 'santan', 'kara', 'sasa santan', 'racik', 'indofood bumbu', 'saus tiram', 'saori',
      'cuka', 'minyak wijen', 'tauco'
    ]
  },

  // ── 4. PERAWATAN DIRI & KECANTIKAN ──
  {
    id: 'sabun_mandi',
    name: 'Sabun Mandi (601493)',
    slug: 'sabun-mandi',
    code: '601493',
    icon: '🧼',
    group: 'perawatan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Sabun mandi batang, sabun cair refill & botol, body wash antibakteri, scrub tubuh, sabun cuci tangan.',
    keywords: [
      'sabun mandi', 'body wash', 'lifebuoy', 'lux', 'dettol', 'giv', 'biore', 'shinzui',
      'dove', 'nuvo', 'herborist body', 'fres soap', 'sabun cair', 'sabun batang', 'zen body', 'pro guard bw',
      'handsoap', 'hand soap', 'nosy handsoap', 'body scrub', 'sabun'
    ]
  },
  {
    id: 'sampo_rambut',
    name: 'Sampo & Kondisioner (601469)',
    slug: 'sampo-kondisioner',
    code: '601469',
    icon: '🧴',
    group: 'perawatan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Sampo anti ketombe, kondisioner rambut, serum rambut, hair tonic, minyak kemiri.',
    keywords: [
      'shampoo', 'sampo', 'conditioner', 'pantene', 'clear', 'sunsilk', 'head & shoulders',
      'head&shoulders', 'tresemme', 'rejoice', 'zinc', 'kemiri', 'hair tonic', 'makarizo',
      'jhonson shp', 'johnson shp', 'cb shampo', 'shampo'
    ]
  },
  {
    id: 'perawatan_gigi',
    name: 'Perawatan Gigi & Mulut (601696)',
    slug: 'perawatan-gigi-mulut',
    code: '601696',
    icon: '🪥',
    group: 'perawatan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Pasta gigi pencegah gigi berlubang/sensitif, sikat gigi, obat kumur, benang gigi.',
    keywords: [
      'odol', 'pepsodent', 'ciptadent', 'close up', 'sensodyne', 'pasta gigi', 'sikat gigi',
      'listerine', 'mouthwash', 'formula sikat', 'colgate', 'oral b', 'oral-b', 'oral b sg'
    ]
  },
  {
    id: 'skincare_kosmetik',
    name: 'Perawatan Kulit & Kosmetik (601615)',
    slug: 'perawatan-kulit-kosmetik',
    code: '601615',
    icon: '💄',
    group: 'perawatan',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Facial wash, serum, sunscreen, moisturizer, deodorant, parfum, kosmetik, perawatan pria.',
    keywords: [
      'kahf', 'wardah', 'garnier', 'ponds', 'emina', 'nivea', 'vaseline', 'deodorant',
      'rexona', 'posh', 'parfum', 'cologne', 'body lotion', 'sunscreen', 'facial wash', 'micellar water', 'bedak',
      'morris edp', 'morris', 'body butter', 'body scrub', 'gatsby', 'axe', 'casablanca', 'bellagio', 'edp', 'edt'
    ]
  },
  {
    id: 'tisu_saniter',
    name: 'Tisu & Serbet & Lap (993544)',
    slug: 'tisu-serbet-lap',
    code: '993544',
    icon: '🧻',
    group: 'kebersihan',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Tisu wajah (facial tissue), tisu toilet, tisu basah (wipes) bayi & antiseptik, lap serbet.',
    keywords: [
      'tisu', 'tissue', 'paseo', 'nice', 'jolly', 'tessa', 'wipes', 'mitu wipes', 'pigeon wipes',
      'serbet', 'tisu basah', 'tisu kering', 'tisu dapur', 'towel', 'wellis hend towel'
    ]
  },

  // ── 5. IBU, BAYI & POPOK ──
  {
    id: 'popok_bayi',
    name: 'Popok Bayi & Dewasa (981256)',
    slug: 'popok-bayi-dewasa',
    code: '981256',
    icon: '👶',
    group: 'bayi',
    shopeeKat: 'B',
    shopeeStarAdmin: 9.0,
    shopeeMallAdmin: 10.2,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Popok celana bayi, popok perekat, popok lansia / dewasa, perlengkapan higienis bayi.',
    keywords: [
      'popok', 'diapers', 'diaper', 'mamypoko', 'sweety', 'merries', 'baby happy', 'pampers',
      'confidence', 'lifree', 'goon', 'makuku', 'fitti', 'pembalut', 'charm', 'laurier', 'kotex',
      'zwitsal', 'cussons', 'johnson baby', 'cb powd', 'bedak bayi'
    ]
  },
  {
    id: 'makanan_bayi',
    name: 'Susu & Makanan Bayi (820624)',
    slug: 'susu-makanan-bayi',
    code: '820624',
    icon: '🍼',
    group: 'bayi',
    shopeeKat: 'C',
    shopeeStarAdmin: 6.75,
    shopeeMallAdmin: 7.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Susu formula bayi, biskuit bayi, bubur MPASI, sereal bayi.',
    keywords: [
      'chil kid', 'chil school', 'chil go', 'sgm', 'morinaga', 'bebelac', 'promina', 'sun bubur',
      'cerelac', 'milna', 'bubur bayi', 'susu formula', 'biskuit bayi', 'mpasi', 'pediasure'
    ]
  },

  // ── 6. KEBERSIHAN & RUMAH TANGGA ──
  {
    id: 'deterjen_pewangi',
    name: 'Deterjen & Pewangi Pakaian (1020552)',
    slug: 'deterjen-pewangi-pakaian',
    code: '1020552',
    icon: '🧺',
    group: 'kebersihan',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Deterjen bubuk & cair, pelembut dan pewangi pakaian (konsentrat), pelicin setrika.',
    keywords: [
      'deterjen', 'detergent', 'rinso', 'daia', 'soklin', 'so klin', 'downy', 'molto',
      'pewangi', 'pelicin', 'kispray', 'vanish', 'attack', 'boom', 'gentle gen', 'sabun cuci baju',
      'rapika', 'rapika biang', 'trio pelicin'
    ]
  },
  {
    id: 'pembersih_rumah',
    name: 'Pembersih Rumah & Dapur (600447)',
    slug: 'pembersih-rumah-dapur',
    code: '600447',
    icon: '🧽',
    group: 'kebersihan',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Sabun cuci piring jeruk nipis, karbol wangi lantai, pembersih porselen & kloset, cairan disinfektan.',
    keywords: [
      'sunlight', 'mama lemon', 'wipol', 'super pell', 'harpic', 'porstex', 'bayclin',
      'pemutih', 'bebek kloset', 'prostex', 'sos karbol', 'sos lantai', 'cuci piring', 'pembersih lantai',
      'disinfectant', 'yuri sol', 'vixal', 'bagus kamper', 'pengharum ruangan', 'air freshener', 'baygon', 'hit obat nyamuk',
      'mr muscle', 'super kifa', 'stella', 'glade', 'kit vinyll', 'kit motor', 'pengkilap'
    ]
  },

  // ── 7. KESEHATAN, OBAT & ROKOK ──
  {
    id: 'kesehatan_obat',
    name: 'Kesehatan & Suplemen (947720)',
    slug: 'kesehatan-suplemen',
    code: '947720',
    icon: '💊',
    group: 'makanan',
    shopeeKat: 'C',
    shopeeStarAdmin: 6.5,
    shopeeMallAdmin: 7.2,
    tiktokGroup: '2',
    tiktokKomisi: 6.30,
    description: 'Obat bebas pusing/flu/batuk/maag, minyak kayu putih, minyak telon bayi, balsem, vitamin C & suplemen.',
    keywords: [
      'paracetamol', 'panadol', 'bodrex', 'promag', 'tolak angin', 'antangin', 'enervon',
      'vitamin', 'suplemen', 'betadine', 'minyak kayu putih', 'freshcare', 'safe care',
      'salonpas', 'koyo', 'mixagrip', 'inza', 'ultraflu', 'bintang toedjoe', 'my baby minyak telon',
      'konicare', 'telon', 'balsem', 'konidin', 'hufagrip', 'komix', 'procold', 'neozep', 'plossa', 'vicks'
    ]
  },
  {
    id: 'rokok',
    name: 'ROKOK (Cukai Resmi)',
    slug: 'rokok',
    code: 'ROKOK',
    icon: '🚬',
    group: 'lainnya',
    shopeeKat: 'A',
    shopeeStarAdmin: 10.0,
    shopeeMallAdmin: 11.7,
    tiktokGroup: '1',
    tiktokKomisi: 5.25,
    description: 'Rokok filter, kretek, mild dengan pita cukai resmi pemerintah.',
    keywords: [
      'rokok', 'surya', 'sampoerna', 'djarum', 'marlboro', 'gudang garam', 'magnum', 'esse',
      'camel', 'filter', 'kretek', 'clasmild', 'juara', 'diplomat', 'la bold', 'dunhill', 'evolution', 'pro mild'
    ]
  }
];

/**
 * Otomatis menebak kategori produk berdasarkan judul produk dan kategori lama
 */
export function classifyProduct(productName: string, currentCategory?: string): {
  matched: boolean;
  categoryName: string;
  categoryInfo: MarketplaceCategory | null;
  ruleName?: string;
} {
  if (!productName || typeof productName !== 'string') {
    return { matched: false, categoryName: currentCategory || 'UMUM', categoryInfo: null };
  }

  const cleanTitle = (' ' + productName.toLowerCase() + ' ').replace(/[^a-z0-9\s]/g, ' ');

  // Periksa kesesuaian kata kunci kategori dengan prioritas spesifik lebih dulu
  for (const cat of MARKETPLACE_CATEGORIES) {
    for (const kw of cat.keywords) {
      const cleanKw = (' ' + kw.toLowerCase() + ' ').replace(/[^a-z0-9\s]/g, ' ');
      if (cleanTitle.includes(cleanKw) || cleanTitle.includes(kw.toLowerCase())) {
        return {
          matched: true,
          categoryName: cat.name,
          categoryInfo: cat,
          ruleName: kw
        };
      }
    }
  }

  // Jika nama kategori lama sudah spesifik (mengandung angka kode ID seperti (700554)), pertahankan
  if (currentCategory && currentCategory.includes('(') && currentCategory.includes(')')) {
    const matchedExisting = MARKETPLACE_CATEGORIES.find(c => c.name.toLowerCase() === currentCategory.toLowerCase());
    return {
      matched: true,
      categoryName: currentCategory,
      categoryInfo: matchedExisting || null,
      ruleName: 'existing_code'
    };
  }

  return {
    matched: false,
    categoryName: currentCategory || 'UMUM',
    categoryInfo: null
  };
}
