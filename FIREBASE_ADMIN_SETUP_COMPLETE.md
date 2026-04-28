# ✅ Firebase Admin Configuration - Setup Complete

## 📦 Files Created/Updated

### 1. **`.env.example`** (7.4 KB)
Template lengkap untuk semua environment variables termasuk:
- ✅ Firebase Client Configuration
- ✅ Firebase Admin Configuration (2 metode)
- ✅ Email/SMTP Configuration (Nodemailer)
- ✅ SMS Configuration (Twilio)
- ✅ BRI Payment Gateway
- ✅ Application Settings
- ✅ Dokumentasi lengkap cara mendapatkan credentials
- ✅ Troubleshooting guide

### 2. **`FIREBASE_ADMIN_SETUP.md`** (1.7 KB)
Quick reference guide untuk setup Firebase Admin SDK dengan:
- ✅ Step-by-step instructions
- ✅ Production deployment guide (Vercel)
- ✅ Troubleshooting common issues
- ✅ Links to official documentation

### 3. **`scripts/setup-firebase-admin.js`** (4.6 KB)
Interactive helper script yang:
- ✅ Memandu developer melalui proses setup
- ✅ Validasi file JSON service account
- ✅ Otomatis generate konfigurasi `.env.local`
- ✅ Support kedua metode (JSON & individual variables)

### 4. **`package.json`** - Updated
Menambahkan script baru:
```json
"setup:firebase-admin": "node scripts/setup-firebase-admin.js"
```

### 5. **`README.md`** - Updated
Menambahkan section tentang Firebase Admin setup dengan link ke dokumentasi lengkap.

---

## 🚀 Cara Menggunakan

### Metode 1: Interactive Helper (Recommended untuk Developer Baru)

```bash
npm run setup:firebase-admin
```

Script akan memandu Anda:
1. Download file JSON dari Firebase Console
2. Pilih metode konfigurasi (JSON atau individual)
3. Otomatis generate `.env.local` dengan konfigurasi yang benar

### Metode 2: Manual Setup

```bash
# 1. Copy template
cp .env.example .env.local

# 2. Edit .env.local dan isi credentials
nano .env.local

# 3. Verifikasi
npm run build
```

### Metode 3: Vercel Deployment

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Project → Settings → Environment Variables
3. Tambahkan `GCP_SERVICE_ACCOUNT_KEY` dengan value JSON service account
4. Redeploy

---

## 🔑 Mendapatkan Firebase Admin Credentials

### Langkah-langkah:

1. **Buka Firebase Console**
   - https://console.firebase.google.com/
   - Pilih project Anda

2. **Navigasi ke Service Accounts**
   - Klik icon gear (⚙️) di sidebar kiri
   - Pilih "Project settings"
   - Pindah ke tab "Service accounts"

3. **Generate Private Key**
   - Di bagian "Firebase Admin SDK", klik "Generate new private key"
   - Konfirmasi dengan klik "Generate key"
   - File JSON akan terdownload otomatis

4. **Konfigurasi**
   
   **Opsi A: GCP_SERVICE_ACCOUNT_KEY (Recommended)**
   ```bash
   # Copy seluruh isi file JSON
   GCP_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
   ```

   **Opsi B: Individual Variables**
   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

---

## ✅ Verifikasi Setup

Setelah konfigurasi, jalankan:

```bash
npm run build
```

**Expected Result:**
- ✅ Build berhasil tanpa error
- ✅ Warning "Firebase Admin credentials not fully provided" **hilang**
- ⚠️ Masih ada warning OpenTelemetry (dari Sentry, bisa diabaikan)

---

## 🔍 Troubleshooting

### Warning masih muncul?

**Penyebab:** Credentials tidak dikonfigurasi dengan benar

**Solusi:**
1. Pastikan salah satu metode terkonfigurasi (JSON atau individual)
2. Untuk JSON: validasi format di https://jsonlint.com/
3. Untuk individual: pastikan ketiga variabel terisi lengkap
4. Restart development server

### Error parsing JSON?

**Penyebab:** Format JSON tidak valid atau special characters tidak di-escape

**Solusi:**
1. Gunakan JSON validator online
2. Pastikan quotes dan newlines di-escape dengan benar
3. Coba gunakan Metode 2 (individual variables)

### Deploy ke Vercel gagal?

**Penyebab:** Environment variables belum diset di Vercel

**Solusi:**
1. Set `GCP_SERVICE_ACCOUNT_KEY` di Vercel dashboard
2. Paste JSON value dalam satu baris
3. Redeploy

---

## 📚 Documentation

- **Full Guide**: Lihat file `.env.example` untuk dokumentasi lengkap
- **Quick Reference**: `FIREBASE_ADMIN_SETUP.md`
- **Official Docs**: 
  - [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
  - [GCP Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
  - [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 🔒 Security Best Practices

⚠️ **PENTING:**
- ❌ JANGAN commit `.env.local` ke Git
- ❌ JANGAN share service account JSON di public repository
- ✅ Gunakan App Password untuk Gmail (bukan password utama)
- ✅ Rotate credentials secara berkala
- ✅ Jika credentials bocor, segera revoke di Firebase Console
- ✅ Gunakan environment-specific credentials (dev, staging, production)

---

## ✨ Summary

Dengan setup ini, Anda sekarang memiliki:

1. ✅ Template environment variables yang lengkap (`.env.example`)
2. ✅ Helper script interaktif untuk setup cepat
3. ✅ Dokumentasi step-by-step yang jelas
4. ✅ Troubleshooting guide untuk masalah umum
5. ✅ Security best practices
6. ✅ Production deployment guide (Vercel)

Build seharusnya sekarang bersih dari warning Firebase Admin credentials! 🎉