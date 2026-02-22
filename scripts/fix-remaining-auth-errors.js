const fs = require('fs');
const path = require('path');

// List semua file yang masih memiliki errors
const filesWithErrors = [
  'src/app/admin/inventory/stock-in/page.tsx',
  'src/app/admin/promotions/page.tsx',
  'src/app/admin/reports/customers/page.tsx',
  'src/app/admin/reports/finance/page.tsx',
  'src/app/admin/reports/inventory/page.tsx',
  'src/app/admin/reports/operations/page.tsx',
  'src/app/admin/reports/promotions/page.tsx',
  'src/app/admin/reports/sales/page.tsx',
  'src/app/admin/suppliers/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/app/admin/warehouses/add/page.tsx',
  'src/app/cashier/orders/[id]/page.tsx',
  'src/app/cashier/page.tsx',
  'src/app/products/edit/[id]/page.tsx',
  'src/app/profil/edit/page.tsx',
  'src/app/purchases/add/page.tsx',
  'src/app/reports/customers/page.tsx',
  'src/app/reports/finance/page.tsx',
  'src/app/reports/inventory/page.tsx',
  'src/app/reports/operations/page.tsx',
  'src/app/reports/page.tsx',
  'src/app/reports/promotions/page.tsx',
  'src/app/reports/sales/page.tsx',
  'src/lib/orders.ts'
];

function fixAuthImport(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip jika sudah ada import auth
    if (content.includes("from '@/lib/firebase'") && content.includes('auth')) {
      console.log(`✅ Already has auth import: ${filePath}`);
      return false;
    }
    
    // Cek apakah file menggunakan auth
    const usesAuth = content.includes(' auth') || 
                     content.includes('(auth') || 
                     content.includes(',auth') ||
                     content.includes('onAuthStateChanged');
    
    if (!usesAuth) {
      console.log(`⚠️  No auth usage found: ${filePath}`);
      return false;
    }
    
    // Buat import statement
    const importStatement = 'import { auth } from \'@/lib/firebase\';\n';
    
    // Cari posisi untuk insert import
    const lines = content.split('\n');
    let insertIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('import') && lines[i].includes('from')) {
        insertIndex = i + 1;
      } else if (insertIndex !== -1 && !lines[i].includes('import')) {
        break;
      }
    }
    
    if (insertIndex === -1) insertIndex = 0;
    
    // Insert import statement
    lines.splice(insertIndex, 0, importStatement);
    const newContent = lines.join('\n');
    
    // Buat backup
    const backupPath = filePath + '.auth-backup';
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
    }
    
    // Write file baru
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Added auth import: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
    return false;
  }
}

console.log('🚀 Fixing remaining auth imports...\n');

let fixedCount = 0;
filesWithErrors.forEach(filePath => {
  if (fixAuthImport(filePath)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files!`);
console.log('⚠️  Run "npm run typecheck" to verify the fixes');