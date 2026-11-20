import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

const rawText = fs.readFileSync("scripts/warung_sembako_raw.txt", "utf-8");

function detectCategory(name) {
  const n = name.toUpperCase();
  if (/ROKOK|FILTER|KRETEK|MILD|SURYA|DJARUM|SAMPOERNA|MARLBORO|ESSE|CAMEL|DUNHILL|WISMILAK|MINAK DJINGGO|ENVIO|MAGNUM|NESLITE|TWIZZ|ZIGA|JUARA/.test(n)) {
    return "Rokok & Tembakau";
  }
  if (/MINYAK|BERAS|GULA|GARAM|TEPUNG|TELUR|SANTAN|MARGARINE|MENTEGA/.test(n)) {
    return "Sembako & Bahan Pokok";
  }
  if (/MIE|BIHUN|SPAGHETTI|BUBUR|POP MIE|SARIMI|SEDAAP MIE|INDOMIE|SUKSES/.test(n)) {
    return "Mie & Makanan Instan";
  }
  if (/BUMBU|KECAP|SAMBAL|SAUS|SAUCE|TERASI|CUKA|RACIK|MASAKO|ROYCO|AJINOMOTO|SASA|SAORI|MAYUMI|MAESTRO|PELEZAT|PENYEDAP/.test(n)) {
    return "Bumbu & Dapur";
  }
  if (/KOPI|TEH|SUSU|COFFEE|TEA|SYRUP|SIRUP|LARUTAN|AIR MINERAL|AQUA|MINUMAN|JUICE|UHT|SODA|COCA COLA|SPRITE|FANTA|NUTRISARI|ENERGEN|MILO|YOU C1000|POCARI|HYDRO|KRATINGDAENG|M-150|EXTRA JOSS|HEMAVITON|ALE-ALE|TEH BOTOL|TEH GELAS|TORABIKA|KAPAL API|TOP COFFEE|GOOD DAY|LUWAK/.test(n)) {
    return "Minuman & Susu";
  }
  if (/BISCUIT|BISKUIT|WAFER|CRACKERS|COOKIES|ROTI|BREAD|CAKE|MARIE|MALKIST|OREO|TANGO|NISSIN|KHONG GUAN|ROMA|HATARI|GERY|CHOCOLATOS/.test(n)) {
    return "Biskuit & Roti";
  }
  if (/SNACK|KERIPIK|CHIPS|PILUS|KACANG|KUACI|CANDY|PERMEN|JELLY|PUDDING|AGAR AGAR|CHITATO|TARO|QTELA|KUSUKA|POTABEE|OISHI|YUPY|YUPI|BIG BABOL|CHUPA CHUPS|MENTOS|FOX/.test(n)) {
    return "Snack & Permen";
  }
  if (/SABUN|SHAMPOO|PASTA GIGI|SIKAT GIGI|BODY WASH|BODY FOAM|BODY LOTION|DEODORANT|POMADE|PEMBALUT|POPOK|PANTS|BABY|DIAPERS|TISSUE|KAPAS|MINYAK KAYU PUTIH|MINYAK TELON|BALSAM|KOYO|OBAT|TOLAK ANGIN|ANTANGIN|VITAMIN|BETADINE|DIAPET|KOMIX|SANGOBION|ENERVON|XON-CE|FRESH CARE/.test(n)) {
    return "Perawatan & Kesehatan";
  }
  if (/DETERGENT|DETERJEN|PEMBERSIH|PENCUCI PIRING|KARBOL|PEWANGI|PELICIN|PEMUTIH|OBAT NYAMUK|INSEKTISIDA|KAMPER|KAPUR AJAIB|ALAT PEL|SAPU|PLAKBAN|BATTERY|BATERAI|AMPLOP|TALI|LEM TIKUS|SPIDOL|SUNLIGHT|MAMA LEMON|MAMA LIME|RINSO|DAIA|SO KLIN|BOOM|VIXAL|BAYCLIN|PROCLIN|KISPRAY|RAPIKA|WIPOL|BAYGON|HIT|VAPE|STELLA/.test(n)) {
    return "Kebutuhan Rumah Tangga";
  }
  return "Sembako & Kebutuhan Warung";
}

