// add-customers.js
const admin = require('firebase-admin');

// 👉 Ganti dengan path ke file service account Anda
const serviceAccount = 
require('./atayatoko2-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'atayatoko2'
});

const db = admin.firestore();

async function addSampleCustomers() {
  console.log('Menambahkan contoh pelanggan ke Firestore...');

  const customers = [
    {
      name: "Toko Sembako Jaya",
      phone: "081234567890",
      email: "jayasembako@gmail.com",
      address: "Jl. Merdeka No. 45, Kediri",
      type: "grosir",
      creditLimit: 10000000,
      notes: "Pelanggan grosir tetap, pembayaran tempo 7 hari",
      createdAt: new Date('2025-06-01T08:00:00Z').toISOString()
    },
    {
      name: "Warung Bu Siti",
      phone: "082198765432",
      email: "sitiwarung@yahoo.com",
      address: "Dusun Krajan, Desa Sukorejo",
      type: "ecer",
      creditLimit: 500000,
      notes: "Langganan harian, bayar tunai",
      createdAt: new Date('2025-06-03T10:30:00Z').toISOString()
    },
    {
      name: "Minimarket Sejahtera",
      phone: "085712345678",
      email: "sejahtera.mini@gmail.com",
      address: "Jl. Ahmad Yani No. 12, Kediri",
      type: "grosir",
      creditLimit: 7500000,
      notes: "Order setiap Senin & Kamis",
      createdAt: new Date('2025-06-05T14:15:00Z').toISOString()
    },
    {
      name: "Pak Budi - Pedagang Keliling",
      phone: "087887654321",
      email: "",
      address: "Ngadirejo, Kediri",
      type: "ecer",
      creditLimit: 0,
      notes: "Bayar tunai, beli grosir kecil",
      createdAt: new Date('2025-06-07T09:45:00Z').toISOString()
    },
    {
      name: "Koperasi Pegawai Negeri",
      phone: "081345678901",
      email: "koppegawan@gmail.com",
      address: "Komplek Perkantoran Pemda, Kediri",
      type: "grosir",
      creditLimit: 15000000,
      notes: "Pembayaran via transfer bank, invoice resmi",
      createdAt: new Date('2025-06-10T11:20:00Z').toISOString()
    }
  ];

  try {
    for (const customer of customers) {
      await db.collection('customers').add(customer);
    }
    console.log('✅ Berhasil menambahkan', customers.length, 
'pelanggan contoh!');
  } catch (error) {
    console.error('❌ Gagal menambahkan pelanggan:', error);
  }
}

addSampleCustomers();
