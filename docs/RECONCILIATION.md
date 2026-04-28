# Rekonsiliasi Stok (Stock Reconciliation)

## 📋 Deskripsi

Halaman **Rekonsiliasi Stok** adalah fitur untuk mencocokkan stok yang tercatat di sistem dengan stok fisik yang sebenarnya ada di gudang. Fitur ini membantu administrator untuk:

- Mendeteksi perbedaan antara stok sistem dan stok fisik
- Menyesuaikan stok secara akurat dengan audit trail lengkap
- Mengekspor laporan rekonsiliasi dalam format CSV
- Mencatat selisih stok ke dalam ledger akuntansi

## 🚀 Akses

URL: `/admin/inventory/reconciliation`

Akses melalui menu Inventory → Klik card "Rec" (Reconciliation)

## ✨ Fitur Utama

### 1. **Statistik Real-time**
Menampilkan ringkasan status stok:
- **Total Produk**: Jumlah semua produk
- **Cocok**: Produk yang stoknya sesuai
- **Surplus**: Produk dengan stok fisik lebih banyak dari sistem
- **Defisit**: Produk dengan stok fisik lebih sedikit dari sistem
- **Perlu Aksi**: Total produk yang perlu direkonsiliasi

### 2. **Filter & Pencarian**
- **Search**: Cari berdasarkan SKU atau nama produk
- **Status Filter**: Filter berdasarkan status (Semua/Cocok/Tidak Cocok)
- **Warehouse Selection**: Pilih gudang target untuk penyesuaian stok

### 3. **Tabel Rekonsiliasi**
Menampilkan daftar produk dengan kolom:
- Informasi produk (nama, SKU)
- Stok Sistem (dari database)
- Stok Fisik (input manual oleh admin)
- Selisih (otomatis dihitung)
- Status badge (COCOK/SURPLUS/DEFISIT)

### 4. **Aksi Rekonsiliasi**
- **Reset Semua**: Mengembalikan semua stok fisik sama dengan stok sistem
- **Export CSV**: Unduh laporan perbedaan stok
- **Rekonsiliasi Sekarang**: Jalankan penyesuaian stok dengan konfirmasi

## 🔄 Cara Kerja

1. **Input Stok Fisik**
   - Admin memasukkan jumlah stok fisik yang sebenarnya untuk setiap produk
   - Sistem otomatis menghitung selisih dan menampilkan status

2. **Review Perbedaan**
   - Lihat statistik untuk memahami skala perbedaan
   - Gunakan filter untuk fokus pada produk yang bermasalah
   - Tambahkan catatan rekonsiliasi (opsional)

3. **Eksekusi Rekonsiliasi**
   - Klik "Rekonsiliasi Sekarang" setelah verifikasi
   - Sistem akan:
     - Menyesuaikan stok di warehouse yang dipilih
     - Mencatat transaksi ke inventory log
     - Membuat jurnal akuntansi untuk selisih nilai
     - Menampilkan notifikasi sukses

## 📊 Contoh Penggunaan

### Skenario 1: Stock Opname Rutin
```
1. Hitung semua stok fisik di gudang
2. Input jumlah fisik di halaman reconciliation
3. Sistem menunjukkan 5 produk surplus, 3 produk defisit
4. Review dan klik "Rekonsiliasi Sekarang"
5. Stok sistem disesuaikan dengan fisik
```

### Skenario 2: Investigasi Kehilangan Barang
```
1. Filter status "Tidak Cocok"
2. Lihat produk dengan status DEFISIT
3. Export CSV untuk laporan investigasi
4. Setelah investigasi selesai, lakukan rekonsiliasi
```

## 🔐 Keamanan & Audit

- **Authorization**: Hanya user dengan role `admin` yang dapat akses
- **Transaction Safety**: Menggunakan Firebase transaction untuk data consistency
- **Audit Trail**: Semua perubahan tercatat di:
  - Inventory logs (source: RECONCILIATION)
  - Ledger journal (LossOnInventory / GainOnInventory)
- **Confirmation**: Memerlukan konfirmasi sebelum eksekusi

## 📝 Catatan Teknis

### Database Updates
```typescript
// Adjust stock in selected warehouse
await adjustStockTx(tx, {
  productId: item.product.id,
  newStock: newWarehouseStock,
  warehouseId: selectedWarehouse,
  adminId: currentUser.uid,
  source: 'RECONCILIATION',
  note: reconciliationNote
});

// Post to ledger for accounting
if (totalDiff !== 0) {
  await postJournal({
    debitAccount: 'LossOnInventory' | 'Inventory',
    creditAccount: 'Inventory' | 'GainOnInventory',
    amount: diffValue,
    memo: `Rekonsiliasi...`,
    referenceId: `RECON-${timestamp}-${productId}`,
    postedBy: adminId
  });
}
```

### Export Format
CSV dengan kolom:
```
SKU,Nama Produk,Stok Sistem,Stok Fisik,Selisih,Status
SKU001,"Produk A",100,95,-5,DEFISIT
SKU002,"Produk B",50,55,+5,SURPLUS
```

## 🎯 Best Practices

1. **Lakukan Rekonsiliasi Rutin**: Minimal sebulan sekali atau setelah stock opname
2. **Verifikasi Sebelum Eksekusi**: Pastikan stok fisik sudah dihitung dengan benar
3. **Tambahkan Catatan**: Selalu isi catatan rekonsiliasi untuk audit trail
4. **Export Laporan**: Simpan CSV sebagai backup sebelum melakukan rekonsiliasi
5. **Monitor Selisih Besar**: Investigasi jika ada selisih yang tidak wajar

## 🐛 Troubleshooting

**Masalah**: Tidak bisa mengubah stok fisik
- **Solusi**: Pastikan produk sudah dimuat (tidak dalam loading state)

**Masalah**: Error saat rekonsiliasi
- **Solusi**: Cek koneksi internet dan pastikan user masih login sebagai admin

**Masalah**: Stok menjadi negatif
- **Solusi**: Sistem otomatis clamp ke 0, tapi periksa kembali input stok fisik

## 📚 Related Pages

- [Stock Opname](/admin/inventory/opname) - Penyesuaian stok per produk
- [Inventory History](/admin/inventory/history) - Log semua perubahan stok
- [Inventory Transfer](/admin/inventory/transfer) - Transfer stok antar gudang
