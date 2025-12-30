// scripts/seed-products.js
require('dotenv').config();
const admin = require('firebase-admin');
const { PRODUCTS } = require('../src/lib/products');

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    projectId: process.env.FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

async function seedProducts() {
  try {
    for (const product of PRODUCTS) {
      await db.collection('products').add({
        name: product.name,
        price: product.price,
        wholesalePrice: product.wholesalePrice,
        stock: product.stock,
        category: product.category,
        unit: product.unit,
        barcode: product.barcode || '',
        minWholesaleQty: product.minWholesaleQty || 1,
        description: product.description || '',
        image: product.image || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Added: ${product.name}`);
    }
    
    console.log('\n🎉 Success!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

seedProducts();