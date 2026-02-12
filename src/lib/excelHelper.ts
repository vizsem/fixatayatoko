import * as XLSX from 'xlsx';
import { db } from "@/lib/firebase";
import { doc, writeBatch, serverTimestamp, collection, getDocs } from "firebase/firestore";

/**
 * Fungsi untuk mengimpor data dari file Excel (.xlsx atau .xls) ke Firestore
 * @param file File Excel dari input type="file"
 */
export const importFromExcel = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Ambil sheet pertama
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Ubah sheet menjadi array JSON
        const excelData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

        if (excelData.length === 0) {
          return reject("File Excel kosong atau format tidak sesuai.");
        }

        const batch = writeBatch(db);

        excelData.forEach((item) => {
          // Validasi: Wajib ada ID produk
          if (!item.ID) return;

          // Referensi dokumen berdasarkan ID dari Excel
          const docRef = doc(db, "products", String(item.ID));

          // Format data agar sesuai tipe data Firestore (terutama angka)
          // MAPPING: Excel (Indonesian) -> Firestore (English Standard)
          const formattedData = {
            ID: String(item.ID),
            barcode: String(item.Barcode || ""),
            Parent_ID: String(item.Parent_ID || ""),
            
            // Primary Fields (English)
            name: String(item.Nama || ""),
            category: String(item.Kategori || ""),
            unit: String(item.Satuan || ""),
            stock: Number(item.Stok) || 0,
            price: Number(item.Ecer) || 0,
            wholesalePrice: Number(item.Grosir) || 0,
            minWholesale: Number(item.Min_Grosir) || 0,
            purchasePrice: Number(item.Modal) || 0,
            minStock: Number(item.Min_Stok) || 0,
            image: String(item.Link_Foto || ""),
            description: String(item.Deskripsi || ""),
            
            // Keep Legacy Keys for backup (optional)
            Nama: String(item.Nama || ""),
            Stok: Number(item.Stok) || 0,
            Ecer: Number(item.Ecer) || 0,

            Harga_Coret: Number(item.Harga_Coret) || 0,
            Status: Number(item.Status) || 1,
            Supplier: String(item.Supplier || ""),
            No_WA_Supplier: String(item.No_WA_Supplier || ""),
            updatedAt: serverTimestamp(),
          };

          // Gunakan set dengan merge agar tidak menghapus field lain jika ada
          batch.set(docRef, formattedData, { merge: true });
        });

        await batch.commit();
        resolve("Berhasil mengimpor " + excelData.length + " produk.");
      } catch (error) {
        console.error("Excel Import Error:", error);
        reject("Gagal memproses file Excel.");
      }
    };

    reader.onerror = () => reject("Gagal membaca file.");
    reader.readAsBinaryString(file);
  });
};

/**
 * Fungsi untuk mengekspor data dari Firestore ke file Excel (.xlsx)
 */
export const exportToExcel = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Hapus field timestamp agar tidak error saat dikonversi ke Excel
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { updatedAt, createdAt, ...rest } = data;
      return rest;
    });

    if (products.length === 0) {
      alert("Tidak ada data produk untuk diekspor.");
      return;
    }

    // Buat sheet baru
    const worksheet = XLSX.utils.json_to_sheet(products);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Produk");

    // Download file ke browser pelanggan
    XLSX.writeFile(workbook, `AtayaToko_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (error) {
    console.error("Excel Export Error:", error);
    alert("Gagal mengambil data dari database.");
  }
};