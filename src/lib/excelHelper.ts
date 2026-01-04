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
        const excelData: any[] = XLSX.utils.sheet_to_json(worksheet);

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
          const formattedData = {
            ID: String(item.ID),
            Barcode: String(item.Barcode || ""),
            Parent_ID: String(item.Parent_ID || ""),
            Nama: String(item.Nama || ""),
            Kategori: String(item.Kategori || ""),
            Satuan: String(item.Satuan || ""),
            Stok: Number(item.Stok) || 0,
            Min_Stok: Number(item.Min_Stok) || 0,
            Modal: Number(item.Modal) || 0,
            Ecer: Number(item.Ecer) || 0,
            Harga_Coret: Number(item.Harga_Coret) || 0,
            Grosir: Number(item.Grosir) || 0,
            Min_Grosir: Number(item.Min_Grosir) || 0,
            Link_Foto: String(item.Link_Foto || ""),
            Deskripsi: String(item.Deskripsi || ""),
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