function detectBrand(name) {
  const brands = [
    "INDOMIE", "SEDAAP", "SARIMI", "POP MIE", "SUKSES", "LEMONILO", "SAMPOERNA", "GUDANG GARAM",
    "DJARUM", "MARLBORO", "ESSE", "CAMEL", "DUNHILL", "WISMILAK", "MINAK DJINGGO", "ENVIO",
    "INDOMILK", "FRISIAN FLAG", "ULTRA", "DANCOW", "MILO", "CARNATION", "CAP ENAK", "ZEE",
    "KAPAL API", "TOP COFFEE", "TORABIKA", "GOOD DAY", "LUWAK", "NESCAFE", "INDOCAFE",
    "SOSRO", "AQUA", "LE MINERALE", "CLUB", "CLEO", "YOU C1000", "POCARI SWEAT", "ICHITAN", "FRESTEA",
    "ABC", "INDOFOOD", "BANGO", "SASA", "AJINOMOTO", "ROYCO", "KOBE", "MAMASUKA",
    "BIMOLI", "FILMA", "SANIA", "FORTUNE", "ROSE BRAND", "SEGITIGA BIRU", "CAKRA KEMBAR", "KUNCI BIRU", "MILA", "PAYUNG",
    "ROMA", "NISSIN", "KHONG GUAN", "TANGO", "HATARI", "OREO", "GERY", "CHOCOLATOS", "MONDE", "ARNOTT'S", "DELFI", "DEKA",
    "CHITATO", "TARO", "QTELA", "KUSUKA", "POTABEE", "GARUDA", "DUA KELINCI", "OISHI", "HAPPYTOS", "PIATTOS", "GURIBEE",
    "PEPSODENT", "CIPTADENT", "CLOSE UP", "KODOMO", "FORMULA", "LIFEBUOY", "GIV", "NUVO", "SHINZU'I", "BIORE", "DETTOL", "LERVIA",
    "CLEAR", "SUNSILK", "PANTENE", "ZINC", "HEAD & SHOULDERS", "TRESEMME", "MARINA", "CITRA", "VASELINE", "NIVEA", "GLOW & LOVELY", "PONDS", "GARNIER", "VIVA",
    "CHARM", "LAURIER", "SOFTEX", "MAMY POKO", "MERRIES", "MY BABY", "CUSSONS", "ZWITSAL", "MITU", "HUKI",
    "CAP LANG", "GELIGA", "FRESH CARE", "TOLAK ANGIN", "ANTANGIN", "SIDO MUNCUL", "KIRANTI", "SALONPAS", "HANSAPLAST", "BETADINE",
    "RINSO", "DAIA", "SO KLIN", "BOOM", "ATTACK JAZ 1", "SUNLIGHT", "MAMA LEMON", "MAMA LIME", "WOW", "EKONOMI", "WING'S",
    "VIXAL", "PORSTEX", "BAYCLIN", "PROCLIN", "WIPOL", "BIOSOL", "SUPERSOL", "SOS", "KISPRAY", "RAPIKA", "MOLTO",
    "BAYGON", "HIT", "VAPE", "KING KONG", "AUTAN", "SOFFELL", "STELLA", "BAGUS", "SWALLOW",
    "FOX'S", "MENTOS", "KIS", "BIG BABOL", "CHUPA CHUPS", "MILKITA", "HEXOS", "NANO NANO", "TAMARIN", "RELAXA", "MINTZ", "YUPI", "INACO", "OKKY", "NUTRIJELL",
    "NUTRISARI", "POP ICE", "MARJAN", "CAP BADAK", "KAKI TIGA", "ADEM SARI", "EXTRA JOSS", "KUKU BIMA", "HEMAVITON", "KRATINGDAENG", "M-150",
    "PRONAS", "BOTAN", "MAYA", "ASAHI", "CHAMP", "SO NICE", "SUN SWALLOW", "LARISST", "NICE", "PASEO", "TESSA"
  ];
  const u = name.toUpperCase();
  for (const b of brands) {
    if (u.includes(b)) return b;
  }
  return u.split(" ")[0] || "UMUM";
}

