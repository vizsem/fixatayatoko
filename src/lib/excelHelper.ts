import { supabase } from '@/lib/supabase';
import { exportToExcel as utilsExportToExcel, readExcelFile } from '@/lib/xlsx-utils';

/**
 * Fungsi untuk mengimpor data dari file Excel (.xlsx atau .xls) ke Supabase
 * @param file File Excel dari input type="file"
 */
export const importFromExcel = async (file: File): Promise<string> => {
  try {
    const excelData = await readExcelFile(file);

    if (excelData.length === 0) {
      throw new Error("File Excel kosong atau format tidak sesuai.");
    }

    const rows = excelData
      .filter((item: any) => item.ID)
      .map((item: any) => ({
        id: String(item.ID),
        barcode: String(item.Barcode || ""),
        Parent_ID: String(item.Parent_ID || ""),
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
        Nama: String(item.Nama || ""),
        Stok: Number(item.Stok) || 0,
        Ecer: Number(item.Ecer) || 0,
        Harga_Coret: Number(item.Harga_Coret) || 0,
        Status: Number(item.Status) || 1,
        Supplier: String(item.Supplier || ""),
        No_WA_Supplier: String(item.No_WA_Supplier || ""),
      }));

    const { error } = await supabase
      .from('products')
      .upsert(rows, { onConflict: 'id' });

    if (error) throw error;
    return "Berhasil mengimpor " + rows.length + " produk.";
  } catch (error) {
    console.error("Excel Import Error:", error);
    throw new Error("Gagal memproses file Excel.");
  }
};

/**
 * Fungsi untuk mengekspor data dari Supabase ke file Excel (.xlsx)
 */
export const exportToExcel = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) throw error;

    const products = (data || []).map(({ created_at, updated_at, ...rest }: any) => rest);

    if (products.length === 0) {
      console.warn("Tidak ada data produk untuk diekspor.");
      return;
    }

    await utilsExportToExcel(products, `AtayaToko_Export_${new Date().toISOString().split('T')[0]}`, 'Data_Produk');
  } catch (error) {
    console.error("Excel Export Error:", error);
    throw new Error("Gagal mengambil data dari database.");
  }
};
