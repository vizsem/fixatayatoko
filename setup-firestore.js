// setup-firestore.js
const admin = require('firebase-admin');

// Ganti dengan path ke service account key Anda
const serviceAccount = require('./atayatoko2-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'atayatoko2'
});

const db = admin.firestore();

async function setupFirestore() {
  console.log('🚀 Memulai setup Firestore untuk ATAYATOKO2...');

  // 1. Buat gudang contoh
  await db.collection('warehouses').doc('gudang-utama').set({
    name: 'Gudang Utama',
    location: 'Jl. Pandan 98, Semen, Kediri',
    capacity: 10000,
    usedCapacity: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.collection('warehouses').doc('toko-depan').set({
    name: 'Toko Depan',
    location: 'Lokasi Toko Utama',
    capacity: 2000,
    usedCapacity: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Buat supplier contoh
  await db.collection('suppliers').doc('sup1').set({
    name: 'PT. Sembako Jaya',
    contactPerson: 'Budi Santoso',
    phone: '081234567890',
    email: 'budi@sembakojaya.com',
    address: 'Jl. Industri No. 45, Surabaya',
    category: 'Beras, Minyak, Gula',
    notes: 'Supplier utama sejak 2023',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 3. Buat produk contoh
  const products = [
    { name: "Beras Premium 5kg", price: 65000, wholesalePrice: 60000, unit: "5kg", category: "Beras & Tepung", barcode: "BR001" },
    { name: "Minyak Goreng 2L", price: 32000, wholesalePrice: 28000, unit: "2L", category: "Minyak & Gula", barcode: "MG002" },
    { name: "Gula Pasir 1kg", price: 18000, wholesalePrice: 16000, unit: "1kg", category: "Minyak & Gula", barcode: "GP003" },
    { name: "Mie Instan 40pcs", price: 2000, wholesalePrice: 1800, unit: "pcs", category: "Mie & Sereal", barcode: "MI004" },
    { name: "Sabun Mandi 120gr", price: 6000, wholesalePrice: 5500, unit: "pcs", category: "Perlengkapan Mandi", barcode: "SM005" }
  ];

  for (const product of products) {
    await db.collection('products').add({
      ...product,
      stock: 100,
      stockByWarehouse: {
        'gudang-utama': 80,
        'toko-depan': 20
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 4. Buat promosi contoh
  await db.collection('promotions').add({
    name: "Promo Awal Tahun",
    type: "category",
    discountType: "percentage",
    discountValue: 10,
    targetId: "Beras & Tepung",
    startDate: "2025-01-01",
    endDate: "2025-01-31",
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 5. Buat user admin (GANTI DENGAN UID ANDA JIKA PERLU)
  const adminUid = "pLuB0LpYRAd2h19wCmvmCyS46HK2";
  if (adminUid && adminUid !== "pLuB0LpYRAd2h19wCmvmCyS46HK2") {
    await db.collection('users').doc(adminUid).set({
      name: "Admin ATAYATOKO",
      email: "admin@atayatoko.com",
      role: "admin",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  console.log('✅ Setup Firestore berhasil!');
}

setupFirestore().catch(console.error);