function parseProducts(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Cek jika line adalah URL atau [Link](url)
    const linkMatch = line.match(/https:\/\/klikindogrosir\.com\/product_details\/(\d+)/);
    if (linkMatch) {
      if (current && current.name && current.prices.length > 0) {
        items.push(current);
        current = null;
      }
      if (!current) {
        current = { sourceUrl: linkMatch[0], productId: linkMatch[1], name: "", prices: [] };
      } else {
        current.sourceUrl = linkMatch[0];
        current.productId = linkMatch[1];
      }
      continue;
    }

    // Cek apakah line adalah harga: contoh "Rp11.900 /PCS" atau "7.800 /PCS" atau "Rp64.000 Rp63.500 /PCK (isi 20)"
    const isPriceLine = /^(?:Rp)?\s*[\d.]+\s*(?:Rp\s*[\d.]+)?\s*\/(?:PCS|PCK|PAK|CTN|BOX|RCG|BAL|SLP|CRT|LSN|STR|STP|HGR|TRY|KRG|BAL|SAK|WHL)/i.test(line);

    if (!isPriceLine) {
      if (current && current.name && current.prices.length > 0) {
        items.push(current);
        current = null;
      }
      if (!current) {
        current = { sourceUrl: "", productId: "", name: line, prices: [] };
      } else {
        current.name = line;
      }
    } else {
      if (current) {
        current.prices.push(line);
      }
    }
  }

  if (current && current.name && current.prices.length > 0) {
    items.push(current);
  }

  return items;
}

function parsePriceLine(priceStr) {
  // Format contoh:
  // "Rp11.900 /PCS"
  // "Rp11.650 /PCS (min.3)"
  // "Rp559.200 /CTN (isi 48)"
  // "Rp64.000 Rp63.500 /PCK (isi 20)"
  // "7.800 /PCS"
  // "10.000 /HGR (isi 24)"
  // "Rp21.000 Rp18.300 /PCK (isi 6)"
  const clean = priceStr.replace(/\s+/g, " ");

  // unit match: /(PCS|CTN|BOX|PCK|PAK|RCG|BAL|SLP|CRT|LSN|STR|STP|HGR|TRY|KRG|SAK)/i
  const unitMatch = clean.match(/\/([A-Z]+)/i);
  const unit = unitMatch ? unitMatch[1].toUpperCase() : "PCS";

  // isi match: (isi 48)
  const isiMatch = clean.match(/\(isi\s+(\d+)\)/i);
  const contains = isiMatch ? parseInt(isiMatch[1], 10) : 1;

  // min qty match: (min.3)
  const minMatch = clean.match(/\(min\.?\s*(\d+)\)/i);
  const minQty = minMatch ? parseInt(minMatch[1], 10) : undefined;

  // Extract all numbers before the "/"
  const beforeSlash = clean.split("/")[0];
  const allNums = beforeSlash.match(/[\d.]+/g);
  let price = 0;
  if (allNums && allNums.length > 0) {
    // Ambil angka terakhir sebelum "/" jika ada coret (harga promo)
    const lastNumStr = allNums[allNums.length - 1].replace(/\./g, "");
    price = parseInt(lastNumStr, 10) || 0;
  }

  return { unit, contains, minQty, price, raw: priceStr };
}

