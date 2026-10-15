import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { parseSupplierPriceBroadcast } from '../src/lib/supplier-price-parser';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const RAW_BROADCAST = `HARGA HEBOH STOCK POINT INDOGROSIR
KEDIRI
PERIODE 12 SEPTEMBER 2026

🥨SEMBAKO & BUMBU DAPUR

Lahap Lele 5kg : KOSONG/pcs
Sedap Wangi 5kg : kosong /pcs
Gula Rose Brand Kuning/Putih : kosong/ctn
Gulaku putih : KOSONG/ctn
Rizky 800ml BTL : 207.500/ctn
Rizky 400ml BTL : 111.000/ctn
Fitri 800ml : 207.500/ctn
Fitri 400ml : 111.500/ctn
Fitri 200ml : 114.000/ctn
Amago 750ml : 209.500/ctn
Bimoli 1L : KOSONG/ctn
Bimoli 2L : KOSONG/ctn
Bimoli 5L : KOSONG/ctn
Filma 2L : 250.200/ctn
Fortune 1L : 247.500/ctn
Fortune 2L : 248.000/ctn
Sovia 2L : 246.200/ctn
Sania 2L : 248.000/ctn
Sunco 2L : kosong /ctn
Tropical 2L : KOSONG/ctn
Rose Brand 220ml : 232.000/ctn
Merah Putih 900ml : 231.900/ctn

Masako ayam : 262.000/ctn
Masako sapi : 262.000/ctn
Royco renceng Ayam/Sapi : 215.000/ctn
Royco 220g : KOSONG/ctn
Kapal garam 250g : kosong /bal
Ajinomoto micin 250g : 37.500/3 pcs
Ajinomoto micin 500 an : 11.000/pck
Ajinomoto micin 1rb an : 18.200/pck
Ajinomoto micin 5rb an : 13.800/3 pcs
Sasa micin 100g : 53.750/pck
Sasa micin 250g : 36.900/3 pcs
Bumbu racik nasgor/syr asem/syr sop/ayam grg/ikan grg : 15.650/rcg
Bumbu racik ayam grg/tempe tahu : 15.500/rcg
Totole kaldu jamur 40g : 1.137.500/ctn
Desaku ketumbar : 152.250/ctn
Desaku kunyit : 342.000/ctn
Desaku marinasi : 342.500/ctn
Desaku bubuk bawang : 342.500/ctn
Ladaku : 57.600/pck
Maggi : KOSONG/5 rcg
Sun kara 65ml : 150.000/ctn/
Sasa Santan 65ml : 124.800/ctn
Sajiku tepung bumbu 80g : 286.000/ctn
Sasa tepung bakwan 100g : 21.700/rcg
Sasa tepung serba guna : 252.OOO/ctn 
Kobe tepung kentucky crispy 70g : 21.800/rcg
ABC kecap 62g : KOSONG/ctn
Bango renceng : 112.000/ctn
Bango manis hitam 55g : KOSONG/ctn
Bango 60ml : 113,000 /ctn
Bango 200ml : KOSONG /ctn
Bango 720ml : 258.000/ctn
Bango botol 135ml : 411.000/ctn
Indofood sambal pedas 140ml : 316.800/ctn
Indofood sambal extra pedas 140ml : 291.990/ctn
Indofood saus tomat 135ml : 273.660/ctn
Saori saus tiram : kosong/ctn
Delmonte saus tomat 24x9g : 99.000/ctn
Delmonte extra hot : 120.000/ctn
Sosis So Nice Ayam : 109.750/ctn
Sosis So Nice Sapi : 111.000/ctn

Segitiga 25kg : 222.000 /sak
Tepung payung 25kg :193.000/sak
Lencana merah 25kg : 106.500/sak
Tepung Tulip : 86.300/ctn
Segitiga biru transparan 1kg : 126.000/ctn
Segitiga biru 500g : 105.500/ctn
Lencana merah 1kg : 106.500/ctn
Cakra 1kg : 129.000/ctn
Tepung tapioka rose : 140.000/ctn
Tepung beras rose : 168.500/ctn
Tepung ketan rose : KOSONG/ctn
Blue band 200g : 492.000/ctn
Filma margarin 200g : 356.000/ctn
Palmia margarin 200g : 348.000/ctn

💊SUPLEMEN & KESEHATAN

Antangin : 45.000/box
Tolak angin : 45.000/box
Extra jos : KOSONG/ctn
Kratingdaeng : 47000/slop
Hansaplast isi 100 : 96.000/3 box
Kuku bima energi anggur : 19.200/box

🍜MIE

Pop mie cup kuah 75 : 103.005/ctn
Pop mie pedas : 57.500/ctn
Sedaap cup kuah soto : 48.500/ctn
Sedaap cup goreng : 51.000 /ctn
Sedaap cup korean spicy kuah/goreng : 50.700/ctn
Sedap cup baso : 48.500/ctn
Sedap cup baso bleduk : kosong /ctn
Sedap cup kari : 48.500/ctn
Sedaap goreng : 110.000/ctn
Sedap soto : 104.500/ctn
Sedap ayam bawang : 104.500/ctn
Sedap korean spicy : KOSONG/ctn
Sedap kari special : KOSONG/ctn
Indomie goreng : 112.000/ctn
Indomie ayam bawang : 107.000/ctn
Indomie soto mie : 107.000/ctn (max 10 ctn)
Indomie soto lamongan : KOSONG/ctn
Indomie soto special : KOSONG/ctn
Indomie ayam geprek : 112.000/ctn
Indomie rendang : 112.000/ctn (max 10 ctn)
Indomie kari ayam : 116.500/ctn
Indomie hype nyemek : 117.000/ctn
Indomie kriuk pedas : 114.000//ctn
Indomie mie aceh : 112.000/ctn (max 10 ctn)
Indomie jumbo goreng : kosong/ctn
Indomie hype seblak: 112.000/ctn
Sukses isi 2 ayam kecap : 83.000/ctn
Sukses isi 2 ayam kremes : 83.000max 10 ctn)
Sukses isi 2 rendang : 83.000/ctn
Sukses ayamn geprek ;83.000/ctn
Sarimi isi 2 ayam kecap : 86.800/ctn
Sarimi isi 2 soto : 83.500/ctn
Sarimi ayam kremes : 86.800/ctn
Intermi Goreng 65g : 52.000/ctn (max 10 ctn)
Intermi Pedas : 53.400/ctn
Ekomie 120g : 66.005/ctn
Ekomie 550g : 55.000
Padamu 300g : KOSONG/ctn
Padamu 150g : 82.500ctn
Kenduri : 9.600/ctn
Burung dara lebar : KOSONG/ctn
Burung dara kering 136g : 85.500
Burung dara pipih 140g : kosong 
Sarimie mie gelas sosis : 88.250/ctn
Sarimie mie gelas baso sapi : 88.250/ctn
Sarimie mie gelas ayam bawang : 88.250/ctn
3 Ayam mie telor kuning : KOSONG/ctn
Mie kuda menjangan 200g : 101.000/ctn
sarimi ayam pedas dower 94.000/ctn

🧋MINUMAN

Le Mineral 1.5L : 51.000/ctn
Le Mineral 600ml : 46.000/ctn
Le Mineral Galon 15L : KOOSONG
Le Mineral btl 330ml : 35.900/ctn
Cleo botol mini : 17.600/ctn
Cleo cup mini 120ml : 20.500/ctn
Cleo Galon 12.8L : kosong/ctn
Club cup 150ml : 18.300/CTN
Club cup 220ml : 22.500/ctn
Club 330ml : 32.750/ctn
Club 600ml : 36.500/ctn
Club 1.5L : 39.000/ctn
Club galon : 17.300 /ctn
Aqua 330ml : 36.000/ctn
Aqua 600ml : 43.500/2ctn
Aqua 1.5L : 49.200/2ctn
Aqua cup 220ml : 33.500
Aquviva 700ml : 22.800/ctn
Aquviva 1.6L : 25.500/ctn
Larisst air mineral 600ml : KOSONG/ctn

Teh pucuk 350ml :60.900/ctn
Teh gelas cup : 18.000/ctn
Teh gelas botol 250ML : 58.500/ctn
Teh sosro botol 350ML : 42.000/ctn
Teh ichi ocha 350ml : 55.500/ctn
Ultra teh kotak 300ml : 77.500/ctn
Ultra Kacang hijau 250ml : kosong
Ultra Kacang Hijau 150ml : kosong/ctn

Kopikap : KOSONG/ctn
ABC Coffee 200ml (isi 24) : 79.000/ctn
Golda coffee drink dolce/cappuccino (isi 12) : KOSONG/ctn
Good day mocacino btl 250ml : 125.000/ctn
Floridina orange/cocobit (isi 12) : 30.700/ctn
Nipis Madu btl 330ml : 39.500/ctn
Nipis Madu btl 1L : 104.400/ctn
Sprite/fanta soda 250ml : 35.100/ctn
Coca-cola/sprite/fanta 390ml : 41.500/ctn
sprite 390ML 40.700
Sprite 1500ml : KOSONG/ctn
Coca-Cola 1500ml :KOSONG/ctn
Fanta strawberry : 41.500/ctn
Fanta fruit punch : KOSONG/ctn
Pocari 350ml : kosong /ctn
Pocari 500ml : 160.800/ctn
Minute maid pulpy orange 300ml : 62.050/ctn
Mizone leci/cranberry 500ml : 49.300/ctn
You-C orange 140ml : 179.000/ctn
You-C orange 500ml : 168.000/ctn
You-C lemon 140ml : 179.000/ctn
Adem sari penyejuk : 51.100/pck
Adem sari chingku botol 350ml : 159.000/ctn
Adem sari chingku sparkling 320ml : 160.000/ctn
kaki tiga anak klg leci/strwbry 250ml : 133.500/ctn
Kaki tiga botol 200ml : 142.200 /ctn
Kaki tiga botol 500ml : 180.000/ctn
Kaki tiga kaleng 320ml jambu/leci : 144.500/ctn

Nutrisari sweet orange/mango/anggur/jeruk nipis/jeruk peras : 52.300/pck
Pop Ice Avocado/coklat/manga/permen karet/strawberry/taro : 31.800/3pcs
Ale-ale orange : 19.400/ctn

☕KOPI, TEH, & SEREAL

Ya sp : KOSONG/ctn
Luwak white : 182.000/ctn
Luwak hitam : 156.000/ctn
Luwak bubuk murni 100g : 178.500/ctn
Luwak bubuk murni rcg : 154.500/ctn
Kapal Api 90g : 256.500/ctn
Kapal api 150g : kosong/ctn
Kapal api 60g : 421.150/ctn
Kapal api 30g : 429.150/ctn
Kapal api mini : 182.500
Kapal api special mix : 193.200 /ctn
Kapal api special scht : 260.000/ctn
Gadjah tubruk special mix rcg : KOSONG/ctn
Brontoseno : 1.050.000/ctn
Top murni 158g : KOSONG/ctn
Top plus : 96.000/ctn
Top white : 130.000/ctn
Top cappucino : 216.000/ctn
Top susu : 152.750/ctn
top aren : 200.200/ctn 
Top coffe kopi gula 2 in 1 : 141.500/ctn
Good day cappuccino granul : 238.5000/ctn
Good day freeze mocafrio : 265.000
Good day mocacino rcg : 167.000/ctn
Good day mocacino pck : KOSONG/ctn
Indocafe bag 100x20g : 777.000/ctn
Indocafe pck 10x20g : 795.000/ctn
Indocafe cappuccino : 578.000/ctn
Torabika cappucino granul : 248.000/ctm
Torabika toramoka :kosong /CTN
Torabika creamy latte : 187.000/ctn
Torabika full cream : 197.500/ctn
ABC gula+susu 30g : 194.890/ctn
Kopi satu satu : 163.500/ctn

Chocolatos drink coklat : 194.000/ctn
Chocolatos drink matcha : 194.000/ctn
Beng-beng drink coklat : KOSONG/ctn

Teh Sariwangi rcg : 235.000/ctn
Teh Sariwangi box : kosong/ctn
Energen kacang hijau : 307.000/ctn
Energen coklat : 307.000/ctn
Energen vanilla : 307.000/ctn

🥛SUSU

Indomilk botol : 81.600/ctn
Indomilk kids 115ml : 99.500/ctn
Ultra mimi : KOSONG/ctn
Ultra 125ml : 130.000/ctn
Ultra 200ml : 112.000/ctn
Ultra 250ml : 153.000/ctn
Ultra 1000ml : 232.700/ctn
Milo 110ml : KOSONG/ctn
MIlo 180ml : KOSONG/ctn
Milo rcg : kosong/ctn
Clevo coklat 115ml : 88.500/ctn
Clevo strwbry 115ml : 88.500/ctn
Milku coklat : 33.600/ctn
Milku strwbry/original : 33.600/ctn
Bear brand : KOSONG/ctn
Tujuh kurma klg 189ml : 231.600/ctn
Nobo out milk 200ml : kosong /ctn
Indomilk sachet : 146.000/ctn
Indomilk kaleng putih : 557.000/ctn
Indomilk kaleng coklat : kosong
Indomilk Pouch 545g : 400.000/ctn
Frisian flag 115ml : 89.900/ctn
Frisian flag sachet : 163.000/ctn
Frisian flag kaleng : 619.200/ctn
Frisian flag pouch 545g : KOSONG/ctn
Tiga sapi kaleng : 596.000/ctn
Frisian flag 946 ml : KOSONG/ctn
Dancow rcg : 560.000/ctn
diamond milk coklat 125 ml :130.000
Greenfields UHT full cream:118.500/ctn

🍪SNACK, BISKUIT, PERMEN & ROTI

Aoka roti panggang coklat/keju/pandan/vanilla/blueberry/strawberry : 108.000 /ctn
Aoka roti gulung keju/coklat : 98.000/ctn
Chitato sapi pg/nori seawed 10g: 98.500/ctn
Taro snack barbeque/seawed rcg : 50.000/ctn
STT French Fries 17g : 99.000
STT French Fries 24g : 188.000/ctn
STT French Fries 62g : 143.000/ctn
Garuda pilus sapi panggang : 50.000/ctn
Happytos merah 140g : 133.500/ctn
Happytos merah rcg 25g : kosong /ctn
Jetz rcg 18g : 97.500/ctn
Nabati stick ahh : kosong /ctn
Nabati 2rb an : 167.000 /ctn
Nabati pack 110g : 169.000/ctn
Nabati stick siip : 125.000/ctn
Momogi : 67.000/ctn
Spix Soba : KOSONG/ctn
Nyam-nyam : 19.000/box
Chiki snack ball coklat :96.500/ctn
Chiki bal keju : kosong/ctn
chiki ball ayam : 96.500/ctn
garuda pilus 50.000
Gery chocolatos/dark 1000an : 19.400/box
Gery chocolatos 500an : KOSONG
Gery snack sereal : 101.600/ctn
Good time coklat/rainbow : 20.000/box
Goriorio coklat/vanilla : KOSONG/box
Hatari see hong puff kelapa/margarin/sugar : 36.600/6 pcs
Kalpa : KOSONG/box
Dilan : 19.900/box
Khong ghuan superco/wafer saltcheese 17/24g : 101.000/ctn
tango wafer coklat 100.000/ctn
Tango qafer longcoklat :98.000/ctn
sosi so nice 109.750/ctn
Nissin crispy : 282.000/ctn
Nissin wallens soes 15g : KOSONG/rcg
Nissin wallens soes 100g : 25.200/3 pcs
Roma kelapa 300g : 235.200/ctn
Roma sandwich coklat : kosong/ctn
Roma sandwich gandum : 186.600/ctn
Roma crackers sweet 105g : 171.000/ctn
Roma crackers kelapa kopyor 105g : KOSONG/pck
Roma sandwich better : kosong/rcg
Regal marie 120gr : 10.500/pcs
Regal marie 12g : 8.500/rcg
Beng-beng 25g : kosong/ctn
Choki - choki : 152.500/ctn
Kiko Ice stick : 18.600/3 pcs
Yupi babe bears / little stars : kosong/3box

Permen relaxa barley : 138.000/ctn
Permen mentos : 32.000/5pcs
Permen kopiko : kosong/pcs

🚬ROKOK

Andalan 12's : 162.000/slop
Andalan baru kretek 12's : 92.100/slop
Andalan baru filter : 161.200/slop
Andalan kretek 16 lama : 105.200/slop
Andalan kretek 16 baru ;92.100/slop 
Clas Mild 16's : 290.500/slop
Bentoel kretek 12' : 88.050/slop
Djarum kretek/Nanas 12's : 136.200/slop
Djarum manga royal 12's : 145.100/slop
Djarum kretek mangga : 145.200/slp
Djarum super 12's : 228.250/slop
Djarum 76 Apel kretek : 144.300/slop
Djarum 76 Apel royal : 152.300/slop
Djarum Black Matcha : KOSONG/slop
Dji Sam Soe kretek 12's : 191.000/slop
Dji Sam Soe premium 12's : 216.500/slop
Dji Sam Soe Magnum : 261.700slop
Dji sam  soe Magnum Kretek : 131.000/slop
Dunhill Hitam 12's : 222.200/slop
Dunhill Mild 16's : kosong /slop
Dunhill Filter 16's : 300.200/slop
Geo Mild 16's : 240.250/slop
Grendel biru 12 : 149.200
Grendel Utama kretek 12 : 77.300
GG Inter 12's : 516.500/slop
GG Signature : 258.300/slop
GG Surya Pro Merah : 320.500/slop
GG Surya 16's : 348.400/slop
GG Surya 12's : 258.500/slop
GG Surya kaleng 50's : 106.450
GG Kretek Djaya 12's : 135.200/slop
GG Kretek Merah 12's : 152.600/slop
GG Kretek Softpack 12's : 148.250/slop
L A 16's : 337.200/slop
L A Bold 16's : 373.100/slop
L A Purple 16's : 337.200/slop
Marlboro Light 20's : 518.900/slop
Marlboro Black 12's : 238.950/slop
Marlboro Black 20's : 388.300/slop
Marlboro Hardpack 20's : 518.500/slop
Marlboro Kretek 12's : 109.900/slop
Sampoerna 12's : 255.100/slop
Sampoerna 16's : 365.000/slop
Sampoerna 16 edition 90 : 318.500/slop
Sampoerna prima : 151.300/slop
Sampoerna kretek 12's : 152.700/slop
Sampoerna splas tropical :308.500/slop
wismilak diplomat 12 ;252.000
wismilak mild ;255.400
wismilak filter bery mild ;255.800
wismilak filter lychee spark ; kosong 
wismilak kretek slim klik lychee tea ;kosong 
wismilak kretek slim klik bery ;kosong
wismilak kretek slim klik ice tea ;kosong 
3vo filter mild klik lychee 16 ;224.000
3vo filter mild klik bery tea 16 ;224.000
Alva kretek : 83.400/ctn
Juara kretek berry:151.600/slp
Juara kretek klik green grape:151.600/slp

🧼NON FOOD

Daia rcg : 55.200/ctn
Daia 5rban : 100.400/ctn
Rinso bubuk rcg : KOSONG/ctn
Rinso bubuk 5rban : 82.000/ctn
Rinso cair : 72.500
So klin bubuk 5rban : 104.000/ctn
So klin bubu rcg : 56.500 /ctn
So klin cair 22ml : 45.750/ctn
So klin liquid 43ml : 96.000/ctn
Gentlegen cair 6x80ml : KOSONGctn
Downy 10/8ml : kosongctn
Downy 20/24ml : 257.400/ctn
Molto 20/18ml : 186.000/ctn
Molto 10/9ml : 148.200/ctn

Pepsodent 75 gr : kosong /12 pcs
Pepsodent 120 gr : 102.600/12 pcs
Pepsodent 190 gr : 156.400/12 pcs
Close up 65 gr : 81.000/12 pcs
Ciptadent 75 gr : 219.500/ctn
Ciptadent 190ml : 247.300/ctn

Sunlight 635ml : 121.200/ctn
Sunlight 400ml : 88.200/ctn
Sunlight 370ml : 155.400/ctn
Sunlight 210ml : 102.600/ctn
Sunlight 90ml : 118.800/ctn
Mama jeruk nipis 105ml : kosong /ctn

Ekonomi 67g EL-350K : 50.000/ctn
Ekonomi 145g EL-500K : kosong
ekonomi liquid 650 ml 85.500/ctn
ekonomi liquid 90 ml 38.200/ctn
Wings sabun cream biru 154g : 52.750/ctn

Dettol : 417.800/ctn
Giv : 193.000/ctn
Harmony : 158.400/ctn
Lifebuoy : 559.000/ctn
Lifebuoy bandid : 424.700/ctn
Lifebuoy body wash pouch 90ml : 216.000/ctn
Lux : 568.800/ctn
Lux body wash pouch 90ml : 200.000/ctn
Nuvo : 193.000/ctn
Shinzu'i : 613.020/ctn

Clear shampoo : 345.900ctn
Dove shampoo : 331.200/ctn
Head & Shoulders shampoo : 343.700/ctn
Lifebuoy shampoo : 176.400/ctn
Pantene shampoo : 376.250/ctnz
Rejoice Shampoo : KOSONG/ctn
Sunsilk shampoo : 351.900/ctn
Tresemme shampoo : 391.000/ctn
Zinc shampoo : kosong/ctn
Emerohn shampo : 93.995/ctn
Rexona women/men : 284.000/ctn
Rexona women cerah & segar : 284.000/ctn
Fair & lovely : kosong/ctn
Glow & lovely : kosong/ctn
Selection Kapas : 790.000/ctn
Cap Gajah Kertas Nasi (isi 210) : 820.000/ctn
ABC baterai biru R6 4's : 66.000/box
Wipol rcg : 119.700/ctn
Proclin pemutih 12x25ml : KOSONG/ctn
Vanish 60 ml rcg : 188.400/ctn
Kispray gold 300ml : 106.000/ctn

Mamy Poko Size S rcg : 110.000/ctn
Mamy Poko Size M rcg : 122.000/ctn
Mamy Poko Size L rcg : 122.000/ctn
Mamy Poko Size XL rcg : 152.500/ctn
Mamy Poko Size XXL rcg : 178.000/ctn

Charm 10's Extra Maxi Wing 23cm : 25.800/3pcs
Charm 8/7's Extra Maxi Wing 23cm : 17.400/3pcs
Charm safe night 10/9's wing 29cm : 25.500/3pcs
Charm safe night 12's wing 35cm : KOSONG/3 pcs
Charm safe night 2's wing 35cm : 28.200/rcg
Charm 2's Extra Maxi Wing : 11.500/rcg
Charm Extra Maxi rcg : 3.900/rcg
Charm Comfort 2's Night Wing 28cm : kosong/rcg
`;

