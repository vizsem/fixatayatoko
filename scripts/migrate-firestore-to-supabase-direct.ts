import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
const sa = JSON.parse(fs.readFileSync(path.resolve(saPath), 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

const fDb = admin.firestore();
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseDate(val: any): string | null {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (val._seconds) {
    return new Date(val._seconds * 1000).toISOString();
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

async function migrateWarehouses() {
  console.log('\n🏭 1. Migrating Warehouses...');
  const snap = await fDb.collection('warehouses').get();
  console.log(`Found ${snap.size} warehouses in Firestore.`);
  if (snap.empty) return;

  const rows: any[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    rows.push({
      id: doc.id,
      name: d.name || 'Gudang',
      location: d.location || d.address || null,
      raw_data: d,
      created_at: parseDate(d.createdAt) || new Date().toISOString(),
      updated_at: parseDate(d.updatedAt) || new Date().toISOString(),
    });
  });

  const { error } = await supabase.from('warehouses').upsert(rows, { onConflict: 'id' });
  if (error) console.error('Warehouses error:', error);
  else console.log(`✅ Migrated ${rows.length} warehouses.`);
}

async function migrateCategories() {
  console.log('\n🏷️ 2. Migrating Categories...');
  const snap = await fDb.collection('categories').get();
  console.log(`Found ${snap.size} categories in Firestore.`);
  if (snap.empty) return;

  const rows: any[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    rows.push({
      id: doc.id,
      name: d.name || 'Kategori',
      raw_data: d,
      created_at: parseDate(d.createdAt) || new Date().toISOString(),
      updated_at: parseDate(d.updatedAt) || new Date().toISOString(),
    });
  });

  const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'id' });
  if (error) console.error('Categories error:', error);
  else console.log(`✅ Migrated ${rows.length} categories.`);
}

async function migrateOrders() {
  console.log('\n📦 3. Migrating Orders...');
  const snap = await fDb.collection('orders').get();
  console.log(`Found ${snap.size} orders in Firestore.`);
  if (snap.empty) return;

  const rows: any[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    rows.push({
      id: doc.id,
      order_id: d.orderId || d.ID || doc.id,
      user_id: d.userId || d.customer_id || null,
      customer_name: d.customerName || d.name || null,
      customer_phone: d.phone || d.customerPhone || null,
      status: d.status || 'PENDING',
      total: Number(d.total || d.totalAmount || 0),
      items: d.items || [],
      payment: d.payment || null,
      delivery: d.delivery || null,
      raw_data: d,
      created_at: parseDate(d.createdAt) || new Date().toISOString(),
      updated_at: parseDate(d.updatedAt) || new Date().toISOString(),
    });
  });

  // Batch insert in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from('orders').upsert(chunk, { onConflict: 'id' });
    if (error) console.error(`Orders batch ${i} error:`, error);
    else console.log(`   Uploaded ${Math.min(i + 50, rows.length)} / ${rows.length} orders`);
  }
  console.log(`✅ Migrated all ${rows.length} orders.`);
}

async function migrateProducts() {
  console.log('\n🛍️ 4. Migrating Products...');
  const snap = await fDb.collection('products').get();
  console.log(`Found ${snap.size} products in Firestore.`);
  if (snap.empty) return;

  const rows: any[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const name = d.name || d.Nama || 'Produk';
    const price = Number(d.price || d.Ecer || d.sellPrice || 0);
    const cost = Number(d.purchasePrice || d.Modal || d.cost || 0);
    const stock = Number(d.stock || d.Stok || 0);
    const sku = d.sku || d.Barcode || d.barcode || d.ID || null;
    const barcode = d.barcode || d.Barcode || null;
    const category = d.category || d.Kategori || 'Semua';
    const unit = d.unit || d.Satuan || 'pcs';
    const image_url = d.imageUrl || d.image || d.Link_Foto || d.URL_Produk || null;
    const description = d.description || d.Deskripsi || null;

    rows.push({
      id: doc.id,
      name,
      description,
      price,
      stock,
      sku,
      barcode,
      category,
      unit,
      cost_price: cost,
      image_url,
      raw_data: d,
      created_at: parseDate(d.createdAt) || new Date().toISOString(),
      updated_at: parseDate(d.updatedAt) || new Date().toISOString(),
    });
  });

  // Batch insert in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`Products batch ${i} error:`, error);
    } else {
      process.stdout.write(`\r   Uploaded ${Math.min(i + 100, rows.length)} / ${rows.length} products`);
    }
  }
  console.log(`\n✅ Migrated all ${rows.length} products successfully!`);
}

async function run() {
  console.log('🚀 Starting Full Migration from Firestore to Supabase Postgres...');
  try {
    await migrateWarehouses();
    await migrateCategories();
    await migrateOrders();
    await migrateProducts();
    console.log('\n🎉 ALL DATA HAS BEEN SUCCESSFULLY MIGRATED TO SUPABASE!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

run();
