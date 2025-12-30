// update-products.js
const admin = require('firebase-admin');

// Ganti dengan path file service account Anda
const serviceAccount = require('./atayatoko2-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'atayatoko2'
});

const db = admin.firestore();

async function updateProductsWithBarcode() {
  console.log('Memperbarui produk dengan barcode dan harga beli...');

  // Mapping produk dengan barcode & harga beli
  const productUpdates = [
    {
      name: "Beras Premium 5kg",
      barcode: "BR001",
      purchasePrice: 50000
    },
    {
      name: "Minyak Goreng 2L",
      barcode: "MG002",
      purchasePrice: 25000
    },
    {
      name: "Gula Pasir 1kg",
      barcode: "GP003",
      purchasePrice: 14000
    },
    {
      name: "Mie Instan 40pcs",
      barcode: "MI004",
      purchasePrice: 1500
    },
    {
      name: "Sabun Mandi 120gr",
      barcode: "SM005",
      purchasePrice: 4800
    },
    {
      name: "Tepung Terigu 1kg",
      barcode: "TT006",
      purchasePrice: 9500
    },
    {
      name: "Kopi Sachet 20pcs",
      barcode: "KS007",
      purchasePrice: 12000
    },
    {
      name: "Popok Bayi XL 30pcs",
      barcode: "PB008",
      purchasePrice: 70000
    },
    {
      name: "Tisu Basah 80pcs",
      barcode: "TB009",
      purchasePrice: 8500
    },
    {
      name: "Susu Bubuk 800gr",
      barcode: "SB010",
      purchasePrice: 95000
    }
  ];

  try {
    // Ambil semua produk
    const productsSnapshot = await db.collection('products').get();
    
    for (const doc of productsSnapshot.docs) {
      const product = doc.data();
      const productName = product.name;
      
      // Cari mapping berdasarkan nama
      const updateData = productUpdates.find(p => p.name === productName);
      
      if (updateData) {
        // Update barcode & harga beli
        await doc.ref.update({
          barcode: updateData.barcode,
          purchasePrice: updateData.purchasePrice
        });
        console.log(`✅ ${productName} → ${updateData.barcode} | Rp${updateData.purchasePrice.toLocaleString('id-ID')}`);
      } else {
        // Jika produk tidak ada di mapping, generate barcode otomatis
        const autoBarcode = `AUTO${Date.now().toString().slice(-6)}`;
        await doc.ref.update({
          barcode: autoBarcode,
          purchasePrice: product.price * 0.8 // Asumsi harga beli 80% harga jual
        });
        console.log(`⚠️  ${productName} → ${autoBarcode} | Generated`);
      }
    }
    
    console.log('\n✅ Semua produk berhasil diperbarui!');
    console.log('✅ Barcode unik ditambahkan untuk menghindari duplikasi');
    console.log('✅ Harga beli ditambahkan untuk perhitungan profit');
  } catch (error) {
    console.error('❌ Gagal memperbarui produk:', error);
  }
}

updateProductsWithBarcode();