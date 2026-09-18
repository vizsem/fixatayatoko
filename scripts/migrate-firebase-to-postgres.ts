import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { PrismaClient, Role } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const prisma = new PrismaClient();

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 MEMULAI MIGRASI DATA: FIREBASE -> POSTGRESQL ERP');
  console.log('====================================================');
  console.log(`Target Database: ${process.env.DATABASE_URL?.split('@')[1] || 'PostgreSQL'}\n`);

  try {
    // 1. WAREHOUSES
    console.log('📦 1. Memigrasi Gudang (Warehouses)...');
    let defaultWarehouseId = 'wh_utama';
    const whSnap = await getDocs(collection(db, 'warehouses')).catch(() => ({ docs: [] }));
    if (whSnap.docs.length > 0) {
      for (const d of whSnap.docs) {
        const data = d.data();
        const wh = await prisma.warehouse.upsert({
          where: { id: d.id },
          update: {
            name: data.name || 'Gudang Utama',
            address: data.address || data.lokasi || null,
          },
          create: {
            id: d.id,
            name: data.name || 'Gudang Utama',
            address: data.address || data.lokasi || null,
          },
        });
        defaultWarehouseId = wh.id;
      }
      console.log(`   ✅ Berhasil memigrasi ${whSnap.docs.length} gudang.`);
    } else {
      const defWh = await prisma.warehouse.upsert({
        where: { id: 'wh_utama' },
        update: {},
        create: { id: 'wh_utama', name: 'Gudang Utama', address: 'Kantor Pusat' },
      });
      defaultWarehouseId = defWh.id;
      console.log('   ℹ️ Tidak ada data gudang di Firestore, dibuatkan default "Gudang Utama".');
    }

    // 2. CATEGORIES
    console.log('\n🏷️ 2. Memigrasi Kategori Produk...');
    let defaultCategoryId = 'cat_umum';
    const catSnap = await getDocs(collection(db, 'categories')).catch(() => ({ docs: [] }));
    if (catSnap.docs.length > 0) {
      for (const d of catSnap.docs) {
        const data = d.data();
        const cat = await prisma.category.upsert({
          where: { id: d.id },
          update: {
            name: data.name || 'Umum',
            description: data.description || null,
          },
          create: {
            id: d.id,
            name: data.name || 'Umum',
            description: data.description || null,
          },
        });
        defaultCategoryId = cat.id;
      }
      console.log(`   ✅ Berhasil memigrasi ${catSnap.docs.length} kategori.`);
    } else {
      const defCat = await prisma.category.upsert({
        where: { id: 'cat_umum' },
        update: {},
        create: { id: 'cat_umum', name: 'Umum', description: 'Kategori Default' },
      });
      defaultCategoryId = defCat.id;
      console.log('   ℹ️ Tidak ada koleksi categories di Firestore, dibuatkan default "Umum".');
    }

    // 3. SUPPLIERS
    console.log('\n🤝 3. Memigrasi Supplier / Pemasok...');
    const supSnap = await getDocs(collection(db, 'suppliers')).catch(() => ({ docs: [] }));
    if (supSnap.docs.length > 0) {
      for (const d of supSnap.docs) {
        const data = d.data();
        await prisma.supplier.upsert({
          where: { id: d.id },
          update: {
            name: data.name || data.supplierName || 'Supplier',
            contactPerson: data.contactPerson || data.kontak || null,
            phone: data.phone || data.telepon || null,
            email: data.email || null,
            address: data.address || data.alamat || null,
          },
          create: {
            id: d.id,
            name: data.name || data.supplierName || 'Supplier',
            contactPerson: data.contactPerson || data.kontak || null,
            phone: data.phone || data.telepon || null,
            email: data.email || null,
            address: data.address || data.alamat || null,
          },
        });
      }
      console.log(`   ✅ Berhasil memigrasi ${supSnap.docs.length} supplier.`);
    }

    // 4. CUSTOMERS
    console.log('\n👥 4. Memigrasi Pelanggan (Customers)...');
    const custSnap = await getDocs(collection(db, 'customers')).catch(() => ({ docs: [] }));
    if (custSnap.docs.length > 0) {
      for (const d of custSnap.docs) {
        const data = d.data();
        await prisma.customer.upsert({
          where: { id: d.id },
          update: {
            name: data.name || 'Pelanggan',
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            type: data.type || 'Retail',
          },
          create: {
            id: d.id,
            name: data.name || 'Pelanggan',
            phone: data.phone || null,
            email: data.email || null,
            address: data.address || null,
            type: data.type || 'Retail',
          },
        });
      }
      console.log(`   ✅ Berhasil memigrasi ${custSnap.docs.length} pelanggan.`);
    }

    // 5. PRODUCTS & INVENTORY BATCHES (FEFO ENGINE)
    console.log('\n📦 5. Memigrasi Produk & Membuat Batch Inventaris (FEFO)...');
    const prodSnap = await getDocs(collection(db, 'products')).catch(() => ({ docs: [] }));
    let importedProducts = 0;
    let importedBatches = 0;

    for (const d of prodSnap.docs) {
      const data = d.data();
      const sku = String(data.barcode || data.Barcode || data.sku || d.id).trim();
      const name = String(data.name || data.Nama || 'Produk Tanpa Nama').trim();
      const costPrice = Number(data.cost || data.Modal || data.purchasePrice || 0);
      const sellPrice = Number(data.price || data.priceEcer || data.Ecer || data.sellingPrice || 0);
      const unit = String(data.unit || data.Satuan || 'PCS').toUpperCase();
      const stock = Number(data.stock || data.Stok || 0);

      // Pastikan kategori valid
      let catId = defaultCategoryId;
      if (data.categoryId) {
        const catExists = await prisma.category.findUnique({ where: { id: data.categoryId } });
        if (catExists) catId = catExists.id;
      }

      // Upsert Product
      const product = await prisma.product.upsert({
        where: { sku },
        update: {
          name,
          costPrice,
          sellPrice,
          unit,
          description: data.description || data.deskripsi || null,
          categoryId: catId,
        },
        create: {
          id: d.id,
          sku,
          name,
          costPrice,
          sellPrice,
          unit,
          description: data.description || data.deskripsi || null,
          categoryId: catId,
        },
      });
      importedProducts++;

      // Buat Batch Inventaris jika ada stok
      if (stock > 0) {
        let expiryDate: Date | undefined = undefined;
        if (data.expiredDate || data.expired_date || data.tgl_expired) {
          const expRaw = data.expiredDate || data.expired_date || data.tgl_expired;
          const parsed = new Date(expRaw.toDate ? expRaw.toDate() : expRaw);
          if (!isNaN(parsed.getTime())) expiryDate = parsed;
        }

        const batchNum = `MIGRATE-${product.sku}`;
        const existingBatch = await prisma.inventoryBatch.findFirst({
          where: { productId: product.id, batchNumber: batchNum },
        });

        if (existingBatch) {
          await prisma.inventoryBatch.update({
            where: { id: existingBatch.id },
            data: { quantity: stock, expiryDate },
          });
        } else {
          await prisma.inventoryBatch.create({
            data: {
              productId: product.id,
              warehouseId: defaultWarehouseId,
              batchNumber: batchNum,
              quantity: stock,
              expiryDate,
            },
          });
        }
        importedBatches++;
      }
    }
    console.log(`   ✅ Berhasil memigrasi ${importedProducts} produk dan mensinkronkan ${importedBatches} batch stok FEFO.`);

    // 6. USERS
    console.log('\n👤 6. Memigrasi Pengguna & Role Staff...');
    const userSnap = await getDocs(collection(db, 'users')).catch(() => ({ docs: [] }));
    let importedUsers = 0;
    for (const d of userSnap.docs) {
      const data = d.data();
      if (!data.email) continue;

      let role: Role = Role.SALES;
      const rawRole = String(data.role || '').toUpperCase();
      if (rawRole.includes('ADMIN') || rawRole.includes('OWNER')) role = Role.ADMIN;
      else if (rawRole.includes('GUDANG') || rawRole.includes('WAREHOUSE')) role = Role.WAREHOUSE;
      else if (rawRole.includes('DRIVER') || rawRole.includes('KURIR')) role = Role.DRIVER;

      await prisma.user.upsert({
        where: { email: data.email },
        update: {
          name: data.name || data.displayName || 'Staff',
          role,
        },
        create: {
          id: d.id,
          email: data.email,
          name: data.name || data.displayName || 'Staff',
          role,
        },
      });
      importedUsers++;
    }
    console.log(`   ✅ Berhasil memigrasi ${importedUsers} user ke PostgreSQL.`);

    console.log('\n====================================================');
    console.log('🎉 MIGRASI DATA DARI FIREBASE SELESAI DENGAN SUKSES!');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Terjadi kesalahan saat migrasi:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
