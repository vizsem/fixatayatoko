// Script untuk memperbaiki await errors di luar async context

const fs = require('fs');
const path = require('path');

// Pattern errors yang akan diperbaiki
const awaitPatterns = [
  // Pattern: await getFirebaseAuth() dalam function calls
  {
    pattern: /\(await getFirebaseAuth\(\)\)/g,
    replacement: "(auth)"
  },
  {
    pattern: /, await getFirebaseAuth\(\)/g,
    replacement: ", auth"
  },
  {
    pattern: / await getFirebaseAuth\(\)/g,
    replacement: " auth"
  },
  
  // Pattern: await getFirestoreDB() dalam function calls
  {
    pattern: /\(await getFirestoreDB\(\)\)/g,
    replacement: "(db)"
  },
  {
    pattern: /, await getFirestoreDB\(\)/g,
    replacement: ", db"
  },
  {
    pattern: / await getFirestoreDB\(\)/g,
    replacement: " db"
  },
  
  // Pattern: await getFirebaseStorage() dalam function calls
  {
    pattern: /\(await getFirebaseStorage\(\)\)/g,
    replacement: "(storage)"
  },
  {
    pattern: /, await getFirebaseStorage\(\)/g,
    replacement: ", storage"
  },
  {
    pattern: / await getFirebaseStorage\(\)/g,
    replacement: " storage"
  },
  
  // Pattern khusus untuk onAuthStateChanged
  {
    pattern: /onAuthStateChanged\(await getFirebaseAuth\(\)/g,
    replacement: "onAuthStateChanged(auth"
  },
  
  // Pattern untuk doc() function
  {
    pattern: /doc\(await getFirestoreDB\(\)/g,
    replacement: "doc(db"
  },
  
  // Pattern untuk collection() function
  {
    pattern: /collection\(await getFirestoreDB\(\)/g,
    replacement: "collection(db"
  }
];

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

function fixAwaitErrors(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    // Apply all await pattern fixes
    awaitPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(newContent)) {
        newContent = newContent.replace(pattern, replacement);
        modified = true;
      }
    });

    if (modified && newContent !== content) {
      // Create backup
      const backupPath = filePath + '.await-backup';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, 'utf8');
      }
      
      // Write fixed file
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Fixed await errors: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error fixing await errors in ${filePath}:`, error.message);
  }
  
  return false;
}

function main() {
  console.log('🚀 Starting await errors fix...\n');
  
  let fixedCount = 0;
  
  targetFiles.forEach(filePath => {
    if (fixAwaitErrors(filePath)) {
      fixedCount++;
    }
  });
  
  console.log(`\n🎉 Await errors fix completed! ${fixedCount} files have been fixed.`);
  console.log('\n⚠️  Run "npm run typecheck" to verify the fixes');
  
  return fixedCount;
}

// Jalankan script
if (require.main === module) {
  main();
}

module.exports = { main };