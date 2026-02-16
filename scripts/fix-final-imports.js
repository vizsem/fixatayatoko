// Script final untuk menambahkan import statements yang benar

const fs = require('fs');
const path = require('path');

// Files yang perlu diperbaiki (berdasarkan error output)
const targetFiles = [
  'src/app/admin/customers/edit/[id]/page.tsx',
  'src/app/admin/customers/page.tsx',
  'src/app/admin/inventory/logs/page.tsx',
  'src/app/admin/inventory/opname/page.tsx',
  'src/app/admin/inventory/page.tsx',
  'src/app/admin/inventory/stock-in/page.tsx',
  'src/app/admin/inventory/stock-in/StockInFormInner.tsx',
  'src/app/admin/inventory/stock-out/page.tsx',
  'src/app/admin/inventory/transfer/page.tsx',
  'src/app/admin/kategori/page.tsx',
  'src/app/admin/layout.tsx',
  'src/app/admin/orders/[id]/page.tsx',
  'src/app/admin/orders/page.tsx',
  'src/app/admin/orders/print/[id]/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/admin/points/page.tsx',
  'src/app/admin/products/edit/[id]/page.tsx',
  'src/app/admin/products/page.tsx',
  'src/app/admin/promotions/add/page.tsx',
  'src/app/admin/promotions/page.tsx',
  'src/app/admin/purchases/page.tsx',
  'src/app/admin/reports/customers/page.tsx',
  'src/app/admin/reports/finance/page.tsx',
  'src/app/admin/reports/inventory/page.tsx',
  'src/app/admin/reports/operations/page.tsx',
  'src/app/admin/reports/page.tsx',
  'src/app/admin/reports/promotions/page.tsx',
  'src/app/admin/reports/sales/page.tsx',
  'src/app/admin/settings/page.tsx',
  'src/app/admin/suppliers/edit/[id]/page.tsx',
  'src/app/admin/suppliers/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/app/admin/warehouses/add/page.tsx',
  'src/app/admin/warehouses/edit/[id]/page.tsx',
  'src/app/admin/warehouses/mutasi/[id]/page.tsx',
  'src/app/admin/warehouses/page.tsx',
  'src/app/cart/page.tsx',
  'src/app/cashier/orders/[id]/page.tsx',
  'src/app/cashier/page.tsx',
  'src/app/page.tsx',
  'src/app/products/edit/[id]/page.tsx',
  'src/app/produk/[id]/page.tsx',
  'src/app/profil/edit/page.tsx',
  'src/app/profil/login/page.tsx',
  'src/app/profil/page.tsx',
  'src/app/purchases/add/page.tsx',
  'src/app/reports/customers/page.tsx',
  'src/app/reports/finance/page.tsx',
  'src/app/reports/inventory/page.tsx',
  'src/app/reports/operations/page.tsx',
  'src/app/reports/page.tsx',
  'src/app/reports/promotions/page.tsx',
  'src/app/reports/sales/page.tsx',
  'src/app/vouchers/page.tsx',
  'src/lib/excelHelper.ts',
  'src/lib/orders.ts'
];

// Function untuk menambahkan import statement
function addFirebaseImport(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Cek apakah sudah ada import dari firebase
    if (content.includes("from '@/lib/firebase'")) {
      return false; // Sudah ada, skip
    }

    // Cek jenis imports yang dibutuhkan
    const needsAuth = content.includes(' auth') || content.includes('(auth') || content.includes(',auth');
    const needsDb = content.includes(' db') || content.includes('(db') || content.includes(',db');
    const needsStorage = content.includes(' storage') || content.includes('(storage') || content.includes(',storage');

    if (!needsAuth && !needsDb && !needsStorage) {
      return false; // Tidak butuh imports
    }

    // Bangun import statement
    let importStatement = 'import { ';
    if (needsAuth) importStatement += 'auth, ';
    if (needsDb) importStatement += 'db, ';
    if (needsStorage) importStatement += 'storage, ';
    
    // Hapus trailing comma dan spasi
    importStatement = importStatement.replace(/,\s*$/, '');
    importStatement += ' } from \'@/lib/firebase\';\n';

    // Temukan posisi untuk menambahkan import (setelah react imports)
    const lines = content.split('\n');
    let insertIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('import') && lines[i].includes('from')) {
        insertIndex = i + 1;
      } else if (insertIndex !== -1 && !lines[i].includes('import')) {
        break;
      }
    }

    if (insertIndex === -1) {
      insertIndex = 0; // Tambahkan di awal
    }

    // Insert import statement
    lines.splice(insertIndex, 0, importStatement);
    const newContent = lines.join('\n');

    // Create backup
    const backupPath = filePath + '.final-backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
    }
    
    // Write fixed file
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Added imports: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error adding imports to ${filePath}:`, error.message);
  }
  
  return false;
}

function main() {
  console.log('🚀 Starting final import fixes...\n');
  
  let fixedCount = 0;
  
  targetFiles.forEach(filePath => {
    if (addFirebaseImport(filePath)) {
      fixedCount++;
    }
  });
  
  console.log(`\n🎉 Final import fixes completed! ${fixedCount} files have been fixed.`);
  console.log('\n⚠️  Run "npm run typecheck" to verify the fixes');
  
  return fixedCount;
}

// Jalankan script
if (require.main === module) {
  main();
}

module.exports = { main };