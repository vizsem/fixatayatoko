# Firebase Admin Configuration Guide

## 📋 Overview

Panduan lengkap untuk mengkonfigurasi Firebase Admin SDK di project Marketpleace.

## 🔧 Quick Setup

### 1. Copy Template Environment Variables

```bash
cp .env.example .env.local
```

### 2. Dapatkan Firebase Service Account Credentials

Ikuti langkah-langkah di bagian bawah file `.env.example` atau baca dokumentasi lengkap di sana.

### 3. Konfigurasi Credentials (Pilih Salah Satu)

#### Opsi A: GCP Service Account JSON (Recommended)

```bash
# Paste seluruh isi file JSON service account
GCP_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
```

#### Opsi B: Individual Variables

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 4. Verifikasi Konfigurasi

```bash
npm run build
```

Jika konfigurasi benar, warning "Firebase Admin credentials not fully provided" tidak akan muncul.

## 🚀 Production Deployment

### Vercel

1. Buka [Vercel Dashboard](https://vercel.com/dashboard)
2. Pilih project Anda
3. Settings → Environment Variables
4. Tambahkan `GCP_SERVICE_ACCOUNT_KEY` dengan value JSON service account
5. Redeploy

### Manual Server

Pastikan environment variables tersedia di server production sebelum menjalankan aplikasi.

## 🔍 Troubleshooting

Lihat bagian troubleshooting di file `.env.example` untuk solusi masalah umum.

## 📚 Related Documentation

- [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
- [GCP Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)