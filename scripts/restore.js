#!/usr/bin/env node

/**
 * Restore Script untuk Firestore Collections
 * 
 * Usage:
 *   npm run restore products ./backups/2024-01-15/products.json
 *   npm run restore all ./backups/2024-01-15_12-30-00/
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function restoreCollection(collectionName, backupFile, skipConfirmation = false) {
  console.log(`\n🔄 Restoring collection: ${collectionName}`);
  console.log(`📄 Backup file: ${backupFile}`);
  
  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }
  
  // Confirmation unless skipped
  if (!skipConfirmation) {
    const answer = await askQuestion('\n⚠️  WARNING: This will overwrite existing data! Continue? (yes/no): ');
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Restore cancelled by user');
      return 0;
    }
  }
  
  const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  console.log(`📊 Total documents to restore: ${data.length}\n`);
  
  let restoredCount = 0;
  let failedCount = 0;
  const errors = [];
  
  // Process in batches of 500 to avoid memory issues
  const batchSize = 500;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = db.batch();
    const batchData = data.slice(i, i + batchSize);
    
    for (const doc of batchData) {
      const { id, ...docData } = doc;
      
      // Convert ISO strings back to Firestore Timestamps if needed
      const processedData = {};
      for (const [key, value] of Object.entries(docData)) {
        if (typeof value === 'string' && !isNaN(Date.parse(value))) {
          // Check if it looks like a timestamp field
          if (key.includes('At') || key.includes('Date') || key.includes('Time')) {
            processedData[key] = admin.firestore.Timestamp.fromDate(new Date(value));
          } else {
            processedData[key] = value;
          }
        } else {
          processedData[key] = value;
        }
      }
      
      const ref = db.collection(collectionName).doc(id);
      batch.set(ref, processedData);
    }
    
    try {
      await batch.commit();
      restoredCount += batchData.length;
      console.log(`  Progress: ${restoredCount}/${data.length} documents restored...`);
    } catch (error) {
      failedCount += batchData.length;
      errors.push({
        batch: i / batchSize,
        error: error.message,
      });
      console.error(`  ❌ Failed to restore batch ${i / batchSize}:`, error.message);
    }
  }
  
  console.log(`\n✅ Restored ${restoredCount} documents to ${collectionName}`);
  
  if (failedCount > 0) {
    console.log(`⚠️  Failed to restore ${failedCount} documents`);
    console.log('Errors:', errors);
  }
  
  return restoredCount;
}

async function restoreAllFromDirectory(backupDir) {
  console.log(`🔄 Restoring all collections from: ${backupDir}\n`);
  
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory not found: ${backupDir}`);
  }
  
  // Read metadata
  const metadataPath = path.join(backupDir, 'metadata.json');
  let metadata = {};
  
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log('📋 Backup Metadata:');
    console.log(`   Timestamp: ${metadata.timestamp}`);
    console.log(`   Total Documents: ${metadata.totalDocuments}`);
    console.log(`   Collections: ${metadata.collections?.join(', ')}`);
    console.log('');
  }
  
  // Find all JSON files (excluding metadata.json)
  const files = fs.readdirSync(backupDir)
    .filter(file => file.endsWith('.json') && file !== 'metadata.json');
  
  if (files.length === 0) {
    throw new Error('No backup files found in directory');
  }
  
  const answer = await askQuestion(`⚠️  Found ${files.length} collections to restore. Continue? (yes/no): `);
  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Restore cancelled by user');
    return;
  }
  
  let totalRestored = 0;
  
  for (const file of files) {
    const collectionName = file.replace('.json', '');
    const filePath = path.join(backupDir, file);
    
    try {
      const count = await restoreCollection(collectionName, filePath, true);
      totalRestored += count;
    } catch (error) {
      console.error(`❌ Failed to restore ${collectionName}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✨ Restore completed! Total documents restored: ${totalRestored}`);
  console.log('='.repeat(60));
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  npm run restore <collection-name> <backup-file>');
    console.log('  npm run restore all <backup-directory>');
    console.log('\nExamples:');
    console.log('  npm run restore products ./backups/2024-01-15/products.json');
    console.log('  npm run restore all ./backups/2024-01-15_12-30-00/');
    process.exit(1);
  }
  
  const mode = args[0];
  const sourcePath = args[1];
  
  try {
    if (mode === 'all') {
      await restoreAllFromDirectory(sourcePath);
    } else {
      const collectionName = mode;
      const backupFile = sourcePath;
      await restoreCollection(collectionName, backupFile);
    }
    
    console.log('\n✅ Restore process completed successfully!');
  } catch (error) {
    console.error('\n❌ Restore failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
