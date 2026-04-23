#!/usr/bin/env node

/**
 * Comprehensive Database Seeding Script
 * 
 * Usage:
 *   npm run seed all          - Seed all data
 *   npm run seed categories   - Seed categories only
 *   npm run seed products     - Seed products only
 *   npm run seed suppliers    - Seed suppliers only
 *   npm run seed warehouses   - Seed warehouses only
 *   npm run seed users        - Seed admin/cashier users
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_KEY_PATH || 
                          path.join(__dirname, '../serviceAccountKey.json');

let serviceAccount;
if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
} else {
  // Fallback to environment variables
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

// ==================== SEED DATA ====================

const categories = [
  { id: 'cat-sembako', name: 'Sembako', slug: 'sembako', icon: '🛒', order: 1 },
  { id: 'cat-minyak', name: 'Minyak Goreng', slug: 'minyak-goreng', icon: '🫗', order: 2 },
  { id: 'cat-beras', name: 'Beras', slug: 'beras', icon: '🍚', order: 3 },
  { id: 'cat-gula', name: 'Gula & Pemanis', slug: 'gula-pemanis', icon: '🍬', order: 4 },
  { id: 'cat-snack', name: 'Snack', slug: 'snack', icon: '🍪', order: 5 },
  { id: 'cat-minuman', name: 'Minuman', slug: 'minuman', icon: '🥤', order: 6 },
  { id: 'cat-rokok', name: 'Rokok', slug: 'rokok', icon: '🚬', order: 7 },
  { id: 'cat-bumbu', name: 'Bumbu Dapur', slug: 'bumbu-dapur', icon: '🌶️', order: 8 },
  { id: 'cat-susu', name: 'Susu & Olahan', slug: 'susu-olahan', icon: '🥛', order: 9 },
  { id: 'cat-mie', name: 'Mie Instan', slug: 'mie-instan', icon: '🍜', order: 10 },
];

const warehouses = [
  {
    id: 'warehouse-utama',
    name: 'Gudang Utama',
    address: 'Jl. Raya Kediri No. 123, Kediri',
    phone: '081234567890',
    capacity: 10000,
    currentStock: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'warehouse-cabang',
    name: 'Gudang Cabang',
    address: 'Jl. Dhoho No. 45, Kediri',
    phone: '081234567891',
    capacity: 5000,
    currentStock: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

const suppliers = [
  {
    id: 'supplier-001',
    name: 'PT Distributor Sembako Jaya',
    contact: 'Budi Santoso',
    phone: '081234567892',
    email: 'budi@sembakojaya.com',
    address: 'Jl. Industri No. 10, Surabaya',
    paymentTerms: 'NET 30',
    rating: 4.5,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'supplier-002',
    name: 'CV Berkah Abadi',
    contact: 'Siti Rahayu',
    phone: '081234567893',
    email: 'siti@berkahabadi.com',
    address: 'Jl. Pahlawan No. 25, Malang',
    paymentTerms: 'NET 15',
    rating: 4.8,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'supplier-003',
    name: 'UD Makmur Sentosa',
    contact: 'Ahmad Hidayat',
    phone: '081234567894',
    email: 'ahmad@makmursentosa.com',
    address: 'Jl. Diponegoro No. 50, Kediri',
    paymentTerms: 'COD',
    rating: 4.2,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

const sampleProducts = [
  {
    id: 'prod-beras-001',
    name: 'Beras Premium 5kg',
    sku: 'BERAS-PREM-5KG',
    categoryId: 'cat-beras',
    categoryName: 'Beras',
    description: 'Beras premium kualitas super, pulen dan wangi',
    unit: 'karung',
    conversion: 1,
    stock: 100,
    purchasePrice: 65000,
    sellingPrice: 72000,
    wholesalePrice: 70000,
    minOrderQty: 1,
    warehouseId: 'warehouse-utama',
    supplierId: 'supplier-001',
    imageUrl: '/products/beras-premium.jpg',
    isActive: true,
    isFeatured: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'prod-minyak-001',
    name: 'Minyak Goreng Bimoli 2L',
    sku: 'MINYAK-BIMOLI-2L',
    categoryId: 'cat-minyak',
    categoryName: 'Minyak Goreng',
    description: 'Minyak goreng berkualitas, jernih dan sehat',
    unit: 'botol',
    conversion: 1,
    stock: 150,
    purchasePrice: 28000,
    sellingPrice: 32000,
    wholesalePrice: 30000,
    minOrderQty: 1,
    warehouseId: 'warehouse-utama',
    supplierId: 'supplier-002',
    imageUrl: '/products/minyak-bimoli.jpg',
    isActive: true,
    isFeatured: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'prod-gula-001',
    name: 'Gula Pasir Gulaku 1kg',
    sku: 'GULA-GULAKU-1KG',
    categoryId: 'cat-gula',
    categoryName: 'Gula & Pemanis',
    description: 'Gula pasir putih bersih, manis alami',
    unit: 'pack',
    conversion: 1,
    stock: 200,
    purchasePrice: 12000,
    sellingPrice: 15000,
    wholesalePrice: 14000,
    minOrderQty: 1,
    warehouseId: 'warehouse-utama',
    supplierId: 'supplier-001',
    imageUrl: '/products/gula-gulaku.jpg',
    isActive: true,
    isFeatured: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'prod-snack-001',
    name: 'Chitato Sapi Panggang 68g',
    sku: 'SNACK-CHITATO-68G',
    categoryId: 'cat-snack',
    categoryName: 'Snack',
    description: 'Keripik kentang rasa sapi panggang yang renyah',
    unit: 'pcs',
    conversion: 1,
    stock: 300,
    purchasePrice: 8500,
    sellingPrice: 11000,
    wholesalePrice: 10000,
    minOrderQty: 1,
    warehouseId: 'warehouse-utama',
    supplierId: 'supplier-003',
    imageUrl: '/products/chitato.jpg',
    isActive: true,
    isFeatured: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    id: 'prod-mie-001',
    name: 'Indomie Goreng Original',
    sku: 'MIE-INDOMIE-GORENG',
    categoryId: 'cat-mie',
    categoryName: 'Mie Instan',
    description: 'Mie instan goreng favorit Indonesia',
    unit: 'pcs',
    conversion: 1,
    stock: 500,
    purchasePrice: 2800,
    sellingPrice: 3500,
    wholesalePrice: 3200,
    minOrderQty: 1,
    warehouseId: 'warehouse-utama',
    supplierId: 'supplier-001',
    imageUrl: '/products/indomie-goreng.jpg',
    isActive: true,
    isFeatured: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

const settings = {
  storeInfo: {
    name: 'ATAYATOKO',
    tagline: 'Grosir Sembako Kediri Termurah',
    address: 'Jl. Raya Kediri No. 123, Kediri, Jawa Timur',
    phone: '081234567890',
    email: 'info@atayatoko.com',
    whatsapp: '6281234567890',
    operatingHours: 'Senin - Sabtu: 08:00 - 20:00',
  },
  shipping: {
    freeShippingThreshold: 500000,
    defaultShippingCost: 10000,
    coverageAreas: ['Kediri Kota', 'Kediri Kabupaten'],
  },
  payment: {
    methods: ['CASH', 'TRANSFER', 'QRIS', 'HUTANG'],
    bankAccounts: [
      {
        bankName: 'Bank BRI',
        accountNumber: '1234567890',
        accountName: 'PT Atayatoko Indonesia',
      },
    ],
  },
};

// ==================== SEED FUNCTIONS ====================

async function seedCategories() {
  console.log('\n📦 Seeding categories...');
  
  const batch = db.batch();
  let count = 0;
  
  for (const category of categories) {
    const ref = db.collection('categories').doc(category.id);
    batch.set(ref, category, { merge: true });
    count++;
  }
  
  await batch.commit();
  console.log(`✅ Seeded ${count} categories`);
}

async function seedWarehouses() {
  console.log('\n🏭 Seeding warehouses...');
  
  const batch = db.batch();
  let count = 0;
  
  for (const warehouse of warehouses) {
    const ref = db.collection('warehouses').doc(warehouse.id);
    batch.set(ref, warehouse, { merge: true });
    count++;
  }
  
  await batch.commit();
  console.log(`✅ Seeded ${count} warehouses`);
}

async function seedSuppliers() {
  console.log('\n🤝 Seeding suppliers...');
  
  const batch = db.batch();
  let count = 0;
  
  for (const supplier of suppliers) {
    const ref = db.collection('suppliers').doc(supplier.id);
    batch.set(ref, supplier, { merge: true });
    count++;
  }
  
  await batch.commit();
  console.log(`✅ Seeded ${count} suppliers`);
}

async function seedProducts() {
  console.log('\n🛍️  Seeding products...');
  
  const batch = db.batch();
  let count = 0;
  
  for (const product of sampleProducts) {
    const ref = db.collection('products').doc(product.id);
    
    // Add inventory layers
    const inventoryLayers = [{
      qty: product.stock,
      costPerPcs: product.purchasePrice,
      ts: admin.firestore.Timestamp.now(),
      purchaseId: 'initial-seed',
      supplierName: suppliers.find(s => s.id === product.supplierId)?.name || '',
      warehouseId: product.warehouseId,
    }];
    
    batch.set(ref, {
      ...product,
      inventoryLayers,
      Modal: product.purchasePrice,
      hargaBeli: product.purchasePrice,
    }, { merge: true });
    
    count++;
  }
  
  await batch.commit();
  console.log(`✅ Seeded ${count} products with inventory layers`);
}

async function seedSettings() {
  console.log('\n⚙️  Seeding settings...');
  
  const ref = db.collection('settings').doc('store-config');
  await ref.set(settings, { merge: true });
  
  console.log('✅ Seeded store settings');
}

async function clearCollection(collectionName) {
  console.log(`\n🗑️  Clearing ${collectionName}...`);
  
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  
  snapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  if (!snapshot.empty) {
    await batch.commit();
    console.log(`✅ Cleared ${snapshot.size} documents from ${collectionName}`);
  } else {
    console.log(`ℹ️  ${collectionName} is already empty`);
  }
}

// ==================== MAIN EXECUTION ====================

async function main() {
  const command = process.argv[2] || 'all';
  
  console.log('🌱 Starting database seeding...\n');
  console.log('=' .repeat(50));
  
  try {
    switch (command) {
      case 'all':
        await seedCategories();
        await seedWarehouses();
        await seedSuppliers();
        await seedProducts();
        await seedSettings();
        break;
        
      case 'categories':
        await seedCategories();
        break;
        
      case 'warehouses':
        await seedWarehouses();
        break;
        
      case 'suppliers':
        await seedSuppliers();
        break;
        
      case 'products':
        await seedProducts();
        break;
        
      case 'settings':
        await seedSettings();
        break;
        
      case 'clear':
        const collectionToClear = process.argv[3];
        if (collectionToClear) {
          await clearCollection(collectionToClear);
        } else {
          console.log('Usage: npm run seed clear <collection-name>');
          console.log('Example: npm run seed clear products');
        }
        break;
        
      case 'clear-all':
        console.log('⚠️  WARNING: This will delete ALL data!');
        console.log('Are you sure? (yes/no)');
        
        // For safety, require explicit confirmation via environment variable
        if (process.env.CONFIRM_CLEAR_ALL === 'yes') {
          await clearCollection('products');
          await clearCollection('categories');
          await clearCollection('suppliers');
          await clearCollection('warehouses');
          await clearCollection('orders');
          await clearCollection('customers');
          console.log('\n✅ All collections cleared');
        } else {
          console.log('❌ Operation cancelled. Set CONFIRM_CLEAR_ALL=yes to proceed.');
        }
        break;
        
      default:
        console.log('Unknown command:', command);
        console.log('\nAvailable commands:');
        console.log('  npm run seed all          - Seed all data');
        console.log('  npm run seed categories   - Seed categories only');
        console.log('  npm run seed warehouses   - Seed warehouses only');
        console.log('  npm run seed suppliers    - Seed suppliers only');
        console.log('  npm run seed products     - Seed products only');
        console.log('  npm run seed settings     - Seed settings only');
        console.log('  npm run seed clear <collection> - Clear specific collection');
        console.log('  npm run seed clear-all    - Clear all collections (requires CONFIRM_CLEAR_ALL=yes)');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✨ Seeding completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
