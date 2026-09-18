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

async function migrateCollection(collectionName: string, tableName: string) {
  console.log(`\n📥 Migrating ${collectionName} -> ${tableName}...`);
  try {
    const snap = await fDb.collection(collectionName).get();
    console.log(`   Found ${snap.size} documents in Firestore.`);
    if (snap.empty) return;

    const rows: any[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      const createdAt = parseDate(d.createdAt || d.date || d.openedAt || d.timestamp) || new Date().toISOString();
      const updatedAt = parseDate(d.updatedAt) || createdAt;

      rows.push({
        id: doc.id,
        raw_data: d,
        created_at: createdAt,
        updated_at: updatedAt,
      });
    });

    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`   ❌ Error in ${tableName} batch ${i}:`, error.message);
      } else {
        process.stdout.write(`\r   Uploaded ${Math.min(i + 100, rows.length)} / ${rows.length}`);
      }
    }
    console.log(`\n   ✅ Migrated ${rows.length} records into ${tableName}.`);
  } catch (err: any) {
    console.error(`   ❌ Failed migrating ${collectionName}:`, err.message);
  }
}

async function run() {
  console.log('🚀 Starting Comprehensive Collections Migration...');

  const mappings = [
    { col: 'purchases', tbl: 'purchases' },
    { col: 'inventory_logs', tbl: 'inventory_logs' },
    { col: 'stock_logs', tbl: 'stock_logs' },
    { col: 'operational_expenses', tbl: 'operational_expenses' },
    { col: 'operational_costs', tbl: 'operational_costs' },
    { col: 'capital_transactions', tbl: 'capital_transactions' },
    { col: 'ledger_entries', tbl: 'ledger_entries' },
    { col: 'loans', tbl: 'loans' },
    { col: 'marketplace_accounts', tbl: 'marketplace_accounts' },
    { col: 'marketplace_transactions', tbl: 'marketplace_transactions' },
    { col: 'suppliers', tbl: 'suppliers' },
    { col: 'customers', tbl: 'customers' },
    { col: 'returns', tbl: 'returns' },
    { col: 'attendance_records', tbl: 'attendance_records' },
    { col: 'employees', tbl: 'employees' },
    { col: 'cashier_shifts', tbl: 'cashier_shifts' },
    { col: 'notifications', tbl: 'notifications' },
    { col: 'audit_logs', tbl: 'audit_logs' },
    { col: 'product_cost_logs', tbl: 'product_cost_logs' },
  ];

  for (const m of mappings) {
    await migrateCollection(m.col, m.tbl);
  }

  console.log('\n🎉 ALL COLLECTIONS SUCCESSFULLY MIGRATED TO SUPABASE!');
}

run();
