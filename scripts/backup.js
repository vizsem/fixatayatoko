#!/usr/bin/env node

/**
 * Backup Script untuk Firestore Collections
 * 
 * Usage:
 *   npm run backup:full                              - Backup semua collections
 *   npm run backup:collection products               - Backup products saja
 *   npm run backup:collection products orders        - Backup multiple collections
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_KEY_PATH || 
                          path.join(__dirname, '../serviceAccountKey.json');

let serviceAccount;
if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
} else {
  serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const CRITICAL_COLLECTIONS = [
  'products',
  'orders',
  'purchases',
  'customers',
  'users',
  'suppliers',
  'categories',
  'warehouses',
  'inventory_transactions',
  'wallet_logs',
  'point_logs',
  'settings',
];

async function backupCollection(collectionName, outputPath) {
  console.log(`\n📦 Backing up collection: ${collectionName}`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const data = [];
    
    snapshot.forEach(doc => {
      const docData = doc.data();
      
      // Convert Firestore Timestamps to ISO strings for JSON serialization
      const serializedData = {};
      for (const [key, value] of Object.entries(docData)) {
        if (value instanceof admin.firestore.Timestamp) {
          serializedData[key] = value.toDate().toISOString();
        } else {
          serializedData[key] = value;
        }
      }
      
      data.push({
        id: doc.id,
        ...serializedData,
      });
    });
    
    const filePath = path.join(outputPath, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Backed up ${data.length} documents to ${filePath}`);
    return data.length;
  } catch (error) {
    console.error(`❌ Failed to backup ${collectionName}:`, error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  let collectionsToBackup = [];
  
  if (command === 'full' || !command) {
    collectionsToBackup = CRITICAL_COLLECTIONS;
    console.log('🔄 Starting full database backup...\n');
  } else {
    collectionsToBackup = args;
    console.log(`🔄 Starting backup for collections: ${collectionsToBackup.join(', ')}\n`);
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  const timeString = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
  const backupDir = path.join(__dirname, '../backups', `${timestamp}_${timeString}`);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  let totalDocs = 0;
  let failedCollections = [];
  
  for (const collection of collectionsToBackup) {
    try {
      const count = await backupCollection(collection, backupDir);
      totalDocs += count;
    } catch (error) {
      failedCollections.push(collection);
      console.error(`Skipping ${collection} due to error`);
    }
  }
  
  // Create metadata file
  const metadata = {
    timestamp: new Date().toISOString(),
    totalDocuments: totalDocs,
    collections: collectionsToBackup.filter(c => !failedCollections.includes(c)),
    failedCollections,
    backupLocation: backupDir,
  };
  
  const metadataPath = path.join(backupDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Backup Summary:');
  console.log('='.repeat(60));
  console.log(`📁 Location: ${backupDir}`);
  console.log(`📊 Total Documents: ${totalDocs}`);
  console.log(`✅ Successful Collections: ${collectionsToBackup.length - failedCollections.length}`);
  
  if (failedCollections.length > 0) {
    console.log(`❌ Failed Collections: ${failedCollections.join(', ')}`);
    console.log('\n⚠️  Some collections failed to backup. Check logs above.');
    process.exit(1);
  } else {
    console.log('\n✅ All collections backed up successfully!');
  }
}

main().catch(error => {
  console.error('\n❌ Backup process failed:', error);
  process.exit(1);
});