async function run() {
  console.log('🚀 Memulai parsing broadcast Indogrosir Kediri...');
  const parsed = parseSupplierPriceBroadcast(RAW_BROADCAST);
  console.log(`📦 Terdeteksi ${parsed.totalParsed} total item (${parsed.availableCount} tersedia, ${parsed.emptyCount} kosong).`);

  const { data: existingProducts, error: fetchErr } = await supabase
    .from('products')
    .select('id, name, sku, barcode, cost_price, price, raw_data');

  if (fetchErr) {
    console.error('Error fetching existing products:', fetchErr);
    process.exit(1);
  }

  const existingMap = new Map<string, any>();
  for (const p of existingProducts || []) {
    if (p.name) existingMap.set(p.name.trim().toUpperCase(), p);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let emptyCount = 0;
  const now = new Date().toISOString();

  for (const item of parsed.items) {
    if (item.isKosong) {
      emptyCount++;
      continue;
    }

    const nameUpper = item.name.trim().toUpperCase();
    const existing = existingMap.get(nameUpper);

    if (existing) {
      // Update acuan harga supplier di produk yang sudah ada
      const raw = existing.raw_data && typeof existing.raw_data === 'object' ? { ...existing.raw_data } : {};
      raw.lastSupplierPrice = item.price;
      raw.lastSupplierName = parsed.supplierName;
      raw.lastSupplierDate = parsed.periodDate;
      raw.lastSupplierUnit = item.unit;

      await supabase
        .from('products')
        .update({
          raw_data: raw,
          updated_at: now,
        })
        .eq('id', existing.id);

      updatedCount++;
    } else {
      // Buat Draft Produk Baru
      const id = `prod_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const sku = `DRAFT-${randomCode}`;
      const unit = (item.unit || 'CTN').toUpperCase();
      const marginPct = 15;
      const suggestedPrice = Math.round(item.price * (1 + marginPct / 100));

      const rawData = {
        ID: sku,
        Nama: nameUpper,
        Kategori: item.category,
        Satuan: unit,
        Stok: 0,
        Modal: item.price,
        purchasePrice: item.price,
        Ecer: suggestedPrice,
        price: suggestedPrice,
        costPrice: item.price,
        Supplier: parsed.supplierName,
        supplierPriceDate: parsed.periodDate,
        Status: 0, // Legacy draft/non-aktif
        isActive: false,
        status: 'DRAFT',
        importedFromBroadcast: true,
        units: [
          {
            code: unit,
            contains: 1,
            price: suggestedPrice,
            costPrice: item.price,
            label: unit,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const { error: insErr } = await supabase.from('products').insert({
        id,
        sku,
        name: nameUpper,
        category: item.category,
        unit,
        price: suggestedPrice,
        cost_price: item.price,
        stock: 0,
        is_active: false, // DRAFT: Tidak muncul di kasir / publik
        raw_data: rawData,
        created_at: now,
        updated_at: now,
      });

      if (insErr) {
        console.error(`Gagal insert ${nameUpper}:`, insErr.message);
      } else {
        createdCount++;
        // Tambahkan ke map lokal agar tidak ada duplikasi jika ada baris ganda
        existingMap.set(nameUpper, { id, name: nameUpper });
      }
    }
  }

  console.log(`\n🎉 SELESAI IMPORT!`);
  console.log(`✨ Draft Produk Baru Dibuat: ${createdCount}`);
  console.log(`🔄 Acuan Harga Terupdate: ${updatedCount}`);
  console.log(`⚪ Item Kosong Dilewati: ${emptyCount}`);
}

run().catch((e) => {
  console.error('Fatal error in script:', e);
  process.exit(1);
});
