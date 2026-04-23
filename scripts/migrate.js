#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Usage:
 *   npm run migrate up     - Run all pending migrations
 *   npm run migrate down   - Rollback last migration
 *   npm run migrate status - Show migration status
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Migration registry
const migrations = [
  {
    id: '001-add-warehouse-field-to-products',
    description: 'Menambahkan field warehouseId ke semua products',
    up: async () => {
      console.log('Running migration: 001-add-warehouse-field-to-products');
      
      const productsRef = db.collection('products');
      const snapshot = await productsRef.get();
      
      let updated = 0;
      const batch = db.batch();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.warehouseId) {
          batch.update(doc.ref, {
            warehouseId: 'gudang-utama',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          updated++;
        }
      });
      
      if (updated > 0) {
        await batch.commit();
        console.log(`✅ Updated ${updated} products with default warehouseId`);
      } else {
        console.log('✅ No products need update');
      }
    },
    down: async () => {
      console.log('Rolling back migration: 001-add-warehouse-field-to-products');
      
      const productsRef = db.collection('products');
      const snapshot = await productsRef.get();
      
      const batch = db.batch();
      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          warehouseId: admin.firestore.FieldValue.delete(),
        });
      });
      
      await batch.commit();
      console.log('✅ Removed warehouseId from all products');
    },
  },
  {
    id: '002-add-inventory-layers-to-products',
    description: 'Menambahkan field inventoryLayers untuk tracking stok per batch',
    up: async () => {
      console.log('Running migration: 002-add-inventory-layers-to-products');
      
      const productsRef = db.collection('products');
      const snapshot = await productsRef.get();
      
      let updated = 0;
      const batch = db.batch();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.inventoryLayers || !Array.isArray(data.inventoryLayers)) {
          // Create initial layer from current stock
          const currentStock = Number(data.stock || data.Stok || 0);
          const costPerPcs = Number(data.Modal || data.purchasePrice || 0);
          
          if (currentStock > 0 && costPerPcs > 0) {
            batch.update(doc.ref, {
              inventoryLayers: [{
                qty: currentStock,
                costPerPcs: costPerPcs,
                ts: admin.firestore.Timestamp.now(),
                purchaseId: 'initial-migration',
                supplierName: data.supplierName || '',
                warehouseId: data.warehouseId || 'gudang-utama',
              }],
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            updated++;
          }
        }
      });
      
      if (updated > 0) {
        await batch.commit();
        console.log(`✅ Added inventory layers to ${updated} products`);
      } else {
        console.log('✅ All products already have inventory layers');
      }
    },
    down: async () => {
      console.log('Rolling back migration: 002-add-inventory-layers-to-products');
      
      const productsRef = db.collection('products');
      const snapshot = await productsRef.get();
      
      const batch = db.batch();
      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          inventoryLayers: admin.firestore.FieldValue.delete(),
        });
      });
      
      await batch.commit();
      console.log('✅ Removed inventoryLayers from all products');
    },
  },
  // Tambahkan migration baru di sini
];

// Migration collection untuk tracking
const MIGRATIONS_COLLECTION = 'migrations';

async function getCompletedMigrations() {
  const snapshot = await db.collection(MIGRATIONS_COLLECTION).get();
  return snapshot.docs.map(doc => doc.id);
}

async function recordMigration(migrationId) {
  await db.collection(MIGRATIONS_COLLECTION).doc(migrationId).set({
    executedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'completed',
  });
}

async function removeMigrationRecord(migrationId) {
  await db.collection(MIGRATIONS_COLLECTION).doc(migrationId).delete();
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  if (!command) {
    console.log('Usage: npm run migrate [up|down|status]');
    process.exit(1);
  }
  
  try {
    const completed = await getCompletedMigrations();
    
    switch (command) {
      case 'up':
        console.log('🚀 Running migrations...\n');
        
        for (const migration of migrations) {
          if (!completed.includes(migration.id)) {
            try {
              await migration.up();
              await recordMigration(migration.id);
              console.log(`✅ Migration ${migration.id} completed\n`);
            } catch (error) {
              console.error(`❌ Migration ${migration.id} failed:`, error.message);
              throw error;
            }
          } else {
            console.log(`⏭️  Skipping ${migration.id} (already completed)`);
          }
        }
        
        console.log('\n✨ All migrations completed successfully!');
        break;
        
      case 'down':
        console.log('⏪ Rolling back last migration...\n');
        
        const lastCompleted = migrations
          .filter(m => completed.includes(m.id))
          .pop();
        
        if (!lastCompleted) {
          console.log('No migrations to rollback');
          return;
        }
        
        try {
          await lastCompleted.down();
          await removeMigrationRecord(lastCompleted.id);
          console.log(`\n✅ Rolled back ${lastCompleted.id}`);
        } catch (error) {
          console.error(`❌ Rollback failed:`, error.message);
          throw error;
        }
        break;
        
      case 'status':
        console.log('📊 Migration Status:\n');
        console.log('Completed migrations:');
        completed.forEach(id => {
          console.log(`  ✅ ${id}`);
        });
        
        console.log('\nPending migrations:');
        const pending = migrations.filter(m => !completed.includes(m.id));
        if (pending.length === 0) {
          console.log('  (none)');
        } else {
          pending.forEach(m => {
            console.log(`  ⏳ ${m.id} - ${m.description}`);
          });
        }
        break;
        
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Usage: npm run migrate [up|down|status]');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
