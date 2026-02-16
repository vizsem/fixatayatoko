// Script khusus untuk memperbaiki import statements yang salah

const fs = require('fs');
const path = require('path');

// Pattern import yang salah
const importPatterns = [
  {
    pattern: /import\s*\{\s*await getFirebaseAuth\(\)\s*\}\s*from\s*['"].*['"]/g,
    replacement: "import { auth } from '@/lib/firebase'"
  },
  {
    pattern: /import\s*\{\s*await getFirestoreDB\(\)\s*\}\s*from\s*['"].*['"]/g,
    replacement: "import { db } from '@/lib/firebase'"
  },
  {
    pattern: /import\s*\{\s*await getFirebaseStorage\(\)\s*\}\s*from\s*['"].*['"]/g,
    replacement: "import { storage } from '@/lib/firebase'"
  },
  {
    pattern: /import\s*\{\s*await getFirebaseAuth\(\)\s*\}\s*from\s*['"]@\/lib\/firebase['"]/g,
    replacement: "import { auth } from '@/lib/firebase'"
  },
  {
    pattern: /import\s*\{\s*await getFirestoreDB\(\)\s*\}\s*from\s*['"]@\/lib\/firebase['"]/g,
    replacement: "import { db } from '@/lib/firebase'"
  },
  {
    pattern: /import\s*\{\s*await getFirebaseStorage\(\)\s*\}\s*from\s*['"]@\/lib\/firebase['"]/g,
    replacement: "import { storage } from '@/lib/firebase'"
  }
];

// Files yang perlu diperbaiki (berdasarkan error output)
const targetFiles = [
  'src/app/admin/inventory/stock-in/page.tsx',
  'src/app/admin/inventory/stock-in/StockInFormInner.tsx',
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
  'src/app/reports/sales/page.tsx'
];

function fixFileImports(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let modified = false;

    // Apply all import pattern fixes
    importPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(newContent)) {
        newContent = newContent.replace(pattern, replacement);
        modified = true;
      }
    });

    if (modified && newContent !== content) {
      // Create backup
      const backupPath = filePath + '.import-backup';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, content, 'utf8');
      }
      
      // Write fixed file
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Fixed imports: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error fixing imports in ${filePath}:`, error.message);
  }
  
  return false;
}

function main() {
  console.log('🚀 Starting import statements fix...\n');
  
  let fixedCount = 0;
  
  targetFiles.forEach(filePath => {
    if (fixFileImports(filePath)) {
      fixedCount++;
    }
  });
  
  console.log(`\n🎉 Import fix completed! ${fixedCount} files have been fixed.`);
  console.log('\n⚠️  Run "npm run typecheck" to verify the fixes');
  
  return fixedCount;
}

// Jalankan script
if (require.main === module) {
  main();
}

module.exports = { main };