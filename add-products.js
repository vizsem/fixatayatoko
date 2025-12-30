// add-products.js
const admin = require('firebase-admin');

// 👉 Ganti dengan path ke file service account Anda
const serviceAccount = require('./atayatoko2-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'atayatoko2'
});

const db = admin.firestore();

async function addSampleProducts() {
  console.log('Menambahkan contoh produk ke Firestore...');

  const products = [
    {
      name: "Beras Premium 5kg",
      price: 65000,
      wholesalePrice: 60000,
      stock: 150,
      stockByWarehouse: {
        "gudang-utama": 100,
        "toko-depan": 50
      },
      category: "Beras & Tepung",
      unit: "5kg",
      barcode: "BR001",
      image: "https://placehold.co/400x400/f59e0b/ffffff?text=Beras+5kg",
      expiredDate: "2026-12-31",
      createdAt: new Date('2025-06-01T08:00:00Z').toISOString()
    },
    {
      name: "Minyak Goreng 2L",
      price: 32000,
      wholesalePrice: 28000,
      stock: 85,
      stockByWarehouse: {
        "gudang-utama": 60,
        "toko-depan": 25
      },
      category: "Minyak & Gula",
      unit: "2L",
      barcode: "MG002",
      image: "https://placehold.co/400x400/ef4444/ffffff?text=Minyak+2L",
      expiredDate: "2026-10-15",
      createdAt: new Date('2025-06-01T08:05:00Z').toISOString()
    },
    {
      name: "Gula Pasir 1kg",
      price: 18000,
      wholesalePrice: 16000,
      stock: 200,
      stockByWarehouse: {
        "gudang-utama": 150,
        "toko-depan": 50
      },
      category: "Minyak & Gula",
      unit: "1kg",
      barcode: "GP003",
      image: "https://placehold.co/400x400/f97316/ffffff?text=Gula+1kg",
      expiredDate: "2027-01-20",
      createdAt: new Date('2025-06-01T08:10:00Z').toISOString()
    },
    {
      name: "Mie Instan 40pcs",
      price: 2000,
      wholesalePrice: 1800,
      stock: 500,
      stockByWarehouse: {
        "gudang-utama": 400,
        "toko-depan": 100
      },
      category: "Mie & Sereal",
      unit: "pcs",
      barcode: "MI004",
      image: "https://placehold.co/400x400/8b5cf6/ffffff?text=Mie+Instan",
      expiredDate: "2026-08-30",
      createdAt: new Date('2025-06-01T08:15:00Z').toISOString()
    },
    {
      name: "Sabun Mandi 120gr",
      price: 6000,
      wholesalePrice: 5500,
      stock: 250,
      stockByWarehouse: {
        "gudang-utama": 200,
        "toko-depan": 50
      },
      category: "Perlengkapan Mandi",
      unit: "pcs",
      barcode: "SM005",
      image: "https://placehold.co/400x400/ec4899/ffffff?text=Sabun",
      expiredDate: "2027-03-10",
      createdAt: new Date('2025-06-01T08:20:00Z').toISOString()
    },
    {
      name: "Tepung Terigu 1kg",
      price: 12000,
      wholesalePrice: 11000,
      stock: 180,
      stockByWarehouse: {
        "gudang-utama": 130,
        "toko-depan": 50
      },
      category: "Beras & Tepung",
      unit: "1kg",
      barcode: "TT006",
      image: "https://placehold.co/400x400/3b82f6/ffffff?text=Tepung+1kg",
      expiredDate: "2026-11-05",
      createdAt: new Date('2025-06-01T08:25:00Z').toISOString()
    },
    {
      name: "Kopi Sachet 20pcs",
      price: 15000,
      wholesalePrice: 13500,
      stock: 300,
      stockByWarehouse: {
        "gudang-utama": 250,
        "toko-depan": 50
      },
      category: "Minuman",
      unit: "20pcs",
      barcode: "KS007",
      image: "https://placehold.co/400x400/6366f1/ffffff?text=Kopi+Sachet",
      expiredDate: "2026-09-20",
      createdAt: new Date('2025-06-01T08:30:00Z').toISOString()
    },
    {
      name: "Popok Bayi XL 30pcs",
      price: 85000,
      wholesalePrice: 78000,
      stock: 120,
      stockByWarehouse: {
        "gudang-utama": 100,
        "toko-depan": 20
      },
      category: "Perlengkapan Bayi",
      unit: "30pcs",
      barcode: "PB008",
      image: "https://placehold.co/400x400/10b981/ffffff?text=Popok+Bayi",
      expiredDate: "2027-05-15",
      createdAt: new Date('2025-06-01T08:35:00Z').toISOString()
    },
    {
      name: "Tisu Basah 80pcs",
      price: 10000,
      wholesalePrice: 9000,
      stock: 200,
      stockByWarehouse: {
        "gudang-utama": 150,
        "toko-depan": 50
      },
      category: "Perlengkapan Mandi",
      unit: "80pcs",
      barcode: "TB009",
      image: "https://placehold.co/400x400/f59e0b/ffffff?text=Tisu+Basah",
      expiredDate: "2026-07-25",
      createdAt: new Date('2025-06-01T08:40:00Z').toISOString()
    },
    {
      name: "Susu Bubuk 800gr",
      price: 120000,
      wholesalePrice: 110000,
      stock: 80,
      stockByWarehouse: {
        "gudang-utama": 60,
        "toko-depan": 20
      },
      category: "Minuman",
      unit: "800gr",
      barcode: "SB010",
      image: "https://placehold.co/400x400/8b5cf6/ffffff?text=Susu+Bubuk",
      expiredDate: "2026-04-10",
      createdAt: new Date('2025-06-01T08:45:00Z').toISOString()
    }
  ];

  try {
    for (const product of products) {
      await db.collection('products').add(product);
    }
    console.log('✅ Berhasil menambahkan', products.length, 'produk contoh!');
  } catch (error) {
    console.error('❌ Gagal menambahkan produk:', error);
  }
}

addSampleProducts();