async function run() {
  const parsedItems = parseProducts(rawText);
  console.log(`Berhasil mem-parse ${parsedItems.length} produk dari teks.`);

  // Cek nomor SKU terakhir secara akurat (numeric max)
  const { data: allSkus, error: skuErr } = await supabase
    .from("products")
    .select("sku")
    .ilike("sku", "ATY-IG-%");

  if (skuErr) {
    console.error("Gagal mengambil data SKU:", skuErr);
    throw skuErr;
  }

  let maxSkuNum = 617;
  if (allSkus && allSkus.length > 0) {
    for (const row of allSkus) {
      const match = row.sku?.match(/ATY-IG-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSkuNum) maxSkuNum = num;
      }
    }
  }

  let nextSkuNum = maxSkuNum + 1;

  console.log(`Memulai SKU dari: ATY-IG-${String(nextSkuNum).padStart(4, "0")}`);

  const productsToInsert = [];
  const processedSkus = new Set();

  for (const item of parsedItems) {
    const sku = `ATY-IG-${String(nextSkuNum++).padStart(4, "0")}`;
    const name = item.name.trim().toUpperCase();
    const brand = detectBrand(name);
    const category = detectCategory(name);

    const priceDetails = item.prices.map(parsePriceLine);

    // Tentukan base unit (biasanya PCS atau unit terkecil pertama yang non-grosir)
    let basePriceObj = priceDetails.find(p => !p.minQty && p.contains === 1) || priceDetails[0];
    const baseCost = basePriceObj.price;
    const baseUnit = basePriceObj.unit;

    // Margin 25%, dibulatkan ratusan terdekat
    // Price = Math.round((cost * 1.25) / 100) * 100
    const calcPrice = (cost) => Math.max(100, Math.round((cost * 1.25) / 100) * 100);
    const priceEcer = calcPrice(baseCost);

    // Cek grosir level (jika ada unit sama dengan minQty)
    const wholesaleTier = priceDetails.find(p => p.unit === baseUnit && p.minQty && p.minQty > 1);
    const priceGrosir = wholesaleTier ? calcPrice(wholesaleTier.price) : priceEcer;
    const minGrosir = wholesaleTier ? wholesaleTier.minQty : 0;

    // Build multi-units
    const units = [];
    // Unit dasar
    units.push({
      code: baseUnit,
      contains: 1,
      price: priceEcer,
      modal: baseCost,
      costPrice: baseCost,
      minQty: minGrosir > 0 ? undefined : undefined,
    });

    if (wholesaleTier && minGrosir > 0) {
      units.push({
        code: baseUnit,
        contains: 1,
        price: priceGrosir,
        modal: wholesaleTier.price,
        costPrice: wholesaleTier.price,
        minQty: minGrosir,
        label: `Grosir min ${minGrosir}`,
      });
    }

    // Tambah kemasan bertingkat (CTN, BOX, PCK, RCG, BAL, dll.)
    for (const p of priceDetails) {
      if (p.contains > 1 || (p.unit !== baseUnit && !p.minQty)) {
        const uCost = p.price;
        const uSell = calcPrice(uCost);
        units.push({
          code: p.unit,
          contains: p.contains,
          price: uSell,
          modal: uCost,
          costPrice: uCost,
          minQty: p.minQty,
          label: p.contains > 1 ? `Isi ${p.contains}` : undefined,
        });
      }
    }

    const prodId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${String(nextSkuNum).padStart(4, "0")}`;

    const rawData = {
      id: prodId,
      ID: prodId,
      sku: sku,
      Nama: name,
      name: name,
      Brand: brand,
      brand: brand,
      Kategori: category,
      category: category,
      Satuan: baseUnit,
      unit: baseUnit,
      Modal: baseCost,
      purchasePrice: baseCost,
      Ecer: priceEcer,
      price: priceEcer,
      priceEcer: priceEcer,
      Grosir: priceGrosir,
      priceGrosir: priceGrosir,
      Min_Grosir: minGrosir,
      minWholesaleQty: minGrosir,
      Stok: 0,
      stock: 0,
      Min_Stok: 5,
      Status: 0, // ARSIP
      is_active: false,
      isActive: false,
      margin_percent: 25,
      units: units,
      source_url: item.sourceUrl,
      source_product_id: item.productId,
      supplier: "KlikIndogrosir",
      Supplier: "KlikIndogrosir",
      notes: "Produk Rekomendasi Warung Sembako (Margin 25%)",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    productsToInsert.push({
      id: prodId,
      sku: sku,
      name: name,
      category: category,
      unit: baseUnit,
      price: priceEcer,
      cost_price: baseCost,
      stock: 0,
      barcode: "",
      image_url: "",
      description: `Rekomendasi Warung Sembako - ${name}`,
      is_active: false, // Arsip
      raw_data: rawData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`Menyimpan ${productsToInsert.length} produk ke database Supabase...`);

  // Batch insert per 50 item
  const chunkSize = 50;
  for (let i = 0; i < productsToInsert.length; i += chunkSize) {
    const chunk = productsToInsert.slice(i, i + chunkSize);
    const { error } = await supabase.from("products").insert(chunk);
    if (error) {
      console.error(`Error inserting chunk ${i}-${i + chunk.length}:`, error);
      throw error;
    }
    console.log(`Berhasil insert ${i + chunk.length} / ${productsToInsert.length} produk.`);
  }

  console.log("SUKSES: Seluruh produk rekomendasi warung sembako telah berhasil ditambahkan!");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
