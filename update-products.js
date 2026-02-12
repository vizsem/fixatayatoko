/* eslint-disable @typescript-eslint/no-require-imports */
const admin = require('firebase-admin');

// 1. Inisialisasi - Pastikan file JSON ada di folder yang sama!
const serviceAccount = require('./atayatoko2-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'atayatoko2'
});

const db = admin.firestore();

async function safeUpdateProducts() {
  console.log('🚀 Memulai sinkronisasi field (Tanpa menghapus data lama)...');

  try {
    const productsSnapshot = await db.collection('products').get();
    const batch = db.batch();

    productsSnapshot.docs.forEach((doc) => {
      const p = doc.data();
      const docRef = db.collection('products').doc(doc.id);

      // Logika khusus untuk barcode Pop Ice sesuai permintaan Anda
      let finalBarcode = p.barcode || p.Barcode || "";
      if (doc.id === "00svHwNozsoP6kH4QjqK" || p.name === "Pop Ice renteng isi 10 pcs aneka macam pilihan rasa") {
        finalBarcode = "BR014";
      }

      // 2. Tambahkan Field Baru (Bahasa Indonesia) untuk Export
      // Kita tetap mengambil data dari field lama (p.name, p.price, dll)
      const syncData = {
        ID: p.id || doc.id,
        Barcode: finalBarcode,
        Parent_ID: p.Parent_ID || p.parentId || "",
        Nama: p.name || p.Nama || "",
        Kategori: p.category || p.Kategori || "snack",
        Satuan: p.unit || p.Satuan || "pcs",
        Stok: Number(p.stock ?? p.Stok ?? 0),
        Min_Stok: Number(p.Min_Stok || p.minStock || 5),
        Modal: Number(p.purchasePrice || p.Modal || 0),
        Ecer: Number(p.price || p.Ecer || 0),
        Grosir: Number(p.wholesalePrice || p.Grosir || 0),
        Min_Grosir: Number(p.minWholesaleQty || p.Min_Grosir || 1),
        Link_Foto: p.image || p.Link_Foto || "",
        Deskripsi: p.description || p.Deskripsi || "",
        Expired: p.expiredDate || p.Expired || "",
        Status: p.Status ?? 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // 3. Gunakan { merge: true } agar field lama (name, price, stock) TIDAK TERHAPUS
      batch.set(docRef, syncData, { merge: true });
      console.log(`✅ Sinkron Berhasil: ${syncData.Nama}`);
    });

    await batch.commit();
    console.log('\n✨ Selesai! Field Indonesia sudah ditambahkan.');
    console.log('Sekarang fitur Export Anda akan terbaca lengkap.');

  } catch (error) {
    console.error('❌ Terjadi kesalahan:', error);
  }
}

safeUpdateProducts();