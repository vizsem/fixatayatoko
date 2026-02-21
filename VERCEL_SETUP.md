# Panduan Setup Vercel untuk Firebase Admin

Aplikasi ini menggunakan **Firebase Admin SDK** untuk fungsi server-side (seperti Checkout dan API Orders). Agar fungsi ini berjalan di Vercel, Anda **WAJIB** menambahkan Environment Variables.

## 1. Dapatkan Kredensial Firebase
1. Buka [Firebase Console](https://console.firebase.google.com/).
2. Pilih project Anda.
3. Masuk ke **Project settings** (ikon gir) > **Service accounts**.
4. Klik **Generate new private key**.
5. File JSON akan terdownload. Buka file tersebut dengan text editor.

## 2. Masukkan ke Vercel
1. Buka Dashboard Vercel project Anda.
2. Masuk ke **Settings** > **Environment Variables**.
3. Tambahkan variabel berikut (ambil nilainya dari file JSON tadi):

| Nama Variabel (Key) | Isi (Value) dari JSON | Contoh Value |
|---------------------|-----------------------|--------------|
| `FIREBASE_PROJECT_ID` | `project_id` | `toko-saya-123` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` | `firebase-adminsdk-xxx@toko-saya.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | `private_key` | `-----BEGIN PRIVATE KEY-----\nMIIEv...` (Copy SEMUANYA termasuk header/footer) |

> **PENTING:** Untuk `FIREBASE_PRIVATE_KEY`, copy seluruh isi string private key termasuk `-----BEGIN PRIVATE KEY-----` dan `\n`. Jangan khawatir tentang baris baru, paste saja apa adanya.

## 3. Redeploy
Setelah menambahkan variabel, Anda harus melakukan **Redeploy** agar perubahan diterapkan:
1. Masuk ke tab **Deployments** di Vercel.
2. Klik titik tiga (⋮) pada deployment terbaru (atau yang gagal).
3. Pilih **Redeploy**.

---

## Troubleshooting Error Umum

### "Unable to detect a Project Id"
Artinya `FIREBASE_PROJECT_ID` belum di-set atau salah.

### "Firebase Admin credentials not fully provided"
Artinya salah satu dari 3 variabel di atas hilang.

### Build Error "ERESOLVE could not resolve"
Sudah diperbaiki dengan file `.npmrc`. Pastikan Anda redeploy versi terbaru dari git.
