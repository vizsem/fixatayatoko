# Backup & Recovery Strategy

Dokumen ini menjelaskan strategi backup dan recovery untuk database Firebase Firestore yang digunakan dalam aplikasi ATAYATOKO.

## 📋 Daftar Isi
- [Overview](#overview)
- [Automated Backups](#automated-backups)
- [Manual Backup Procedures](#manual-backup-procedures)
- [Recovery Procedures](#recovery-procedures)
- [Backup Schedule](#backup-schedule)
- [Retention Policy](#retention-policy)
- [Testing & Validation](#testing--validation)

---

## Overview

### Tujuan
- Melindungi data dari kehilangan akibat human error, corruption, atau disaster
- Memastikan business continuity dengan RTO (Recovery Time Objective) < 4 jam
- Memenuhi compliance requirements untuk data transaksi

### Scope
- **Firestore Database**: Products, Orders, Customers, Inventory, dll
- **Firebase Storage**: Product images, receipts, documents
- **Authentication**: User accounts dan custom claims
- **Configuration**: Environment variables, settings collections

---

## Automated Backups

### 1. Firebase Native Backup (Enabled)
Firebase secara otomatis melakukan backup dengan fitur berikut:
- **Point-in-time recovery**: Dapat restore ke timestamp spesifik dalam 7 hari terakhir
- **Continuous backup**: Backup dilakukan secara real-time
- **No additional cost**: Sudah termasuk dalam Firebase pricing

**Cara Enable:**
```bash
gcloud firestore databases update --database=(default) --enable-pitr
```

### 2. Scheduled Export to Cloud Storage
Export harian ke Google Cloud Storage bucket untuk long-term retention.

**Setup Script:**
```bash
#!/bin/bash
# scripts/backup-firestore.sh

PROJECT_ID="your-project-id"
BUCKET_NAME="gs://atayatoko-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_URI="${BUCKET_NAME}/firestore_${TIMESTAMP}"

gcloud firestore export ${OUTPUT_URI} \
  --project=${PROJECT_ID} \
  --collection-ids='products,orders,customers,suppliers,categories,warehouses,settings'
```

**Schedule dengan Cloud Scheduler:**
```bash
gcloud scheduler jobs create http daily-firestore-backup \
  --schedule="0 2 * * *" \
  --uri="https://YOUR_CLOUD_FUNCTION_URL" \
  --http-method=POST
```

### 3. Critical Collections Backup
Collections yang harus di-backup setiap hari:
- ✅ `products` - Master data produk
- ✅ `orders` - Transaksi penjualan
- ✅ `purchases` - Transaksi pembelian
- ✅ `customers` - Data pelanggan
- ✅ `users` - User accounts
- ✅ `inventory_transactions` - Log stok
- ✅ `wallet_logs` - Transaksi wallet
- ✅ `point_logs` - Transaksi poin
- ✅ `settings` - Konfigurasi aplikasi

---

## Manual Backup Procedures

### Export Entire Database
```bash
# Export semua collections
npm run backup:full

# Script akan membuat file JSON di ./backups/YYYY-MM-DD/
```

### Export Specific Collection
```bash
# Export products collection saja
npm run backup:collection products

# Export multiple collections
npm run backup:collection products orders customers
```

### Backup Script Implementation
File: `scripts/backup.js`

```javascript
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

async function backupCollection(collectionName, outputPath) {
  console.log(`Backing up collection: ${collectionName}`);
  
  const snapshot = await db.collection(collectionName).get();
  const data = [];
  
  snapshot.forEach(doc => {
    data.push({
      id: doc.id,
      ...doc.data(),
    });
  });
  
  const filePath = path.join(outputPath, `${collectionName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  
  console.log(`✅ Backed up ${data.length} documents to ${filePath}`);
  return data.length;
}

async function main() {
  const collections = process.argv[2] ? 
    process.argv[2].split(',') : 
    ['products', 'orders', 'customers', 'suppliers', 'categories'];
  
  const timestamp = new Date().toISOString().split('T')[0];
  const backupDir = path.join(__dirname, '../backups', timestamp);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  let totalDocs = 0;
  
  for (const collection of collections) {
    const count = await backupCollection(collection.trim(), backupDir);
    totalDocs += count;
  }
  
  console.log(`\n✨ Backup completed! Total: ${totalDocs} documents`);
  console.log(`📁 Location: ${backupDir}`);
}

main().catch(console.error);
```

---

## Recovery Procedures

### Scenario 1: Accidental Data Deletion
**RTO**: < 1 hour  
**RPO**: < 7 days (dengan point-in-time recovery)

**Steps:**
1. Identifikasi waktu sebelum deletion terjadi
2. Gunakan Firebase Console untuk point-in-time recovery:
   ```bash
   gcloud firestore databases restore \
     --source-backup=BACKUP_NAME \
     --destination-database=RESTORED_DB
   ```
3. Export data yang dibutuhkan dari restored database
4. Import kembali ke production database

### Scenario 2: Data Corruption
**RTO**: < 2 hours  
**RPO**: Last successful backup

**Steps:**
1. Stop aplikasi untuk mencegah further corruption
2. Identify corrupted collections
3. Restore dari backup terbaru:
   ```bash
   npm run restore:collection products ./backups/2024-01-15/products.json
   ```
4. Verify data integrity
5. Restart aplikasi

### Scenario 3: Complete Database Loss
**RTO**: < 4 hours  
**RPO**: Last daily backup

**Steps:**
1. Create new Firestore database instance
2. Restore dari Cloud Storage backup:
   ```bash
   gcloud firestore import gs://atayatoko-backups/firestore_20240115_020000
   ```
3. Update environment variables dengan database baru
4. Test thoroughly before going live
5. Update DNS/load balancer jika perlu

### Restore Script
File: `scripts/restore.js`

```javascript
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp();
const db = admin.firestore();

async function restoreCollection(collectionName, backupFile) {
  console.log(`Restoring collection: ${collectionName}`);
  
  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const batch = db.batch();
  let count = 0;
  
  for (const doc of data) {
    const { id, ...docData } = doc;
    const ref = db.collection(collectionName).doc(id);
    batch.set(ref, docData);
    count++;
    
    // Commit every 500 docs to avoid batch size limit
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Restored ${count}/${data.length} documents...`);
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Restored ${count} documents to ${collectionName}`);
}

async function main() {
  const collectionName = process.argv[2];
  const backupFile = process.argv[3];
  
  if (!collectionName || !backupFile) {
    console.log('Usage: npm run restore:collection <collection-name> <backup-file>');
    process.exit(1);
  }
  
  if (!fs.existsSync(backupFile)) {
    console.error(`Backup file not found: ${backupFile}`);
    process.exit(1);
  }
  
  try {
    await restoreCollection(collectionName, backupFile);
    console.log('✨ Restore completed successfully!');
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

main();
```

---

## Backup Schedule

| Backup Type | Frequency | Retention | Storage Location |
|------------|-----------|-----------|------------------|
| Point-in-time (native) | Continuous | 7 days | Firebase Internal |
| Full export | Daily (02:00 AM) | 30 days | GCS Bucket |
| Weekly archive | Every Sunday | 12 weeks | GCS Cold Storage |
| Monthly snapshot | 1st of month | 1 year | GCS Archive |

---

## Retention Policy

### Backup Retention
- **Daily backups**: 30 hari
- **Weekly backups**: 12 minggu
- **Monthly backups**: 1 tahun
- **Yearly backups**: 7 tahun (untuk compliance)

### Automatic Cleanup
Script untuk menghapus backup yang expired:
```bash
#!/bin/bash
# scripts/cleanup-old-backups.sh

RETENTION_DAYS=30
BACKUP_BUCKET="gs://atayatoko-backups"

# Delete backups older than retention period
gsutil ls ${BACKUP_BUCKET} | while read line; do
  DATE=$(echo $line | grep -oP '\d{8}_\d{6}')
  if [ ! -z "$DATE" ]; then
    BACKUP_DATE=$(date -d "${DATE:0:4}-${DATE:4:2}-${DATE:6:2}" +%s)
    CURRENT_DATE=$(date +%s)
    AGE_DAYS=$(( (CURRENT_DATE - BACKUP_DATE) / 86400 ))
    
    if [ $AGE_DAYS -gt $RETENTION_DAYS ]; then
      echo "Deleting old backup: $line"
      gsutil -m rm -r "$line"
    fi
  fi
done
```

---

## Testing & Validation

### Monthly Backup Testing
Setiap bulan, lakukan test restore untuk memastikan backup valid:

**Checklist:**
- [ ] Restore backup ke staging environment
- [ ] Verify document counts match production
- [ ] Test critical user flows (login, checkout, payment)
- [ ] Check data integrity (random sampling)
- [ ] Document test results
- [ ] Update procedures jika ada issues

### Validation Script
```javascript
async function validateBackup(backupFile) {
  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  
  console.log(`Validating backup: ${backupFile}`);
  console.log(`Total documents: ${data.length}`);
  
  // Check for required fields
  const requiredFields = ['id', 'createdAt'];
  let validCount = 0;
  
  for (const doc of data) {
    const hasAllFields = requiredFields.every(field => 
      doc.hasOwnProperty(field) || field === 'id'
    );
    
    if (hasAllFields) {
      validCount++;
    }
  }
  
  console.log(`Valid documents: ${validCount}/${data.length}`);
  
  if (validCount === data.length) {
    console.log('✅ Backup validation passed');
    return true;
  } else {
    console.log('⚠️  Backup has invalid documents');
    return false;
  }
}
```

---

## Monitoring & Alerts

### Metrics to Monitor
- Backup success/failure rate
- Backup duration
- Storage usage growth
- Time since last successful backup

### Alert Configuration
Setup alerts untuk:
- ❌ Backup gagal lebih dari 2 kali berturut-turut
- ⚠️ Storage usage > 80% capacity
- ⚠️ Last backup > 24 hours ago
- ❌ Backup duration > 2x average

---

## Contact & Escalation

### Primary Contacts
- **DevOps Lead**: [Nama] - [Email/Phone]
- **Database Admin**: [Nama] - [Email/Phone]
- **CTO**: [Nama] - [Email/Phone]

### Escalation Matrix
1. **Level 1** (0-30 min): DevOps on-call
2. **Level 2** (30-60 min): Database Admin
3. **Level 3** (>60 min): CTO + Full team

---

## Appendix

### Useful Commands
```bash
# Check backup status
gcloud firestore operations list

# Export database
npm run backup:full

# Restore collection
npm run restore:collection products ./backups/2024-01-15/products.json

# List backups in GCS
gsutil ls gs://atayatoko-backups/

# Download backup locally
gsutil cp gs://atayatoko-backups/firestore_20240115_020000 ./local-backup/
```

### Related Documentation
- [Firebase Backup Documentation](https://firebase.google.com/docs/firestore/manage-data/export-import)
- [GCS Storage Classes](https://cloud.google.com/storage/docs/storage-classes)
- [Disaster Recovery Planning](./DISASTER_RECOVERY.md)

---

**Last Updated**: January 2024  
**Next Review**: February 2024  
**Document Owner**: DevOps Team
