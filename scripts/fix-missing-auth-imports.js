const fs = require('fs');
const path = require('path');

console.log('🚀 Fixing missing auth imports...\n');

const filesToFix = [
  'src/app/admin/employees/page.tsx',
  'src/app/admin/inventory/history/page.tsx',
  'src/app/admin/products/add/page.tsx',
  'src/app/admin/products/edit/[id]/page.tsx',
  'src/app/admin/promotions/edit/[id]/page.tsx',
  'src/app/admin/purchases/[id]/page.tsx',
  'src/app/admin/purchases/add/page.tsx',
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
      console.log(`❌ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if auth is used but not imported
    const usesAuth = content.includes('auth') || content.includes('onAuthStateChanged');
    const hasAuthImport = content.includes('import { auth') || content.includes(', auth') || content.includes('auth,') || content.includes('auth }');
    
    if (usesAuth && !hasAuthImport) {
       // Look for existing firebase import
       if (content.includes("from '@/lib/firebase'")) {
           content = content.replace(/import { (.+) } from '@\/lib\/firebase'/, (match, imports) => {
               const parts = imports.split(',').map(s => s.trim());
               if (!parts.includes('auth')) {
                   parts.push('auth');
                   parts.sort();
                   return `import { ${parts.join(', ')} } from '@/lib/firebase'`;
               }
               return match;
           });
           fs.writeFileSync(fullPath, content, 'utf8');
           console.log(`✅ Added auth to existing import: ${filePath}`);
           return true;
       } else {
           // Add new import
           // Find where to insert
           const lines = content.split('\n');
           let insertIdx = 0;
           for(let i=0; i<lines.length; i++) {
               if(lines[i].startsWith('import')) insertIdx = i + 1;
           }
           lines.splice(insertIdx, 0, "import { auth } from '@/lib/firebase';");
           fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
           console.log(`✅ Added new auth import: ${filePath}`);
           return true;
       }
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