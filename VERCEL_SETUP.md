# Panduan Setup Environment Variables di Vercel

Agar aplikasi berjalan sempurna (Login, Checkout, Notifikasi), Anda wajib mengisi Environment Variables berikut di Vercel.

## 1. Buka Vercel Dashboard
1. Masuk ke project Anda di Vercel.
2. Klik tab **Settings** -> **Environment Variables**.

## 2. Masukkan Variabel Berikut

### A. Firebase Admin (Server-Side) - WAJIB UNTUK CHECKOUT
*Ambil dari file JSON Service Account yang Anda download.*
(Jika hilang, buat baru di: Firebase Console -> Project Settings -> Service Accounts -> Generate New Private Key)

| Key | Value (Contoh) |
|-----|----------------|
| `FIREBASE_PROJECT_ID` | `toko-saya-123` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@...` |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIEv...` (Copy semua isinya termasuk baris baru) |

### B. Firebase Client (Frontend) - WAJIB UNTUK LOGIN
*Ambil dari: Firebase Console -> Project Settings -> General -> Your Apps (Web/SDK)*

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyD...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `toko-saya-123.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `toko-saya-123` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `toko-saya-123.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `1234567890` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:1234567890:web:abcdef...` |

### C. Fitur Tambahan (Opsional)

| Key | Value | Fungsi |
|-----|-------|--------|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | (Dari tab Cloud Messaging -> Web Push certs) | Untuk Notifikasi Push |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | (Dari Google Cloud Console) | Untuk Peta Lokasi di Checkout |

## 3. Redeploy
Setelah semua variabel disimpan, Anda **WAJIB melakukan Redeploy** agar perubahan terbaca.
- Masuk ke tab **Deployments**.
- Klik titik tiga di deployment terakhir -> **Redeploy**.
