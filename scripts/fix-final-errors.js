const fs = require('fs');
const path = require('path');

console.log('🚀 Fixing remaining auth and db errors...\n');

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
  'src/app/reports/sales/page.tsx',
  'src/app/semua-kategori/page.tsx',
  'src/app/success/page.tsx',
  'src/app/transaksi/[id]/page.tsx',
  'src/app/wishlist/page.tsx'
];

function fixFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    // Fix getFirestoreDB
    if (content.includes('getFirestoreDB()') || content.includes('await getFirestoreDB()')) {
      console.log(`🔧 Fixing getFirestoreDB in: ${filePath}`);
      content = content.replace(/await getFirestoreDB\(\)/g, 'db');
      content = content.replace(/getFirestoreDB\(\)/g, 'db');
      modified = true;
    }

    // Fix getFirebaseAuth
    if (content.includes('getFirebaseAuth()') || content.includes('await getFirebaseAuth()')) {
      console.log(`🔧 Fixing getFirebaseAuth in: ${filePath}`);
      content = content.replace(/await getFirebaseAuth\(\)/g, 'auth');
      content = content.replace(/getFirebaseAuth\(\)/g, 'auth');
      modified = true;
    }

    // Fix imports
    const usesAuth = content.includes('auth') || content.includes('onAuthStateChanged');
    const usesDb = content.includes('db') || content.includes('collection(') || content.includes('doc(');
    
    // Check if imports exist
    const hasAuthImport = content.includes('import { auth') || content.includes(', auth') || content.includes('auth,') || content.includes('auth }');
    const hasDbImport = content.includes('import { db') || content.includes(', db') || content.includes('db,') || content.includes('db }');
    const hasFirebaseImport = content.includes("from '@/lib/firebase'");

    if ((usesAuth && !hasAuthImport) || (usesDb && !hasDbImport)) {
        // Remove existing firebase import line if it exists to replace it cleanly
        if (hasFirebaseImport) {
            const lines = content.split('\n');
            const importLineIndex = lines.findIndex(line => line.includes("from '@/lib/firebase'"));
            if (importLineIndex !== -1) {
                // Check what's currently imported
                const currentImportLine = lines[importLineIndex];
                let imports = [];
                if (currentImportLine.includes('auth')) imports.push('auth');
                if (currentImportLine.includes('db')) imports.push('db');
                if (currentImportLine.includes('storage')) imports.push('storage');
                
                // Add missing imports
                if (usesAuth && !imports.includes('auth')) imports.push('auth');
                if (usesDb && !imports.includes('db')) imports.push('db');
                
                // Sort and unique
                imports = [...new Set(imports)].sort();
                
                lines[importLineIndex] = `import { ${imports.join(', ')} } from '@/lib/firebase';`;
                content = lines.join('\n');
                modified = true;
                console.log(`✅ Updated imports in: ${filePath}`);
            }
        } else {
            // Add new import
            const imports = [];
            if (usesAuth) imports.push('auth');
            if (usesDb) imports.push('db');
            
            const importStatement = `import { ${imports.join(', ')} } from '@/lib/firebase';\n`;
            
            // Insert after last import
            const lines = content.split('\n');
            let lastImportIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import')) {
                    lastImportIndex = i;
                }
            }
            
            if (lastImportIndex !== -1) {
                lines.splice(lastImportIndex + 1, 0, importStatement);
            } else {
                lines.unshift(importStatement);
            }
            content = lines.join('\n');
            modified = true;
            console.log(`✅ Added imports in: ${filePath}`);
        }
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
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Processed ${filesToFix.length} files, fixed ${fixedCount} files!`);
console.log('⚠️  Run "npm run typecheck" to verify the fixes');