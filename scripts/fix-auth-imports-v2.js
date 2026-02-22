const fs = require('fs');
const path = require('path');

console.log('🚀 Fixing missing auth imports (v2)...\n');

const filesToFix = [
  'src/app/admin/employees/page.tsx',
  'src/app/admin/inventory/history/page.tsx',
  'src/app/admin/products/add/page.tsx',
  'src/app/admin/products/edit/[id]/page.tsx',
  'src/app/admin/promotions/edit/[id]/page.tsx',
  'src/app/admin/purchases/[id]/page.tsx',
  'src/app/admin/purchases/add/page.tsx',
  'src/app/admin/reports/finance/page.tsx',
  'src/app/admin/reports/inventory/page.tsx',
  'src/app/admin/reports/operations/page.tsx',
  'src/app/admin/reports/promotions/page.tsx',
  'src/app/admin/reports/sales/page.tsx',
  'src/app/admin/settings/points/page.tsx',
  'src/app/admin/suppliers/page.tsx',
  'src/app/admin/users/page.tsx',
  'src/app/admin/warehouses/add/page.tsx',
  'src/app/admin/warehouses/mutasi/[id]/page.tsx',
  'src/app/cart/page.tsx',
  'src/app/cashier/orders/[id]/page.tsx',
  'src/app/cashier/page.tsx',
  'src/app/kategori/[slug]/page.tsx',
  'src/app/orders/[id]/page.tsx',
  'src/app/orders/page.tsx',
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

function fixImport(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      // console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Case 1: Has "import { db } from '@/lib/firebase';" but needs auth
    if (content.includes("import { db } from '@/lib/firebase';") && !content.includes('auth')) {
        // Double check if auth is actually used
        if (content.includes('onAuthStateChanged') || content.includes('signInWithEmailAndPassword') || content.includes('createUserWithEmailAndPassword')) {
            content = content.replace("import { db } from '@/lib/firebase';", "import { auth, db } from '@/lib/firebase';");
            modified = true;
            console.log(`✅ Replaced db import with auth, db in: ${filePath}`);
        }
    }
    
    // Case 2: Has "import { db } from '@/lib/firebase';" AND uses auth, but auth not in import
    // This handles if "auth" word is present elsewhere but not in import line
    if (content.includes("import { db } from '@/lib/firebase';")) {
        const usesAuth = content.includes('onAuthStateChanged') || content.includes('auth.currentUser');
        if (usesAuth) {
             content = content.replace("import { db } from '@/lib/firebase';", "import { auth, db } from '@/lib/firebase';");
             modified = true;
             console.log(`✅ Added auth to db import in: ${filePath}`);
        }
    }

    // Case 3: No firebase import at all, but needs auth
    if (!content.includes("from '@/lib/firebase'") && (content.includes('onAuthStateChanged') || content.includes('auth.currentUser'))) {
        // Insert import
        const lines = content.split('\n');
        let insertIdx = 0;
        for(let i=0; i<lines.length; i++) {
            if(lines[i].trim().startsWith('import')) insertIdx = i + 1;
        }
        lines.splice(insertIdx, 0, "import { auth } from '@/lib/firebase';");
        content = lines.join('\n');
        modified = true;
        console.log(`✅ Added new auth import in: ${filePath}`);
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      return true;
    }
    return false;

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

let fixedCount = 0;
filesToFix.forEach(file => {
  if (fixImport(file)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Processed ${filesToFix.length} files, fixed ${fixedCount} files!`);