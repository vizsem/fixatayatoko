// setup-purchases.js
/* eslint-disable @typescript-eslint/no-require-imports */
const admin = require('firebase-admin');

// Ganti dengan path file service account Anda
const serviceAccount = require('./atayatoko2-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'atayatoko2'
});

const db = admin.firestore();

async function setupPurchasesStructure() {
  console.log('Membuat struktur Firestore untuk Manajemen Pembelian...');

  try {
    // 1. Buat koleksi purchases dengan dokumen contoh
    await db.collection('purchases').add({
      supplierId: 'sup1',
      supplierName: 'PT. Sembako Jaya',
      items: [
        {
          id: 'BR001',
          name: 'Beras Premium 5kg',
          purchasePrice: 50000,
          quantity: 50,
          unit: '5kg'
        },
        {
          id: 'MG002',
          name: 'Minyak Goreng 2L',
          purchasePrice: 25000,
          quantity: 30,
          unit: '2L'
        }
      ],
      subtotal: 3250000,
      shippingCost: 0,
      total: 3250000,
      paymentMethod: 'CASH',
      paymentStatus: 'LUNAS',
      status: 'DITERIMA',
      warehouseId: 'gudang-utama',
      warehouseName: 'Gudang Utama',
      notes: 'Pembelian perdana untuk stok awal',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Koleksi purchases berhasil dibuat');

    // 2. Pastikan koleksi products memiliki field purchasePrice
    const productsSnapshot = await db.collection('products').get();
    for (const doc of productsSnapshot.docs) {
      const data = doc.data();
      if (data.purchasePrice === undefined) {
        // Set harga beli default 80% dari harga jual
        const purchasePrice = Math.round((data.price || 0) * 0.8);
        await doc.ref.update({ purchasePrice });
        console.log(`✅ Produk ${data.name} diperbarui dengan harga beli: Rp${purchasePrice.toLocaleString('id-ID')}`);
      }
    }

    // 3. Pastikan koleksi suppliers ada
    const suppliersSnapshot = await db.collection('suppliers').get();
    if (suppliersSnapshot.empty) {
      await db.collection('suppliers').add({
        name: 'PT. Sembako Jaya',
        contactPerson: 'Budi Santoso',
        phone: '081234567890',
        email: 'budi@sembakojaya.com',
        address: 'Jl. Industri No. 45, Surabaya',
        category: 'Beras, Minyak, Gula',
        notes: 'Supplier utama sejak 2023',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Koleksi suppliers diinisialisasi');
    }

    // 4. Pastikan koleksi warehouses ada
    const warehousesSnapshot = await db.collection('warehouses').get();
    if (warehousesSnapshot.empty) {
      await db.collection('warehouses').doc('gudang-utama').set({
        name: 'Gudang Utama',
        location: 'Jl. Pandan 98, Semen, Kediri',
        capacity: 10000,
        usedCapacity: 0,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Koleksi warehouses diinisialisasi');
    }

    console.log('\n✅ Struktur Firestore untuk Manajemen Pembelian berhasil dibuat!');
    console.log('✅ Field purchasePrice ditambahkan ke semua produk');
    console.log('✅ Koleksi purchases, suppliers, dan warehouses siap digunakan');

  } catch (error) {
    console.error('❌ Gagal membuat struktur:', error);
  }
}

setupPurchasesStructure();